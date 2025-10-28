const fs = require('fs');
const path = require('path');
const logger = require('../../../../../core/logger');
const BackendRules = require('./rules/backend');
const GitHubScanner = require('./scanners/github-scanner');

/**
 * Backend Analyzer
 * Backend için tüm kuralları çalıştırır
 * 
 * İki modda çalışır:
 * 1. Local mode: Dosya sisteminden tarama (development)
 * 2. Remote mode: GitHub API ile tarama (production/Railway)
 */
class BackendAnalyzer {
  static async analyze(srcPath) {
    // GitHub'dan tarama yapılacak mı kontrol et
    const githubRepo = process.env.GITHUB_BACKEND_REPO;
    
    if (githubRepo) {
      logger.info('🔍 Backend analyzing (GITHUB mode)');
      return await this.analyzeGitHub(githubRepo);
    }
    
    // Local dosya sisteminden tara
    logger.info('🔍 Backend analyzing (LOCAL mode)');
    return await this.analyzeLocal(srcPath);
  }
  
  /**
   * Local dosya sisteminden tarama
   */
  static async analyzeLocal(srcPath) {
    logger.info('📂 Scanning local backend:', srcPath);
    
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
  
  /**
   * GitHub'dan tarama
   */
  static async analyzeGitHub(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    
    if (!owner || !repo) {
      logger.error('Invalid GITHUB_BACKEND_REPO format. Expected: owner/repo');
      return [];
    }
    
    logger.info(`📡 Analyzing backend from GitHub: ${owner}/${repo}`);
    
    const scanner = new GitHubScanner();
    const rules = [];
    
    // GitHub context oluştur
    const githubContext = {
      scanner,
      owner,
      repo
    };
    
    // Rule 01: Hard-Code - GitHub'dan tara
    if (typeof BackendRules.Rule01HardCode.analyzeGitHub === 'function') {
      rules.push(await BackendRules.Rule01HardCode.analyzeGitHub(githubContext));
    } else {
      rules.push(await BackendRules.Rule01HardCode.analyze('/app')); // Fallback
    }
    
    // Diğer kurallar için placeholder (şimdilik)
    // TODO: Her rule için analyzeGitHub() implement edilecek
    rules.push(await BackendRules.Rule02Dynamic.analyze('/app'));
    rules.push(await BackendRules.Rule03Config.analyze('/app'));
    rules.push(await BackendRules.Rule04AntiPatterns.analyze('/app'));
    rules.push(await BackendRules.Rule05BestPractices.analyze('/app'));
    rules.push(await BackendRules.Rule06Security.analyze('/app'));
    rules.push(await BackendRules.Rule07ErrorHandling.analyze('/app'));
    rules.push(await BackendRules.Rule08MultiTenant.analyze('/app'));
    rules.push(await BackendRules.Rule09Naming.analyze('/app'));
    rules.push(await BackendRules.Rule10DataTypes.analyze('/app'));
    rules.push(await BackendRules.Rule11APIContract.analyze('/app'));
    rules.push(await BackendRules.Rule12Performance.analyze('/app'));
    rules.push(await BackendRules.Rule14BackendRules.analyze('/app'));
    rules.push(await BackendRules.Rule15CodeQuality.analyze('/app'));
    rules.push(await BackendRules.Rule16CICD.analyze('/app'));
    rules.push(await BackendRules.Rule17Testing.analyze('/app'));
    rules.push(await BackendRules.Rule18Aliases.analyze('/app'));
    rules.push(await BackendRules.Rule19FeatureFlags.analyze('/app'));
    rules.push(await BackendRules.Rule20Documentation.analyze('/app'));
    
    logger.info('✅ GitHub backend analysis completed');
    return rules;
  }
}

module.exports = BackendAnalyzer;
