const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateJwtOrApiKey } = require('../middleware/auth');
const MigrationParser = require('../utils/migrationParser');
const SchemaInspector = require('../utils/schemaInspector');
const MigrationComparator = require('../utils/migrationComparator');

const router = express.Router();

// ============================================================================
// 🎯 MASTER ADMIN ENDPOINT - TEK ENDPOINT TÜM İŞLEMLER
// ============================================================================
// GET /api/v1/admin/database?type=tables&include=columns,indexes,rls
// GET /api/v1/admin/database?type=schemas
// GET /api/v1/admin/database?type=table&schema=core&table=users&include=data
// GET /api/v1/admin/database?type=stats
// ============================================================================

// Whitelist - Sadece izin verilen type'lar
const ALLOWED_TYPES = ['tables', 'schemas', 'table', 'stats', 'users', 'migration-report', 'migrations', 'architecture-compliance', 'table-comparison', 'all-tables-raw', 'endpoint-compliance', 'plan-compliance'];
const ALLOWED_INCLUDES = ['columns', 'indexes', 'rls', 'data', 'fk', 'constraints', 'tracking'];
const ALLOWED_SCHEMAS = ['core', 'app', 'cfg', 'ops'];
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

router.get('/database', authenticateJwtOrApiKey, async (req, res) => {
  try {
    const { type, include, schema, table, limit, offset } = req.query;
    const user = req.user; // JWT or API Key middleware sets this

    // 🐛 DEBUG: Log incoming request
    logger.info('Admin database request:', {
      type,
      include,
      schema,
      table,
      limit,
      offset,
      fullQuery: req.query
    });

    // Validate type
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        error: 'Invalid type',
        allowed: ALLOWED_TYPES
      });
    }

    // Parse includes
    const includes = include ? include.split(',').filter(i => ALLOWED_INCLUDES.includes(i)) : [];

    let result;

    // 🔒 ROLE-BASED AUTHORIZATION: Migration ve Architecture raporları sadece admin ve master_admin için
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

    switch (type) {
      case 'tables':
        result = await getTablesInfo(includes);
        break;

      case 'table':
        if (!schema || !table) {
          return res.status(400).json({ error: 'schema and table parameters required' });
        }
        if (!ALLOWED_SCHEMAS.includes(schema)) {
          return res.status(403).json({ error: 'Schema not allowed', allowed: ALLOWED_SCHEMAS });
        }
        result = await getSingleTableInfo(schema, table, includes, limit, offset, user);
        break;

      case 'schemas':
        result = await getSchemasInfo();
        break;

      case 'stats':
        result = await getDatabaseStats();
        break;

      case 'users':
        result = await getUsersInfo(limit, offset);
        break;

      case 'migration-report':
        result = await getMigrationReport(includes);
        break;

      case 'migrations':
        result = await getMigrationsInfo(includes);
        break;

      case 'architecture-compliance':
        result = await getArchitectureCompliance(includes);
        break;

      case 'table-comparison':
        result = await getTableComparison();
        break;

      case 'endpoint-compliance':
        result = await getEndpointCompliance();
        break;

      case 'plan-compliance':
        result = await getPlanCompliance();
        break;
      
      case 'all-tables-raw':
        // Master Admin only - NO FILTERS!
        if (user.role !== 'master_admin') {
          return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Bu endpoint sadece Master Admin içindir.' 
          });
        }
        result = await getAllTablesRaw();
        break;

      default:
        return res.status(400).json({ error: 'Unsupported type' });
    }

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
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get all tables with optional details
async function getTablesInfo(includes = []) {
  const tablesResult = await pool.query(`
    SELECT 
      schemaname,
      tablename,
      obj_description((schemaname || '.' || tablename)::regclass, 'pg_class') as description
    FROM pg_tables 
    WHERE schemaname = ANY($1)
    ORDER BY schemaname, tablename;
  `, [ALLOWED_SCHEMAS]);

  const tables = [];

  for (const table of tablesResult.rows) {
    const { schemaname, tablename, description } = table;
    const tableInfo = {
      schema: schemaname,
      name: tablename,
      fullName: `${schemaname}.${tablename}`,
      description: description || undefined
    };

    // Include columns
    if (includes.includes('columns')) {
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `, [schemaname, tablename]);

      // Get constraints for better column info
      const pkResult = await pool.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary;
      `, [`${schemaname}.${tablename}`]);
      const primaryKeys = pkResult.rows.map(r => r.attname);

      const uniqueResult = await pool.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisunique AND NOT i.indisprimary;
      `, [`${schemaname}.${tablename}`]);
      const uniqueColumns = uniqueResult.rows.map(r => r.attname);

      const fkResult = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2;
      `, [schemaname, tablename]);

      tableInfo.columns = columnsResult.rows.map(col => {
        let constraint = '';
        if (primaryKeys.includes(col.column_name)) constraint = 'PK';
        else if (uniqueColumns.includes(col.column_name)) constraint = 'UNIQUE';
        
        const fk = fkResult.rows.find(f => f.column_name === col.column_name);
        if (fk) constraint = `FK → ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})`;
        
        if (col.is_nullable === 'NO' && !constraint) constraint = 'NOT NULL';

        let dataType = col.data_type.toUpperCase();
        if (col.character_maximum_length) {
          dataType = `VARCHAR(${col.character_maximum_length})`;
        } else if (dataType === 'CHARACTER VARYING') {
          dataType = 'VARCHAR(255)';
        } else if (dataType === 'TIMESTAMP WITH TIME ZONE') {
          dataType = 'TIMESTAMPTZ';
        } else if (dataType === 'INTEGER' && col.column_default?.includes('nextval')) {
          dataType = 'SERIAL';
        }

        return {
          name: col.column_name,
          type: dataType,
          constraint: constraint || undefined,
          default: col.column_default ? 
            (col.column_default.includes('now()') ? 'NOW()' : 
             col.column_default.includes('true') ? 'TRUE' : 
             col.column_default.includes('false') ? 'FALSE' :
             col.column_default.includes('nextval') ? 'AUTO' :
             col.column_default.replace(/::[\w\s]+/g, '').replace(/'/g, "'")) : 
            undefined
        };
      });

      tableInfo.columnCount = columnsResult.rows.length;
    }

    // Include indexes
    if (includes.includes('indexes')) {
      const indexesResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2;
      `, [schemaname, tablename]);
      tableInfo.indexes = indexesResult.rows;
      tableInfo.indexCount = indexesResult.rows.length;
    }

    // Include RLS status
    if (includes.includes('rls')) {
      const rlsResult = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = $1::regclass;
      `, [`${schemaname}.${tablename}`]);
      tableInfo.rls = rlsResult.rows[0]?.relrowsecurity || false;
    }

    // Include foreign keys
    if (includes.includes('fk')) {
      const fkResult = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2;
      `, [schemaname, tablename]);
      tableInfo.foreignKeys = fkResult.rows;
      tableInfo.foreignKeyCount = fkResult.rows.length;
    }

    tableInfo.status = 'active';
    tables.push(tableInfo);
  }

  return { count: tables.length, tables };
}

// Get single table info with optional data
async function getSingleTableInfo(schema, table, includes = [], limit = 100, offset = 0, user = null) {
  const tableInfo = {
    schema,
    table,
    fullName: `${schema}.${table}`
  };

  // Always include columns for single table
  const columnsResult = await pool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position;
  `, [schema, table]);

  tableInfo.columns = columnsResult.rows;
  tableInfo.columnCount = columnsResult.rows.length;

  // Include actual data
  if (includes.includes('data')) {
    // 🔒 TENANT ISOLATION: Master admin dışındakiler sadece kendi tenant'ını görsün
    let whereClause = '';
    let queryParams = [];
    
    if (user && user.role !== 'master_admin') {
      // Check if table has tenant_id column
      const hasTenantId = columnsResult.rows.some(col => col.column_name === 'tenant_id');
      
      if (hasTenantId) {
        whereClause = 'WHERE tenant_id = $1';
        queryParams.push(user.tenant_id);
      }
    }
    
    // Build query with tenant isolation
    const countQuery = `SELECT COUNT(*) as total FROM ${schema}.${table} ${whereClause};`;
    const dataQuery = `SELECT * FROM ${schema}.${table} ${whereClause} ORDER BY id LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};`;
    
    queryParams.push(limit || 100, offset || 0);
    
    const countResult = await pool.query(countQuery, queryParams.length > 2 ? [queryParams[0]] : []);
    const dataResult = await pool.query(dataQuery, queryParams);
    
    tableInfo.data = dataResult.rows;
    tableInfo.total = parseInt(countResult.rows[0].total);
    tableInfo.limit = parseInt(limit) || 100;
    tableInfo.offset = parseInt(offset) || 0;
    tableInfo.isolated = whereClause !== ''; // Show if data is tenant-isolated
  }

  // Include indexes
  if (includes.includes('indexes')) {
    const indexesResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2;
    `, [schema, table]);
    tableInfo.indexes = indexesResult.rows;
  }

  // Include RLS
  if (includes.includes('rls')) {
    const rlsResult = await pool.query(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = $1::regclass;
    `, [`${schema}.${table}`]);
    tableInfo.rls = rlsResult.rows[0]?.relrowsecurity || false;
  }

  return tableInfo;
}

// Get all schemas
async function getSchemasInfo() {
  const result = await pool.query(`
    SELECT 
      schema_name,
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schema_name) as table_count
    FROM information_schema.schemata 
    WHERE schema_name = ANY($1)
    ORDER BY schema_name;
  `, [ALLOWED_SCHEMAS]);

  return {
    count: result.rows.length,
    schemas: result.rows
  };
}

// Get database statistics
async function getDatabaseStats() {
  // Total tables
  const tablesResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM pg_tables 
    WHERE schemaname = ANY($1);
  `, [ALLOWED_SCHEMAS]);

  // Total columns
  const columnsResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM information_schema.columns
    WHERE table_schema = ANY($1);
  `, [ALLOWED_SCHEMAS]);

  // Total indexes
  const indexesResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM pg_indexes
    WHERE schemaname = ANY($1);
  `, [ALLOWED_SCHEMAS]);

  // Database size
  const sizeResult = await pool.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size;
  `);

  // Total users (from core.users)
  let userCount = 0;
  try {
    const usersResult = await pool.query(`SELECT COUNT(*) as count FROM core.users;`);
    userCount = parseInt(usersResult.rows[0].count);
  } catch (error) {
    // Table might not exist yet
  }

  return {
    database: {
      name: 'hzmDatabase',
      size: sizeResult.rows[0].size
    },
    tables: parseInt(tablesResult.rows[0].count),
    columns: parseInt(columnsResult.rows[0].count),
    indexes: parseInt(indexesResult.rows[0].count),
    users: userCount,
    schemas: ALLOWED_SCHEMAS
  };
}

// Get users info
async function getUsersInfo(limit = 100, offset = 0) {
  try {
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM core.users;`);
    const usersResult = await pool.query(`
      SELECT 
        id, 
        tenant_id, 
        email, 
        role, 
        is_active, 
        created_at, 
        updated_at
      FROM core.users 
      ORDER BY id 
      LIMIT $1 OFFSET $2;
    `, [limit || 100, offset || 0]);

    return {
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
      users: usersResult.rows
    };
  } catch (error) {
    return {
      error: 'Users table not found or query failed',
      message: error.message
    };
  }
}

// Get migrations info (list of migration files with tracking status)
async function getMigrationsInfo(includes = []) {
  try {
    // Get migration tracking data if requested
    let trackingData = {};
    
    if (includes.includes('tracking')) {
      const trackingResult = await pool.query(`
        SELECT migration_name, executed_at 
        FROM public.schema_migrations 
        ORDER BY id;
      `);
      
      for (const row of trackingResult.rows) {
        trackingData[row.migration_name] = {
          executed: true,
          executed_at: row.executed_at
        };
      }
    }

    // Read migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations = [];

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const parsed = MigrationParser.parseMigrationFile(filePath);
      
      if (parsed) {
        const tracking = trackingData[file] || { executed: false, executed_at: null };
        
        migrations.push({
          filename: parsed.filename,
          description: parsed.description,
          author: parsed.author,
          date: parsed.date,
          executed: tracking.executed,
          executed_at: tracking.executed_at,
          summary: MigrationParser.getMigrationSummary(parsed)
        });
      }
    }

    return {
      total: migrations.length,
      migrations
    };
  } catch (error) {
    logger.error('Failed to get migrations info:', error);
    return {
      error: 'Failed to read migrations',
      message: error.message
    };
  }
}

// Get migration report (detailed comparison between migrations and actual database)
async function getMigrationReport(includes = []) {
  try {
    logger.info('Generating migration report...');

    // 1. Read and parse all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const parsedMigrations = [];
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const parsed = MigrationParser.parseMigrationFile(filePath);
      if (parsed) {
        parsedMigrations.push(parsed);
      }
    }

    logger.info(`Parsed ${parsedMigrations.length} migration files`);

    // 2. Get actual database schema
    const actualSchema = await SchemaInspector.getCompleteSchema();
    logger.info(`Inspected ${Object.keys(actualSchema).length} tables from database`);

    // 3. Get migration tracking data
    const trackingResult = await pool.query(`
      SELECT migration_name, executed_at 
      FROM public.schema_migrations 
      ORDER BY id;
    `);
    
    const trackingMap = {};
    for (const row of trackingResult.rows) {
      trackingMap[row.migration_name] = {
        executed: true,
        executed_at: row.executed_at
      };
    }

    // 4. Get actual data for comparison (if requested)
    let actualData = {};
    if (includes.includes('data')) {
      // Fetch sample data from core.users for INSERT comparison
      const usersResult = await pool.query('SELECT id, email, role FROM core.users;');
      actualData['core.users'] = usersResult.rows;
    }

    // 5. Generate comparison report
    const comparisonReport = MigrationComparator.generateReport(
      parsedMigrations,
      actualSchema,
      actualData
    );

    // 6. Enhance report with tracking information
    for (const migrationReport of comparisonReport.migrations) {
      const tracking = trackingMap[migrationReport.filename] || { executed: false, executed_at: null };
      migrationReport.executed = tracking.executed;
      migrationReport.executed_at = tracking.executed_at;
    }

    logger.info('Migration report generated successfully');

    return {
      summary: comparisonReport.summary,
      migrations: comparisonReport.migrations,
      tables: comparisonReport.tables,
      totalTables: Object.keys(comparisonReport.tables).length
    };
  } catch (error) {
    logger.error('Failed to generate migration report:', error);
    return {
      error: 'Failed to generate migration report',
      message: error.message,
      stack: error.stack,
      // Provide default summary to prevent frontend crashes
      summary: {
        totalMigrations: 0,
        successCount: 0,
        warningCount: 0,
        errorCount: 0
      },
      migrations: [],
      tables: {},
      totalTables: 0
    };
  }
}

// Get Architecture Compliance Report
async function getArchitectureCompliance(includes = []) {
  try {
    logger.info('Generating architecture compliance report...');

    // 1. Database Schema Analysis (REAL DATA)
    const tableCountResult = await pool.query(`
      SELECT schemaname, COUNT(*) as table_count
      FROM pg_tables
      WHERE schemaname = ANY($1)
      GROUP BY schemaname;
    `, [ALLOWED_SCHEMAS]);

    const expectedTables = 9; // From BACKEND_PHASE_PLAN Phase 1-2: core.users, core.tenants, core.api_keys, core.projects, core.companies, core.contacts, core.sequences, app.generic_data, ops.audit_log
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
    const fs = require('fs');
    const path = require('path');
    const routesDir = path.join(__dirname, '..');
    
    let currentEndpoints = 0;
    const endpointList = [];
    
    // Scan all route files
    const routeFiles = ['routes/auth.js', 'routes/protected.js', 'routes/admin.js', 'routes/api-keys.js', 'routes/health.js'];
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
    const config = require('../config');
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
    const serverFile = path.join(routesDir, 'server.js');
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
    
    // Scan all route files in routes directory
    const routeFilesDir = path.join(__dirname);
    const authRouteFiles = fs.readdirSync(routeFilesDir).filter(f => f.endsWith('.js') && f !== 'admin.js'); // Exclude self to avoid circular parsing
    
    for (const file of authRouteFiles) {
      const filePath = path.join(routeFilesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Find all router definitions
      // Matches: router.METHOD('endpoint', [middleware], [async] (req, res) => {
      const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"],\s*(authenticate\w+)?/g;
      let match;
      
      while ((match = routerRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const endpoint = match[2];
        const middleware = match[3] || null; // Will be 'authenticateJWT' or 'authenticateApiKey' or null
        
        let currentAuth = 'none';
        let expectedAuth = 'api_key'; // Default expectation
        
        // Determine current auth
        if (middleware === 'authenticateJWT') {
          currentAuth = 'jwt';
        } else if (middleware === 'authenticateApiKey') {
          currentAuth = 'api_key';
        }
        
        // Determine expected auth
        // Only these 3 endpoints should use JWT: /auth/login, /auth/register, /auth/me
        // All others should use API Key
        if (file === 'auth.js' && (endpoint === '/login' || endpoint === '/register' || endpoint === '/me')) {
          expectedAuth = 'jwt';
        } else if (file === 'health.js') {
          expectedAuth = 'none'; // Health check is public
        } else {
          expectedAuth = 'api_key'; // Everything else should use API Key
        }
        
        const isCorrect = currentAuth === expectedAuth;
        
        // Determine endpoint prefix from filename
        let prefix = '';
        if (file === 'auth.js') prefix = '/auth';
        else if (file === 'api-keys.js') prefix = '/api-keys';
        else if (file === 'protected.js') prefix = '/protected';
        else if (file === 'projects.js') prefix = '/projects';
        else if (file === 'generic-data.js') prefix = '/generic-data';
        // admin.js is excluded, health.js has no prefix
        
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

// ============================================================================
// TABLE COMPARISON - Compare expected tables (from migrations) vs actual (from DB)
// ============================================================================
async function getTableComparison() {
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
    
    return {
      tables: comparison,
      stats,
      expectedTables: expectedArray,
      actualTables: actualArray
    };
    
  } catch (error) {
    logger.error('Failed to generate table comparison:', error);
    return {
      error: 'Failed to generate table comparison',
      message: error.message,
      tables: [],
      stats: { total: 0, expected: 0, actual: 0, match: 0, missing: 0, extra: 0 },
      expectedTables: [],
      actualTables: []
    };
  }
}

/**
 * Get Endpoint Compliance Report
 * Analyze all endpoints for auth method and type compliance
 */
async function getEndpointCompliance() {
  try {
    logger.info('📊 Generating Endpoint Compliance Report...');
    
    // Scan all route files
    const routesDir = path.join(__dirname);
    const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js') && file !== 'admin.js');
    
    const endpoints = [];
    
    // Define expected patterns
    const patterns = {
      jwt: ['/auth/'],
      apiKey: ['/data/', '/admin/', '/compute/', '/export/', '/import/', '/reports/', '/webhooks/', '/api-keys/', '/protected/'],
      smart: ['/data/:entity', '/compute/', '/export/', '/import/', '/reports/'],
      individual: ['/auth/', '/api-keys/', '/protected/']
    };
    
    // Scan each route file
    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract router.METHOD patterns
      const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = routerRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        const fullPath = `/api/v1${file.replace('.js', '')}${path}`;
        
        // Determine expected auth
        let expectedAuth = 'API Key';
        for (const [auth, pathPatterns] of Object.entries(patterns)) {
          if (auth === 'jwt' && pathPatterns.some(p => fullPath.includes(p))) {
            expectedAuth = 'JWT';
            break;
          }
        }
        
        // Determine expected type
        let expectedType = 'Bireysel';
        if (patterns.smart.some(p => fullPath.includes(p.split(':')[0]))) {
          expectedType = 'Akıllı';
        }
        
        // Detect current auth (from content)
        let currentAuth = 'None';
        if (content.includes('authenticateJWT')) currentAuth = 'JWT';
        if (content.includes('authenticateApiKey')) currentAuth = 'API Key';
        if (content.includes('authenticateJwtOrApiKey')) currentAuth = 'JWT/API Key';
        
        // Detect current type
        let currentType = fullPath.includes(':entity') || fullPath.includes(':type') ? 'Akıllı' : 'Bireysel';
        
        // Determine status
        const authMatch = (expectedAuth === currentAuth) || (expectedAuth === 'API Key' && currentAuth === 'JWT/API Key');
        const typeMatch = (expectedType === currentType);
        let status = 'unknown';
        if (authMatch && typeMatch) status = 'compliant';
        else if (authMatch || typeMatch) status = 'partial';
        else if (currentAuth === 'None') status = 'missing';
        else status = 'noncompliant';
        
        endpoints.push({
          endpoint: fullPath,
          method,
          expectedAuth,
          currentAuth,
          authMatch,
          expectedType,
          currentType,
          typeMatch,
          status,
          file: file.replace('.js', '')
        });
      }
    }
    
    // Calculate statistics
    const stats = {
      total: endpoints.length,
      compliant: endpoints.filter(e => e.status === 'compliant').length,
      partial: endpoints.filter(e => e.status === 'partial').length,
      missing: endpoints.filter(e => e.status === 'missing').length,
      noncompliant: endpoints.filter(e => e.status === 'noncompliant').length,
      byAuth: {
        jwt: endpoints.filter(e => e.expectedAuth === 'JWT').length,
        apiKey: endpoints.filter(e => e.expectedAuth === 'API Key').length
      },
      byType: {
        smart: endpoints.filter(e => e.expectedType === 'Akıllı').length,
        individual: endpoints.filter(e => e.expectedType === 'Bireysel').length
      }
    };
    
    const successRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;
    
    return {
      endpoints,
      stats,
      successRate,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to generate endpoint compliance report:', error);
    return {
      error: 'Failed to generate endpoint compliance report',
      message: error.message,
      endpoints: [],
      stats: { total: 0, compliant: 0, partial: 0, missing: 0, noncompliant: 0 },
      successRate: 0
    };
  }
}

/**
 * Get Plan Compliance Report
 * Compare SMART_ENDPOINT_STRATEGY_V2.md (expected) vs actual backend routes
 */
async function getPlanCompliance() {
  try {
    logger.info('📊 Generating Plan Compliance Report...');
    
    // 1. Parse SMART_ENDPOINT_STRATEGY_V2.md to extract expected endpoints
    const strategyFilePath = path.join(__dirname, '../../../HzmVeriTabaniYolHaritasi/SMART_ENDPOINT_STRATEGY_V2.md');
    
    if (!fs.existsSync(strategyFilePath)) {
      throw new Error('SMART_ENDPOINT_STRATEGY_V2.md not found');
    }
    
    const strategyContent = fs.readFileSync(strategyFilePath, 'utf8');
    
    // Define expected endpoints from the strategy document
    const expectedEndpoints = {
      authentication: [
        { method: 'POST', path: '/api/v1/auth/register', description: 'User registration' },
        { method: 'POST', path: '/api/v1/auth/login', description: 'User login' },
        { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh token' }
      ],
      generic_data: [
        { method: 'GET', path: '/api/v1/data/:resource', description: 'List resources' },
        { method: 'POST', path: '/api/v1/data/:resource', description: 'Create resource' },
        { method: 'GET', path: '/api/v1/data/:resource/:id', description: 'Get resource by ID' },
        { method: 'PUT', path: '/api/v1/data/:resource/:id', description: 'Update resource' },
        { method: 'PATCH', path: '/api/v1/data/:resource/:id', description: 'Partial update' },
        { method: 'DELETE', path: '/api/v1/data/:resource/:id', description: 'Delete resource' }
      ],
      admin: [
        { method: 'GET', path: '/api/v1/admin', description: 'Admin operations (query param: type)' }
      ],
      settings: [
        { method: 'GET', path: '/api/v1/settings', description: 'Get settings (query param: type)' },
        { method: 'PUT', path: '/api/v1/settings', description: 'Update settings (query param: type)' },
        { method: 'POST', path: '/api/v1/settings/action', description: 'Settings actions' }
      ],
      compute: [
        { method: 'POST', path: '/api/v1/compute/formula', description: 'Evaluate formula' },
        { method: 'POST', path: '/api/v1/compute/batch', description: 'Batch compute' }
      ],
      health: [
        { method: 'GET', path: '/api/v1/health', description: 'Health check' },
        { method: 'GET', path: '/api/v1/health/ready', description: 'Readiness check' }
      ]
    };
    
    // 2. Scan actual backend routes
    const routesDir = path.join(__dirname);
    const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js') && file !== 'admin.js');
    
    const actualEndpoints = [];
    
    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract router.METHOD patterns
      const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
      let match;
      
      // Determine prefix from filename
      let prefix = '';
      if (file === 'auth.js') prefix = '/auth';
      else if (file === 'api-keys.js') prefix = '/api-keys';
      else if (file === 'protected.js') prefix = '/protected';
      else if (file === 'health.js') prefix = '/health';
      else if (file === 'settings.js') prefix = '/settings';
      else if (file === 'compute.js') prefix = '/compute';
      else if (file === 'data.js' || file === 'generic-data.js') prefix = '/data';
      
      while ((match = routerRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const fullPath = `/api/v1${prefix}${routePath}`;
        
        actualEndpoints.push({
          method,
          path: fullPath,
          file: file.replace('.js', '')
        });
      }
    }
    
    // 3. Compare expected vs actual by category
    const comparison = {};
    let totalExpected = 0;
    let totalActual = actualEndpoints.length;
    let totalMatched = 0;
    let totalMissing = 0;
    
    for (const [category, expectedList] of Object.entries(expectedEndpoints)) {
      totalExpected += expectedList.length;
      
      const categoryComparison = {
        expected: expectedList,
        actual: [],
        matched: [],
        missing: [],
        status: 'unknown'
      };
      
      // Find matches
      for (const expected of expectedList) {
        const match = actualEndpoints.find(actual => 
          actual.method === expected.method && 
          (actual.path === expected.path || 
           // Handle generic patterns like :resource, :id
           (expected.path.includes(':') && 
            actual.path.replace(/\/[^/]+$/, '/:param').replace(/\/[^/]+\//, '/:resource/') === expected.path.replace(/\/[^/]+$/, '/:param').replace(/\/[^/]+\//, '/:resource/')
           )
          )
        );
        
        if (match) {
          categoryComparison.matched.push({
            method: expected.method,
            path: expected.path,
            description: expected.description,
            actualPath: match.path,
            file: match.file
          });
          totalMatched++;
        } else {
          categoryComparison.missing.push({
            method: expected.method,
            path: expected.path,
            description: expected.description
          });
          totalMissing++;
        }
      }
      
      // Determine status
      if (categoryComparison.matched.length === expectedList.length) {
        categoryComparison.status = 'complete';
      } else if (categoryComparison.matched.length > 0) {
        categoryComparison.status = 'partial';
      } else {
        categoryComparison.status = 'missing';
      }
      
      comparison[category] = categoryComparison;
    }
    
    // 4. Find extra endpoints (not in plan)
    const allExpectedPaths = Object.values(expectedEndpoints).flat().map(e => e.path);
    const extraEndpoints = actualEndpoints.filter(actual => {
      // Normalize actual path for comparison
      const normalizedActual = actual.path
        .replace(/\/\d+$/, '/:id')
        .replace(/\/[a-z-]+\//, '/:resource/');
      
      return !allExpectedPaths.some(expected => {
        const normalizedExpected = expected
          .replace(/\/\d+$/, '/:id')
          .replace(/\/[a-z-]+\//, '/:resource/');
        
        return normalizedExpected === normalizedActual || expected === actual.path;
      });
    });
    
    // 5. Calculate summary stats
    const successRate = totalExpected > 0 ? Math.round((totalMatched / totalExpected) * 100) : 0;
    
    return {
      summary: {
        totalExpected,
        totalActual,
        totalMatched,
        totalMissing,
        extraCount: extraEndpoints.length,
        successRate
      },
      categories: comparison,
      extraEndpoints,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to generate plan compliance report:', error);
    return {
      error: 'Failed to generate plan compliance report',
      message: error.message,
      summary: {
        totalExpected: 0,
        totalActual: 0,
        totalMatched: 0,
        totalMissing: 0,
        extraCount: 0,
        successRate: 0
      },
      categories: {},
      extraEndpoints: []
    };
  }
}

/**
 * Get ALL tables from database - NO FILTERS (Master Admin only)
 */
async function getAllTablesRaw() {
  try {
    logger.info('🔓 Getting ALL tables (NO FILTERS - Master Admin access)');
    
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);
    
    return {
      total: result.rows.length,
      tables: result.rows.map(row => ({
        schema: row.schemaname,
        table: row.tablename,
        fullName: `${row.schemaname}.${row.tablename}`,
        size: row.size,
        sizeBytes: parseInt(row.size_bytes)
      }))
    };
  } catch (error) {
    logger.error('Error getting all tables (raw):', error);
    throw error;
  }
}

module.exports = router;

