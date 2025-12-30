// config.js
module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || "PON_AQUI_TU_TOKEN",
  // IDs de Telegram que pueden ver el panel admin completo
  ADMIN_IDS: [
    123456789 // sustituye por tu ID de Telegram
  ],
  DB_PATH: "./data/db.json",

  // Config por defecto para el comprador (se puede exponer luego en Ajustes)
  DEFAULT_SETTINGS: {
    timezone: "Europe/Madrid",
    graceDays: 3,
    supportContact: "@anfosso"
  }
};
