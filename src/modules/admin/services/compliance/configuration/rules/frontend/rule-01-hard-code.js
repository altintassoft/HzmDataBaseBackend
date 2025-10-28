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
   * GitHub API ile analiz - GÜÇLENDİRİLMİŞ
   */
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      const filtered = scanner.filterIgnored(tree);
      const tsFiles = scanner.filterTSFiles(filtered).filter(f => f.path.startsWith('src/'));
      
      // Kritik dosyaları önceliklendir + daha fazla dosya tara
      const criticalFiles = [
        'src/services/api.ts',
        'src/App.tsx',
        'src/config.ts',
        'src/constants.ts',
        'src/utils/api.ts',
        'src/context/DatabaseContext.tsx',
        'src/pages/cio/dashboard/CIODashboardPage.tsx',
        'src/pages/cio/dashboard/utils/socialPlatforms.ts',
        'src/pages/admin/reports/tabs/BackendTablesTab.tsx',
        'src/pages/projects/list/ProjectsListPage.tsx'
      ];
      
      const critical = tsFiles.filter(f => criticalFiles.some(cf => f.path.endsWith(cf)));
      const others = tsFiles.filter(f => !criticalFiles.some(cf => f.path.endsWith(cf)));
      
      // Kritik dosyalar + 50 random dosya (15'ten artırdık)
      const sampled = [...critical, ...others.slice(0, 50)];
      const violations = [];
      let filesScanned = 0;
      
      for (const file of sampled) {
        try {
          const content = await scanner.getFileContent(owner, repo, file.path);
          filesScanned++;
          
          // 1. Hard-coded URLs (Railway, social media, etc.)
          const urls = HardCodeScanner.findHardCodedURLs(content, file.path);
          if (urls) {
            violations.push({ 
              file: file.path, 
              type: 'hard_url', 
              count: urls.length,
              examples: urls.slice(0, 2)
            });
          }
          
          // 2. Hard-coded endpoint strings ('/api/v1/...', '/admin/...')
          const endpoints = HardCodeScanner.findEndpointStrings(content);
          if (endpoints) {
            violations.push({ 
              file: file.path, 
              type: 'endpoint_string', 
              count: endpoints.length,
              examples: endpoints.slice(0, 2)
            });
          }
          
          // 3. Mock data içindeki hard-coded değerler
          const mockData = HardCodeScanner.findMockData(content);
          if (mockData && mockData.urlCount > 0) {
            violations.push({ 
              file: file.path, 
              type: 'mock_data', 
              count: mockData.urlCount,
              examples: mockData.urls
            });
          }
          
          // 4. Hard-coded asset paths
          const assets = HardCodeScanner.findHardCodedAssetPaths(content);
          if (assets) {
            violations.push({ 
              file: file.path, 
              type: 'hard_asset', 
              count: assets.length,
              examples: assets.slice(0, 2)
            });
          }
          
          // 5. Environment variable fallbacks (import.meta.env.VAR || 'value')
          const envFallbacks = HardCodeScanner.findEnvFallbacks(content);
          if (envFallbacks) {
            violations.push({ 
              file: file.path, 
              type: 'env_fallback', 
              count: envFallbacks.length,
              examples: envFallbacks.slice(0, 2)
            });
          }
        } catch (err) {
          // Skip dosya okuma hatası
        }
      }
      
      const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
      const uniqueFiles = new Set(violations.map(v => v.file)).size;
      
      // Score: 0-10 violation = 85%, 11-30 = 60%, 31-50 = 40%, 51+ = 0%
      let score = 100;
      if (totalViolations > 0) {
        if (totalViolations <= 10) score = 85;
        else if (totalViolations <= 30) score = 60;
        else if (totalViolations <= 50) score = 40;
        else score = 15;
      }
      
      const durum = RuleFormatter.getDurumByScore(score);
      
      // Detaylı açıklama
      const violationsByType = {};
      violations.forEach(v => {
        if (!violationsByType[v.type]) violationsByType[v.type] = 0;
        violationsByType[v.type] += v.count;
      });
      
      const typeLabels = {
        'hard_url': 'URL',
        'endpoint_string': 'Endpoint string',
        'mock_data': 'Mock data URL',
        'hard_asset': 'Asset path',
        'env_fallback': 'ENV fallback'
      };
      
      const breakdown = Object.entries(violationsByType)
        .map(([type, count]) => `${count} ${typeLabels[type] || type}`)
        .join(', ');
      
      return RuleFormatter.createRule(
        1, 'I', '1. Hard-Code Yasağı',
        durum, score,
        `${totalViolations} hard-code bulundu (${uniqueFiles} dosyada, ${filesScanned} GitHub tarandı). ${breakdown}`,
        violations.slice(0, 10), // İlk 10 örnek
        totalViolations > 0 ? 'URL\'ler, endpoint\'ler ve asset path\'leri constants dosyasından gelsin.' : ''
      );
    } catch (error) {
      return RuleFormatter.createRule(1, 'I', '1. Hard-Code Yasağı', 'uyumsuz', 0, 'GitHub tarama hatası: ' + error.message);
    }
  }
}

module.exports = FrontendRule01HardCode;

