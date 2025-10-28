const express = require('express');
const DataController = require('./data.controller');
const { authenticateApiKey } = require('../../middleware/auth');

const router = express.Router();

/**
 * Generic Data Operations Routes
 * Base: /api/v1/data
 * 
 * Migrated from routes.OLD/generic-data.js
 * Smart endpoint strategy - one endpoint for all resources
 */

// All routes require API Key authentication
// (Applied in controller level for better error handling)

// Generic CRUD operations (ORDER MATTERS!)
// More specific routes first, then generic ones
router.post('/:resource/batch', authenticateApiKey, DataController.batchCreate);
router.put('/:resource/batch', authenticateApiKey, DataController.batchUpdate);
router.delete('/:resource/batch', authenticateApiKey, DataController.batchDelete);
router.post('/:resource/search', authenticateApiKey, DataController.search);
router.get('/:resource/count', authenticateApiKey, DataController.count);

// Single resource operations
router.get('/:resource', authenticateApiKey, DataController.list);
router.post('/:resource', authenticateApiKey, DataController.create);
router.get('/:resource/:id', authenticateApiKey, DataController.getById);
router.put('/:resource/:id', authenticateApiKey, DataController.update);
router.patch('/:resource/:id', authenticateApiKey, DataController.update); // Same as PUT for now
router.delete('/:resource/:id', authenticateApiKey, DataController.delete);

module.exports = router;

