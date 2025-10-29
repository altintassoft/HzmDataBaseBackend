const logger = require('../../../../core/logger');

/**
 * Project Structure Service
 * Scan backend/frontend structure from GitHub
 */
class ProjectStructureService {
  /**
   * Get project structure
   * @param {String} target - Target (frontend or backend)
   * @returns {Object} Markdown report content from GitHub
   */
  static async getProjectStructure(target) {
    try {
      logger.info(`Scanning ${target} structure from GitHub...`);
      
      // GitHub scanner kullan
      const GitHubScanner = require('../../compliance/configuration/scanners/github-scanner');
      const scanner = new GitHubScanner();
      
      // Repo bilgilerini al
      let repo, owner;
      if (target === 'frontend') {
        const frontendRepo = process.env.GITHUB_FRONTEND_REPO || 'altintassoft/HzmDatabaseFrontend';
        [owner, repo] = frontendRepo.split('/');
      } else {
        const backendRepo = process.env.GITHUB_BACKEND_REPO || 'altintassoft/HzmDataBaseBackend';
        [owner, repo] = backendRepo.split('/');
      }
      
      logger.info(`📡 Fetching ${target} structure from GitHub: ${owner}/${repo}`);
      
      // GitHub'dan tree'yi çek
      const tree = await scanner.getRepoTree(owner, repo);
      const files = tree.filter(f => f.type === 'blob' && f.path.startsWith('src/'));
      
      logger.info(`✅ Fetched ${files.length} ${target} files from GitHub`);
      
      // Markdown formatına çevir
      let markdown = `## 📊 ${target === 'frontend' ? 'Frontend' : 'Backend'} Projesi\n\n`;
      markdown += `**GitHub Repository:** ${owner}/${repo}\n`;
      markdown += `**Toplam Dosya:** ${files.length}\n`;
      markdown += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n\n`;
      markdown += `### Dosya Listesi\n\n`;
      markdown += `| # | Dosya | Satır | Yol | Durum |\n`;
      markdown += `|---|-------|-------|-----|-------|\n`;
      
      files.slice(0, 200).forEach((file, index) => {
        const fileName = file.path.split('/').pop();
        // Satır tahmini (size / 50 bytes per line)
        const estimatedLines = file.size ? Math.round(file.size / 50) : 0;
        
        let status = '✅ İyi';
        if (estimatedLines >= 900) status = '🔴🔴🔴 Kritik';
        else if (estimatedLines >= 700) status = '🔴🔴 Acil';
        else if (estimatedLines >= 450) status = '🔴 Bölünmeli';
        else if (estimatedLines >= 300) status = '⚠️ Dikkat';
        
        markdown += `| ${index + 1} | \`${fileName}\` | ${estimatedLines} | \`${file.path}\` | ${status} |\n`;
      });
      
      if (files.length > 200) {
        markdown += `\n_... ve ${files.length - 200} dosya daha_\n`;
      }
      
      return {
        type: 'markdown',
        content: markdown,
        reportPath: `GitHub: ${owner}/${repo}`,
        lastUpdated: new Date().toISOString(),
        fileCount: files.length,
        note: `GitHub scan - ${files.length} files`
      };
      
    } catch (error) {
      logger.error(`Failed to scan ${target} structure from GitHub:`, error);
      
      // Hata durumunda açıklayıcı markdown döndür
      let errorMarkdown = `# ⚠️ ${target === 'frontend' ? 'Frontend' : 'Backend'} Yapısı Taranamadı\n\n`;
      errorMarkdown += `## Sebep:\n${error.message}\n\n`;
      
      if (error.message.includes('403') || error.message.includes('Bad credentials')) {
        errorMarkdown += `## Çözüm:\n\n`;
        errorMarkdown += `Railway'de şu environment variable'ları kontrol edin:\n\n`;
        errorMarkdown += `\`\`\`\n`;
        errorMarkdown += `GITHUB_TOKEN=ghp_your_token_here\n`;
        if (target === 'frontend') {
          errorMarkdown += `GITHUB_FRONTEND_REPO=altintassoft/HzmDatabaseFrontend\n`;
        } else {
          errorMarkdown += `GITHUB_BACKEND_REPO=altintassoft/HzmDataBaseBackend\n`;
        }
        errorMarkdown += `\`\`\`\n`;
      } else if (!process.env[`GITHUB_${target.toUpperCase()}_REPO`]) {
        errorMarkdown += `## Çözüm:\n\n`;
        errorMarkdown += `GITHUB_${target.toUpperCase()}_REPO environment variable tanımlı değil!\n`;
      } else {
        errorMarkdown += `## Detay:\n\n\`\`\`\n${error.stack}\n\`\`\`\n`;
      }
      
      return {
        type: 'markdown',
        content: errorMarkdown,
        reportPath: 'Error',
        lastUpdated: new Date().toISOString(),
        fileCount: 0,
        note: `GitHub scan failed: ${error.message}`
      };
    }
  }
}

module.exports = ProjectStructureService;
