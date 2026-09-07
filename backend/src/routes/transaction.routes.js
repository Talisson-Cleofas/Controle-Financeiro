const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { requireWriteAccess } = require('../services/billing-access');
const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  exportCsv
} = require('../controllers/transaction.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listTransactions);
router.get('/summary', getSummary);
router.get('/export', exportCsv);
// Reading and exporting remain available even after a paid account expires.
router.post('/', requireWriteAccess, createTransaction);
router.put('/:id', requireWriteAccess, updateTransaction);
router.delete('/:id', requireWriteAccess, deleteTransaction);

module.exports = router;
