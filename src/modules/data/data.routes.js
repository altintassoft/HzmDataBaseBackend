const express = require('express');
const DataController = require('./data.controller');
const { authDispatch } = require('../../middleware/authDispatch'); // A+ Plan: Hybrid auth
const { trackRequest } = require('../../middleware/metrics');
const { checkIdempotency } = require('../../middleware/idempotency');

const router = express.Router();

/**
 * Generic Data Operations Routes
 * Base: /api/v1/data
 * 
 * HAFTA 2 - Generic Handler Implementation
 * A+ PLAN - Resource-Scoped Auth Profiles (Migration 020)
 * 
 * Middleware chain:
 * 1. trackRequest - Metrics tracking
 * 2. authDispatch - Hybrid auth (JWT OR API Key, feature-flagged)
 * 3. checkIdempotency - Duplicate write protection (POST/PUT/DELETE)
 * 4. DataController - CRUD operations
 * 
 * Authentication Strategy:
 * - Phase 1 (NOW): Simple hybrid (JWT OR API Key) - backward compatible
 * - Phase 4 (LATER): Resource-scoped profiles (JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY)
 * - Feature Flag: ENABLE_AUTH_PROFILES (default: false)
 * 
 * Security:
 * - All resources require is_enabled=true (403 if disabled)
 * - Authentication required for all data operations
 * - Special endpoints (_metrics, _health) are public
 */

// Apply global middleware for all routes
router.use(trackRequest);

// ============================================================================
// SPECIAL ENDPOINTS (Week 4) - MUST BE BEFORE GENERIC ROUTES
// ============================================================================

/**
 * GET /api/v1/data/_metrics
 * Get metrics dashboard data
 * 
 * Returns:
 * - Request count per resource
 * - Response time stats
 * - Error rate
 * - Top resources
 * 
 * Public endpoint (no auth required)
 */
router.get('/_metrics', DataController.getMetrics);

/**
 * GET /api/v1/data/_health
 * Health check for generic handler
 * 
 * Returns:
 * - Database connection status
 * - Active resources count
 * - System uptime
 * 
 * Public endpoint (no auth required)
 */
router.get('/_health', DataController.getHealth);

// ============================================================================
// GENERIC CRUD OPERATIONS (ORDER MATTERS!)
// More specific routes first, then generic ones
// ============================================================================

router.post('/:resource/batch', authDispatch, checkIdempotency, DataController.batchCreate);
router.put('/:resource/batch', authDispatch, checkIdempotency, DataController.batchUpdate);
router.delete('/:resource/batch', authDispatch, checkIdempotency, DataController.batchDelete);
router.post('/:resource/search', authDispatch, DataController.search);
router.get('/:resource/count', authDispatch, DataController.count);

// Single resource operations
router.get('/:resource', authDispatch, DataController.list);
router.post('/:resource', authDispatch, checkIdempotency, DataController.create);
router.get('/:resource/:id', authDispatch, DataController.getById);
router.put('/:resource/:id', authDispatch, checkIdempotency, DataController.update);
router.patch('/:resource/:id', authDispatch, checkIdempotency, DataController.update); // Same as PUT for now
router.delete('/:resource/:id', authDispatch, checkIdempotency, DataController.delete);

module.exports = router;

