const express = require('express');
const HealthController = require('./health.controller');

const router = express.Router();

/**
 * Health Check Routes
 * Base: /api/v1/health
 * 
 * No authentication required for health checks
 */

router.get('/', HealthController.healthCheck);
router.get('/ready', HealthController.readinessCheck);
router.get('/live', HealthController.livenessCheck);

module.exports = router;


