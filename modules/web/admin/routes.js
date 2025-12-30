// modules/web/admin/routes.js
const express = require("express");
const router = express.Router();

const { validateAdminToken } = require("../auth-links");

const {
  listPlans,
  listVipChannels,
  listAllSubscriptions,
  getUserSubscriptions,
  getSettings,
  getPaymentSettings,
} = require("../../../services");

const Stripe = require("stripe");

/* ============================================================
   MIDDLEWARE — Validar token del admin
============================================================ */
router.use((req, res, next) => {
  const token = req.query.token;
  const adminId = validateAdminToken(token);

  if (!adminId) return res.status(403).send("Acceso no autorizado.");

  req.adminId = adminId;
  next();
});

/* ============================================================
   DASHBOARD PRINCIPAL /admin?token=...
============================================================ */
router.get("/", async (req, res) => {
  const subs = listAllSubscriptions();
  const plans = listPlans();
  const channels = listVipChannels();
  const payment = getPaymentSettings();

  /* =============================
     Métricas base
  ============================= */
  const activeSubs = subs.filter((s) => s.active).length;
  const totalSubs = subs.length;
  const totalPlans = plans.length;
  const totalChannels = channels.length;


  router.get("/dashboard/admin/analytics/subscribers", async (req, res) => {
    const token = req.query.t;
    const payload = verifyDashboardToken(token, "admin");
    if (!payload) return res.status(401).send("Token inválido");

    const subs = await collections.subscriptions.find().toArray();

    // Agrupación por plan
    const stats = {};
    for (const s of subs) {
      if (!stats[s.planName]) {
        stats[s.planName] = {
          count: 0,
          active: 0,
          expired: 0,
        };
      }

      stats[s.planName].count++;
      if (s.active) stats[s.planName].active++;
      else stats[s.planName].expired++;
    }

    res.render("analytics.html", {
      token,
      stats,
      subs
    });
  });
  router.get("/dashboard/admin/system-status", async (req, res) => {
    const token = req.query.t;
    const payload = verifyDashboardToken(token, "admin");
    if (!payload) return res.status(401).send("Token inválido");

    // Ping Mongo
    let mongoStatus = true;
    try {
      await collections.subscriptions.estimatedDocumentCount();
    } catch {
      mongoStatus = false;
    }

    // Stripe status
    const payments = await getPaymentSettings();
    const stripeConfigured = Boolean(payments?.stripe_secret_key);
    const webhookConfigured = Boolean(payments?.stripe_webhook_secret);

    // TON status
    const tonConfigured = Boolean(payments?.ton_public_key);

    res.render("system-status.html", {
      token,
      mongoStatus,
      stripeConfigured,
      webhookConfigured,
      tonConfigured
    });
  });
  router.get("/dashboard/admin/subscribers", async (req, res) => {
    const token = req.query.t;
    const payload = verifyDashboardToken(token, "admin");
    if (!payload) return res.status(401).send("Token inválido");

    const { plan, state, method } = req.query;

    const filter = {};

    if (plan) filter.planName = plan;
    if (state === "active") filter.active = true;
    if (state === "expired") filter.active = false;
    if (method) filter.paymentMethod = method;

    const subs = await collections.subscriptions
      .find(filter)
      .sort({ endAt: -1 })
      .toArray();

    const plans = await collections.plans.find().toArray();

    res.render("subscribers-filter.html", {
      token,
      subs,
      plans,
      filter
    });
  });

  
  /* =============================
     Stripe metrics
  ============================= */
  let monthlyRevenue = 0;
  let totalRevenue = 0;

  if (payment.stripe_secret_key) {
    const stripe = Stripe(payment.stripe_secret_key);

    const sinceMonth = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);

    const charges = await stripe.charges.list({
      limit: 100,
      expand: ["data.balance_transaction"],
    });

    monthlyRevenue = charges.data
      .filter((c) => c.created >= sinceMonth)
      .reduce((acc, c) => acc + (c.amount || 0), 0) / 100;

    totalRevenue = charges.data.reduce((acc, c) => acc + (c.amount || 0), 0) / 100;
  }

  /* =============================
     Renderizar dashboard premium
  ============================= */
  res.render("dashboard", {
    adminId: req.adminId,

    totalSubs,
    activeSubs,
    totalPlans,
    totalChannels,

    monthlyRevenue,
    totalRevenue,

    plans,
    subs,
    channels,
  });
});

/* ============================================================
   LISTA DE SUSCRIPTORES
============================================================ */
router.get("/subscribers", (req, res) => {
  const subs = listAllSubscriptions();
  res.render("subscribers", { subs });
});

/* ============================================================
   PLANES
============================================================ */
router.get("/plans", (req, res) => {
  const plans = listPlans();
  const channels = listVipChannels();

  res.render("plans", {
    plans,
    channels,
  });
});

/* ============================================================
   CANALES VIP
============================================================ */
router.get("/channels", (req, res) => {
  const channels = listVipChannels();
  res.render("channels", { channels });
});

/* ============================================================
   CONFIGURACIÓN
============================================================ */
router.get("/settings", (req, res) => {
  const settings = getSettings();
  const payment = getPaymentSettings();

  res.render("settings", {
    settings,
    payment,
  });
});

module.exports = router;
