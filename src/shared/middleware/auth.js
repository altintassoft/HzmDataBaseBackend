/**
 * Authentication Middleware
 * 3-layer API Key authentication (Email + Key + Password)
 * JWT authentication for web frontend
 */

const logger = require('../utils/logger');

/**
 * API Key Authentication
 * Headers: X-Email, X-API-Key, X-API-Password
 */
async function authenticateApiKey(req, res, next) {
  try {
    // TODO: Migrate from /middleware/auth.js
    // - Extract headers
    // - Validate email
    // - Validate API key format
    // - Check credentials in database
    // - Set RLS context
    // - Set req.user
    throw new Error('Not implemented yet');
  } catch (error) {
    logger.error('API Key authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
}

/**
 * JWT Authentication
 * Header: Authorization: Bearer <token>
 */
async function authenticateJWT(req, res, next) {
  try {
    // TODO: Migrate from /middleware/auth.js
    // - Extract token
    // - Verify JWT
    // - Set RLS context
    // - Set req.user
    throw new Error('Not implemented yet');
  } catch (error) {
    logger.error('JWT authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
}

/**
 * JWT or API Key Authentication
 * Try JWT first, then API Key
 */
async function authenticateJwtOrApiKey(req, res, next) {
  try {
    // TODO: Implement hybrid authentication
    throw new Error('Not implemented yet');
  } catch (error) {
    logger.error('Hybrid authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
}

/**
 * Require Admin Role
 */
function requireAdmin(req, res, next) {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'master_admin')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Admin role required'
      });
    }
    next();
  } catch (error) {
    logger.error('Require admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Require Master Admin Role
 */
function requireMasterAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'master_admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Master Admin role required'
      });
    }
    next();
  } catch (error) {
    logger.error('Require master admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  authenticateApiKey,
  authenticateJWT,
  authenticateJwtOrApiKey,
  requireAdmin,
  requireMasterAdmin
};


