# 🌍 Internationalization & Localization (i18n/l10n)

> **Global hazır platform: Multi-currency, multi-language, timezone support**

[◀️ Geri: Business Logic](06_Business_Logic_Modules.md) | [Ana Sayfa](README.md) | [İleri: Security & Auth ▶️](08_Security_Auth.md)

---

## 📋 İçindekiler

1. [i18n vs l10n](#i18n-vs-l10n)
2. [Multi-Currency Support](#multi-currency-support)
3. [Multi-Language Support](#multi-language-support)
4. [Date/Time Localization](#datetime-localization)
5. [API Endpoints](#api-endpoints)

---

## i18n vs l10n

### Internationalization (i18n)

**Tanım:** Uygulamayı farklı diller/bölgeler için **hazır hale getirme**.

**Örnekler:**
- Database schema'sında `language_code`, `currency` kolonları
- String'leri hardcode etmeme
- Date/time format'ları esnek tutma
- Number format'ları bölgeye göre

### Localization (l10n)

**Tanım:** Uygulamayı belirli bir **dil/bölgeye çevirme**.

**Örnekler:**
- Türkçe çeviri ekleme
- TRY para birimi desteği
- TR date format (DD.MM.YYYY)
- Türkiye timezone (Europe/Istanbul)

---

## Multi-Currency Support

### Tablolar

```sql
-- Currencies (ref: 03_i18n_Tables.md)
CREATE TABLE cfg.currencies (
  code VARCHAR(3) PRIMARY KEY,  -- USD, EUR, TRY
  name VARCHAR(100),
  symbol VARCHAR(10),  -- $, €, ₺
  decimal_digits INTEGER DEFAULT 2
);

-- Exchange Rates
CREATE TABLE cfg.exchange_rates (
  from_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  to_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  rate NUMERIC(20, 6),
  rate_date DATE,
  PRIMARY KEY (from_currency, to_currency, rate_date)
);
```

### Currency Manager

```javascript
// services/currencyManager.js
class CurrencyManager {
  constructor(pool) {
    this.pool = pool;
  }
  
  /**
   * Para birimi çevrimi
   */
  async convert(amount, fromCurrency, toCurrency, date = null) {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    const rateDate = date || new Date();
    
    const result = await this.pool.query(`
      SELECT rate FROM cfg.exchange_rates
      WHERE from_currency = $1 AND to_currency = $2 
        AND rate_date <= $3
      ORDER BY rate_date DESC
      LIMIT 1
    `, [fromCurrency, toCurrency, rateDate]);
    
    if (!result.rows[0]) {
      throw new Error(`Exchange rate not found: ${fromCurrency} → ${toCurrency}`);
    }
    
    const rate = result.rows[0].rate;
    return amount * rate;
  }
  
  /**
   * Fiyatı tenant'ın para birimine çevir
   */
  async convertForTenant(tenantId, amount, fromCurrency) {
    const tenant = await this.getTenant(tenantId);
    return await this.convert(amount, fromCurrency, tenant.default_currency);
  }
  
  /**
   * Para birimi formatla
   */
  format(amount, currency) {
    const currencyData = this.getCurrencyData(currency);
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currencyData.decimal_digits,
      maximumFractionDigits: currencyData.decimal_digits
    }).format(amount);
  }
}
```

### Auto Exchange Rate Update

```javascript
// services/exchangeRateUpdater.js
const cron = require('node-cron');

class ExchangeRateUpdater {
  /**
   * TCMB'den günlük kurları çek
   */
  async updateFromTCMB() {
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
    const xml = await response.text();
    const rates = this.parseXML(xml);
    
    for (const rate of rates) {
      await this.pool.query(`
        INSERT INTO cfg.exchange_rates (from_currency, to_currency, rate, rate_date, source)
        VALUES ('TRY', $1, $2, CURRENT_DATE, 'tcmb')
        ON CONFLICT (from_currency, to_currency, rate_date)
        DO UPDATE SET rate = $2, updated_at = CURRENT_TIMESTAMP
      `, [rate.currency, rate.value]);
    }
  }
  
  /**
   * Cron job - Her gün 15:30'da
   */
  startCronJob() {
    cron.schedule('30 15 * * *', async () => {
      console.log('Updating exchange rates...');
      await this.updateFromTCMB();
      console.log('Exchange rates updated!');
    });
  }
}
```

### Usage Example

```javascript
// API endpoint
router.get('/products/:id', async (req, res) => {
  const product = await getProduct(req.params.id);
  const tenantCurrency = req.tenant.default_currency;
  
  // Fiyatı tenant para birimine çevir
  const convertedPrice = await currencyManager.convert(
    product.price,
    product.currency,
    tenantCurrency
  );
  
  res.json({
    ...product,
    price: convertedPrice,
    currency: tenantCurrency,
    original_price: product.price,
    original_currency: product.currency
  });
});
```

---

## Multi-Language Support

### Tablolar

```sql
-- Languages (ref: 03_i18n_Tables.md)
CREATE TABLE cfg.languages (
  code VARCHAR(10) PRIMARY KEY,  -- en, tr, ar
  name VARCHAR(100),
  native_name VARCHAR(100),  -- English, Türkçe, العربية
  direction VARCHAR(3) DEFAULT 'ltr'  -- 'ltr' or 'rtl'
);

-- Translations
CREATE TABLE cfg.translations (
  tenant_id INTEGER REFERENCES core.tenants(id),
  language_code VARCHAR(10) REFERENCES cfg.languages(code),
  translation_key VARCHAR(200),
  translation_value TEXT,
  UNIQUE (tenant_id, language_code, translation_key)
);
```

### Translation Service

```javascript
// services/translationService.js
class TranslationService {
  constructor(pool) {
    this.pool = pool;
    this.cache = new Map();
  }
  
  /**
   * Çeviri al
   */
  async t(tenantId, languageCode, key, defaultValue = null) {
    // Cache check
    const cacheKey = `${tenantId}:${languageCode}:${key}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Database query
    const result = await this.pool.query(`
      SELECT translation_value FROM cfg.translations
      WHERE tenant_id = $1 AND language_code = $2 AND translation_key = $3
    `, [tenantId, languageCode, key]);
    
    const value = result.rows[0]?.translation_value || defaultValue || key;
    
    // Cache set
    this.cache.set(cacheKey, value);
    
    return value;
  }
  
  /**
   * Tüm çevirileri al (frontend için)
   */
  async getAllTranslations(tenantId, languageCode) {
    const result = await this.pool.query(`
      SELECT translation_key, translation_value 
      FROM cfg.translations
      WHERE tenant_id = $1 AND language_code = $2
    `, [tenantId, languageCode]);
    
    return result.rows.reduce((acc, row) => {
      acc[row.translation_key] = row.translation_value;
      return acc;
    }, {});
  }
  
  /**
   * Çeviri ekle/güncelle
   */
  async setTranslation(tenantId, languageCode, key, value) {
    await this.pool.query(`
      INSERT INTO cfg.translations 
        (tenant_id, language_code, translation_key, translation_value)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, language_code, translation_key)
      DO UPDATE SET translation_value = $4, updated_at = CURRENT_TIMESTAMP
    `, [tenantId, languageCode, key, value]);
    
    // Cache invalidate
    const cacheKey = `${tenantId}:${languageCode}:${key}`;
    this.cache.delete(cacheKey);
  }
}
```

### RTL (Right-to-Left) Support

```javascript
// middleware/rtlDetector.js
function detectRTL(req, res, next) {
  const language = req.headers['accept-language']?.split(',')[0] || 'en';
  const languageCode = language.split('-')[0];
  
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  const isRTL = rtlLanguages.includes(languageCode);
  
  req.isRTL = isRTL;
  req.direction = isRTL ? 'rtl' : 'ltr';
  
  next();
}

// Frontend CSS
<html dir="${req.direction}" lang="${req.languageCode}">
```

### Translation Key Naming

```
<scope>.<entity>.<field>

Örnekler:
common.welcome              → "Hoş Geldiniz"
common.save                 → "Kaydet"
common.cancel               → "İptal"
product.name                → "Ürün Adı"
product.price               → "Fiyat"
product.add_to_cart         → "Sepete Ekle"
order.total                 → "Toplam"
order.shipping_address      → "Teslimat Adresi"
```

---

## Date/Time Localization

### Timezone Support

```javascript
// utils/dateTimeFormatter.js
const { DateTime } = require('luxon');

class DateTimeFormatter {
  /**
   * Timestamp'i tenant timezone'ına çevir
   */
  formatForTenant(timestamp, tenantTimezone, format = 'DATETIME_MED') {
    return DateTime.fromJSDate(timestamp)
      .setZone(tenantTimezone)
      .toLocaleString(DateTime[format]);
  }
  
  /**
   * Tenant format'ına göre formatla
   */
  formatCustom(timestamp, tenant) {
    const dt = DateTime.fromJSDate(timestamp)
      .setZone(tenant.timezone);
    
    let dateFormat = tenant.date_format || 'yyyy-MM-dd';
    let timeFormat = tenant.time_format || 'HH:mm:ss';
    
    return dt.toFormat(`${dateFormat} ${timeFormat}`);
  }
  
  /**
   * Relative time (2 hours ago)
   */
  relative(timestamp, tenantTimezone, languageCode = 'en') {
    return DateTime.fromJSDate(timestamp)
      .setZone(tenantTimezone)
      .setLocale(languageCode)
      .toRelative();
  }
}
```

### Date Formats by Region

| Region | Date Format | Example |
|--------|-------------|---------|
| USA | MM/DD/YYYY | 10/21/2025 |
| Europe | DD/MM/YYYY | 21/10/2025 |
| Turkey | DD.MM.YYYY | 21.10.2025 |
| ISO | YYYY-MM-DD | 2025-10-21 |
| Japan | YYYY年MM月DD日 | 2025年10月21日 |

### Number Formats by Region

| Region | Number | Currency |
|--------|--------|----------|
| USA | 1,234.56 | $1,234.56 |
| Europe | 1.234,56 | €1.234,56 |
| Turkey | 1.234,56 | ₺1.234,56 |

```javascript
// Number formatting
const numberFormatter = new Intl.NumberFormat(tenant.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
});

numberFormatter.format(1234.56);
// USA: "1,234.56"
// TR: "1.234,56"
```

---

## API Endpoints

### 1. Get Translations

```javascript
GET /api/v1/translations?language=tr

Headers:
{
  "Accept-Language": "tr"
}

Response:
{
  "success": true,
  "data": {
    "common.welcome": "Hoş Geldiniz",
    "common.save": "Kaydet",
    "product.name": "Ürün Adı"
  }
}
```

### 2. Set Translation

```javascript
POST /api/v1/translations
{
  "language": "tr",
  "translations": {
    "custom.button": "Özel Buton",
    "custom.message": "Özel Mesaj"
  }
}

Response:
{
  "success": true,
  "message": "2 translations saved"
}
```

### 3. Get Currencies

```javascript
GET /api/v1/currencies

Response:
{
  "success": true,
  "data": [
    { "code": "USD", "name": "US Dollar", "symbol": "$" },
    { "code": "EUR", "name": "Euro", "symbol": "€" },
    { "code": "TRY", "name": "Turkish Lira", "symbol": "₺" }
  ]
}
```

### 4. Get Exchange Rate

```javascript
GET /api/v1/exchange-rates?from=USD&to=TRY&date=2025-10-21

Response:
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "TRY",
    "rate": 34.5678,
    "date": "2025-10-21"
  }
}
```

### 5. Convert Currency

```javascript
POST /api/v1/currency/convert
{
  "amount": 100,
  "from": "USD",
  "to": "TRY"
}

Response:
{
  "success": true,
  "data": {
    "amount": 100,
    "from": "USD",
    "to": "TRY",
    "converted_amount": 3456.78,
    "rate": 34.5678,
    "date": "2025-10-21"
  }
}
```

---

## Best Practices

### ✅ DO

1. **TIMESTAMPTZ** - Her zaman timezone aware
2. **ISO 8601** - API'lerde standard format
3. **Accept-Language header** - Browser language detect
4. **Cache translations** - Database hit azaltma
5. **RTL support** - Arabic, Hebrew için

### ❌ DON'T

1. **TIMESTAMP** - Timezone yok (kullanma!)
2. **Hardcoded strings** - UI'da string'leri hardcode etme
3. **Floating point** - Para hesaplamalarında
4. **Manual date parsing** - Library kullan (Luxon, date-fns)
5. **Ignore DST** - Daylight Saving Time unutma

---

## 🔗 İlgili Dökümanlar

- [03_i18n_Tables.md](03_i18n_Tables.md) - Currency/language tables
- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - core.tenants (i18n fields)
- [09_Implementation_Checklist.md](09_Implementation_Checklist.md) - P0 features

---

**[◀️ Geri: Business Logic](06_Business_Logic_Modules.md) | [Ana Sayfa](README.md) | [İleri: Security & Auth ▶️](08_Security_Auth.md)**

