const express = require('express');
const { pool } = require('../config/database');
const { redis } = require('../config/redis');

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

    // Check Redis
    const redisStart = Date.now();
    await redis.ping();
    health.checks.redis = {
      status: 'ok',
      responseTime: Date.now() - redisStart
    };

    res.status(200).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;

