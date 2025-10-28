const logger = require('../../../core/logger');

/**
 * Tables Info Service
 * Provides backend table information
 */
class TablesInfoService {
  static async getTablesInfo(user) {
    try {
      // TODO: Migrate from current admin.js implementation
      throw new Error('Not implemented yet');
    } catch (error) {
      logger.error('Tables info service error:', error);
      throw error;
    }
  }
}

module.exports = TablesInfoService;
