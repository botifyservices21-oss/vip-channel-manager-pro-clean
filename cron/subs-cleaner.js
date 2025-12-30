// cron/subs-cleaner.js
module.exports = function createSubscriptionCleaner(bot, { getUserSubscriptions, updateSubscription, listAllSubscriptions }) {
  return async function runSubscriptionCleaner() {
    try {
      const now = Date.now();
      const subs = await listAllSubscriptions();

      for (const s of subs) {
        if (!s.active) continue;

        if (s.endAt <= now) {
          console.log(`⚠️ Suscripción expirada → Usuario ${s.userId}, canal ${s.channelId}`);

          // 1) marcar como inactiva
          await updateSubscription(s.userId, { active: false });

          // 2) expulsar del canal
          if (bot && s.channelId) {
            try {
              await bot.telegram.banChatMember(s.channelId, s.userId);
              await bot.telegram.unbanChatMember(s.channelId, s.userId);
              console.log(`⛔ Usuario ${s.userId} expulsado del canal ${s.channelId}`);
            } catch (err) {
              console.error("❌ Error expulsando del canal:", err.message);
            }
          }

          // 3) notificar al usuario
          try {
            await bot.telegram.sendMessage(
              s.userId,
              `⚠️ <b>Tu suscripción VIP ha expirado.</b>\n\n` +
              `Si deseas continuar con el acceso VIP, puedes renovar desde el menú del bot.`,
              { parse_mode: "HTML" }
            );
          } catch (err) {
            console.error("❌ Error notificando al usuario:", err.message);
          }
        }
      }

      console.log("✔ Cron de expiración ejecutado correctamente.");
    } catch (err) {
      console.error("❌ Error ejecutando cron de expiración:", err);
    }
  };
};
