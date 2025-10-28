const { pool } = require('../../../../core/config/database');
const logger = require('../../../../core/logger');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];

/**
 * Tables Info Service
 * Get all tables with optional details (columns, indexes, RLS, FK)
 */
class TablesInfoService {
  /**
   * Get tables information
   * @param {Array} includes - Optional includes: ['columns', 'indexes', 'rls', 'fk']
   * @returns {Object} { count, tables }
   */
  static async getTablesInfo(includes = []) {
    try {
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
    } catch (error) {
      logger.error('TablesInfoService error:', error);
      throw error;
    }
  }
}

module.exports = TablesInfoService;
