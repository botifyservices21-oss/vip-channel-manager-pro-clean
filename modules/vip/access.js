// modules/vip/access.js
module.exports = function createVipAccess(bot) {
  return {
    async giveVipAccess(userId, channelId) {
      try {
        console.log("⛩ Dando acceso VIP a:", userId, "→ canal:", channelId);

        // 1. Enviar enlace directo del canal
        const inviteLink = await bot.telegram.createChatInviteLink(channelId, {
          expire_date: Math.floor(Date.now() / 1000) + 3600,
          member_limit: 1
        });

        // 2. Mandar mensaje de bienvenida al usuario
        await bot.telegram.sendMessage(
          userId,
          `🎉 *Welcome to the VIP channel!*  
You can now access it using this link:
\n${inviteLink.invite_link}`,
          { parse_mode: "Markdown" }
        );

        console.log("✔ VIP access successfully granted");
        return true;

      } catch (err) {
        console.error("❌ Error en giveVipAccess():", err);
        return false;
      }
    }
  };
};
