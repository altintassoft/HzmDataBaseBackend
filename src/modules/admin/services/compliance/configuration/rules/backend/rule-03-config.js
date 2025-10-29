const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 3: Configuration Patterns
 */
class Rule03Config {
  static async analyze(srcPath) {
    const requiredFiles = [
      'src/core/constants/paths.js',
      'src/core/constants/tables.js',
      'src/core/constants/endpoints.js',
      'src/core/config/index.js'
    ];
    
    const { existing, missing } = StructureScanner.checkMultiplePaths(srcPath, requiredFiles);
    const score = RuleFormatter.calculateScoreFromRatio(existing.length, requiredFiles.length);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      3, 'I', '3. Configuration Patterns',
      durum, score,
      `${existing.length}/${requiredFiles.length} configuration dosyası mevcut.`,
      { existing, missing },
      missing.length > 0 ? `Eksik dosyalar: ${missing.join(', ')}` : ''
    );
  }
}

module.exports = Rule03Config;




