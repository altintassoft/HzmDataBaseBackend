const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');
const bcrypt = require('bcrypt');
const { generateApiKey, generateApiPassword } = require('../utils/generators');

/**
 * User API Keys Service
 * Handle user's API key management operations
 */
class UserApiKeysService {
  /**
   * Get current user's API key info
   * @param {number} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} API key information
   */
  static async getMyApiKey(userId, userEmail) {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          email,
          api_key,
          api_password,
          api_key_created_at,
          api_key_last_used_at
        FROM core.users
        WHERE email = $1;
      `, [userEmail]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const user = result.rows[0];

      return {
        success: true,
        data: {
          email: user.email,
          apiKey: user.api_key || null,
          apiPassword: user.api_password || null,
          hasApiKey: !!user.api_key,
          createdAt: user.api_key_created_at,
          lastUsedAt: user.api_key_last_used_at
        }
      };

    } catch (error) {
      logger.error('Get API key error:', error);
      throw error;
    }
  }

  /**
   * Generate new API key and password for current user
   * @param {number} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} New API credentials
   */
  static async generateApiCredentials(userId, userEmail) {
    try {
      // Generate new API key and password
      const apiKey = generateApiKey();
      const apiPassword = generateApiPassword();
      const apiKeyHash = await bcrypt.hash(apiPassword, 10);

      // Update user with new API credentials (storing password as plain text for now)
      const result = await pool.query(`
        UPDATE core.users
        SET 
          api_key = $1,
          api_password = $2,
          api_key_hash = $3,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = $4
        RETURNING id, email, api_key, api_password, api_key_created_at;
      `, [apiKey, apiPassword, apiKeyHash, userEmail]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      logger.info(`API key generated for user: ${userEmail}`);

      return {
        success: true,
        message: 'API credentials generated successfully',
        data: {
          apiKey,
          apiPassword, // ⚠️ Only shown once! User must save it
          createdAt: result.rows[0].api_key_created_at
        },
        warning: '⚠️ API Password will only be shown once! Please save it securely.'
      };

    } catch (error) {
      logger.error('Generate API key error:', error);
      throw error;
    }
  }

  /**
   * Regenerate API key (keeps same password, changes key)
   * @param {number} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} New API key
   */
  static async regenerateApiKey(userId, userEmail) {
    try {
      // Generate new API key (password stays the same)
      const apiKey = generateApiKey();

      const result = await pool.query(`
        UPDATE core.users
        SET 
          api_key = $1,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = $2 AND api_key_hash IS NOT NULL
        RETURNING id, email, api_key, api_key_created_at;
      `, [apiKey, userEmail]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'User not found or no API credentials exist'
        };
      }

      logger.info(`API key regenerated for user: ${userEmail}`);

      return {
        success: true,
        message: 'API key regenerated successfully',
        data: {
          apiKey,
          createdAt: result.rows[0].api_key_created_at
        }
      };

    } catch (error) {
      logger.error('Regenerate API key error:', error);
      throw error;
    }
  }

  /**
   * Regenerate API password (keeps same key, changes password)
   * @param {number} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} New API password
   */
  static async regenerateApiPassword(userId, userEmail) {
    try {
      // Generate new API password
      const apiPassword = generateApiPassword();
      const apiKeyHash = await bcrypt.hash(apiPassword, 10);

      const result = await pool.query(`
        UPDATE core.users
        SET 
          api_password = $1,
          api_key_hash = $2,
          api_key_created_at = NOW(),
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = $3 AND api_key IS NOT NULL
        RETURNING id, email, api_key, api_password, api_key_created_at;
      `, [apiPassword, apiKeyHash, userEmail]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'User not found or no API key exists'
        };
      }

      logger.info(`API password regenerated for user: ${userEmail}`);

      return {
        success: true,
        message: 'API password regenerated successfully',
        data: {
          apiPassword, // ⚠️ Only shown once!
          createdAt: result.rows[0].api_key_created_at
        },
        warning: '⚠️ New API Password will only be shown once! Please save it securely.'
      };

    } catch (error) {
      logger.error('Regenerate API password error:', error);
      throw error;
    }
  }

  /**
   * Revoke (delete) API credentials
   * @param {number} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Object} Success message
   */
  static async revokeApiCredentials(userId, userEmail) {
    try {
      const result = await pool.query(`
        UPDATE core.users
        SET 
          api_key = NULL,
          api_password = NULL,
          api_key_hash = NULL,
          api_key_created_at = NULL,
          api_key_last_used_at = NULL,
          updated_at = NOW()
        WHERE email = $1
        RETURNING id, email;
      `, [userEmail]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      logger.info(`API credentials revoked for user: ${userEmail}`);

      return {
        success: true,
        message: 'API credentials revoked successfully'
      };

    } catch (error) {
      logger.error('Revoke API key error:', error);
      throw error;
    }
  }
}

module.exports = UserApiKeysService;



