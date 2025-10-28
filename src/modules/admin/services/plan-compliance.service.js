const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');

/**
 * Plan Compliance Service
 * Compare SMART_ENDPOINT_STRATEGY_V2.md (expected) vs actual backend routes
 */
class PlanComplianceService {
  /**
   * Get plan compliance report
   * @returns {Object} Compliance report with summary, categories, extraEndpoints
   */
  static async getPlanCompliance() {
    try {
      logger.info('📊 Generating Plan Compliance Report...');
      
      // 1. Parse SMART_ENDPOINT_STRATEGY_V2.md to extract expected endpoints
      const strategyFilePath = path.join(__dirname, '../../../../docs/roadmap/SMART_ENDPOINT_STRATEGY_V2.md');
      
      let expectedEndpoints = {};
      
      if (fs.existsSync(strategyFilePath)) {
        try {
          logger.info(`📁 File exists at: ${strategyFilePath}`);
          const strategyContent = fs.readFileSync(strategyFilePath, 'utf8');
          logger.info(`✅ File read successfully, size: ${strategyContent.length} bytes`);
          
          // Parse markdown to extract endpoints
          const lines = strategyContent.split('\n');
          logger.info(`📄 Total lines: ${lines.length}`);
          
          let currentCategory = null;
          const categoryMap = {
            'authentication': ['Authentication'],
            'api_keys': ['API Keys Management', 'API Key Management'],
            'projects': ['Projects'],
            'generic_data': ['Generic Data Operations', 'Generic Data'],
            'admin': ['Admin Operations', 'Admin'],
            'health': ['Health & Monitoring', 'Health']
          };
          
          let categoryCount = 0;
          let endpointCount = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect category headers (e.g., "### 1️⃣ Authentication (4 Endpoint - JWT)")
            const categoryMatch = line.match(/###\s+\d️⃣\s+([^(]+)/);
            if (categoryMatch) {
              const categoryName = categoryMatch[1].trim();
              
              // Find matching category key
              currentCategory = null;
              for (const [key, patterns] of Object.entries(categoryMap)) {
                if (patterns.some(pattern => categoryName.startsWith(pattern))) {
                  currentCategory = key;
                  categoryCount++;
                  logger.info(`🔹 Category found at line ${i}: '${categoryName}' → '${key}'`);
                  break;
                }
              }
              
              if (!currentCategory) {
                logger.warn(`⚠️  Unmatched category at line ${i}: '${categoryName}'`);
              }
              
              if (currentCategory && !expectedEndpoints[currentCategory]) {
                expectedEndpoints[currentCategory] = [];
              }
            }
            
            // Detect endpoint definitions (e.g., "#### POST /auth/login")
            const endpointMatch = line.match(/####\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s\n]+)/);
            if (endpointMatch && currentCategory) {
              const method = endpointMatch[1];
              let path = endpointMatch[2];
              
              // Add /api/v1 prefix if not present (except for /health)
              if (!path.startsWith('/api/v1') && !path.startsWith('/health')) {
                path = '/api/v1' + path;
              }
              
              endpointCount++;
              if (endpointCount <= 5) {
                logger.info(`  🎯 Endpoint ${endpointCount}: ${method} ${path} (category: ${currentCategory})`);
              }
              
              // Look for description in the next few lines (after "- **Auth**:" line)
              let description = '';
              for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const descLine = lines[j];
                // Stop at next endpoint or major section
                if (descLine.startsWith('####') || descLine.startsWith('##')) break;
                
                // Extract description from various patterns
                if (descLine.includes('**Use Case:**') || descLine.includes('**Purpose:**')) {
                  const nextLine = lines[j + 1];
                  if (nextLine && nextLine.startsWith('-')) {
                    description = nextLine.replace(/^-\s*/, '').trim();
                    break;
                  }
                }
              }
              
              // Fallback: generate description from path
              if (!description) {
                const pathParts = path.split('/').filter(p => p && !p.startsWith(':'));
                description = pathParts[pathParts.length - 1] || 'Endpoint';
              }
              
              expectedEndpoints[currentCategory].push({
                method,
                path,
                description
              });
            }
          }
          
          const totalEndpoints = Object.values(expectedEndpoints).flat().length;
          logger.info(`📊 Parse Summary:`);
          logger.info(`   Categories detected: ${categoryCount}`);
          logger.info(`   Endpoints detected: ${endpointCount}`);
          logger.info(`   Stored in expectedEndpoints: ${Object.keys(expectedEndpoints).length} categories, ${totalEndpoints} endpoints`);
          logger.info(`   Categories: ${Object.keys(expectedEndpoints).join(', ')}`);
        } catch (parseError) {
          logger.error('❌ Failed to parse SMART_ENDPOINT_STRATEGY_V2.md:', {
            message: parseError.message,
            stack: parseError.stack,
            name: parseError.name
          });
          logger.error(`📍 Parser was working on: ${Object.keys(expectedEndpoints).length} categories found so far`);
          // Fallback to minimal plan if parsing fails
          logger.warn('⚠️  Using fallback plan (4 auth endpoints only)');
          expectedEndpoints = {
            authentication: [
              { method: 'POST', path: '/api/v1/auth/register', description: 'User registration' },
              { method: 'POST', path: '/api/v1/auth/login', description: 'User login' },
              { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh token' },
              { method: 'GET', path: '/api/v1/auth/me', description: 'Get current user' }
            ]
          };
        }
      } else {
        logger.warn(`⚠️  SMART_ENDPOINT_STRATEGY_V2.md not found at: ${strategyFilePath}`);
        logger.warn('⚠️  Using fallback plan (4 auth endpoints only)');
        // Fallback to minimal plan
        expectedEndpoints = {
          authentication: [
            { method: 'POST', path: '/api/v1/auth/register', description: 'User registration' },
            { method: 'POST', path: '/api/v1/auth/login', description: 'User login' },
            { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh token' },
            { method: 'GET', path: '/api/v1/auth/me', description: 'Get current user' }
          ]
        };
      }
      
      // 2. Scan actual backend routes
      const routesDir = path.join(__dirname, '../../../routes.OLD');
      const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js') && file !== 'admin.js');
      
      const actualEndpoints = [];
      
      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract router.METHOD patterns
        const routerRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
        let match;
        
        // Determine prefix from filename
        let prefix = '';
        let skipApiV1Prefix = false;
        
        if (file === 'auth.js') prefix = '/auth';
        else if (file === 'api-keys.js') prefix = '/api-keys';
        else if (file === 'projects.js') prefix = '/projects';
        else if (file === 'admin.js') prefix = '/admin';
        else if (file === 'protected.js') prefix = '/protected';
        else if (file === 'health.js') {
          prefix = '';
          skipApiV1Prefix = true; // Health is at root level
        }
        else if (file === 'settings.js') prefix = '/settings';
        else if (file === 'compute.js') prefix = '/compute';
        else if (file === 'data.js' || file === 'generic-data.js') prefix = '/data';
        
        while ((match = routerRegex.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          const routePath = match[2];
          
          let fullPath;
          if (skipApiV1Prefix) {
            fullPath = `${prefix}${routePath}`;
          } else {
            fullPath = `/api/v1${prefix}${routePath}`;
          }
          
          actualEndpoints.push({
            method,
            path: fullPath,
            file: file.replace('.js', '')
          });
        }
      }
      
      // Add admin endpoint manually (since admin.js is excluded from scan to avoid recursion)
      actualEndpoints.push({
        method: 'GET',
        path: '/api/v1/admin/database',
        file: 'admin'
      });
      
      // 3. Compare expected vs actual by category
      const comparison = {};
      let totalExpected = 0;
      let totalActual = actualEndpoints.length;
      let totalMatched = 0;
      let totalMissing = 0;
      
      for (const [category, expectedList] of Object.entries(expectedEndpoints)) {
        totalExpected += expectedList.length;
        
        const categoryComparison = {
          expected: expectedList,
          actual: [],
          matched: [],
          missing: [],
          status: 'unknown'
        };
        
        // Find matches
        for (const expected of expectedList) {
          const match = actualEndpoints.find(actual => 
            actual.method === expected.method && 
            (actual.path === expected.path || 
             // Handle generic patterns like :resource, :id
             (expected.path.includes(':') && 
              actual.path.replace(/\/[^/]+$/, '/:param').replace(/\/[^/]+\//, '/:resource/') === expected.path.replace(/\/[^/]+$/, '/:param').replace(/\/[^/]+\//, '/:resource/')
             )
            )
          );
          
          if (match) {
            categoryComparison.matched.push({
              method: expected.method,
              path: expected.path,
              description: expected.description,
              actualPath: match.path,
              file: match.file
            });
            totalMatched++;
          } else {
            categoryComparison.missing.push({
              method: expected.method,
              path: expected.path,
              description: expected.description
            });
            totalMissing++;
          }
        }
        
        // Determine status
        if (categoryComparison.matched.length === expectedList.length) {
          categoryComparison.status = 'complete';
        } else if (categoryComparison.matched.length > 0) {
          categoryComparison.status = 'partial';
        } else {
          categoryComparison.status = 'missing';
        }
        
        comparison[category] = categoryComparison;
      }
      
      // 4. Find extra endpoints (not in plan)
      const allExpectedPaths = Object.values(expectedEndpoints).flat().map(e => e.path);
      const extraEndpoints = actualEndpoints.filter(actual => {
        // Normalize actual path for comparison
        const normalizedActual = actual.path
          .replace(/\/\d+$/, '/:id')
          .replace(/\/[a-z-]+\//, '/:resource/');
        
        return !allExpectedPaths.some(expected => {
          const normalizedExpected = expected
            .replace(/\/\d+$/, '/:id')
            .replace(/\/[a-z-]+\//, '/:resource/');
          
          return normalizedExpected === normalizedActual || expected === actual.path;
        });
      });
      
      // 5. Calculate summary stats
      const successRate = totalExpected > 0 ? Math.round((totalMatched / totalExpected) * 100) : 0;
      
      return {
        summary: {
          totalExpected,
          totalActual,
          totalMatched,
          totalMissing,
          extraCount: extraEndpoints.length,
          successRate
        },
        categories: comparison,
        extraEndpoints,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate plan compliance report:', error);
      return {
        error: 'Failed to generate plan compliance report',
        message: error.message,
        summary: {
          totalExpected: 0,
          totalActual: 0,
          totalMatched: 0,
          totalMissing: 0,
          extraCount: 0,
          successRate: 0
        },
        categories: {},
        extraEndpoints: []
      };
    }
  }
}

module.exports = PlanComplianceService;
