import mongoose from 'mongoose';
import Payment, { ensurePaymentIndexes } from './models/Payment.js';
import WebhookJob from './models/WebhookJob.js';
import { startBillingWorker } from './services/billing-webhooks.js';
import { listPlans } from './services/plans.js';

export function validateBillingConfig() {
  for (const key of ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'BACKEND_URL', 'FRONTEND_URL']) {
    if (!process.env[key]?.trim()) throw new Error(`Configuração obrigatória ausente: ${key}`);
  }
  for (const key of ['BACKEND_URL', 'FRONTEND_URL']) {
    const url = new URL(process.env[key]);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error(`Use uma origem HTTPS sem caminho em ${key}`);
    }
    process.env[key] = url.origin;
  }
  if (!['production', 'test'].includes(process.env.MERCADO_PAGO_ENV || 'production')) throw new Error('Ambiente de pagamento inválido.');
  listPlans();
}

export async function initializeBilling() {
  validateBillingConfig();
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Cobrança exige MongoDB com transações.');
  await Payment.init();
  await ensurePaymentIndexes();
  await WebhookJob.init();
  return startBillingWorker();
}
