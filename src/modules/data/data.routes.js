const express = require('express');
const DataController = require('./data.controller');
const { authenticateApiKey } = require('../../middleware/auth');
const { trackRequest } = require('../../middleware/metrics');
const { checkIdempotency } = require('../../middleware/idempotency');

const router = express.Router();

/**
 * Generic Data Operations Routes
 * Base: /api/v1/data
 * 
 * HAFTA 2 - Generic Handler Implementation
 * 
 * Middleware chain:
 * 1. trackRequest - Metrics tracking
 * 2. checkIdempotency - Duplicate write protection (POST/PUT/DELETE)
 * 3. authenticateApiKey - 3-layer auth
 * 4. DataController - CRUD operations
 * 
 * Security:
 * - All resources is_enabled=false (403 error)
 * - Manual activation in Week 3
 */

// Apply global middleware for all routes
router.use(trackRequest);

// All routes require API Key authentication
// (Applied in controller level for better error handling)

// Generic CRUD operations (ORDER MATTERS!)
// More specific routes first, then generic ones
router.post('/:resource/batch', checkIdempotency, authenticateApiKey, DataController.batchCreate);
router.put('/:resource/batch', checkIdempotency, authenticateApiKey, DataController.batchUpdate);
router.delete('/:resource/batch', checkIdempotency, authenticateApiKey, DataController.batchDelete);
router.post('/:resource/search', authenticateApiKey, DataController.search);
router.get('/:resource/count', authenticateApiKey, DataController.count);

// Single resource operations
router.get('/:resource', authenticateApiKey, DataController.list);
router.post('/:resource', checkIdempotency, authenticateApiKey, DataController.create);
router.get('/:resource/:id', authenticateApiKey, DataController.getById);
router.put('/:resource/:id', checkIdempotency, authenticateApiKey, DataController.update);
router.patch('/:resource/:id', checkIdempotency, authenticateApiKey, DataController.update); // Same as PUT for now
router.delete('/:resource/:id', checkIdempotency, authenticateApiKey, DataController.delete);

module.exports = router;

