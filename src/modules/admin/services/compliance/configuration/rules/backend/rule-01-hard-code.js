const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const HardCodeScanner = require('../../scanners/hard-code-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 1: Hard-Code Yasağı
 */
class Rule01HardCode {
  /**
   * Local file system'den analiz
   */
  static async analyze(srcPath) {
    const violations = [];
    const backendSrc = path.join(srcPath, 'src');
    
    let filesScanned = 0;
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      filesScanned++;
      // Deep relative paths (../../../ ve üzeri)
      const deepPaths = HardCodeScanner.findDeepPaths(content);
      if (deepPaths) {
        violations.push({ file, type: 'deep_path', count: deepPaths.length, examples: deepPaths.slice(0, 2) });
      }
      
      // Hard-coded IPs
      const ips = HardCodeScanner.findHardCodedIPs(content, file);
      if (ips) {
        violations.push({ file, type: 'hard_ip', count: ips.length, examples: ips.slice(0, 2) });
      }
      
      // Hard-coded table names
      const tables = HardCodeScanner.findHardCodedTables(content);
      if (tables) {
        violations.push({ file, type: 'hard_table', count: tables.matches.length, examples: tables.matches.slice(0, 2) });
      }
      
      // Environment variable fallbacks (process.env.VAR || default)
      const envFallbacks = HardCodeScanner.findEnvFallbacks(content);
      if (envFallbacks) {
        violations.push({ file, type: 'env_fallback', count: envFallbacks.length, examples: envFallbacks.slice(0, 2) });
      }
      
      // Hard-coded file paths (docs/, migrations/, routes.OLD/)
      const paths = HardCodeScanner.findHardCodedPaths(content);
      if (paths) {
        violations.push({ file, type: 'hard_path', count: paths.length, examples: paths.slice(0, 2) });
      }
    });
    
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const score = RuleFormatter.calculateScoreFromViolations(totalViolations, 3);
    const durum = RuleFormatter.getDurumByViolations(totalViolations, 10, 15);
    
    console.log(`[Rule-01 LOCAL] Scanned ${filesScanned} files, found ${totalViolations} violations in ${violations.length} files`);
    
    return RuleFormatter.createRule(
      1, 'I', '1. Hard-Code Yasağı',
      durum, score,
      `${totalViolations} hard-code bulundu (${violations.length} dosyada tarandı: ${filesScanned}).`,
      violations.slice(0, 10),
      totalViolations > 0 ? 'Module aliases (@core, @modules) ve environment variables kullanın.' : ''
    );
  }
  
  /**
   * GitHub'dan analiz
   */
  static async analyzeGitHub(githubContext) {
    const { scanner, owner, repo } = githubContext;
    
    try {
      const tree = await scanner.getRepoTree(owner, repo);
      const filtered = scanner.filterIgnored(tree);
      const jsFiles = filtered.filter(f => /\.(js|ts)$/.test(f.path) && f.path.startsWith('src/'));
      
      console.log(`[Rule-01 GITHUB] Found ${jsFiles.length} JS/TS files in src/`);
      
      const violations = [];
      let filesScanned = 0;
      
      // Tüm dosyaları tara
      for (const file of jsFiles) {
        try {
          const content = await scanner.getFileContent(owner, repo, file.path);
          filesScanned++;
          
          // Deep relative paths
          const deepPaths = HardCodeScanner.findDeepPaths(content);
          if (deepPaths) {
            violations.push({ file: file.path, type: 'deep_path', count: deepPaths.length, examples: deepPaths.slice(0, 2) });
          }
          
          // Hard-coded IPs
          const ips = HardCodeScanner.findHardCodedIPs(content, file.path);
          if (ips) {
            violations.push({ file: file.path, type: 'hard_ip', count: ips.length, examples: ips.slice(0, 2) });
          }
          
          // Hard-coded table names
          const tables = HardCodeScanner.findHardCodedTables(content);
          if (tables) {
            violations.push({ file: file.path, type: 'hard_table', count: tables.matches.length, examples: tables.matches.slice(0, 2) });
          }
          
          // Environment variable fallbacks
          const envFallbacks = HardCodeScanner.findEnvFallbacks(content);
          if (envFallbacks) {
            violations.push({ file: file.path, type: 'env_fallback', count: envFallbacks.length, examples: envFallbacks.slice(0, 2) });
          }
          
          // Hard-coded file paths
          const paths = HardCodeScanner.findHardCodedPaths(content);
          if (paths) {
            violations.push({ file: file.path, type: 'hard_path', count: paths.length, examples: paths.slice(0, 2) });
          }
        } catch (err) {
          console.error(`Error scanning ${file.path}:`, err.message);
        }
      }
      
      const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
      const score = RuleFormatter.calculateScoreFromViolations(totalViolations, 3);
      const durum = RuleFormatter.getDurumByViolations(totalViolations, 10, 15);
      
      console.log(`[Rule-01 GITHUB] Scanned ${filesScanned} files, found ${totalViolations} violations in ${violations.length} files`);
      
      return RuleFormatter.createRule(
        1, 'I', '1. Hard-Code Yasağı',
        durum, score,
        `${totalViolations} hard-code bulundu (${violations.length} dosyada tarandı: ${filesScanned} GitHub).`,
        violations.slice(0, 10),
        totalViolations > 0 ? 'Module aliases (@core, @modules) ve environment variables kullanın.' : ''
      );
    } catch (error) {
      console.error('[Rule-01 GITHUB] Error:', error);
      return RuleFormatter.createRule(
        1, 'I', '1. Hard-Code Yasağı',
        'uyumsuz', 0,
        `GitHub taraması başarısız: ${error.message}`,
        [],
        'GitHub Token ve repo adını kontrol edin.'
      );
    }
  }
}

module.exports = Rule01HardCode;

