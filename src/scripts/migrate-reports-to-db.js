const fs = require('fs');
const path = require('path');
const { pool } = require('../core/config/database');
const logger = require('../core/logger');

const REPORTS_TO_MIGRATE = [
  {
    file: 'docs/roadmap/ANALIZ.md',
    report_type: 'analysis',
    report_category: 'roadmap',
    title: 'ANALIZ #1: ROADMAP vs KOD UYUMU',
    description: 'Roadmap dokümantasyonu ile gerçek kod implementasyonu arasındaki uyum analizi',
    summary: 'Roadmap özelliklerinin mevcut kod durumu, gap analizi ve P0 görevler',
    tags: ['roadmap', 'compliance', 'architecture', 'p0'],
    keywords: ['multi-tenant', 'rls', 'api-versioning', 'error-handler', 'rate-limiting'],
    topics: ['Security', 'Database', 'API', 'Architecture'],
    priority: 'P0',
    status: 'published'
  },
  {
    file: 'docs/roadmap/QUALITY_REPORT.txt',
    report_type: 'quality',
    report_category: 'technical',
    title: 'Quality Report - Code Quality Analysis',
    description: 'Kapsamlı kod kalitesi, mimari ve dokümantasyon analizi',
    summary: 'Backend ve frontend kod kalite skorları, best practices uyumu',
    tags: ['quality', 'code-review', 'best-practices'],
    keywords: ['eslint', 'prettier', 'testing', 'documentation', 'maintainability'],
    topics: ['Code Quality', 'Testing', 'Documentation'],
    priority: 'P1',
    status: 'published'
  },
  {
    file: 'docs/roadmap/BACKEND_PHASE_PLAN.md',
    report_type: 'phase_plan',
    report_category: 'roadmap',
    title: 'Backend Development Phase Plan',
    description: 'Backend geliştirme fazlarının detaylı planlaması ve takibi',
    summary: 'Phase 1-12 implementation plan, milestones, dependencies',
    tags: ['planning', 'backend', 'phases', 'roadmap'],
    keywords: ['authentication', 'database', 'api', 'deployment', 'testing'],
    topics: ['Backend', 'Planning', 'Roadmap'],
    priority: 'P1',
    status: 'published'
  },
  {
    file: 'docs/roadmap/SMART_ENDPOINT_STRATEGY_V2.md',
    report_type: 'endpoint_strategy',
    report_category: 'technical',
    title: 'Smart Endpoint Strategy V2',
    description: 'RESTful API endpoint tasarım stratejisi ve implementasyon rehberi',
    summary: 'Unified endpoint pattern, versioning, error handling',
    tags: ['api', 'endpoints', 'strategy', 'rest'],
    keywords: ['rest-api', 'versioning', 'error-handling', 'response-format'],
    topics: ['API Design', 'Backend', 'Best Practices'],
    priority: 'P1',
    status: 'published'
  }
];

async function migrateReports() {
  const client = await pool.connect();
  
  try {
    logger.info('🚀 Starting reports migration to database...');
    
    // Set RLS context (master_admin)
    await client.query(`SET LOCAL app.current_user_id = '1'`);
    await client.query(`SET LOCAL app.current_user_role = 'master_admin'`);
    await client.query(`SET LOCAL app.current_tenant_id = '1'`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const reportMeta of REPORTS_TO_MIGRATE) {
      try {
        const filePath = path.join(process.cwd(), reportMeta.file);
        
        if (!fs.existsSync(filePath)) {
          logger.warn(`⚠️  File not found: ${reportMeta.file}`);
          errorCount++;
          continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        
        // Check if already exists (by source_file + content_hash)
        const contentHash = require('crypto')
          .createHash('sha256')
          .update(content)
          .digest('hex');
        
        const existingResult = await client.query(
          `SELECT id FROM ops.ai_knowledge_base WHERE source_file = $1 AND content_hash = $2`,
          [reportMeta.file, contentHash]
        );
        
        if (existingResult.rows.length > 0) {
          logger.info(`⏭️  Report already exists (identical): ${reportMeta.title}`);
          skippedCount++;
          continue;
        }
        
        // Insert
        const query = `
          INSERT INTO ops.ai_knowledge_base (
            report_type, report_category, title, description, summary, content,
            tags, keywords, topics, priority, status, source_file,
            source_file_size, source_file_modified_at, sync_status,
            metadata, created_by, updated_by, tenant_id, published_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, $18, NOW()
          )
          RETURNING id, title, slug
        `;
        
        const metadata = {
          imported_from: reportMeta.file,
          file_size: stats.size,
          import_date: new Date().toISOString(),
          source: 'migration_script'
        };
        
        const result = await client.query(query, [
          reportMeta.report_type,
          reportMeta.report_category,
          reportMeta.title,
          reportMeta.description,
          reportMeta.summary,
          content,
          reportMeta.tags,
          reportMeta.keywords,
          reportMeta.topics,
          reportMeta.priority,
          reportMeta.status,
          reportMeta.file,
          stats.size,
          stats.mtime,
          'synced',
          JSON.stringify(metadata),
          1, // master_admin user ID
          1  // tenant_id
        ]);
        
        logger.info(`✅ Migrated: ${reportMeta.title}`);
        logger.info(`   📊 ID: ${result.rows[0].id}`);
        logger.info(`   🔗 Slug: ${result.rows[0].slug}`);
        successCount++;
        
      } catch (error) {
        logger.error(`❌ Failed to migrate ${reportMeta.file}:`, error);
        errorCount++;
      }
    }
    
    logger.info(`\n📊 ============ MIGRATION SUMMARY ============`);
    logger.info(`   ✅ Success: ${successCount}`);
    logger.info(`   ⏭️  Skipped: ${skippedCount} (already exists)`);
    logger.info(`   ❌ Errors: ${errorCount}`);
    logger.info(`   📁 Total: ${REPORTS_TO_MIGRATE.length}`);
    logger.info(`============================================\n`);
    
    if (successCount > 0) {
      logger.info('🎉 Migration completed successfully!');
    }
    
  } catch (error) {
    logger.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrateReports();
}

module.exports = { migrateReports };

