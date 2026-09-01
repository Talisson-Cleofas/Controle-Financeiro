import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  resourceId: { type: String, required: true },
  topic: { type: String, enum: ['payment', 'order'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'retry', 'processed', 'dead'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  lockToken: String,
  processedAt: Date,
  lastError: String
}, { timestamps: true });
schema.index({ status: 1, availableAt: 1, lockedUntil: 1 });
export default mongoose.model('WebhookJob', schema);

