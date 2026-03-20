const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'E-mail é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'E-mail inválido']
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
    select: false // nunca retorna a senha em queries
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Plano e billing
  plan: {
    type: String,
    enum: ['free', 'solo', 'agencia'],
    default: 'free'
  },
  planExpiresAt: Date,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'canceled', 'past_due', null],
    default: null
  },

  // Perfil profissional
  companyName: { type: String, trim: true, maxlength: 150 },
  cnpjCpf: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },

  // Contadores de uso (para limitar plano free)
  proposalCount: { type: Number, default: 0 },
  proposalCountMonth: { type: Number, default: 0 },
  proposalCountReset: { type: Date, default: Date.now },

  // Segurança
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  active: { type: Boolean, default: true, select: false },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: String,

  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ── ÍNDICES ──
userSchema.index({ email: 1 });
userSchema.index({ stripeCustomerId: 1 });

// ── VIRTUAL: limites do plano ──
userSchema.virtual('planLimits').get(function () {
  const limits = {
    free:    { proposalsPerMonth: 3,  contracts: true, pdfLogo: false, multiUser: false, customTemplates: false },
    solo:    { proposalsPerMonth: -1, contracts: true, pdfLogo: true,  multiUser: false, customTemplates: true  },
    agencia: { proposalsPerMonth: -1, contracts: true, pdfLogo: true,  multiUser: true,  customTemplates: true  }
  };
  return limits[this.plan] || limits.free;
});

// ── PRE-SAVE: hash da senha ──
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── PRE-SAVE: atualiza passwordChangedAt ──
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ── PRE-QUERY: excluir usuários inativos ──
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// ── MÉTODOS ──
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  return resetToken;
};

userSchema.methods.isAccountLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function () {
  // Desbloqueia se o lock expirou
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  // Bloqueia após 5 tentativas por 2 horas
  if (this.loginAttempts + 1 >= 5 && !this.lockUntil) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  return await this.updateOne(updates);
};

userSchema.methods.canCreateProposal = function () {
  if (this.plan !== 'free') return { allowed: true };

  // Reseta contador mensal se necessário
  const now = new Date();
  const resetDate = new Date(this.proposalCountReset);
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    this.proposalCountMonth = 0;
    this.proposalCountReset = now;
  }

  const limit = this.planLimits.proposalsPerMonth;
  if (this.proposalCountMonth >= limit) {
    return { allowed: false, reason: `Plano gratuito permite ${limit} propostas por mês. Faça upgrade para continuar.` };
  }
  return { allowed: true };
};

const User = mongoose.model('User', userSchema);
module.exports = User;
