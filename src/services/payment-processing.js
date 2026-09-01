import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { getPlan } from './plans.js';
import { addPlanPeriod } from './subscription.js';
import { mercadoPagoTestMode } from './mercadopago-client.js';
import { sendMail } from './mail.js';

const reversals = new Set(['refunded', 'charged_back']);
const cents = value => Math.round(Number(value) * 100);
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value) : undefined;

function normalizePayment(p) {
  const tx = p.point_of_interaction?.transaction_data || {};
  return {
    externalId: String(p.id || ''), externalReference: String(p.external_reference || ''),
    preferenceId: p.preference_id, status: String(p.status || 'pending'), statusDetail: p.status_detail,
    amount: Number(p.transaction_amount), currency: p.currency_id,
    refundedAmount: Number(p.transaction_amount_refunded || 0),
    providerUpdatedAt: date(p.date_last_updated), paidAt: date(p.date_approved),
    paymentMethod: p.payment_method_id, qrCode: tx.qr_code, qrCodeBase64: tx.qr_code_base64,
    ticketUrl: tx.ticket_url, expiresAt: date(p.date_of_expiration), payload: p
  };
}

function normalizeOrder(order) {
  // Orders are only the existing sandbox adapter. Production uses /v1/payments.
  if (!mercadoPagoTestMode()) throw new Error('Orders não habilitadas em produção.');
  if (order.transactions?.payments?.length !== 1) throw new Error('Order deve conter um pagamento.');
  const tx = order.transactions.payments[0];
  const states = [String(order.status), String(tx.status)];
  const reversal = states.find(state => reversals.has(state));
  const approved = states.every(state => ['processed', 'approved'].includes(state));
  const method = tx.payment_method || {};
  if (approved && cents(order.total_paid_amount ?? tx.paid_amount) !== cents(order.total_amount)) {
    throw new Error('Order não foi integralmente paga.');
  }
  return {
    externalId: String(tx.id || order.id || ''), externalReference: String(order.external_reference || ''),
    preferenceId: String(order.id),
    status: reversal || (approved ? 'approved' : states.some(state => ['failed', 'cancelled', 'canceled'].includes(state)) ? 'rejected' : 'pending'),
    statusDetail: order.status_detail || tx.status_detail,
    amount: Number(order.total_amount), currency: order.currency_id || 'BRL',
    refundedAmount: Number(order.total_refunded_amount || 0),
    providerUpdatedAt: date(order.last_updated_date),
    paymentMethod: method.id, qrCode: method.qr_code, qrCodeBase64: method.qr_code_base64,
    ticketUrl: method.ticket_url, payload: order
  };
}

function review(payment, reason) {
  payment.needsReview = true;
  payment.reviewReason = reason;
}

async function reverseLicense(payment, user, now, session) {
  if (!payment.processedAt || payment.licenseReversedAt) return;
  if (!payment.licenseStartsAt || !payment.licenseEndsAt) {
    review(payment, 'Pagamento legado ou sem concessão rastreável: revisar o acesso manualmente.');
    return;
  }
  if (user.role === 'admin' || user.plan === 'lifetime') {
    payment.licenseReversedAt = now;
    return;
  }
  const grants = await Payment.find({
    userId: user._id, licenseEndsAt: { $exists: true }, licenseReversedAt: null
  }).session(session).sort({ licenseStartsAt: 1, _id: 1 });
  const lastEnd = Math.max(...grants.map(grant => grant.licenseEndsAt.getTime()));
  if (lastEnd !== user.subscriptionEndsAt?.getTime()) {
    review(payment, 'Validade alterada fora do fluxo de pagamentos: revisar antes de descontar dias.');
    return;
  }
  // Remove only this purchase's unconsumed time. Shift later purchases by the same
  // interval, preserving their full duration and making subsequent refunds composable.
  const unused = Math.max(0, payment.licenseEndsAt.getTime() - Math.max(now.getTime(), payment.licenseStartsAt.getTime()));
  if (unused) {
    for (const grant of grants) {
      if (String(grant._id) !== String(payment._id) && grant.licenseStartsAt >= payment.licenseEndsAt) {
        grant.licenseStartsAt = new Date(grant.licenseStartsAt.getTime() - unused);
        grant.licenseEndsAt = new Date(grant.licenseEndsAt.getTime() - unused);
        await grant.save({ session });
      }
    }
    user.subscriptionEndsAt = new Date(Math.max(now.getTime(), user.subscriptionEndsAt.getTime() - unused));
    if (user.subscriptionEndsAt <= now && !['blocked', 'cancelled'].includes(user.status)) user.status = 'past_due';
  }
  payment.licenseReversedAt = now;
}

async function applyPayment(remote, { now = new Date(), sandboxOrder = false } = {}) {
  const parts = remote.externalReference.includes(':') ? remote.externalReference.split(':') : remote.externalReference.split('_');
  const [userId, plan] = parts;
  const selectedPlan = getPlan(plan);
  if (!mongoose.isObjectIdOrHexString(userId) || !selectedPlan) return null;
  if (!remote.externalId || !Number.isFinite(remote.amount) || remote.amount <= 0 || !Number.isFinite(remote.refundedAmount) || remote.refundedAmount < 0) {
    throw new Error('Pagamento com identificador ou valor inválido.');
  }
  const fullRefund = remote.status === 'refunded' || (remote.refundedAmount > 0 && cents(remote.refundedAmount) >= cents(remote.amount));
  if (fullRefund) remote.status = 'refunded';
  let result;
  // A concurrent first insert may produce E11000 rather than a transient transaction
  // label. Retry the entire transaction so the winner is read, never just the write.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await mongoose.connection.transaction(async session => {
        let payment = await Payment.findOne({ provider: 'mercadopago', externalId: remote.externalId }).session(session);
        if (!payment) {
          const intents = [{ externalReference: remote.externalReference }];
          if (remote.preferenceId) intents.push({ preferenceId: remote.preferenceId });
          payment = await Payment.findOne({ provider: 'mercadopago', externalId: null, $or: intents }).session(session);
        }
        if (payment && (String(payment.userId) !== userId || payment.plan !== plan)) throw new Error('Pagamento não corresponde à conta e ao plano.');
        if (payment?.externalReference && payment.externalReference !== remote.externalReference) throw new Error('Referência de pagamento divergente.');
        if (payment?.providerUpdatedAt && remote.providerUpdatedAt && remote.providerUpdatedAt < payment.providerUpdatedAt) return { payment };
        // A late approval must never resurrect a refunded purchase.
        if (payment && reversals.has(payment.status) && !reversals.has(remote.status)) return { payment };
        if (payment?.processedAt && ['pending', 'in_process', 'authorized'].includes(remote.status)) return { payment };
        const expected = payment?.expectedAmount ?? payment?.amount ?? (sandboxOrder ? 50 : selectedPlan.price);
        if (remote.currency !== 'BRL' || cents(remote.amount) !== cents(expected)) throw new Error('Moeda ou valor do pagamento não corresponde à compra.');
        const user = await User.findById(userId).session(session);
        if (!user) throw new Error('Conta do pagamento não encontrada.');
        // Every transaction writes the account, serializing distinct renewals/refunds too.
        user.billingRevision = (user.billingRevision || 0) + 1;
        payment ||= new Payment({ provider: 'mercadopago', userId, plan });
        Object.assign(payment, Object.fromEntries(Object.entries(remote).filter(([, value]) => value !== undefined)), { expectedAmount: expected });
        let activated = false;
        if (reversals.has(remote.status)) {
          await reverseLicense(payment, user, now, session);
        } else if (remote.refundedAmount > 0) {
          review(payment, 'Reembolso parcial: definir o ajuste de acesso manualmente.');
        } else if (remote.status === 'approved' && !payment.processedAt) {
          if (user.role !== 'admin' && user.plan !== 'lifetime') {
            payment.licenseStartsAt = user.subscriptionEndsAt > now ? user.subscriptionEndsAt : now;
            payment.licenseEndsAt = addPlanPeriod(user, plan, now);
            user.subscriptionEndsAt = payment.licenseEndsAt;
            user.plan = plan;
            if (!['blocked', 'cancelled'].includes(user.status)) user.status = 'active';
          }
          payment.processedAt = now;
          activated = true;
        } else if (payment.processedAt && !['approved', 'refunded', 'charged_back'].includes(remote.status)) {
          review(payment, 'Estado inesperado após aprovação: revisar o acesso.');
        }
        await user.save({ session });
        await payment.save({ session });
        return { payment, activated, email: user.email };
      }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      break;
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
  // SMTP is deliberately outside the transaction. Its failure cannot roll back or
  // repeat a license grant. Reliable mail delivery remains a separate concern.
  if (result.activated) {
    try {
      await sendMail({ to: result.email, subject: 'Pagamento aprovado — acesso liberado', html: '<p>Seu pagamento foi confirmado. Consulte a validade do plano na sua conta.</p>' });
    } catch {
      console.error('Falha no e-mail de confirmação; pagamento e licença foram preservados.');
    }
  }
  return result.payment;
}

export const processPayment = (payment, options) => applyPayment(normalizePayment(payment), options);
export const processOrder = (order, options) => applyPayment(normalizeOrder(order), { ...options, sandboxOrder: true });
