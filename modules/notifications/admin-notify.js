module.exports = function createAdminNotifier(bot, getSettings) {

  async function notifyAdmin(text) {
    const settings = await getSettings();

    if (!settings.notifications || !settings.notifications.enabled) return;

    const adminId = settings.notifications.adminId || process.env.ADMIN_ID;
    if (!adminId) return;

    try {
      await bot.telegram.sendMessage(adminId, text, { parse_mode: "HTML" });
    } catch (err) {
      console.error("❌ Error sending notification to admin:", err.message);
    }
  }

  return {
    newPurchase(userId, plan) {
      notifyAdmin(
        `🛒 <b>New purchase</b>\n👤 User: <code>${userId}</code>\n📦 Plan: <b>${plan.name}</b>`
      );
    },

    renewal(userId, plan) {
      notifyAdmin(
        `🔄 <b>Automatic renewal</b>\n👤 User: <code>${userId}</code>\n📦 Plan: <b>${plan.name}</b>`
      );
    },

    expired(userId, plan) {
      notifyAdmin(
        `⏳ <b>Subscription expired</b>\n👤 User: <code>${userId}</code>\n📦 Plan: <b>${plan.name}</b>`
      );
    },

    kicked(userId, channelId) {
      notifyAdmin(
        `🚫 <b>Expelled user</b>\n👤 ID: <code>${userId}</code>\n🏷 Channel: <code>${channelId}</code>`
      );
    }
  };
};
