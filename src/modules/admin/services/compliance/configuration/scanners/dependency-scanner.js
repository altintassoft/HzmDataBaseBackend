const fs = require('fs');
const path = require('path');

/**
 * Dependency Scanner
 * package.json analizi ve dependency kontrolü
 */
class DependencyScanner {
  
  /**
   * package.json okur
   * @param {string} projectPath - Proje root dizini
   * @returns {Object}
   */
  static readPackageJson(projectPath) {
    const packagePath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return {};
    }
    
    try {
      return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (err) {
      return {};
    }
  }
  
  /**
   * Belirli bir dependency'nin varlığını kontrol eder
   * @param {Object} packageJson
   * @param {string} depName
   * @returns {boolean}
   */
  static hasDependency(packageJson, depName) {
    return !!(packageJson.dependencies?.[depName] || packageJson.devDependencies?.[depName]);
  }
  
  /**
   * Module aliases kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasModuleAliases(packageJson) {
    return !!packageJson._moduleAliases;
  }
  
  /**
   * Script varlığını kontrol eder
   * @param {Object} packageJson
   * @param {string} scriptName
   * @returns {boolean}
   */
  static hasScript(packageJson, scriptName) {
    return !!packageJson.scripts?.[scriptName];
  }
  
  /**
   * ESLint kurulumu kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasESLint(packageJson) {
    return this.hasDependency(packageJson, 'eslint');
  }
  
  /**
   * Prettier kurulumu kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasPrettier(packageJson) {
    return this.hasDependency(packageJson, 'prettier');
  }
  
  /**
   * TypeScript kurulumu kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasTypeScript(packageJson) {
    return this.hasDependency(packageJson, 'typescript');
  }
  
  /**
   * Test framework kontrolü (Jest)
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasJest(packageJson) {
    return this.hasDependency(packageJson, 'jest');
  }
  
  /**
   * Redis client kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasRedis(packageJson) {
    return this.hasDependency(packageJson, 'redis') || this.hasDependency(packageJson, 'ioredis');
  }
  
  /**
   * Rate limiting kontrolü
   * @param {Object} packageJson
   * @returns {boolean}
   */
  static hasRateLimiting(packageJson) {
    return this.hasDependency(packageJson, 'express-rate-limit');
  }
  
  /**
   * Çoklu dependency kontrolü
   * @param {Object} packageJson
   * @param {Array<string>} deps
   * @returns {Object} { found: [], missing: [] }
   */
  static checkMultipleDependencies(packageJson, deps) {
    const found = [];
    const missing = [];
    
    deps.forEach(dep => {
      if (this.hasDependency(packageJson, dep)) {
        found.push(dep);
      } else {
        missing.push(dep);
      }
    });
    
    return { found, missing };
  }
}

module.exports = DependencyScanner;




