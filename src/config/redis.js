const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// Redis client
const redis = new Redis(config.redis.url, {
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

// Handle Redis errors
redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

// Initialize Redis
const initRedis = async () => {
  try {
    await redis.ping();
    logger.info('Redis ping successful');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Cache helper functions
const cache = {
  async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async set(key, value, ttl = config.redis.ttl) {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async del(key) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  },

  async flush(pattern) {
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

