# 🔧 PostgreSQL Setup

> **Temel PostgreSQL kurulumu: Extensions, Schemas, Functions, Triggers**

[◀️ Ana Sayfa](README.md) | [İleri: Core Database Schema ▶️](02_Core_Database_Schema.md)

---

## 📋 İçindekiler

1. [PostgreSQL Extensions](#postgresql-extensions)
2. [Schema Organization](#schema-organization)
3. [Context Helper Functions](#context-helper-functions)
4. [Common Triggers](#common-triggers)

---

## PostgreSQL Extensions

### Zorunlu Extensions

```sql
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Encryption & hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Case-insensitive text (email için)
CREATE EXTENSION IF NOT EXISTS citext;

-- Full-text search & fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Neden Gerekli?

| Extension | Kullanım Alanı | Örnek |
|-----------|----------------|-------|
| `uuid-ossp` | UUID v4 generation | Files, API keys için unique ID |
| `pgcrypto` | Password hashing, encryption | `gen_random_uuid()`, `crypt()` |
| `citext` | Case-insensitive email | `user@test.com` = `USER@TEST.COM` |
| `pg_trgm` | Fuzzy search, autocomplete | Ürün arama, kullanıcı arama |

---

## Schema Organization

### Schemas Oluşturma

```sql
-- 1. Yardımcı fonksiyonlar
CREATE SCHEMA IF NOT EXISTS app;      -- helpers, triggers, utilities

-- 2. Core tablolar (users, tenants, auth)
CREATE SCHEMA IF NOT EXISTS core;     -- tenants, users, sessions, api_keys

-- 3. Config & i18n
CREATE SCHEMA IF NOT EXISTS cfg;      -- languages, currencies, translations

-- 4. Operations & Logging
CREATE SCHEMA IF NOT EXISTS ops;      -- audit_logs, system_logs, activities

-- 5. Communications
CREATE SCHEMA IF NOT EXISTS comms;    -- notifications, email_queue, webhooks

-- 6. Billing
CREATE SCHEMA IF NOT EXISTS billing;  -- subscriptions, usage_records
```

### Avantajları

- ✅ **Daha organize kod** - Her schema specific bir amaç için
- ✅ **Kolay yetkilendirme** - `GRANT/REVOKE` schema bazında
- ✅ **Name collision yok** - `core.users` vs `app.users`
- ✅ **Backup/restore kolaylığı** - Schema bazlı export
- ✅ **Modüler yapı** - Her schema ayrı deploy edilebilir

### Schema Kullanım Örnekleri

```sql
-- Core tablolar
SELECT * FROM core.users;
SELECT * FROM core.tenants;

-- Config tablolar
SELECT * FROM cfg.currencies;
SELECT * FROM cfg.languages;

-- Ops tablolar
SELECT * FROM ops.audit_logs;
SELECT * FROM ops.system_logs;

-- Comms tablolar
SELECT * FROM comms.notifications;
SELECT * FROM comms.email_queue;

-- Billing tablolar
SELECT * FROM billing.subscriptions;
SELECT * FROM billing.usage_records;
```

---

## Context Helper Functions

### RLS İçin Kritik Fonksiyonlar

Bu fonksiyonlar PostgreSQL Row Level Security (RLS) için zorunludur!

#### 1. Set Context Function

```sql
-- Request context'i sakla (her istek için set edilecek)
CREATE OR REPLACE FUNCTION app.set_context(p_tenant_id int, p_user_id int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.tenant_id', COALESCE(p_tenant_id::text, ''), true);
  PERFORM set_config('app.user_id',   COALESCE(p_user_id::text, ''), true);
END$$;
```

**Açıklama:**
- `set_config()` PostgreSQL GUC (Grand Unified Configuration) değişkenlerini set eder
- `true` parametresi: transaction-local (sadece bu transaction için geçerli)
- Her request başında çağrılmalı!

#### 2. Current Tenant Function

```sql
-- Current tenant ID (RLS policy'lerde kullanılır)
CREATE OR REPLACE FUNCTION app.current_tenant() 
RETURNS int LANGUAGE sql STABLE AS $$ 
  SELECT nullif(current_setting('app.tenant_id', true), '')::int 
$$;
```

**Kullanım:**
```sql
-- RLS policy'de
USING (tenant_id = app.current_tenant())

-- Normal query'de
SELECT * FROM core.projects WHERE tenant_id = app.current_tenant();
```

#### 3. Current User Function

```sql
-- Current user ID (audit logs için)
CREATE OR REPLACE FUNCTION app.current_user_id() 
RETURNS int LANGUAGE sql STABLE AS $$ 
  SELECT nullif(current_setting('app.user_id', true), '')::int 
$$;
```

**Kullanım:**
```sql
-- Audit log trigger'da
INSERT INTO ops.audit_logs (user_id, ...) 
VALUES (app.current_user_id(), ...);

-- Soft delete trigger'da
UPDATE table SET deleted_by = app.current_user_id() WHERE id = ...;
```

### Node.js Kullanımı

```javascript
// Her istek başında context set et
async function setTenantContext(req, res, next) {
  try {
    const user = req.user; // JWT'den
    
    // User'ın tenant_id'sini al
    const result = await pool.query(
      'SELECT tenant_id FROM core.users WHERE id = $1',
      [user.id]
    );
    
    const tenantId = result.rows[0].tenant_id;
    
    // PostgreSQL GUC'ye set et (RLS için)
    await pool.query('SELECT app.set_context($1, $2)', [tenantId, user.id]);
    
    req.tenant_id = tenantId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid tenant' });
  }
}

// Transaction wrapper
async function withTenantContext(tenantId, userId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Context set et (RLS için kritik!)
    await client.query('SELECT app.set_context($1, $2)', [tenantId, userId]);
    
    // Callback çalıştır
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Kullanım
router.get('/projects', authenticate, setTenantContext, async (req, res) => {
  await withTenantContext(req.tenant_id, req.user.id, async (client) => {
    // RLS otomatik çalışır, WHERE tenant_id = ... gereksiz!
    const projects = await client.query('SELECT * FROM core.projects');
    
    res.json({ success: true, data: projects.rows });
  });
});
```

---

## Common Triggers

### Her Tabloda Otomatik Çalışan Trigger'lar

#### 1. Touch Row (Updated At + Optimistic Locking)

```sql
-- Auto-update updated_at + optimistic locking
CREATE OR REPLACE FUNCTION app.touch_row()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;  -- Optimistic locking
  END IF;
  RETURN NEW;
END$$;
```

**Ne Yapar:**
- Her `UPDATE` işleminde `updated_at` otomatik güncellenir
- `version` kolonu +1 artar (optimistic locking için)
- Race condition'ları önler

**Kullanım:**
```sql
CREATE TRIGGER trg_users_touch 
  BEFORE UPDATE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();
```

#### 2. Soft Delete (Physical Delete'i Engelle)

```sql
-- Soft delete (DELETE → UPDATE is_deleted = true)
CREATE OR REPLACE FUNCTION app.soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE 
  v_user int := app.current_user_id();
BEGIN
  EXECUTE format(
    'UPDATE %I.%I SET is_deleted = true, deleted_at = now(), deleted_by = $1 WHERE id = $2',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING v_user, OLD.id;
  RETURN NULL;  -- Cancel physical delete
END$$;
```

**Ne Yapar:**
- `DELETE` komutu çalıştırılınca gerçek silme olmaz
- Sadece `is_deleted = true` olur
- `deleted_at` ve `deleted_by` otomatik doldurulur
- Veri geri getirilebilir!

**Kullanım:**
```sql
CREATE TRIGGER trg_users_softdel 
  BEFORE DELETE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION app.soft_delete();
```

#### 3. Audit Log (Her Değişikliği Kaydet)

```sql
-- Audit log (her değişikliği kaydet)
CREATE OR REPLACE FUNCTION ops.log_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE 
  v_tenant int := app.current_tenant();
  v_user   int := app.current_user_id();
BEGIN
  INSERT INTO ops.audit_logs(
    tenant_id, user_id, action, entity_type, entity_id, 
    old_values, new_values
  )
  VALUES (
    v_tenant, v_user, TG_OP::text, TG_TABLE_NAME, 
    CASE WHEN TG_OP='INSERT' THEN NEW.id::text ELSE OLD.id::text END,
    CASE WHEN TG_OP='UPDATE' OR TG_OP='DELETE' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP='INSERT' OR TG_OP='UPDATE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END$$;
```

**Ne Yapar:**
- Her `INSERT`, `UPDATE`, `DELETE` işleminde log kaydı oluşturur
- `old_values` ve `new_values` JSONB formatında saklanır
- Kim, ne zaman, ne yaptı → hepsi kayıt altında
- GDPR/KVKK uyumluluk için zorunlu!

**Kullanım:**
```sql
CREATE TRIGGER trg_users_audit 
  AFTER INSERT OR UPDATE OR DELETE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
```

### Audit Logs Tablosu

```sql
CREATE TABLE ops.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER,
  user_id INTEGER,
  
  -- Action
  action VARCHAR(50) NOT NULL,       -- 'INSERT', 'UPDATE', 'DELETE'
  entity_type VARCHAR(50) NOT NULL,  -- Table name
  entity_id TEXT,
  
  -- Changes
  old_values JSONB,  -- Önceki değerler
  new_values JSONB,  -- Yeni değerler
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON ops.audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON ops.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON ops.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON ops.audit_logs(created_at);
```

---

## Trigger'ları Tabloya Ekleme

### Her Tabloda 3 Trigger

```sql
-- Örnek: core.users tablosu için

-- 1. Updated_at + version
CREATE TRIGGER trg_users_touch 
  BEFORE UPDATE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- 2. Soft delete
CREATE TRIGGER trg_users_softdel 
  BEFORE DELETE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION app.soft_delete();

-- 3. Audit log
CREATE TRIGGER trg_users_audit 
  AFTER INSERT OR UPDATE OR DELETE ON core.users 
  FOR EACH ROW EXECUTE FUNCTION ops.log_audit();
```

### Trigger Sırası

1. **BEFORE UPDATE** → `touch_row()` çalışır
2. **UPDATE** gerçekleşir
3. **AFTER UPDATE** → `log_audit()` çalışır

1. **BEFORE DELETE** → `soft_delete()` çalışır
2. **DELETE** iptal edilir (RETURN NULL)
3. **AFTER UPDATE** → `log_audit()` çalışır (soft delete UPDATE olarak kayıt edilir)

---

## ✅ Kurulum Checklist

- [ ] PostgreSQL 15+ kurulu
- [ ] Extensions yüklü (`uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm`)
- [ ] Schemas oluşturuldu (`app`, `core`, `cfg`, `ops`, `comms`, `billing`)
- [ ] Context functions oluşturuldu (`set_context`, `current_tenant`, `current_user_id`)
- [ ] Trigger functions oluşturuldu (`touch_row`, `soft_delete`, `log_audit`)
- [ ] `ops.audit_logs` tablosu oluşturuldu

---

## 🔗 İlgili Dökümanlar

- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - Core tablolar ve trigger kullanımı
- [04_RLS_Multi_Tenant_Strategy.md](04_RLS_Multi_Tenant_Strategy.md) - Context functions ile RLS
- [12_Table_Template.md](12_Table_Template.md) - Her tablo için standart template

---

**[◀️ Ana Sayfa](README.md) | [İleri: Core Database Schema ▶️](02_Core_Database_Schema.md)**

