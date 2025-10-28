const pool = require('../../../core/config/database');
const logger = require('../../../core/logger');

/**
 * Single Table Info Service
 * Get detailed information for a specific table
 */
class SingleTableInfoService {
  /**
   * Get single table info with optional data
   * @param {String} schema - Schema name
   * @param {String} table - Table name
   * @param {Array} includes - Optional includes: ['data', 'indexes', 'rls']
   * @param {Number} limit - Data limit (default 100)
   * @param {Number} offset - Data offset (default 0)
   * @param {Object} user - User object for tenant isolation
   * @returns {Object} Table info
   */
  static async getSingleTableInfo(schema, table, includes = [], limit = 100, offset = 0, user = null) {
    try {
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
    } catch (error) {
      logger.error('SingleTableInfoService error:', error);
      throw error;
    }
  }
}

module.exports = SingleTableInfoService;

