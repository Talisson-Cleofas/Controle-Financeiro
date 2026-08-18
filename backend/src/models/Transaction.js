const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Tipo é obrigatório']
    },
    description: {
      type: String,
      required: [true, 'Descrição é obrigatória'],
      trim: true,
      minlength: [2, 'Descrição deve ter pelo menos 2 caracteres'],
      maxlength: [140, 'Descrição deve ter no máximo 140 caracteres']
    },
    amount: {
      type: Number,
      required: [true, 'Valor é obrigatório'],
      min: [0.01, 'Valor deve ser maior que zero']
    },
    category: {
      type: String,
      required: [true, 'Categoria é obrigatória'],
      trim: true,
      maxlength: [60, 'Categoria deve ter no máximo 60 caracteres']
    },
    status: {
      type: String,
      enum: ['paid', 'pending'],
      default: 'pending'
    },
    date: {
      type: Date,
      required: [true, 'Data é obrigatória']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Observações devem ter no máximo 500 caracteres'],
      default: ''
    }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, status: 1, category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
