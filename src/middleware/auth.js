const { pool } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// 🔐 AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * JWT Token Authentication (for web users)
 * Checks for Authorization: Bearer <token> header
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Authorization header with Bearer token required'
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // TODO: Verify JWT token with jwt.verify()
    // For now, simple token validation
    if (!token || token.length < 20) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // TODO: Decode token and attach user to req.user
    req.user = {
      id: 1,
      email: 'temp@example.com',
      role: 'user'
    };

    next();
  } catch (error) {
    logger.error('JWT authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
};

/**
 * API Key + API Password Authentication (for programmatic access)
 * Checks for X-API-Key and X-API-Password headers
 * 
 * Usage:
 *   curl -H "X-API-Key: hzm_xxx" -H "X-API-Password: xxx" http://...
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const apiPassword = req.headers['x-api-password'];

    // Check if headers exist
    if (!apiKey || !apiPassword) {
      return res.status(401).json({
        success: false,
        error: 'Missing credentials',
        message: 'Both X-API-Key and X-API-Password headers required',
        required: {
          headers: ['X-API-Key', 'X-API-Password']
        },
        example: {
          'X-API-Key': 'hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          'X-API-Password': 'your-api-password-here'
        }
      });
    }

    // Validate API Key format
    if (!apiKey.startsWith('hzm_')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Key format',
        message: 'API Key must start with "hzm_"'
      });
    }

    // Query database for matching API Key
    const result = await pool.query(`
      SELECT 
        id,
        tenant_id,
        email,
        role,
        full_name,
        api_key,
        api_password,
        is_active
      FROM core.users
      WHERE api_key = $1
        AND is_active = true
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Key',
        message: 'API Key not found or user is inactive'
      });
    }

    const user = result.rows[0];

    // Verify API Password (plain text comparison for now)
    // TODO: In production, this should be hashed comparison
    if (user.api_password !== apiPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Password',
        message: 'API Password does not match'
      });
    }

    // Update last_used_at timestamp (async, don't wait)
    pool.query(`
      UPDATE core.users
      SET api_key_last_used_at = NOW()
      WHERE id = $1
    `, [user.id]).catch(err => {
      logger.warn('Failed to update api_key_last_used_at:', err.message);
    });

    // Attach user to request
    req.user = {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      authenticated_via: 'api_key'
    };

    logger.info(`API Key authenticated: ${user.email} (${user.role})`);

    next();
  } catch (error) {
    logger.error('API Key authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
};

/**
 * Master Admin Only Authorization
 * Requires user to have role='master_admin'
 * Use AFTER authenticateApiKey or authenticateJWT
 */
const requireMasterAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'master_admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Master Admin role required',
      yourRole: req.user.role
    });
  }

  next();
};

/**
 * Admin or Master Admin Authorization
 * Requires user to have role='admin' or 'master_admin'
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'master_admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin or Master Admin role required',
      yourRole: req.user.role
    });
  }

  next();
};

module.exports = {
  authenticateJWT,
  authenticateApiKey,
  requireMasterAdmin,
  requireAdmin
};

