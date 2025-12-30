// services/mongo.js
const { collections } = require("../db");

// =========================
// SETTINGS
// =========================
async function getSettings() {
  const doc = await collections.settings.findOne({});

  return (
    doc || {
      timezone: "Europe/Madrid",
      graceDays: 0,
      supportContact: "@soporte",
      notifications: {
        enabled: true,
        onPurchase: true,
        onRenew: true,
        onExpire: true,
        onKick: true
      }
    }
  );
}


async function saveSettings(data) {
  await collections.settings.updateOne(
    {},
    { $set: data },
    { upsert: true }
  );
}

async function saveNotificationSettings(data) {
  await collections.settings.updateOne(
    {},
    { $set: { notifications: data } },
    { upsert: true }
  );
}

// =========================
// VIP CHANNELS
// =========================
async function listVipChannels() {
  return await collections.vipChannels.find().toArray();
}

async function addVipChannel(channel) {
  // Normalizamos el id a número si se puede
  const idNum = Number(channel.id);
  const normalizedId = isNaN(idNum) ? channel.id : idNum;

  const exists = await collections.vipChannels.findOne({
    $or: [
      { id: channel.id },
      { id: normalizedId },
      { id: String(normalizedId) },
    ],
  });
  if (exists) return { ok: false, reason: "already_exists" };

  await collections.vipChannels.insertOne({
    ...channel,
    id: normalizedId,
  });

  return { ok: true };
}

async function getVipChannelById(id) {
  const idNum = Number(id);
  const filter = isNaN(idNum)
    ? { id }
    : {
        $or: [{ id }, { id: idNum }, { id: String(idNum) }],
      };

  return await collections.vipChannels.findOne(filter);
}

async function updateVipChannel(id, data) {
  const idNum = Number(id);
  const filter = isNaN(idNum)
    ? { id }
    : {
        $or: [{ id }, { id: idNum }, { id: String(idNum) }],
      };

  return await collections.vipChannels.updateOne(filter, { $set: data });
}

async function deleteVipChannel(id) {
  const idNum = Number(id);
  const filter = isNaN(idNum)
    ? { id }
    : {
        $or: [{ id }, { id: idNum }, { id: String(idNum) }],
      };

  return await collections.vipChannels.deleteOne(filter);
}

// =========================
// PLANS
// =========================
async function listPlans() {
  return await collections.plans.find().toArray();
}

async function createPlan(plan) {
  return await collections.plans.insertOne(plan);
}

async function getPlanById(id) {
  return await collections.plans.findOne({ id });
}

async function updatePlan(id, data) {
  return await collections.plans.updateOne({ id }, { $set: data });
}

async function deletePlan(id) {
  return await collections.plans.deleteOne({ id });
}

// =========================
// SUBSCRIPTIONS
// =========================
async function getUserSubscriptions(userId) {
  return await collections.subscriptions
    .find({ userId: String(userId) })
    .toArray();
}

async function listAllSubscriptions() {
  return await collections.subscriptions.find().toArray();
}

async function createSubscription(sub) {
  return await collections.subscriptions.insertOne({
    ...sub,
    userId: String(sub.userId)
  });
}

async function updateSubscription(userId, data) {
  return await collections.subscriptions.updateMany(
    { userId: String(userId) },
    { $set: data }
  );
}


// =========================
// PAYMENTS SETTINGS
// =========================
async function getPaymentSettings() {
  return await collections.paymentSettings.findOne({});
}

async function savePaymentSettings(data) {
  await collections.paymentSettings.updateOne(
    {},
    { $set: data },
    { upsert: true }
  );
}

async function setPlanChannelId(planId, channelId) {
  return await collections.plans.updateOne(
    { id: planId },
    { $set: { channelId } }
  );
}

async function setPlanStripePrice(planId, stripePriceId) {
  return await collections.plans.updateOne(
    { id: planId },
    { $set: { stripe_price_id: stripePriceId } }
  );
}

module.exports = {
  getSettings,
  saveSettings,
  listVipChannels,
  addVipChannel,
  listPlans,
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
  getUserSubscriptions,
  listAllSubscriptions,
  createSubscription,
  getPaymentSettings,
  savePaymentSettings,
  setPlanChannelId,
  setPlanStripePrice,
  updateVipChannel,
  deleteVipChannel,
  getVipChannelById,
  updateSubscription,
  saveNotificationSettings,
};
