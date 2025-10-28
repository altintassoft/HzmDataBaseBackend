const path = require('path');
const fs = require('fs');
const StructureScanner = require('../../scanners/structure-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Rule 10: Zaman, Para, Kimlik Tipleri
 */
class Rule10DataTypes {
  static async analyze(srcPath) {
    const migrationsPath = path.join(srcPath, 'migrations');
    let hasTimestamptz = false;
    let hasUUID = false;
    let hasDecimal = false;
    
    if (fs.existsSync(migrationsPath)) {
      const migrations = StructureScanner.listMigrations(migrationsPath);
      
      migrations.forEach(file => {
        const content = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        if (content.includes('TIMESTAMPTZ')) hasTimestamptz = true;
        if (content.includes('UUID')) hasUUID = true;
        if (content.includes('DECIMAL')) hasDecimal = true;
      });
    }
    
    const checks = { hasTimestamptz, hasUUID, hasDecimal };
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = RuleFormatter.calculateScoreFromRatio(passedCount, 3);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      10, 'III', '10. Zaman, Para, Kimlik Tipleri',
      durum, score,
      `${passedCount}/3 veri tipi standardına uygun.`,
      checks,
      passedCount < 3 ? 'TIMESTAMPTZ, UUID ve DECIMAL kullanın.' : ''
    );
  }
}

module.exports = Rule10DataTypes;

