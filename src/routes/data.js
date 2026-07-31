import { Router } from 'express';
import UserData from '../models/UserData.js';
import { auth, paidAccess } from '../middleware/auth.js';

const router = Router();
const MAX_TRANSACTIONS = 10_000;
const MAX_SETTINGS_BYTES = 1_000_000;

router.use(auth, paidAccess);

router.get('/', async (req, res, next) => {
  try {
    const data = await UserData.findOne({ userId: req.user._id });
    return res.json({
      transactions: data?.transactions || [],
      settings: data?.settings || {},
      revision: data?.revision || 1,
      updatedAt: data?.updatedAt,
      access: req.access
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const transactions = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
    const settings = req.body?.settings && typeof req.body.settings === 'object' && !Array.isArray(req.body.settings)
      ? req.body.settings
      : null;
    const revision = Number(req.body?.revision);

    if (!transactions || !settings) return res.status(400).json({ error: 'Dados de sincronização inválidos.' });
    if (transactions.length > MAX_TRANSACTIONS) return res.status(413).json({ error: `Limite de ${MAX_TRANSACTIONS} lançamentos por conta excedido.` });
    if (Buffer.byteLength(JSON.stringify(settings), 'utf8') > MAX_SETTINGS_BYTES) return res.status(413).json({ error: 'Configurações excedem o limite permitido.' });
    if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ error: 'Revisão de sincronização inválida.' });

    const data = await UserData.findOneAndUpdate(
      { userId: req.user._id, revision },
      { $set: { transactions, settings }, $inc: { revision: 1 } },
      { new: true, runValidators: true }
    );

    if (!data) {
      const current = await UserData.findOne({ userId: req.user._id }).select('revision updatedAt');
      return res.status(409).json({
        error: 'Seus dados foram alterados em outro dispositivo. Recarregue antes de sincronizar novamente.',
        code: 'SYNC_CONFLICT',
        revision: current?.revision,
        updatedAt: current?.updatedAt
      });
    }

    return res.json({ ok: true, revision: data.revision, updatedAt: data.updatedAt });
  } catch (error) {
    return next(error);
  }
});

export default router;
