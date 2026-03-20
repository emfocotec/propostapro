const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.warn('[Billing] Stripe não configurado. Configure STRIPE_SECRET_KEY no .env');
}

const PLANS = {
  solo_monthly:    { price: process.env.STRIPE_PRICE_SOLO_MONTHLY,    plan: 'solo' },
  agencia_monthly: { price: process.env.STRIPE_PRICE_AGENCIA_MONTHLY, plan: 'agencia' },
  solo_yearly:     { price: process.env.STRIPE_PRICE_SOLO_YEARLY,     plan: 'solo' },
  agencia_yearly:  { price: process.env.STRIPE_PRICE_AGENCIA_YEARLY,  plan: 'agencia' }
};

// ── CRIAR CHECKOUT SESSION ──
router.post('/create-checkout', protect, async (req, res) => {
  if (!stripe) return res.status(503).json({ status: 'error', message: 'Pagamentos não configurados ainda.' });

  try {
    const { planKey } = req.body; // ex: 'solo_monthly'
    const planConfig = PLANS[planKey];
    if (!planConfig || !planConfig.price) {
      return res.status(400).json({ status: 'error', message: 'Plano inválido.' });
    }

    const user = req.user;

    // Cria ou recupera customer no Stripe
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() }
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.price, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success&plan=${planConfig.plan}`,
      cancel_url:  `${process.env.FRONTEND_URL}/precos?payment=canceled`,
      metadata: {
        userId:  user._id.toString(),
        planKey
      },
      subscription_data: {
        metadata: { userId: user._id.toString(), planKey }
      },
      locale: 'pt-BR',
      allow_promotion_codes: true
    });

    res.status(200).json({ status: 'success', data: { sessionUrl: session.url } });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ status: 'error', message: 'Erro ao criar sessão de pagamento.' });
  }
});

// ── PORTAL DO CLIENTE (gerenciar assinatura) ──
router.post('/portal', protect, async (req, res) => {
  if (!stripe) return res.status(503).json({ status: 'error', message: 'Pagamentos não configurados.' });

  try {
    if (!req.user.stripeCustomerId) {
      return res.status(400).json({ status: 'error', message: 'Nenhuma assinatura ativa encontrada.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`
    });

    res.status(200).json({ status: 'success', data: { portalUrl: session.url } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao acessar portal de assinatura.' });
  }
});

// ── WEBHOOK DO STRIPE (sem autenticação — verificado pela assinatura) ──
// IMPORTANTE: esta rota precisa do body RAW (buffer), não JSON
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe não configurado');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const planKey = session.metadata?.planKey;
        const planConfig = PLANS[planKey];

        if (userId && planConfig) {
          const expiresAt = planKey.includes('yearly')
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 31  * 24 * 60 * 60 * 1000);

          await User.findByIdAndUpdate(userId, {
            plan: planConfig.plan,
            planExpiresAt: expiresAt,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active'
          });
          console.log(`[Stripe] Plano ${planConfig.plan} ativado para usuário ${userId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const userId = customer.metadata?.userId;

        if (userId) {
          const statusMap = { active: 'active', past_due: 'past_due', canceled: 'canceled', unpaid: 'inactive' };
          await User.findByIdAndUpdate(userId, {
            subscriptionStatus: statusMap[sub.status] || 'inactive'
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const userId = customer.metadata?.userId;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            plan: 'free',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null
          });
          console.log(`[Stripe] Assinatura cancelada, usuário ${userId} voltou ao plano free`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const userId = customer.metadata?.userId;
        if (userId) {
          await User.findByIdAndUpdate(userId, { subscriptionStatus: 'past_due' });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
