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
 * ANALIZ.md Synchronization
 * POST /api/v1/admin/sync-analysis
 * 
 * Synchronizes ANALIZ.md with Configuration Compliance report
 * Updates Roadmap vs Code matrix with real-time data
 * 
 * Auth: Admin or Master Admin only
 */
router.post('/sync-analysis', authenticateJwtOrApiKey, AdminController.syncAnalysis);

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

/**
 * Generate Live Report
 * POST /api/v1/admin/generate-report?type=<report_type>
 * 
 * Generates a live report and stores it in AI Knowledge Base
 * Replaces old report if exists (UPSERT)
 * 
 * Types: backend_tables, migration_schema, backend_config, frontend_config, backend_structure, frontend_structure
 * 
 * Auth: Admin or Master Admin only
 */
router.post('/generate-report', authenticateJwtOrApiKey, AdminController.generateReport);

/**
 * Get Table Data (Master Admin Panel)
 * GET /api/v1/admin/table-data/:schema/:table
 * 
 * Returns raw table data with RLS bypass for admin/master_admin
 * Shows ALL tenants' data (no tenant filtering)
 * 
 * Query params: limit (default: 50), offset (default: 0)
 * 
 * Auth: Admin or Master Admin only
 */
router.get('/table-data/:schema/:table', authenticateJwtOrApiKey, AdminController.getTableData);

// ============================================================================
// AI KNOWLEDGE BASE ROUTES (Master Admin Only)
// ============================================================================

/**
 * Middleware to check master_admin role
 */
const requireMasterAdmin = (req, res, next) => {
  if (req.user.role !== 'master_admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Bu endpoint sadece Master Admin içindir.'
    });
  }
  next();
};

/**
 * List all reports
 * GET /api/v1/admin/knowledge-base
 * Query params: report_type, category, tags, status, search, limit, offset
 */
router.get('/knowledge-base', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseReports
);

/**
 * Search reports
 * GET /api/v1/admin/knowledge-base/search?q=<term>
 */
router.get('/knowledge-base/search', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.searchKnowledgeBase
);

/**
 * Import report from file
 * POST /api/v1/admin/knowledge-base/import
 * Body: { file_path, report_type, title, description, ... }
 */
router.post('/knowledge-base/import', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.importKnowledgeBaseReport
);

/**
 * Get single report
 * GET /api/v1/admin/knowledge-base/:id
 * Query params: view=true (increment view count)
 */
router.get('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseReport
);

/**
 * Export report as file
 * GET /api/v1/admin/knowledge-base/:id/export?format=md
 */
router.get('/knowledge-base/:id/export', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.exportKnowledgeBaseReport
);

/**
 * Create new report
 * POST /api/v1/admin/knowledge-base
 * Body: { report_type, title, description, content, ... }
 */
router.post('/knowledge-base', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.createKnowledgeBaseReport
);

/**
 * Update report
 * PUT /api/v1/admin/knowledge-base/:id
 * Body: { title, description, content, ... }
 */
router.put('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.updateKnowledgeBaseReport
);

/**
 * Delete report (soft delete)
 * DELETE /api/v1/admin/knowledge-base/:id
 */
router.delete('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.deleteKnowledgeBaseReport
);

/**
 * Get knowledge base statistics
 * GET /api/v1/admin/knowledge-base-stats
 */
router.get('/knowledge-base-stats', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseStats
);

module.exports = router;


