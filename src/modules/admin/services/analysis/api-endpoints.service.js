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
        const fullPath = `/api/v1/${moduleName}${routePath}`;
        
        // Detect auth type
        let authType = 'Public';
        if (line.includes('authenticateJwtOrApiKey')) authType = 'JWT or API Key';
        else if (line.includes('authenticateJWT')) authType = 'JWT';
        else if (line.includes('authenticateApiKey')) authType = 'API Key';
        else if (line.includes('requireAdmin')) authType = 'JWT (Admin)';
        else if (line.includes('requireMasterAdmin')) authType = 'JWT (Master Admin)';
        
        // Detect if commented out
        const isCommented = line.trim().startsWith('//');
        
        // ✨ COMPLIANCE CHECKS
        const compliance = this.checkEndpointCompliance(fullPath, method.toUpperCase(), authType, moduleName);
        
        endpoints.push({
          module: moduleName,
          method: method.toUpperCase(),
          path: fullPath,
          authType,
          status: isCommented ? 'disabled' : 'active',
          
          // Compliance fields
          strategyCompliant: compliance.strategyCompliant,
          namingCompliant: compliance.namingCompliant,
          authCompliant: compliance.authCompliant,
          complianceScore: compliance.score,
          issues: compliance.issues,
          recommendations: compliance.recommendations,
          
          raw: line.trim()
        });
      }
    }
    
    return endpoints;
  }
  
  /**
   * Check endpoint compliance with SMART_ENDPOINT_STRATEGY_V2
   */
  static checkEndpointCompliance(path, method, authType, moduleName) {
    const issues = [];
    const recommendations = [];
    let score = 100;
    
    // 1. Naming Convention Check
    const namingCompliant = this.checkNaming(path, method);
    if (!namingCompliant.valid) {
      issues.push(namingCompliant.issue);
      recommendations.push(namingCompliant.recommendation);
      score -= 25;
    }
    
    // 2. Strategy Check (RESTful vs RPC)
    const strategyCompliant = this.checkStrategy(path, method, moduleName);
    if (!strategyCompliant.valid) {
      issues.push(strategyCompliant.issue);
      recommendations.push(strategyCompliant.recommendation);
      score -= 25;
    }
    
    // 3. Auth Check (doğru auth tipi mi?)
    const authCompliant = this.checkAuth(path, authType, moduleName);
    if (!authCompliant.valid) {
      issues.push(authCompliant.issue);
      recommendations.push(authCompliant.recommendation);
      score -= 25;
    }
    
    return {
      strategyCompliant: strategyCompliant.valid,
      namingCompliant: namingCompliant.valid,
      authCompliant: authCompliant.valid,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }
  
  /**
   * Check naming convention
   */
  static checkNaming(path, method) {
    // RESTful naming: /resource/:id (good)
    // RPC naming: /getUser (bad)
    
    const pathParts = path.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];
    
    // Check for verbs in path (getUser, createProject, etc)
    const verbs = ['get', 'create', 'update', 'delete', 'fetch', 'save', 'load', 'find'];
    const hasVerb = verbs.some(verb => lastPart.toLowerCase().startsWith(verb));
    
    if (hasVerb) {
      return {
        valid: false,
        issue: `Verb in URL: ${lastPart}`,
        recommendation: `Use RESTful naming: ${method} /resource instead of ${method} /${lastPart}`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Check RESTful strategy
   */
  static checkStrategy(path, method, moduleName) {
    // Smart endpoints: /data/:resource (generic)
    // Individual endpoints: /auth/login (specific)
    
    if (path.includes(':resource') || path.includes(':entity')) {
      // Smart endpoint
      return { valid: true, type: 'smart' };
    }
    
    // Individual endpoint (OK for auth, admin, etc)
    if (['auth', 'admin', 'health'].includes(moduleName)) {
      return { valid: true, type: 'individual' };
    }
    
    return { valid: true, type: 'individual' };
  }
  
  /**
   * Check auth type appropriateness
   */
  static checkAuth(path, authType, moduleName) {
    // Public endpoints: only /auth/*, /health/*
    if (authType === 'Public') {
      if (!path.includes('/auth/') && !path.includes('/health/')) {
        return {
          valid: false,
          issue: 'Public endpoint outside auth/health',
          recommendation: 'Add authentication (JWT or API Key)'
        };
      }
    }
    
    // Admin endpoints should have admin auth
    if (path.includes('/admin/')) {
      if (!authType.includes('JWT')) {
        return {
          valid: false,
          issue: 'Admin endpoint without JWT auth',
          recommendation: 'Use JWT authentication for admin endpoints'
        };
      }
    }
    
    return { valid: true };
  }
}

module.exports = ApiEndpointsService;

