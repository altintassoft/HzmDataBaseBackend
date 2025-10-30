const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');

/**
 * API Endpoints Service
 * Scan and list all API endpoints
 */
class ApiEndpointsService {
  /**
   * Get all API endpoints
   * @returns {Object} List of all endpoints with metadata
   */
  static async getApiEndpoints() {
    try {
      logger.info('Scanning API endpoints...');
      
      const endpoints = [];
      const modulesDir = path.join(__dirname, '../../../');
      
      // Scan all module route files
      const modules = ['admin', 'auth', 'users', 'projects', 'api-keys', 'data', 'health'];
      
      for (const moduleName of modules) {
        const moduleDir = path.join(modulesDir, moduleName);
        
        if (!fs.existsSync(moduleDir)) continue;
        
        // Find route files
        const files = fs.readdirSync(moduleDir);
        const routeFiles = files.filter(f => f.endsWith('.routes.js') || f.endsWith('-routes.js'));
        
        for (const routeFile of routeFiles) {
          const filePath = path.join(moduleDir, routeFile);
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Parse endpoints from route file
          const routeEndpoints = this.parseRouteFile(content, moduleName);
          endpoints.push(...routeEndpoints);
        }
      }
      
      // Calculate statistics
      const stats = {
        total: endpoints.length,
        byModule: {},
        byMethod: {},
        byAuth: {},
        activeCount: endpoints.filter(e => e.status === 'active').length
      };
      
      endpoints.forEach(endpoint => {
        stats.byModule[endpoint.module] = (stats.byModule[endpoint.module] || 0) + 1;
        stats.byMethod[endpoint.method] = (stats.byMethod[endpoint.method] || 0) + 1;
        stats.byAuth[endpoint.authType] = (stats.byAuth[endpoint.authType] || 0) + 1;
      });
      
      return {
        summary: stats,
        endpoints: endpoints.sort((a, b) => {
          if (a.module !== b.module) return a.module.localeCompare(b.module);
          return a.path.localeCompare(b.path);
        })
      };
      
    } catch (error) {
      logger.error('Failed to scan API endpoints:', error);
      return {
        error: 'Failed to scan endpoints',
        message: error.message,
        endpoints: []
      };
    }
  }
  
  /**
   * Parse route file to extract endpoints
   */
  static parseRouteFile(content, moduleName) {
    const endpoints = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Match: router.get('/path', middleware, controller)
      const match = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
      
      if (match) {
        const [, method, routePath] = match;
        
        // Detect auth type
        let authType = 'Public';
        if (line.includes('authenticateJwtOrApiKey')) authType = 'JWT or API Key';
        else if (line.includes('authenticateJWT')) authType = 'JWT';
        else if (line.includes('authenticateApiKey')) authType = 'API Key';
        else if (line.includes('requireAdmin')) authType = 'JWT (Admin)';
        else if (line.includes('requireMasterAdmin')) authType = 'JWT (Master Admin)';
        
        // Detect if commented out
        const isCommented = line.trim().startsWith('//');
        
        endpoints.push({
          module: moduleName,
          method: method.toUpperCase(),
          path: `/api/v1/${moduleName}${routePath}`,
          authType,
          status: isCommented ? 'disabled' : 'active',
          raw: line.trim()
        });
      }
    }
    
    return endpoints;
  }
}

module.exports = ApiEndpointsService;

