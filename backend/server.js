// ─── CARREGA VARIÁVEIS DE AMBIENTE PRIMEIRO ───────────────
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const {
  helmetMiddleware,
  globalLimiter,
  mongoSanitizeMiddleware,
  hppMiddleware,
  xssSanitize
} = require('./middleware/security');

const authRoutes     = require('./routes/auth');
const proposalRoutes = require('./routes/proposals');
const billingRoutes  = require('./routes/billing');

const app = express();

// ═══════════════════════════════════════════════════════════
// SEGURANÇA — camada 1: headers HTTP
// ═══════════════════════════════════════════════════════════
app.use(helmetMiddleware);

// ═══════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Permite requests sem origin (mobile, Postman, mesmo servidor)
    if (!origin) return callback(null, true);
    
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ].filter(Boolean);

    // Permite qualquer subdomínio do onrender.com
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    
    if (allowed.includes(origin)) return callback(null, true);
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ═══════════════════════════════════════════════════════════
// WEBHOOK DO STRIPE — precisa do body RAW antes do json()
// ═══════════════════════════════════════════════════════════
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ═══════════════════════════════════════════════════════════
// PARSING
// ═══════════════════════════════════════════════════════════
app.use(express.json({ limit: '100kb' })); // limita tamanho do body
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// ═══════════════════════════════════════════════════════════
// SEGURANÇA — camada 2: dados
// ═══════════════════════════════════════════════════════════
app.use(mongoSanitizeMiddleware); // previne injeção NoSQL
app.use(hppMiddleware);           // previne poluição de parâmetros
app.use(xssSanitize);             // sanitização XSS
app.use(globalLimiter);           // rate limiting global

// ═══════════════════════════════════════════════════════════
// ARQUIVOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true
}));

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════
// ROTAS DA API
// ═══════════════════════════════════════════════════════════
app.use('/api/auth',      authRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/billing',   billingRoutes);

// ═══════════════════════════════════════════════════════════
// SPA FALLBACK — serve o frontend para todas as outras rotas
// ═══════════════════════════════════════════════════════════
const serveHTML = (file) => (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', file));
};

app.get('/',          serveHTML('index.html'));
app.get('/login',     serveHTML('login.html'));
app.get('/cadastro',  serveHTML('register.html'));
app.get('/dashboard', serveHTML('dashboard.html'));
app.get('/editor',    serveHTML('editor.html'));
app.get('/precos',    serveHTML('pricing.html'));
app.get('/aceitar/:token',    serveHTML('accept.html'));
app.get('/recuperar-senha',  serveHTML('forgot-password.html'));

// Rota 404 para API
app.use('/api/*', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Rota não encontrada.' });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLER GLOBAL
// ═══════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ status: 'error', message: 'Origem não permitida.' });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Erro interno do servidor.'
    : err.message;

  res.status(statusCode).json({ status: 'error', message });
});

// ═══════════════════════════════════════════════════════════
// CONEXÃO MONGODB + START
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB conectado com sucesso');
  } catch (err) {
    console.error('❌ Erro ao conectar MongoDB:', err.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 PropostaPro rodando em http://localhost:${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
});

module.exports = app;
