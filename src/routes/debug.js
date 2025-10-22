const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Check tables
router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);

    res.json({
      count: result.rows.length,
      tables: result.rows
    });
  } catch (error) {
    logger.error('Check tables error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check schemas
router.get('/schemas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `);

    res.json({
      count: result.rows.length,
      schemas: result.rows
    });
  } catch (error) {
    logger.error('Check schemas error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get table data with column info
router.get('/table/:schema/:table/data', async (req, res) => {
  try {
    const { schema, table } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Security: Only allow specific schemas
    const allowedSchemas = ['core', 'app', 'cfg', 'ops', 'public'];
    if (!allowedSchemas.includes(schema)) {
      return res.status(403).json({ error: 'Schema not allowed' });
    }

    // Get column information
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

    // Get row count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM ${schema}.${table};`
    );

    // Get data
    const dataResult = await pool.query(
      `SELECT * FROM ${schema}.${table} ORDER BY id LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );

    res.json({
      schema,
      table,
      columns: columnsResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      data: dataResult.rows
    });
  } catch (error) {
    logger.error('Get table data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get table structure (columns, indexes, constraints)
router.get('/table/:schema/:table/structure', async (req, res) => {
  try {
    const { schema, table } = req.params;

    // Security: Only allow specific schemas
    const allowedSchemas = ['core', 'app', 'cfg', 'ops', 'public'];
    if (!allowedSchemas.includes(schema)) {
      return res.status(403).json({ error: 'Schema not allowed' });
    }

    // Get columns
    const columns = await pool.query(`
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

    // Get indexes
    const indexes = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2;
    `, [schema, table]);

    // Get foreign keys
    const foreignKeys = await pool.query(`
      SELECT
        tc.constraint_name,
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
    `, [schema, table]);

    res.json({
      schema,
      table,
      columns: columns.rows,
      indexes: indexes.rows,
      foreignKeys: foreignKeys.rows
    });
  } catch (error) {
    logger.error('Get table structure error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tables with detailed information (NO MOCK DATA!)
router.get('/tables-detailed', async (req, res) => {
  try {
    const allowedSchemas = ['core', 'app', 'cfg', 'ops'];
    
    // Get all tables in allowed schemas
    const tablesResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        obj_description((schemaname || '.' || tablename)::regclass, 'pg_class') as description
      FROM pg_tables 
      WHERE schemaname = ANY($1)
      ORDER BY schemaname, tablename;
    `, [allowedSchemas]);

    const tables = [];

    for (const table of tablesResult.rows) {
      const { schemaname, tablename, description } = table;

      // Get columns
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

      // Get primary keys
      const pkResult = await pool.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary;
      `, [`${schemaname}.${tablename}`]);
      const primaryKeys = pkResult.rows.map(r => r.attname);

      // Get unique constraints
      const uniqueResult = await pool.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisunique AND NOT i.indisprimary;
      `, [`${schemaname}.${tablename}`]);
      const uniqueColumns = uniqueResult.rows.map(r => r.attname);

      // Get indexes
      const indexesResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2;
      `, [schemaname, tablename]);

      // Get foreign keys
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

      // Check RLS status
      const rlsResult = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = $1::regclass;
      `, [`${schemaname}.${tablename}`]);
      const rlsEnabled = rlsResult.rows[0]?.relrowsecurity || false;

      // Format columns with constraints
      const formattedColumns = columnsResult.rows.map(col => {
        let constraint = '';
        if (primaryKeys.includes(col.column_name)) {
          constraint = 'PK';
        } else if (uniqueColumns.includes(col.column_name)) {
          constraint = 'UNIQUE';
        }
        
        // Check for FK
        const fk = fkResult.rows.find(f => f.column_name === col.column_name);
        if (fk) {
          constraint = `FK → ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})`;
        }

        // Check for NOT NULL
        if (col.is_nullable === 'NO' && !constraint) {
          constraint = 'NOT NULL';
        }

        // Format data type
        let dataType = col.data_type.toUpperCase();
        if (col.character_maximum_length) {
          dataType = `VARCHAR(${col.character_maximum_length})`;
        } else if (dataType === 'CHARACTER VARYING') {
          dataType = 'VARCHAR(255)';
        } else if (dataType === 'TIMESTAMP WITH TIME ZONE') {
          dataType = 'TIMESTAMPTZ';
        } else if (dataType === 'INTEGER') {
          // Check if it's SERIAL
          if (col.column_default && col.column_default.includes('nextval')) {
            dataType = 'SERIAL';
          }
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

      tables.push({
        schema: schemaname,
        name: tablename,
        fullName: `${schemaname}.${tablename}`,
        description: description || undefined,
        columnCount: columnsResult.rows.length,
        columns: formattedColumns,
        indexes: indexesResult.rows.length,
        foreignKeys: fkResult.rows.length,
        rls: rlsEnabled,
        status: 'active'
      });
    }

    res.json({
      success: true,
      count: tables.length,
      tables,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get detailed tables error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


