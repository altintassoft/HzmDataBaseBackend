const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 18: Aliases & Yol Çözümleme
 */
class FrontendRule18Aliases {
  static async analyze(frontendPath) {
    const viteConfig = StructureScanner.exists(frontendPath, 'vite.config.ts') ||
                       StructureScanner.exists(frontendPath, 'vite.config.js');
    
    const score = viteConfig ? 70 : 0;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      18, 'VI', '18. Aliases & Yol Çözümleme',
      durum, score,
      viteConfig ? 'Vite aliases var.' : 'Aliases yok.',
      { viteConfig },
      !viteConfig ? 'vite.config.ts\'de alias\'lar tanımlayın.' : ''
    );
  }
  
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      const viteConfig = tree.some(f => f.path === 'vite.config.ts' || f.path === 'vite.config.js');
      
      const score = viteConfig ? 70 : 0;
      const durum = RuleFormatter.getDurumByScore(score);
      
      return RuleFormatter.createRule(
        18, 'VI', '18. Aliases & Yol Çözümleme',
        durum, score,
        viteConfig ? 'Vite aliases var.' : 'Aliases yok.',
        { viteConfig },
        !viteConfig ? 'vite.config.ts\'de alias\'lar tanımlayın.' : ''
      );
    } catch (error) {
      return RuleFormatter.createRule(18, 'VI', '18. Aliases', 'uyumsuz', 0, 'GitHub tarama hatası');
    }
  }
}

module.exports = FrontendRule18Aliases;

