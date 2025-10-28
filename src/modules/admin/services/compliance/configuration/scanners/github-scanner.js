const https = require('https');
const logger = require('../../../../../../core/logger');

/**
 * GitHub Scanner
 * GitHub API kullanarak remote repository'leri tarar
 */
class GitHubScanner {
  
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.baseUrl = 'api.github.com';
  }
  
  /**
   * GitHub API'ye HTTPS request yapar
   * @param {string} path - API endpoint path
   * @returns {Promise<Object>}
   */
  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'HZM-Database-Compliance-Scanner',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      // Token varsa ekle
      if (this.token) {
        options.headers['Authorization'] = `token ${this.token}`;
      }
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            // Rate limit kontrolü
            if (res.statusCode === 403 && parsed.message?.includes('rate limit')) {
              logger.warn('GitHub API rate limit exceeded');
              reject(new Error('GitHub API rate limit exceeded'));
              return;
            }
            
            if (res.statusCode !== 200) {
              logger.error('GitHub API error:', parsed.message);
              reject(new Error(parsed.message || 'GitHub API error'));
              return;
            }
            
            resolve(parsed);
          } catch (err) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.end();
    });
  }
  
  /**
   * Repository tree'sini alır (tüm dosya listesi)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name (default: main)
   * @returns {Promise<Array>}
   */
  async getRepoTree(owner, repo, branch = 'main') {
    try {
      logger.info(`📡 Fetching GitHub tree: ${owner}/${repo}@${branch}`);
      
      const path = `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const response = await this.makeRequest(path);
      
      if (!response.tree) {
        throw new Error('No tree data in response');
      }
      
      logger.info(`✅ Fetched ${response.tree.length} files from GitHub`);
      return response.tree;
    } catch (error) {
      logger.error('Failed to fetch GitHub tree:', error.message);
      throw error;
    }
  }
  
  /**
   * Dosya içeriğini alır
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} filePath - Dosya yolu
   * @param {string} branch - Branch name
   * @returns {Promise<string>}
   */
  async getFileContent(owner, repo, filePath, branch = 'main') {
    try {
      const path = `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
      const response = await this.makeRequest(path);
      
      if (!response.content) {
        throw new Error('No content in response');
      }
      
      // Base64 decode
      const content = Buffer.from(response.content, 'base64').toString('utf8');
      return content;
    } catch (error) {
      logger.error(`Failed to fetch file ${filePath}:`, error.message);
      throw error;
    }
  }
  
  /**
   * package.json'ı alır
   * @param {string} owner
   * @param {string} repo
   * @returns {Promise<Object>}
   */
  async getPackageJson(owner, repo) {
    try {
      const content = await this.getFileContent(owner, repo, 'package.json');
      return JSON.parse(content);
    } catch (error) {
      logger.warn('Could not fetch package.json:', error.message);
      return {};
    }
  }
  
  /**
   * Repository'nin var olup olmadığını kontrol eder
   * @param {string} owner
   * @param {string} repo
   * @returns {Promise<boolean>}
   */
  async repoExists(owner, repo) {
    try {
      const path = `/repos/${owner}/${repo}`;
      await this.makeRequest(path);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * TypeScript/React dosyalarını filtreler
   * @param {Array} tree - GitHub tree
   * @returns {Array}
   */
  filterTSFiles(tree) {
    return tree.filter(item => {
      if (item.type !== 'blob') return false;
      
      const ext = item.path.split('.').pop();
      return ['ts', 'tsx', 'js', 'jsx'].includes(ext);
    });
  }
  
  /**
   * Ignore edilmesi gereken dosyaları filtreler
   * @param {Array} tree
   * @returns {Array}
   */
  filterIgnored(tree) {
    const ignoredPaths = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt'];
    
    return tree.filter(item => {
      const pathParts = item.path.split('/');
      return !pathParts.some(part => ignoredPaths.includes(part));
    });
  }
}

module.exports = GitHubScanner;

