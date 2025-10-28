const UserApiKeysService = require('./services/user-api-keys.service');
const MasterAdminApiKeysService = require('./services/master-admin-api-keys.service');
const logger = require('../../core/logger');

/**
 * API Keys Controller
 * Handle API key management endpoints
 */
class ApiKeysController {
  // ============================================================================
  // USER API KEY ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/api-keys/me
   * Get current user's API key info
   */
  static async getMyApiKey(req, res) {
    try {
      // TODO: Get user from JWT token (req.user)
      // For now, using email from query or default
      const userEmail = req.query.email || 'ozgurhzm@gmail.com';
      const userId = req.user?.id || null;

      const result = await UserApiKeysService.getMyApiKey(userId, userEmail);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Get API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/generate
   * Generate new API key and password for current user
   */
  static async generateApiCredentials(req, res) {
    try {
      const userEmail = req.query.email || 'ozgurhzm@gmail.com';
      const userId = req.user?.id || null;

      const result = await UserApiKeysService.generateApiCredentials(userId, userEmail);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Generate API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/regenerate
   * Regenerate API key (keeps same password)
   */
  static async regenerateApiKey(req, res) {
    try {
      const userEmail = req.query.email || 'ozgurhzm@gmail.com';
      const userId = req.user?.id || null;

      const result = await UserApiKeysService.regenerateApiKey(userId, userEmail);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Regenerate API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/regenerate-password
   * Regenerate API password (keeps same key)
   */
  static async regenerateApiPassword(req, res) {
    try {
      const userEmail = req.query.email || 'ozgurhzm@gmail.com';
      const userId = req.user?.id || null;

      const result = await UserApiKeysService.regenerateApiPassword(userId, userEmail);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Regenerate API password error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/v1/api-keys/revoke
   * Revoke (delete) API credentials
   */
  static async revokeApiCredentials(req, res) {
    try {
      const userEmail = req.query.email || 'ozgurhzm@gmail.com';
      const userId = req.user?.id || null;

      const result = await UserApiKeysService.revokeApiCredentials(userId, userEmail);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Revoke API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ============================================================================
  // MASTER ADMIN API KEY ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/api-keys/master-admin
   * Get Master Admin API credentials (admin only)
   */
  static async getMasterAdminApiKey(req, res) {
    try {
      // TODO: Check if current user is admin (req.user.role === 'admin')
      // For now, allow access for testing

      const result = await MasterAdminApiKeysService.getMasterAdminApiKey();

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Get Master Admin API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/master-admin/generate
   * Generate API credentials for Master Admin
   */
  static async generateMasterAdminApiCredentials(req, res) {
    try {
      // TODO: Check if current user is admin

      const result = await MasterAdminApiKeysService.generateMasterAdminApiCredentials();

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Generate Master Admin API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/master-admin/regenerate
   * Regenerate Master Admin API key (keeps password)
   */
  static async regenerateMasterAdminApiKey(req, res) {
    try {
      // TODO: Check if current user is admin

      const result = await MasterAdminApiKeysService.regenerateMasterAdminApiKey();

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Regenerate Master Admin API key error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/api-keys/master-admin/regenerate-password
   * Regenerate Master Admin API password (keeps key)
   */
  static async regenerateMasterAdminApiPassword(req, res) {
    try {
      // TODO: Check if current user is admin

      const result = await MasterAdminApiKeysService.regenerateMasterAdminApiPassword();

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);

    } catch (error) {
      logger.error('Regenerate Master Admin API password error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ApiKeysController;

