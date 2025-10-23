const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
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
const ALLOWED_TYPES = ['tables', 'schemas', 'table', 'stats', 'users', 'migration-report', 'migrations', 'architecture-compliance'];
const ALLOWED_INCLUDES = ['columns', 'indexes', 'rls', 'data', 'fk', 'constraints', 'tracking'];
const ALLOWED_SCHEMAS = ['core', 'app', 'cfg', 'ops'];
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

router.get('/database', async (req, res) => {
  try {
    const { type, include, schema, table, limit, offset } = req.query;

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
        result = await getSingleTableInfo(schema, table, includes, limit, offset);
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
async function getSingleTableInfo(schema, table, includes = [], limit = 100, offset = 0) {
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
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM ${schema}.${table};`
    );
    const dataResult = await pool.query(
      `SELECT * FROM ${schema}.${table} ORDER BY id LIMIT $1 OFFSET $2;`,
      [limit || 100, offset || 0]
    );
    
    tableInfo.data = dataResult.rows;
    tableInfo.total = parseInt(countResult.rows[0].total);
    tableInfo.limit = parseInt(limit) || 100;
    tableInfo.offset = parseInt(offset) || 0;
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

    // 1. Database Schema Analysis
    const tableCountResult = await pool.query(`
      SELECT schemaname, COUNT(*) as table_count
      FROM pg_tables
      WHERE schemaname = ANY($1)
      GROUP BY schemaname;
    `, [ALLOWED_SCHEMAS]);

    const expectedTables = 9; // From BACKEND_PHASE_PLAN
    const actualTables = tableCountResult.rows.reduce((sum, row) => sum + parseInt(row.table_count), 0);
    const missingTables = Math.max(0, expectedTables - actualTables);

    const databaseSchemaScore = Math.round((actualTables / expectedTables) * 100);

    // 2. Migration Consistency Check
    const migrationResult = await pool.query(`
      SELECT COUNT(*) as migration_count
      FROM public.schema_migrations;
    `);
    const executedMigrations = parseInt(migrationResult.rows[0].migration_count) || 0;
    const migrationConsistencyScore = executedMigrations >= 7 ? 85 : 50;

    // 3. Endpoint Analysis (Mock - gerçek implementasyon route scanning gerektirir)
    const currentEndpoints = 34; // Mock değer
    const targetEndpoints = 17; // From SMART_ENDPOINT_STRATEGY_V2
    const endpointArchitectureScore = Math.max(0, 100 - ((currentEndpoints - targetEndpoints) * 3));

    // 4. Security Implementation Check
    const securityChecks = {
      hmac: false,
      cursor_security: false,
      scopes: false,
      admin_mfa: false,
      admin_ip_allowlist: false,
      admin_pii_masking: false,
      rate_limiting: true, // Redis var
      error_standardization: false,
      rls_context: true,
      audit_logging: true
    };

    const securityScore = (Object.values(securityChecks).filter(Boolean).length / Object.keys(securityChecks).length) * 100;

    // 5. RLS & Multi-Tenancy Check
    const rlsPolicyResult = await pool.query(`
      SELECT COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = ANY($1);
    `, [ALLOWED_SCHEMAS]);
    const rlsScore = Math.min(100, (parseInt(rlsPolicyResult.rows[0].policy_count) || 0) * 20);

    // 6. Best Practices Score
    const bestPracticesScore = 55; // Mock - gerçek implementasyon detaylı kontroller gerektirir

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
          mismatches: [] // TODO: Implement detailed column comparison
        },
        seed_data: {
          missing: [] // TODO: Check for missing seed data
        }
      },
      endpoint_analysis: {
        total: currentEndpoints,
        target: targetEndpoints,
        extra: [], // TODO: List extra endpoints
        missing: [] // TODO: List missing endpoints
      },
      api_key_architecture: {
        format_compliance: 60, // Mock - API key format kontrolü gerekir
        features: {
          opak_format: false,
          key_id_uuid: false,
          label: false,
          created_by: false,
          rotated_from_key_id: false,
          scopes: false,
          ip_allowlist: false,
          expires_at: false
        }
      },
      security_checklist: securityChecks,
      action_plan: actionPlan
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
      action_plan: { p0_critical: [], p1_high: [], p2_medium: [] }
    };
  }
}

module.exports = router;

