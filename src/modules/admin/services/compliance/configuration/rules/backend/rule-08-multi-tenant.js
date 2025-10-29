const path = require('path');
const FileScanner = require('../../scanners/file-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 8: Multi-Tenant & İzleme
 */
class Rule08MultiTenant {
  static async analyze(srcPath) {
    let hasTenantFilter = 0;
    let totalQueries = 0;
    const backendSrc = path.join(srcPath, 'src');
    
    FileScanner.scanJSFiles(backendSrc, (file, content) => {
      const queries = content.match(/pool\.query\([^)]+\)/gs);
      if (queries) {
        queries.forEach(q => {
          totalQueries++;
          if (q.includes('tenant_id') || q.includes('organization_id')) {
            hasTenantFilter++;
          }
        });
      }
    });
    
    const score = totalQueries > 0 ? RuleFormatter.calculateScoreFromRatio(hasTenantFilter, totalQueries) : 0;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      8, 'II', '8. Multi-Tenant & İzleme',
      durum, score,
      `${hasTenantFilter}/${totalQueries} query tenant_id ile filtreleniyor.`,
      { hasTenantFilter, totalQueries },
      score < 80 ? 'Tüm veri erişimlerinde tenant_id filtresi zorunlu olmalı.' : ''
    );
  }
}

module.exports = Rule08MultiTenant;


