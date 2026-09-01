// HMG-only entry point. Never merge this branch into main.
require('dotenv').config();
if (process.env.RENDER_SERVICE_ID !== 'srv-d9p2gebl550s73flltc0' || process.env.MERCADO_PAGO_ENV !== 'test') {
  throw new Error('Homologação exige serviço isolado e Mercado Pago test.');
}
process.env.BILLING_ENABLED = 'true';
process.env.BILLING_ENFORCE_ACCESS = 'true';
process.env.BACKEND_URL = 'https://controle-financeiro-v2-staging.onrender.com';
process.env.CLIENT_URL = process.env.FRONTEND_URL;
require('./server');
