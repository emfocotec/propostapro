const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

// ── HELMET: headers de segurança ──
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc:  ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      frameSrc:    ["'self'", "https://js.stripe.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'", "https://api.stripe.com"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// ── RATE LIMITERS ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Muitas requisições deste IP. Tente novamente em 15 minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // apenas 10 tentativas de login por 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Limite de requisições excedido. Tente novamente em 1 minuto.' }
});

const createProposalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Limite de criação de documentos atingido. Tente novamente em 1 hora.' }
});

// ── MONGO SANITIZE: previne injeção NoSQL ──
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  allowDots: false
});

// ── HPP: previne poluição de parâmetros HTTP ──
const hppMiddleware = hpp();

// ── XSS: sanitização manual de strings ──
const xssSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj[key] = sanitize(obj[key]);
        }
      }
    }
    return obj;
  };

  // Não sanitiza campos de conteúdo HTML (propostas editadas pelo usuário)
  const skipFields = ['proposalHtml', 'contractHtml'];
  if (req.body) {
    for (const key in req.body) {
      if (!skipFields.includes(key)) {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }
  next();
};

module.exports = {
  helmetMiddleware,
  globalLimiter,
  authLimiter,
  apiLimiter,
  createProposalLimiter,
  mongoSanitizeMiddleware,
  hppMiddleware,
  xssSanitize
};
