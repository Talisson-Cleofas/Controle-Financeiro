import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  parseSignature,
  webhookManifest,
  validWebhookSignature
} from '../src/services/mercadopago.js';

test('interpreta a assinatura enviada pelo Mercado Pago', () => {
  assert.deepEqual(parseSignature('ts=1704908010,v1=abc123'), {
    ts: '1704908010',
    v1: 'abc123'
  });
});

test('monta o manifesto completo e normaliza o data.id', () => {
  assert.equal(
    webhookManifest({ dataId: 'ABC123', requestId: 'req-1', timestamp: '1704908010' }),
    'id:abc123;request-id:req-1;ts:1704908010;'
  );
});

test('remove request-id ausente do manifesto conforme a documentação', () => {
  assert.equal(
    webhookManifest({ dataId: '123', timestamp: '1704908010' }),
    'id:123;ts:1704908010;'
  );
});

test('aceita assinatura HMAC válida', () => {
  const secret = 'segredo-de-homologacao';
  const manifest = 'id:123;request-id:req-1;ts:1704908010;';
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  assert.equal(validWebhookSignature({
    secret,
    signature: `ts=1704908010,v1=${v1}`,
    requestId: 'req-1',
    dataId: '123'
  }), true);
});

test('ignora espaços acidentais ao colar o segredo no ambiente', () => {
  const manifest = 'id:abc123;request-id:req-1;ts:1704908010;';
  const v1 = crypto.createHmac('sha256', 'segredo-de-homologacao').update(manifest).digest('hex');
  assert.equal(validWebhookSignature({
    secret: '  segredo-de-homologacao  ',
    signature: `ts=1704908010,v1=${v1}`,
    requestId: 'req-1',
    dataId: 'ABC123'
  }), true);
});

test('rejeita assinatura adulterada ou segredo ausente', () => {
  const params = {
    secret: 'segredo-de-homologacao',
    signature: `ts=1704908010,v1=${'0'.repeat(64)}`,
    requestId: 'req-1',
    dataId: '123'
  };
  assert.equal(validWebhookSignature(params), false);
  assert.equal(validWebhookSignature({ ...params, secret: '' }), false);
});
