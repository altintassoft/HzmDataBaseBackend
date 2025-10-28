const TablesInfoService = require('./services/tables-info.service');
const DatabaseStatsService = require('./services/database-stats.service');
const MigrationReportService = require('./services/migration-report.service');
const ArchitectureComplianceService = require('./services/architecture-compliance.service');
const TableComparisonService = require('./services/table-comparison.service');
const EndpointComplianceService = require('./services/endpoint-compliance.service');
const PlanComplianceService = require('./services/plan-compliance.service');
const PhaseProgressService = require('./services/phase-progress.service');
const WrongProgressService = require('./services/wrong-progress.service');
const ProjectStructureService = require('./services/project-structure.service');
const logger = require('../../shared/utils/logger');

/**
 * Admin Controller
 * Routes admin requests to appropriate services
 */
class AdminController {
  /**
   * Master Admin Endpoint
   * GET /api/v1/admin/database?type=<report_type>
   */
  static async getReport(req, res) {
    try {
      const { type } = req.query;
      const user = req.user;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "type" is required'
        });
      }

      let data;

      switch (type) {
        case 'tables':
          data = await TablesInfoService.getTablesInfo(user);
          break;

        case 'stats':
          data = await DatabaseStatsService.getDatabaseStats(user);
          break;

        case 'migrations':
          data = await MigrationReportService.getMigrationReport(user);
          break;

        case 'architecture':
          data = await ArchitectureComplianceService.getArchitectureCompliance(user);
          break;

        case 'table-comparison':
          data = await TableComparisonService.getTableComparison(user);
          break;

        case 'endpoint-compliance':
          data = await EndpointComplianceService.getEndpointCompliance(user);
          break;

        case 'plan-compliance':
          data = await PlanComplianceService.getPlanCompliance(user);
          break;

        case 'phase-progress':
          data = await PhaseProgressService.getPhaseProgress(user);
          break;

        case 'wrong-progress':
          data = await WrongProgressService.getWrongProgress(user);
          break;

        case 'project-structure':
          data = await ProjectStructureService.getProjectStructure(user);
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Unknown report type: ${type}`,
            available_types: [
              'tables', 'stats', 'migrations', 'architecture',
              'table-comparison', 'endpoint-compliance', 'plan-compliance',
              'phase-progress', 'wrong-progress', 'project-structure'
            ]
          });
      }

      res.json({
        success: true,
        type,
        data
      });

    } catch (error) {
      logger.error('Admin report error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = AdminController;


