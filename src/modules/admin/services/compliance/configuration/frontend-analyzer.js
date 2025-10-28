const fs = require('fs');
const path = require('path');
const FrontendRules = require('./rules/frontend');

/**
 * Frontend Analyzer
 * Frontend için tüm kuralları çalıştırır
 */
class FrontendAnalyzer {
  static async analyze(backendPath) {
    // Frontend path'i backend'e göre hesapla
    const frontendPath = path.join(backendPath, '../HzmVeriTabaniFrontend');
    
    // Frontend yoksa boş array dön
    if (!fs.existsSync(frontendPath)) {
      return [];
    }
    
    const rules = [];
    
    // Tüm frontend rules'ları çalıştır
    rules.push(await FrontendRules.Rule01HardCode.analyze(frontendPath));
    rules.push(await FrontendRules.Rule02Dynamic.analyze());
    rules.push(await FrontendRules.Rule03Config.analyze(frontendPath));
    rules.push(await FrontendRules.Rule04AntiPatterns.analyze());
    rules.push(await FrontendRules.Rule05BestPractices.analyze(frontendPath));
    rules.push(await FrontendRules.Rule06Security.analyze());
    rules.push(await FrontendRules.Rule07ErrorHandling.analyze());
    rules.push(await FrontendRules.Rule08MultiTenant.analyze());
    rules.push(await FrontendRules.Rule09Naming.analyze());
    rules.push(await FrontendRules.Rule13FrontendRules.analyze());
    rules.push(await FrontendRules.Rule15CodeQuality.analyze(frontendPath));
    rules.push(await FrontendRules.Rule16CICD.analyze());
    rules.push(await FrontendRules.Rule17Testing.analyze());
    rules.push(await FrontendRules.Rule18Aliases.analyze(frontendPath));
    rules.push(await FrontendRules.Rule19FeatureFlags.analyze());
    rules.push(await FrontendRules.Rule20Documentation.analyze(frontendPath));
    
    return rules;
  }
}

module.exports = FrontendAnalyzer;

