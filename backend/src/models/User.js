const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
      minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
      maxlength: [80, 'Nome deve ter no máximo 80 caracteres']
    },
    email: {
      type: String,
      required: [true, 'E-mail é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Informe um e-mail válido']
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    monthlyBudget: {
      type: Number,
      default: 0,
      min: 0
    },
    // Additive fields only. Missing enrollment preserves existing accounts.
    billingEnrolledAt: Date,
    financialRevision: { type: Number, default: 0 },
    financialSettings: mongoose.Schema.Types.Mixed,
    cpf: { type: String, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['trial', 'active', 'past_due', 'blocked', 'cancelled'] },
    plan: { type: String, enum: ['trial', 'monthly', 'semiannual', 'yearly', 'lifetime'] },
    trialEndsAt: Date,
    subscriptionEndsAt: Date,
    billingRevision: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    monthlyBudget: this.monthlyBudget || 0,
    role: this.role,
    status: this.status || 'active',
    plan: this.plan || 'legacy',
    trialEndsAt: this.trialEndsAt,
    subscriptionEndsAt: this.subscriptionEndsAt,
    access: require('../services/billing-access').accessState(this),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
