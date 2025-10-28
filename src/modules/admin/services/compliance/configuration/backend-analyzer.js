const BackendRules = require('./rules/backend');

/**
 * Backend Analyzer
 * Backend için tüm kuralları çalıştırır
 */
class BackendAnalyzer {
  static async analyze(srcPath) {
    const rules = [];
    
    // BÖLÜM I: TEMEL PRENSİPLER
    rules.push(await BackendRules.Rule01HardCode.analyze(srcPath));
    rules.push(await BackendRules.Rule02Dynamic.analyze(srcPath));
    rules.push(await BackendRules.Rule03Config.analyze(srcPath));
    rules.push(await BackendRules.Rule04AntiPatterns.analyze(srcPath));
    rules.push(await BackendRules.Rule05BestPractices.analyze(srcPath));
    
    // BÖLÜM II: GÜVENLİK & KALİTE
    rules.push(await BackendRules.Rule06Security.analyze(srcPath));
    rules.push(await BackendRules.Rule07ErrorHandling.analyze(srcPath));
    rules.push(await BackendRules.Rule08MultiTenant.analyze(srcPath));
    rules.push(await BackendRules.Rule09Naming.analyze(srcPath));
    
    // BÖLÜM III: VERİ & API
    rules.push(await BackendRules.Rule10DataTypes.analyze(srcPath));
    rules.push(await BackendRules.Rule11APIContract.analyze(srcPath));
    rules.push(await BackendRules.Rule12Performance.analyze(srcPath));
    
    // BÖLÜM IV: BACKEND
    rules.push(await BackendRules.Rule14BackendRules.analyze(srcPath));
    
    // BÖLÜM V: KOD KALİTESİ
    rules.push(await BackendRules.Rule15CodeQuality.analyze(srcPath));
    rules.push(await BackendRules.Rule16CICD.analyze(srcPath));
    
    // BÖLÜM VI: ADVANCED
    rules.push(await BackendRules.Rule17Testing.analyze(srcPath));
    rules.push(await BackendRules.Rule18Aliases.analyze(srcPath));
    rules.push(await BackendRules.Rule19FeatureFlags.analyze(srcPath));
    rules.push(await BackendRules.Rule20Documentation.analyze(srcPath));
    
    return rules;
  }
}

module.exports = BackendAnalyzer;

