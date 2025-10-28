const logger = require('../../../shared/utils/logger');

class PhaseProgressService {
  static async getPhaseProgress(user) {
    try {
      throw new Error('Not implemented yet');
    } catch (error) {
      logger.error('Phase progress service error:', error);
      throw error;
    }
  }
}

module.exports = PhaseProgressService;


