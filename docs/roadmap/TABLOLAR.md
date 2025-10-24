# 🗄️ HZM VERİ TABANI - TABLO ENVANTERI

> **Railway UI'da Görünmüyor ama Backend'de Çalışıyor!**  
> **Güncelleme**: 2025-10-22  
> **Migration Version**: 002

---

## 📊 GENEL DURUM

| Kategori | Durum | Açıklama |
|----------|-------|----------|
| **Schemas** | ✅ 4/4 | app, core, cfg, ops |
| **Extensions** | ✅ 2/2 | uuid-ossp, pgcrypto |
| **Functions** | ✅ 4/4 | Helper functions |
| **Tables** | ✅ 2/2 | core.tenants, core.users |
| **Indexes** | ✅ 5/5 | Performance indexes |
| **RLS Policies** | ✅ 1/1 | Multi-tenant isolation |
| **Triggers** | ✅ 2/2 | Auto-update triggers |

---

## 🗂️ SCHEMAS

```sql
✅ app        -- Helper functions, generic_data
✅ core       -- Tenants, users, projects
✅ cfg        -- i18n, currency, config
✅ ops        -- Audit logs, system logs
```

---

## 🔌 EXTENSIONS

```sql
✅ uuid-ossp  -- UUID generation
✅ pgcrypto   -- Encryption functions
```

---

## ⚙️ FUNCTIONS

### app.set_context(tenant_id, user_id)
```sql
✅ Oluşturuldu
📝 Kullanım: RLS için session context ayarlama
🎯 Parametre: tenant_id INTEGER, user_id INTEGER
```

### app.current_tenant()
```sql
✅ Oluşturuldu
📝 Kullanım: Aktif tenant_id okuma
🎯 Return: INTEGER
```

### app.current_user_id()
```sql
✅ Oluşturuldu
📝 Kullanım: Aktif user_id okuma
🎯 Return: INTEGER
```

### app.touch_row()
```sql
✅ Oluşturuldu
📝 Kullanım: Trigger function (updated_at, version)
🎯 Return: TRIGGER
```

---

## 📋 TABLOLAR

---

## 1️⃣ core.tenants

**Durum**: ✅ OLUŞTURULDU  
**Migration**: 001_initial_schema.sql  
**Açıklama**: Multi-tenant organizasyonlar

### Kolonlar

| Kolon | Tip | Null | Default | Açıklama |
|-------|-----|------|---------|----------|
| **id** | SERIAL | NO | AUTO | Primary Key |
| **name** | VARCHAR(200) | NO | - | Organization name |
| **slug** | VARCHAR(100) | NO | - | URL-friendly identifier (UNIQUE) |
| **domain** | VARCHAR(255) | YES | NULL | Custom domain (UNIQUE) |
| **default_language** | VARCHAR(10) | YES | 'en' | Default language code |
| **default_currency** | VARCHAR(3) | YES | 'USD' | Default currency code |
| **plan** | VARCHAR(50) | YES | 'free' | Subscription plan |
| **is_active** | BOOLEAN | YES | TRUE | Active status |
| **is_deleted** | BOOLEAN | YES | FALSE | Soft delete flag |
| **deleted_at** | TIMESTAMPTZ | YES | NULL | Soft delete timestamp |
| **version** | INTEGER | YES | 1 | Optimistic locking |
| **created_at** | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| **updated_at** | TIMESTAMPTZ | YES | NOW() | Last update timestamp |

### Indexes

```sql
✅ PRIMARY KEY: id
✅ UNIQUE: slug
✅ UNIQUE: domain
✅ idx_tenants_slug ON (slug)
✅ idx_tenants_active ON (is_active) WHERE is_deleted = FALSE
```

### Constraints

```sql
✅ UNIQUE(slug)
✅ UNIQUE(domain)
```

### Triggers

```sql
✅ trg_tenants_touch BEFORE UPDATE
   → app.touch_row() -- Auto-update updated_at, version++
```

### RLS (Row Level Security)

```sql
❌ RLS Disabled (Tenant table doesn't need RLS)
```

### Seed Data

```sql
✅ Tenant ID 1: HZM Organization (hzm-org)
```

---

## 2️⃣ core.users

**Durum**: ✅ OLUŞTURULDU  
**Migration**: 001_initial_schema.sql  
**Açıklama**: Kullanıcılar (multi-tenant)

### Kolonlar

| Kolon | Tip | Null | Default | Açıklama |
|-------|-----|------|---------|----------|
| **id** | SERIAL | NO | AUTO | Primary Key |
| **tenant_id** | INTEGER | NO | - | Foreign Key → core.tenants(id) |
| **email** | VARCHAR(255) | NO | - | User email |
| **password_hash** | VARCHAR(255) | NO | - | Bcrypt hashed password |
| **role** | VARCHAR(50) | YES | 'user' | User role (admin, user, etc.) |
| **is_active** | BOOLEAN | YES | TRUE | Active status |
| **is_deleted** | BOOLEAN | YES | FALSE | Soft delete flag |
| **deleted_at** | TIMESTAMPTZ | YES | NULL | Soft delete timestamp |
| **version** | INTEGER | YES | 1 | Optimistic locking |
| **created_at** | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| **updated_at** | TIMESTAMPTZ | YES | NOW() | Last update timestamp |

### Indexes

```sql
✅ PRIMARY KEY: id
✅ idx_users_tenant ON (tenant_id)
✅ idx_users_email ON (email)
✅ idx_users_active ON (is_active) WHERE is_deleted = FALSE
```

### Constraints

```sql
✅ FOREIGN KEY: tenant_id → core.tenants(id)
✅ UNIQUE(tenant_id, email) -- Aynı tenant'ta email unique
```

### Triggers

```sql
✅ trg_users_touch BEFORE UPDATE
   → app.touch_row() -- Auto-update updated_at, version++
```

### RLS (Row Level Security)

```sql
✅ RLS ENABLED
✅ Policy: users_tenant_isolation
   → USING (tenant_id = app.current_tenant())
   → Users can only see their own tenant's users
```

### Seed Data

```sql
✅ User: ozgurhzm@gmail.com
   Tenant: 1 (HZM Organization)
   Role: admin
   Password: 135427 (bcrypt hashed)
```

---

## 🚀 GELECEKTEKİ TABLOLAR (Roadmap)

### Phase 1: Auth System (BEKLEMEDE)

```
❌ core.user_sessions       -- JWT session management
❌ core.user_2fa            -- 2FA settings (TOTP)
❌ core.api_keys            -- API key management
```

### Phase 2: Projects & Generic Data (🔥 DEVAM EDİYOR)

```
❌ core.projects            -- User projects
❌ core.table_metadata      -- User table definitions (+ field types)
❌ app.generic_data         -- ⭐ Dynamic user data (JSONB)
❌ core.sequences           -- 🆕 Sıra no/Barkod sistemi (FTR-2025-00001)
❌ core.companies           -- 🆕 Tenant-level shared firms (multi-project)
❌ core.contacts            -- 🆕 Tenant-level shared contacts
❌ core.products            -- 🆕 Tenant-level shared products
❌ core.project_entities    -- 🆕 Project-Entity linking (ABC Ltd → 3 projede)
```

**🆕 YENİ ÖZELLİKLER:**
- 🔗 Shared Entities: ABC Ltd. birden fazla projede kullanılabilir
- 🎯 Project Context: Her proje kendi firma/kişi/ürün listesini görür
- 🔍 Duplicate Detection: "ABC Ltd" vs "ABC LTD" benzerlik uyarısı
- 📥 Import/Export: Excel/CSV içe/dışa aktarım (10,000 satır)
- 🧮 Calculated Fields: toplam = miktar * fiyat (formula engine)
- 🗑️ Bulk Operations: 100+ kayıt toplu silme/güncelleme
- 👁️ Conditional Visibility: Tip=Şirket ise Vergi No görünsün
- 🔗 Cascade Operations: Firma silindiğinde personeller ne olsun?
- 🔍 Advanced Filters: Karmaşık query builder + saved filters

### Phase 3: Security & Templates (BEKLEMEDE)

```
❌ core.organizations       -- Organization management
❌ core.roles               -- Role definitions
❌ core.permissions         -- Permission definitions
❌ core.role_permissions    -- Role-Permission mapping
❌ core.user_roles          -- User-Role assignments
❌ core.project_templates   -- 🆕 Hazır şablonlar (E-Ticaret, CRM, Lojistik)
```

**🆕 YENİ ÖZELLİKLER:**
- 🔐 Field-Level Permissions: HR "Maaş" göremesin
- 📦 Template System: 1 tıkla 5 tablo oluştur (E-Ticaret Paketi)
- 🎨 5 Hazır Paket: E-Ticaret, CRM, Lojistik, Üretim, HR

### Phase 4: Infrastructure & Audit (BEKLEMEDE)

```
❌ core.files               -- File storage metadata
❌ core.image_variants      -- Image size variants
❌ core.field_history       -- 🆕 Alan bazlı değişiklik geçmişi (Audit Trail)
❌ ops.audit_logs           -- Full audit trail
❌ ops.system_logs          -- System error logs
❌ ops.user_activities      -- User activity tracking
```

**🆕 YENİ ÖZELLİKLER:**
- 📜 Version History: "Kim bu fiyatı değiştirdi?" + Timeline
- 🕐 Field-Level Audit: Her alan için değişiklik geçmişi
- ⏪ Rollback: Eski değere tek tıkla geri dönüş

### Phase 5: Configuration (BEKLEMEDE)

```
❌ cfg.languages            -- Supported languages
❌ cfg.currencies           -- Currency definitions
❌ cfg.exchange_rates       -- Currency exchange rates
❌ cfg.translations         -- i18n translations
```

### Phase 5: Communications (BEKLEMEDE)

```
❌ comms.notifications      -- In-app notifications
❌ comms.email_templates    -- Email templates
❌ comms.email_logs         -- Email send history
```

### Phase 6: Billing (BEKLEMEDE)

```
❌ billing.subscriptions    -- Subscription management
❌ billing.invoices         -- Invoice records
❌ billing.payments         -- Payment history
```

---

## 📝 NOTLAR

### Railway UI'da Neden Görünmüyor?

```
Railway Dashboard sadece `public` schema'sını otomatik gösterir.
Bizim tablolar `core` schema'sında olduğu için UI'da görünmüyor.

✅ ÇÖZÜM 1: Railway → Connect → SQL Query
   \dt core.*;
   SELECT * FROM core.users;

✅ ÇÖZÜM 2: Backend API Debug Endpoint
   GET /api/v1/debug/tables
   GET /api/v1/debug/users
```

### Tablo Doğrulama

```bash
# Railway Shell'den
psql $DATABASE_URL

# Schemas
\dn

# Tables in core schema
\dt core.*

# Table structure
\d core.users

# Data
SELECT * FROM core.users;
```

---

## ✅ CHECKLIST

### Phase 0: Foundation (TAMAMLANDI)
- [x] PostgreSQL + Extensions
- [x] Schemas (app, core, cfg, ops)
- [x] Helper functions (4 adet)
- [x] core.tenants table
- [x] core.users table
- [x] RLS policies
- [x] Triggers
- [x] Indexes
- [x] Seed data (1 tenant, 1 user)
- [x] Migration tracking

### Phase 1: Auth System (DEVAM EDİYOR)
- [ ] core.user_sessions
- [ ] core.user_2fa
- [ ] core.api_keys
- [ ] POST /auth/logout
- [ ] POST /auth/refresh
- [ ] POST /auth/verify-email
- [ ] POST /auth/forgot-password
- [ ] POST /auth/reset-password
- [ ] Migration: 003_add_auth_system.sql

### Phase 2: Projects & Generic Data (BEKLEMEDE)
- [ ] core.projects
- [ ] core.table_metadata (+ field types: EMAIL, PHONE, DROPDOWN, RELATION)
- [ ] app.generic_data (⭐ EN ÖNEMLİ!)
- [ ] core.sequences (🆕 Sıra no/Barkod: FTR-2025-00001)
- [ ] CRUD endpoints
- [ ] Schema validation + field type validation
- [ ] getNextSequence() service
- [ ] Migration: 003_add_projects.sql, 004_add_generic_data.sql, 005_add_sequences.sql

---

## 🔗 İLGİLİ DOSYALAR

- **Migration Files**: `/HzmVeriTabaniBackend/migrations/`
- **Backend Phase Plan**: `./BACKEND_PHASE_PLAN.md`
- **Database Schema Doc**: `./01-Database-Core/02_Core_Database_Schema.md`
- **RLS Strategy**: `./01-Database-Core/04_RLS_Multi_Tenant_Strategy.md`

---

**Son Güncelleme**: 2025-10-22  
**Güncelleyen**: Cursor AI (Özgür'ün Talebi)  
**Durum**: ✅ Phase 0 Tamamlandı, Phase 1 Başlayacak


