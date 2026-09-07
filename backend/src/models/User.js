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
    plan: { type: String, enum: ['trial', 'monthly', 'semiannual', 'yearly', 'lifetime', 'partner'] },
    trialEndsAt: Date,
    subscriptionEndsAt: Date,
    partnerCode: { type: String, uppercase: true, trim: true },
    partnerActive: { type: Boolean, default: false },
    partnerExpiresAt: Date,
    partnerDiscountPercent: { type: Number, min: 0, max: 100, default: 0 },
    partnerCommissionPercent: { type: Number, min: 0, max: 100, default: 0 },
    partnerGrantedAt: Date,
    partnerGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referredByPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    referredByPartnerCode: { type: String, uppercase: true, trim: true, index: true },
    billingRevision: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.index(
  { partnerCode: 1 },
  { unique: true, name: 'partner_code_unique_when_present', partialFilterExpression: { partnerCode: { $type: 'string' } } }
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
    partner: this.plan === 'partner' ? {
      code: this.partnerCode,
      active: Boolean(this.partnerActive),
      expiresAt: this.partnerExpiresAt,
      discountPercent: this.partnerDiscountPercent || 0,
      commissionPercent: this.partnerCommissionPercent || 0
    } : undefined,
    access: require('../services/billing-access').accessState(this),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
