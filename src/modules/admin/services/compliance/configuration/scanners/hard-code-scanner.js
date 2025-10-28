/**
 * Hard-Code Scanner
 * Hard-coded değerleri tespit eder
 */
class HardCodeScanner {
  
  /**
   * Deep relative paths tespit eder (../../../ ve üzeri)
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findDeepPaths(content) {
    // 3+ level relative paths
    const requirePaths = content.match(/require\(['"](\.\.\/){3,}[^'"]+['"]\)/g);
    const importPaths = content.match(/from\s+['"](\.\.\/){3,}[^'"]+['"]/g);
    
    const all = [];
    if (requirePaths) all.push(...requirePaths);
    if (importPaths) all.push(...importPaths);
    
    return all.length > 0 ? all : null;
  }
  
  /**
   * Hard-coded IP adreslerini tespit eder
   * @param {string} content - Dosya içeriği
   * @param {string} filePath - Dosya yolu (test dosyaları için)
   * @returns {Array|null}
   */
  static findHardCodedIPs(content, filePath = '') {
    if (filePath.includes('test')) return null;
    return content.match(/(['"])(https?:\/\/)?(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(['"])/g);
  }
  
  /**
   * Hard-coded table names tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {Object|null}
   */
  static findHardCodedTables(content) {
    if (!content.includes('pool.query')) return null;
    
    const tableQueries = content.match(/FROM\s+(users|projects|tenants|api_keys)\s+/gi);
    if (!tableQueries) return null;
    
    // TABLES. constant kullanılıyorsa sorun yok
    if (content.includes('TABLES.')) return null;
    
    return { matches: tableQueries };
  }
  
  /**
   * Hard-coded secrets tespit eder
   * @param {string} content - Dosya içeriği
   * @param {string} filePath - Dosya yolu
   * @returns {Array|null}
   */
  static findHardCodedSecrets(content, filePath = '') {
    if (filePath.includes('test') || filePath.includes('.example')) return null;
    return content.match(/(apiKey|api_key|token|secret|password)\s*[:=]\s*['"]\w{12,}['"]/gi);
  }
  
  /**
   * Hard-coded URLs tespit eder (frontend için)
   * @param {string} content - Dosya içeriği
   * @param {string} filePath - Dosya yolu
   * @returns {Array|null}
   */
  static findHardCodedURLs(content, filePath = '') {
    if (filePath.includes('test')) return null;
    
    // Çok daha kapsamlı URL detection
    // 1. Localhost ve local IPs
    // 2. Production domains (railway, netlify, vercel, heroku)
    // 3. Social media URLs (facebook, instagram, twitter, linkedin)
    // 4. Generic https:// URLs (placeholder değilse)
    
    const patterns = [
      // Local URLs
      /(['"])(https?:\/\/)?(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(['"])/g,
      // Production platforms
      /(['"])(https?:\/\/)?[a-zA-Z0-9-]+\.(railway\.app|netlify\.app|vercel\.app|herokuapp\.com)([\/\w\-._~:?#[\]@!$&'()*+,;=]*)?(['"])/g,
      // Social media (non-placeholder)
      /(['"])(https?:\/\/)?(www\.)?(facebook|instagram|twitter|linkedin|youtube|tiktok)\.com\/[a-zA-Z0-9_-]+(['"])/g,
      // API endpoints with production names
      /(['"])(https?:\/\/)?api\.[a-zA-Z0-9-]+\.(com|net|org|io)([\/\w\-._~:?#[\]@!$&'()*+,;=]*)?(['"])/g
    ];
    
    const allMatches = [];
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        allMatches.push(...matches);
      }
    });
    
    // Placeholder ve example URL'leri filtrele
    const filtered = allMatches.filter(url => {
      const lower = url.toLowerCase();
      return !lower.includes('example.com') && 
             !lower.includes('your') && 
             !lower.includes('placeholder') &&
             !lower.includes('import.meta.env') &&
             !lower.includes('process.env');
    });
    
    return filtered.length > 0 ? filtered : null;
  }
  
  /**
   * Hard-coded asset paths tespit eder (frontend için)
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findHardCodedAssetPaths(content) {
    if (!content.match(/src=['"]\/[^'"]*['"]/)) return null;
    
    const paths = content.match(/src=['"]\/[^'"]*['"]/g);
    if (content.includes('import.meta.env')) return null;
    
    return paths;
  }
  
  /**
   * String concatenation ile path oluşturma tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findStringConcatPaths(content) {
    return content.match(/['"]\/[^'"]*['"] \+ /g);
  }
  
  /**
   * Very deep paths tespit eder (5+ seviye)
   * @param {string} content - Dosya içeriği
   * @returns {boolean}
   */
  static hasVeryDeepPaths(content) {
    return content.includes('../../../../../');
  }
  
  /**
   * Manuel module arrays tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findManualModuleArrays(content) {
    return content.match(/const\s+\w*[Mm]odules?\w*\s*=\s*\[['"]/g);
  }
  
  /**
   * Log'larda maskesiz credentials tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {boolean}
   */
  static hasUnmaskedLogging(content) {
    if (!content.includes('logger.')) return false;
    if (!content.includes('password') && !content.includes('token')) return false;
    if (content.includes('***') || content.includes('mask')) return false;
    return true;
  }
  
  /**
   * Environment variable fallbacks tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findEnvFallbacks(content) {
    // process.env.VAR || 'value' veya process.env.VAR || 123
    const patterns = [
      /process\.env\.\w+\s*\|\|\s*['"][^'"]+['"]/g,
      /process\.env\.\w+\s*\|\|\s*\d+/g
    ];
    
    const all = [];
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) all.push(...matches);
    });
    
    return all.length > 0 ? all : null;
  }
  
  /**
   * Hard-coded file/directory paths tespit eder
   * @param {string} content - Dosya içeriği
   * @returns {Array|null}
   */
  static findHardCodedPaths(content) {
    // docs/, migrations/, routes.OLD/, gibi hard-coded paths
    const patterns = [
      /(['"])(docs\/[^'"]+|migrations\/[^'"]+|routes\.OLD\/[^'"]+|scripts\/[^'"]+)(['"])/g,
      // path.join içinde hard-coded klasör isimleri
      /path\.join\([^)]*['"](?:docs|migrations|routes\.OLD|scripts)['"]/g
    ];
    
    const all = [];
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        // Test dosyalarını ve yorumları filtrele
        const filtered = matches.filter(m => {
          const lower = m.toLowerCase();
          return !lower.includes('test') && 
                 !lower.includes('spec') && 
                 !content.substring(Math.max(0, content.indexOf(m) - 5), content.indexOf(m)).includes('//');
        });
        if (filtered.length > 0) all.push(...filtered);
      }
    });
    
    return all.length > 0 ? all : null;
  }
}

module.exports = HardCodeScanner;

