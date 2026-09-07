const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { accessState } = require('./billing-access');
const failure = (status, message) => Object.assign(new Error(message), { status });

// All financial writers touch the same account inside the transaction. This
// serializes legacy endpoints and full-document sync without changing billing.
async function financialWrite(userId, work, revision) {
  return mongoose.connection.transaction(async session => {
    const user = await User.findById(userId).session(session);
    if (!user) throw failure(401, 'Conta não encontrada.');
    if (!accessState(user).allowed) throw failure(403, 'Seu acesso expirou. Renove seu plano.');
    const current = user.financialRevision || 0;
    if (revision !== undefined && revision !== current) throw failure(409, 'Dados alterados em outro dispositivo. Recarregue antes de sincronizar.');
    user.financialRevision = current + 1;
    await user.save({ session });
    const result = await work(session, user);
    await user.save({ session });
    return { result, revision: user.financialRevision };
  });
}

const publicTransaction = t => ({
  ...(t.uiData || {}), id: t.clientId || String(t._id), type: t.type,
  description: t.description, amount: t.amount, category: t.category,
  status: t.status, date: t.date.toISOString().slice(0, 10), notes: t.notes || '',
  createdAt: t.createdAt, updatedAt: t.updatedAt
});

async function readData(userId) {
  return mongoose.connection.transaction(async session => {
    const user = await User.findById(userId).session(session);
    const rows = await Transaction.find({ user: userId, deletedAt: null }).session(session).sort({ _id: 1 });
    return { transactions: rows.map(publicTransaction), settings: { ...(user.financialSettings || {}), budget: user.monthlyBudget || null }, revision: user.financialRevision || 0 };
  });
}

function validateData(body) {
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0 || !Array.isArray(body.transactions) || body.transactions.length > 10000 || !body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) throw failure(400, 'Dados de sincronização inválidos.');
  const ids = new Set();
  for (const row of body.transactions) {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id) || ids.has(row.id)) throw failure(400, 'Identificador inválido ou repetido.');
    ids.add(row.id);
    if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0,10) !== row.date) throw failure(400, 'Valor ou data inválidos.');
  }
  const budget = body.settings.budget == null ? 0 : body.settings.budget;
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) throw failure(400, 'Orçamento inválido.');
}

async function writeData(userId, body) {
  validateData(body);
  return financialWrite(userId, async (session, user) => {
    const existing = await Transaction.find({ user: userId }).session(session);
    const byId = new Map(existing.map(row => [row.clientId || String(row._id), row]));
    const kept = new Set();
    for (const input of body.transactions) {
      const row = byId.get(input.id) || new Transaction({ user: userId, clientId: input.id });
      row.set({ type: input.type, description: input.description, amount: input.amount,
        category: input.category, status: input.status || 'paid', date: input.date,
        notes: input.notes || '', deletedAt: null });
      // UI-only metadata cannot set database identity, ownership or privileges.
      row.uiData = Object.fromEntries(['walletId','planned','confirmedAt','duplicatedFrom','recurringId','recurringKey'].filter(key => input[key] !== undefined).map(key => [key,input[key]]));
      await row.save({ session });
      kept.add(String(row._id));
    }
    const removed = existing.filter(row => !row.deletedAt && !kept.has(String(row._id))).map(row => row._id);
    if (removed.length) await Transaction.updateMany({ user: userId, _id: { $in: removed } }, { $set: { deletedAt: new Date() } }, { session });
    user.financialSettings = body.settings;
    user.monthlyBudget = body.settings.budget || 0;
  }, body.revision);
}
module.exports = { financialWrite, readData, writeData };
