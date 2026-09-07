import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBillingConfig } from '../src/billing/initialize.js';
import policy from '../src/services/billing-access.js';

test('cobrança e bloqueio são opt-in e preservam contas antigas', () => {
  delete process.env.BILLING_ENABLED;
  process.env.BILLING_ENFORCE_ACCESS = 'true';
  assert.equal(policy.accessState({ status: 'past_due' }).allowed, true);
  process.env.BILLING_ENABLED = 'true';
  assert.equal(policy.accessState({}).source, 'legacy');
  assert.equal(policy.accessState({ billingEnrolledAt: new Date(), status: 'past_due' }).allowed, false);
  assert.equal(policy.accessState({ status: 'blocked' }).allowed, false);
  delete process.env.BILLING_ENABLED;
  delete process.env.BILLING_ENFORCE_ACCESS;
});

test('ativação exige credenciais e origens HTTPS sem caminhos', () => {
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'fake-test-token';
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'fake-test-secret';
  process.env.BACKEND_URL = 'https://backend.example.invalid/';
  process.env.FRONTEND_URL = 'https://frontend.example.invalid';
  process.env.MERCADO_PAGO_ENV = 'production';
  assert.doesNotThrow(validateBillingConfig);
  assert.equal(process.env.BACKEND_URL, 'https://backend.example.invalid');
  process.env.BACKEND_URL = 'http://localhost:3000';
  assert.throws(validateBillingConfig, /HTTPS/);
  delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  assert.throws(validateBillingConfig, /MERCADO_PAGO_ACCESS_TOKEN/);
});
