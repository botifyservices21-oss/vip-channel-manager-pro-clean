// modules/web/auth-links.js
const crypto = require("crypto");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || "CAMBIA_ESTA_CLAVE";

// Firmar datos (HMAC)
function sign(data) {
  return crypto.createHmac("sha256", DASHBOARD_SECRET).update(data).digest("hex");
}

// Crear token con payload { telegramId, role, exp }
function createDashboardToken({ telegramId, role, expiresInSeconds = 3600 }) {
  const payload = {
    telegramId,
    role,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const json = JSON.stringify(payload);
  const base = Buffer.from(json).toString("base64url");
  const signature = sign(base);

  return `${base}.${signature}`;
}

// Verificar token y devolver payload o null
function verifyDashboardToken(token, expectedRole) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [base, signature] = parts;
  const expectedSig = sign(base);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  let payload;
  try {
    const json = Buffer.from(base, "base64url").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (!payload || !payload.telegramId || !payload.role || !payload.exp) {
    return null;
  }

  // Rol
  if (expectedRole && payload.role !== expectedRole) {
    return null;
  }

  // Expiración
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    return null;
  }

  return payload;
}

// URLs que enviaremos por el bot
function createAdminDashboardUrl(telegramId) {
  const token = createDashboardToken({ telegramId, role: "admin", expiresInSeconds: 3600 });
  return `${BASE_URL}/dashboard/admin?t=${encodeURIComponent(token)}`;
}

function createUserDashboardUrl(telegramId) {
  const token = createDashboardToken({ telegramId, role: "user", expiresInSeconds: 3600 });
  return `${BASE_URL}/dashboard/user?t=${encodeURIComponent(token)}`;
}

module.exports = {
  createAdminDashboardUrl,
  createUserDashboardUrl,
  verifyDashboardToken,
};
