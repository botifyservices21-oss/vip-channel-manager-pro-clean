const Stripe = require("stripe");
const { getPaymentSettings } = require("../../services/mongo.js");

module.exports = async function createStripeCheckout(plan, userId) {
  const settings = await getPaymentSettings();

  if (!settings || !settings.stripe_secret_key) {
    throw new Error("Stripe not configured");
  }

  const stripe = Stripe(settings.stripe_secret_key);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: plan.stripe_price_id,
        quantity: 1,
      },
    ],
    metadata: {
      telegram_user_id: userId,
      plan_id: plan.id,
      channel_id: plan.channelId || "",
    },
    success_url: "https://t.me/" + process.env.BOT_USERNAME,
    cancel_url: "https://t.me/" + process.env.BOT_USERNAME,
  });

  return session.url;
};
