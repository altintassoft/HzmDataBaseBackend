const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 19: Feature Flags
 */
class Rule19FeatureFlags {
  static async analyze(srcPath) {
    const flagsExists = StructureScanner.exists(srcPath, 'src/core/flags') ||
                        StructureScanner.exists(srcPath, 'src/core/feature-flags');
    
    const score = flagsExists ? 100 : 0;
    const durum = score >= 80 ? 'uyumlu' : 'uyumsuz';
    
    return RuleFormatter.createRule(
      19, 'VI', '19. Feature Flags',
      durum, score,
      flagsExists ? 'Feature flags sistemi mevcut.' : 'Feature flags yok.',
      null,
      !flagsExists ? '@core/flags implementasyonu yapılabilir (opsiyonel).' : ''
    );
  }
}

module.exports = Rule19FeatureFlags;

