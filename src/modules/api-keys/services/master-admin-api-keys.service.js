const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');
const bcrypt = require('bcrypt');
const { generateApiKey, generateApiPassword } = require('../utils/generators');
const { TABLES } = require('../../../shared/constants/tables');

/**
 * Master Admin API Keys Service
 * Handle Master Admin API key management operations
 */
class MasterAdminApiKeysService {
  /**
   * Get Master Admin API credentials
   * @returns {Object} Master Admin API key information
   */
  static async getMasterAdminApiKey() {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          email,
          role,
          api_key,
          api_password,
          api_key_created_at,
          api_key_last_used_at
        FROM ${TABLES.USERS}
        WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin';
      `);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Master Admin user not found'
        };
      }

      const masterAdmin = result.rows[0];

      return {
        success: true,
        data: {
          email: masterAdmin.email,
          role: masterAdmin.role,
          apiKey: masterAdmin.api_key || null,
          apiPassword: masterAdmin.api_password || null,
          hasApiKey: !!masterAdmin.api_key,
          createdAt: masterAdmin.api_key_created_at,
          lastUsedAt: masterAdmin.api_key_last_used_at
        }
      };

    } catch (error) {
      logger.error('Get Master Admin API key error:', error);
      throw error;
    }
  }

  /**
   * Generate API credentials for Master Admin
   * @returns {Object} New Master Admin API credentials
   */
  static async generateMasterAdminApiCredentials() {
    try {
      // Generate new API key and password
      const apiKey = generateApiKey();
      const apiPassword = generateApiPassword();
      const apiKeyHash = await bcrypt.hash(apiPassword, 10);

      // Update Master Admin with new API credentials
      const result = await pool.query(`
        UPDATE ${TABLES.USERS}
        SET 
          api_key = $1,
          api_password = $2,
          api_key_hash = $3,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin'
        RETURNING id, email, role, api_key, api_password, api_key_created_at;
      `, [apiKey, apiPassword, apiKeyHash]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Master Admin user not found'
        };
      }

      logger.info('Master Admin API key generated');

      return {
        success: true,
        message: 'Master Admin API credentials generated successfully',
        data: {
          apiKey,
          apiPassword,
          createdAt: result.rows[0].api_key_created_at
        }
      };

    } catch (error) {
      logger.error('Generate Master Admin API key error:', error);
      throw error;
    }
  }

  /**
   * Regenerate Master Admin API key (keeps password)
   * @returns {Object} New Master Admin API key
   */
  static async regenerateMasterAdminApiKey() {
    try {
      const apiKey = generateApiKey();

      const result = await pool.query(`
        UPDATE ${TABLES.USERS}
        SET 
          api_key = $1,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin' AND api_password IS NOT NULL
        RETURNING id, email, role, api_key, api_key_created_at;
      `, [apiKey]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Master Admin user not found or no API credentials exist'
        };
      }

      logger.info('Master Admin API key regenerated');

      return {
        success: true,
        message: 'Master Admin API key regenerated successfully',
        data: {
          apiKey,
          createdAt: result.rows[0].api_key_created_at
        }
      };

    } catch (error) {
      logger.error('Regenerate Master Admin API key error:', error);
      throw error;
    }
  }

  /**
   * Regenerate Master Admin API password (keeps key)
   * @returns {Object} New Master Admin API password
   */
  static async regenerateMasterAdminApiPassword() {
    try {
      const apiPassword = generateApiPassword();
      const apiKeyHash = await bcrypt.hash(apiPassword, 10);

      const result = await pool.query(`
        UPDATE ${TABLES.USERS}
        SET 
          api_password = $1,
          api_key_hash = $2,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin' AND api_key IS NOT NULL
        RETURNING id, email, role, api_key, api_password, api_key_created_at;
      `, [apiPassword, apiKeyHash]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Master Admin user not found or no API key exists'
        };
      }

      logger.info('Master Admin API password regenerated');

      return {
        success: true,
        message: 'Master Admin API password regenerated successfully',
        data: {
          apiPassword,
          createdAt: result.rows[0].api_key_created_at
        }
      };

    } catch (error) {
      logger.error('Regenerate Master Admin API password error:', error);
      throw error;
    }
  }
}

module.exports = MasterAdminApiKeysService;



