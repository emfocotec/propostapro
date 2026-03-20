const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Proposal = require('../models/Proposal');
const { protect } = require('../middleware/auth');
const { createProposalLimiter } = require('../middleware/security');

// Todas as rotas requerem autenticação
router.use(protect);

// ── LISTAR PROPOSTAS DO USUÁRIO ──
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status ? { status: req.query.status } : {};

    const [proposals, total] = await Promise.all([
      Proposal.find({ user: req.user._id, ...statusFilter })
        .select('title client.name status createdAt conditions.totalValue project.type docType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Proposal.countDocuments({ user: req.user._id, ...statusFilter })
    ]);

    res.status(200).json({
      status: 'success',
      results: proposals.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: { proposals }
    });
  } catch (err) {
    console.error('List proposals error:', err.message);
    res.status(500).json({ status: 'error', message: 'Erro ao buscar propostas.' });
  }
});

// ── CRIAR PROPOSTA ──
router.post('/', createProposalLimiter, async (req, res) => {
  try {
    // Verificar limite do plano free
    const canCreate = req.user.canCreateProposal();
    if (!canCreate.allowed) {
      return res.status(403).json({
        status: 'error',
        message: canCreate.reason,
        upgradeRequired: true
      });
    }

    const { provider, client, project, conditions, docType, title } = req.body;

    // Validações básicas
    if (!provider?.name) return res.status(400).json({ status: 'error', message: 'Nome do prestador é obrigatório.' });
    if (!client?.name) return res.status(400).json({ status: 'error', message: 'Nome do cliente é obrigatório.' });
    if (!project?.services || project.services.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Adicione pelo menos um serviço.' });
    }

    // Limitar número de serviços
    if (project.services.length > 30) {
      return res.status(400).json({ status: 'error', message: 'Máximo de 30 serviços por proposta.' });
    }

    // Gerar token para link de aceite
    const acceptToken = uuidv4();

    const proposal = await Proposal.create({
      user: req.user._id,
      docType: docType || 'both',
      provider: {
        name:    provider.name?.slice(0, 150),
        docNum:  provider.docNum?.slice(0, 30),
        email:   provider.email?.slice(0, 150),
        address: provider.address?.slice(0, 300)
      },
      client: {
        name:    client.name?.slice(0, 150),
        docNum:  client.docNum?.slice(0, 30),
        contact: client.contact?.slice(0, 150),
        email:   client.email?.slice(0, 150),
        address: client.address?.slice(0, 300)
      },
      project: {
        type:       project.type?.slice(0, 50),
        profType:   project.profType?.slice(0, 50),
        scope:      project.scope?.slice(0, 5000),
        services:   project.services.map(s => ({
          name:  s.name?.slice(0, 200),
          price: s.price?.slice(0, 50)
        })),
        totalValue: project.totalValue?.slice(0, 50)
      },
      conditions: {
        startDate:     conditions?.startDate,
        endDate:       conditions?.endDate,
        paymentType:   conditions?.paymentType?.slice(0, 50),
        paymentMethod: conditions?.paymentMethod?.slice(0, 50),
        revisions:     conditions?.revisions?.slice(0, 20),
        validity:      conditions?.validity?.slice(0, 10),
        tone:          conditions?.tone?.slice(0, 20)
      },
      title: title?.slice(0, 200) || `Proposta para ${client.name}`,
      acceptToken
    });

    // Incrementar contador do plano free
    if (req.user.plan === 'free') {
      await req.user.updateOne({
        $inc: { proposalCount: 1, proposalCountMonth: 1 },
        $set: { proposalCountReset: new Date() }
      });
    }

    res.status(201).json({
      status: 'success',
      data: { proposal }
    });
  } catch (err) {
    console.error('Create proposal error:', err.message);
    res.status(500).json({ status: 'error', message: 'Erro ao criar proposta.' });
  }
});

// ── BUSCAR PROPOSTA ──
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!proposal) {
      return res.status(404).json({ status: 'error', message: 'Proposta não encontrada.' });
    }

    res.status(200).json({ status: 'success', data: { proposal } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao buscar proposta.' });
  }
});

// ── ATUALIZAR PROPOSTA ──
router.patch('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ _id: req.params.id, user: req.user._id });
    if (!proposal) return res.status(404).json({ status: 'error', message: 'Proposta não encontrada.' });

    // Só permite editar drafts e sent
    if (!['draft', 'sent'].includes(proposal.status)) {
      return res.status(400).json({ status: 'error', message: 'Não é possível editar uma proposta já finalizada.' });
    }

    const allowedUpdates = ['title', 'status', 'provider', 'client', 'project', 'conditions', 'docType', 'proposalHtml', 'contractHtml'];
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updated = await Proposal.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.status(200).json({ status: 'success', data: { proposal: updated } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao atualizar proposta.' });
  }
});

// ── DELETAR PROPOSTA ──
router.delete('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!proposal) return res.status(404).json({ status: 'error', message: 'Proposta não encontrada.' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao deletar proposta.' });
  }
});

// ── LINK PÚBLICO DE ACEITE (sem autenticação) ──
router.get('/accept/:token', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ acceptToken: req.params.token })
      .select('-user -acceptToken')
      .lean();

    if (!proposal) {
      return res.status(404).json({ status: 'error', message: 'Proposta não encontrada ou link inválido.' });
    }

    // Registra visualização
    if (!proposal.viewedAt) {
      await Proposal.findByIdAndUpdate(proposal._id, {
        viewedAt: new Date(),
        status: proposal.status === 'sent' ? 'viewed' : proposal.status
      });
    }

    res.status(200).json({ status: 'success', data: { proposal } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao acessar proposta.' });
  }
});

// ── ACEITAR PROPOSTA PELO LINK ──
router.post('/accept/:token/sign', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ acceptToken: req.params.token });

    if (!proposal) return res.status(404).json({ status: 'error', message: 'Link inválido.' });
    if (proposal.status === 'approved') return res.status(400).json({ status: 'error', message: 'Esta proposta já foi aceita.' });

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    await Proposal.findByIdAndUpdate(proposal._id, {
      status: 'approved',
      acceptedAt: new Date(),
      acceptedByIp: clientIp
    });

    res.status(200).json({ status: 'success', message: 'Proposta aceita com sucesso!' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao aceitar proposta.' });
  }
});

module.exports = router;
