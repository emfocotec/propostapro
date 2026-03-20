const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, maxlength: 200 },
  price: { type: String, trim: true, maxlength: 50 }
}, { _id: false });

const proposalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Tipo de documento
  docType: {
    type: String,
    enum: ['proposal', 'contract', 'both'],
    default: 'both'
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'approved', 'rejected', 'expired'],
    default: 'draft'
  },

  // Dados do prestador (snapshot no momento da criação)
  provider: {
    name:    { type: String, required: true, trim: true, maxlength: 150 },
    docNum:  { type: String, trim: true, maxlength: 30 },
    email:   { type: String, trim: true, maxlength: 150 },
    address: { type: String, trim: true, maxlength: 300 }
  },

  // Dados do cliente
  client: {
    name:    { type: String, required: true, trim: true, maxlength: 150 },
    docNum:  { type: String, trim: true, maxlength: 30 },
    contact: { type: String, trim: true, maxlength: 150 },
    email:   { type: String, trim: true, maxlength: 150 },
    address: { type: String, trim: true, maxlength: 300 }
  },

  // Projeto
  project: {
    type:       { type: String, trim: true, maxlength: 50 },
    profType:   { type: String, trim: true, maxlength: 50 },
    scope:      { type: String, trim: true, maxlength: 5000 },
    services:   [serviceSchema],
    totalValue: { type: String, trim: true, maxlength: 50 }
  },

  // Condições
  conditions: {
    startDate:   String,
    endDate:     String,
    paymentType: { type: String, trim: true, maxlength: 50 },
    paymentMethod:{ type: String, trim: true, maxlength: 50 },
    revisions:   { type: String, trim: true, maxlength: 20 },
    validity:    { type: String, trim: true, maxlength: 10 },
    tone:        { type: String, trim: true, maxlength: 20 }
  },

  // Link de aceite público
  acceptToken: {
    type: String,
    unique: true,
    sparse: true
  },
  acceptedAt:   Date,
  acceptedByIp: String,
  viewedAt:     Date,
  sentAt:       Date,

  // Conteúdo gerado (HTML para PDF)
  proposalHtml:  String,
  contractHtml:  String,

  title: { type: String, trim: true, maxlength: 200 }

}, {
  timestamps: true
});

// Índices para performance
proposalSchema.index({ user: 1, createdAt: -1 });
proposalSchema.index({ acceptToken: 1 });
proposalSchema.index({ status: 1 });

const Proposal = mongoose.model('Proposal', proposalSchema);
module.exports = Proposal;
