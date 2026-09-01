const billingEnabled = () => process.env.BILLING_ENABLED === 'true';
const enforcementEnabled = () => billingEnabled() && process.env.BILLING_ENFORCE_ACCESS === 'true';

function accessState(user, now = new Date()) {
  if (!user) return { allowed: false, reason: 'Conta não encontrada.' };
  if (!enforcementEnabled()) return { allowed: true, source: 'compatibility' };
  if (user.role === 'admin' || user.plan === 'lifetime') return { allowed: true, source: 'permanent' };
  if (['blocked', 'cancelled'].includes(user.status)) return { allowed: false, reason: 'Acesso suspenso.' };
  if (!user.billingEnrolledAt) return { allowed: true, source: 'legacy' };
  const end = user.status === 'trial' ? user.trialEndsAt : user.status === 'active' ? user.subscriptionEndsAt : null;
  return end && new Date(end) > now
    ? { allowed: true, source: user.status, endsAt: end }
    : { allowed: false, reason: 'Seu acesso expirou. Renove seu plano.' };
}

function requireWriteAccess(req, res, next) {
  const access = accessState(req.user);
  if (!access.allowed) return res.status(403).json({ message: access.reason, error: access.reason, code: 'SUBSCRIPTION_REQUIRED' });
  next();
}

module.exports = { billingEnabled, enforcementEnabled, accessState, requireWriteAccess };
