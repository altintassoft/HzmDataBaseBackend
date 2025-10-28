const express = require('express');
const ApiKeyController = require('./api-key.controller');
const { authenticateJWT } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * API Key Management Routes
 * Base: /api/v1/api-keys
 */

// All routes require JWT authentication
router.use(authenticateJWT);

router.get('/', ApiKeyController.listUserKeys);
router.post('/generate', ApiKeyController.generateKey);
router.post('/:keyId/regenerate', ApiKeyController.regenerateKey);
router.post('/:keyId/revoke', ApiKeyController.revokeKey);
router.get('/:keyId', ApiKeyController.getKeyDetails);

module.exports = router;


