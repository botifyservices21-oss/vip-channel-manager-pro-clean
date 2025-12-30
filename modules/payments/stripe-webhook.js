// modules/payments/stripe-webhook.js
const Stripe = require("stripe");

const {
  createSubscription,
  getPlanById,
  extendSubscriptionPeriod,
  getPaymentSettings,
} = require("../../services/mongo.js");

module.exports = function createStripeWebhook(bot, vipAccess) {
  return async function stripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];

    const settings = await getPaymentSettings();
    if (
      !settings ||
      !settings.stripe_secret_key ||
      !settings.stripe_webhook_secret
    ) {
      console.error("❌ Stripe is not configured in MongoDB.");
      return res.status(500).send("Stripe not configured");
    }

    const stripe = Stripe(settings.stripe_secret_key);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        settings.stripe_webhook_secret
      );
    } catch (err) {
      console.error("❌ Invalid Stripe webhook:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("📩 Stripe webhook received:", event.type);

    // ------------------------------------------------------
    // 🟢 PAGO INICIAL
    // ------------------------------------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const m = session.metadata || {};

      console.log("🔍 session.metadata:", m);

      const telegramId = Number(m.telegram_user_id);
      const planId = m.plan_id;

      const metaChannelId = m.channel_id;
      const channelIdFromMeta =
        metaChannelId && metaChannelId !== "null" && metaChannelId !== "undefined"
          ? Number(metaChannelId)
          : null;

      if (!telegramId || !planId) {
        console.warn("⚠️ Telegram_user_id or plan_id metadata is missing");
        return res.send("OK");
      }

      const plan = await getPlanById(planId); // 🔧 FIX await
      if (!plan) {
        console.warn("⚠️ Plan not found in Mongo:", planId);
        return res.send("OK");
      }

      const finalChannelId = channelIdFromMeta || plan.channelId || null;

      console.log("🧩 Destined channel:", finalChannelId);

      // 🔧 CREAR SUBSCRIPCIÓN EN MONGO
      const now = Date.now();
      const duration = plan.durationDays * 24 * 3600 * 1000;

      const sub = await createSubscription({
        userId: String(telegramId),
        planId: plan.id,
        planName: plan.name,
        channelId: finalChannelId,
        startAt: now,
        endAt: now + duration,
        active: true,
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
      });

      console.log("✔ Subscripción creada:", sub);

      if (bot && finalChannelId) {
        try {
          await vipAccess.giveVipAccess(telegramId, finalChannelId);
        } catch (err) {
          console.error("❌ Error granting VIP access:", err.message);
        }
      }
      if (settings.notifications?.onPurchase) {
        notifier.newPurchase(telegramId, plan);
      }

      return res.send("OK");
    }

    // ------------------------------------------------------
    // 🔄 RENOVACIONES AUTOMÁTICAS
    // ------------------------------------------------------
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;

      const lineMeta = invoice.lines?.data?.[0]?.metadata || {};
      const meta = invoice.metadata || {};

      const telegramId = Number(
        lineMeta.telegram_user_id || meta.telegram_user_id
      );

      const planId = lineMeta.plan_id || meta.plan_id;

      if (!telegramId || !planId) return res.send("OK");

      const plan = await getPlanById(planId); // 🔧 FIX await
      if (!plan) return res.send("OK");

      console.log("🔄 Extending subscription for:", telegramId);

      await extendSubscriptionPeriod(telegramId, plan);
      if (settings.notifications?.onRenew) {
        notifier.renewal(telegramId, plan);
      }

      return res.send("OK");
    }

    return res.send("OK");
  };
};
