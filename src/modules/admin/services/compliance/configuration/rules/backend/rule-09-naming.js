const path = require('path');
const fs = require('fs');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 9: İsimlendirme & Konvansiyon
 */
class Rule09Naming {
  static async analyze(srcPath) {
    const modulesPath = path.join(srcPath, 'src/modules');
    const inconsistencies = [];
    
    if (fs.existsSync(modulesPath)) {
      const modules = StructureScanner.listModules(modulesPath);
      
      modules.forEach(modName => {
        const modPath = path.join(modulesPath, modName);
        const files = fs.readdirSync(modPath);
        
        // Check route file naming
        const routeFile = files.find(f => f.includes('.routes.js'));
        if (routeFile && !routeFile.startsWith(modName)) {
          inconsistencies.push({ 
            module: modName, 
            file: routeFile, 
            expected: `${modName}.routes.js`,
            issue: 'naming_mismatch' 
          });
        }
      });
    }
    
    const score = Math.max(0, 100 - (inconsistencies.length * 10));
    const durum = RuleFormatter.getDurumByViolations(inconsistencies.length, 2, 3);
    
    return RuleFormatter.createRule(
      9, 'II', '9. İsimlendirme & Konvansiyon',
      durum, score,
      `${inconsistencies.length} naming tutarsızlığı bulundu.`,
      inconsistencies,
      inconsistencies.length > 0 ? 'Dosya isimleri modül ismiyle eşleşmeli (users.routes.js).' : ''
    );
  }
}

module.exports = Rule09Naming;




