// modules/payments/ton-advanced.js
const {
  listPlans,
  getPlanById,
  addSubscription,
  giveVipAccess,
} = require("../../services/mongo.js");

const NANO_TON = 1_000_000_000;
const TON_TX_LIMIT = 50;

// -----------------------------
// Helpers
// -----------------------------
function getTonAddress() {
  const addr = process.env.DIRECCION_TON;
  if (!addr) throw new Error("DIRECCION_TON no configurada");
  return addr;
}

function buildMemo(userId, planId) {
  return `VIP-${userId}-${planId}`;
}

function toNumberSafe(v) {
  if (!v) return 0;
  return Number(v);
}

// -----------------------------
// HTTP Helper
// -----------------------------
async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// -----------------------------
// TonAPI
// -----------------------------
async function getTonApiTransactions(address) {
  const url = `https://tonapi.io/v2/blockchain/accounts/${address}/transactions?limit=${TON_TX_LIMIT}`;
  const data = await fetchJson(url);
  return data.transactions || [];
}

function extractTonApiTxInfo(tx) {
  const inMsg = tx.in_msg || tx.inMessage || {};
  const value = toNumberSafe(inMsg.value);
  let comment = "";

  const msgData = inMsg.msg_data || {};
  if (typeof msgData === "string") comment = msgData;
  else if (msgData.text) comment = msgData.text;
  else if (msgData.comment) comment = msgData.comment;

  const hash =
    tx.hash ||
    (tx.transaction_id && tx.transaction_id.hash) ||
    tx.transaction_hash ||
    "";

  return { value, comment, hash };
}

// -----------------------------
// Toncenter Fallback
// -----------------------------
async function getToncenterTransactions(address) {
  const key = process.env.TONCENTER_API_KEY || "";
  const url = `https://toncenter.com/api/v2/getTransactions?address=${address}&limit=${TON_TX_LIMIT}${key ? `&api_key=${key}` : ""}`;
  const data = await fetchJson(url);
  return data.result || [];
}

function extractToncenterTxInfo(tx) {
  const inMsg = tx.in_msg || {};
  const value = toNumberSafe(inMsg.value);

  let comment = "";
  const msgData = inMsg.msg_data || {};
  if (typeof msgData === "string") comment = msgData;
  else if (msgData.text) comment = msgData.text;
  else if (msgData.comment) comment = msgData.comment;

  const hash =
    (tx.transaction_id && tx.transaction_id.hash) ||
    tx.transaction_hash ||
    "";

  return { value, comment, hash };
}

// -----------------------------
// Buscar coincidencia TON
// -----------------------------
async function findMatchingTonPayment(address, memo, minNano) {
  // 1) TonAPI
  try {
    const txs = await getTonApiTransactions(address);
    for (const tx of txs) {
      const { value, comment, hash } = extractTonApiTxInfo(tx);
      if (comment && comment.includes(memo) && value >= minNano)
        return { hash, value };
    }
  } catch (e) {
    console.error("TonAPI error:", e.message);
  }

  // 2) Toncenter
  try {
    const txs = await getToncenterTransactions(address);
    for (const tx of txs) {
      const { value, comment, hash } = extractToncenterTxInfo(tx);
      if (comment && comment.includes(memo) && value >= minNano)
        return { hash, value };
    }
  } catch (e) {
    console.error("Toncenter error:", e.message);
  }

  return null;
}

// -----------------------------
// Iniciar proceso de pago
// -----------------------------
async function startTonPaymentForPlan(ctx, planId) {
  let wallet;
  try {
    wallet = getTonAddress();
  } catch (e) {
    return ctx.reply("❌ This bot does not have TON billing configured.");
  }

  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId) || (await getPlanById(planId));

  if (!plan) return ctx.reply("❌ Plan not found.");

  const userId = ctx.from.id;
  const memo = buildMemo(userId, plan.id);
  const amountTon = Number(plan.price);

  if (!amountTon || amountTon <= 0)
    return ctx.reply("⚠️ This plan does not have a valid TON price.");

  const msg =
    `💎 <b>Pay with TON</b>\n\n` +
    `Plan: <b>${plan.name}</b>\n` +
    `Import: <b>${amountTon} TON</b>\n\n` +
    `1️⃣ Send ${amountTon} TON to:\n<code>${wallet}</code>\n\n` +
    `2️⃣ Please include this comment in the transaction:\n<code>${memo}</code>\n\n` +
    `3️⃣ Press “I have already paid” when you do.`;

  return ctx.reply(msg, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ I've already paid with TON", callback_data: `TON_CONFIRM_${plan.id}` }],
        [{ text: "⬅️ Back", callback_data: "USER_BACK_TO_START" }],
      ],
    },
  });
}

// -----------------------------
// Confirmar pago
// -----------------------------
async function confirmTonPayment(ctx, bot, planId) {
  let wallet;
  try {
    wallet = getTonAddress();
  } catch (_) {
    return ctx.reply("❌ TON payment not configured.");
  }

  const userId = ctx.from.id;

  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId) || (await getPlanById(planId));

  if (!plan) return ctx.reply("❌ Plan not found.");

  const memo = buildMemo(userId, plan.id);
  const amountTon = Number(plan.price);
  const minNano = amountTon * NANO_TON;

  await ctx.answerCbQuery("🔍 Verifying payment...");

  const payment = await findMatchingTonPayment(wallet, memo, minNano);

  if (!payment) {
    return ctx.reply("⚠️ Your payment has not been found yet.\nTry again in 1–2 minutes.");
  }

  const channelId = plan.channelId || null;

  const sub = await addSubscription(
    userId,
    channelId,
    plan,
    {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }
  );

  if (channelId) {
    try {
      await giveVipAccess(bot, userId, channelId);
    } catch (e) {
      console.error("VIP error:", e);
    }
  }

  return ctx.reply(
    `🎉 <b>TON payment confirmed</b>\n\n` +
      `Plan: <b>${plan.name}</b>\n` +
      `TX Hash: <code>${payment.hash}</code>\n\n` +
      `Active subscription until:\n<code>${new Date(sub.endAt).toLocaleString()}</code>\n`,
    { parse_mode: "HTML" }
  );
}

module.exports = {
  startTonPaymentForPlan,
  confirmTonPayment,
};
