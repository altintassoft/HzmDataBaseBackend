const fs = require('fs');
const path = require('path');

/**
 * File Scanner Helper
 * Dosya tarama ve filtreleme işlemleri
 */
class FileScanner {
  
  /**
   * JS/TS dosyalarını tarar
   * @param {string} dir - Taranacak dizin
   * @param {Function} callback - Her dosya için çağrılacak fonksiyon (file, content)
   */
  static scanJSFiles(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          if (!this.isIgnoredDir(item.name)) {
            scan(fullPath);
          }
        } else if (/\.(js|ts)$/.test(item.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relativePath = path.relative(dir, fullPath);
            callback(relativePath, content, fullPath);
          } catch (err) {
            // Skip unreadable files
          }
        }
      }
    };
    
    scan(dir);
  }
  
  /**
   * TypeScript/React dosyalarını tarar
   * @param {string} dir - Taranacak dizin
   * @param {Function} callback - Her dosya için çağrılacak fonksiyon (file, content)
   */
  static scanTSFiles(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          if (!this.isIgnoredDir(item.name)) {
            scan(fullPath);
          }
        } else if (/\.(tsx?|jsx?)$/.test(item.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relativePath = path.relative(dir, fullPath);
            callback(relativePath, content, fullPath);
          } catch (err) {
            // Skip unreadable files
          }
        }
      }
    };
    
    scan(dir);
  }
  
  /**
   * Ignore edilmesi gereken dizinler
   * @param {string} dirName
   * @returns {boolean}
   */
  static isIgnoredDir(dirName) {
    const ignored = ['node_modules', 'dist', '.git', 'coverage', 'build', '.next', '.nuxt'];
    return ignored.includes(dirName);
  }
  
  /**
   * Dosyanın test dosyası olup olmadığını kontrol eder
   * @param {string} filePath
   * @returns {boolean}
   */
  static isTestFile(filePath) {
    return /\.(test|spec)\.(js|ts|tsx|jsx)$/.test(filePath) || filePath.includes('__tests__');
  }
}

module.exports = FileScanner;

