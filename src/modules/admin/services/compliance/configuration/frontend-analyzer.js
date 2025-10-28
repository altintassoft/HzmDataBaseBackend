const fs = require('fs');
const path = require('path');
const logger = require('../../../../../core/logger');
const FrontendRules = require('./rules/frontend');
const GitHubScanner = require('./scanners/github-scanner');

/**
 * Frontend Analyzer
 * Frontend için tüm kuralları çalıştırır
 * 
 * İki modda çalışır:
 * 1. Local mode: Dosya sisteminden tarama
 * 2. Remote mode: GitHub API ile tarama
 */
class FrontendAnalyzer {
  static async analyze(backendPath) {
    // Önce local path dene
    const localPath = path.join(backendPath, '../HzmVeriTabaniFrontend');
    
    if (fs.existsSync(localPath)) {
      logger.info('🔍 Frontend analyzing (LOCAL mode)');
      return await this.analyzeLocal(localPath);
    }
    
    // Local yoksa GitHub'dan tara
    logger.info('🔍 Frontend analyzing (GITHUB mode)');
    return await this.analyzeGitHub();
  }
  
  /**
   * Local dosya sisteminden tarama
   */
  static async analyzeLocal(frontendPath) {
    logger.info('📂 Scanning local frontend:', frontendPath);
    
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
  
  /**
   * GitHub API ile tarama
   */
  static async analyzeGitHub() {
    try {
      const scanner = new GitHubScanner();
      
      // GitHub repository bilgisi environment variable'dan al
      // Format: "owner/repo" veya ayrı ayrı
      const repoUrl = process.env.GITHUB_FRONTEND_REPO || 'altintassoft/HzmDatabaseFrontend';
      const [owner, repo] = repoUrl.split('/');
      
      if (!owner || !repo) {
        logger.error('❌ Invalid GITHUB_FRONTEND_REPO format. Expected: owner/repo');
        return [];
      }
      
      logger.info(`📡 Analyzing frontend from GitHub: ${owner}/${repo}`);
      
      // Repository var mı kontrol et
      const exists = await scanner.repoExists(owner, repo);
      if (!exists) {
        logger.warn(`❌ Frontend repository not found: ${owner}/${repo}`);
        return [];
      }
      
      // GitHub'dan package.json al
      const packageJson = await scanner.getPackageJson(owner, repo);
      
      // GitHub context objesi oluştur
      const githubContext = {
        scanner,
        owner,
        repo,
        packageJson
      };
      
      const rules = [];
      
      // GitHub context ile rules çalıştır
      rules.push(await FrontendRules.Rule01HardCode.analyzeGitHub(githubContext));
      rules.push(await FrontendRules.Rule02Dynamic.analyze());
      rules.push(await FrontendRules.Rule03Config.analyzeGitHub(githubContext));
      rules.push(await FrontendRules.Rule04AntiPatterns.analyze());
      rules.push(await FrontendRules.Rule05BestPractices.analyzeGitHub(githubContext));
      rules.push(await FrontendRules.Rule06Security.analyze());
      rules.push(await FrontendRules.Rule07ErrorHandling.analyze());
      rules.push(await FrontendRules.Rule08MultiTenant.analyze());
      rules.push(await FrontendRules.Rule09Naming.analyze());
      rules.push(await FrontendRules.Rule13FrontendRules.analyze());
      rules.push(await FrontendRules.Rule15CodeQuality.analyzeGitHub(githubContext));
      rules.push(await FrontendRules.Rule16CICD.analyze());
      rules.push(await FrontendRules.Rule17Testing.analyze());
      rules.push(await FrontendRules.Rule18Aliases.analyzeGitHub(githubContext));
      rules.push(await FrontendRules.Rule19FeatureFlags.analyze());
      rules.push(await FrontendRules.Rule20Documentation.analyzeGitHub(githubContext));
      
      logger.info('✅ GitHub frontend analysis completed');
      return rules;
      
    } catch (error) {
      logger.error('Failed to analyze frontend from GitHub:', error.message);
      return [];
    }
  }
}

module.exports = FrontendAnalyzer;

