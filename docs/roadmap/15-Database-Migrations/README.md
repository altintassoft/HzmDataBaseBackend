# 🔄 Database Migrations Guide

> **Migration stratejisi: Sıfırdan deployment ve sürekli güncelleme rehberi**

[Ana Sayfa](../README.md)

---

## 📋 İçindekiler

1. [Migration Nedir?](#migration-nedir)
2. [Migration Klasör Yapısı](#migration-klasör-yapısı)
3. [Migration İsimlendirme](#migration-i̇simlendirme)
4. [Migration Çalıştırma](#migration-çalıştırma)
5. [Migration Script'leri](#migration-scriptleri)
6. [Rollback Stratejisi](#rollback-stratejisi)
7. [Production Deployment](#production-deployment)

---

## Migration Nedir?

**Database migration**, veritabanı şemasının versiyonlanarak yönetilmesidir.

### Neden Gerekli?

- ✅ **Versiyon kontrolü**: Hangi değişiklikler ne zaman yapıldı?
- ✅ **Team sync**: Tüm developerlar aynı şemayı kullanır
- ✅ **Deployment**: Prod/staging/dev aynı script'lerle güncellenir
- ✅ **Rollback**: Hata olursa geri alınabilir

---

## Migration Klasör Yapısı

```
HzmBackendVeriTabani/
└── migrations/
    ├── 001_initial_schema.sql          # İlk kurulum (core, cfg, ops schemas)
    ├── 002_add_organizations.sql       # Organizations tablosu
    ├── 003_add_rbac.sql                # RBAC sistemi
    ├── 004_add_generic_data.sql        # 🎯 Generic Table Pattern
    ├── 005_add_microservices.sql       # Microservice schemas
    ├── 006_add_file_storage.sql        # Files & image_variants
    ├── 007_add_notifications.sql       # comms.notifications, email_queue
    ├── 008_add_webhooks.sql            # comms.webhooks
    ├── 009_add_billing.sql             # billing.subscriptions
    ├── 010_add_monitoring.sql          # ops.system_logs
    ├── 011_add_feature_flags.sql       # Feature flags
    └── seeds/
        ├── 001_default_languages.sql    # en, tr, de, fr
        ├── 002_default_currencies.sql   # USD, EUR, TRY
        └── 003_platform_admin.sql       # Platform admin user
```

---

## Migration İsimlendirme

### Format:
```
{sequence}_{description}.sql
```

### Örnekler:
```sql
001_initial_schema.sql              ✅ Doğru
002_add_organizations.sql           ✅ Doğru
003_add_rbac.sql                    ✅ Doğru
004_add_generic_data.sql            ✅ Doğru

add_users.sql                       ❌ Yanlış (sequence yok)
002-add-orgs.sql                    ❌ Yanlış (- yerine _)
2_add_orgs.sql                      ❌ Yanlış (001, 002... format)
```

### Kurallar:
- ✅ Sequence 3 basamaklı: `001`, `002`, `003`...
- ✅ Snake_case: `add_organizations`
- ✅ Açıklayıcı isim: `add_rbac`, `add_feature_flags`
- ❌ Tarih kullanma: `2025_10_21_add_users.sql` yerine sequence kullan

---

## Migration Çalıştırma

### Option 1: Manuel (PostgreSQL CLI)

```bash
# Sırayla çalıştır
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_add_organizations.sql
psql $DATABASE_URL -f migrations/003_add_rbac.sql
# ...
```

### Option 2: Node.js Script (Önerilen)

```javascript
// run-migrations.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  // Migration tablosu oluştur (ilk seferde)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Migrations klasöründeki tüm .sql dosyalarını oku
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    
    // Bu migration daha önce çalıştırıldı mı?
    const result = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version]
    );

    if (result.rows.length > 0) {
      console.log(`⏭️  Skipping ${version} (already applied)`);
      continue;
    }

    // Migration'ı çalıştır
    console.log(`🔄 Running ${version}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      await pool.query('COMMIT');
      console.log(`✅ Applied ${version}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`❌ Failed ${version}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed!');
  await pool.end();
}

runMigrations();
```

**Kullanım:**
```bash
node run-migrations.js
```

### Option 3: Migration Library (İleri seviye)

```bash
npm install node-pg-migrate

# Migration oluştur
npx node-pg-migrate create add-organizations

# Migrate
npx node-pg-migrate up

# Rollback
npx node-pg-migrate down
```

---

## Migration Script'leri

### 001_initial_schema.sql

```sql
-- ===============================
-- HZM Platform - Initial Schema
-- ===============================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS cfg;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS comms;
CREATE SCHEMA IF NOT EXISTS billing;

-- Context Helpers
CREATE OR REPLACE FUNCTION app.set_context(p_tenant_id int, p_user_id int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.tenant_id', COALESCE(p_tenant_id::text, ''), true);
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);
END$$;

CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::int
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::int
$$;

-- Common Triggers
CREATE OR REPLACE FUNCTION app.touch_row()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION app.soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_user int := app.current_user_id();
BEGIN
  EXECUTE format(
    'UPDATE %I.%I SET is_deleted = true, deleted_at = now(), deleted_by = $1 WHERE id = $2',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING v_user, OLD.id;
  RETURN NULL;
END$$;

-- Audit Log Function
CREATE OR REPLACE FUNCTION ops.log_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_tenant int := app.current_tenant();
DECLARE v_user   int := app.current_user_id();
BEGIN
  INSERT INTO ops.audit_logs(tenant_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    v_tenant, 
    v_user, 
    TG_OP::text, 
    TG_TABLE_NAME, 
    (CASE WHEN TG_OP='INSERT' THEN NEW.id::text ELSE OLD.id::text END),
    CASE WHEN TG_OP='UPDATE' OR TG_OP='DELETE' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP='INSERT' OR TG_OP='UPDATE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END$$;

-- Config Tables (i18n)
CREATE TABLE cfg.languages (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100),
  native_name VARCHAR(100),
  direction VARCHAR(3) DEFAULT 'ltr',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE cfg.currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100),
  symbol VARCHAR(10),
  decimal_digits INT DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE cfg.exchange_rates (
  from_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  to_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  rate NUMERIC(20,6),
  rate_date DATE NOT NULL,
  PRIMARY KEY(from_currency, to_currency, rate_date)
);

CREATE TABLE cfg.translations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT,
  language_code VARCHAR(10) REFERENCES cfg.languages(code),
  translation_key VARCHAR(200),
  translation_value TEXT,
  UNIQUE(tenant_id, language_code, translation_key)
);

-- Audit Logs
CREATE TABLE ops.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant ON ops.audit_logs(tenant_id);
CREATE INDEX idx_audit_entity ON ops.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON ops.audit_logs(created_at);

-- Core: Tenants
CREATE TABLE core.tenants (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255) UNIQUE,
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  default_language VARCHAR(10) REFERENCES cfg.languages(code) DEFAULT 'en',
  supported_languages TEXT[] DEFAULT '{en}',
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  time_format VARCHAR(20) DEFAULT 'HH:mm:ss',
  default_currency VARCHAR(3) REFERENCES cfg.currencies(code) DEFAULT 'USD',
  supported_currencies TEXT[] DEFAULT '{USD}',
  auto_convert_currency BOOLEAN DEFAULT FALSE,
  decimal_separator VARCHAR(1) DEFAULT '.',
  thousands_separator VARCHAR(1) DEFAULT ',',
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  plan VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(20) DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  max_projects INTEGER DEFAULT 3,
  max_tables_per_project INTEGER DEFAULT 10,
  max_records INTEGER DEFAULT 10000,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tenants_slug ON core.tenants(slug);
CREATE INDEX idx_tenants_active ON core.tenants(is_active) WHERE is_deleted = FALSE;
CREATE TRIGGER trg_tenants_touch BEFORE UPDATE ON core.tenants FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_tenants_softdel BEFORE DELETE ON core.tenants FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
CREATE TRIGGER trg_tenants_audit AFTER INSERT OR UPDATE OR DELETE ON core.tenants FOR EACH ROW EXECUTE FUNCTION ops.log_audit();

-- Core: Users
CREATE TABLE core.users (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id),
  email citext UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  phone VARCHAR(50),
  phone_verified BOOLEAN DEFAULT FALSE,
  name VARCHAR(200),
  role VARCHAR(50) DEFAULT 'user',
  timezone VARCHAR(50) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT,
  last_login_at TIMESTAMPTZ,
  login_count INT DEFAULT 0,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INT,
  updated_by INT
);
CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_active ON core.users(tenant_id) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_users_softdel BEFORE DELETE ON core.users FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
CREATE TRIGGER trg_users_audit AFTER INSERT OR UPDATE OR DELETE ON core.users FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_users_tenant ON core.users
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: User Sessions
CREATE TABLE core.user_sessions (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id),
  user_id INT NOT NULL REFERENCES core.users(id),
  token VARCHAR(500) UNIQUE NOT NULL,
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1
);
CREATE INDEX idx_sessions_user ON core.user_sessions(user_id);
CREATE INDEX idx_sessions_token ON core.user_sessions(token);
CREATE INDEX idx_sessions_expire ON core.user_sessions(expires_at);
CREATE TRIGGER trg_sessions_touch BEFORE UPDATE ON core.user_sessions FOR EACH ROW EXECUTE FUNCTION app.touch_row();
ALTER TABLE core.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_sessions_tenant ON core.user_sessions
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: 2FA
CREATE TABLE core.user_2fa (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id),
  user_id INT UNIQUE REFERENCES core.users(id),
  method VARCHAR(20) NOT NULL,
  secret_encrypted TEXT NOT NULL,
  backup_codes_encrypted TEXT[],
  is_enabled BOOLEAN DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1
);
CREATE TRIGGER trg_2fa_touch BEFORE UPDATE ON core.user_2fa FOR EACH ROW EXECUTE FUNCTION app.touch_row();
ALTER TABLE core.user_2fa ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_2fa_tenant ON core.user_2fa
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: Projects
CREATE TABLE core.projects (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  template_type VARCHAR(100),
  template_config JSONB DEFAULT '{}'::jsonb,
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_key_password VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INT,
  updated_by INT,
  CONSTRAINT unique_project_name_per_tenant UNIQUE (tenant_id, name)
);
CREATE INDEX idx_projects_tenant ON core.projects(tenant_id);
CREATE INDEX idx_projects_user ON core.projects(user_id);
CREATE INDEX idx_projects_api_key ON core.projects(api_key);
CREATE INDEX idx_projects_active ON core.projects(tenant_id) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE TRIGGER trg_projects_touch BEFORE UPDATE ON core.projects FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_projects_softdel BEFORE DELETE ON core.projects FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
CREATE TRIGGER trg_projects_audit AFTER INSERT OR UPDATE OR DELETE ON core.projects FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_projects_tenant ON core.projects
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: Table Metadata
CREATE TABLE core.table_metadata (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  physical_table_name VARCHAR(255) NOT NULL UNIQUE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  from_template BOOLEAN DEFAULT FALSE,
  template_table_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INT,
  updated_by INT,
  CONSTRAINT unique_table_per_project UNIQUE (tenant_id, project_id, table_name)
);
CREATE INDEX idx_table_metadata_tenant ON core.table_metadata(tenant_id);
CREATE INDEX idx_table_metadata_project ON core.table_metadata(project_id);
CREATE INDEX idx_table_metadata_physical ON core.table_metadata(physical_table_name);
CREATE INDEX idx_table_metadata_active ON core.table_metadata(project_id) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE TRIGGER trg_table_metadata_touch BEFORE UPDATE ON core.table_metadata FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_table_metadata_softdel BEFORE DELETE ON core.table_metadata FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
CREATE TRIGGER trg_table_metadata_audit AFTER INSERT OR UPDATE OR DELETE ON core.table_metadata FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
ALTER TABLE core.table_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_table_metadata_tenant ON core.table_metadata
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: API Keys
CREATE TABLE core.api_keys (
  id GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  project_id INT REFERENCES core.projects(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) UNIQUE,
  key_hash VARCHAR(255) NOT NULL,
  key_encrypted TEXT NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  scopes TEXT[] DEFAULT '{}',
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_day INT DEFAULT 10000,
  allowed_ips TEXT[] DEFAULT '{}',
  allowed_domains TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  total_requests BIGINT DEFAULT 0,
  total_errors INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by INT,
  revoke_reason TEXT,
  version INT DEFAULT 1
);
CREATE INDEX idx_api_keys_tenant ON core.api_keys(tenant_id);
CREATE INDEX idx_api_keys_project ON core.api_keys(project_id);
CREATE INDEX idx_api_keys_prefix ON core.api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON core.api_keys(tenant_id) WHERE is_active = TRUE;
CREATE TRIGGER trg_api_keys_touch BEFORE UPDATE ON core.api_keys FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_api_keys_audit AFTER INSERT OR UPDATE OR DELETE ON core.api_keys FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
ALTER TABLE core.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_api_keys_tenant ON core.api_keys
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Core: Files
CREATE TABLE core.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id INT NOT NULL REFERENCES core.tenants(id),
  uploaded_by INT REFERENCES core.users(id),
  original_filename VARCHAR(500),
  filename VARCHAR(500),
  storage_path TEXT,
  storage_provider VARCHAR(50),
  mime_type VARCHAR(100),
  file_size BIGINT,
  file_hash VARCHAR(64),
  width INT,
  height INT,
  is_public BOOLEAN DEFAULT FALSE,
  virus_scan_status VARCHAR(20),
  virus_scan_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1
);
CREATE INDEX idx_files_tenant ON core.files(tenant_id);
CREATE INDEX idx_files_hash ON core.files(file_hash);
CREATE TRIGGER trg_files_touch BEFORE UPDATE ON core.files FOR EACH ROW EXECUTE FUNCTION app.touch_row();
ALTER TABLE core.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_files_tenant ON core.files
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());
```

### 004_add_generic_data.sql

```sql
-- ===============================
-- HZM Platform - Generic Data Table
-- (CRITICAL: Bu tablo fiziksel tablo çoğalmasını önler!)
-- ===============================

CREATE TABLE app.generic_data (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
  table_id INT NOT NULL REFERENCES core.table_metadata(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_text TEXT GENERATED ALWAYS AS (jsonb_to_text(data)) STORED,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INT,
  updated_by INT,
  CONSTRAINT unique_generic_data_per_table UNIQUE (tenant_id, project_id, table_id, id)
);

CREATE INDEX idx_generic_data_tenant ON app.generic_data(tenant_id);
CREATE INDEX idx_generic_data_project ON app.generic_data(project_id);
CREATE INDEX idx_generic_data_table ON app.generic_data(table_id);
CREATE INDEX idx_generic_data_composite ON app.generic_data(tenant_id, project_id, table_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_generic_data_search ON app.generic_data USING GIN(to_tsvector('english', search_text));
CREATE INDEX idx_generic_data_jsonb ON app.generic_data USING GIN(data);

CREATE TRIGGER trg_generic_data_touch BEFORE UPDATE ON app.generic_data FOR EACH ROW EXECUTE FUNCTION app.touch_row();
CREATE TRIGGER trg_generic_data_softdel BEFORE DELETE ON app.generic_data FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
CREATE TRIGGER trg_generic_data_audit AFTER INSERT OR UPDATE OR DELETE ON app.generic_data FOR EACH ROW EXECUTE FUNCTION ops.log_audit();

ALTER TABLE app.generic_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_generic_data_tenant ON app.generic_data
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());
```

---

## Rollback Stratejisi

### Down Migrations (Geri Alma)

Her migration için bir **down script** oluştur:

```
migrations/
├── 001_initial_schema.sql
├── 001_initial_schema.down.sql     ← Rollback script
├── 002_add_organizations.sql
├── 002_add_organizations.down.sql
```

**Örnek down script:**

```sql
-- 002_add_organizations.down.sql
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
```

### Rollback Komutları

```bash
# Son migration'ı geri al
psql $DATABASE_URL -f migrations/002_add_organizations.down.sql

# veya node script ile
node rollback-migration.js 002_add_organizations
```

---

## Production Deployment

### Zero-Downtime Migration Stratejisi

**❌ Yanlış (Downtime var):**
```sql
ALTER TABLE core.users ADD COLUMN new_field VARCHAR(100) NOT NULL;
-- Hata! NULL olamaz ama eski kayıtlar NULL
```

**✅ Doğru (Zero-downtime):**

**Step 1: Nullable ekle**
```sql
ALTER TABLE core.users ADD COLUMN new_field VARCHAR(100);
```

**Step 2: Default değer ata**
```sql
UPDATE core.users SET new_field = 'default_value' WHERE new_field IS NULL;
```

**Step 3: NOT NULL yap**
```sql
ALTER TABLE core.users ALTER COLUMN new_field SET NOT NULL;
```

### Deployment Checklist

- [ ] Migration script'leri test et (local/staging)
- [ ] Backup al (pg_dump)
- [ ] Migration dry-run (BEGIN; ... ROLLBACK;)
- [ ] Production'da migration çalıştır
- [ ] API health check
- [ ] Rollback planı hazır ol

---

## 🔗 İlgili Dökümanlar

- [01_PostgreSQL_Setup.md](../01-Database-Core/01_PostgreSQL_Setup.md) - Schema organization
- [02_Core_Database_Schema.md](../01-Database-Core/02_Core_Database_Schema.md) - Core tables
- [06_Backup_Recovery.md](../04-Infrastructure/06_Backup_Recovery.md) - Backup strategies

---

**[Ana Sayfa](../README.md)**


