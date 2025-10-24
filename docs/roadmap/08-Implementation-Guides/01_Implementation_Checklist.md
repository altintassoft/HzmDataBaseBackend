# ✅ Implementation Checklist

> **P0/P1/P2 özellik önceliklendirme - Baştan doğru kur!**

[◀️ Geri: Security & Auth](08_Security_Auth.md) | [Ana Sayfa](README.md) | [İleri: Common Mistakes ▶️](10_Common_Mistakes.md)

---

## 📋 İçindekiler

1. [🔴 P0 - MUTLAKA BAŞTAN (Hiç Değiştirilemez!)](#-p0---mutlaka-baştan-hiç-değiştirilemez)
2. [🟡 P1 - ÇOK ÖNEMLİ (İlk Hafta)](#-p1---çok-öneml%C4%B0-i̇lk-hafta)
3. [🟢 P2 - ÖNEMLİ (İlk Ay)](#-p2---öneml%C4%B0-i̇lk-ay)
4. [Standard Table Template](#standard-table-template)

---

## 🔴 P0 - MUTLAKA BAŞTAN (Hiç Değiştirilemez!)

> **⚠️ UYARI: Bu features sonradan eklenemez! 1 milyon kayıtta migration 48 saat sürer!**

### Core Architecture

#### Multi-Tenancy
- [ ] **`tenant_id` HERYERDE** - Her tabloda, her indexte, her query'de
  ```sql
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id)
  CREATE INDEX idx_table_tenant ON table(tenant_id);
  ```
  **Neden kritik:** Sonradan eklemek 1M kayıtta 48 saat downtime demek!

- [ ] **Row Level Security (RLS)** - PostgreSQL RLS aktif
  ```sql
  ALTER TABLE table ENABLE ROW LEVEL SECURITY;
  CREATE POLICY rls_table_tenant ON table
    USING (tenant_id = app.current_tenant());
  ```
  **Neden kritik:** Güvenlik açığı = veri sızıntısı = hukuki sorun

- [ ] **Schema organization** - `core`, `cfg`, `ops`, `comms`, `billing` schemas
  ```sql
  CREATE SCHEMA core;
  CREATE SCHEMA cfg;
  ```
  **Neden kritik:** Flat schema sonradan refactor edilemez

#### Authentication & Authorization

- [ ] **3-level API keys** - `live`, `test`, `restricted`
  ```sql
  key_prefix VARCHAR(20) -- 'hzm_live_', 'hzm_test_'
  ```
  **Neden kritik:** Production/test ayrımı sonradan eklenemez

- [ ] **JWT tokens** - Standard implementation
  ```javascript
  jwt.sign({ user_id, tenant_id }, SECRET, { expiresIn: '7d' });
  ```
  **Neden kritik:** Session management değişmez

- [ ] **Role-based access** - `user`, `admin`, `tenant_owner`, `platform_admin`
  ```sql
  role VARCHAR(50) DEFAULT 'user'
  ```
  **Neden kritik:** Permission model sonradan değişmez

#### Data Integrity

- [ ] **Soft delete** - `is_deleted`, `deleted_at`, `deleted_by`
  ```sql
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER
  ```
  **Neden kritik:** Gerçek DELETE geri getirilemez!

- [ ] **Optimistic locking** - `version` column
  ```sql
  version INTEGER DEFAULT 1
  -- UPDATE ... WHERE id = $1 AND version = $2
  ```
  **Neden kritik:** Race condition'ları önler

- [ ] **Audit logs** - Her değişiklik `ops.audit_logs`'a
  ```sql
  CREATE TRIGGER trg_table_audit 
    AFTER INSERT OR UPDATE OR DELETE ON table
    FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
  ```
  **Neden kritik:** GDPR/KVKK compliance, geçmiş veri olmaz

- [ ] **Change history** - Her değişikliğin snapshot'ı
  ```sql
  old_values JSONB,  -- Önceki değer
  new_values JSONB   -- Yeni değer
  ```
  **Neden kritik:** Who, what, when, why?

#### Internationalization

- [ ] **Multi-currency** - `cfg.currencies`, `cfg.exchange_rates` tables
  ```sql
  CREATE TABLE cfg.currencies (code, name, symbol, decimal_digits);
  CREATE TABLE cfg.exchange_rates (from, to, rate, rate_date);
  ```
  **Neden kritik:** Geçmiş kur verisi olmaz!

- [ ] **Multi-language** - `cfg.languages`, `cfg.translations` tables
  ```sql
  CREATE TABLE cfg.languages (code, name, direction);
  CREATE TABLE cfg.translations (tenant_id, language_code, key, value);
  ```
  **Neden kritik:** RTL desteği sonradan çok zor

- [ ] **Timezone support** - `TIMESTAMPTZ` everywhere!
  ```sql
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  -- NOT: TIMESTAMP (timezone olmadan)
  ```
  **Neden kritik:** Geçmiş veriler hangi timezone'da?

#### Performance

- [ ] **Proper indexes** - Özellikle `tenant_id`, foreign keys
  ```sql
  CREATE INDEX idx_table_tenant ON table(tenant_id);
  CREATE INDEX idx_table_active ON table(tenant_id) 
    WHERE is_active = TRUE AND is_deleted = FALSE;
  ```
  **Neden kritik:** Milyonlarca kayıtta index ekleme saatler sürer

- [ ] **Database partitioning** - Logs için time-based
  ```sql
  CREATE TABLE ops.audit_logs_2025_01 
    PARTITION OF ops.audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
  ```
  **Neden kritik:** 100M+ log sonradan partition edilemez

---

## 🟡 P1 - ÇOK ÖNEMLİ (İlk Hafta)

### File Management

- [ ] **File storage** - S3/CloudFlare R2 integration
  ```javascript
  storage_provider: 's3' | 'r2' | 'local'
  storage_path: 'tenant_123/files/abc.jpg'
  ```

- [ ] **File hash** - SHA-256 (duplicate detection)
  ```sql
  file_hash VARCHAR(64),  -- SHA-256
  CREATE INDEX idx_files_hash ON files(file_hash);
  ```

- [ ] **Virus scan** - ClamAV integration
  ```sql
  virus_scan_status VARCHAR(20),  -- 'pending', 'clean', 'infected'
  virus_scan_at TIMESTAMPTZ
  ```

- [ ] **Image variants** - Thumbnail, medium, large
  ```sql
  CREATE TABLE core.image_variants (
    file_id UUID,
    variant_name VARCHAR(50),  -- 'thumb', 'medium', 'large'
    storage_path TEXT
  );
  ```

### Communications

- [ ] **Notification system** - Email, SMS, push, in-app
  ```sql
  CREATE TABLE comms.notifications (
    type VARCHAR(50),  -- 'email', 'sms', 'push', 'in_app'
    priority VARCHAR(20),  -- 'high', 'normal', 'low'
    status VARCHAR(20)  -- 'pending', 'sent', 'failed'
  );
  ```

- [ ] **Email queue** - Retry logic
  ```sql
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ
  ```

- [ ] **Webhook system** - Event-driven architecture
  ```sql
  CREATE TABLE comms.webhooks (
    url VARCHAR(500),
    events TEXT[],  -- ['order.created', 'product.updated']
    retry_policy JSONB
  );
  ```

### Billing

- [ ] **Subscription management** - Trial, billing cycles
  ```sql
  CREATE TABLE billing.subscriptions (
    plan_id INTEGER,
    status VARCHAR(20),  -- 'trial', 'active', 'past_due', 'cancelled'
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ
  );
  ```

- [ ] **Usage tracking** - API calls, storage
  ```sql
  CREATE TABLE billing.usage_records (
    resource_type VARCHAR(50),  -- 'api_call', 'storage', 'email'
    quantity INTEGER,
    cost NUMERIC(10,4)
  );
  ```

- [ ] **Payment methods** - Stripe, PayPal integration
  ```sql
  payment_method_id VARCHAR(100),  -- Stripe payment method
  last_payment_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ
  ```

### Security

- [ ] **2FA support** - TOTP, SMS, Email
  ```sql
  CREATE TABLE core.user_2fa (
    method VARCHAR(20),  -- 'totp', 'sms', 'email'
    secret_encrypted TEXT,
    backup_codes_encrypted TEXT[]
  );
  ```

- [ ] **Session management** - Multiple devices
  ```sql
  CREATE TABLE core.user_sessions (
    device_id VARCHAR(255),
    device_type VARCHAR(50),  -- 'mobile', 'desktop', 'tablet'
    last_activity_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
  );
  ```

- [ ] **IP whitelist/blacklist** - Security rules
  ```sql
  allowed_ips TEXT[],
  blocked_ips TEXT[]
  ```

---

## 🟢 P2 - ÖNEMLİ (İlk Ay)

### Activity Tracking

- [ ] **User activities** - Timeline
  ```sql
  CREATE TABLE ops.user_activities (
    activity_type VARCHAR(50),  -- 'login', 'logout', 'create', 'update'
    activity_data JSONB,
    ip_address INET
  );
  ```

### Advanced Communications

- [ ] **SMS integration** - Twilio, AWS SNS
- [ ] **Push notifications** - Firebase, OneSignal
- [ ] **In-app notifications** - Real-time updates

### Analytics

- [ ] **Analytics events** - Custom event tracking
  ```sql
  CREATE TABLE ops.analytics_events (
    event_name VARCHAR(100),
    event_data JSONB,
    user_id INTEGER,
    session_id VARCHAR(255)
  );
  ```

- [ ] **Advanced reporting** - Business intelligence

### Automation

- [ ] **Scheduled jobs** - Cron-like system
- [ ] **Workflow automation** - Zapier-like
- [ ] **Background workers** - Bull queue

---

## Standard Table Template

### Her Tabloda Olması Gerekenler

```sql
-- 🔥 BÜTÜN MULTI-TENANT TABLOLARDA OLMASI GEREKENLER
CREATE TABLE {schema}.{table_name} (
  -- Primary Key (Modern PostgreSQL!)
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  
  -- Multi-tenancy (MUTLAKA!)
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  
  -- Your columns here
  -- ...
  -- email citext UNIQUE NOT NULL,  -- Case-insensitive email
  -- price NUMERIC(12,2),            -- Money fields
  -- settings JSONB DEFAULT '{}'::jsonb,  -- JSON with explicit cast
  
  -- Data Integrity
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES core.users(id),
  
  -- Optimistic Locking
  version INTEGER DEFAULT 1,
  
  -- Timestamps (TIMESTAMPTZ!)
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- Audit
  created_by INTEGER REFERENCES core.users(id),
  updated_by INTEGER REFERENCES core.users(id)
);

-- Standard Indexes (MUTLAKA!)
CREATE INDEX idx_{table}_tenant ON {schema}.{table}(tenant_id);
CREATE INDEX idx_{table}_active ON {schema}.{table}(tenant_id) 
  WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_{table}_created ON {schema}.{table}(created_at);

-- Standard Triggers (MUTLAKA!)
CREATE TRIGGER trg_{table}_touch 
  BEFORE UPDATE ON {schema}.{table} 
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();

CREATE TRIGGER trg_{table}_softdel 
  BEFORE DELETE ON {schema}.{table} 
  FOR EACH ROW EXECUTE FUNCTION app.soft_delete();

CREATE TRIGGER trg_{table}_audit 
  AFTER INSERT OR UPDATE OR DELETE ON {schema}.{table} 
  FOR EACH ROW EXECUTE FUNCTION ops.log_audit();

-- RLS (MUTLAKA!)
ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_{table}_tenant ON {schema}.{table}
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Platform admin policy (opsiyonel)
CREATE POLICY rls_{table}_admin ON {schema}.{table}
  USING (
    EXISTS (
      SELECT 1 FROM core.users 
      WHERE id = app.current_user_id() AND role = 'platform_admin'
    )
  );
```

### Kritik Noktalar

- ✅ `GENERATED BY DEFAULT AS IDENTITY` (SERIAL değil!)
- ✅ `TIMESTAMPTZ` (TIMESTAMP değil!)
- ✅ `citext` email field'ları için
- ✅ `JSONB DEFAULT '{}'::jsonb` (explicit cast)
- ✅ Schema prefix (`core.users`, `cfg.currencies`, vs.)
- ✅ 3 trigger (`touch`, `softdel`, `audit`)
- ✅ RLS enabled + 2 policy (`tenant` + `admin`)

---

## 🎯 Ne Olur Kurallara Uymazsanız?

### ❌ Yanlış Yaklaşım: "Şimdi basit başlayalım, sonra ekleriz"

**Gerçek Senaryo:**
```
1. Sistem 1 milyon kullanıcıya ulaşır
2. tenant_id eklemeye çalışırsın
3. Migration 48 saat sürer
4. Production DOWN
5. Müşteriler kızgın
6. Para kaybı
7. Reputation zarar görür
```

### ✅ Doğru Yaklaşım: "Baştan doğru kur, sonra scale et"

**Gerçek Senaryo:**
```
1. Sistem doğru kurulu
2. 10 milyon kullanıcıya scale eder
3. Sadece server ekle
4. Zero downtime
5. Mutlu müşteriler
6. Kolay büyüme
```

---

## 📊 Priority Matrix

| Feature | P0 | P1 | P2 | Effort | Impact | Risk |
|---------|----|----|----|----|--------|------|
| tenant_id | ✅ | - | - | High | Critical | 🔴 Extreme |
| RLS | ✅ | - | - | Medium | Critical | 🔴 Extreme |
| API keys | ✅ | - | - | Low | High | 🟡 High |
| Soft delete | ✅ | - | - | Low | High | 🟡 High |
| Audit logs | ✅ | - | - | Medium | High | 🟡 High |
| i18n/l10n | ✅ | - | - | Medium | High | 🟡 High |
| File storage | - | ✅ | - | Medium | Medium | 🟢 Low |
| Webhooks | - | ✅ | - | Medium | Medium | 🟢 Low |
| 2FA | - | ✅ | - | Low | Medium | 🟢 Low |
| Analytics | - | - | ✅ | High | Low | 🟢 Low |
| Automation | - | - | ✅ | High | Low | 🟢 Low |

---

## ✅ Checklist Summary

### Başlamadan Önce (30 dakika)
- [ ] PostgreSQL 15+ kurulu
- [ ] Extensions yüklü (`uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm`)
- [ ] Schemas oluşturuldu (`core`, `cfg`, `ops`, `comms`, `billing`)
- [ ] Context functions oluşturuldu
- [ ] Trigger functions oluşturuldu

### İlk Gün (8 saat)
- [ ] Core tables (`users`, `tenants`, `projects`)
- [ ] RLS enabled tüm tablolarda
- [ ] API key system
- [ ] JWT authentication
- [ ] Basic CRUD APIs

### İlk Hafta (40 saat)
- [ ] File management
- [ ] Email system
- [ ] Notification system
- [ ] Subscription management
- [ ] Frontend integration

### İlk Ay (160 saat)
- [ ] Template system
- [ ] Business logic modules
- [ ] Advanced features
- [ ] Testing & QA
- [ ] Production deployment

---

## 🔗 İlgili Dökümanlar

- [01_PostgreSQL_Setup.md](01_PostgreSQL_Setup.md) - İlk adımlar
- [10_Common_Mistakes.md](10_Common_Mistakes.md) - Yaygın hatalar
- [12_Table_Template.md](12_Table_Template.md) - Tablo template'i
- [11_Roadmap_TechStack.md](11_Roadmap_TechStack.md) - Geliştirme roadmap

---

**[◀️ Geri: Security & Auth](08_Security_Auth.md) | [Ana Sayfa](README.md) | [İleri: Common Mistakes ▶️](10_Common_Mistakes.md)**

