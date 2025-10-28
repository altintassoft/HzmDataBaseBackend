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
  
  /**
   * GitHub API ile analiz
   */
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      const filtered = scanner.filterIgnored(tree);
      const tsFiles = scanner.filterTSFiles(filtered).filter(f => f.path.startsWith('src/'));
      
      // Kritik dosyaları önceliklendir + random sample
      const criticalFiles = [
        'src/services/api.ts',
        'src/App.tsx',
        'src/config.ts',
        'src/constants.ts',
        'src/utils/api.ts'
      ];
      
      const critical = tsFiles.filter(f => criticalFiles.some(cf => f.path.endsWith(cf)));
      const others = tsFiles.filter(f => !criticalFiles.some(cf => f.path.endsWith(cf)));
      
      // Kritik dosyalar + 15 random dosya
      const sampled = [...critical, ...others.slice(0, 15)];
      const violations = [];
      
      for (const file of sampled) {
        try {
          const content = await scanner.getFileContent(owner, repo, file.path);
          
          const urls = HardCodeScanner.findHardCodedURLs(content, file.path);
          if (urls) violations.push({ file: file.path, type: 'hard_url', count: urls.length });
          
          const assets = HardCodeScanner.findHardCodedAssetPaths(content);
          if (assets) violations.push({ file: file.path, type: 'hard_asset', count: assets.length });
        } catch (err) {
          // Skip dosya okuma hatası
        }
      }
      
      const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
      const score = RuleFormatter.calculateScoreFromViolations(totalViolations, 5);
      const durum = RuleFormatter.getDurumByViolations(totalViolations, 5, 10);
      
      return RuleFormatter.createRule(
        1, 'I', '1. Hard-Code Yasağı',
        durum, score,
        `${totalViolations} hard-code bulundu (${sampled.length} dosya tarandı).`,
        violations.slice(0, 5),
        totalViolations > 0 ? 'URL\'ler ve asset path\'leri constants dosyasından gelsin.' : ''
      );
    } catch (error) {
      return RuleFormatter.createRule(1, 'I', '1. Hard-Code Yasağı', 'uyumsuz', 0, 'GitHub tarama hatası');
    }
  }
}

module.exports = FrontendRule01HardCode;

