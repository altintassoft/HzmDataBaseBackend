const DependencyScanner = require('../../scanners/dependency-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 5: Best Practices
 */
class Rule05BestPractices {
  static async analyze(srcPath) {
    const packageJson = DependencyScanner.readPackageJson(srcPath);
    
    const hasModuleAlias = DependencyScanner.hasModuleAliases(packageJson);
    const hasESLint = DependencyScanner.hasESLint(packageJson);
    const hasPrettier = DependencyScanner.hasPrettier(packageJson);
    
    const checks = { hasModuleAlias, hasESLint, hasPrettier };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      5, 'I', '5. Best Practices',
      durum, score,
      `${passedCount}/3 best practice uygulanıyor.`,
      checks,
      passedCount < 3 ? 'Module aliases, ESLint ve Prettier ekleyin.' : ''
    );
  }
}

module.exports = Rule05BestPractices;

