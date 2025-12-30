// services.js
const { readDB, writeDB } = require("./utils");
const { DEFAULT_SETTINGS } = require("./config");
const { v4: uuidv4 } = require("uuid");

/* ============================================================
   CONFIG MULTI-TENANT
   Cada instancia puede tener varios "tenants" (clientes).
   Por ahora usamos uno por defecto: TENANT_ID = "default".
============================================================ */

const TENANT_ID = process.env.TENANT_ID || "default";

const DEFAULT_PAYMENT_SETTINGS = {
  mode: "MANUAL",            // MANUAL | TON | STRIPE
  ton_api_key: "",
  stripe_secret_key: "",
  stripe_price_id: "",
  stripe_webhook_secret: "",
  usdt_wallet: ""
};

function ensureTenantStructure(db) {
  // Migración desde esquema antiguo (sin tenants) a multi-tenant
  if (!db.tenants) {
    db.tenants = {};

    db.tenants["default"] = {
      settings: db.settings || { ...DEFAULT_SETTINGS },
      paymentSettings: db.paymentSettings || { ...DEFAULT_PAYMENT_SETTINGS },
      vipChannels: db.vipChannels || [],
      plans: db.plans || [],
      subscriptions: db.subscriptions || [],
    };

    // Limpiar claves antiguas para evitar duplicidades
    delete db.settings;
    delete db.paymentSettings;
    delete db.vipChannels;
    delete db.plans;
    delete db.subscriptions;

    writeDB(db);
  }

  if (!db.tenants[TENANT_ID]) {
    db.tenants[TENANT_ID] = {
      settings: { ...DEFAULT_SETTINGS },
      paymentSettings: { ...DEFAULT_PAYMENT_SETTINGS },
      vipChannels: [],
      plans: [],
      subscriptions: [],
    };
    writeDB(db);
  }

  return db.tenants[TENANT_ID];
}

function getTenantDb() {
  const db = readDB();
  const tenant = ensureTenantStructure(db);
  return { db, tenant };
}

function updateTenant(mutator) {
  const { db, tenant } = getTenantDb();
  mutator(tenant);
  writeDB(db);
  return tenant;
}

/* ============================================================
   SETTINGS GENERALES
============================================================ */

function getSettings() {
  const { tenant } = getTenantDb();
  if (!tenant.settings || Object.keys(tenant.settings).length === 0) {
    tenant.settings = { ...DEFAULT_SETTINGS };
    const { db } = getTenantDb();
    writeDB(db);
  }
  return tenant.settings;
}

/* ============================================================
   SETTINGS DE PAGOS
============================================================ */

function getPaymentSettings() {
  const { tenant } = getTenantDb();
  if (!tenant.paymentSettings) {
    tenant.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
    const { db } = getTenantDb();
    writeDB(db);
  }
  return tenant.paymentSettings;
}

function updatePaymentSettings(partial) {
  return updateTenant((tenant) => {
    if (!tenant.paymentSettings) {
      tenant.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
    }
    tenant.paymentSettings = {
      ...tenant.paymentSettings,
      ...partial,
    };
  }).paymentSettings;
}

/* ============================================================
   VIP CHANNELS
============================================================ */

function addVipChannel(chat) {
  return updateTenant((tenant) => {
    if (!tenant.vipChannels) tenant.vipChannels = [];
    const exists = tenant.vipChannels.find((c) => c.id === chat.id);
    if (exists) {
      tenant._lastVipAddResult = { ok: false, reason: "already_exists" };
    } else {
      tenant.vipChannels.push({
        id: chat.id,
        title: chat.title || chat.username || "Canal VIP",
        createdAt: Date.now(),
      });
      tenant._lastVipAddResult = { ok: true };
    }
  })._lastVipAddResult;
}

function listVipChannels() {
  const { tenant } = getTenantDb();
  return tenant.vipChannels || [];
}

/* ============================================================
   PLANS
============================================================ */

// Crear plan genérico con datos personalizados
function createPlan({ name, price, currency, durationDays, stripe_price_id = null, channelId = null }) {
  return updateTenant((tenant) => {
    if (!tenant.plans) tenant.plans = [];

    const plan = {
      id: uuidv4(),
      name: name || "Plan VIP",
      price: Number(price) || 0,
      currency: currency || "EUR",
      durationDays: Number(durationDays) || 30,
      createdAt: Date.now(),
      stripe_price_id: stripe_price_id || null,
      channelId: channelId || null,
    };

    tenant.plans.push(plan);
    tenant._lastCreatedPlan = plan;
  })._lastCreatedPlan;
}

// Atajo antiguo: crea el plan básico por defecto
function createSimplePlan() {
  return createPlan({
    name: "Basic monthly plan",
    price: 10,
    currency: "EUR",
    durationDays: 30,
  });
}

function listPlans() {
  const { tenant } = getTenantDb();
  return tenant.plans || [];
}

function getPlanById(id) {
  const { tenant } = getTenantDb();
  return (tenant.plans || []).find((p) => p.id === id) || null;
}

function setPlanStripePriceId(planId, priceId) {
  return updateTenant((tenant) => {
    if (!tenant.plans) tenant.plans = [];
    const plan = tenant.plans.find((p) => p.id === planId);
    if (!plan) {
      tenant._lastPlanUpdate = null;
    } else {
      plan.stripe_price_id = priceId;
      tenant._lastPlanUpdate = plan;
    }
  })._lastPlanUpdate;
}

function setPlanChannelId(planId, channelId) {
  return updateTenant((tenant) => {
    if (!tenant.plans) tenant.plans = [];
    const plan = tenant.plans.find((p) => p.id === planId);
    if (!plan) {
      tenant._lastPlanChannelUpdate = null;
      return;
    }
    plan.channelId = channelId;
    tenant._lastPlanChannelUpdate = plan;
  })._lastPlanChannelUpdate;
}

// 🔹 NUEVO: actualizar plan (nombre, precio, moneda, duración, canal…)
function updatePlan(planId, partial) {
  return updateTenant((tenant) => {
    if (!tenant.plans) tenant.plans = [];
    const plan = tenant.plans.find((p) => p.id === planId);
    if (!plan) {
      tenant._lastPlanUpdate = null;
      return;
    }

    if (partial.name !== undefined) plan.name = String(partial.name);
    if (partial.price !== undefined) plan.price = Number(partial.price);
    if (partial.currency !== undefined) plan.currency = String(partial.currency || "EUR").toUpperCase();
    if (partial.durationDays !== undefined) plan.durationDays = Number(partial.durationDays);
    if (partial.channelId !== undefined) plan.channelId = partial.channelId || null;

    tenant._lastPlanUpdate = plan;
  })._lastPlanUpdate;
}

// 🔹 NUEVO: eliminar plan
function deletePlan(planId) {
  return updateTenant((tenant) => {
    if (!tenant.plans) tenant.plans = [];
    const before = tenant.plans.length;
    tenant.plans = tenant.plans.filter((p) => p.id !== planId);
    tenant._lastDeletedPlan = before !== tenant.plans.length;
  })._lastDeletedPlan;
}

/* ============================================================
   SUBSCRIPTIONS (DB JSON, COMPATIBLE MANUAL + STRIPE)
============================================================ */

function addSubscription(userId, channelId, plan, extraMeta = {}) {
  return updateTenant((tenant) => {
    if (!tenant.subscriptions) tenant.subscriptions = [];

    const now = Date.now();
    const durationMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;

    const sub = {
      id: uuidv4(),
      userId,
      channelId,
      planId: plan.id || null,
      planName: plan.name || "Plan VIP",
      startAt: now,
      endAt: now + durationMs,
      active: true,
      stripeCustomerId: extraMeta.stripeCustomerId || null,
      stripeSubscriptionId: extraMeta.stripeSubscriptionId || null,
      notifiedBefore: false
    };

    tenant.subscriptions.push(sub);
    tenant._lastSub = sub;
  })._lastSub;
}

function listAllSubscriptions() {
  const { tenant } = getTenantDb();
  return tenant.subscriptions || [];
}

function getUserSubscriptions(userId) {
  const { tenant } = getTenantDb();
  if (!tenant.subscriptions) return [];
  return tenant.subscriptions.filter((s) => s.userId === userId);
}

function getSubscriptionById(id) {
  const { tenant } = getTenantDb();
  return (tenant.subscriptions || []).find((s) => s.id === id) || null;
}

// Suscripción de prueba
function createFakeSubscription(userId) {
  return updateTenant((tenant) => {
    if (!tenant.subscriptions) tenant.subscriptions = [];

    const now = Date.now();
    const endAt = now + 30 * 24 * 60 * 60 * 1000;

    const sub = {
      id: uuidv4(),
      userId,
      planId: null,
      planName: "Plan mensual básico",
      channelId: null,
      startAt: now,
      endAt,
      active: true,
    };

    tenant.subscriptions.push(sub);
    tenant._lastFake = sub;
  })._lastFake;
}

/* ============================================================
   STRIPE RECURRING — EXTENSIÓN / CANCELACIÓN
============================================================ */

function extendSubscriptionPeriod(userId, plan) {
  return updateTenant((tenant) => {
    if (!tenant.subscriptions) tenant.subscriptions = [];

    const durationMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;

    let sub = tenant.subscriptions.find(
      (s) => s.userId === userId && s.planId === plan.id
    );

    const now = Date.now();

    if (!sub) {
      // Si no existía, la creamos nueva (caso raro pero posible)
      const startAt = now;
      const endAt = now + durationMs;

      sub = {
        id: uuidv4(),
        userId,
        channelId: plan.channelId || null,
        planId: plan.id,
        planName: plan.name,
        startAt,
        endAt,
        active: true,
      };

      tenant.subscriptions.push(sub);
      tenant._lastExtended = sub;
      return;
    }

    // Extender desde la fecha de fin actual (o desde ahora, lo que sea mayor)
    const base = sub.endAt > now ? sub.endAt : now;
    sub.endAt = base + durationMs;
    sub.active = true;
    tenant._lastExtended = sub;
  })._lastExtended;
}

function revokeVipAccess(userId) {
  return updateTenant((tenant) => {
    if (!tenant.subscriptions) return;
    tenant.subscriptions = tenant.subscriptions.map((s) =>
      s.userId === userId ? { ...s, active: false } : s
    );
  });
}

/* ============================================================
   VIP ACCESS (JOIN / REMOVE)
============================================================ */

async function giveVipAccess(bot, userId, channelId) {
  try {
    await bot.telegram.unbanChatMember(channelId, userId);

    const invite = await bot.telegram.createChatInviteLink(channelId, {
      expire_date: Math.floor(Date.now() / 1000) + 3600,
      member_limit: 1,
    });

    await bot.telegram.sendMessage(
      userId,
      `🎉 <b>VIP access activated</b>\nÚnete aquí:\n${invite.invite_link}`,
      { parse_mode: "HTML" }
    );

    return true;
  } catch (e) {
    console.error("Error giveVipAccess:", e);
    return false;
  }
}

async function removeVipAccess(bot, userId, channelId) {
  try {
    if (!channelId) {
      console.warn("⚠ removeVipAccess llamado sin channelId");
      return false;
    }

    await bot.telegram.kickChatMember(channelId, userId);

    await bot.telegram.sendMessage(
      userId,
      "⚠️ Your VIP subscription has expired."
    );

    return true;
  } catch (e) {
    console.error("Error removeVipAccess:", e);
    return false;
  }
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  // Settings generales
  getSettings,

  // Settings de pago
  getPaymentSettings,
  updatePaymentSettings,

  // VIP Channels
  addVipChannel,
  listVipChannels,

  // Plans
  createPlan,
  createSimplePlan,
  listPlans,
  getPlanById,
  setPlanStripePriceId,
  setPlanChannelId,
  updatePlan,      // 🔹 NUEVO
  deletePlan,      // 🔹 NUEVO

  // Subscriptions
  addSubscription,
  listAllSubscriptions,
  getUserSubscriptions,
  getSubscriptionById,
  createFakeSubscription,
  extendSubscriptionPeriod,
  revokeVipAccess,

  // VIP Access
  giveVipAccess,
  removeVipAccess,
};
