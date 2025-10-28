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
  
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      const hasReadme = tree.some(f => f.path === 'README.md');
      
      const score = hasReadme ? 50 : 0;
      const durum = RuleFormatter.getDurumByScore(score);
      
      return RuleFormatter.createRule(
        20, 'VI', '20. Dokümantasyon',
        durum, score,
        hasReadme ? 'README var, component docs eksik.' : 'Docs eksik.',
        { hasReadme },
        'Storybook eklenip component gallery oluşturulmalı.'
      );
    } catch (error) {
      return RuleFormatter.createRule(20, 'VI', '20. Dokümantasyon', 'uyumsuz', 0, 'GitHub tarama hatası');
    }
  }
}

module.exports = FrontendRule20Documentation;

