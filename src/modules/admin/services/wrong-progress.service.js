const logger = require('../../../shared/utils/logger');

class WrongProgressService {
  static async getWrongProgress(user) {
    try {
      throw new Error('Not implemented yet');
    } catch (error) {
      logger.error('Wrong progress service error:', error);
      throw error;
    }
  }
}

module.exports = WrongProgressService;


