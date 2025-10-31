/**
 * Auth Dispatch Middleware (ENTERPRISE HARDENED)
 * 
 * Hybrid authentication dispatcher with feature-flagged resource-scoped profiles
 * 
 * Phase 1 (NOW): Simple hybrid (JWT OR API Key) - backward compatible
 * Phase 4 (LATER): Resource-scoped auth profiles (JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY)
 * 
 * ENTERPRISE SECURITY (31 Oct 2025):
 * - JWT: Algorithm whitelist (HS256), issuer/audience validation, clock tolerance
 * - API Key: Email-free lookup (key_hash only), user suspension checks
 * - Logging: Zero token/key leakage (length-only, redacted previews in dev)
 * - Context: Enriched for RBAC (scopes) & Rate Limiting (subject_id)
 * - Error Responses: Standardized format (request_id, timestamp, structured error)
 * 
 * @see BACKEND_PHASE_PLAN.md - Phase 4.7: Resource-Scoped Auth Profiles
 */

const config = require('../core/config');
const logger = require('../core/logger');
const { pool } = require('../core/config/database');

/**
 * Auth Dispatch - Main entry point
 * 
 * ENTERPRISE-GRADE: Double-gated feature flag + deterministic flow
 * 
 * Feature Flag Strategy (Double-Gate):
 * - ENV flag (ENABLE_AUTH_PROFILES): Application-level control
 * - DB flag (cfg.feature_flags): Database-level control
 * - Enforcement ONLY if BOTH flags are TRUE
 * 
 * Deterministic Flow (Error Code Consistency):
 * 1. Auth Profile Check → 401 (AUTH_PROFILE_MISMATCH)
 * 2. HMAC Verification → 401 (AUTH_HMAC_REQUIRED/AUTH_HMAC_INVALID)
 * 3. IP Allowlist → 403 (AUTHZ_IP_NOT_ALLOWED)
 * 4. RBAC → 403 (AUTHZ_PERMISSION_DENIED)
 * 5. Rate Limit → 429 (RATE_LIMIT_EXCEEDED)
 */
async function authDispatch(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Extract credentials from headers
    const bearer = extractJWT(req);
    const apiKeyData = extractAPIKey(req);
    
    // ENTERPRISE: Double-gated feature flag check
    const envFlagEnabled = config.features?.enableAuthProfiles || false;
    const dbFlagEnabled = await checkDBFeatureFlag('ENABLE_AUTH_PROFILES');
    const profileEnforcementActive = envFlagEnabled && dbFlagEnabled;
    
    logger.debug('authDispatch: Feature flags', { 
      env: envFlagEnabled, 
      db: dbFlagEnabled, 
      enforcement: profileEnforcementActive 
    });
    
    // Phase 1: Simple Hybrid (backward compatible, enforcement OFF)
    if (!profileEnforcementActive) {
      return await simpleHybridAuth(req, res, next, bearer, apiKeyData);
    }
    
    // Phase 4: Resource-Scoped Auth (enforcement ON)
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
        
        // ENTERPRISE: Enrich context for RBAC & Rate Limiting
        req.subject_id = jwtAuth.user.id;
        req.scopes = jwtAuth.scopes || [];
        
        logger.debug('Auth: JWT accepted', { user_id: jwtAuth.user.id, subject_id: req.subject_id });
        return next();
      }
    } catch (error) {
      logger.warn('JWT verification failed', { reason: error.message });
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
        
        // ENTERPRISE: Enrich context for RBAC & Rate Limiting
        req.subject_id = keyAuth.key_id; // Rate limit by key_id for API Keys
        req.scopes = keyAuth.scopes || [];
        
        logger.debug('Auth: API Key accepted', { key_id: keyAuth.key_id, subject_id: req.subject_id });
        return next();
      }
    } catch (error) {
      logger.warn('API Key verification failed', { reason: error.message });
    }
  }
  
  // Neither JWT nor API Key valid - STANDARDIZED ERROR RESPONSE
  return res.status(401).json({
    error: { 
      code: 'AUTH_REQUIRED', 
      message: 'Authentication required',
      hint: 'Provide JWT (Authorization: Bearer TOKEN) or API Key (X-API-Key + X-API-Password)'
    },
    request_id: req.id || req.headers['x-request-id'],
    timestamp: new Date().toISOString()
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
      error: {
        code: 'AUTH_PROFILE_MISMATCH',
        message: `Resource requires: ${profile}`,
        required: profile,
        provided: { jwt: !!hasJWT, apiKey: !!hasKey }
      },
      request_id: req.id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
  }
  
  // HMAC verification (if required)
  if (resource.require_hmac) {
    const hmacValid = await verifyHMAC(req);
    if (!hmacValid) {
      return res.status(401).json({
        error: {
          code: 'AUTH_HMAC_REQUIRED',
          message: 'HMAC signature required',
          hint: 'Provide X-Timestamp, X-Nonce, X-Signature headers'
        },
        request_id: req.id || req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // IP allowlist check
  if (resource.ip_allowlist && resource.ip_allowlist.length > 0) {
    const ipAllowed = await checkIPAllowlist(req.ip, resource.ip_allowlist);
    if (!ipAllowed) {
      return res.status(403).json({
        error: {
          code: 'AUTHZ_IP_NOT_ALLOWED',
          message: 'IP address not in allowlist'
        },
        request_id: req.id || req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Set auth context (prefer JWT if both exist)
  req.auth = hasJWT ? { type: 'jwt', ...hasJWT } : { type: 'apikey', ...hasKey };
  req.user = req.auth.user;
  req.tenant_id = req.auth.tenant_id;
  
  // ENTERPRISE: Enrich context for RBAC & Rate Limiting
  req.subject_id = hasJWT ? hasJWT.user.id : hasKey.key_id; // Rate limit subject
  req.scopes = req.auth.scopes || [];                       // For RBAC checks
  
  logger.debug('Auth: Resource-scoped profile matched', {
    resource: resource.name,
    profile,
    auth_type: req.auth.type,
    subject_id: req.subject_id
  });
  
  return next();
}

/**
 * Extract JWT from Authorization header
 * 
 * SECURITY: Never log token content (even partial) - token leak prevention
 */
function extractJWT(req) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    logger.debug('extractJWT: Token present', { length: token.length });
    return token;
  }
  
  logger.debug('extractJWT: No Bearer token');
  return null;
}

/**
 * Extract API Key credentials from headers
 * 
 * SECURITY: No email required (prevents identity leak + spoof)
 * Key is opaque, we find user from key_hash
 */
function extractAPIKey(req) {
  const apiKey = req.headers['x-api-key'];
  const apiPassword = req.headers['x-api-password'];
  const email = req.headers['x-email']; // Optional (backward compat, not used for auth)
  
  return {
    apiKey,
    apiPassword,
    email, // Optional, for logging/audit only
    hasCredentials: !!(apiKey && apiPassword) // Email NOT required!
  };
}

/**
 * Verify JWT token
 * 
 * ENTERPRISE SECURITY:
 * - Algorithm whitelist (prevent alg confusion attacks)
 * - Issuer/Audience validation
 * - Clock tolerance
 * - JTI revocation check (TODO: Redis/DB blacklist)
 */
async function verifyJWT(token, req) {
  const jwt = require('jsonwebtoken');
  
  try {
    // JWT verification options (SECURITY HARDENED)
    const opts = {
      algorithms: ['HS256'],                            // Whitelist only allowed algorithms
      issuer: process.env.JWT_ISSUER || 'hzm.backend', // Validate issuer
      audience: process.env.JWT_AUDIENCE || 'hzm.api', // Validate audience
      clockTolerance: 5                                 // Allow 5s clock skew
    };
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET, opts);
    
    // Token should have userId and tenantId (from /auth/login)
    if (!decoded.userId || !decoded.tenantId) {
      logger.warn('JWT missing required claims', { 
        hasUserId: !!decoded.userId, 
        hasTenantId: !!decoded.tenantId 
      });
      return null;
    }
    
    // TODO: Check JTI blacklist (logout/rotation)
    // if (decoded.jti) {
    //   const isRevoked = await checkJTIBlacklist(decoded.jti);
    //   if (isRevoked) {
    //     logger.warn('JWT revoked', { jti: decoded.jti });
    //     return null;
    //   }
    // }
    
    // Normalize to consistent format
    const user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    logger.debug('verifyJWT: Valid', { user_id: user.id, tenant_id: decoded.tenantId });
    
    return {
      user,
      tenant_id: decoded.tenantId,
      token_id: decoded.jti,
      expires_at: decoded.exp,
      scopes: decoded.scopes || [] // For RBAC
    };
  } catch (error) {
    logger.warn('JWT verification failed', { 
      reason: error.message,
      name: error.name // JsonWebTokenError, TokenExpiredError, NotBeforeError
    });
    return null;
  }
}

/**
 * Verify API Key credentials
 * 
 * SECURITY IMPROVEMENTS:
 * - No email required (find user by key_hash only)
 * - Check user suspension status
 * - Never log full key_hash (max 8 chars preview in dev mode)
 */
async function verifyAPIKey(apiKeyData, req) {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  
  const { apiKey, apiPassword, email } = apiKeyData;
  
  // Hash the API key (SHA-256)
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  // Query database (NO email required, find by key_hash only)
  const result = await pool.query(`
    SELECT 
      ak.id, ak.key_hash, ak.api_password_hash, ak.scopes, ak.is_active,
      u.id as user_id, u.email, u.tenant_id, u.role, u.is_deleted,
      COALESCE(u.is_suspended, FALSE) as is_suspended
    FROM core.api_keys ak
    JOIN core.users u ON ak.user_id = u.id
    WHERE ak.key_hash = $1 AND ak.is_active = TRUE
  `, [keyHash]);
  
  if (result.rows.length === 0) {
    logger.warn('API Key not found', { 
      keyPreview: config.isDevelopment ? keyHash.substring(0, 8) : '[REDACTED]'
    });
    return null;
  }
  
  const key = result.rows[0];
  
  // Check user status (deleted or suspended)
  if (key.is_deleted || key.is_suspended) {
    logger.warn('API Key user inactive', { 
      user_id: key.user_id, 
      deleted: key.is_deleted, 
      suspended: key.is_suspended 
    });
    return null;
  }
  
  // Verify password
  const passwordMatch = await bcrypt.compare(apiPassword, key.api_password_hash);
  if (!passwordMatch) {
    logger.warn('API Key password mismatch', { key_id: key.id });
    return null;
  }
  
  // Optional: Validate email if provided (audit/logging only, not for auth)
  if (email && key.email !== email) {
    logger.warn('API Key email mismatch (non-blocking)', { 
      provided: email, 
      actual: key.email 
    });
    // Don't fail, email is optional
  }
  
  return {
    user: {
      id: key.user_id,
      email: key.email,
      role: key.role
    },
    tenant_id: key.tenant_id,
    key_id: key.id,
    scopes: key.scopes || []
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

/**
 * Check DB-level feature flag (double-gate with ENV flag)
 * 
 * ENTERPRISE: Database-level feature flag for profile enforcement
 * Cached for 60 seconds to avoid excessive DB queries
 */
let featureFlagCache = {};
const CACHE_TTL = 60000; // 60 seconds

async function checkDBFeatureFlag(flagKey) {
  const now = Date.now();
  
  // Check cache
  if (featureFlagCache[flagKey] && (now - featureFlagCache[flagKey].timestamp < CACHE_TTL)) {
    return featureFlagCache[flagKey].value;
  }
  
  try {
    const result = await pool.query(`
      SELECT enabled 
      FROM cfg.feature_flags 
      WHERE key = $1
    `, [flagKey]);
    
    const enabled = result.rows.length > 0 ? result.rows[0].enabled : false;
    
    // Update cache
    featureFlagCache[flagKey] = {
      value: enabled,
      timestamp: now
    };
    
    return enabled;
  } catch (error) {
    logger.warn('checkDBFeatureFlag error:', { error: error.message, flagKey });
    // Fail-safe: return false if DB query fails
    return false;
  }
}

module.exports = {
  authDispatch
};

