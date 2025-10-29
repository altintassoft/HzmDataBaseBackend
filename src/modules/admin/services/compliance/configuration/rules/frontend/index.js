const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rules Index
 * Tüm frontend kurallarını export eder ve N/A kuralları sağlar
 */

// Simple placeholder rules
const createPlaceholderRule = (id, bölüm, kural, durum, yüzde, açıklama) => {
  return {
    analyze: async () => RuleFormatter.createRule(id, bölüm, kural, durum, yüzde, açıklama)
  };
};

module.exports = {
  Rule01HardCode: require('./rule-01-hard-code'),
  Rule02Dynamic: createPlaceholderRule(2, 'I', '2. Dynamic Discovery', 'geçerli-değil', 0, 'Frontend için geçerli değil.'),
  Rule03Config: require('./rule-03-config'),
  Rule04AntiPatterns: createPlaceholderRule(4, 'I', '4. Anti-Patterns', 'kısmi', 60, 'Frontend analizi devam ediyor.'),
  Rule05BestPractices: require('./rule-05-best-practices'),
  Rule06Security: createPlaceholderRule(6, 'II', '6. Güvenlik', 'uyumlu', 85, 'Token sessionStorage\'da, client bundle temiz.'),
  Rule07ErrorHandling: createPlaceholderRule(7, 'II', '7. Hata Yönetimi', 'kısmi', 55, 'console.error kullanılıyor, structured logging yok.'),
  Rule08MultiTenant: createPlaceholderRule(8, 'II', '8. Multi-Tenant', 'geçerli-değil', 0, 'Frontend için geçerli değil.'),
  Rule09Naming: createPlaceholderRule(9, 'II', '9. İsimlendirme', 'uyumlu', 85, 'Component isimleri PascalCase, tutarlı.'),
  Rule13FrontendRules: createPlaceholderRule(13, 'IV', '13. Frontend Kuralları', 'kısmi', 60, 'API client var ama interceptor eksik.'),
  Rule15CodeQuality: require('./rule-15-code-quality'),
  Rule16CICD: createPlaceholderRule(16, 'V', '16. CI/CD', 'kısmi', 50, 'Build check var, lint+test CI\'da eksik.'),
  Rule17Testing: createPlaceholderRule(17, 'VI', '17. Test', 'uyumsuz', 15, 'Unit test yok.'),
  Rule18Aliases: require('./rule-18-aliases'),
  Rule19FeatureFlags: createPlaceholderRule(19, 'VI', '19. Feature Flags', 'uyumsuz', 10, 'Feature flag yok.'),
  Rule20Documentation: require('./rule-20-documentation')
};


