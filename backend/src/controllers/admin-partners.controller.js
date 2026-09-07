const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const PartnerInvite = require('../models/PartnerInvite');

const normalizeCode = value => String(value || '').trim().toUpperCase();
const percent = value => Number(value || 0);

function validate(body) {
  const code = normalizeCode(body.code);
  const discountPercent = percent(body.discountPercent);
  const commissionPercent = percent(body.commissionPercent);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return 'Use um código de 3 a 32 caracteres: letras, números, _ ou -.';
  if (![discountPercent, commissionPercent].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return 'Desconto e comissão devem estar entre 0 e 100.';
  if (discountPercent + commissionPercent > 100) return 'A soma de desconto e comissão não pode ultrapassar 100%.';
  if (body.expiresAt && Number.isNaN(new Date(body.expiresAt).getTime())) return 'Data de vencimento inválida.';
  return null;
}

async function statsFor(partner) {
  const referredUsers = await User.find({ referredByPartner: partner._id }).select('_id').lean();
  const ids = referredUsers.map(item => item._id);
  const paid = ids.length ? await mongoose.connection.collection('payments').aggregate([
    { $match: { userId: { $in: ids }, status: { $in: ['approved', 'processed'] } } },
    { $group: { _id: null, sales: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$amount', 0] } } } }
  ]).toArray() : [];
  const totals = paid[0] || { sales: 0, revenue: 0 };
  return {
    registrations: ids.length,
    sales: totals.sales || 0,
    revenue: totals.revenue || 0,
    estimatedCommission: Number(((totals.revenue || 0) * (partner.partnerCommissionPercent || 0) / 100).toFixed(2))
  };
}

function serialize(partner, stats) {
  return {
    id: partner._id.toString(), name: partner.name, email: partner.email,
    code: partner.partnerCode, active: Boolean(partner.partnerActive),
    expiresAt: partner.partnerExpiresAt || null,
    discountPercent: partner.partnerDiscountPercent || 0,
    commissionPercent: partner.partnerCommissionPercent || 0,
    stats
  };
}

async function list(req, res, next) {
  try {
    const partners = await User.find({ plan: 'partner' }).sort({ partnerGrantedAt: -1 });
    res.json({ partners: await Promise.all(partners.map(async partner => serialize(partner, await statsFor(partner)))) });
  } catch (error) { next(error); }
}

async function grant(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ message: error });
    const email = String(req.body.email || '').trim().toLowerCase();
    const partner = await User.findOne({ email });
    if (!partner) return res.status(404).json({ message: 'Crie primeiro uma conta comum com este e-mail.' });
    const code = normalizeCode(req.body.code);
    const duplicate = await User.findOne({ partnerCode: code, _id: { $ne: partner._id } });
    if (duplicate) return res.status(409).json({ message: 'Este código de parceiro já está em uso.' });
    partner.plan = 'partner'; partner.status = 'active'; partner.partnerCode = code; partner.partnerActive = true;
    partner.partnerExpiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
    partner.partnerDiscountPercent = percent(req.body.discountPercent);
    partner.partnerCommissionPercent = percent(req.body.commissionPercent);
    partner.partnerGrantedAt = new Date(); partner.partnerGrantedBy = req.user._id;
    partner.billingRevision = (partner.billingRevision || 0) + 1;
    await partner.save();
    res.json({ partner: serialize(partner, await statsFor(partner)) });
  } catch (error) { next(error); }
}

async function invite(req, res, next) {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ message: error });
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = normalizeCode(req.body.code);
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Informe o nome do parceiro.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'Este e-mail já possui conta. Use “Conceder a conta existente”.' });
    if (await User.exists({ partnerCode: code })) return res.status(409).json({ message: 'Este código de parceiro já está em uso.' });
    await PartnerInvite.deleteMany({ $or: [{ email }, { code }], acceptedAt: null });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitation = await PartnerInvite.create({
      name, email, code, tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      accessExpiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      discountPercent: percent(req.body.discountPercent),
      commissionPercent: percent(req.body.commissionPercent),
      createdBy: req.user._id
    });
    res.status(201).json({
      invitation: { name, email, code, expiresAt: invitation.expiresAt },
      invitePath: `/partner-invite.html?token=${rawToken}`
    });
  } catch (error) { next(error); }
}

async function revoke(req, res, next) {
  try {
    const partner = await User.findOne({ _id: req.params.id, plan: 'partner' });
    if (!partner) return res.status(404).json({ message: 'Parceiro não encontrado.' });
    partner.partnerActive = false; partner.status = 'blocked'; partner.billingRevision = (partner.billingRevision || 0) + 1;
    await partner.save();
    res.json({ partner: serialize(partner, await statsFor(partner)) });
  } catch (error) { next(error); }
}

module.exports = { list, grant, invite, revoke };
