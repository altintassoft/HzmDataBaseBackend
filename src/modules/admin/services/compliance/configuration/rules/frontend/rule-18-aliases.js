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
}

module.exports = FrontendRule18Aliases;

