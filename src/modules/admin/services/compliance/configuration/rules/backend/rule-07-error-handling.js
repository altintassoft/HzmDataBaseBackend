const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 7: Hata Yönetimi & Logging
 */
class Rule07ErrorHandling {
  static async analyze(srcPath) {
    const loggerExists = StructureScanner.exists(srcPath, 'src/core/logger/index.js');
    
    const serverPath = path.join(srcPath, 'src/app/server.js');
    const serverContent = StructureScanner.readFileSafe(serverPath);
    const hasGlobalErrorHandler = serverContent && 
      (serverContent.includes('app.use((err, req, res, next)') || serverContent.includes('errorMiddleware'));
    
    let hasStructuredLogging = false;
    if (loggerExists) {
      const loggerPath = path.join(srcPath, 'src/core/logger/index.js');
      const loggerContent = StructureScanner.readFileSafe(loggerPath);
      hasStructuredLogging = loggerContent && (loggerContent.includes('JSON') || loggerContent.includes('requestId'));
    }
    
    const checks = { loggerExists, hasGlobalErrorHandler, hasStructuredLogging };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      7, 'II', '7. Hata Yönetimi & Logging',
      durum, score,
      `${passedCount}/3 kontrol geçti.`,
      checks,
      passedCount < 3 ? 'Logger, global error handler ve structured logging ekleyin.' : ''
    );
  }
}

module.exports = Rule07ErrorHandling;




