const logger = require('../core/logger');

/**
 * Idempotency Middleware - Duplicate Write Protection
 * 
 * @description
 * HAFTA 2 - Generic Handler için idempotency middleware
 * 
 * Prevents duplicate writes (POST, PUT, DELETE) within a time window.
 * 
 * How it works:
 * 1. Client sends 'X-Idempotency-Key' header (UUID)
 * 2. Middleware checks if key exists in cache
 * 3. If exists → return cached response (409 Conflict)
 * 4. If not exists → process request, cache response
 * 
 * Storage:
 * - In-memory (development)
 * - Redis (production - future)
 * 
 * TTL: 24 hours (configurable)
 */

// In-memory cache (production'da Redis kullanılacak)
const cache = new Map();

// Config
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in ms

/**
 * Idempotency checker middleware
 */
function checkIdempotency(req, res, next) {
  const method = req.method;

  // Only apply to write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  const idempotencyKey = req.headers['x-idempotency-key'];

  // If no key provided, skip (optional protection)
  if (!idempotencyKey) {
    logger.debug('Idempotency key not provided', {
      method,
      path: req.originalUrl
    });
    return next();
  }

  // Check cache
  const cacheKey = `${method}:${req.originalUrl}:${idempotencyKey}`;
  const cachedResponse = cache.get(cacheKey);

  if (cachedResponse) {
    // Found duplicate request
    const age = Date.now() - cachedResponse.timestamp;
    logger.warn('Duplicate request detected (idempotency)', {
      method,
      path: req.originalUrl,
      idempotencyKey,
      age: `${Math.round(age / 1000)}s ago`
    });

    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_REQUEST',
      message: 'This request was already processed',
      originalResponse: cachedResponse.response,
      processedAt: new Date(cachedResponse.timestamp).toISOString(),
      ageSeconds: Math.round(age / 1000)
    });
  }

  // Override res.json to cache response
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Cache successful responses (2xx, 3xx)
    if (res.statusCode >= 200 && res.statusCode < 400) {
      cache.set(cacheKey, {
        response: data,
        timestamp: Date.now(),
        statusCode: res.statusCode
      });

      logger.debug('Idempotency response cached', {
        method,
        path: req.originalUrl,
        idempotencyKey,
        statusCode: res.statusCode
      });
    }

    return originalJson(data);
  };

  next();
}

/**
 * Cleanup expired cache entries (periodic)
 */
function cleanupExpiredCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of cache.entries()) {
    const age = now - value.timestamp;
    if (age > IDEMPOTENCY_TTL) {
      cache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Idempotency cache cleanup', {
      cleaned,
      remaining: cache.size
    });
  }
}

// Start cleanup interval
setInterval(cleanupExpiredCache, CLEANUP_INTERVAL);

/**
 * Get cache stats (for monitoring)
 */
function getCacheStats() {
  return {
    size: cache.size,
    ttl: IDEMPOTENCY_TTL,
    oldestEntry: getOldestEntry(),
    newestEntry: getNewestEntry()
  };
}

function getOldestEntry() {
  let oldest = null;
  for (const [key, value] of cache.entries()) {
    if (!oldest || value.timestamp < oldest.timestamp) {
      oldest = value;
    }
  }
  return oldest ? {
    age: Math.round((Date.now() - oldest.timestamp) / 1000),
    timestamp: new Date(oldest.timestamp).toISOString()
  } : null;
}

function getNewestEntry() {
  let newest = null;
  for (const [key, value] of cache.entries()) {
    if (!newest || value.timestamp > newest.timestamp) {
      newest = value;
    }
  }
  return newest ? {
    age: Math.round((Date.now() - newest.timestamp) / 1000),
    timestamp: new Date(newest.timestamp).toISOString()
  } : null;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  const size = cache.size;
  cache.clear();
  logger.info('Idempotency cache cleared', { size });
}

module.exports = {
  checkIdempotency,
  cleanupExpiredCache,
  getCacheStats,
  clearCache
};

