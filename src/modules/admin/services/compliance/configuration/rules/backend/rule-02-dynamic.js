const path = require('path');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 2: Dynamic Discovery
 */
class Rule02Dynamic {
  static async analyze(srcPath) {
    const moduleLoaderExists = StructureScanner.exists(srcPath, 'src/core/utils/module-loader.js');
    
    const serverPath = path.join(srcPath, 'src/app/server.js');
    const serverContent = StructureScanner.readFileSafe(serverPath);
    const usesAutoLoad = serverContent && (serverContent.includes('autoLoadRoutes') || serverContent.includes('ModuleLoader'));
    
    const score = moduleLoaderExists && usesAutoLoad ? 100 : moduleLoaderExists ? 50 : 0;
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      2, 'I', '2. Dynamic Discovery',
      durum, score,
      moduleLoaderExists 
        ? (usesAutoLoad ? 'ModuleLoader mevcut ve kullanılıyor.' : 'ModuleLoader var ama kullanılmıyor.')
        : 'ModuleLoader bulunamadı.',
      { moduleLoaderExists, usesAutoLoad },
      score < 100 ? 'src/core/utils/module-loader.js oluşturun ve server.js\'de kullanın.' : ''
    );
  }
}

module.exports = Rule02Dynamic;


