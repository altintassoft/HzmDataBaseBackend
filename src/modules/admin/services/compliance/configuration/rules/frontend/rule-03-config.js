const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 3: Configuration Patterns
 */
class FrontendRule03Config {
  static async analyze(frontendPath) {
    const hasEnv = StructureScanner.exists(frontendPath, '.env.example');
    const hasViteConfig = StructureScanner.exists(frontendPath, 'vite.config.ts') || 
                         StructureScanner.exists(frontendPath, 'vite.config.js');
    const hasConstants = StructureScanner.exists(frontendPath, 'src/constants');
    
    const checks = { hasEnv, hasViteConfig, hasConstants };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      3, 'I', '3. Configuration Patterns',
      durum, score,
      `${passedCount}/3 config dosyası mevcut.`,
      checks,
      passedCount < 3 ? 'src/constants/ klasörü oluşturun.' : ''
    );
  }
  
  /**
   * GitHub API ile analiz
   */
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      
      const hasEnv = tree.some(f => f.path === '.env.example');
      const hasViteConfig = tree.some(f => f.path === 'vite.config.ts' || f.path === 'vite.config.js');
      const hasConstants = tree.some(f => f.path.startsWith('src/constants/'));
      
      const checks = { hasEnv, hasViteConfig, hasConstants };
      const passedCount = Object.values(checks).filter(Boolean).length;
      const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
      const durum = RuleFormatter.getDurumByScore(score);
      
      return RuleFormatter.createRule(
        3, 'I', '3. Configuration Patterns',
        durum, score,
        `${passedCount}/3 config dosyası mevcut.`,
        checks,
        passedCount < 3 ? 'src/constants/ klasörü oluşturun.' : ''
      );
    } catch (error) {
      return RuleFormatter.createRule(3, 'I', '3. Configuration Patterns', 'uyumsuz', 0, 'GitHub tarama hatası');
    }
  }
}

module.exports = FrontendRule03Config;

