// modules/ui/helpers.js

/**
 * ============================================================
 * safeEdit(ctx, text, extra)
 * Edita mensaje si existe, si no hace reply.
 * Evita errores de "message is not modified".
 * ============================================================
 */
async function safeEdit(ctx, text, extra = {}) {
  try {
    if (typeof ctx.editMessageText === "function") {
      return await ctx.editMessageText(text, extra);
    }
  } catch (e) {
    if (!e.description?.includes("message is not modified")) {
      console.error("safeEdit error:", e);
    }
  }

  try {
    return await ctx.reply(text, extra);
  } catch (e) {
    console.error("safeEdit reply error:", e);
  }
}


/**
 * ============================================================
 * isAdmin(ctx)
 * Comprueba si el usuario está en process.env.ADMINS
 * ADMINS="111,222,333"
 * ============================================================
 */
function isAdmin(ctx) {
  try {
    if (!ctx?.from?.id) return false;

    const adminsEnv = process.env.ADMINS || "";
    const adminIds = adminsEnv
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    return adminIds.includes(String(ctx.from.id));

  } catch (err) {
    console.error("Error en isAdmin:", err);
    return false;
  }
}


/**
 * ============================================================
 * getPremiumHeader(title)
 * Cabecera estándar con branding opcional
 * ============================================================
 */
function getPremiumHeader(title = "") {
  const brandName = process.env.BRAND_NAME || "VIP Channel Manager Pro";
  return `💎 <b>${brandName} – ${title}</b>\n\n`;
}


/**
 * EXPORTS LIMPIOS
 */
module.exports = {
  safeEdit,
  isAdmin,
  getPremiumHeader
};
