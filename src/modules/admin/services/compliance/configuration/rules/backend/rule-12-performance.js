const DependencyScanner = require('../../scanners/dependency-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 12: Performans & Ölçeklenebilirlik
 */
class Rule12Performance {
  static async analyze(srcPath) {
    const packageJson = DependencyScanner.readPackageJson(srcPath);
    
    const hasRedis = DependencyScanner.hasRedis(packageJson);
    const hasRateLimiting = DependencyScanner.hasRateLimiting(packageJson);
    
    const checks = { hasRedis, hasRateLimiting };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 2);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      12, 'III', '12. Performans & Ölçeklenebilirlik',
      durum, score,
      `${passedCount}/2 performans özelliği mevcut.`,
      checks,
      passedCount < 2 ? 'Redis cache ve rate limiting ekleyin.' : ''
    );
  }
}

module.exports = Rule12Performance;

