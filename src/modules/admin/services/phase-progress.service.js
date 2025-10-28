const logger = require('../../../core/logger');

/**
 * Phase Progress Service
 * Track implementation progress across phases (BACKEND_PHASE_PLAN.md)
 */
class PhaseProgressService {
  /**
   * Get phase progress report
   * @returns {Object} Progress report with summary, phases, features
   */
  static async getPhaseProgress() {
    try {
      logger.info('Generating phase progress report...');
      
      // Phase definitions based on BACKEND_PHASE_PLAN.md
      const phases = [
        {
          phase: 1,
          title: 'Temel Altyapı',
          description: 'Auth, RLS, Migration, Generic Endpoints',
          features: [
            { category: 'Auth', feature: '3-Layer Auth (Email+API Key+Password)', backend: 'done', frontend: 'done', description: 'Full implementation' },
            { category: 'Auth', feature: 'RLS (Row Level Security)', backend: 'done', frontend: 'n/a', description: 'Tenant isolation' },
            { category: 'Database', feature: 'Migration System', backend: 'done', frontend: 'done', description: 'Checksum + Force-rerun' },
            { category: 'Database', feature: 'Schema Tracking', backend: 'done', frontend: 'done', description: 'schema_migrations table' },
            { category: 'Endpoints', feature: 'Generic Data GET', backend: 'done', frontend: 'progress', description: '/api/v1/data/:resource' },
            { category: 'Endpoints', feature: 'Generic Data POST', backend: 'done', frontend: 'progress', description: 'Create new records' },
            { category: 'Endpoints', feature: 'Generic Data PUT', backend: 'done', frontend: 'todo', description: 'Update records' },
            { category: 'Endpoints', feature: 'Generic Data DELETE', backend: 'done', frontend: 'todo', description: 'Delete records' },
            { category: 'Admin', feature: 'Backend Reports', backend: 'done', frontend: 'done', description: 'Migration, Schema, Architecture' },
            { category: 'Admin', feature: 'Plan Compliance', backend: 'done', frontend: 'done', description: 'Endpoint tracking' }
          ]
        },
        {
          phase: 2,
          title: 'Core Modüller',
          description: 'Projects, Companies, Generic Data Table',
          features: [
            { category: 'Core Tables', feature: 'Projects Table', backend: 'todo', frontend: 'todo', description: 'Project management' },
            { category: 'Core Tables', feature: 'Companies Table', backend: 'todo', frontend: 'todo', description: 'Company/Customer records' },
            { category: 'Core Tables', feature: 'Generic Data Table', backend: 'todo', frontend: 'todo', description: 'Flexible data storage' },
            { category: 'API Keys', feature: 'Project API Keys', backend: 'todo', frontend: 'todo', description: 'Multiple keys per project' },
            { category: 'Sequences', feature: 'Centralized Barcode System', backend: 'todo', frontend: 'todo', description: 'Invoice, cargo numbers' }
          ]
        },
        {
          phase: 3,
          title: 'RBAC & Audit',
          description: 'Role-Based Access Control, Audit Log',
          features: [
            { category: 'RBAC', feature: 'Many-to-Many User-Role', backend: 'todo', frontend: 'todo', description: 'Multiple roles per user' },
            { category: 'RBAC', feature: 'Module Permissions', backend: 'todo', frontend: 'todo', description: 'Granular permissions' },
            { category: 'Audit', feature: 'Audit Log Table', backend: 'todo', frontend: 'todo', description: 'Track all changes' },
            { category: 'Audit', feature: 'Audit Log UI', backend: 'todo', frontend: 'todo', description: 'View audit history' }
          ]
        },
        {
          phase: 4,
          title: 'AI & Analytics',
          description: 'AI Integration, Analytics, Advanced Features',
          features: [
            { category: 'AI', feature: 'LocalAI Integration', backend: 'todo', frontend: 'todo', description: 'Connect to LocalAI services' },
            { category: 'Analytics', feature: 'Dashboard Analytics', backend: 'todo', frontend: 'todo', description: 'Charts and graphs' },
            { category: 'Export', feature: 'Excel Export', backend: 'todo', frontend: 'todo', description: 'Export data to Excel' }
          ]
        }
      ];

      // Calculate stats for each phase
      const phaseStats = phases.map(phase => {
        const total = phase.features.length;
        const done = phase.features.filter(f => f.backend === 'done' && (f.frontend === 'done' || f.frontend === 'n/a')).length;
        const progress = phase.features.filter(f => 
          (f.backend === 'progress' || f.frontend === 'progress') && 
          f.backend !== 'todo' && f.frontend !== 'todo'
        ).length;
        const todo = total - done - progress;
        const percentage = Math.round((done / total) * 100);

        return {
          phase: phase.phase,
          title: phase.title,
          description: phase.description,
          total,
          done,
          progress,
          todo,
          percentage
        };
      });

      // Flatten all features with status calculation
      const allFeatures = [];
      phases.forEach(phase => {
        phase.features.forEach(feature => {
          let status = 'todo';
          let percentage = 0;
          
          if (feature.backend === 'done' && (feature.frontend === 'done' || feature.frontend === 'n/a')) {
            status = 'done';
            percentage = 100;
          } else if (feature.backend === 'progress' || feature.frontend === 'progress') {
            status = 'progress';
            percentage = 50;
          } else if (feature.backend === 'done' && feature.frontend === 'todo') {
            status = 'progress';
            percentage = 60;
          } else if (feature.backend === 'done' && feature.frontend === 'progress') {
            status = 'progress';
            percentage = 80;
          }

          allFeatures.push({
            phase: phase.phase,
            category: feature.category,
            feature: feature.feature,
            backend: feature.backend,
            frontend: feature.frontend,
            status,
            percentage,
            description: feature.description
          });
        });
      });

      // Calculate overall stats
      const totalFeatures = allFeatures.length;
      const completedFeatures = allFeatures.filter(f => f.status === 'done').length;
      const overallProgress = Math.round((completedFeatures / totalFeatures) * 100);
      
      // Determine current phase (first phase with <100% completion)
      const currentPhase = phaseStats.find(p => p.percentage < 100)?.phase || 4;

      return {
        summary: {
          currentPhase,
          overallProgress,
          totalFeatures,
          completedFeatures
        },
        phases: phaseStats,
        features: allFeatures,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to generate phase progress:', error);
      return {
        error: 'Failed to generate phase progress',
        message: error.message,
        summary: { currentPhase: 1, overallProgress: 0, totalFeatures: 0, completedFeatures: 0 },
        phases: [],
        features: [],
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = PhaseProgressService;
