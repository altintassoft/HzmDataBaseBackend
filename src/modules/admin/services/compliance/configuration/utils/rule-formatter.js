/**
 * Rule Formatter
 * Compliance rule sonuçlarını formatlar
 */
class RuleFormatter {
  
  /**
   * Standart rule objesi oluşturur
   * @param {number} id
   * @param {string} bölüm
   * @param {string} kural
   * @param {string} durum - 'uyumlu' | 'kısmi' | 'uyumsuz' | 'geçerli-değil'
   * @param {number} yüzde
   * @param {string} açıklama
   * @param {any} detay
   * @param {string} öneri
   * @returns {Object}
   */
  static createRule(id, bölüm, kural, durum, yüzde, açıklama, detay = null, öneri = '') {
    return {
      id,
      bölüm,
      kural,
      durum,
      yüzde: Math.round(yüzde),
      açıklama,
      ...(detay && { detay }),
      ...(öneri && { öneri })
    };
  }
  
  /**
   * N/A (geçerli değil) rule oluşturur
   * @param {number} id
   * @param {string} bölüm
   * @param {string} kural
   * @returns {Object}
   */
  static createNARule(id, bölüm, kural) {
    return {
      id,
      bölüm,
      kural,
      durum: 'geçerli-değil',
      yüzde: 0,
      açıklama: 'Bu kural bu platform için geçerli değil.'
    };
  }
  
  /**
   * Violation count'a göre durum belirler
   * @param {number} violations
   * @param {number} lowThreshold
   * @param {number} highThreshold
   * @returns {string}
   */
  static getDurumByViolations(violations, lowThreshold = 5, highThreshold = 15) {
    if (violations === 0) return 'uyumlu';
    if (violations < lowThreshold) return 'kısmi';
    return 'uyumsuz';
  }
  
  /**
   * Yüzde skor'a göre durum belirler
   * @param {number} score
   * @returns {string}
   */
  static getDurumByScore(score) {
    if (score >= 80) return 'uyumlu';
    if (score >= 40) return 'kısmi';
    return 'uyumsuz';
  }
  
  /**
   * Pass count / total count'a göre score hesaplar
   * @param {number} passedCount
   * @param {number} totalCount
   * @returns {number}
   */
  static calculateScoreFromRatio(passedCount, totalCount) {
    if (totalCount === 0) return 0;
    return Math.round((passedCount / totalCount) * 100);
  }
  
  /**
   * Violation count'tan score hesaplar
   * @param {number} violations
   * @param {number} penaltyPerViolation
   * @returns {number}
   */
  static calculateScoreFromViolations(violations, penaltyPerViolation = 3) {
    return Math.max(0, 100 - (violations * penaltyPerViolation));
  }
}

module.exports = RuleFormatter;

