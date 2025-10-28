// Middleware Barrel Export
const auth = require('./auth');

module.exports = {
  authenticateJWT: auth.authenticateJWT,
  authenticateApiKey: auth.authenticateApiKey,
  authenticateJwtOrApiKey: auth.authenticateJwtOrApiKey,
  requireMasterAdmin: auth.requireMasterAdmin,
  requireAdmin: auth.requireAdmin,
};

