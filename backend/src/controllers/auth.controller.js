const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });
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
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
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
      return res.status(400).json({ message: 'Meta mensal inválida.' });
    }

    req.user.monthlyBudget = monthlyBudget;
    await req.user.save();

    return res.json({ user: req.user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me, updateSettings };
