const express = require('express');
const { pool } = require('../core/config/database');
const { redis } = require('../core/config/redis');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    checks: {}
  };

  try {
    // Check database
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart
    };

    // Check Redis (if configured)
    if (redis) {
      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: 'ok',
        responseTime: Date.now() - redisStart
      };
    } else {
      health.checks.redis = {
        status: 'not_configured',
        message: 'Redis not available'
      };
    }

    res.status(200).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;

