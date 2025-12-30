// modules/payments/stripe-checkout.js
const Stripe = require("stripe");
const { getPaymentSettings, listPlans } = require("../../services/mongo.js");

async function startStripeCheckoutForPlan(ctx, planId) {
  const settings = await getPaymentSettings();

  if (!settings.stripe_secret_key) {
    return ctx.reply("❌ Stripe is not configured correctly.");
  }

  const stripe = Stripe(settings.stripe_secret_key);

  // 🔧 FIX: listPlans() ahora es async → await
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);

  if (!plan) {
    return ctx.reply("❌ Plan not found.");
  }

  if (!plan.stripe_price_id) {
    return ctx.reply("❌ This plan does not have an assigned Price ID.");
  }

  const redirectUrl = "https://t.me/" + ctx.botInfo.username;
  const channelId = plan.channelId || null;

  console.log("➡️ Creating checkout for plan:", {
    planId: plan.id,
    name: plan.name,
    priceId: plan.stripe_price_id,
    channelId,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",

    payment_method_types: ["card"],

    metadata: {
      telegram_user_id: String(ctx.from.id),
      plan_id: String(plan.id),
      channel_id: channelId ? String(channelId) : "",
    },

    subscription_data: {
      metadata: {
        telegram_user_id: String(ctx.from.id),
        plan_id: String(plan.id),
        channel_id: channelId ? String(channelId) : "",
      },
    },

    line_items: [
      {
        price: plan.stripe_price_id,
        quantity: 1,
      },
    ],

    success_url: redirectUrl,
    cancel_url: redirectUrl,
  });

  return ctx.reply(
    `💳 <b>Activate VIP subscription</b>\n\n` +
      `Plan: <b>${plan.name}</b>\n` +
      `Price: ${plan.price} ${plan.currency}\n\n` +
      `👉 <a href="${session.url}">Pay with Stripe</a>\n\n` +
      `Your VIP access will be activated automatically when Stripe confirms the payment.`,
    { parse_mode: "HTML" }
  );
}

module.exports = { startStripeCheckoutForPlan };
