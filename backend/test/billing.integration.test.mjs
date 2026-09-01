import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Payment from '../src/billing/models/Payment.js';
import User from '../src/billing/models/User.js';
import WebhookJob from '../src/billing/models/WebhookJob.js';
import { processPayment, processOrder } from '../src/billing/services/payment-processing.js';
import { createWebhookHandler, persistWebhook, runNextWebhookJob } from '../src/billing/services/billing-webhooks.js';
import { createApp } from '../src/app.js';
import jwt from 'jsonwebtoken';
import Transaction from '../src/models/Transaction.js';
import financialData from '../src/services/financial-data.js';

const DAY = 86400000;
const start = new Date('2026-09-01T12:00:00Z');
const day = n => new Date(start.getTime() + n * DAY);
let replica;
before(async () => {
  delete process.env.SMTP_HOST;
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Always an ephemeral local replica set, never MONGODB_URI from the environment.
  await mongoose.connect(replica.getUri(), { dbName: 'billing_tests' });
  await Promise.all([User.init(), Payment.init(), WebhookJob.init()]);
});
after(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  delete process.env.BILLING_ENABLED;
  delete process.env.BILLING_ENFORCE_ACCESS;
  process.env.JWT_SECRET = 'ephemeral-integration-secret';
  process.env.MERCADO_PAGO_ENV = 'production';
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'local-test-only';
  delete process.env.PLAN_MONTHLY_PRICE;
  await Promise.all([Payment.deleteMany({}), User.deleteMany({}), WebhookJob.deleteMany({})]);
});

async function withApp(run) {
  const app = await createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await run(url); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

const headersFor = user => ({
  Authorization: `Bearer ${jwt.sign({ sub: user.id }, process.env.JWT_SECRET)}`,
  'Content-Type': 'application/json'
});

test('produção compatível mantém login, orçamento, token e lançamentos antigos sem cobrança', async () => {
  const passwordHash = await User.hashPassword('senha-teste-123');
  const raw = await User.collection.insertOne({ name: 'Legado', email: 'legado@example.invalid', passwordHash, monthlyBudget: 750 });
  const user = await User.findById(raw.insertedId);
  assert.equal(user.passwordHash, undefined);
  await withApp(async url => {
    const login = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'senha-teste-123' }) });
    assert.equal(login.status, 200);
    const session = await login.json();
    assert.equal(session.user.monthlyBudget, 750);
    assert.equal(session.user.access.allowed, true);
    assert.equal(session.user.passwordHash, undefined);
    const headers = { ...headersFor(user), Authorization: `Bearer ${session.token}` };
    const created = await fetch(`${url}/api/transactions`, { method: 'POST', headers, body: JSON.stringify({ type: 'income', description: 'Receita teste', amount: 200, category: 'Outros', date: '2026-09-01', status: 'pending' }) });
    assert.equal(created.status, 201);
    const summary = await fetch(`${url}/api/transactions/summary?month=2026-09`, { headers });
    assert.equal(summary.status, 200);
    assert.equal((await summary.json()).totals.balance, 0);
    assert.equal((await fetch(`${url}/api/billing/plans`, { headers })).status, 503);
  });
  assert.equal((await User.findById(user.id).select('+passwordHash')).passwordHash, passwordHash);
  assert.equal(await Transaction.countDocuments({ user: user._id }), 1);
});

test('ativação não bloqueia legado; conta comercial expirada conserva leitura e exportação', async () => {
  process.env.BILLING_ENABLED = 'true';
  process.env.BILLING_ENFORCE_ACCESS = 'true';
  const legacy = await account({ billingEnrolledAt: undefined, status: undefined });
  const expired = await account({ status: 'past_due' });
  await withApp(async url => {
    const body = JSON.stringify({ type: 'expense', description: 'Teste', amount: 10, category: 'Outros', date: '2026-09-01', status: 'pending' });
    assert.equal((await fetch(`${url}/api/transactions`, { method: 'POST', headers: headersFor(legacy), body })).status, 201);
    assert.equal((await fetch(`${url}/api/transactions`, { method: 'POST', headers: headersFor(expired), body })).status, 403);
    for (const path of ['/api/transactions', '/api/transactions/export', '/api/auth/me', '/api/billing/plans']) {
      assert.equal((await fetch(url + path, { headers: headersFor(expired) })).status, 200);
    }
  });
});

test('cadastro comercial ignora privilégios enviados pelo cliente e concede só teste', async () => {
  process.env.BILLING_ENABLED = 'true';
  await withApp(async url => {
    const response = await fetch(`${url}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Novo teste', email: 'novo@example.invalid', password: 'senha123', role: 'admin', plan: 'lifetime', status: 'active' }) });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    assert.equal(user.role, 'user');
    assert.equal(user.plan, 'trial');
    assert.equal(user.status, 'trial');
    assert.ok((await User.findById(user.id)).billingEnrolledAt);
  });
});

test('Express 4 trata falha assíncrona do checkout sem travar e impede consulta de pagamento alheio', async () => {
  process.env.BILLING_ENABLED = 'true';
  delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const user = await account();
  const other = await account();
  const payment = await Payment.create({ userId: other.id, plan: 'monthly', amount: 19.9 });
  await withApp(async url => {
    const headers = headersFor(user);
    assert.equal((await fetch(`${url}/api/billing/payments/${payment.id}/status`, { headers })).status, 404);
    assert.equal((await fetch(`${url}/api/billing/checkout`, { method: 'POST', headers, body: JSON.stringify({ plan: 'monthly' }) })).status, 503);
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
  });
});

const account = (extra = {}) => User.create({ name: 'Teste', email: `${crypto.randomUUID()}@example.invalid`, passwordHash: 'test-only', status: 'trial', billingEnrolledAt: start, ...extra });
const remote = (user, extra = {}) => ({ id: '1001', external_reference: `${user.id}:monthly:test`, status: 'approved', transaction_amount: 19.9, currency_id: 'BRL', ...extra });
const latest = user => User.findById(user._id);

const syncRow = (id='local-1', extra={}) => ({id,type:'income',description:'Receita',amount:200,category:'Outros',date:'2026-09-01',status:'pending',walletId:'bb',...extra});
test('sincronização usa os lançamentos existentes sem criar outro banco de dados', async () => {
  const user=await account({monthlyBudget:800});
  const row=await Transaction.create({user:user.id,...syncRow()});
  const initial=await financialData.readData(user.id);
  assert.equal(initial.transactions[0].id,row.id);
  assert.equal(initial.settings.budget,800);
  const input={...initial,transactions:[{...initial.transactions[0],status:'paid',walletId:'bb',planned:true}],settings:{budget:900,wallets:[{id:'bb',name:'Banco'}],recurring:[]}};
  const result=await financialData.writeData(user.id,input);
  assert.equal(result.revision,1);
  const saved=await financialData.readData(user.id);
  assert.equal(saved.transactions[0].walletId,'bb');
  assert.equal(saved.transactions[0].planned,true);
  assert.equal(await Transaction.countDocuments({user:user.id}),1);
  assert.equal((await latest(user)).monthlyBudget,900);
  await withApp(async url=>{const response=await fetch(url+'/api/transactions/summary?month=2026-09',{headers:headersFor(user)});assert.equal((await response.json()).totals.balance,200);});
});

test('duas sincronizações concorrentes: uma vence e outra recebe conflito sem perder dados', async () => {
  const user=await account();
  const outcomes=await Promise.allSettled(['a','b'].map(id=>financialData.writeData(user.id,{revision:0,transactions:[syncRow(id)],settings:{}})));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);
  assert.equal((await financialData.readData(user.id)).transactions.length,1);
});

test('erro de validação reverte lote e revisão; IDs repetidos são recusados', async () => {
  const user=await account();
  await assert.rejects(financialData.writeData(user.id,{revision:0,transactions:[syncRow('a'),syncRow('b',{type:'invalid'})],settings:{}}));
  assert.equal(await Transaction.countDocuments({user:user.id}),0);
  assert.equal((await financialData.readData(user.id)).revision,0);
  await assert.rejects(financialData.writeData(user.id,{revision:0,transactions:[syncRow(),syncRow()],settings:{}}),/repetido/);
});

test('exclusão por sincronização é recuperável e não muda registros de outra conta', async () => {
  const user=await account(),other=await account();
  await financialData.writeData(other.id,{revision:0,transactions:[syncRow()],settings:{}});
  await financialData.writeData(user.id,{revision:0,transactions:[syncRow()],settings:{}});
  await financialData.writeData(user.id,{revision:1,transactions:[],settings:{}});
  assert.equal((await financialData.readData(user.id)).transactions.length,0);
  assert.ok((await Transaction.findOne({user:user.id})).deletedAt);
  assert.equal((await financialData.readData(other.id)).transactions.length,1);
  await financialData.writeData(user.id,{revision:2,transactions:[syncRow()],settings:{}});
  assert.equal(await Transaction.countDocuments({user:user.id}),1);
  assert.equal((await financialData.readData(user.id)).transactions.length,1);
});

test('rotas antigas invalidam revisão de sync e conta vencida não contorna bloqueio via /data', async () => {
  const user=await account();
  await withApp(async url=>{
    const headers=headersFor(user);
    const initial=await fetch(url+'/api/data',{headers});assert.equal(initial.status,200);
    const body=await initial.json();
    const created=await fetch(url+'/api/transactions',{method:'POST',headers,body:JSON.stringify(syncRow())});assert.equal(created.status,201);
    assert.equal((await fetch(url+'/api/data',{method:'PUT',headers,body:JSON.stringify(body)})).status,409);
    process.env.BILLING_ENABLED='true';process.env.BILLING_ENFORCE_ACCESS='true';
    await User.updateOne({_id:user.id},{$set:{status:'past_due'}});
    assert.equal((await fetch(url+'/api/data',{headers})).status,200);
    assert.equal((await fetch(url+'/api/data',{method:'PUT',headers,body:JSON.stringify({...body,revision:1})})).status,403);
    assert.equal((await fetch(url+'/api/data')).status,401);
  });
});

test('PIX e cartão usam payload produtivo e intent persistido; preferências pendentes não colidem', async () => {
  process.env.BILLING_ENABLED = 'true';
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-token-not-real';
  process.env.BACKEND_URL = 'https://backend.example.invalid';
  process.env.FRONTEND_URL = 'https://frontend.example.invalid';
  const user = await account();
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.mercadopago.com/')) return realFetch(url, options);
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    assert.ok(await Payment.findOne({ externalReference: body.external_reference }));
    assert.ok(options.headers['X-Idempotency-Key']);
    assert.equal(body.notification_url, 'https://backend.example.invalid/api/billing/webhook');
    if (String(url).endsWith('/v1/payments')) {
      assert.equal(body.payment_method_id, 'pix');
      assert.equal(body.transaction_amount, 19.9);
      return new Response(JSON.stringify({ id: '987654', external_reference: body.external_reference, status: 'pending', transaction_amount: 19.9, currency_id: 'BRL', point_of_interaction: { transaction_data: { qr_code: 'fake-pix-for-test' } } }), { status: 201 });
    }
    assert.ok(String(url).endsWith('/checkout/preferences'));
    assert.equal(body.items[0].currency_id, 'BRL');
    return new Response(JSON.stringify({ id: `pref-${calls.length}`, init_point: 'https://checkout.example.invalid/production', sandbox_init_point: 'https://checkout.example.invalid/test' }), { status: 201 });
  };
  try {
    await withApp(async url => {
      const headers = headersFor(user);
      const response = await fetch(`${url}/api/billing/pix`, { method: 'POST', headers, body: JSON.stringify({ plan: 'monthly', cpf: '12345678909', amount: 0.01 }) });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).qrCode, 'fake-pix-for-test');
      for (let i=0;i<2;i++) {
        const checkout = await fetch(`${url}/api/billing/checkout`, { method: 'POST', headers, body: JSON.stringify({ plan: 'monthly' }) });
        assert.equal(checkout.status, 200);
        assert.equal((await checkout.json()).checkoutUrl, 'https://checkout.example.invalid/production');
      }
    });
    assert.equal(calls.length, 3);
    assert.equal(await Payment.countDocuments({ userId: user._id }), 3);
    assert.equal((await latest(user)).subscriptionEndsAt, undefined);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  }
});

test('dez confirmações simultâneas concedem apenas um período', async () => {
  const user = await account();
  await Promise.all(Array.from({ length: 10 }, () => processPayment(remote(user), { now: start })));
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
  assert.equal(await Payment.countDocuments(), 1);
});

test('duas compras simultâneas preservam os dois períodos', async () => {
  const user = await account();
  await Promise.all(['1001', '1002'].map(id => processPayment(remote(user, { id, external_reference: `${user.id}:monthly:${id}` }), { now: start })));
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(60).getTime());
});

test('falha entre a gravação da conta e do pagamento reverte ambos', async () => {
  const user = await account();
  const original = Payment.prototype.save;
  Payment.prototype.save = async function () { throw new Error('falha simulada'); };
  try { await assert.rejects(processPayment(remote(user), { now: start }), /falha simulada/); }
  finally { Payment.prototype.save = original; }
  assert.equal((await latest(user)).status, 'trial');
  assert.equal((await latest(user)).subscriptionEndsAt, undefined);
  assert.equal(await Payment.countDocuments(), 0);
  await processPayment(remote(user), { now: start });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
});

test('estorno integral remove apenas tempo não consumido e não reativa por evento antigo', async () => {
  const user = await account();
  await processPayment(remote(user), { now: start });
  const refund = remote(user, { status: 'refunded', transaction_amount_refunded: 19.9 });
  await processPayment(refund, { now: day(10) });
  await processPayment(refund, { now: day(10) });
  await processPayment(remote(user), { now: day(11) });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(10).getTime());
  assert.equal((await latest(user)).status, 'past_due');
  assert.equal((await Payment.findOne()).status, 'refunded');
});

test('estornos sucessivos preservam e depois removem somente suas próprias renovações', async () => {
  const user = await account();
  await processPayment(remote(user), { now: start });
  await processPayment(remote(user, { id: '1002', external_reference: `${user.id}:monthly:second` }), { now: day(1) });
  await processPayment(remote(user, { status: 'refunded' }), { now: day(10) });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(40).getTime());
  const second = await Payment.findOne({ externalId: '1002' });
  assert.equal(second.licenseStartsAt.getTime(), day(10).getTime());
  assert.equal(second.licenseEndsAt.getTime(), day(40).getTime());
  await processPayment(remote(user, { id: '1002', external_reference: `${user.id}:monthly:second`, status: 'charged_back' }), { now: day(15) });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(15).getTime());
});

test('estorno de período já consumido não desconta nova compra', async () => {
  const user = await account();
  await processPayment(remote(user), { now: start });
  await processPayment(remote(user, { id: '1002', external_reference: `${user.id}:monthly:second` }), { now: day(40) });
  await processPayment(remote(user, { status: 'refunded' }), { now: day(41) });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(70).getTime());
});

test('estorno parcial e licença alterada manualmente exigem revisão sem desconto arbitrário', async () => {
  const user = await account();
  await processPayment(remote(user), { now: start });
  await processPayment(remote(user, { transaction_amount_refunded: 5 }), { now: day(1) });
  assert.equal((await Payment.findOne()).needsReview, true);
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
  await User.updateOne({ _id: user._id }, { subscriptionEndsAt: day(100) });
  await processPayment(remote(user, { status: 'refunded' }), { now: day(2) });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(100).getTime());
  assert.match((await Payment.findOne()).reviewReason, /fora do fluxo/);
});

test('pagamento legado estornado é atualizado e sinalizado sem reconstruir dias por suposição', async () => {
  const user = await account({ status: 'active', plan: 'monthly', subscriptionEndsAt: day(30) });
  await Payment.create({ userId: user._id, externalId: '1001', plan: 'monthly', amount: 19.9, status: 'approved', processedAt: start });
  await processPayment(remote(user, { status: 'refunded' }), { now: day(2) });
  const payment = await Payment.findOne();
  assert.equal(payment.status, 'refunded');
  assert.equal(payment.needsReview, true);
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
});

test('valor e moeda inválidos não concedem acesso', async () => {
  const user = await account();
  for (const extra of [{ transaction_amount: 0 }, { transaction_amount: 1 }, { currency_id: 'USD' }, { currency_id: undefined }]) {
    await assert.rejects(processPayment(remote(user, extra), { now: start }));
  }
  assert.equal((await latest(user)).status, 'trial');
  assert.equal(await Payment.countDocuments(), 0);
});

test('preço contratado permanece válido após mudança de tabela e checkout usa o mesmo registro', async () => {
  const user = await account();
  const intent = await Payment.create({ userId: user._id, plan: 'monthly', amount: 19.9, expectedAmount: 19.9, externalReference: `${user.id}:monthly:test`, preferenceId: 'pref-test' });
  process.env.PLAN_MONTHLY_PRICE = '25.00';
  const payment = await processPayment(remote(user), { now: start });
  assert.equal(String(payment._id), String(intent._id));
  assert.equal(await Payment.countDocuments(), 1);
});

test('pagamento não desbloqueia conta administrativa bloqueada nem remove acesso vitalício', async () => {
  const blocked = await account({ status: 'blocked' });
  await processPayment(remote(blocked), { now: start });
  assert.equal((await latest(blocked)).status, 'blocked');
  const lifetime = await account({ plan: 'lifetime', status: 'active' });
  await processPayment(remote(lifetime, { id: '1002' }), { now: start });
  assert.equal((await latest(lifetime)).plan, 'lifetime');
});

test('Orders continuam restritas ao sandbox e não aceitam pagamento incompleto', async () => {
  const user = await account();
  const order = { id: 'ORD1', external_reference: `${user.id}_monthly_test`, status: 'processed', total_amount: '50.00', total_paid_amount: '50.00', transactions: { payments: [{ id: 'PAY1', status: 'processed' }] } };
  assert.throws(() => processOrder(order, { now: start }), /produção/);
  process.env.MERCADO_PAGO_ENV = 'test';
  assert.throws(() => processOrder({ ...order, total_paid_amount: '10.00' }), /integralmente/);
  await processOrder(order, { now: start });
  await processOrder(order, { now: start });
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
});

test('worker persiste falha e nova tentativa aplica licença uma vez', async () => {
  const user = await account();
  const job = await persistWebhook({ resourceId: '1001', topic: 'payment', eventId: 'evt1' });
  const now = new Date();
  await runNextWebhookJob({ now, fetchRemote: async () => { throw new Error('timeout simulado'); } });
  assert.equal((await WebhookJob.findById(job._id)).status, 'retry');
  await runNextWebhookJob({ now: new Date(now.getTime() + 10000), fetchRemote: async () => remote(user) });
  assert.equal((await WebhookJob.findById(job._id)).status, 'processed');
  assert.equal(await Payment.countDocuments({ processedAt: { $exists: true } }), 1);
});

test('reinício após conceder licença recupera lease vencido sem duplicar período', async () => {
  const user = await account();
  await processPayment(remote(user), { now: start });
  await WebhookJob.create({ key: 'crashed', resourceId: '1001', topic: 'payment', status: 'processing', lockToken: 'old', lockedUntil: new Date(0), attempts: 1 });
  await runNextWebhookJob({ fetchRemote: async () => remote(user) });
  assert.equal((await WebhookJob.findOne()).status, 'processed');
  assert.equal((await latest(user)).subscriptionEndsAt.getTime(), day(30).getTime());
});

test('dois workers não processam o mesmo lease e eventos exauridos ficam visíveis', async () => {
  await persistWebhook({ resourceId: '1001', topic: 'payment', eventId: 'evt1' });
  let calls = 0;
  const options = { fetchRemote: async () => { calls++; return { id: '1001' }; }, handlePayment: async () => {} };
  await Promise.all([runNextWebhookJob(options), runNextWebhookJob(options)]);
  assert.equal(calls, 1);
  await WebhookJob.create({ key: 'last-attempt', resourceId: '1002', topic: 'payment', status: 'retry', availableAt: new Date(0), attempts: 7 });
  await runNextWebhookJob({ fetchRemote: async () => { throw new Error('falha'); } });
  assert.equal((await WebhookJob.findOne({ key: 'last-attempt' })).status, 'dead');
});

async function http(handler, run) {
  const app = express();
  app.use(express.json());
  app.post('/webhook', handler);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try { await run(`http://127.0.0.1:${server.address().port}/webhook`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
function request(extra = {}) {
  const ts = '1704908010';
  const v1 = crypto.createHmac('sha256', 'local-test-only').update(`id:1001;request-id:local;ts:${ts};`).digest('hex');
  return { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'local' }, body: JSON.stringify({ id: 'evt1', type: 'payment', data: { id: '1001' } }), ...extra };
}

test('HTTP confirma apenas após persistir e deduplica a mesma notificação', async () => {
  await http(createWebhookHandler(), async url => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(url, request());
      assert.equal(response.status, 202);
      await response.text();
      assert.equal(await WebhookJob.countDocuments(), 1);
    }
  });
});

test('HTTP devolve 503 se o armazenamento falhar e rejeita assinatura inválida', async () => {
  await http(createWebhookHandler({ persist: async () => { throw new Error('banco indisponível'); } }), async url => {
    assert.equal((await fetch(url, request())).status, 503);
    assert.equal((await fetch(url, request({ headers: { 'content-type': 'application/json' } }))).status, 401);
    assert.equal((await fetch(`${url}?data.id=1002`, request())).status, 400);
  });
});

test('produção não aceita o bypass de assinatura das Orders de teste', async () => {
  await http(createWebhookHandler(), async url => {
    const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'order', data: { id: 'ORD123' } }) };
    assert.equal((await fetch(url, options)).status, 401);
    process.env.MERCADO_PAGO_ENV = 'test';
    assert.equal((await fetch(url, options)).status, 202);
    assert.equal((await WebhookJob.findOne()).resourceId, 'ORD123');
  });
});
