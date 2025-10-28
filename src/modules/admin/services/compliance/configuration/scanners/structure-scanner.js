const fs = require('fs');
const path = require('path');

/**
 * Structure Scanner
 * Proje yapısı ve dosya varlığı kontrolü
 */
class StructureScanner {
  
  /**
   * Dosya/klasör varlığını kontrol eder
   * @param {string} basePath - Ana dizin
   * @param {string} relativePath - Göreceli yol
   * @returns {boolean}
   */
  static exists(basePath, relativePath) {
    return fs.existsSync(path.join(basePath, relativePath));
  }
  
  /**
   * Çoklu dosya varlığını kontrol eder
   * @param {string} basePath
   * @param {Array<string>} paths
   * @returns {Object} { existing: [], missing: [] }
   */
  static checkMultiplePaths(basePath, paths) {
    const existing = [];
    const missing = [];
    
    paths.forEach(p => {
      if (this.exists(basePath, p)) {
        existing.push(p);
      } else {
        missing.push(p);
      }
    });
    
    return { existing, missing };
  }
  
  /**
   * Modül README'lerini sayar
   * @param {string} modulesPath
   * @returns {number}
   */
  static countModuleReadmes(modulesPath) {
    if (!fs.existsSync(modulesPath)) return 0;
    
    let count = 0;
    const modules = fs.readdirSync(modulesPath, { withFileTypes: true })
      .filter(d => d.isDirectory());
    
    modules.forEach(mod => {
      if (this.exists(path.join(modulesPath, mod.name), 'README.md')) {
        count++;
      }
    });
    
    return count;
  }
  
  /**
   * Modül klasörlerini listeler
   * @param {string} modulesPath
   * @returns {Array<string>}
   */
  static listModules(modulesPath) {
    if (!fs.existsSync(modulesPath)) return [];
    
    return fs.readdirSync(modulesPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }
  
  /**
   * Modül dosya yapısını analiz eder
   * @param {string} modulePath
   * @returns {Object}
   */
  static analyzeModuleStructure(modulePath) {
    if (!fs.existsSync(modulePath)) {
      return { hasRoutes: false, hasController: false, hasService: false, hasModel: false };
    }
    
    const files = fs.readdirSync(modulePath);
    
    return {
      hasRoutes: files.some(f => f.includes('.routes.')),
      hasController: files.some(f => f.includes('.controller.')),
      hasService: files.some(f => f.includes('.service.')),
      hasModel: files.some(f => f.includes('.model.'))
    };
  }
  
  /**
   * Migration dosyalarını tarar
   * @param {string} migrationsPath
   * @returns {Array<string>}
   */
  static listMigrations(migrationsPath) {
    if (!fs.existsSync(migrationsPath)) return [];
    
    return fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort();
  }
  
  /**
   * Config dosyası varlığını kontrol eder
   * @param {string} projectPath
   * @returns {Object}
   */
  static checkConfigFiles(projectPath) {
    return {
      hasESLintRC: this.exists(projectPath, '.eslintrc.js') || this.exists(projectPath, '.eslintrc.json'),
      hasPrettierRC: this.exists(projectPath, '.prettierrc') || this.exists(projectPath, '.prettierrc.json'),
      hasGitHooks: this.exists(projectPath, '.husky'),
      hasGitHubActions: this.exists(projectPath, '.github/workflows'),
      hasEnvExample: this.exists(projectPath, '.env.example'),
      hasDockerfile: this.exists(projectPath, 'Dockerfile'),
      hasDockerCompose: this.exists(projectPath, 'docker-compose.yml')
    };
  }
  
  /**
   * Dosya içeriğini okur (güvenli)
   * @param {string} filePath
   * @returns {string|null}
   */
  static readFileSafe(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (err) {
      // Silent fail
    }
    return null;
  }
}

module.exports = StructureScanner;

