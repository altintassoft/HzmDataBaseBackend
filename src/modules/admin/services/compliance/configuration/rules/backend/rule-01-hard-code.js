const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const HardCodeScanner = require('../../scanners/hard-code-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 1: Hard-Code Yasağı
 */
class Rule01HardCode {
  static async analyze(srcPath) {
    const violations = [];
    const backendSrc = path.join(srcPath, 'src');
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      // Deep relative paths
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
    });
    
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const score = RuleFormatter.calculateScoreFromViolations(totalViolations, 3);
    const durum = RuleFormatter.getDurumByViolations(totalViolations, 10, 15);
    
    return RuleFormatter.createRule(
      1, 'I', '1. Hard-Code Yasağı',
      durum, score,
      `${totalViolations} hard-code bulundu (${violations.length} dosyada).`,
      violations.slice(0, 10),
      totalViolations > 0 ? 'Module aliases (@core, @modules) ve environment variables kullanın.' : ''
    );
  }
}

module.exports = Rule01HardCode;

