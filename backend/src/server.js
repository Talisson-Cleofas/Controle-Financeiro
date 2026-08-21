require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDatabase = require('./config/database');
const authRoutes = require('./routes/auth.routes');
const transactionRoutes = require('./routes/transaction.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

const productionOrigins = [
  'https://controle-financeiro-v10-planejament.vercel.app'
];

const allowedOrigins = Array.from(new Set([
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  ...productionOrigins
]));

const vercelPreviewOriginPatterns = [
  /^https:\/\/controle-financeiro-v10-planejamento-[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/controle-financeiro-v-git-[a-z0-9-]+-talissoncleofas-7352s-projects\.vercel\.app$/i
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return vercelPreviewOriginPatterns.some((pattern) => pattern.test(origin));
}

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida pelo CORS.'));
    },
    credentials: true
  })
);

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 250,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições. Tente novamente em alguns minutos.' }
  })
);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Controle Financeiro API',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use(errorHandler);

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 API rodando na porta ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/api/health`);
    });
  })
  .catch((error) => {
    console.error('❌ Falha ao conectar ao MongoDB:', error.message);
    process.exit(1);
  });
