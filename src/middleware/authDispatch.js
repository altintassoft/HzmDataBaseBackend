/**
 * Auth Dispatch Middleware
 * 
 * Hybrid authentication dispatcher with feature-flagged resource-scoped profiles
 * 
 * Phase 1 (NOW): Simple hybrid (JWT OR API Key) - backward compatible
 * Phase 4 (LATER): Resource-scoped auth profiles (JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY)
 * 
 * @see BACKEND_PHASE_PLAN.md - Phase 4.7: Resource-Scoped Auth Profiles
 */

const config = require('../core/config');
const logger = require('../core/logger');

/**
 * Auth Dispatch - Main entry point
 * 
 * Determines authentication strategy based on feature flag:
 * - ENABLE_AUTH_PROFILES=false (default): Simple hybrid (JWT OR API Key)
 * - ENABLE_AUTH_PROFILES=true (Phase 4): Resource-scoped profiles
 */
async function authDispatch(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Extract credentials from headers
    const bearer = extractJWT(req);
    const apiKeyData = extractAPIKey(req);
    
    // Phase 1: Simple Hybrid (backward compatible, feature flag OFF)
    if (!config.features?.enableAuthProfiles) {
      return await simpleHybridAuth(req, res, next, bearer, apiKeyData);
    }
    
    // Phase 4: Resource-Scoped Auth (feature flag ON)
    return await resourceScopedAuth(req, res, next, bearer, apiKeyData);
    
  } catch (error) {
    logger.error('authDispatch error:', {
      error: error.message,
      path: req.path,
      duration: Date.now() - startTime
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_INTERNAL_ERROR',
        message: 'Authentication system error'
      }
    });
  }
}

/**
 * Phase 1: Simple Hybrid Auth (JWT OR API Key)
 * 
 * Accepts either JWT (Authorization: Bearer) or API Key (X-API-Key + X-API-Password)
 * This maintains backward compatibility with existing frontend/integrations
 */
async function simpleHybridAuth(req, res, next, bearer, apiKeyData) {
  // Try JWT first
  if (bearer) {
    try {
      const jwtAuth = await verifyJWT(bearer, req);
      if (jwtAuth) {
        req.auth = { type: 'jwt', ...jwtAuth };
        req.user = jwtAuth.user;
        req.tenant_id = jwtAuth.tenant_id;
        logger.debug('Auth: JWT accepted', { user_id: jwtAuth.user.id });
        return next();
      }
    } catch (error) {
      logger.warn('JWT verification failed:', error.message);
      // Continue to try API Key
    }
  }
  
  // Try API Key
  if (apiKeyData.hasCredentials) {
    try {
      const keyAuth = await verifyAPIKey(apiKeyData, req);
      if (keyAuth) {
        req.auth = { type: 'apikey', ...keyAuth };
        req.user = keyAuth.user;
        req.tenant_id = keyAuth.tenant_id;
        logger.debug('Auth: API Key accepted', { key_id: keyAuth.key_id });
        return next();
      }
    } catch (error) {
      logger.warn('API Key verification failed:', error.message);
    }
  }
  
  // Neither JWT nor API Key valid
  return res.status(401).json({
    success: false,
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      hint: 'Provide either JWT (Authorization: Bearer TOKEN) or API Key (X-API-Key + X-API-Password)'
    }
  });
}

/**
 * Phase 4: Resource-Scoped Auth (Profile-based)
 * 
 * Enforces auth_profile rules from api_resources table:
 * - JWT_ONLY: Only JWT accepted
 * - APIKEY_ONLY: Only API Key accepted
 * - EITHER: JWT or API Key
 * - JWT_AND_APIKEY: Both required (2-factor auth for admin operations)
 */
async function resourceScopedAuth(req, res, next, bearer, apiKeyData) {
  // Load resource metadata
  const registry = require('../core/services/registry');
  const resource = await registry.getResource(req);
  
  if (!resource) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND' }
    });
  }
  
  const profile = resource.auth_profile || 'EITHER';
  
  // Verify credentials based on profile
  const hasJWT = bearer && await verifyJWT(bearer, req);
  const hasKey = apiKeyData.hasCredentials && await verifyAPIKey(apiKeyData, req);
  
  // Validate auth profile
  const authOk = validateAuthProfile(profile, hasJWT, hasKey);
  
  if (!authOk) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_PROFILE_MISMATCH',
        message: `Resource requires: ${profile}`,
        provided: {
          jwt: !!hasJWT,
          apiKey: !!hasKey
        }
      }
    });
  }
  
  // HMAC verification (if required)
  if (resource.require_hmac) {
    const hmacValid = await verifyHMAC(req);
    if (!hmacValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_HMAC_REQUIRED',
          message: 'HMAC signature required (X-Timestamp, X-Nonce, X-Signature)'
        }
      });
    }
  }
  
  // IP allowlist check
  if (resource.ip_allowlist && resource.ip_allowlist.length > 0) {
    const ipAllowed = await checkIPAllowlist(req.ip, resource.ip_allowlist);
    if (!ipAllowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHZ_IP_NOT_ALLOWED',
          message: 'IP address not in allowlist'
        }
      });
    }
  }
  
  // Set auth context (prefer JWT if both exist)
  req.auth = hasJWT ? { type: 'jwt', ...hasJWT } : { type: 'apikey', ...hasKey };
  req.user = req.auth.user;
  req.tenant_id = req.auth.tenant_id;
  
  logger.debug('Auth: Resource-scoped profile matched', {
    resource: resource.name,
    profile,
    auth_type: req.auth.type
  });
  
  return next();
}

/**
 * Extract JWT from Authorization header
 */
function extractJWT(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove 'Bearer ' prefix
  }
  return null;
}

/**
 * Extract API Key credentials from headers
 */
function extractAPIKey(req) {
  const email = req.headers['x-email'];
  const apiKey = req.headers['x-api-key'];
  const apiPassword = req.headers['x-api-password'];
  
  return {
    email,
    apiKey,
    apiPassword,
    hasCredentials: !!(email && apiKey && apiPassword)
  };
}

/**
 * Verify JWT token
 */
async function verifyJWT(token, req) {
  const jwt = require('jsonwebtoken');
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Token should have user and tenant_id
    if (!decoded.user || !decoded.tenant_id) {
      logger.warn('JWT missing required claims', { decoded });
      return null;
    }
    
    return {
      user: decoded.user,
      tenant_id: decoded.tenant_id,
      token_id: decoded.jti,
      expires_at: decoded.exp
    };
  } catch (error) {
    logger.debug('JWT verification failed:', error.message);
    return null;
  }
}

/**
 * Verify API Key credentials
 */
async function verifyAPIKey(apiKeyData, req) {
  const db = require('../core/database');
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  
  const { email, apiKey, apiPassword } = apiKeyData;
  
  // Hash the API key (SHA-256)
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  // Query database
  const result = await db.query(`
    SELECT 
      ak.id, ak.key_hash, ak.api_password_hash, ak.scopes, ak.is_active,
      u.id as user_id, u.email, u.tenant_id, u.role
    FROM core.api_keys ak
    JOIN core.users u ON ak.user_id = u.id
    WHERE u.email = $1 AND ak.key_hash = $2 AND ak.is_active = TRUE AND u.is_deleted = FALSE
  `, [email, keyHash]);
  
  if (result.rows.length === 0) {
    logger.warn('API Key not found', { email, keyHash: keyHash.substring(0, 8) });
    return null;
  }
  
  const key = result.rows[0];
  
  // Verify password
  const passwordMatch = await bcrypt.compare(apiPassword, key.api_password_hash);
  if (!passwordMatch) {
    logger.warn('API Key password mismatch', { email });
    return null;
  }
  
  return {
    user: {
      id: key.user_id,
      email: key.email,
      role: key.role
    },
    tenant_id: key.tenant_id,
    key_id: key.id,
    scopes: key.scopes
  };
}

/**
 * Validate auth profile requirements
 */
function validateAuthProfile(profile, hasJWT, hasKey) {
  switch (profile) {
    case 'JWT_ONLY':
      return hasJWT && !hasKey; // Only JWT
    case 'APIKEY_ONLY':
      return !hasJWT && hasKey; // Only API Key
    case 'EITHER':
      return hasJWT || hasKey;  // JWT or API Key
    case 'JWT_AND_APIKEY':
      return hasJWT && hasKey;  // Both required (2FA)
    default:
      logger.warn('Unknown auth profile:', profile);
      return false;
  }
}

/**
 * Verify HMAC signature (Phase 4+)
 */
async function verifyHMAC(req) {
  // TODO: Implement HMAC verification
  // - Extract X-Timestamp, X-Nonce, X-Signature
  // - Check timestamp within 300s
  // - Check nonce not in Redis (replay protection)
  // - Verify HMAC-SHA256 signature
  logger.debug('HMAC verification (not yet implemented)');
  return true; // Temporarily pass
}

/**
 * Check IP allowlist (Phase 4+)
 */
async function checkIPAllowlist(clientIP, allowlist) {
  // TODO: Implement CIDR matching
  // - Parse CIDR ranges
  // - Check if clientIP in any range
  logger.debug('IP allowlist check (not yet implemented)', { clientIP, allowlist });
  return true; // Temporarily pass
}

module.exports = {
  authDispatch
};

