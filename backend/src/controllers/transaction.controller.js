const Transaction = require('../models/Transaction');

function parseMonthRange(month) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = safeMonth.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
  return { safeMonth, start, end };
}

function buildFilters(req) {
  const { month, type, category, status, search } = req.query;
  const { safeMonth, start, end } = parseMonthRange(month);

  const filter = {
    user: req.user._id,
    date: { $gte: start, $lt: end }
  };

  if (type && ['income', 'expense'].includes(type)) filter.type = type;
  if (status && ['paid', 'pending'].includes(status)) filter.status = status;
  if (category) filter.category = category;
  if (search) filter.description = { $regex: String(search).trim(), $options: 'i' };

  return { filter, safeMonth };
}

function normalizeBody(body) {
  return {
    type: body.type,
    description: body.description,
    amount: Number(body.amount),
    category: body.category,
    status: body.status || 'paid',
    date: body.date,
    notes: body.notes || ''
  };
}

async function listTransactions(req, res, next) {
  try {
    const { filter, safeMonth } = buildFilters(req);
    const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });
    return res.json({ month: safeMonth, transactions });
  } catch (error) {
    next(error);
  }
}

async function createTransaction(req, res, next) {
  try {
    const data = normalizeBody(req.body);
    const transaction = await Transaction.create({ ...data, user: req.user._id });
    return res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
}

async function updateTransaction(req, res, next) {
  try {
    const data = normalizeBody(req.body);
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      data,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Lançamento não encontrado.' });
    }

    return res.json({ transaction });
  } catch (error) {
    next(error);
  }
}

async function deleteTransaction(req, res, next) {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!transaction) {
      return res.status(404).json({ message: 'Lançamento não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function getSummary(req, res, next) {
  try {
    const { filter, safeMonth } = buildFilters(req);
    delete filter.description;

    const transactions = await Transaction.find(filter);

    const totals = transactions.reduce(
      (acc, item) => {
        const value = Number(item.amount || 0);
        if (item.type === 'income') acc.income += value;
        if (item.type === 'expense') acc.expense += value;
        if (item.status === 'pending') acc.pending += value;
        acc.count += 1;
        acc.byCategory[item.category] = (acc.byCategory[item.category] || 0) + value;
        return acc;
      },
      { income: 0, expense: 0, pending: 0, count: 0, byCategory: {} }
    );

    totals.balance = totals.income - totals.expense;
    totals.monthlyBudget = req.user.monthlyBudget || 0;
    totals.budgetUsedPercent = totals.monthlyBudget > 0 ? (totals.expense / totals.monthlyBudget) * 100 : 0;

    const topExpenses = transactions
      .filter((item) => item.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return res.json({ month: safeMonth, totals, topExpenses });
  } catch (error) {
    next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const { filter, safeMonth } = buildFilters(req);
    const transactions = await Transaction.find(filter).sort({ date: 1, createdAt: 1 });

    const rows = [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Status', 'Valor', 'Observações'],
      ...transactions.map((item) => [
        item.date.toISOString().slice(0, 10),
        item.type === 'income' ? 'Receita' : 'Despesa',
        item.description,
        item.category,
        item.status === 'paid' ? 'Pago' : 'Pendente',
        String(item.amount).replace('.', ','),
        item.notes || ''
      ])
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${safeMonth}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  exportCsv
};
