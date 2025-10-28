const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');

/**
 * Endpoint Compliance Service
 * Check if endpoints follow SMART_ENDPOINT_STRATEGY_V2
 */
class EndpointComplianceService {
  /**
   * Get endpoint compliance report
   * @returns {Object} Compliance report with endpoints, stats, successRate
   */
  static async getEndpointCompliance() {
    try {
      logger.info('📊 Generating Endpoint Compliance Report...');
      
      // Scan all route files
      const routesDir = path.join(__dirname, '../../../routes.OLD');
      const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js') && file !== 'admin.js');
      
      const endpoints = [];
      
      // Define expected patterns
      const patterns = {
        jwt: ['/auth/'],
        apiKey: ['/data/', '/admin/', '/compute/', '/export/', '/import/', '/reports/', '/webhooks/', '/api-keys/', '/protected/'],
        smart: ['/data/:entity', '/compute/', '/export/', '/import/', '/reports/'],
        individual: ['/auth/', '/api-keys/', '/protected/']
      };
      
      // Scan each route file
      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract router.METHOD patterns
        const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = routerRegex.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          const path = match[2];
          const fullPath = `/api/v1${file.replace('.js', '')}${path}`;
          
          // Determine expected auth
          let expectedAuth = 'API Key';
          for (const [auth, pathPatterns] of Object.entries(patterns)) {
            if (auth === 'jwt' && pathPatterns.some(p => fullPath.includes(p))) {
              expectedAuth = 'JWT';
              break;
            }
          }
          
          // Determine expected type
          let expectedType = 'Bireysel';
          if (patterns.smart.some(p => fullPath.includes(p.split(':')[0]))) {
            expectedType = 'Akıllı';
          }
          
          // Detect current auth (from content)
          let currentAuth = 'None';
          if (content.includes('authenticateJWT')) currentAuth = 'JWT';
          if (content.includes('authenticateApiKey')) currentAuth = 'API Key';
          if (content.includes('authenticateJwtOrApiKey')) currentAuth = 'JWT/API Key';
          
          // Detect current type
          let currentType = fullPath.includes(':entity') || fullPath.includes(':type') ? 'Akıllı' : 'Bireysel';
          
          // Determine status
          const authMatch = (expectedAuth === currentAuth) || (expectedAuth === 'API Key' && currentAuth === 'JWT/API Key');
          const typeMatch = (expectedType === currentType);
          let status = 'unknown';
          if (authMatch && typeMatch) status = 'compliant';
          else if (authMatch || typeMatch) status = 'partial';
          else if (currentAuth === 'None') status = 'missing';
          else status = 'noncompliant';
          
          endpoints.push({
            endpoint: fullPath,
            method,
            expectedAuth,
            currentAuth,
            authMatch,
            expectedType,
            currentType,
            typeMatch,
            status,
            file: file.replace('.js', '')
          });
        }
      }
      
      // Calculate statistics
      const stats = {
        total: endpoints.length,
        compliant: endpoints.filter(e => e.status === 'compliant').length,
        partial: endpoints.filter(e => e.status === 'partial').length,
        missing: endpoints.filter(e => e.status === 'missing').length,
        noncompliant: endpoints.filter(e => e.status === 'noncompliant').length,
        byAuth: {
          jwt: endpoints.filter(e => e.expectedAuth === 'JWT').length,
          apiKey: endpoints.filter(e => e.expectedAuth === 'API Key').length
        },
        byType: {
          smart: endpoints.filter(e => e.expectedType === 'Akıllı').length,
          individual: endpoints.filter(e => e.expectedType === 'Bireysel').length
        }
      };
      
      const successRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;
      
      return {
        endpoints,
        stats,
        successRate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate endpoint compliance report:', error);
      return {
        error: 'Failed to generate endpoint compliance report',
        message: error.message,
        endpoints: [],
        stats: { total: 0, compliant: 0, partial: 0, missing: 0, noncompliant: 0 },
        successRate: 0
      };
    }
  }
}

module.exports = EndpointComplianceService;
