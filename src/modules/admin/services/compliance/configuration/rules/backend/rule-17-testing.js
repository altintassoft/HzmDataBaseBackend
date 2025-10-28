const StructureScanner = require('../../scanners/structure-scanner');
const DependencyScanner = require('../../scanners/dependency-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 17: Test & Doğrulama
 */
class Rule17Testing {
  static async analyze(srcPath) {
    const hasTestDir = StructureScanner.exists(srcPath, 'tests') || StructureScanner.exists(srcPath, 'test');
    const packageJson = DependencyScanner.readPackageJson(srcPath);
    const hasTestScript = DependencyScanner.hasScript(packageJson, 'test');
    const hasJest = DependencyScanner.hasJest(packageJson);
    
    const checks = { hasTestDir, hasTestScript, hasJest };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      17, 'VI', '17. Test & Doğrulama',
      durum, score,
      `${passedCount}/3 test altyapısı mevcut.`,
      checks,
      passedCount < 3 ? 'Test klasörü, test script ve Jest ekleyin.' : ''
    );
  }
}

module.exports = Rule17Testing;

