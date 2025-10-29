const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const HardCodeScanner = require('../../scanners/hard-code-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 4: Anti-Patterns (Yasak)
 */
class Rule04AntiPatterns {
  static async analyze(srcPath) {
    const antiPatterns = [];
    const backendSrc = path.join(srcPath, 'src');
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      // Very deep paths (5+)
      if (HardCodeScanner.hasVeryDeepPaths(content)) {
        antiPatterns.push({ file, pattern: 'very_deep_path' });
      }
      
      // Manual module arrays
      const manualArrays = HardCodeScanner.findManualModuleArrays(content);
      if (manualArrays) {
        antiPatterns.push({ file, pattern: 'manual_module_array' });
      }
      
      // String concatenation for paths
      const stringConcat = HardCodeScanner.findStringConcatPaths(content);
      if (stringConcat) {
        antiPatterns.push({ file, pattern: 'string_concat_path' });
      }
    });
    
    const score = Math.max(0, 100 - (antiPatterns.length * 5));
    const durum = RuleFormatter.getDurumByViolations(antiPatterns.length, 5, 10);
    
    return RuleFormatter.createRule(
      4, 'I', '4. Anti-Patterns (Yasak)',
      durum, score,
      `${antiPatterns.length} anti-pattern bulundu.`,
      antiPatterns.slice(0, 10),
      antiPatterns.length > 0 ? 'Pre-commit hook ile otomatik kontrol ekleyin.' : ''
    );
  }
}

module.exports = Rule04AntiPatterns;


