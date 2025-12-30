const { collections } = require("../db");
const { getSettings } = require("../services/mongo");

module.exports = function createPostScheduler(bot) {
  return async function runScheduler() {
    try {
      console.log("⏱ CRON: Revisando posts programados...");

      // Obtener timezone desde ajustes del panel admin
      const settings = await getSettings();
      const tz = settings.timezone || "Europe/Madrid";

      // Hora actual según la zona horaria elegida
      const nowLocal = new Date().toLocaleString("en-US", { timeZone: tz });
      const now = new Date(nowLocal).getTime();

      console.log("NOW:", now, new Date(now).toString());

      // Posts que deben enviarse
      const duePosts = await collections.scheduledPosts
        .find({
          sent: false,
          date: { $lte: now }
        })
        .toArray();

      console.log("DUE POSTS:", duePosts.length);

      for (const p of duePosts) {
        try {
          await bot.telegram.sendMessage(p.channelId, p.text);

          await collections.scheduledPosts.updateOne(
            { _id: p._id },
            { $set: { sent: true, sentAt: Date.now() } }
          );

          console.log("✔ ENVIADO:", p._id.toString());

        } catch (err) {
          console.error("❌ Error enviando post:", err);
        }
      }
    } catch (err) {
      console.error("❌ Error CRON posts:", err);
    }
  };
};
