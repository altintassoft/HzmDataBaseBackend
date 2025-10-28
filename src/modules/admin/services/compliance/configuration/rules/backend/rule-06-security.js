const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const HardCodeScanner = require('../../scanners/hard-code-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 6: Güvenlik & Gizli Bilgi
 */
class Rule06Security {
  static async analyze(srcPath) {
    const securityIssues = [];
    const backendSrc = path.join(srcPath, 'src');
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      // Hard-coded secrets
      const secrets = HardCodeScanner.findHardCodedSecrets(content, file);
      if (secrets) {
        securityIssues.push({ file, type: 'potential_secret', count: secrets.length });
      }
      
      // Unmasked logging
      if (HardCodeScanner.hasUnmaskedLogging(content)) {
        securityIssues.push({ file, type: 'log_without_mask' });
      }
    });
    
    const totalIssues = securityIssues.reduce((sum, i) => sum + (i.count || 1), 0);
    const score = RuleFormatter.calculateScoreFromViolations(totalIssues, 10);
    const durum = RuleFormatter.getDurumByViolations(totalIssues, 3, 5);
    
    return RuleFormatter.createRule(
      6, 'II', '6. Güvenlik & Gizli Bilgi',
      durum, score,
      `${totalIssues} potansiyel güvenlik sorunu bulundu.`,
      securityIssues.slice(0, 10),
      totalIssues > 0 ? 'Credentials maskelensin ve environment variables kullanın.' : ''
    );
  }
}

module.exports = Rule06Security;

