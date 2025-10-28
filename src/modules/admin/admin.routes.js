const express = require('express');
const AdminController = require('./admin.controller');
const { authenticateJwtOrApiKey } = require('../../middleware/auth');

const router = express.Router();

/**
 * Admin Routes
 * Base: /api/v1/admin
 * 
 * All routes require JWT or API Key authentication
 * Role-based authorization is handled in controller
 */

/**
 * Master Admin Endpoint
 * GET /api/v1/admin/database?type=<report_type>
 * 
 * Supported types (15 total):
 * - tables, table, schemas, stats, users
 * - migration-report, migrations, architecture-compliance
 * - table-comparison, endpoint-compliance, plan-compliance
 * - phase-progress, wrong-progress, project-structure
 * - all-tables-raw (master admin only)
 * 
 * Auth: JWT or API Key (role check in controller)
 */
router.get('/database', authenticateJwtOrApiKey, AdminController.getDatabaseInfo);

/**
 * File Analysis Trigger
 * POST /api/v1/admin/analyze-files
 * 
 * Runs analyze-files.js script in background
 * Generates DOSYA_ANALIZI.md report
 * 
 * Auth: Admin or Master Admin only
 */
router.post('/analyze-files', authenticateJwtOrApiKey, AdminController.analyzeFiles);

module.exports = router;


