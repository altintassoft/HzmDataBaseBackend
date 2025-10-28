const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');

// Allowed schemas for security
const ALLOWED_SCHEMAS = ['public', 'core', 'app', 'cfg', 'ops'];

/**
 * Database Stats Service
 * Get overall database statistics
 */
class DatabaseStatsService {
  /**
   * Get database statistics
   * @returns {Object} Database stats (tables, columns, indexes, users, size)
   */
  static async getDatabaseStats() {
    try {
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
    } catch (error) {
      logger.error('DatabaseStatsService error:', error);
      throw error;
    }
  }
}

module.exports = DatabaseStatsService;
