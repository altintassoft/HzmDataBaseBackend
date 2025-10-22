const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

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
const ALLOWED_TYPES = ['tables', 'schemas', 'table', 'stats', 'users'];
const ALLOWED_INCLUDES = ['columns', 'indexes', 'rls', 'data', 'fk', 'constraints'];
const ALLOWED_SCHEMAS = ['core', 'app', 'cfg', 'ops'];

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

module.exports = router;

