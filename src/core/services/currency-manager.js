const { pool } = require('../config/database');
const logger = require('../logger');

/**
 * Currency Manager Service
 * Handle currency conversion and formatting
 */
class CurrencyManager {
  /**
   * Get all active currencies
   */
  static async getActiveCurrencies() {
    try {
      const result = await pool.query(`
        SELECT code, name, symbol, decimal_digits, is_default
        FROM cfg.currencies
        WHERE is_active = TRUE
        ORDER BY is_default DESC, code ASC
      `);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get currencies:', error);
      throw error;
    }
  }

  /**
   * Get default currency
   */
  static async getDefaultCurrency() {
    try {
      const result = await pool.query(`
        SELECT code FROM cfg.currencies WHERE is_default = TRUE LIMIT 1
      `);
      
      return result.rows[0]?.code || 'TRY';
    } catch (error) {
      logger.error('Failed to get default currency:', error);
      return 'TRY';
    }
  }

  /**
   * Convert currency amount
   * @param {Number} amount - Amount to convert
   * @param {String} fromCurrency - Source currency (TRY, USD, EUR)
   * @param {String} toCurrency - Target currency
   * @param {Date} date - Optional date (default: today)
   * @returns {Number} Converted amount
   */
  static async convert(amount, fromCurrency, toCurrency, date = null) {
    try {
      // Same currency
      if (fromCurrency === toCurrency) {
        return amount;
      }

      // Use PostgreSQL function
      const result = await pool.query(`
        SELECT cfg.convert_currency($1, $2, $3) as converted
      `, [amount, fromCurrency, toCurrency]);

      const converted = result.rows[0]?.converted;
      
      if (converted === null) {
        logger.warn(`Exchange rate not found: ${fromCurrency} → ${toCurrency}`);
        return null;
      }

      return parseFloat(converted);
      
    } catch (error) {
      logger.error('Currency conversion failed:', error);
      throw error;
    }
  }

  /**
   * Format currency with symbol
   * @param {Number} amount
   * @param {String} currencyCode
   * @returns {String} Formatted amount (e.g., "$36.50", "₺1,000.00")
   */
  static async format(amount, currencyCode) {
    try {
      const currency = await pool.query(`
        SELECT symbol, decimal_digits FROM cfg.currencies WHERE code = $1
      `, [currencyCode]);

      if (currency.rows.length === 0) {
        return `${amount} ${currencyCode}`;
      }

      const { symbol, decimal_digits } = currency.rows[0];
      
      // Format with Intl.NumberFormat
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimal_digits,
        maximumFractionDigits: decimal_digits
      }).format(amount);

      return formatted;
      
    } catch (error) {
      logger.error('Currency formatting failed:', error);
      return `${amount} ${currencyCode}`;
    }
  }

  /**
   * Get exchange rates for a date range
   */
  static async getExchangeRates(fromCurrency, toCurrency, startDate, endDate) {
    try {
      const result = await pool.query(`
        SELECT 
          from_currency,
          to_currency,
          rate,
          rate_date,
          source
        FROM cfg.exchange_rates
        WHERE from_currency = $1
          AND to_currency = $2
          AND rate_date BETWEEN $3 AND $4
        ORDER BY rate_date DESC
      `, [fromCurrency, toCurrency, startDate, endDate]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get exchange rates:', error);
      throw error;
    }
  }

  /**
   * Update exchange rate
   */
  static async updateRate(fromCurrency, toCurrency, rate, source = 'manual') {
    try {
      await pool.query(`
        INSERT INTO cfg.exchange_rates (from_currency, to_currency, rate, rate_date, source)
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
        ON CONFLICT (from_currency, to_currency, rate_date)
        DO UPDATE SET rate = $3, source = $4, updated_at = CURRENT_TIMESTAMP
      `, [fromCurrency, toCurrency, rate, source]);

      logger.info(`Exchange rate updated: ${fromCurrency}→${toCurrency} = ${rate} (${source})`);
      
      return true;
    } catch (error) {
      logger.error('Failed to update exchange rate:', error);
      throw error;
    }
  }
}

module.exports = CurrencyManager;

