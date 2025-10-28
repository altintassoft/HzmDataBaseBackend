const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');
const ConfigurationComplianceService = require('./configuration');

/**
 * Sync Analysis Service
 * ANALIZ.md'yi Configuration Compliance raporuyla otomatik senkronize eder
 */
class SyncAnalysisService {
  /**
   * ANALIZ.md'yi Configuration Compliance ile senkronize et
   * @returns {Object} Sync result
   */
  static async syncAnalysis() {
    try {
      logger.info('🔄 Starting ANALIZ.md synchronization...');

      // 1. Configuration Compliance raporunu çalıştır
      const complianceReport = await ConfigurationComplianceService.getFullCompliance();
      
      if (!complianceReport || !complianceReport.success) {
        throw new Error('Configuration Compliance report failed');
      }

      logger.info('✅ Configuration Compliance report generated');

      // 2. ANALIZ.md dosyasını oku
      const analysisPath = path.join(process.cwd(), 'docs/roadmap/ANALIZ.md');
      
      if (!fs.existsSync(analysisPath)) {
        throw new Error('ANALIZ.md not found');
      }

      let content = fs.readFileSync(analysisPath, 'utf8');
      logger.info('✅ ANALIZ.md loaded');

      // 3. Backend rules'tan feature mapping'i oluştur
      const featureMapping = this.createFeatureMapping(complianceReport.backend);
      
      logger.info(`📊 Feature mapping created: ${Object.keys(featureMapping).length} features`);

      // 4. ANALIZ.md'deki tabloyu güncelle
      content = this.updateAnalysisTable(content, featureMapping);

      // 5. Güncellenmiş içeriği kaydet
      fs.writeFileSync(analysisPath, content, 'utf8');
      
      logger.info('✅ ANALIZ.md updated successfully');

      return {
        success: true,
        message: 'ANALIZ.md synchronized with Configuration Compliance',
        updatedFeatures: Object.keys(featureMapping).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to sync ANALIZ.md:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Backend rules'tan feature mapping oluştur
   */
  static createFeatureMapping(backendRules) {
    const mapping = {};

    backendRules.forEach(rule => {
      // Rule name'e göre feature adını belirle
      const featureName = this.mapRuleToFeature(rule);
      
      if (featureName) {
        mapping[featureName] = {
          code: this.getCodeStatus(rule),
          compliance: rule.yüzde,
          status: rule.durum
        };
      }
    });

    return mapping;
  }

  /**
   * Rule'u feature name'e map et
   */
  static mapRuleToFeature(rule) {
    const ruleToFeature = {
      '7. Hata Yönetimi & Logging': 'Error Handler',
      '11. API Sözleşmesi & Versiyonlama': 'API Versioning',
      '12. Performans & Ölçeklenebilirlik': 'Rate Limiting',
      '17. Test & Doğrulama': 'Tests',
      '8. Multi-Tenant & İzleme': 'RLS Multi-Tenant',
      '9. İsimlendirme & Konvansiyon': 'Validation',
      '20. Dokümantasyon': 'OpenAPI',
      '6. Güvenlik & Gizli Bilgi': 'Opak API Key'
    };

    return ruleToFeature[rule.kural];
  }

  /**
   * Rule durumuna göre kod statusu belirle
   */
  static getCodeStatus(rule) {
    if (rule.yüzde >= 80) return '✅ Var';
    if (rule.yüzde >= 40) return '⚠️ Partial';
    return '❌ Yok';
  }

  /**
   * ANALIZ.md'deki tabloyu güncelle
   */
  static updateAnalysisTable(content, featureMapping) {
    // "DOKÜMANTASYON vs KOD UYUM MATRİSİ" tablosunu bul
    const tableStart = content.indexOf('## 📊 DOKÜMANTASYON vs KOD UYUM MATRİSİ');
    if (tableStart === -1) {
      logger.warn('Table not found in ANALIZ.md');
      return content;
    }

    const tableEnd = content.indexOf('\n---\n', tableStart);
    if (tableEnd === -1) {
      logger.warn('Table end not found in ANALIZ.md');
      return content;
    }

    const beforeTable = content.substring(0, tableStart);
    const afterTable = content.substring(tableEnd);
    
    // Yeni tablo oluştur
    const newTable = this.generateUpdatedTable(featureMapping);
    
    return beforeTable + newTable + afterTable;
  }

  /**
   * Güncellenmiş tablo üret
   */
  static generateUpdatedTable(featureMapping) {
    let table = `## 📊 DOKÜMANTASYON vs KOD UYUM MATRİSİ

| Feature | Dok. | Kod | Gap | Öncelik |
|---------|------|-----|-----|---------|
`;

    // Manuel features (Configuration Compliance'da olmayan)
    const manualFeatures = [
      { name: 'RLS Multi-Tenant', doc: '✅✅✅', gap: 40, priority: 'P0 🔥' },
      { name: 'Opak API Key', doc: '✅✅✅', gap: 80, priority: 'P0 🔥' },
      { name: 'Tenant Guard', doc: '✅✅✅', code: '❌ Yok', gap: 100, priority: 'P0 🔥' },
      { name: 'Duplicate Auth', doc: '✅ Tek', code: '❌ İki', gap: 100, priority: 'P0 🔥' },
      { name: 'Duplicate Config', doc: '✅ Tek', code: '❌ İki', gap: 100, priority: 'P0 🔥' }
    ];

    // Manuel features'ı ekle
    manualFeatures.forEach(feature => {
      let code = feature.code;
      
      // Eğer mapping'de varsa güncelle
      if (featureMapping[feature.name]) {
        code = featureMapping[feature.name].code;
        feature.gap = 100 - featureMapping[feature.name].compliance;
      }
      
      table += `| **${feature.name}** | ${feature.doc} | ${code} | ${feature.gap}% | ${feature.priority} |\n`;
    });

    // Configuration Compliance'dan gelen features
    const complianceFeatures = [
      { name: 'API Versioning', doc: '⚠️ Yok', priority: 'P0 🔥' },
      { name: 'Error Handler', doc: '✅ Var', priority: 'P0 🔥' },
      { name: 'Rate Limiting', doc: '✅✅✅', priority: 'P1 ⚡' },
      { name: 'Validation', doc: '✅✅', priority: 'P1 ⚡' },
      { name: 'Metrics', doc: '✅✅✅', code: '❌ Yok', gap: 100, priority: 'P1 ⚡' },
      { name: 'Audit Logs', doc: '✅✅✅', code: '❌ Yok', gap: 100, priority: 'P1 ⚡' },
      { name: 'Tests', doc: '✅', priority: 'P1 ⚡' },
      { name: 'OpenAPI', doc: '⚠️ Az', priority: 'P2 📊' }
    ];

    complianceFeatures.forEach(feature => {
      let code = feature.code || '❌ Yok';
      let gap = feature.gap || 100;

      // Mapping'den güncelle
      if (featureMapping[feature.name]) {
        code = featureMapping[feature.name].code;
        gap = 100 - featureMapping[feature.name].compliance;
      }

      table += `| **${feature.name}** | ${feature.doc} | ${code} | ${gap}% | ${feature.priority} |\n`;
    });

    table += '\n';
    
    return table;
  }
}

module.exports = SyncAnalysisService;

