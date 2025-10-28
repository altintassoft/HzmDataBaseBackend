const pool = require('../../../core/config/database');
const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];

/**
 * Wrong Progress Service
 * Detect anti-patterns, security issues, and code quality problems
 */
class WrongProgressService {
  /**
   * Get wrong progress report
   * @returns {Object} Report with summary, issues, categories
   */
  static async getWrongProgress() {
    try {
      logger.info('Generating wrong progress report...');
      
      const issues = [];
      
      // ========================================================================
      // 1. ENDPOINT ANTI-PATTERNS (Scan route files)
      // ========================================================================
      const routesDir = path.join(__dirname, '../../../routes.OLD');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
      
      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for JWT usage
        if (content.includes('authenticateJWT') && file !== 'auth.js') {
          issues.push({
            priority: 'P1',
            category: 'Endpoint Anti-Pattern',
            file: `/routes.OLD/${file}`,
            issue: 'JWT authentication detected (should use API Key)',
            suggestion: 'Replace authenticateJWT with authenticateApiKey',
            action: 'REFACTOR',
            line: null
          });
        }
        
        // Check for individual CRUD endpoints (should use generic /data/:resource)
        const individualPatterns = [
          /router\.(get|post|put|delete)\(['"]\/users\/:id/i,
          /router\.(get|post|put|delete)\(['"]\/companies\/:id/i,
          /router\.(get|post|put|delete)\(['"]\/projects\/:id/i
        ];
        
        individualPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            const match = content.match(pattern);
            if (match) {
              issues.push({
                priority: 'P0',
                category: 'Endpoint Anti-Pattern',
                file: `/routes.OLD/${file}`,
                issue: `Individual endpoint detected: ${match[0]} (should use generic /data/:resource)`,
                suggestion: 'Use generic endpoint: GET/POST/PUT/DELETE /api/v1/data/:resource',
                action: 'REFACTOR',
                line: null
              });
            }
          }
        });
      }
      
      // ========================================================================
      // 2. DATABASE ISSUES (Check for tables without RLS, plan dışı tables)
      // ========================================================================
      
      // Check for tables without RLS
      const tablesWithoutRLS = await pool.query(`
        SELECT 
          schemaname,
          tablename
        FROM pg_tables
        WHERE schemaname = ANY($1)
          AND tablename NOT IN (
            SELECT tablename 
            FROM pg_policies 
            WHERE schemaname = ANY($1)
          )
        ORDER BY schemaname, tablename;
      `, [ALLOWED_SCHEMAS]);
      
      if (tablesWithoutRLS.rows.length > 0) {
        tablesWithoutRLS.rows.forEach(row => {
          // Skip migration tracking table
          if (row.schemaname === 'public' && row.tablename === 'schema_migrations') return;
          
          issues.push({
            priority: 'P1',
            category: 'Database Security',
            file: `${row.schemaname}.${row.tablename}`,
            issue: 'Table without Row Level Security (RLS)',
            suggestion: 'Add RLS policies for tenant isolation',
            action: 'FIX',
            line: null
          });
        });
      }
      
      // Check for plan dışı schemas
      const allSchemas = await pool.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name;
      `);
      
      allSchemas.rows.forEach(row => {
        if (!ALLOWED_SCHEMAS.includes(row.schema_name) && row.schema_name !== 'public') {
          issues.push({
            priority: 'P2',
            category: 'Database Architecture',
            file: `schema: ${row.schema_name}`,
            issue: 'Schema not in ALLOWED_SCHEMAS list',
            suggestion: 'Add to ALLOWED_SCHEMAS or remove if unnecessary',
            action: 'REVIEW',
            line: null
          });
        }
      });
      
      // ========================================================================
      // 3. HARDCODED VALUES (Scan backend files for common anti-patterns)
      // ========================================================================
      
      const srcDir = path.join(__dirname, '../../..');
      const scanForHardcodedValues = (dir) => {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            scanForHardcodedValues(filePath);
          } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, idx) => {
              // Check for hardcoded DB URLs
              if (line.includes('postgres://') && !line.includes('process.env')) {
                issues.push({
                  priority: 'P0',
                  category: 'Security Risk',
                  file: path.relative(srcDir, filePath),
                  issue: 'Hard-coded database URL detected',
                  suggestion: 'Use environment variable: process.env.DATABASE_URL',
                  action: 'FIX',
                  line: idx + 1
                });
              }
              
              // Check for hardcoded API keys
              if (/['"]hzm_[a-f0-9]{32}['"]/.test(line) && !line.includes('process.env')) {
                issues.push({
                  priority: 'P0',
                  category: 'Security Risk',
                  file: path.relative(srcDir, filePath),
                  issue: 'Hard-coded API key detected',
                  suggestion: 'Use environment variable',
                  action: 'FIX',
                  line: idx + 1
                });
              }
              
              // Check for console.log (should use logger)
              if (line.includes('console.log') && !line.includes('//')) {
                issues.push({
                  priority: 'P2',
                  category: 'Code Quality',
                  file: path.relative(srcDir, filePath),
                  issue: 'console.log detected (should use logger)',
                  suggestion: 'Replace with logger.info() or logger.debug()',
                  action: 'IMPROVE',
                  line: idx + 1
                });
              }
            });
          }
        });
      };
      
      // Only scan routes and middleware (avoid scanning migrations)
      scanForHardcodedValues(path.join(srcDir, 'routes.OLD'));
      if (fs.existsSync(path.join(srcDir, 'middleware'))) {
        scanForHardcodedValues(path.join(srcDir, 'middleware'));
      }
      
      // ========================================================================
      // 4. CALCULATE SUMMARY
      // ========================================================================
      
      const p0 = issues.filter(i => i.priority === 'P0').length;
      const p1 = issues.filter(i => i.priority === 'P1').length;
      const p2 = issues.filter(i => i.priority === 'P2').length;
      const totalIssues = p0 + p1 + p2;
      
      // Calculate clean items (estimate based on total scanned items)
      const totalEndpoints = 34; // From endpoint compliance report
      const totalTables = await pool.query(`
        SELECT COUNT(*) as count
        FROM pg_tables
        WHERE schemaname = ANY($1);
      `, [ALLOWED_SCHEMAS]);
      
      const totalItems = totalEndpoints + parseInt(totalTables.rows[0].count) + 20; // +20 for other checks
      const clean = totalItems - totalIssues;
      const score = totalItems > 0 ? Math.round((clean / totalItems) * 100) : 100;
      
      // Group by category
      const categories = {};
      issues.forEach(issue => {
        if (!categories[issue.category]) {
          categories[issue.category] = 0;
        }
        categories[issue.category]++;
      });

      logger.info(`Wrong progress report generated: ${totalIssues} issues found (P0:${p0}, P1:${p1}, P2:${p2}), score: ${score}%`);

      return {
        summary: { p0, p1, p2, clean, score },
        issues: issues.sort((a, b) => {
          const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
        categories,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to generate wrong progress:', error);
      return {
        error: 'Failed to generate wrong progress',
        message: error.message,
        summary: { p0: 0, p1: 0, p2: 0, clean: 0, score: 100 },
        issues: [],
        categories: {},
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = WrongProgressService;
