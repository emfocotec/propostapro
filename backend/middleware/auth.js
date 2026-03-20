const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── PROTEGER ROTAS: verifica JWT ──
exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1) Pega o token do header ou cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Você não está autenticado. Faça login para continuar.'
      });
    }

    // 2) Verifica o token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ status: 'error', message: 'Sua sessão expirou. Faça login novamente.' });
      }
      return res.status(401).json({ status: 'error', message: 'Token inválido. Faça login novamente.' });
    }

    // 3) Verifica se o usuário ainda existe
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ status: 'error', message: 'Este usuário não existe mais.' });
    }

    // 4) Verifica se a senha foi alterada após o token ser emitido
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({ status: 'error', message: 'Senha alterada recentemente. Faça login novamente.' });
    }

    // 5) Verifica se conta está bloqueada
    if (currentUser.isAccountLocked()) {
      return res.status(423).json({ status: 'error', message: 'Conta temporariamente bloqueada por muitas tentativas de login.' });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Erro interno de autenticação.' });
  }
};

// ── VERIFICAR PLANO ──
exports.requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        status: 'error',
        message: `Esta funcionalidade requer plano ${plans.join(' ou ')}. Faça upgrade para continuar.`,
        upgradeRequired: true
      });
    }
    next();
  };
};

// ── GERAR TOKEN JWT ──
exports.signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// ── ENVIAR TOKEN COMO COOKIE SEGURO ──
exports.sendTokenResponse = (user, statusCode, res) => {
  const token = exports.signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true, // não acessível via JS
    secure: process.env.NODE_ENV === 'production', // HTTPS only em prod
    sameSite: 'strict'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove campos sensíveis da resposta
  user.password = undefined;
  user.loginAttempts = undefined;
  user.lockUntil = undefined;
  user.__v = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user }
  });
};
