const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];
const MIGRATIONS_DIR = path.join(__dirname, '../../../../migrations');

/**
 * Table Comparison Service
 * Compare expected tables (from migrations) vs actual (from DB)
 */
class TableComparisonService {
  /**
   * Get table comparison
   * @returns {Object} Comparison report with summary and tables
   */
  static async getTableComparison() {
    try {
      logger.info('Generating table comparison report...');
      
      // 1. Get expected tables from migration files
      const expectedTables = new Set();
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of migrationFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse CREATE TABLE statements
        // Matches: CREATE TABLE [IF NOT EXISTS] schema.table
        const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)\.([a-z_]+)/gi;
        let match;
        
        while ((match = createTableRegex.exec(content)) !== null) {
          const schema = match[1];
          const table = match[2];
          const fullName = `${schema}.${table}`;
          
          // Track tables in allowed schemas
          // Exception: Allow public.schema_migrations (migration tracking table)
          if (ALLOWED_SCHEMAS.includes(schema) || fullName === 'public.schema_migrations') {
            expectedTables.add(fullName);
          }
        }
      }
      
      // 2. Get actual tables from database (include public schema for schema_migrations)
      const schemasToCheck = [...ALLOWED_SCHEMAS, 'public'];
      const actualTablesResult = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname = ANY($1)
        ORDER BY schemaname, tablename;
      `, [schemasToCheck]);
      
      const actualTables = new Map();
      for (const row of actualTablesResult.rows) {
        const fullName = `${row.schemaname}.${row.tablename}`;
        
        // Filter: Only allow tables in ALLOWED_SCHEMAS or public.schema_migrations
        if (ALLOWED_SCHEMAS.includes(row.schemaname) || fullName === 'public.schema_migrations') {
          actualTables.set(fullName, {
            schema: row.schemaname,
            table: row.tablename,
            size: row.size
          });
        }
      }
      
      // 3. Compare and categorize
      const comparison = [];
      const expectedArray = Array.from(expectedTables).sort();
      const actualArray = Array.from(actualTables.keys()).sort();
      
      // All unique tables (expected or actual)
      const allTables = new Set([...expectedArray, ...actualArray]);
      
      for (const fullName of Array.from(allTables).sort()) {
        const inCode = expectedTables.has(fullName);
        const inBackend = actualTables.has(fullName);
        const tableInfo = actualTables.get(fullName);
        
        let status;
        if (inCode && inBackend) {
          status = 'match'; // ✅ UYUMLU
        } else if (inCode && !inBackend) {
          status = 'missing'; // ⚠️ MIGRATION GEREKLI
        } else if (!inCode && inBackend) {
          status = 'extra'; // 🔴 FAZLADAN
        }
        
        comparison.push({
          table: fullName,
          schema: fullName.split('.')[0],
          tableName: fullName.split('.')[1],
          inCode,
          inBackend,
          status,
          size: tableInfo ? tableInfo.size : '-'
        });
      }
      
      // 4. Calculate stats
      const stats = {
        total: comparison.length,
        expected: expectedArray.length,
        actual: actualArray.length,
        match: comparison.filter(t => t.status === 'match').length,
        missing: comparison.filter(t => t.status === 'missing').length,
        extra: comparison.filter(t => t.status === 'extra').length
      };
      
      // ✅ Frontend-compatible response format
      return {
        summary: {
          totalExpected: stats.expected,
          totalActual: stats.actual,
          matching: stats.match,
          missing: stats.missing,
          extra: stats.extra
        },
        tables: comparison.map(t => ({
          schema: t.schema,
          table: t.tableName,
          expectedColumns: 0, // Will be enhanced in Phase 2
          actualColumns: 0,   // Will be enhanced in Phase 2
          status: t.status === 'match' ? 'matching' : t.status,
          missingColumns: [],
          extraColumns: [],
          details: `Size: ${t.size} | In Code: ${t.inCode} | In Backend: ${t.inBackend}`
        })),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Failed to generate table comparison:', error);
      return {
        error: 'Failed to generate table comparison',
        message: error.message,
        summary: {
          totalExpected: 0,
          totalActual: 0,
          matching: 0,
          missing: 0,
          extra: 0
        },
        tables: [],
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = TableComparisonService;
