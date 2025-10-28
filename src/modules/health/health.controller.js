const { pool } = require('../../core/config/database');
const { redis } = require('../../core/config/redis');
const logger = require('../../core/logger');

/**
 * Health Controller
 * System health and readiness checks
 */
class HealthController {
  /**
   * GET /api/v1/health
   * Basic health check
   */
  static async healthCheck(req, res) {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/health/ready
   * Readiness check (DB connection, Redis, etc.)
   */
  static async readinessCheck(req, res) {
    try {
      const checks = {
        database: { status: 'unknown', responseTime: 0 },
        redis: { status: 'unknown', responseTime: 0 }
      };

      // Check database connection
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      checks.database = {
        status: 'ok',
        responseTime: Date.now() - dbStart
      };

      // Check Redis (if configured)
      if (redis) {
        const redisStart = Date.now();
        await redis.ping();
        checks.redis = {
          status: 'ok',
          responseTime: Date.now() - redisStart
        };
      } else {
        checks.redis = {
          status: 'not_configured',
          message: 'Redis not available'
        };
      }

      res.json({
        success: true,
        status: 'ready',
        checks,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      });
    } catch (error) {
      logger.error('Readiness check error:', error);
      res.status(503).json({
        success: false,
        status: 'not_ready',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/health/live
   * Liveness check (simple ping)
   */
  static async livenessCheck(req, res) {
    res.json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = HealthController;


