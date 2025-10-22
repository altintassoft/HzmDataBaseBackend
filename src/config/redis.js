const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// Redis client (optional - graceful degradation)
let redis = null;

if (config.redis.url && config.redis.url !== 'redis://localhost:6379') {
  redis = new Redis(config.redis.url, {
    keyPrefix: config.redis.keyPrefix,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });
} else {
  logger.warn('⚠️  Redis URL not configured - Running without cache');
}

// Handle Redis errors
if (redis) {
  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  redis.on('connect', () => {
    logger.info('✅ Redis connected');
  });
}

// Initialize Redis
const initRedis = async () => {
  if (!redis) {
    logger.warn('⚠️  Redis not configured - Skipping initialization');
    return;
  }

  try {
    await redis.connect();
    await redis.ping();
    logger.info('✅ Redis ping successful');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    logger.warn('⚠️  Continuing without Redis cache');
    redis = null; // Disable redis
  }
};

// Cache helper functions (with graceful fallback)
const cache = {
  async get(key) {
    if (!redis) return null;
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async set(key, value, ttl = config.redis.ttl) {
    if (!redis) return;
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async del(key) {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  },

  async flush(pattern) {
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }
};

module.exports = {
  redis,
  initRedis,
  cache
};

