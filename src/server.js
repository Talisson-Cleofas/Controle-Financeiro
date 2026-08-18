import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import adminRoutes from './routes/admin.js';
import billingRoutes from './routes/billing.js';
import { ensurePaymentIndexes } from './models/Payment.js';

const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não configurado.');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado.');
if (isProduction && process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET deve ter ao menos 32 caracteres em produção.');

const mongoDbName = String(process.env.MONGODB_DB_NAME || '').trim();
if (isProduction && !mongoDbName) throw new Error('MONGODB_DB_NAME não configurado.');

const allowedOrigins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (isProduction && !allowedOrigins.length) throw new Error('CORS_ORIGINS ou FRONTEND_URL deve ser configurado em produção.');

await mongoose.connect(process.env.MONGODB_URI, mongoDbName ? { dbName: mongoDbName } : {});
await ensurePaymentIndexes();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origem não autorizada pelo CORS.'), { status: 403 }));
  },
  credentials: true
}));
app.use(compression());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
const billingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingLimiter, billingRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'controle-financeiro-saas', version: '2.0.0', timestamp: new Date().toISOString() }));

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.use(express.static(publicDir, { maxAge: isProduction ? '1h' : 0, etag: true }));
app.get('/{*splat}', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status || error.statusCode || 500);
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor.' : error.message });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`Servidor iniciado na porta ${port}`));

async function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando servidor.`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
