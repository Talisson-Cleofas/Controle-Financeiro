import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlan, listPlans } from '../src/services/plans.js';
import { accessState, addPlanPeriod } from '../src/services/subscription.js';

test('expõe os três planos comerciais com os preços aprovados', () => {
  delete process.env.PLAN_MONTHLY_PRICE;
  delete process.env.PLAN_SEMIANNUAL_PRICE;
  delete process.env.PLAN_YEARLY_PRICE;
  assert.deepEqual(
    listPlans().map(({ id, price, days }) => ({ id, price, days })),
    [
      { id: 'monthly', price: 19.9, days: 30 },
      { id: 'semiannual', price: 99.9, days: 180 },
      { id: 'yearly', price: 179.9, days: 365 }
    ]
  );
});

test('permite sobrescrever preços por variáveis de ambiente', () => {
  process.env.PLAN_SEMIANNUAL_PRICE = '109.90';
  assert.equal(getPlan('semiannual').price, 109.9);
  delete process.env.PLAN_SEMIANNUAL_PRICE;
});

test('adiciona exatamente o período contratado', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const user = { subscriptionEndsAt: null };
  assert.equal(addPlanPeriod(user, 'monthly', now).toISOString(), '2026-08-30T12:00:00.000Z');
  assert.equal(addPlanPeriod(user, 'semiannual', now).toISOString(), '2027-01-27T12:00:00.000Z');
  assert.equal(addPlanPeriod(user, 'yearly', now).toISOString(), '2027-07-31T12:00:00.000Z');
});

test('preserva dias restantes ao renovar antes do vencimento', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const user = { subscriptionEndsAt: new Date('2026-08-10T12:00:00.000Z') };
  assert.equal(addPlanPeriod(user, 'monthly', now).toISOString(), '2026-09-09T12:00:00.000Z');
});

test('autoriza teste ativo e bloqueia teste expirado', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  assert.equal(accessState({ role: 'user', plan: 'trial', status: 'trial', trialEndsAt: new Date('2026-08-01T12:00:00.000Z') }, now).allowed, true);
  assert.equal(accessState({ role: 'user', plan: 'trial', status: 'trial', trialEndsAt: new Date('2026-07-30T12:00:00.000Z') }, now).allowed, false);
});

test('rejeita plano desconhecido', () => {
  assert.throws(() => addPlanPeriod({}, 'invalid', new Date()), /Plano inválido/);
});

test('rejeita preço inválido vindo do ambiente', () => {
  process.env.PLAN_MONTHLY_PRICE = '0';
  assert.throws(() => getPlan('monthly'), /valor positivo/);
  delete process.env.PLAN_MONTHLY_PRICE;
});
