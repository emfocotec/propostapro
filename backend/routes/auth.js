const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const validator = require('validator');
const User = require('../models/User');
const { protect, signToken, sendTokenResponse } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// ── REGISTRO ──
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;

    // Validações
    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({ status: 'error', message: 'Todos os campos são obrigatórios.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ status: 'error', message: 'E-mail inválido.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ status: 'error', message: 'As senhas não coincidem.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Senha deve ter pelo menos 8 caracteres.' });
    }
    // Senha forte: letras + números
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      return res.status(400).json({ status: 'error', message: 'Senha deve conter letras e números.' });
    }

    // Verifica se e-mail já existe (sem revelar qual campo falhou)
    const existing = await User.findOne({ email: email.toLowerCase() }).select('+active');
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'Este e-mail já está cadastrado.' });
    }

    const user = await User.create({
      name: name.trim().slice(0, 100),
      email: email.toLowerCase().trim(),
      password
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ status: 'error', message: 'Este e-mail já está cadastrado.' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ status: 'error', message: 'Erro ao criar conta. Tente novamente.' });
  }
});

// ── LOGIN ──
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'E-mail e senha são obrigatórios.' });
    }

    // Busca usuário com senha (select: false no model)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +loginAttempts +lockUntil +active');

    // Mensagem genérica para não revelar se e-mail existe
    const invalidMsg = 'E-mail ou senha incorretos.';

    if (!user) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300)); // timing attack prevention
      return res.status(401).json({ status: 'error', message: invalidMsg });
    }

    if (user.isAccountLocked()) {
      return res.status(423).json({ status: 'error', message: 'Conta bloqueada temporariamente por muitas tentativas. Tente novamente em 2 horas.' });
    }

    const isValid = await user.correctPassword(password, user.password);
    if (!isValid) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ status: 'error', message: invalidMsg });
    }

    // Login bem-sucedido: reset tentativas
    if (user.loginAttempts > 0) {
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ status: 'error', message: 'Erro ao fazer login. Tente novamente.' });
  }
});

// ── LOGOUT ──
router.post('/logout', (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    sameSite: 'strict'
  });
  res.status(200).json({ status: 'success', message: 'Logout realizado com sucesso.' });
});

// ── ME: dados do usuário logado ──
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao buscar dados.' });
  }
});

// ── ATUALIZAR PERFIL ──
router.patch('/update-profile', protect, async (req, res) => {
  try {
    const allowedFields = ['name', 'companyName', 'cnpjCpf', 'phone', 'address'];
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (updateData.name && (updateData.name.length < 2 || updateData.name.length > 100)) {
      return res.status(400).json({ status: 'error', message: 'Nome deve ter entre 2 e 100 caracteres.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true, runValidators: true
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao atualizar perfil.' });
  }
});

// ── ALTERAR SENHA ──
router.patch('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return res.status(400).json({ status: 'error', message: 'Todos os campos são obrigatórios.' });
    }
    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ status: 'error', message: 'As novas senhas não coincidem.' });
    }
    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      return res.status(400).json({ status: 'error', message: 'Nova senha deve ter pelo menos 8 caracteres com letras e números.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({ status: 'error', message: 'Senha atual incorreta.' });
    }

    user.password = newPassword;
    await user.save();
    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao alterar senha.' });
  }
});

// ── SOLICITAR RESET DE SENHA ──
router.post('/forgot-password', authLimiter, async (req, res) => {
  // Sempre retorna a mesma mensagem (não revela se e-mail existe)
  const genericMsg = 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.';

  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(200).json({ status: 'success', message: genericMsg });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(200).json({ status: 'success', message: genericMsg });

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // TODO: enviar e-mail com o token
    // Em produção: usar nodemailer ou Resend
    console.log(`[DEV] Reset token para ${email}: ${resetToken}`);

    res.status(200).json({ status: 'success', message: genericMsg });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(200).json({ status: 'success', message: genericMsg });
  }
});

// ── RESETAR SENHA ──
router.patch('/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ status: 'error', message: 'Token inválido ou expirado.' });
    }

    const { password, passwordConfirm } = req.body;
    if (!password || !passwordConfirm) {
      return res.status(400).json({ status: 'error', message: 'Nova senha é obrigatória.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ status: 'error', message: 'As senhas não coincidem.' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao redefinir senha.' });
  }
});

module.exports = router;
