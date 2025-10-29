const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 16: CI/CD Otomatik Kontroller
 */
class Rule16CICD {
  static async analyze(srcPath) {
    const hasGitHubActions = StructureScanner.exists(srcPath, '.github/workflows');
    const hasPreCommit = StructureScanner.exists(srcPath, '.husky/pre-commit');
    
    const checks = { hasGitHubActions, hasPreCommit };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 2);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      16, 'V', '16. CI/CD Otomatik Kontroller',
      durum, score,
      `${passedCount}/2 otomasyon aracı mevcut.`,
      checks,
      passedCount < 2 ? 'GitHub Actions ve pre-commit hooks ekleyin.' : ''
    );
  }
}

module.exports = Rule16CICD;




