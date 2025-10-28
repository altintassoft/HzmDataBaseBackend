const path = require('path');
const logger = require('../../../../../core/logger');
const BackendAnalyzer = require('./backend-analyzer');
const FrontendAnalyzer = require('./frontend-analyzer');

/**
 * Configuration Compliance Service (Modular Version)
 * 24 Kural seti gerçek kod taraması
 * 
 * ✅ Modüler yapı:
 * - scanners/: Dosya tarama ve detection helpers
 * - rules/backend/: 20 backend kuralı
 * - rules/frontend/: 14 frontend kuralı
 * - utils/: Rule formatting ve scoring
 * - backend-analyzer.js: Backend kurallarını orchestrate eder
 * - frontend-analyzer.js: Frontend kurallarını orchestrate eder
 * - index.js: Ana orchestrator
 */
class ConfigurationComplianceService {
  
  /**
   * Tam compliance analizi
   * @returns {Promise<Object>} { backend: [], frontend: [], generatedAt: string }
   */
  static async getFullCompliance() {
    try {
      logger.info('🔍 Starting configuration compliance analysis...');
      
      // Backend root path'i belirle
      const srcPath = path.join(__dirname, '../../../../..');
      
      // Backend ve Frontend analizlerini paralel çalıştır
      const [backend, frontend] = await Promise.all([
        BackendAnalyzer.analyze(srcPath),
        FrontendAnalyzer.analyze(srcPath)
      ]);
      
      logger.info('✅ Configuration compliance analysis completed');
      
      return {
        backend,
        frontend,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to analyze configuration compliance:', error);
      throw error;
    }
  }
}

module.exports = ConfigurationComplianceService;

