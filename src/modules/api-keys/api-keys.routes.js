const express = require('express');
const ApiKeysController = require('./api-keys.controller');
const { authenticateJwtOrApiKey } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * API Keys Routes
 * Base: /api/v1/api-keys
 * 
 * USER ENDPOINTS:
 * - GET    /me                     → Get current user's API key info
 * - POST   /generate                → Generate new API credentials
 * - POST   /regenerate              → Regenerate API key (password stays same)
 * - POST   /regenerate-password     → Regenerate API password (key stays same)
 * - DELETE /revoke                  → Revoke (delete) API credentials
 * 
 * MASTER ADMIN ENDPOINTS:
 * - GET    /master-admin            → Get Master Admin API credentials
 * - POST   /master-admin/generate   → Generate Master Admin API credentials
 * - POST   /master-admin/regenerate → Regenerate Master Admin API key
 * - POST   /master-admin/regenerate-password → Regenerate Master Admin API password
 */

// ============================================================================
// USER API KEY ENDPOINTS
// ============================================================================

// Get current user's API key info
router.get('/me', authenticateJwtOrApiKey, ApiKeysController.getMyApiKey);

// Generate new API credentials (key + password)
router.post('/generate', authenticateJwtOrApiKey, ApiKeysController.generateApiCredentials);

// Regenerate API key (keeps same password)
router.post('/regenerate', authenticateJwtOrApiKey, ApiKeysController.regenerateApiKey);

// Regenerate API password (keeps same key)
router.post('/regenerate-password', authenticateJwtOrApiKey, ApiKeysController.regenerateApiPassword);

// Revoke (delete) API credentials
router.delete('/revoke', authenticateJwtOrApiKey, ApiKeysController.revokeApiCredentials);

// ============================================================================
// MASTER ADMIN API KEY ENDPOINTS
// ============================================================================

// Get Master Admin API credentials (admin only)
router.get('/master-admin', authenticateJwtOrApiKey, ApiKeysController.getMasterAdminApiKey);

// Generate Master Admin API credentials (admin only)
router.post('/master-admin/generate', authenticateJwtOrApiKey, ApiKeysController.generateMasterAdminApiCredentials);

// Regenerate Master Admin API key (admin only)
router.post('/master-admin/regenerate', authenticateJwtOrApiKey, ApiKeysController.regenerateMasterAdminApiKey);

// Regenerate Master Admin API password (admin only)
router.post('/master-admin/regenerate-password', authenticateJwtOrApiKey, ApiKeysController.regenerateMasterAdminApiPassword);

module.exports = router;

