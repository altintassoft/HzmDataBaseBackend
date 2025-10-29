const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 15: Kod Kalitesi & Kurallar
 */
class Rule15CodeQuality {
  static async analyze(srcPath) {
    const { hasESLintRC, hasPrettierRC, hasGitHooks } = StructureScanner.checkConfigFiles(srcPath);
    
    const checks = { hasESLintRC, hasPrettierRC, hasGitHooks };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      15, 'V', '15. Kod Kalitesi & Kurallar',
      durum, score,
      `${passedCount}/3 kod kalitesi aracı yapılandırılmış.`,
      checks,
      passedCount < 3 ? 'ESLint, Prettier ve Husky pre-commit hook ekleyin.' : ''
    );
  }
}

module.exports = Rule15CodeQuality;


