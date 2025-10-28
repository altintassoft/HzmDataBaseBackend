const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Project Structure Service
 * Read DOSYA_ANALIZI.md report
 */
class ProjectStructureService {
  /**
   * Get project structure
   * @param {String} target - Target (frontend or backend)
   * @returns {Object} Markdown report content
   */
  static async getProjectStructure(target) {
    try {
      logger.info(`Reading file analysis report from DOSYA_ANALIZI.md`);
      
      // First try to read existing report
      const reportPath = path.join(__dirname, '../../../../../docs/roadmap/DOSYA_ANALIZI.md');
      
      // Check if report exists and is recent (less than 5 minutes old)
      if (fs.existsSync(reportPath)) {
        const stats = fs.statSync(reportPath);
        const ageInMinutes = (Date.now() - stats.mtime.getTime()) / 1000 / 60;
        
        if (ageInMinutes < 5) {
          // Report is fresh, use it
          const markdownContent = fs.readFileSync(reportPath, 'utf8');
          return {
            type: 'markdown',
            content: markdownContent,
            reportPath: 'docs/roadmap/DOSYA_ANALIZI.md',
            lastUpdated: stats.mtime.toISOString(),
            note: 'Cached report (updated < 5 minutes ago)'
          };
        }
      }
      
      // Report doesn't exist or is stale - generate on the fly
      logger.info('Generating fresh file analysis report...');
      
      try {
        const scriptPath = path.join(__dirname, '../../../scripts/analyze-files.js');
        
        // Run script and capture output directly (don't write to file on Railway)
        const stdout = execSync(`node ${scriptPath}`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        // Parse the output to extract the markdown content
        const lines = stdout.split('\n');
        const markdownStartIndex = lines.findIndex(line => line.includes('==============='));
        
        if (markdownStartIndex >= 0) {
          // Extract markdown portion from stdout
          const markdownContent = lines.slice(markdownStartIndex).join('\n');
          
          return {
            type: 'markdown',
            content: markdownContent,
            reportPath: 'Generated on-the-fly',
            lastUpdated: new Date().toISOString(),
            note: 'Fresh report generated (Railway mode)'
          };
        } else {
          // Fallback: return the raw stdout as markdown
          return {
            type: 'markdown',
            content: '# File Analysis Report\n\n```\n' + stdout + '\n```',
            reportPath: 'Generated on-the-fly',
            lastUpdated: new Date().toISOString(),
            note: 'Raw output (Railway mode)'
          };
        }
      } catch (execError) {
        logger.error('Failed to run analyze script:', execError);
        
        // Fallback: return error message
        return {
          type: 'markdown',
          content: `# ⚠️ Dosya Analizi Yapılamadı\n\n## Hata:\n\\`\\`\\`\n${execError.message}\n\\`\\`\\`\n\n## Çözüm:\n\n1. "Analiz Çalıştır" butonuna tıklayın\n2. 5-10 saniye bekleyin\n3. Sayfayı yenileyin`,
          reportPath: 'Error',
          lastUpdated: new Date().toISOString(),
          note: 'Analysis failed'
        };
      }

    } catch (error) {
      logger.error('Failed to read DOSYA_ANALIZI.md:', error);
      return {
        error: 'Failed to read report',
        message: error.message,
        data: null
      };
    }
  }
}

module.exports = ProjectStructureService;
