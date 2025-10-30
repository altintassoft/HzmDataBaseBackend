const logger = require('../../core/logger');
const SyncAnalysisService = require('./services/compliance/sync-analysis.service');
const AIKnowledgeBaseService = require('./services/ai-knowledge-base.service');
const OpenAPIGeneratorService = require('./services/openapi-generator.service');
const { pool } = require('../../core/config/database');
const { cache } = require('../../core/config/redis');
const { TABLES } = require('../../shared/constants/tables');

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
      const { type, include, schema, table, limit, offset, target, force } = req.query;
      const user = req.user;

      // Debug logging
      logger.info('Admin database request:', {
        type,
        include,
        schema,
        table,
        limit,
        offset,
        target,
        force,
        fullQuery: req.query
      });

      // Validate type parameter
      const ALLOWED_TYPES = [
        'tables', 'schemas', 'table', 'stats', 'users',
        'migration-report', 'migrations', 'architecture-compliance',
        'table-comparison', 'all-tables-raw',
        'plan-compliance', 'phase-progress', 'wrong-progress', 'project-structure',
        'configuration-compliance', 'api-endpoints'
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
      const restrictedReports = ['migration-report', 'migrations', 'architecture-compliance', 'configuration-compliance'];
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
          if (!target || !['frontend', 'backend'].includes(target)) {
            return res.status(400).json({ 
              error: 'target parameter required (frontend or backend)' 
            });
          }
          
          // Cache kontrolü (1 saat TTL)
          const structureCacheKey = `report:project-structure:${target}`;
          
          if (force !== 'true') {
            const cachedStructure = await cache.get(structureCacheKey);
            if (cachedStructure) {
              logger.info(`✅ Cache hit: ${structureCacheKey}`);
              return res.json({
                ...cachedStructure,
                cached: true,
                cacheHit: true
              });
            }
          }
          
          logger.info(`🔄 Cache miss or force refresh: ${structureCacheKey}`);
          const ProjectStructureService = require('./services/analysis/project-structure.service');
          result = await ProjectStructureService.getProjectStructure(target);
          
          // Cache'e kaydet (1 saat = 3600 saniye)
          await cache.set(structureCacheKey, result, 3600);
          logger.info(`💾 Cached: ${structureCacheKey} (TTL: 1h)`);
          break;

        case 'configuration-compliance':
          const ConfigurationComplianceService = require('./services/compliance/configuration');
          result = await ConfigurationComplianceService.getFullCompliance();
          break;

        case 'api-endpoints':
          // Cache kontrolü (1 saat TTL)
          const endpointsCacheKey = 'report:api-endpoints:all';
          
          if (force !== 'true') {
            const cachedEndpoints = await cache.get(endpointsCacheKey);
            if (cachedEndpoints) {
              logger.info(`✅ Cache hit: ${endpointsCacheKey}`);
              return res.json({
                ...cachedEndpoints,
                cached: true,
                cacheHit: true
              });
            }
          }
          
          logger.info(`🔄 Cache miss or force refresh: ${endpointsCacheKey}`);
          const ApiEndpointsService = require('./services/analysis/api-endpoints.service');
          result = await ApiEndpointsService.getApiEndpoints();
          
          // Cache'e kaydet (1 saat = 3600 saniye)
          await cache.set(endpointsCacheKey, result, 3600);
          logger.info(`💾 Cached: ${endpointsCacheKey} (TTL: 1h)`);
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
   * POST /api/v1/admin/sync-analysis
   * Synchronize ANALIZ.md with Configuration Compliance
   * 
   * Updates ANALIZ.md table with real-time compliance data
   */
  static async syncAnalysis(req, res) {
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

      logger.info('🔄 Starting ANALIZ.md synchronization...');

      // Run synchronization
      const result = await SyncAnalysisService.syncAnalysis();

      if (result.success) {
        return res.json({
          success: true,
          message: result.message,
          updatedFeatures: result.updatedFeatures,
          timestamp: result.timestamp
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error,
          timestamp: result.timestamp
        });
      }
    } catch (error) {
      logger.error('Failed to sync ANALIZ.md:', error);
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

        // Don't log the full output - it's too large and gets truncated
        logger.info(`✅ File analysis completed successfully`);

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

  // ============================================================================
  // AI KNOWLEDGE BASE METHODS
  // ============================================================================

  /**
   * GET /api/v1/admin/knowledge-base
   * List all reports (with filters)
   */
  static async getKnowledgeBaseReports(req, res) {
    try {
      const filters = {
        report_type: req.query.report_type,
        category: req.query.category,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        status: req.query.status,
        search: req.query.search,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };
      
      const result = await AIKnowledgeBaseService.getAllReports(filters, req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base reports:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/:id
   * Get single report by ID or slug
   */
  static async getKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const incrementView = req.query.view === 'true';
      
      const result = await AIKnowledgeBaseService.getReport(id, incrementView, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/admin/knowledge-base
   * Create new report
   */
  static async createKnowledgeBaseReport(req, res) {
    try {
      const result = await AIKnowledgeBaseService.createReport(req.body, req.user);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to create knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/admin/knowledge-base/:id
   * Update report
   */
  static async updateKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const result = await AIKnowledgeBaseService.updateReport(id, req.body, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to update knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/v1/admin/knowledge-base/:id
   * Delete report (soft delete)
   */
  static async deleteKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const result = await AIKnowledgeBaseService.deleteReport(id, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to delete knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/admin/knowledge-base/import
   * Import report from file
   */
  static async importKnowledgeBaseReport(req, res) {
    try {
      const { file_path, ...metadata } = req.body;
      const result = await AIKnowledgeBaseService.importFromFile(file_path, metadata, req.user);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to import knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/search
   * Search reports
   */
  static async searchKnowledgeBase(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ success: false, error: 'Search term required' });
      }
      
      const result = await AIKnowledgeBaseService.searchReports(q, {}, req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to search knowledge base:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/:id/export
   * Export report as file
   */
  static async exportKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const format = req.query.format || 'md';
      
      const result = await AIKnowledgeBaseService.exportReport(id, format, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (error) {
      logger.error('Failed to export knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/get-latest-report
   * Get latest report from AI Knowledge Base (admin-friendly)
   */
  static async getLatestReport(req, res) {
    try {
      const { type } = req.query;
      const user = req.user;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Report type required'
        });
      }

      const client = await pool.connect();
      
      try {
        // Set RLS context
        await client.query(`SET LOCAL app.current_user_id = '${parseInt(user.id)}'`);
        await client.query(`SET LOCAL app.current_user_role = '${user.role}'`);
        await client.query(`SET LOCAL app.current_tenant_id = '${user.tenant_id || 1}'`);

        // For admin/master_admin: bypass RLS to see all reports
        if (user.role === 'admin' || user.role === 'master_admin') {
          await client.query("SET LOCAL app.bypass_rls = 'true'");
        }

        const query = `
          SELECT id, report_type, title, description, content, created_at, updated_at, published_at
          FROM ops.ai_knowledge_base
          WHERE report_type = $1 
            AND is_latest_version = true 
            AND is_deleted = false
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        
        const result = await client.query(query, [type]);

        if (result.rows.length > 0) {
          res.json({
            success: true,
            report: result.rows[0]
          });
        } else {
          res.json({
            success: true,
            report: null,
            message: 'Henüz rapor oluşturulmamış'
          });
        }

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get latest report:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/admin/generate-report
   * Generate live report and store in AI Knowledge Base
   * 
   * Query params:
   * - type: backend_tables | migration_schema | backend_config | frontend_config | backend_structure | frontend_structure
   */
  static async generateReport(req, res) {
    try {
      const { type } = req.query;
      const user = req.user;
      
      // Role check: only admin and master_admin
      if (!user.role || !['admin', 'master_admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Bu endpoint sadece Admin ve Master Admin içindir.'
        });
      }
      
      // Validate type
      const VALID_TYPES = [
        'backend_tables',
        'migration_schema',
        'backend_config',
        'frontend_config',
        'backend_structure',
        'frontend_structure'
      ];
      
      if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid type',
          message: `Type must be one of: ${VALID_TYPES.join(', ')}`
        });
      }
      
      logger.info(`🔄 Generating report: ${type}`);
      
      let reportData;
      let title;
      let description;
      
      // Generate report based on type
      switch(type) {
        case 'backend_tables': {
          const TablesInfoService = require('./services/database/tables-info.service');
          const tables = await TablesInfoService.getTablesInfo(['columns', 'indexes']);
          reportData = JSON.stringify(tables, null, 2);
          title = `Backend Tabloları - ${new Date().toISOString()}`;
          description = 'PostgreSQL veritabanındaki tüm tablolar ve metadata bilgileri';
          break;
        }
        
        case 'migration_schema': {
          const SchemasInfoService = require('./services/database/schemas-info.service');
          const schema = await SchemasInfoService.getSchemasInfo();
          reportData = JSON.stringify(schema, null, 2);
          title = `Migration & Schema - ${new Date().toISOString()}`;
          description = 'Veritabanı schema bilgileri ve migration durumu';
          break;
        }
        
        case 'backend_config': {
          const ConfigComplianceService = require('./services/compliance/configuration');
          const compliance = await ConfigComplianceService.getFullCompliance();
          reportData = JSON.stringify(compliance.backend, null, 2);
          title = `Backend Configuration Compliance - ${new Date().toISOString()}`;
          description = 'Backend kod taraması ve konfigurasyon uyum raporu';
          break;
        }
        
        case 'frontend_config': {
          const ConfigComplianceService = require('./services/compliance/configuration');
          const compliance = await ConfigComplianceService.getFullCompliance();
          reportData = JSON.stringify(compliance.frontend, null, 2);
          title = `Frontend Configuration Compliance - ${new Date().toISOString()}`;
          description = 'Frontend GitHub taraması ve konfigurasyon uyum raporu';
          break;
        }
        
        case 'backend_structure': {
          try {
            // GitHub'dan backend repo'yu tara
            const GitHubScanner = require('./services/compliance/configuration/scanners/github-scanner');
            const scanner = new GitHubScanner();
            
            const backendRepo = process.env.GITHUB_BACKEND_REPO || 'altintassoft/HzmDataBaseBackend';
            const [owner, repo] = backendRepo.split('/');
            
            logger.info(`📡 Scanning backend structure from GitHub: ${owner}/${repo}`);
            
            const tree = await scanner.getRepoTree(owner, repo);
            const backendFiles = tree.filter(f => f.type === 'blob' && f.path.startsWith('src/'));
            
            // Dosya tree'yi markdown formatına çevir
            let markdown = `## 📊 Backend Projesi\n\n`;
            markdown += `**GitHub Repository:** ${owner}/${repo}\n`;
            markdown += `**Toplam Dosya:** ${backendFiles.length}\n`;
            markdown += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n\n`;
            markdown += `### Dosya Listesi\n\n`;
            markdown += `| # | Dosya | Satır | Yol | Durum |\n`;
            markdown += `|---|-------|-------|-----|-------|\n`;
            
            backendFiles.slice(0, 200).forEach((file, index) => {
              const fileName = file.path.split('/').pop();
              // Satır sayısını tahmin et (size / 50)
              const estimatedLines = file.size ? Math.round(file.size / 50) : 0;
              let status = '✅ İyi';
              if (estimatedLines >= 900) status = '🔴🔴🔴 Kritik';
              else if (estimatedLines >= 700) status = '🔴🔴 Acil';
              else if (estimatedLines >= 450) status = '🔴 Bölünmeli';
              else if (estimatedLines >= 300) status = '⚠️ Dikkat';
              
              markdown += `| ${index + 1} | \`${fileName}\` | ${estimatedLines} | \`${file.path}\` | ${status} |\n`;
            });
            
            if (backendFiles.length > 200) {
              markdown += `\n_... ve ${backendFiles.length - 200} dosya daha_\n`;
            }
            
            reportData = markdown;
            title = `Backend Proje Yapısı - ${new Date().toISOString()}`;
            description = `GitHub: ${owner}/${repo} (${backendFiles.length} dosya)`;
            
          } catch (error) {
            logger.error('Backend structure scan failed:', error);
            
            // Hata mesajı oluştur
            reportData = `# ⚠️ Backend Yapısı Taranamadı\n\n`;
            reportData += `## Sebep:\n${error.message}\n\n`;
            
            if (error.message.includes('403') || error.message.includes('Bad credentials')) {
              reportData += `## Çözüm:\nRailway'de GITHUB_TOKEN environment variable'ı ekleyin:\n\n`;
              reportData += `\`\`\`\nGITHUB_TOKEN=ghp_your_token_here\n`;
              reportData += `GITHUB_BACKEND_REPO=altintassoft/HzmDataBaseBackend\n\`\`\`\n`;
            } else if (!process.env.GITHUB_BACKEND_REPO) {
              reportData += `## Çözüm:\nGITHUB_BACKEND_REPO environment variable tanımlı değil!\n`;
            } else {
              reportData += `## Detay:\n\`\`\`\n${error.stack}\n\`\`\`\n`;
            }
            
            title = `Backend Proje Yapısı - HATA - ${new Date().toISOString()}`;
            description = `GitHub taraması başarısız: ${error.message}`;
          }
          break;
        }
        
        case 'frontend_structure': {
          try {
            // GitHub'dan frontend repo'yu tara
            const GitHubScanner = require('./services/compliance/configuration/scanners/github-scanner');
            const scanner = new GitHubScanner();
            
            const frontendRepo = process.env.GITHUB_FRONTEND_REPO || 'altintassoft/HzmDatabaseFrontend';
            const [owner, repo] = frontendRepo.split('/');
            
            logger.info(`📡 Scanning frontend structure from GitHub: ${owner}/${repo}`);
            
            const tree = await scanner.getRepoTree(owner, repo);
            const frontendFiles = tree.filter(f => f.type === 'blob' && f.path.startsWith('src/'));
            
            // Dosya tree'yi markdown formatına çevir
            let markdown = `## 📊 Frontend Projesi\n\n`;
            markdown += `**GitHub Repository:** ${owner}/${repo}\n`;
            markdown += `**Toplam Dosya:** ${frontendFiles.length}\n`;
            markdown += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n\n`;
            markdown += `### Dosya Listesi\n\n`;
            markdown += `| # | Dosya | Satır | Yol | Durum |\n`;
            markdown += `|---|-------|-------|-----|-------|\n`;
            
            frontendFiles.slice(0, 200).forEach((file, index) => {
              const fileName = file.path.split('/').pop();
              const estimatedLines = file.size ? Math.round(file.size / 50) : 0;
              let status = '✅ İyi';
              if (estimatedLines >= 900) status = '🔴🔴🔴 Kritik';
              else if (estimatedLines >= 700) status = '🔴🔴 Acil';
              else if (estimatedLines >= 450) status = '🔴 Bölünmeli';
              else if (estimatedLines >= 300) status = '⚠️ Dikkat';
              
              markdown += `| ${index + 1} | \`${fileName}\` | ${estimatedLines} | \`${file.path}\` | ${status} |\n`;
            });
            
            if (frontendFiles.length > 200) {
              markdown += `\n_... ve ${frontendFiles.length - 200} dosya daha_\n`;
            }
            
            reportData = markdown;
            title = `Frontend Proje Yapısı - ${new Date().toISOString()}`;
            description = `GitHub: ${owner}/${repo} (${frontendFiles.length} dosya)`;
            
          } catch (error) {
            logger.error('Frontend structure scan failed:', error);
            
            reportData = `# ⚠️ Frontend Yapısı Taranamadı\n\n`;
            reportData += `## Sebep:\n${error.message}\n\n`;
            
            if (error.message.includes('403') || error.message.includes('Bad credentials')) {
              reportData += `## Çözüm:\nRailway'de GITHUB_TOKEN environment variable'ı ekleyin:\n\n`;
              reportData += `\`\`\`\nGITHUB_TOKEN=ghp_your_token_here\n`;
              reportData += `GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend\n\`\`\`\n`;
            } else if (!process.env.GITHUB_FRONTEND_REPO) {
              reportData += `## Çözüm:\nGITHUB_FRONTEND_REPO environment variable tanımlı değil!\n`;
            } else {
              reportData += `## Detay:\n\`\`\`\n${error.stack}\n\`\`\`\n`;
            }
            
            title = `Frontend Proje Yapısı - HATA - ${new Date().toISOString()}`;
            description = `GitHub taraması başarısız: ${error.message}`;
          }
          break;
        }
        
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported type'
          });
      }
      
      // Upsert report to AI Knowledge Base
      const result = await AIKnowledgeBaseService.upsertReport({
        report_type: type,
        title,
        description,
        content: reportData,
        tags: ['live-report', 'auto-generated'],
        keywords: [type, 'report'],
        status: 'published'
      }, user);
      
      if (result.success) {
        logger.info(`✅ Report generated: ${type} (${result.action})`);
        res.json({
          success: true,
          message: `Rapor başarıyla ${result.action === 'created' ? 'oluşturuldu' : 'güncellendi'}`,
          report: {
            id: result.report.id,
            report_type: result.report.report_type,
            title: result.report.title,
            description: result.report.description,
            content: result.report.content,
            created_at: result.report.created_at,
            updated_at: result.report.updated_at,
            published_at: result.report.published_at
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      logger.error('Failed to generate report:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/admin/currencies
   * Get all currencies
   */
  static async getCurrencies(req, res) {
    try {
      const CurrencyManager = require('../../core/services/currency-manager');
      const currencies = await CurrencyManager.getActiveCurrencies();
      
      res.json({
        success: true,
        currencies
      });
    } catch (error) {
      logger.error('Failed to get currencies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/admin/tenant-settings
   * Update tenant settings (currency, timezone, language)
   */
  static async updateTenantSettings(req, res) {
    try {
      const { default_currency, timezone, language } = req.body;
      const user = req.user;

      // Admin can update their own tenant, Master Admin can update any
      const tenantId = user.role === 'master_admin' && req.body.tenant_id 
        ? req.body.tenant_id 
        : user.tenant_id;

      const updates = [];
      const params = [];
      let paramCount = 1;

      if (default_currency) {
        updates.push(`default_currency = $${paramCount++}`);
        params.push(default_currency);
      }

      if (timezone) {
        updates.push(`timezone = $${paramCount++}`);
        params.push(timezone);
      }

      if (language) {
        updates.push(`language = $${paramCount++}`);
        params.push(language);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(tenantId);

      const query = `
        UPDATE ${TABLES.TENANTS}
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, default_currency
      `;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found'
        });
      }

      logger.info(`Tenant settings updated: ${tenantId} by user ${user.id}`);

      res.json({
        success: true,
        tenant: result.rows[0],
        message: 'Tenant ayarları güncellendi'
      });

    } catch (error) {
      logger.error('Failed to update tenant settings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/admin/exchange-rates
   * Update exchange rate (admin only)
   */
  static async updateExchangeRate(req, res) {
    try {
      const { fromCurrency, toCurrency, rate } = req.body;
      
      if (!fromCurrency || !toCurrency || !rate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: fromCurrency, toCurrency, rate'
        });
      }

      const CurrencyManager = require('../../core/services/currency-manager');
      await CurrencyManager.updateRate(fromCurrency, toCurrency, rate, 'manual');

      res.json({
        success: true,
        message: `Exchange rate updated: ${fromCurrency}→${toCurrency} = ${rate}`
      });
    } catch (error) {
      logger.error('Failed to update exchange rate:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/table-data/:schema/:table
   * Get table data with RLS bypass for admin/master_admin
   * 
   * Access: admin, master_admin only
   * Returns: All tenant data (RLS bypassed)
   */
  static async getTableData(req, res) {
    try {
      const { schema, table } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const user = req.user;

      logger.info('Table data request:', { schema, table, user: user.email, role: user.role });

      // Check role: admin or master_admin only
      const allowedRoles = ['admin', 'master_admin'];
      if (!user.role || !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Bu özellik sadece Admin ve Master Admin içindir'
        });
      }

      // Validate schema and table names (prevent SQL injection)
      const validSchemaPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const validTablePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

      if (!validSchemaPattern.test(schema) || !validTablePattern.test(table)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid schema or table name'
        });
      }

      const client = await pool.connect();

      try {
        // RLS BYPASS for admin/master_admin (show ALL tenants)
        await client.query("SET LOCAL app.bypass_rls = 'true'");
        await client.query(`SET LOCAL app.current_user_id = '${parseInt(user.id)}'`);
        await client.query(`SET LOCAL app.current_user_role = '${user.role}'`);

        // Get table data (without ORDER BY to avoid errors)
        const dataQuery = `SELECT * FROM ${schema}.${table} LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const dataResult = await client.query(dataQuery);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM ${schema}.${table}`;
        const countResult = await client.query(countQuery);

        // Get column info
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `;
        const columnsResult = await client.query(columnsQuery, [schema, table]);

        res.json({
          success: true,
          schema,
          table,
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          columns: columnsResult.rows,
          rows: dataResult.rows,
          message: `${dataResult.rows.length} kayıt gösteriliyor (Toplam: ${countResult.rows[0].total})`
        });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get table data:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base-stats
   * Get knowledge base statistics
   */
  static async getKnowledgeBaseStats(req, res) {
    try {
      const result = await AIKnowledgeBaseService.getStatistics(req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ============================================================================
  // OPENAPI DOCUMENTATION (Week 4)
  // ============================================================================

  /**
   * GET /api/v1/admin/docs/openapi.json
   * Get OpenAPI 3.0 specification (JSON)
   * 
   * Auto-generated from api_resources metadata
   * Public endpoint (no auth required)
   */
  static async getOpenAPISpec(req, res) {
    try {
      logger.info('OpenAPI spec requested');
      const spec = await OpenAPIGeneratorService.generateCompleteSpec();
      
      res.json(spec);
    } catch (error) {
      logger.error('Failed to generate OpenAPI spec:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate OpenAPI specification',
        message: error.message 
      });
    }
  }

  /**
   * GET /api/v1/admin/docs
   * Get Swagger UI HTML page
   * 
   * Interactive API documentation
   * Public endpoint (no auth required)
   */
  static async getSwaggerUI(req, res) {
    try {
      logger.info('Swagger UI requested');
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HZM Database API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/v1/admin/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      logger.error('Failed to serve Swagger UI:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to serve Swagger UI',
        message: error.message 
      });
    }
  }
}

module.exports = AdminController;
