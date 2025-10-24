# 🛡️ Rate Limiting Implementation

> **Redis-based rate limiting: Per-tenant, per-API-key, burst allowance**

[Ana Sayfa](../README.md) | [Security](01_Security_Auth.md)

---

## Redis Rate Limiter

```javascript
// src/middleware/rateLimiter.js
const redis = require('../config/redis');

const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requests per window
    keyGenerator = (req) => req.user?.id || req.ip
  } = options;

  return async (req, res, next) => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const count = await redis.zcard(key);

      if (count >= max) {
        const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = parseInt(oldestEntry[1]) + windowMs;
        
        res.set('X-RateLimit-Limit', max);
        res.set('X-RateLimit-Remaining', 0);
        res.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
        
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((resetTime - now) / 1000)
        });
      }

      // Add current request
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, Math.ceil(windowMs / 1000));

      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', max - count - 1);

      next();
    } catch (error) {
      // Fallback: allow request if Redis fails
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

module.exports = rateLimiter;
```

### Usage

```javascript
// Per-tenant limit
app.use('/api', rateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `tenant:${req.user?.tenant_id}`
}));

// Per-API-key limit
app.use('/api/data', rateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: (req) => `apikey:${req.headers['x-api-key']}`
}));

// Per-IP limit (public endpoints)
app.use('/api/auth', rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip
}));
```

**[Ana Sayfa](../README.md) | [Security](01_Security_Auth.md)**


