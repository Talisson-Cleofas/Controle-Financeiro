export const mercadoPagoTestMode = () => String(process.env.MERCADO_PAGO_ENV || 'production').toLowerCase() === 'test';

export async function mp(path, options = {}) {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw Object.assign(new Error('Mercado Pago ainda não configurado.'), { status: 503 });
  }
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  // Do not log provider bodies: they can contain payer data.
  if (!response.ok) throw Object.assign(new Error(`Mercado Pago retornou HTTP ${response.status}.`), { status: 502 });
  return data;
}
