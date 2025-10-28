const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 20: Dokümantasyon
 */
class FrontendRule20Documentation {
  static async analyze(frontendPath) {
    const hasReadme = StructureScanner.exists(frontendPath, 'README.md');
    
    const score = hasReadme ? 50 : 0;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      20, 'VI', '20. Dokümantasyon',
      durum, score,
      hasReadme ? 'README var, component docs eksik.' : 'Docs eksik.',
      { hasReadme },
      'Storybook eklenip component gallery oluşturulmalı.'
    );
  }
}

module.exports = FrontendRule20Documentation;

