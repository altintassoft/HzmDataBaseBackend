const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 15: Kod Kalitesi
 */
class FrontendRule15CodeQuality {
  static async analyze(frontendPath) {
    const hasESLint = StructureScanner.exists(frontendPath, 'eslint.config.js') ||
                      StructureScanner.exists(frontendPath, '.eslintrc.js');
    const hasPrettier = StructureScanner.exists(frontendPath, '.prettierrc');
    
    const score = (hasESLint ? 60 : 0) + (hasPrettier ? 40 : 0);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      15, 'V', '15. Kod Kalitesi',
      durum, score,
      `ESLint: ${hasESLint ? '✓' : '✗'}, Prettier: ${hasPrettier ? '✓' : '✗'}`,
      { hasESLint, hasPrettier },
      score < 100 ? 'ESLint ve Prettier yapılandırın.' : ''
    );
  }
}

module.exports = FrontendRule15CodeQuality;

