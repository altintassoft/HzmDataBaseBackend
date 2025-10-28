const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 3: Configuration Patterns
 */
class FrontendRule03Config {
  static async analyze(frontendPath) {
    const hasEnv = StructureScanner.exists(frontendPath, '.env.example');
    const hasViteConfig = StructureScanner.exists(frontendPath, 'vite.config.ts') || 
                         StructureScanner.exists(frontendPath, 'vite.config.js');
    const hasConstants = StructureScanner.exists(frontendPath, 'src/constants');
    
    const checks = { hasEnv, hasViteConfig, hasConstants };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      3, 'I', '3. Configuration Patterns',
      durum, score,
      `${passedCount}/3 config dosyası mevcut.`,
      checks,
      passedCount < 3 ? 'src/constants/ klasörü oluşturun.' : ''
    );
  }
}

module.exports = FrontendRule03Config;

