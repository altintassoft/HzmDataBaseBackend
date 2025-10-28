const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');
const config = require('../../../core/config');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];

/**
 * Architecture Compliance Service
 * Comprehensive architecture compliance analysis
 */
class ArchitectureComplianceService {
  /**
   * Get architecture compliance report
   * @param {Array} includes - Optional includes (unused currently)
   * @returns {Object} Compliance report with scores, checks, action plan
   */
  static async getArchitectureCompliance(includes = []) {
    try {
      logger.info('Generating architecture compliance report...');

      // 1. Database Schema Analysis (REAL DATA)
      const tableCountResult = await pool.query(`
        SELECT schemaname, COUNT(*) as table_count
        FROM pg_tables
        WHERE schemaname = ANY($1)
        GROUP BY schemaname;
      `, [ALLOWED_SCHEMAS]);

      const expectedTables = 9; // From BACKEND_PHASE_PLAN Phase 1-2
      const actualTables = tableCountResult.rows.reduce((sum, row) => sum + parseInt(row.table_count), 0);
      const missingTables = Math.max(0, expectedTables - actualTables);
      const databaseSchemaScore = Math.round((actualTables / expectedTables) * 100);

      // 2. Migration Consistency Check (REAL DATA)
      const migrationResult = await pool.query(`
        SELECT COUNT(*) as migration_count
        FROM public.schema_migrations;
      `);
      const executedMigrations = parseInt(migrationResult.rows[0].migration_count) || 0;
      const expectedMigrations = 7; // Current migration count
      const migrationConsistencyScore = Math.round((executedMigrations / expectedMigrations) * 100);

      // 3. Endpoint Analysis (REAL DATA - Count actual routes from filesystem)
      const routesDir = path.join(__dirname, '../../..');
      
      let currentEndpoints = 0;
      const endpointList = [];
      
      // Scan all route files
      const routeFiles = ['routes.OLD/auth.js', 'routes.OLD/admin.js', 'routes.OLD/api-keys.js', 'routes.OLD/generic-data.js', 'modules/health/health.routes.js'];
      for (const file of routeFiles) {
        try {
          const filePath = path.join(routesDir, file);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            // Count router.get, router.post, router.put, router.delete, router.patch
            const matches = content.match(/router\.(get|post|put|delete|patch)\s*\(/g);
            if (matches) {
              currentEndpoints += matches.length;
              endpointList.push({ file, count: matches.length });
            }
          }
        } catch (err) {
          logger.warn(`Failed to scan ${file}:`, err.message);
        }
      }
      
      const targetEndpoints = 17; // From SMART_ENDPOINT_STRATEGY_V2
      const endpointArchitectureScore = Math.max(0, 100 - ((currentEndpoints - targetEndpoints) * 3));

      // 4. Security Implementation Check (REAL DATA - Check actual code and database)
      
      // Check if HMAC middleware exists
      const hmacExists = fs.existsSync(path.join(routesDir, 'middleware/hmac.js'));
      
      // Check if cursor pagination exists
      const cursorExists = fs.existsSync(path.join(routesDir, 'utils/cursor.js'));
      
      // Check if scopes column exists in users table
      const scopesResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'core' 
          AND table_name = 'users' 
          AND column_name = 'scopes';
      `);
      const hasScopes = scopesResult.rows.length > 0;
      
      // Check if MFA middleware exists
      const mfaExists = fs.existsSync(path.join(routesDir, 'middleware/mfa.js'));
      
      // Check Redis configuration
      const hasRedis = !!config.redis.url;
      
      // Check if app.set_context function exists (RLS)
      const rlsContextResult = await pool.query(`
        SELECT proname 
        FROM pg_proc 
        WHERE proname = 'set_context' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app');
      `);
      const hasRLSContext = rlsContextResult.rows.length > 0;
      
      // Check if audit_log table exists
      const auditResult = await pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'ops' AND tablename = 'audit_log';
      `);
      const hasAuditLog = auditResult.rows.length > 0;
      
      // Check error handler middleware
      const errorHandlerContent = fs.existsSync(path.join(routesDir, 'middleware/errorHandler.js')) ? 
        fs.readFileSync(path.join(routesDir, 'middleware/errorHandler.js'), 'utf8') : '';
      const hasStandardErrors = errorHandlerContent.includes('error.code') && errorHandlerContent.includes('request_id');
      
      const securityChecks = {
        hmac: hmacExists,
        cursor_security: cursorExists,
        scopes: hasScopes,
        admin_mfa: mfaExists,
        admin_ip_allowlist: false, // TODO: Implement IP allowlist check
        admin_pii_masking: false, // TODO: Implement PII masking check
        rate_limiting: hasRedis,
        error_standardization: hasStandardErrors,
        rls_context: hasRLSContext,
        audit_logging: hasAuditLog
      };

      const securityScore = (Object.values(securityChecks).filter(Boolean).length / Object.keys(securityChecks).length) * 100;

      // 5. RLS & Multi-Tenancy Check (REAL DATA)
      const rlsPolicyResult = await pool.query(`
        SELECT COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = ANY($1);
      `, [ALLOWED_SCHEMAS]);
      const rlsPolicyCount = parseInt(rlsPolicyResult.rows[0].policy_count) || 0;
      const rlsScore = Math.min(100, rlsPolicyCount * 20); // Each policy = 20 points, max 100

      // 6. Best Practices Score (REAL DATA - Calculate from actual metrics)
      let bestPracticesScore = 0;
      
      // Check for indexes on foreign keys
      const indexResult = await pool.query(`
        SELECT COUNT(*) as index_count
        FROM pg_indexes
        WHERE schemaname = ANY($1);
      `, [ALLOWED_SCHEMAS]);
      const indexCount = parseInt(indexResult.rows[0].index_count) || 0;
      bestPracticesScore += Math.min(30, indexCount * 5); // Max 30 points for indexes
      
      // Check for NOT NULL constraints
      const notNullResult = await pool.query(`
        SELECT COUNT(*) as notnull_count
        FROM information_schema.columns
        WHERE table_schema = ANY($1)
          AND is_nullable = 'NO'
          AND column_name NOT IN ('id', 'created_at', 'updated_at');
      `, [ALLOWED_SCHEMAS]);
      const notNullCount = parseInt(notNullResult.rows[0].notnull_count) || 0;
      bestPracticesScore += Math.min(30, notNullCount * 2); // Max 30 points for NOT NULL
      
      // Check for table comments (documentation)
      const commentResult = await pool.query(`
        SELECT COUNT(*) as comment_count
        FROM pg_tables t
        WHERE t.schemaname = ANY($1)
          AND obj_description((t.schemaname || '.' || t.tablename)::regclass, 'pg_class') IS NOT NULL;
      `, [ALLOWED_SCHEMAS]);
      const commentCount = parseInt(commentResult.rows[0].comment_count) || 0;
      bestPracticesScore += Math.min(20, commentCount * 10); // Max 20 points for documentation
      
      // Check for environment variable usage (no hardcoded secrets)
      const serverFile = path.join(routesDir, 'app/server.js');
      if (fs.existsSync(serverFile)) {
        const serverContent = fs.readFileSync(serverFile, 'utf8');
        const hasEnvConfig = serverContent.includes('process.env') || serverContent.includes('config.');
        const noHardcodedSecrets = !serverContent.match(/(password|secret|key)\s*=\s*['"][^'"]{8,}['"]/i);
        if (hasEnvConfig && noHardcodedSecrets) {
          bestPracticesScore += 20; // 20 points for proper env usage
        }
      }
      
      bestPracticesScore = Math.min(100, bestPracticesScore); // Cap at 100

      // Calculate overall score
      const overallScore = Math.round(
        (databaseSchemaScore * 0.20) +
        (migrationConsistencyScore * 0.15) +
        (endpointArchitectureScore * 0.20) +
        (securityScore * 0.20) +
        (rlsScore * 0.15) +
        (bestPracticesScore * 0.10)
      );

      // Generate action plan
      const actionPlan = {
        p0_critical: [],
        p1_high: [],
        p2_medium: []
      };

      // Add actions based on issues
      if (missingTables > 0) {
        actionPlan.p0_critical.push({
          title: `${missingTables} Tablo Eksik`,
          description: `BACKEND_PHASE_PLAN'e göre ${missingTables} tablo eksik. Migration'ları kontrol edin.`,
          details: 'core.api_keys, core.projects, app.generic_data, core.sequences gibi tablolar eksik olabilir.'
        });
      }

      if (currentEndpoints > targetEndpoints) {
        actionPlan.p0_critical.push({
          title: 'Endpoint Consolidation Gerekli',
          description: `${currentEndpoints - targetEndpoints} fazla endpoint var. Generic pattern'e geçilmeli.`,
          details: 'SMART_ENDPOINT_STRATEGY_V2\'ye göre 17 endpoint hedefleniyor, şu an ' + currentEndpoints + ' endpoint var.'
        });
      }

      if (!securityChecks.hmac) {
        actionPlan.p1_high.push({
          title: 'HMAC Implementation',
          description: 'Server-to-server ve compute endpoint\'leri için HMAC imzalama eklenmeli.',
          details: 'Replay attack koruması için X-Timestamp, X-Nonce, X-Signature header\'ları implement edilmeli.'
        });
      }

      if (!securityChecks.scopes) {
        actionPlan.p1_high.push({
          title: 'Scopes System',
          description: 'API key bazlı scope sistemi kurulmalı (projects:read, users:write vb.)',
          details: 'core.api_keys tablosuna scopes TEXT[] kolonu eklenmeli ve middleware yazılmalı.'
        });
      }

      if (!securityChecks.cursor_security) {
        actionPlan.p1_high.push({
          title: 'Cursor Security',
          description: 'Pagination için HMAC-signed cursor implementasyonu gerekli.',
          details: 'Offset pagination yerine cursor-based pagination (HMAC-signed, 1h expiry, PII forbidden).'
        });
      }

      if (!securityChecks.admin_mfa) {
        actionPlan.p1_high.push({
          title: 'Admin MFA',
          description: 'Admin endpoint\'leri için MFA (TOTP) zorunlu hale getirilmeli.',
          details: '/admin endpoint\'lerine erişim için MFA kontrolü eklenmeli.'
        });
      }

      if (!securityChecks.error_standardization) {
        actionPlan.p0_critical.push({
          title: 'Error Response Standardization',
          description: 'Tüm endpoint\'lerde standart error format kullanılmalı.',
          details: '{ error: { code, message, details }, request_id } formatında 30+ error code tanımlanmalı.'
        });
      }

      // 7. API Key Architecture Check (REAL DATA - Check database columns)
      const apiKeyColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'core' 
          AND table_name = 'users' 
          AND column_name IN ('api_key', 'api_key_hash', 'api_password', 'scopes', 'ip_allowlist', 'api_key_created_at', 'api_key_last_used_at');
      `);
      
      const apiKeyFeatures = {
        opak_format: false, // Currently using plain format
        key_id_uuid: false, // Not implemented yet
        label: false, // No label column
        created_by: false, // No created_by column
        rotated_from_key_id: false, // No rotation tracking
        scopes: apiKeyColumns.rows.some(r => r.column_name === 'scopes'),
        ip_allowlist: apiKeyColumns.rows.some(r => r.column_name === 'ip_allowlist'),
        expires_at: false, // No expiry column
        api_key_exists: apiKeyColumns.rows.some(r => r.column_name === 'api_key'),
        api_password_exists: apiKeyColumns.rows.some(r => r.column_name === 'api_password')
      };
      
      const apiKeyScore = (Object.values(apiKeyFeatures).filter(Boolean).length / Object.keys(apiKeyFeatures).length) * 100;

      // 8. Authentication Usage Analysis (REAL DATA - Scan route files)
      const authUsageAnalysis = [];
      
      // Scan route files in routes.OLD directory
      const routeFilesDir = path.join(routesDir, 'routes.OLD');
      const authRouteFiles = fs.readdirSync(routeFilesDir).filter(f => f.endsWith('.js') && f !== 'admin.js');
      
      for (const file of authRouteFiles) {
        const filePath = path.join(routeFilesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find all router definitions
        const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"],\s*(authenticate\w+)?/g;
        let match;
        
        while ((match = routerRegex.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          const endpoint = match[2];
          const middleware = match[3] || null;
          
          let currentAuth = 'none';
          let expectedAuth = 'api_key';
          
          // Determine current auth
          if (middleware === 'authenticateJWT' || middleware === 'authenticateJwtOrApiKey') {
            currentAuth = 'jwt';
          } else if (middleware === 'authenticateApiKey') {
            currentAuth = 'api_key';
          }
          
          // Determine expected auth
          if (file === 'auth.js' && (endpoint === '/login' || endpoint === '/register' || endpoint === '/me')) {
            expectedAuth = 'jwt';
          } else if (file === 'health.js') {
            expectedAuth = 'none';
          } else {
            expectedAuth = 'api_key';
          }
          
          const isCorrect = currentAuth === expectedAuth;
          
          // Determine endpoint prefix from filename
          let prefix = '';
          if (file === 'auth.js') prefix = '/auth';
          else if (file === 'api-keys.js') prefix = '/api-keys';
          else if (file === 'projects.js') prefix = '/projects';
          else if (file === 'generic-data.js') prefix = '/generic-data';
          
          authUsageAnalysis.push({
            endpoint: `/api/v1${prefix}${endpoint}`,
            method,
            current_auth: currentAuth,
            expected_auth: expectedAuth,
            status: isCorrect ? 'correct' : (currentAuth === 'none' ? 'missing' : 'wrong')
          });
        }
      }
      
      // Calculate auth usage stats
      const authStats = {
        total: authUsageAnalysis.length,
        correct: authUsageAnalysis.filter(a => a.status === 'correct').length,
        wrong: authUsageAnalysis.filter(a => a.status === 'wrong').length,
        missing: authUsageAnalysis.filter(a => a.status === 'missing').length
      };
      
      // 9. API Key Implementation Details
      const apiKeyImplementation = [
        {
          feature: 'API Key Storage',
          status: apiKeyFeatures.api_key_exists ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'api_key',
          notes: apiKeyFeatures.api_key_exists ? 'VARCHAR(100), format: hzm_xxxxx' : 'Column not found'
        },
        {
          feature: 'API Password',
          status: apiKeyFeatures.api_password_exists ? 'warning' : 'missing',
          table: 'core.users',
          column: 'api_password',
          notes: apiKeyFeatures.api_password_exists ? '⚠️ Plaintext - Should be hashed (Argon2id)' : 'Column not found'
        },
        {
          feature: 'API Key Created At',
          status: apiKeyColumns.rows.some(r => r.column_name === 'api_key_created_at') ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'api_key_created_at',
          notes: 'TIMESTAMP'
        },
        {
          feature: 'API Key Last Used',
          status: apiKeyColumns.rows.some(r => r.column_name === 'api_key_last_used_at') ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'api_key_last_used_at',
          notes: 'Auto-updated on each request'
        },
        {
          feature: 'Scopes (Permissions)',
          status: apiKeyFeatures.scopes ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'scopes',
          notes: apiKeyFeatures.scopes ? 'TEXT[] - read/write/admin permissions' : 'Phase 2 - Not yet implemented'
        },
        {
          feature: 'IP Allowlist',
          status: apiKeyFeatures.ip_allowlist ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'ip_allowlist',
          notes: apiKeyFeatures.ip_allowlist ? 'INET[] - Restrict by IP' : 'Phase 2 - Not yet implemented'
        },
        {
          feature: 'Rate Limiting',
          status: hasRedis ? 'implemented' : 'missing',
          table: '-',
          column: '-',
          notes: hasRedis ? 'Redis-based rate limiting' : 'Phase 2 - Requires Redis'
        },
        {
          feature: 'Expiry Date',
          status: apiKeyFeatures.expires_at ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'expires_at',
          notes: 'Phase 3 - Auto-expire keys after X days'
        },
        {
          feature: 'Key Rotation',
          status: apiKeyFeatures.rotated_from_key_id ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'rotated_from_key_id',
          notes: 'Phase 3 - Track key rotation history'
        },
        {
          feature: 'Key Label',
          status: apiKeyFeatures.label ? 'implemented' : 'missing',
          table: 'core.users',
          column: 'label',
          notes: 'Phase 3 - User-friendly key names'
        }
      ];
      
      // 10. Priority Actions (Enhanced)
      const priorityActions = [
        {
          priority: 'p0',
          title: 'Hash API Password',
          description: 'API Password is stored in plaintext. Use Argon2id hashing.',
          phase: 'Phase 1',
          status: apiKeyFeatures.api_password_exists && !apiKeyColumns.rows.some(r => r.column_name === 'api_password_hash') ? 'pending' : 'done',
          impact: 'Security risk - Passwords visible in DB'
        },
        {
          priority: 'p1',
          title: 'Migrate Admin Endpoints to API Key',
          description: '/admin/database and other admin endpoints should use API Key instead of JWT',
          phase: 'Phase 2',
          status: authUsageAnalysis.some(a => a.endpoint.includes('/admin') && a.current_auth === 'jwt') ? 'pending' : 'done',
          impact: 'JWT should only be for web sessions, not programmatic access'
        },
        {
          priority: 'p1',
          title: 'Migrate CRUD Endpoints to API Key',
          description: '/projects/*, /generic-data/* should use API Key instead of JWT',
          phase: 'Phase 2',
          status: authStats.wrong > 3 ? 'pending' : 'done',
          impact: 'Consistency - All non-auth endpoints should use API Key'
        },
        {
          priority: 'p2',
          title: 'Implement Scopes System',
          description: 'Add role-based permissions (read/write/admin) to API keys',
          phase: 'Phase 2',
          status: apiKeyFeatures.scopes ? 'done' : 'pending',
          impact: 'Fine-grained access control'
        },
        {
          priority: 'p2',
          title: 'Implement IP Allowlist',
          description: 'Restrict API key usage by IP address',
          phase: 'Phase 2',
          status: apiKeyFeatures.ip_allowlist ? 'done' : 'pending',
          impact: 'Additional security layer'
        },
        {
          priority: 'p2',
          title: 'Implement Rate Limiting',
          description: 'Add Redis-based multi-tier rate limiting',
          phase: 'Phase 2',
          status: hasRedis && securityChecks.rate_limiting ? 'done' : 'pending',
          impact: 'Prevent API abuse'
        },
        {
          priority: 'p3',
          title: 'API Key Expiry',
          description: 'Auto-expire keys after X days for security',
          phase: 'Phase 3',
          status: apiKeyFeatures.expires_at ? 'done' : 'pending',
          impact: 'Enforce key rotation'
        }
      ];

      return {
        overall_score: overallScore,
        category_scores: {
          database_schema: databaseSchemaScore,
          migration_consistency: migrationConsistencyScore,
          endpoint_architecture: endpointArchitectureScore,
          security_implementation: Math.round(securityScore),
          rls_multi_tenancy: rlsScore,
          best_practices: bestPracticesScore
        },
        database_analysis: {
          tables: {
            expected: expectedTables,
            actual: actualTables,
            missing: missingTables
          },
          columns: {
            mismatches: [] // Real column comparison is in Migration Report
          },
          seed_data: {
            missing: [] // Real seed data check is in Migration Report
          }
        },
        endpoint_analysis: {
          total: currentEndpoints,
          target: targetEndpoints,
          extra: currentEndpoints > targetEndpoints ? endpointList : [],
          missing: [] // Detected by comparing with SMART_ENDPOINT_STRATEGY_V2
        },
        api_key_architecture: {
          format_compliance: Math.round(apiKeyScore),
          features: apiKeyFeatures
        },
        security_checklist: securityChecks,
        action_plan: actionPlan,
        authentication_usage: {
          endpoints: authUsageAnalysis,
          stats: authStats
        },
        api_key_implementation: apiKeyImplementation,
        priority_actions: priorityActions
      };
    } catch (error) {
      logger.error('Failed to generate architecture compliance report:', error);
      return {
        error: 'Failed to generate architecture compliance report',
        message: error.message,
        overall_score: 0,
        category_scores: {
          database_schema: 0,
          migration_consistency: 0,
          endpoint_architecture: 0,
          security_implementation: 0,
          rls_multi_tenancy: 0,
          best_practices: 0
        },
        database_analysis: { tables: { expected: 0, actual: 0, missing: 0 }, columns: { mismatches: [] }, seed_data: { missing: [] } },
        endpoint_analysis: { total: 0, target: 0, extra: [], missing: [] },
        api_key_architecture: { format_compliance: 0, features: {} },
        security_checklist: {},
        action_plan: { p0_critical: [], p1_high: [], p2_medium: [] },
        authentication_usage: { endpoints: [], stats: { total: 0, correct: 0, wrong: 0, missing: 0 } },
        api_key_implementation: [],
        priority_actions: []
      };
    }
  }
}

module.exports = ArchitectureComplianceService;
