const express = require('express');
const authMiddleware = require('../middlewares/auth');
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
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
