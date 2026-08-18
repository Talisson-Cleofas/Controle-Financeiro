import { getPlanDays } from './plans.js';

export function accessState(user, now = new Date()) {
  if (!user) return { allowed: false, reason: 'Conta não encontrada.' };
  if (user.role === 'admin' || user.plan === 'lifetime') return { allowed: true, source: user.role === 'admin' ? 'admin' : 'lifetime' };
  if (['blocked', 'cancelled'].includes(user.status)) return { allowed: false, reason: user.status === 'blocked' ? 'Conta bloqueada.' : 'Assinatura cancelada.' };
  if (user.status === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now) return { allowed: true, source: 'subscription', endsAt: user.subscriptionEndsAt };
  if (user.status === 'trial' && user.trialEndsAt && new Date(user.trialEndsAt) > now) return { allowed: true, source: 'trial', endsAt: user.trialEndsAt };
  return { allowed: false, reason: 'Seu período de acesso expirou. Escolha um plano para continuar.' };
}

export async function normalizeExpiredUser(user, now = new Date()) {
  if (!user || user.role === 'admin' || user.plan === 'lifetime' || ['blocked', 'cancelled', 'past_due'].includes(user.status)) return user;
  const expiredTrial = user.status === 'trial' && (!user.trialEndsAt || new Date(user.trialEndsAt) <= now);
  const expiredSubscription = user.status === 'active' && (!user.subscriptionEndsAt || new Date(user.subscriptionEndsAt) <= now);
  if (expiredTrial || expiredSubscription) {
    user.status = 'past_due';
    await user.save();
  }
  return user;
}

export function addPlanPeriod(user, plan, now = new Date()) {
  if (plan === 'lifetime') return null;
  const days = getPlanDays(plan);
  if (!days) throw new Error('Plano inválido.');
  const currentEnd = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;
  const base = currentEnd && currentEnd > now ? currentEnd : now;
  return new Date(base.getTime() + days * 86_400_000);
}
