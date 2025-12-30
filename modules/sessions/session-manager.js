// modules/sessions/session-manager.js

function ensureSession(ctx) {
  if (!ctx.session) ctx.session = {};
  return ctx.session;
}

module.exports = {
  ensureSession,
};
