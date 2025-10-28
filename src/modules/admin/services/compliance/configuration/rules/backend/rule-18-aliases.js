const DependencyScanner = require('../../scanners/dependency-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 18: Alias & Yol Çözümleme
 */
class Rule18Aliases {
  static async analyze(srcPath) {
    const packageJson = DependencyScanner.readPackageJson(srcPath);
    const hasModuleAlias = DependencyScanner.hasModuleAliases(packageJson);
    
    const score = hasModuleAlias ? 100 : 0;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      18, 'VI', '18. Alias & Yol Çözümleme',
      durum, score,
      hasModuleAlias ? 'Module aliases tanımlı.' : 'Module aliases yok.',
      { hasModuleAlias, aliases: packageJson._moduleAliases || {} },
      !hasModuleAlias ? 'package.json\'a _moduleAliases ekleyin.' : ''
    );
  }
}

module.exports = Rule18Aliases;

