const logger = require('../../core/logger');

/**
 * Admin Controller
 * Handles HTTP requests for admin operations
 * 
 * This controller routes requests to appropriate services
 * based on the 'type' parameter in the query string.
 */
class AdminController {
  /**
   * GET /api/v1/admin/database
   * Master endpoint - all database reports
   * 
   * Supports 15 different report types via ?type= parameter:
   * - tables, table, schemas, stats, users
   * - migration-report, migrations, architecture-compliance
   * - table-comparison, endpoint-compliance, plan-compliance
   * - phase-progress, wrong-progress, project-structure
   * - all-tables-raw (master admin only)
   */
  static async getDatabaseInfo(req, res) {
    try {
      const { type, include, schema, table, limit, offset, target } = req.query;
      const user = req.user;

      // Debug logging
      logger.info('Admin database request:', {
        type,
        include,
        schema,
        table,
        limit,
        offset,
        fullQuery: req.query
      });

      // Validate type parameter
      const ALLOWED_TYPES = [
        'tables', 'schemas', 'table', 'stats', 'users',
        'migration-report', 'migrations', 'architecture-compliance',
        'table-comparison', 'all-tables-raw', 'endpoint-compliance',
        'plan-compliance', 'phase-progress', 'wrong-progress', 'project-structure'
      ];

      if (!type || !ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          error: 'Invalid type',
          allowed: ALLOWED_TYPES
        });
      }

      // Parse includes parameter
      const ALLOWED_INCLUDES = ['columns', 'indexes', 'rls', 'data', 'fk', 'constraints', 'tracking'];
      const includes = include ? include.split(',').filter(i => ALLOWED_INCLUDES.includes(i)) : [];

      // Role-based authorization for restricted reports
      const restrictedReports = ['migration-report', 'migrations', 'architecture-compliance'];
      if (restrictedReports.includes(type)) {
        if (!user.role || !['admin', 'master_admin'].includes(user.role)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Bu rapor için yetkiniz yok. Sadece Admin ve Master Admin erişebilir.',
            requiredRole: ['admin', 'master_admin'],
            yourRole: user.role || 'user'
          });
        }
      }

      let result;

      // Route to appropriate service based on type
      switch (type) {
        case 'tables':
          // Import service dynamically to avoid circular dependencies
          const TablesInfoService = require('./services/database/tables-info.service');
          result = await TablesInfoService.getTablesInfo(includes);
          break;

        case 'table':
          if (!schema || !table) {
            return res.status(400).json({ error: 'schema and table parameters required' });
          }
          const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];
          if (!ALLOWED_SCHEMAS.includes(schema)) {
            return res.status(403).json({ error: 'Schema not allowed', allowed: ALLOWED_SCHEMAS });
          }
          const SingleTableInfoService = require('./services/database/single-table-info.service');
          result = await SingleTableInfoService.getSingleTableInfo(schema, table, includes, limit, offset, user);
          break;

        case 'schemas':
          const SchemasInfoService = require('./services/database/schemas-info.service');
          result = await SchemasInfoService.getSchemasInfo();
          break;

        case 'stats':
          const DatabaseStatsService = require('./services/database/database-stats.service');
          result = await DatabaseStatsService.getDatabaseStats();
          break;

        case 'users':
          const UsersInfoService = require('./services/database/users-info.service');
          result = await UsersInfoService.getUsersInfo(limit, offset);
          break;

        case 'migration-report':
          const MigrationReportService = require('./services/migrations/migration-report.service');
          result = await MigrationReportService.getMigrationReport(includes);
          break;

        case 'migrations':
          const MigrationsInfoService = require('./services/migrations/migrations-info.service');
          result = await MigrationsInfoService.getMigrationsInfo(includes);
          break;

        case 'architecture-compliance':
          const ArchitectureComplianceService = require('./services/compliance/architecture-compliance.service');
          result = await ArchitectureComplianceService.getArchitectureCompliance(includes);
          break;

        case 'table-comparison':
          const TableComparisonService = require('./services/migrations/table-comparison.service');
          result = await TableComparisonService.getTableComparison();
          break;

        case 'endpoint-compliance':
          const EndpointComplianceService = require('./services/compliance/endpoint-compliance.service');
          result = await EndpointComplianceService.getEndpointCompliance();
          break;

        case 'plan-compliance':
          const PlanComplianceService = require('./services/compliance/plan-compliance.service');
          result = await PlanComplianceService.getPlanCompliance();
          break;

        case 'phase-progress':
          const PhaseProgressService = require('./services/compliance/phase-progress.service');
          result = await PhaseProgressService.getPhaseProgress();
          break;

        case 'wrong-progress':
          const WrongProgressService = require('./services/compliance/wrong-progress.service');
          result = await WrongProgressService.getWrongProgress();
          break;

        case 'project-structure':
          const ProjectStructureService = require('./services/analysis/project-structure.service');
          result = await ProjectStructureService.getProjectStructure(target);
          break;

        case 'all-tables-raw':
          // Master admin only - no filters!
          if (user.role !== 'master_admin') {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Bu endpoint sadece Master Admin içindir.'
            });
          }
          const AllTablesRawService = require('./services/database/all-tables-raw.service');
          result = await AllTablesRawService.getAllTablesRaw();
          break;

        default:
          return res.status(400).json({ error: 'Unsupported type' });
      }

      // Check if result contains an error (for graceful failures)
      if (result.error) {
        return res.json({
          success: false,
          type,
          timestamp: new Date().toISOString(),
          ...result
        });
      }

      // Success response
      res.json({
        success: true,
        type,
        includes,
        timestamp: new Date().toISOString(),
        ...result
      });

    } catch (error) {
      logger.error('Admin database endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/admin/analyze-files
   * Trigger file analysis script
   * 
   * Runs the analyze-files.js script in background
   * to generate DOSYA_ANALIZI.md report
   */
  static async analyzeFiles(req, res) {
    try {
      const user = req.user;

      // Admin only
      if (!user.role || !['admin', 'master_admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Bu endpoint sadece Admin ve Master Admin içindir.',
          requiredRole: ['admin', 'master_admin'],
          yourRole: user.role || 'user'
        });
      }

      logger.info('🔄 Starting file analysis script...');

      const { exec } = require('child_process');
      const path = require('path');
      const fs = require('fs');

      const scriptPath = path.join(__dirname, '../../scripts/analyze-files.js');

      // Debug: Log paths
      logger.info('📂 __dirname:', __dirname);
      logger.info('📄 scriptPath:', scriptPath);
      logger.info('📁 Script exists?', fs.existsSync(scriptPath));

      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({
          success: false,
          error: 'Script not found',
          message: 'analyze-files.js script bulunamadı.',
          scriptPath,
          __dirname,
          cwd: process.cwd()
        });
      }

      // Run script in background
      exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`❌ File analysis failed: ${error.message}`);
          return;
        }

        logger.info(`✅ File analysis completed: ${stdout.substring(0, 200)}...`);

        if (stderr) {
          logger.warn(`⚠️  File analysis warnings: ${stderr}`);
        }
      });

      // Return immediately (script runs in background)
      res.json({
        success: true,
        message: 'Dosya analizi başlatıldı. DOSYA_ANALIZI.md dosyası birkaç saniye içinde güncellenecek.',
        scriptPath,
        note: 'Script arka planda çalışıyor. Rapor sayfasını 5-10 saniye sonra yenileyebilirsiniz.'
      });

    } catch (error) {
      logger.error('Failed to run file analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = AdminController;
