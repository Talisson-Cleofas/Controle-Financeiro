import crypto from 'crypto';

export function parseSignature(value) {
  const result = {};
  for (const entry of String(value || '').split(',')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const key = entry.slice(0, separator).trim();
    const val = entry.slice(separator + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

export function webhookManifest({ dataId, requestId, timestamp }) {
  const parts = [];
  if (dataId !== undefined && dataId !== null && String(dataId) !== '') {
    parts.push(`id:${String(dataId).toLowerCase()};`);
  }
  if (requestId) parts.push(`request-id:${String(requestId)};`);
  if (timestamp) parts.push(`ts:${String(timestamp)};`);
  return parts.join('');
}

export function validWebhookSignature({ secret, signature, requestId, dataId }) {
  if (!secret) return false;
  const { ts, v1 } = parseSignature(signature);
  if (!ts || !v1 || !/^[a-f\d]{64}$/i.test(v1)) return false;

  const manifest = webhookManifest({ dataId, requestId, timestamp: ts });
  const expected = crypto.createHmac('sha256', String(secret).trim()).update(manifest).digest();
  const received = Buffer.from(v1, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
