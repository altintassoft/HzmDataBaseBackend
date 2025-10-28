const express = require('express');
const AdminController = require('./admin.controller');
const { authenticateJwtOrApiKey, requireAdmin } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * Admin Routes
 * Base: /api/v1/admin
 * 
 * Master endpoint: /database with query parameter ?type=...
 */

// All routes require authentication and admin role
router.use(authenticateJwtOrApiKey);
router.use(requireAdmin);

/**
 * Master Admin Endpoint
 * GET /api/v1/admin/database?type=<report_type>
 * 
 * Supported types:
 * - tables: Backend table information
 * - stats: Database statistics
 * - migrations: Migration report
 * - architecture: Architecture compliance
 * - table-comparison: Table comparison
 * - endpoint-compliance: Endpoint compliance
 * - plan-compliance: Plan compliance
 * - phase-progress: Phase progress
 * - wrong-progress: Wrong progress detection
 * - project-structure: Project structure
 */
router.get('/database', AdminController.getReport);

module.exports = router;


