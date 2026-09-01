const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    const user = await User.create({ name, email, passwordHash, ...enrollment });
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

module.exports = { register, login, me, updateSettings };
