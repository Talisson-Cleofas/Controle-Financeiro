const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (process.env.RENDER_SERVICE_ID !== 'srv-d9p2gebl550s73flltc0' || process.env.MERCADO_PAGO_ENV !== 'test' || process.env.MONGODB_DB_NAME !== 'controle_financeiro_v2_staging') {
    throw new Error('Esta branch só pode usar o serviço e banco de homologação.');
  }

  if (!mongoUri) {
    throw new Error('Banco de homologação não configurado.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri, {
    dbName: 'controle_financeiro_v2_staging',
    serverSelectionTimeoutMS: 10000
  });

  const adminEmail = String(process.env.HMG_ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) {
    const User = require('../models/User');
    const result = await User.updateOne({ email: adminEmail }, { $set: { role: 'admin' } });
    console.log(`Administrador de homologação configurado: ${result.matchedCount === 1 ? 'sim' : 'conta não encontrada'}`);
  }

  console.log('✅ MongoDB conectado com sucesso');
}

module.exports = connectDatabase;
