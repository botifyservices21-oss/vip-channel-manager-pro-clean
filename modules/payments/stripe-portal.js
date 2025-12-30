const Stripe = require("stripe");
const { getPaymentSettings, listAllSubscriptions } = require("../../services/mongo.js");

/**
 * Abre el Customer Portal de Stripe para que el usuario:
 * - Cambie tarjeta
 * - Gestione plan
 * - Cancele
 * - Vea facturas
 */
async function openStripeCustomerPortal(ctx) {
  const settings = await getPaymentSettings();

  if (!settings.stripe_secret_key) {
    return ctx.reply("❌ Stripe is not configured.");
  }

  const stripe = Stripe(settings.stripe_secret_key);

  const userId = ctx.from.id;

  // 🔧 FIX: listAllSubscriptions ahora es async
  const subs = await listAllSubscriptions();
  const active = subs.find(s => s.userId === userId && s.active);

  if (!active || !active.stripeCustomerId) {
    return ctx.reply(
      "⚠️ We couldn't find your subscription on Stripe.\nContact the administrator."
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: active.stripeCustomerId,
    return_url: "https://t.me/" + ctx.botInfo.username,
  });

  return ctx.reply(
    "🔧 <b>Manage your subscription here:</b>\n" + session.url,
    { parse_mode: "HTML" }
  );
}

module.exports = { openStripeCustomerPortal };
