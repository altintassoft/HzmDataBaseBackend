const { pool } = require('../../../../core/config/database');
const logger = require('../../../../core/logger');

/**
 * All Tables Raw Service
 * Get ALL tables from database - NO FILTERS (Master Admin only)
 */
class AllTablesRawService {
  /**
   * Get all tables (no filters)
   * @returns {Object} { total, tables }
   */
  static async getAllTablesRaw() {
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
}

module.exports = AllTablesRawService;

