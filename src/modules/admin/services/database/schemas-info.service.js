const { pool } = require('../../../../core/config/database');
const logger = require('../../../../core/logger');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];

/**
 * Schemas Info Service
 * Get all schemas with table counts
 */
class SchemasInfoService {
  /**
   * Get all schemas
   * @returns {Object} { count, schemas }
   */
  static async getSchemasInfo() {
    try {
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
    } catch (error) {
      logger.error('SchemasInfoService error:', error);
      throw error;
    }
  }
}

module.exports = SchemasInfoService;

