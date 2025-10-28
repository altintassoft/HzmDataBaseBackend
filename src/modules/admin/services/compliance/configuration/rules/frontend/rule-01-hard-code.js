const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const HardCodeScanner = require('../../scanners/hard-code-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 1: Hard-Code Yasağı
 */
class FrontendRule01HardCode {
  static async analyze(frontendPath) {
    const violations = [];
    const srcPath = path.join(frontendPath, 'src');
    
    FileScanner.scanTSFiles(srcPath, (file, content) => {
      // Hard-coded URLs
      const urls = HardCodeScanner.findHardCodedURLs(content, file);
      if (urls) {
        violations.push({ file, type: 'hard_url', count: urls.length });
      }
      
      // Hard-coded asset paths
      const assetPaths = HardCodeScanner.findHardCodedAssetPaths(content);
      if (assetPaths) {
        violations.push({ file, type: 'hard_asset', count: assetPaths.length });
      }
    });
    
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const score = RuleFormatter.calculateScoreFromViolations(totalViolations, 5);
    const durum = RuleFormatter.getDurumByViolations(totalViolations, 5, 10);
    
    return RuleFormatter.createRule(
      1, 'I', '1. Hard-Code Yasağı',
      durum, score,
      `${totalViolations} hard-code bulundu.`,
      violations.slice(0, 10),
      totalViolations > 0 ? 'URL\'ler ve asset path\'leri constants dosyasından gelsin.' : ''
    );
  }
}

module.exports = FrontendRule01HardCode;

