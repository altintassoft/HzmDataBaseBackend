const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 14: Backend Kuralları
 */
class Rule14BackendRules {
  static async analyze(srcPath) {
    let tablesConstUsage = 0;
    let totalTableQueries = 0;
    const backendSrc = path.join(srcPath, 'src');
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      if (content.includes('pool.query')) {
        const tableQueries = content.match(/FROM\s+\w+/gi);
        if (tableQueries) {
          totalTableQueries += tableQueries.length;
          tableQueries.forEach(q => {
            if (content.includes('TABLES.')) tablesConstUsage++;
          });
        }
      }
    });
    
    const score = totalTableQueries > 0 ? RuleFormatter.calculateScoreFromRatio(tablesConstUsage, totalTableQueries) : 50;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      14, 'IV', '14. Backend Kuralları',
      durum, score,
      `${tablesConstUsage}/${totalTableQueries} query TABLES constant kullanıyor.`,
      { tablesConstUsage, totalTableQueries },
      score < 80 ? 'Tüm table name\'ler TABLES constant\'ından gelmeli.' : ''
    );
  }
}

module.exports = Rule14BackendRules;

