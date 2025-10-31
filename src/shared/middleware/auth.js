/**
 * Shared Authentication Middleware
 * Re-exports from the core middleware/auth.js
 * 
 * This file serves as a compatibility layer for modules using the new structure.
 * The actual implementation is in ../../middleware/auth.js
 */

// Re-export everything from the core auth middleware
const auth = require('../../middleware/auth');

module.exports = {
  authenticateApiKey: auth.authenticateApiKey,
  authenticateJWT: auth.authenticateJWT,
  authenticateJwtOrApiKey: auth.authenticateJwtOrApiKey,
  requireAdmin: auth.requireAdmin,
  requireMasterAdmin: auth.requireMasterAdmin
};


