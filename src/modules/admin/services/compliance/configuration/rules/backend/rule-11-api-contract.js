const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 11: API Sözleşmesi & Versiyonlama
 */
class Rule11APIContract {
  static async analyze(srcPath) {
    const openapiExists = StructureScanner.exists(srcPath, 'docs/openapi.yaml') ||
                          StructureScanner.exists(srcPath, 'openapi.yaml');
    
    const serverPath = path.join(srcPath, 'src/app/server.js');
    const serverContent = StructureScanner.readFileSafe(serverPath);
    const hasVersioning = serverContent && serverContent.includes('/api/v1');
    
    const score = (openapiExists ? 50 : 0) + (hasVersioning ? 50 : 0);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      11, 'III', '11. API Sözleşmesi & Versiyonlama',
      durum, score,
      `OpenAPI: ${openapiExists ? '✓' : '✗'}, Versiyonlama: ${hasVersioning ? '✓' : '✗'}`,
      { openapiExists, hasVersioning },
      score < 100 ? 'OpenAPI spec oluşturun ve /v1 versiyonlama kullanın.' : ''
    );
  }
}

module.exports = Rule11APIContract;


