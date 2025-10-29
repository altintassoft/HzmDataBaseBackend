const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 20: Dokümantasyon
 */
class Rule20Documentation {
  static async analyze(srcPath) {
    const hasDocsDir = StructureScanner.exists(srcPath, 'docs');
    const hasReadme = StructureScanner.exists(srcPath, 'README.md');
    
    const modulesPath = path.join(srcPath, 'src/modules');
    const moduleReadmeCount = StructureScanner.countModuleReadmes(modulesPath);
    
    const score = (hasDocsDir ? 40 : 0) + (hasReadme ? 40 : 0) + (moduleReadmeCount > 0 ? 20 : 0);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      20, 'VI', '20. Dokümantasyon',
      durum, score,
      `docs/: ${hasDocsDir ? '✓' : '✗'}, README: ${hasReadme ? '✓' : '✗'}, Module docs: ${moduleReadmeCount}`,
      { hasDocsDir, hasReadme, moduleReadmeCount },
      score < 80 ? 'Her modül için README oluşturun.' : ''
    );
  }
}

module.exports = Rule20Documentation;




