const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');

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
      
      // ✅ YENİ STRATEJİ: Dosya sistemi taramak yerine, otomatik oluşturulan MD raporunu oku
      // Bu rapor GitHub Actions tarafından her push'ta güncellenir
      // Production'da da çalışır!
      
      const reportPath = path.join(__dirname, '../../../../../docs/roadmap/DOSYA_ANALIZI.md');
      
      // Check if report exists
      if (!fs.existsSync(reportPath)) {
        return {
          error: 'Report not found',
          message: 'DOSYA_ANALIZI.md raporu bulunamadı. GitHub Actions workflow\'ünün çalışıp çalışmadığını kontrol edin.',
          data: null
        };
      }
      
      // Read the markdown report
      const markdownContent = fs.readFileSync(reportPath, 'utf8');
      
      // Return the markdown content
      return {
        type: 'markdown',
        content: markdownContent,
        reportPath: 'docs/roadmap/DOSYA_ANALIZI.md',
        lastUpdated: fs.statSync(reportPath).mtime.toISOString(),
        note: 'Bu rapor GitHub Actions tarafından otomatik olarak her push\'ta güncellenir.'
      };

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
