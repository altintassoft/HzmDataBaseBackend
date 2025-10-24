const { pool } = require('../config/database');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const config = require('../config');

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

    // Verify and decode JWT token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      tenant_id: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
      authenticated_via: 'jwt'
    };

    logger.debug(`JWT authenticated: ${decoded.email} (${decoded.role})`);

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
 * API Key + API Password + Email Authentication (for programmatic access)
 * Checks for X-Email, X-API-Key and X-API-Password headers
 * 
 * Usage:
 *   curl -H "X-Email: user@example.com" \
 *        -H "X-API-Key: hzm_xxx" \
 *        -H "X-API-Password: xxx" \
 *        http://...
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const email = req.headers['x-email'];
    const apiKey = req.headers['x-api-key'];
    const apiPassword = req.headers['x-api-password'];

    // Check if all headers exist
    if (!email || !apiKey || !apiPassword) {
      return res.status(401).json({
        success: false,
        error: 'Missing credentials',
        message: 'X-Email, X-API-Key and X-API-Password headers required',
        required: {
          headers: ['X-Email', 'X-API-Key', 'X-API-Password']
        },
        example: {
          'X-Email': 'user@example.com',
          'X-API-Key': 'hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          'X-API-Password': 'your-api-password-here'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
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

    // Query database: Find user by EMAIL first, then verify API Key
    const result = await pool.query(`
      SELECT 
        id,
        tenant_id,
        email,
        role,
        api_key,
        api_password,
        is_active,
        is_deleted
      FROM core.users
      WHERE email = $1
        AND is_active = true
        AND is_deleted = false
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email',
        message: 'User not found with this email or user is inactive'
      });
    }

    const user = result.rows[0];

    // Verify API Key belongs to this user
    if (user.api_key !== apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Key',
        message: 'This API Key does not belong to the provided email'
      });
    }

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

    // Set RLS context (Row Level Security)
    try {
      await pool.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.id]);
      logger.debug(`RLS context set: tenant_id=${user.tenant_id}, user_id=${user.id}`);
    } catch (err) {
      logger.warn('Failed to set RLS context:', err.message);
      // Continue anyway (non-critical)
    }

    // Attach user to request
    req.user = {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
      authenticated_via: 'api_key'
    };

    logger.info(`✅ API Key authenticated: ${user.email} (${user.role}) [tenant_id=${user.tenant_id}]`);

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

