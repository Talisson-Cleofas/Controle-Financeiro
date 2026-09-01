import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebhookHandler } from '../src/billing/services/billing-webhooks.js';

beforeEach(() => {
  process.env.MERCADO_PAGO_ENV = 'production';
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'test-only';
});
function request() {
  const v1 = crypto.createHmac('sha256', 'test-only').update('id:123;request-id:local;ts:1704908010;').digest('hex');
  return { query: {}, body: { type: 'payment', data: { id: '123' } }, headers: { 'x-request-id': 'local', 'x-signature': `ts=1704908010,v1=${v1}` } };
}
function response() {
  return {
    code: undefined, sent: false,
    status(code) { this.code = code; return this; },
    json() { this.sent = true; return this; },
    sendStatus(code) { this.code = code; this.sent = true; return this; }
  };
}

test('não confirma webhook enquanto persistência não terminou', async () => {
  let release;
  const stored = new Promise(resolve => { release = resolve; });
  const res = response();
  const running = createWebhookHandler({ persist: () => stored })(request(), res);
  await Promise.resolve();
  assert.equal(res.sent, false);
  release();
  await running;
  assert.equal(res.code, 202);
});

test('falha de persistência devolve 503, nunca sucesso', async () => {
  const res = response();
  await createWebhookHandler({ persist: async () => { throw new Error('indisponível'); } })(request(), res);
  assert.equal(res.code, 503);
});

test('assinatura inválida não chega à persistência', async () => {
  const req = request();
  req.headers['x-signature'] = 'invalid';
  let called = false;
  const res = response();
  await createWebhookHandler({ persist: async () => { called = true; } })(req, res);
  assert.equal(res.code, 401);
  assert.equal(called, false);
});

test('ID divergente ou com caminho embutido é recusado', async () => {
  for (const id of ['456', '../v1/payments/123']) {
    const req = request();
    req.query['data.id'] = id;
    const res = response();
    await createWebhookHandler({ persist: async () => assert.fail('não deveria persistir') })(req, res);
    assert.equal(res.code, 400);
  }
});

test('Orders sem assinatura só são aceitas no ambiente test', async () => {
  const req = { query: {}, headers: {}, body: { type: 'order', data: { id: 'ORD123' } } };
  let called = false;
  const handler = createWebhookHandler({ persist: async () => { called = true; } });
  const production = response();
  await handler(req, production);
  assert.equal(production.code, 401);
  assert.equal(called, false);
  process.env.MERCADO_PAGO_ENV = 'test';
  const sandbox = response();
  await handler(req, sandbox);
  assert.equal(sandbox.code, 202);
  assert.equal(called, true);
});

test('persistência recebe apenas metadados, nunca aprovação ou valor do corpo', async () => {
  const req = request();
  req.body.status = 'approved';
  req.body.transaction_amount = 999;
  let saved;
  const res = response();
  await createWebhookHandler({ persist: async value => { saved = value; } })(req, res);
  assert.equal(saved.resourceId, '123');
  assert.equal(saved.topic, 'payment');
  assert.equal(saved.status, undefined);
  assert.equal(saved.transaction_amount, undefined);
});

