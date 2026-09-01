import crypto from 'node:crypto';
import WebhookJob from '../models/WebhookJob.js';
import { validWebhookSignature } from './mercadopago.js';
import { mp, mercadoPagoTestMode } from './mercadopago-client.js';
import { processPayment, processOrder } from './payment-processing.js';

const MAX_ATTEMPTS = 8;
const LEASE_MS = 120000;

export async function persistWebhook({ resourceId, topic, eventId, action, eventDate, signature }) {
  const key = crypto.createHash('sha256').update(JSON.stringify([topic, resourceId, eventId, action, eventDate, signature])).digest('hex');
  try {
    return await WebhookJob.findOneAndUpdate({ key }, {
      $setOnInsert: { resourceId, topic, status: 'pending', availableAt: new Date() }
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return WebhookJob.findOne({ key });
  }
}

export function createWebhookHandler({ persist = persistWebhook } = {}) {
  return async (req, res) => {
    const queryId = req.query?.['data.id'];
    const bodyId = req.body?.data?.id;
    const id = queryId ?? bodyId;
    if (typeof id !== 'string' && typeof id !== 'number') return res.status(400).json({ error: 'Identificador ausente.' });
    const resourceId = String(id);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(resourceId) || (queryId != null && bodyId != null && String(queryId) !== String(bodyId))) {
      return res.status(400).json({ error: 'Identificador inválido ou divergente.' });
    }
    const topic = String(req.body?.type || req.query?.type || 'payment').toLowerCase();
    const signature = req.headers['x-signature'];
    const valid = validWebhookSignature({ secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET, signature, requestId: req.headers['x-request-id'], dataId: resourceId });
    // Preserve the existing sandbox-only Orders adapter. It never trusts body amounts
    // or approval state; the worker must fetch the resource using our access token.
    const sandboxOrder = mercadoPagoTestMode() && topic === 'order' && resourceId.startsWith('ORD');
    if (!valid && !sandboxOrder) return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
    if (!['payment', 'order'].includes(topic)) return res.sendStatus(200);
    if (topic === 'order' && !mercadoPagoTestMode()) return res.status(400).json({ error: 'Orders não habilitadas em produção.' });
    try {
      await persist({ resourceId, topic, eventId: req.body?.id, action: req.body?.action, eventDate: req.body?.date_created, signature });
      return res.sendStatus(202);
    } catch {
      // No durable acceptance means no 2xx: Mercado Pago can deliver again.
      return res.status(503).json({ error: 'Não foi possível registrar a notificação. Tente novamente.' });
    }
  };
}

export async function runNextWebhookJob({ fetchRemote = mp, handlePayment = processPayment, handleOrder = processOrder, now = new Date() } = {}) {
  const token = crypto.randomUUID();
  const job = await WebhookJob.findOneAndUpdate({
    $or: [
      { status: { $in: ['pending', 'retry'] }, availableAt: { $lte: now } },
      { status: 'processing', lockedUntil: { $lte: now } }
    ]
  }, {
    $set: { status: 'processing', lockToken: token, lockedUntil: new Date(now.getTime() + LEASE_MS) },
    $inc: { attempts: 1 }
  }, { new: true, sort: { availableAt: 1, _id: 1 } });
  if (!job) return false;
  const ownership = { _id: job._id, lockToken: token, status: 'processing' };
  try {
    if (job.attempts > MAX_ATTEMPTS) throw new Error('Limite de tentativas excedido.');
    const path = job.topic === 'order' ? '/v1/orders/' : '/v1/payments/';
    const remote = await fetchRemote(`${path}${encodeURIComponent(job.resourceId)}`);
    if (String(remote.id) !== job.resourceId) throw new Error('API retornou recurso divergente.');
    await (job.topic === 'order' ? handleOrder(remote) : handlePayment(remote));
    await WebhookJob.updateOne(ownership, {
      $set: { status: 'processed', processedAt: new Date(), lastError: '' },
      $unset: { lockedUntil: 1, lockToken: 1 }
    });
  } catch {
    const dead = job.attempts >= MAX_ATTEMPTS;
    await WebhookJob.updateOne(ownership, {
      $set: {
        status: dead ? 'dead' : 'retry',
        availableAt: new Date(now.getTime() + Math.min(3600000, 1000 * 2 ** job.attempts)),
        lastError: 'Falha ao consultar ou aplicar pagamento; verificar integração e registro financeiro.'
      },
      $unset: { lockedUntil: 1, lockToken: 1 }
    });
    if (dead) console.error(`Webhook ${job.id} esgotou as tentativas e requer revisão.`);
  }
  return true;
}

export function startBillingWorker() {
  let running;
  let stopped = false;
  const tick = () => {
    if (running || stopped) return;
    running = (async () => {
      try {
        for (let n = 0; n < 20 && !stopped; n++) if (!await runNextWebhookJob()) break;
      } catch {
        console.error('Processador de pagamentos indisponível; retomará na próxima execução.');
      }
    })().finally(() => { running = null; });
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
