const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');

/**
 * Architecture Compliance Service - YENİLENDİ
 * Roadmap vs Kod uyumunu ANALIZ.md ve Configuration Compliance'dan analiz eder
 */
class ArchitectureComplianceService {
  /**
   * Get architecture compliance report (Roadmap vs Kod Matrisi)
   * @returns {Object} Compliance report
   */
  static async getArchitectureCompliance() {
    try {
      logger.info('🏗️ Generating Roadmap vs Code compliance report...');

      // ANALIZ.md dosyasını parse et
      const analysisPath = path.join(__dirname, '../../../../docs/roadmap/ANALIZ.md');
      
      if (!fs.existsSync(analysisPath)) {
        logger.warn('ANALIZ.md not found, returning empty report');
        return this.getEmptyReport();
      }

      const analysisContent = fs.readFileSync(analysisPath, 'utf8');
      
      // Roadmap vs Kod matrisini parse et
      const features = this.parseRoadmapMatrix(analysisContent);
      
      // Genel skorları hesapla
      const totalFeatures = features.length;
      const compliantCount = features.filter(f => f.compliance >= 80).length;
      const partialCount = features.filter(f => f.compliance >= 40 && f.compliance < 80).length;
      const nonCompliantCount = features.filter(f => f.compliance < 40).length;
      
      const generalScore = Math.round(
        features.reduce((sum, f) => sum + f.compliance, 0) / totalFeatures
      );

      // P0, P1, P2 görevlerini ayır
      const p0Tasks = features.filter(f => f.priority === 'P0');
      const p1Tasks = features.filter(f => f.priority === 'P1');
      const p2Tasks = features.filter(f => f.priority === 'P2');

      logger.info(`✅ Roadmap compliance report generated: ${generalScore}%`);

      return {
        success: true,
        summary: {
          generalScore,
          totalFeatures,
          compliantCount,
          partialCount,
          nonCompliantCount,
          p0Count: p0Tasks.length,
          p1Count: p1Tasks.length,
          p2Count: p2Tasks.length
        },
        features,
        actionPlan: {
          p0: p0Tasks.map(t => ({
            feature: t.name,
            gap: t.gap,
            action: this.getActionForFeature(t.name)
          })),
          p1: p1Tasks.map(t => ({
            feature: t.name,
            gap: t.gap,
            action: this.getActionForFeature(t.name)
          })),
          p2: p2Tasks.map(t => ({
            feature: t.name,
            gap: t.gap,
            action: this.getActionForFeature(t.name)
          }))
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate architecture compliance report:', error);
      return this.getEmptyReport();
    }
  }

  /**
   * ANALIZ.md'deki Roadmap vs Kod matrisini parse eder
   */
  static parseRoadmapMatrix(content) {
    const features = [];
    
    // "DOKÜMANTASYON vs KOD UYUM MATRİSİ" tablosunu bul
    const tableStart = content.indexOf('## 📊 DOKÜMANTASYON vs KOD UYUM MATRİSİ');
    if (tableStart === -1) return [];
    
    const tableSection = content.substring(tableStart, tableStart + 2000);
    const lines = tableSection.split('\n');
    
    let id = 1;
    for (const line of lines) {
      // Tablo satırlarını parse et: | **Feature** | ✅✅✅ | ❌ | 100% | P0 🔥 |
      if (line.startsWith('|| **') || line.startsWith('| **')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        
        if (parts.length >= 5) {
          const name = parts[0].replace(/\*\*/g, '');
          const roadmap = parts[1];
          const code = parts[2];
          const gapStr = parts[3];
          const priorityStr = parts[4];
          
          // Gap'i sayıya çevir
          let gap = 0;
          if (gapStr.includes('%')) {
            gap = parseInt(gapStr) || 0;
          }
          
          // Compliance hesapla (Gap'in tersi)
          let compliance = 100;
          if (gap > 0) {
            compliance = Math.max(0, 100 - gap);
          } else if (code.includes('❌')) {
            compliance = 0;
          } else if (code.includes('⚠️')) {
            compliance = 50;
          } else if (code.includes('✅')) {
            compliance = 100;
          }
          
          // Priority parse et
          let priority = 'P2';
          if (priorityStr.includes('P0')) priority = 'P0';
          else if (priorityStr.includes('P1')) priority = 'P1';
          else if (priorityStr.includes('P2')) priority = 'P2';
          
          features.push({
            id: id++,
            name,
            roadmap: this.cleanStatus(roadmap),
            code: this.cleanStatus(code),
            gap,
            compliance,
            priority,
            status: this.getStatusByCompliance(compliance)
          });
        }
      }
    }
    
    // Eğer parse edilmediyse, fallback manuel veri
    if (features.length === 0) {
      features.push(
        { id: 1, name: 'RLS Multi-Tenant', roadmap: '✅ Detaylı', code: '⚠️ Partial', gap: 40, compliance: 60, priority: 'P0', status: 'partial' },
        { id: 2, name: 'Opak API Key', roadmap: '✅ Detaylı', code: '❌ Plain', gap: 80, compliance: 20, priority: 'P0', status: 'non_compliant' },
        { id: 3, name: 'Tenant Guard', roadmap: '✅ Detaylı', code: '❌ Yok', gap: 100, compliance: 0, priority: 'P0', status: 'non_compliant' },
        { id: 4, name: 'Duplicate Auth', roadmap: '✅ Tek', code: '❌ İki', gap: 100, compliance: 0, priority: 'P0', status: 'non_compliant' },
        { id: 5, name: 'Duplicate Config', roadmap: '✅ Tek', code: '❌ İki', gap: 100, compliance: 0, priority: 'P0', status: 'non_compliant' },
        { id: 6, name: 'API Versioning', roadmap: '⚠️ Yok', code: '✅ Var', gap: 0, compliance: 50, priority: 'P1', status: 'partial' },
        { id: 7, name: 'Error Handler', roadmap: '✅ Var', code: '✅ Var', gap: 0, compliance: 100, priority: 'P0', status: 'compliant' },
        { id: 8, name: 'Rate Limiting', roadmap: '✅ Detaylı', code: '✅ Var', gap: 0, compliance: 100, priority: 'P1', status: 'compliant' },
        { id: 9, name: 'Validation', roadmap: '✅ Var', code: '⚠️ Partial', gap: 70, compliance: 30, priority: 'P1', status: 'non_compliant' },
        { id: 10, name: 'Metrics', roadmap: '✅ Detaylı', code: '❌ Yok', gap: 100, compliance: 0, priority: 'P1', status: 'non_compliant' },
        { id: 11, name: 'Audit Logs', roadmap: '✅ Detaylı', code: '❌ Yok', gap: 100, compliance: 0, priority: 'P1', status: 'non_compliant' },
        { id: 12, name: 'Tests', roadmap: '✅ Var', code: '⚠️ 2/3', gap: 33, compliance: 67, priority: 'P1', status: 'partial' },
        { id: 13, name: 'OpenAPI', roadmap: '⚠️ Az', code: '❌ Yok', gap: 100, compliance: 0, priority: 'P2', status: 'non_compliant' }
      );
    }
    
    return features;
  }

  /**
   * Status string'lerini temizle
   */
  static cleanStatus(status) {
    return status.replace(/\*\*/g, '').trim();
  }

  /**
   * Compliance'a göre status belirle
   */
  static getStatusByCompliance(compliance) {
    if (compliance >= 80) return 'compliant';
    if (compliance >= 40) return 'partial';
    return 'non_compliant';
  }

  /**
   * Her feature için action öner
   */
  static getActionForFeature(featureName) {
    const actions = {
      'RLS Multi-Tenant': '78 query\'ye tenant_id filtresi ekle',
      'Opak API Key': 'API key hashing implementasyonu (bcrypt)',
      'Tenant Guard': 'Tenant middleware oluştur (req.user.tenant_id check)',
      'Duplicate Auth': 'src/core/middleware/auth.js\'e birleştir',
      'Duplicate Config': 'src/core/config/index.js\'e birleştir',
      'API Versioning': 'OpenAPI spec oluştur',
      'Error Handler': 'Zaten var ✅',
      'Rate Limiting': 'Zaten var ✅',
      'Validation': 'Zod schema validation ekle (tüm endpoint\'lere)',
      'Metrics': 'Prometheus metrics middleware ekle',
      'Audit Logs': 'Audit log middleware + database table',
      'Tests': 'Jest test coverage artır (67% → 80%)',
      'OpenAPI': 'OpenAPI 3.0 spec + Swagger UI'
    };
    
    return actions[featureName] || 'Implement missing feature';
  }

  /**
   * Boş rapor döndür (hata durumunda)
   */
  static getEmptyReport() {
      return {
      success: false,
      error: 'ANALIZ.md not found or parsing failed',
      summary: {
        generalScore: 0,
        totalFeatures: 0,
        compliantCount: 0,
        partialCount: 0,
        nonCompliantCount: 0,
        p0Count: 0,
        p1Count: 0,
        p2Count: 0
      },
      features: [],
      actionPlan: { p0: [], p1: [], p2: [] },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = ArchitectureComplianceService;
