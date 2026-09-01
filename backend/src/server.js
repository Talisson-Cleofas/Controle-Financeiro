require('dotenv').config();
const connectDatabase = require('./config/database');
const { createApp } = require('./app');
const { billingEnabled } = require('./services/billing-access');

async function start() {
  await connectDatabase();
  const hello = await require('mongoose').connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Sincronização exige MongoDB com transações.');
  let stopWorker = () => {};
  if (billingEnabled()) {
    const { initializeBilling } = await import('./billing/initialize.js');
    stopWorker = await initializeBilling();
  }
  const app = await createApp();
  const server = app.listen(process.env.PORT || 3000, () => console.log('API disponível.'));
  const shutdown = async () => {
    await stopWorker();
    server.close(async () => {
      await require('mongoose').disconnect();
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
start().catch(() => {
  console.error('Falha ao iniciar API; confira banco e configuração de cobrança.');
  process.exit(1);
});
