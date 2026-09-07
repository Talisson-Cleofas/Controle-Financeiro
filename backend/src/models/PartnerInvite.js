const mongoose = require('mongoose');

const partnerInviteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  acceptedAt: Date,
  accessExpiresAt: Date,
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
  commissionPercent: { type: Number, min: 0, max: 100, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

partnerInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
partnerInviteSchema.index(
  { code: 1 },
  { unique: true, name: 'pending_partner_invite_code', partialFilterExpression: { acceptedAt: null } }
);

module.exports = mongoose.model('PartnerInvite', partnerInviteSchema);
