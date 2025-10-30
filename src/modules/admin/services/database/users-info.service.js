const { pool } = require('../../../../core/config/database');
const logger = require('../../../../core/logger');
const { TABLES } = require('../../../../shared/constants/tables');

/**
 * Users Info Service
 * Get paginated user list from core.users
 */
class UsersInfoService {
  /**
   * Get users info
   * @param {Number} limit - Pagination limit (default 100)
   * @param {Number} offset - Pagination offset (default 0)
   * @returns {Object} { total, limit, offset, users }
   */
  static async getUsersInfo(limit = 100, offset = 0) {
    try {
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${TABLES.USERS};`);
      const usersResult = await pool.query(`
        SELECT 
          id, 
          tenant_id, 
          email, 
          role, 
          is_active, 
          created_at, 
          updated_at
        FROM ${TABLES.USERS} 
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
      logger.error('UsersInfoService error:', error);
      return {
        error: 'Users table not found or query failed',
        message: error.message
      };
    }
  }
}

module.exports = UsersInfoService;

