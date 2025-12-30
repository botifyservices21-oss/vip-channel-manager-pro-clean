// services/index.js — MongoDB Data Layer
const { collections } = require("../db.js");

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Generador simple de IDs
function genId() {
  return Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────────
// SETTINGS (config generales del bot)
// ─────────────────────────────────────────────
async function getSettings() {
  const doc = await collections.settings.findOne({ _id: "settings" });
  return doc?.data || {};
}

async function saveSettings(data) {
  await collections.settings.updateOne(
    { _id: "settings" },
    { $set: { data } },
    { upsert: true }
  );
  return true;
}

// ─────────────────────────────────────────────
// PAYMENT SETTINGS (Stripe / TON / etc.)
// ─────────────────────────────────────────────
async function getPaymentSettings() {
  const doc = await collections.paymentSettings.findOne({ _id: "payment" });
  return doc?.data || {};
}

async function savePaymentSettings(data) {
  await collections.paymentSettings.updateOne(
    { _id: "payment" },
    { $set: { data } },
    { upsert: true }
  );
  return true;
}

// ─────────────────────────────────────────────
// VIP CHANNELS
// ─────────────────────────────────────────────
async function listVipChannels() {
  return await collections.vipChannels.find({}).toArray();
}

async function addVipChannel(channel) {
  const newChannel = {
    id: channel.id,
    title: channel.title || "VIP Channel",
    createdAt: Date.now(),
  };
  await collections.vipChannels.insertOne(newChannel);
  return newChannel;
}

async function removeVipChannel(channelId) {
  await collections.vipChannels.deleteOne({ id: channelId });
  return true;
}

// ─────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────
async function listPlans() {
  return await collections.plans.find({}).toArray();
}

async function getPlanById(id) {
  return await collections.plans.findOne({ id });
}

async function createPlan(plan) {
  const newPlan = {
    id: genId(),
    name: plan.name,
    price: Number(plan.price),
    currency: plan.currency || "EUR",
    durationDays: Number(plan.durationDays),
    channelId: plan.channelId || null,
    stripe_price_id: plan.stripe_price_id || null,
  };

  await collections.plans.insertOne(newPlan);
  return newPlan;
}

async function updatePlan(id, data) {
  await collections.plans.updateOne({ id }, { $set: data });
  return true;
}

async function deletePlan(id) {
  await collections.plans.deleteOne({ id });
  return true;
}

// ─────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────
async function listAllSubscriptions() {
  return await collections.subscriptions.find({}).toArray();
}

async function getUserSubscriptions(userId) {
  return await collections.subscriptions.find({ userId }).toArray();
}

async function createSubscription(sub) {
  const newSub = {
    id: genId(),
    userId: sub.userId,
    planId: sub.planId,
    planName: sub.planName,
    channelId: sub.channelId,
    startAt: sub.startAt,
    endAt: sub.endAt,
    active: sub.active ?? true,
    stripeSubscriptionId: sub.stripeSubscriptionId || null,
    stripeCustomerId: sub.stripeCustomerId || null,
  };

  await collections.subscriptions.insertOne(newSub);
  return newSub;
}

async function updateSubscription(id, data) {
  await collections.subscriptions.updateOne({ id }, { $set: data });
  return true;
}

async function deactivateSubscription(id) {
  await collections.subscriptions.updateOne(
    { id },
    { $set: { active: false } }
  );
  return true;
}

// Buscar suscripción por Stripe
async function findSubscriptionByStripeId(stripeSubscriptionId) {
  return await collections.subscriptions.findOne({ stripeSubscriptionId });
}

// ─────────────────────────────────────────────
// EXPORTAR
// ─────────────────────────────────────────────

module.exports = {
  // Settings
  getSettings,
  saveSettings,

  // Payment
  getPaymentSettings,
  savePaymentSettings,

  // VIP Channels
  listVipChannels,
  addVipChannel,
  removeVipChannel,

  // Plans
  listPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,

  // Subscriptions
  listAllSubscriptions,
  getUserSubscriptions,
  createSubscription,
  updateSubscription,
  deactivateSubscription,
  findSubscriptionByStripeId,
};
