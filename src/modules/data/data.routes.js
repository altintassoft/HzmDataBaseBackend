const express = require('express');
const DataController = require('./data.controller');
const { authenticateApiKey } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * Generic Data Operations Routes
 * Base: /api/v1/data
 * 
 * Smart endpoint strategy - one endpoint for all resources
 */

// All routes require API Key authentication
router.use(authenticateApiKey);

// Generic CRUD operations
router.get('/:resource', DataController.list);
router.post('/:resource', DataController.create);
router.get('/:resource/:id', DataController.getById);
router.put('/:resource/:id', DataController.update);
router.delete('/:resource/:id', DataController.delete);

// Batch operations
router.post('/:resource/batch', DataController.batchCreate);
router.put('/:resource/batch', DataController.batchUpdate);
router.delete('/:resource/batch', DataController.batchDelete);

// Search and filter
router.post('/:resource/search', DataController.search);
router.get('/:resource/count', DataController.count);

module.exports = router;

