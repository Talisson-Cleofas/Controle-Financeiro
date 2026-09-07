const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PartnerInvite = require('../models/PartnerInvite');
const crypto = require('crypto');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function fail(res, status, message) {
  return res.status(status).json({ message, error: message });
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return fail(res, 400, 'Nome, e-mail e senha são obrigatórios.');
    }

    if (String(password).length < 6) {
      return fail(res, 400, 'A senha deve ter pelo menos 6 caracteres.');
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) {
      return fail(res, 409, 'Este e-mail já está cadastrado.');
    }

    const passwordHash = await User.hashPassword(password);
    const enrollment = require('../services/billing-access').billingEnabled()
      ? { billingEnrolledAt: new Date(), status: 'trial', plan: 'trial', trialEndsAt: new Date(Date.now() + 3 * 86400000) }
      : {};
    const rawReferral = String(req.body.referralCode || req.body.ref || '').trim().toUpperCase();
    let referral = {};
    if (rawReferral && /^[A-Z0-9_-]{3,32}$/.test(rawReferral)) {
      const partner = await User.findOne({
        partnerCode: rawReferral,
        plan: 'partner',
        partnerActive: true,
        $or: [{ partnerExpiresAt: null }, { partnerExpiresAt: { $gt: new Date() } }]
      });
      if (partner) referral = { referredByPartner: partner._id, referredByPartnerCode: partner.partnerCode };
    }
    const user = await User.create({ name, email, passwordHash, ...enrollment, ...referral });
    const token = signToken(user);

    return res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return fail(res, 400, 'E-mail e senha são obrigatórios.');
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      return fail(res, 401, 'E-mail ou senha inválidos.');
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return fail(res, 401, 'E-mail ou senha inválidos.');
    }

    const token = signToken(user);
    return res.json({ token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  return res.json({ user: req.user.toSafeJSON() });
}

async function updateSettings(req, res, next) {
  try {
    const monthlyBudget = Number(req.body.monthlyBudget || 0);
    if (Number.isNaN(monthlyBudget) || monthlyBudget < 0) {
      return fail(res, 400, 'Meta mensal inválida.');
    }

    const { result: user } = await require('../services/financial-data').financialWrite(req.user._id, async (session, current) => {
      current.monthlyBudget = monthlyBudget;
      return current;
    });
    return res.json({ user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

const inviteHash = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');

async function inspectPartnerInvite(req, res, next) {
  try {
    const invitation = await PartnerInvite.findOne({ tokenHash: inviteHash(req.body.token), acceptedAt: null, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!invitation) return fail(res, 404, 'Convite inválido, expirado ou já utilizado.');
    return res.json({ invitation: { name: invitation.name, email: invitation.email, code: invitation.code, expiresAt: invitation.expiresAt } });
  } catch (error) { next(error); }
}

async function acceptPartnerInvite(req, res, next) {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) return fail(res, 400, 'A senha deve ter pelo menos 8 caracteres.');
    const tokenHash = inviteHash(req.body.token);
    const passwordHash = await User.hashPassword(password);
    let createdUser;
    await User.db.transaction(async session => {
      const invitation = await PartnerInvite.findOne({ tokenHash, acceptedAt: null, expiresAt: { $gt: new Date() } }).select('+tokenHash').session(session);
      if (!invitation) { const error = new Error('Convite inválido, expirado ou já utilizado.'); error.status = 404; throw error; }
      if (await User.exists({ email: invitation.email }).session(session)) { const error = new Error('Este e-mail já possui conta.'); error.status = 409; throw error; }
      const users = await User.create([{
        name: invitation.name, email: invitation.email, passwordHash,
        billingEnrolledAt: new Date(), role: 'user', status: 'active', plan: 'partner',
        partnerCode: invitation.code, partnerActive: true, partnerExpiresAt: invitation.accessExpiresAt,
        partnerDiscountPercent: invitation.discountPercent, partnerCommissionPercent: invitation.commissionPercent,
        partnerGrantedAt: new Date(), partnerGrantedBy: invitation.createdBy
      }], { session });
      createdUser = users[0];
      invitation.acceptedAt = new Date();
      await invitation.save({ session });
    });
    const token = signToken(createdUser);
    return res.status(201).json({ token, user: createdUser.toSafeJSON() });
  } catch (error) {
    if (error.status) return fail(res, error.status, error.message);
    next(error);
  }
}

module.exports = { register, login, me, updateSettings, inspectPartnerInvite, acceptPartnerInvite };
