# 🏗️ HZM Backend İnşa Phase Planı

> **Kapsamlı multi-tenant DBaaS backend'ini 10 phase'de sıfırdan production'a taşıma rehberi**

[Ana Sayfa](README.md)

---

## 📋 Executive Summary

**Toplam Phase Sayısı**: **10 Phase**  
**Tahmini Süre**: **6 ay** (2 developer)  
**Kritik Path**: Phase 0 → 1 → 2 → 3 (Minimum Viable Product)

### Öncelik Matrisi

| Phase | Öncelik | Süre | Risk | Bağımlılık | Durum |
|-------|---------|------|------|------------|--------|
| Phase 0: Foundation | P0 🔥 | 1 hafta | Düşük | - | ✅ DONE |
| Phase 1: Core Multi-Tenancy | P0 🔥 | 3 hafta | Yüksek | Phase 0 | ✅ DONE |
| Phase 2: Generic Handler (Week 4) | P0 🔥 | 4 hafta | Yüksek | Phase 1 | ✅ DONE |
| Phase 3: Security & RBAC | P0 🔥 | 2 hafta | Orta | Phase 2 | ⏳ IN PROGRESS |
| Phase 4: Infrastructure | P1 ⚡ | 2 hafta | Orta | Phase 2 | ⏳ PLANNED |
| Phase 5: Business Features | P1 ⚡ | 3 hafta | Orta | Phase 2 | ⏳ PLANNED |
| Phase 6: Advanced Features | P2 📊 | 4 hafta | Orta | Phase 2, 4 | ⏳ PLANNED |
| Phase 7: Communications | P1 ⚡ | 2 hafta | Düşük | Phase 2 | ⏳ PLANNED |
| Phase 8: Observability | P1 ⚡ | 1 hafta | Düşük | Phase 2 | ⏳ PLANNED |
| Phase 9: Production Ready | P0 🔥 | 2 hafta | Yüksek | Tüm phases | ⏳ PLANNED |

**MVP (Minimum Viable Product)**: Phase 0 + 1 + 2 + 3 = **10 hafta**  
**Full Production**: Phase 0-9 = **24 hafta (~6 ay)**

---

## 🎯 Phase Detayları

---

## Phase 0: Foundation (1 hafta) 🔥 P0

> **Hedef**: Sağlam veritabanı temelleri

### 🎯 Deliverables

#### 0.1 PostgreSQL Kurulumu
- [ ] PostgreSQL 14+ kurulumu (local/Docker/Railway)
- [ ] Extensions yükleme:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS citext;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```
- [ ] Connection pooling (PgBouncer/Railway Pooler)

#### 0.2 Schema Organizasyonu
- [ ] Schemas oluşturma:
  ```sql
  CREATE SCHEMA app;      -- helpers, generic_data
  CREATE SCHEMA core;     -- users, tenants, projects
  CREATE SCHEMA cfg;      -- i18n, currency
  CREATE SCHEMA ops;      -- audit, logs
  CREATE SCHEMA comms;    -- notifications, email
  CREATE SCHEMA billing;  -- subscriptions
  ```

#### 0.3 Helper Functions
- [ ] `app.set_context(tenant_id, user_id)` - RLS için
- [ ] `app.current_tenant()` - Context okuma
- [ ] `app.current_user_id()` - Context okuma
- [ ] `app.touch_row()` - updated_at + version trigger
- [ ] `app.soft_delete()` - Soft delete trigger
- [ ] `ops.log_audit()` - Audit log trigger

#### 0.4 Config Tables (i18n)
- [ ] `cfg.languages` - Diller (en, tr, de, fr...)
- [ ] `cfg.currencies` - Para birimleri (USD, EUR, TRY...)
- [ ] `cfg.exchange_rates` - Döviz kurları
- [ ] `cfg.translations` - Çeviriler

#### 0.5 Ops Tables
- [ ] `ops.audit_logs` - Tüm değişikliklerin logu
- [ ] `ops.system_logs` - Sistem hataları
- [ ] `ops.user_activities` - Kullanıcı aktiviteleri

### ✅ Definition of Done
- [x] PostgreSQL çalışıyor
- [x] Tüm schemas oluşturuldu
- [x] Helper functions test edildi
- [x] Config tables seed data ile dolduruldu
- [x] **core.tenants ve core.users oluşturuldu**
- [x] Migration script çalışıyor: `001_initial_schema.sql`

### 📚 İlgili Dokümantasyon
- [01_PostgreSQL_Setup.md](./01-Database-Core/01_PostgreSQL_Setup.md)
- [03_i18n_Tables.md](./01-Database-Core/03_i18n_Tables.md)
- [00_MIGRATION_ORDER.md](./15-Database-Migrations/00_MIGRATION_ORDER.md)

---

## Phase 1: Core Multi-Tenancy (2 hafta) 🔥 P0

> **Hedef**: Tenant izolasyonu + Authentication

### 🎯 Deliverables

#### 1.1 Core Tables (Doğru Sıralama! ⚠️)
- [ ] `core.tenants` - **İLK ÖNCE!**
  - name, slug, domain, branding
  - i18n settings (default_language, timezone)
  - currency settings (default_currency)
  - plan, subscription_status
  - max_projects, max_tables_per_project, max_records
- [ ] `core.users` - **tenants'tan SONRA**
  - tenant_id (FK to tenants)
  - email (citext), password_hash
  - email_verified, phone_verified
  - role (user, admin, tenant_owner, platform_admin)
  - RLS policy: `tenant_id = app.current_tenant()`
- [ ] `core.user_sessions` - **users'tan SONRA**
  - user_id (FK to users)
  - token, device_id, ip_address
  - expires_at
- [ ] `core.user_2fa` - **users'tan SONRA**
  - user_id (FK to users)
  - method (totp, sms, email)
  - secret_encrypted, backup_codes_encrypted
- [ ] `core.api_keys` - **users'tan SONRA**
  - user_id (FK to users)
  - key_hash, permissions, scopes
  - rate_limit_per_minute, rate_limit_per_day

#### 1.2 Authentication API
- [ ] `POST /auth/register` - Yeni kullanıcı kaydı
  - ✅ Response: API key (opak, show once!), API password (show once!)
- [ ] `POST /auth/login` - Email/password login
  - ✅ Response: SADECE key_id + last_four (full key asla dönmez!)
  - ✅ Multi-org support: Organizations list + her org için API key metadata
- [ ] `POST /auth/logout` - Session sonlandırma
- [ ] `POST /auth/refresh` - Token yenileme
  - ✅ Token family tracking + reuse detection
- [ ] `POST /auth/verify-email` - Email doğrulama
- [ ] `POST /auth/forgot-password` - Şifre sıfırlama isteği
- [ ] `POST /auth/reset-password` - Şifre sıfırlama

#### 1.3 RLS Implementation
- [ ] Her istekte `app.set_context(tenant_id, user_id)` çağrısı
- [ ] Middleware: `setSessionContext(req, res, next)`
- [ ] Test: Tenant A, Tenant B'nin verisini görebilir mi?

#### 1.4 API Key System
- [ ] API key generation: Opak format `hzm_live_{keyId}.{random}`
  - ✅ key_id (UUID) + random (32 char)
  - ✅ NO tenant_id or user_id in key (info leak prevention!)
- [ ] 3-layer hashing: prefix + hash + encrypted
- [ ] Middleware: `authenticateAPIKey(req, res, next)`
- [ ] Scope validation: `['projects:read', 'tables:write']`

#### 1.5 HMAC Policy (🆕 Replay Protection)
- [ ] **HMAC Headers**: X-Timestamp, X-Nonce, X-Signature
  - ✅ Frontend → API: Optional (recommended Phase 4+)
  - ✅ Server → Server: REQUIRED (Phase 3+)
  - ✅ Compute → API: REQUIRED (Phase 5)
- [ ] **Canonical Request**: method + path + body_hash + timestamp + nonce
- [ ] **Validation**: 
  - Timestamp within 300s
  - Nonce unique (Redis 5min TTL)
  - HMAC signature valid

#### 1.6 Header Standardization (🆕 Consistency)
- [ ] **Standard Headers**:
  - ✅ X-API-Key (authentication)
  - ✅ X-API-Password (authentication)
  - ✅ X-Tenant-Id (context switching, optional)
  - ✅ X-Timestamp (HMAC, epoch seconds)
  - ✅ X-Nonce (HMAC, random string)
  - ✅ X-Signature (HMAC, hex)

### ✅ Definition of Done
- [x] Tenant oluşturulabiliyor
- [x] User register/login çalışıyor
- [x] JWT token veriliyor ve doğrulanıyor
- [x] RLS aktif ve tenant izolasyonu çalışıyor
- [x] API key ile authentication çalışıyor
- [x] Migration: `002_add_auth_system.sql` (user_sessions, user_2fa, api_keys)

### 📚 İlgili Dokümantasyon
- [02_Core_Database_Schema.md](./01-Database-Core/02_Core_Database_Schema.md)
- [04_RLS_Multi_Tenant_Strategy.md](./01-Database-Core/04_RLS_Multi_Tenant_Strategy.md)
- [01_Security_Auth.md](./03-Security/01_Security_Auth.md)

### 🚨 Kritik Noktalar
- ⚠️ **Sıralama**: `tenants` → `users` → `sessions` (Foreign key dependency!)
- ⚠️ **RLS**: Her tabloda `tenant_id` ve policy
- ⚠️ **Password**: bcrypt/argon2 kullan, plaintext YASAK
- ⚠️ **Token**: JWT secret güvenli, expires_at kontrol et

---

## Phase 2: Generic Handler System (4 hafta) 🔥 P0 ✅ TAMAMLANDI

> **Hedef**: Metadata-driven Generic Handler - Endpoint patlamasının önlenmesi

### 🎉 WEEK 4 COMPLETE (30 Ekim 2025)

**Problem:** 400+ endpoint patlaması riski (her tablo = 5-10 endpoint)  
**Çözüm:** Generic Handler (Supabase-style, metadata-driven API)  
**Sonuç:** Sonsuz tablo, sabit endpoint sayısı

### ✅ Tamamlanan (Week 1-4)

#### Week 1: Metadata Katmanı
- [x] Migration 011: `api_resources`, `api_resource_fields`, `api_policies`
- [x] RegistryService: Metadata okuma servisi
- [x] QueryBuilder: Supabase-style query DSL
- [x] Production deployment: Railway auto-deploy

#### Week 2: Generic Handler
- [x] data.controller.js: Generic CRUD (GET/POST/PUT/DELETE/COUNT)
- [x] Middleware: metrics (request tracking), idempotency (duplicate protection)
- [x] Integration tests: Disabled resources (403), unknown resources (404)
- [x] Production: PASIF mod (is_enabled=false - güvenli)

#### Week 3: Canary Test
- [x] Migration 013: Projects resource enabled
- [x] Migration 011 FIXED: Gerçek tablo kolonları
- [x] Generic Handler: PRODUCTION ACTIVE
- [x] Test: GET /api/v1/data/projects → 200 OK
- [x] Test: GET /api/v1/data/projects/count → 200 OK

#### Week 4: Scale + OpenAPI
- [x] Migration 014: Users resource enabled
- [x] Migration 015: Tenants resource added + enabled
- [x] OpenAPI Generator: Auto-generates Swagger 3.0 docs
- [x] Metrics Dashboard: _health, _metrics endpoints
- [x] Swagger UI: /api/v1/admin/docs
- [x] Test script: 12 test cases (users, projects, tenants)
- [x] **3 Active Resources:** projects, users, tenants

### 🎯 Deliverables (Original + Generic Handler)

#### 2.1 Core Tables
- [ ] `core.projects` - **users'tan SONRA**
  - tenant_id, user_id
  - name, description
  - is_active, max_tables, max_records
- [ ] `core.table_metadata` - **projects'ten SONRA**
  - tenant_id, project_id
  - table_name, schema_definition (JSONB)
  - indexes_definition (JSONB)
  - is_active
- [ ] `app.generic_data` - **table_metadata'dan SONRA** ⭐ **EN ÖNEMLİ!**
  - tenant_id, project_id, table_id
  - **data JSONB** ← Tüm user data burada!
  - search_text (GENERATED for full-text search)
  - Indexes: (tenant_id, project_id, table_id), GIN on data, GIN on search_text

#### 2.2 Dynamic API (Auto-generated)
- [ ] `POST /api/v1/projects` - Proje oluştur
- [ ] `GET /api/v1/projects/:project_id/tables` - Tablolar listele
- [ ] `POST /api/v1/projects/:project_id/tables` - Tablo metadata oluştur
- [ ] `POST /api/v1/projects/:project_id/tables/:table_id/records` - Record oluştur (generic_data'ya INSERT)
- [ ] `GET /api/v1/projects/:project_id/tables/:table_id/records` - Records listele
- [ ] `GET /api/v1/projects/:project_id/tables/:table_id/records/:id` - Record detay
- [ ] `PUT /api/v1/projects/:project_id/tables/:table_id/records/:id` - Record güncelle
- [ ] `DELETE /api/v1/projects/:project_id/tables/:table_id/records/:id` - Record sil (soft delete)

#### 2.3 JSONB Query Engine
- [ ] Filter: `data->>'field' = 'value'`
- [ ] Range: `(data->>'price')::numeric BETWEEN 10 AND 100`
- [ ] Array contains: `data->'tags' ? 'featured'`
- [ ] Full-text search: `search_text @@ plainto_tsquery('laptop')`
- [ ] Sorting: `ORDER BY data->>'created_at' DESC`
- [ ] Pagination: Cursor-based (HMAC-signed)
  - ✅ **Cursor Security** (🆕):
    - Allowed fields: ONLY id, created_at, tenant_id, user_id
    - ❌ PII fields FORBIDDEN (email, name, phone)
    - ✅ Tenant/user binding (mismatch check)
    - ✅ Expiry: 1 hour
    - ✅ HMAC-signed with secret

#### 2.4 Schema Validation
- [ ] Node.js validation middleware
- [ ] Field types: string, number, boolean, date, array, object
- [ ] Required fields validation
- [ ] Custom validation rules
- [ ] Error handling: 400 Bad Request

#### 2.5 Field Types & Validation (🆕 Data Integrity)
- [ ] **Extended Field Types** in `table_metadata.schema_definition`:
  ```json
  {
    "fields": [
      {"name": "email", "type": "EMAIL", "required": true, "unique": true},
      {"name": "phone", "type": "PHONE", "format": "+90 (5##) ### ## ##"},
      {"name": "tax_number", "type": "TAX_NUMBER", "length": 10},
      {"name": "age", "type": "NUMBER", "min": 0, "max": 150},
      {"name": "department", "type": "DROPDOWN", "options": ["IT", "HR", "Finance"]},
      {"name": "company", "type": "RELATION", "target_table": "companies"},
      {"name": "birth_date", "type": "DATE", "min": "1900-01-01"},
      {"name": "website", "type": "URL"},
      {"name": "description", "type": "TEXTAREA", "maxLength": 5000}
    ]
  }
  ```
- [ ] **Frontend Components**:
  - EmailInput (@ validation)
  - PhoneInput (format mask)
  - NumberInput (min/max)
  - DropdownInput (predefined options)
  - RelationInput (dropdown from other table)
  - DateInput (date picker)
  - URLInput (URL validation)
- [ ] **Backend Validation** (Zod schema):
  - Type checking per field
  - Format validation (regex)
  - Range validation (min/max)
  - Relation validation (FK exists)
  - Custom error messages
- [ ] **Smart Warnings** (AI-powered):
  - "ABC Ltd. firma adı gibi, Firmalar tablosuna mı?"
  - "Ahmet Yılmaz kişi adı gibi, Kullanıcılar'a mı?"

#### 2.6 Sequence/Barkod Sistemi (🆕 Auto-numbering)
- [ ] **core.sequences** tablosu:
  ```sql
  CREATE TABLE core.sequences (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'invoice', 'cargo', 'receipt'
    prefix VARCHAR(20),                -- 'FTR', 'KRG', 'FIS'
    current_value BIGINT DEFAULT 0,
    format_pattern VARCHAR(100),       -- '{prefix}-{year}-{seq:5}'
    reset_period VARCHAR(20),          -- 'yearly', 'monthly', 'never'
    last_reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, entity_type)
  );
  ```
- [ ] **Pattern Variables**:
  - `{prefix}` → Önek (FTR, KRG)
  - `{year}` → Yıl (2025)
  - `{year:2}` → Kısa yıl (25)
  - `{month}` → Ay (01-12)
  - `{seq}` → Sıra no (1, 2, 3...)
  - `{seq:5}` → 5 haneli (00001, 00002)
  - `{tenant}` → Tenant ID
  - `{random:13}` → Random (8901234567890)
- [ ] **Backend Service** (`services/sequence.js`):
  - `getNextSequence(tenantId, entityType)` → String
  - `formatSequence(pattern, variables)` → String
  - `shouldReset(sequence)` → Boolean
  - Thread-safe (FOR UPDATE lock)
- [ ] **Default Sequences** (seed data):
  - invoice: `FTR-{year}-{seq:5}` (yearly reset)
  - cargo: `KRG{year:2}{seq:6}` (yearly reset)
  - receipt: `FIS-{year}{month}-{seq:4}` (monthly reset)
  - order: `SIP-{seq:8}` (never reset)
  - customer: `MST-{seq:6}` (never reset)
  - product: `URN-{seq:8}` (never reset)
  - barcode: `{random:13}` (EAN-13)
- [ ] **Frontend Integration**:
  - Auto-generate sequence on create
  - Display in read-only input
  - Refresh button (optional)
- [ ] **Admin Panel** (Phase 3):
  - Sequence management UI
  - Edit format pattern
  - Manual reset
  - Current value display

### ✅ Definition of Done
- [ ] Project oluşturulabiliyor
- [ ] Table metadata kaydediliyor
- [ ] Record CRUD çalışıyor (generic_data tablosunda)
- [ ] JSONB sorguları performanslı çalışıyor
- [ ] 1000 record ile <100ms response time
- [ ] Hiçbir kullanıcı/proje için **yeni fiziksel tablo oluşturulmuyor** ✅
- [ ] **Field Types**: EMAIL, PHONE, DROPDOWN, RELATION çalışıyor
- [ ] **Validation**: Backend + Frontend tip kontrolü
- [ ] **Sequences**: Fatura/Kargo/Fiş otomatik sıra no üretimi
- [ ] **Cursor Security**: PII fields FORBIDDEN, tenant/user bound, 1h expiry ✅
- [ ] **core.sequences** tablosu oluşturuldu
- [ ] `getNextSequence()` fonksiyonu çalışıyor
- [ ] Migration: `003_add_projects.sql`, `004_add_generic_data.sql`, `005_add_sequences.sql`

### 📚 İlgili Dokümantasyon

#### Generic Handler (Week 4 - NEW!)
- [18-Modular-Smart-Strategy/README.md](./18-Modular-Smart-Strategy/README.md) ⚡ **KRİTİK**
  - 4 haftalık implementation planı ve sonuçlar
  - Yeni sistem kuralı (migration-only approach)
  - 10 maddelik kritik bilgiler (resource ekleme, test, debug)
  - Eski vs Yeni karşılaştırma (%92 hız, %95 kod tasarrufu)
- [18-Modular-Smart-Strategy/01_Current_State_Analysis.md](./18-Modular-Smart-Strategy/01_Current_State_Analysis.md)
- [18-Modular-Smart-Strategy/02_Hybrid_Architecture_Plan.md](./18-Modular-Smart-Strategy/02_Hybrid_Architecture_Plan.md)
- [18-Modular-Smart-Strategy/03_Real_Migration_Plan.md](./18-Modular-Smart-Strategy/03_Real_Migration_Plan.md)

#### Original Phase 2 (Generic Table Pattern - Future Work)
- [02_Core_Database_Schema.md](./01-Database-Core/02_Core_Database_Schema.md) (Section 5: app.generic_data)
- [01_GENERIC_TABLE_PATTERN.md](./09-Oneriler/01_GENERIC_TABLE_PATTERN.md)
- [02_TABLO_OLUSTURMA_NASIL_CALISIR.md](./09-Oneriler/02_TABLO_OLUSTURMA_NASIL_CALISIR.md)

#### 2.7 Shared Entities & Project Context (🆕 Multi-Project Support)
- [ ] **core.companies** (Tenant-level shared):
  ```sql
  CREATE TABLE core.companies (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [ ] **core.contacts** (Tenant-level shared - kişiler)
- [ ] **core.products** (Tenant-level shared - ürünler)
- [ ] **core.project_entities** (Proje-Entity linking):
  ```sql
  CREATE TABLE core.project_entities (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'company', 'contact', 'product'
    entity_id INTEGER NOT NULL,
    role VARCHAR(50),                   -- 'customer', 'supplier', 'carrier'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, entity_type, entity_id)
  );
  ```
- [ ] **Backend Service** (`services/shared-entities.js`):
  - `getProjectEntities(projectId, entityType, role)` → Proje için entity listesi
  - `addEntityToProject(projectId, entityType, entityId, role)` → Entity'yi projeye ekle
  - `removeEntityFromProject(projectId, entityType, entityId)` → Projeden çıkar
  - `getEntityProjects(entityType, entityId)` → Entity hangi projelerde?
- [ ] **Frontend Integration**:
  - "Mevcut Firmadan Seç" butonu
  - Proje bazlı filtreleme
  - Cross-project entity usage indicator
  - "Bu firma 3 projede kullanılıyor" badge

#### 2.8 Duplicate Detection (🆕 Smart Data Entry)
- [ ] **Similarity Engine** (`utils/similarity.js`):
  - Levenshtein distance algorithm
  - Fuzzy string matching
  - Email/Phone normalization
  - Threshold scoring (>85% = duplicate warning)
- [ ] **API Endpoint**:
  - `POST /api/v1/detect-duplicates` → Similar records
  - Real-time detection on form input
- [ ] **Frontend UI**:
  - Warning dialog with similar records
  - "Bu kaydı kullan" or "Yoksay" options
  - Similarity percentage display
- [ ] **Configuration**:
  - Per-table duplicate detection rules
  - Customizable similarity threshold
  - Field-level duplicate checks

#### 2.9 Import/Export System (🆕 Data Migration)
- [ ] **Import Engine** (`services/import.js`):
  - Excel/CSV parser (XLSX.js, Papa Parse)
  - Column mapping (auto-detect + manual)
  - Validation before import (field type checks)
  - Batch insert (1000 rows per batch)
  - Progress tracking (websocket)
  - Error report generation
  - Duplicate detection during import
- [ ] **Export Engine** (`services/export.js`):
  - Excel export (XLSX format)
  - CSV export
  - PDF export (with template)
  - Filtered export (current view)
- [ ] **API Endpoints**:
  - `POST /api/v1/import/preview` → Column mapping & validation
  - `POST /api/v1/import/execute` → Execute import
  - `GET /api/v1/export/:format` → Download export
- [ ] **Frontend UI**:
  - Drag & drop file upload
  - Column mapping interface
  - Preview first 5 rows
  - Validation results (✅ valid, ⚠️ fixable, ❌ invalid)
  - Progress bar during import

#### 2.10 Calculated Fields (🆕 Formula Engine)
- [ ] **Formula Parser** in `table_metadata.schema_definition`:
  ```json
  {
    "name": "toplam",
    "type": "CALCULATED",
    "formula": "miktar * fiyat",
    "dependencies": ["miktar", "fiyat"]
  }
  ```
- [ ] **Supported Functions**:
  - Math: `+, -, *, /, %, ROUND, CEIL, FLOOR, ABS, SQRT, POW`
  - Date: `TODAY, YEAR, MONTH, DAY, DAYS, DATEDIFF, ADDDAYS`
  - String: `CONCAT, UPPER, LOWER, LEFT, RIGHT, LEN, TRIM`
  - Logic: `IF, AND, OR, NOT, SWITCH`
  - Lookup: `VLOOKUP(table, field, value)`
- [ ] **Backend Calculation**:
  - Calculate on read (dynamic)
  - OR: Calculate on write (stored in JSONB)
  - Formula validation on table creation
  - Circular dependency detection
- [ ] **Frontend Display**:
  - Read-only calculated fields
  - Auto-update when dependencies change
  - Formula editor with syntax highlighting

#### 2.11 Advanced Features (🆕 Power User Tools)
- [ ] **Bulk Operations**:
  - Multi-select UI (checkbox per row)
  - Bulk delete (with confirmation)
  - Bulk update field (value or formula)
  - Bulk export (selected rows)
  - Batch API endpoint (transaction-safe)
  - Progress indicator
  - Rollback on error
- [ ] **Conditional Visibility**:
  - `visible_when` in field definition
  - `required_when` in field definition
  - Frontend dynamic show/hide
  - Backend conditional validation
- [ ] **Cascade Operations**:
  - `on_delete` rules in relations: CASCADE, SET_NULL, RESTRICT, SET_DEFAULT
  - Warning dialog before cascade delete
  - Preview affected records
- [ ] **Advanced Filters**:
  - Query builder UI (AND/OR conditions)
  - Operators: equals, not equals, contains, starts with, ends with, between, in, is null
  - Saved filters per user
  - Filter sharing
  - Export current filter results

### ✅ Definition of Done (Generic Handler - Week 4)

#### Metadata & Core (Week 1)
- [x] **Migration 011:** api_resources, api_resource_fields, api_policies tabloları oluşturuldu
- [x] **Migration 012:** table_metadata, generic_data tabloları (PASIF - future use)
- [x] **RegistryService:** Metadata okuma çalışıyor
- [x] **QueryBuilder:** Supabase-style filters (eq, gt, like, etc.)
- [x] **Production:** Railway deployed, 5/5 test PASS

#### Generic CRUD (Week 2)
- [x] **data.controller.js:** GET/POST/PUT/DELETE/COUNT operations
- [x] **Middleware:** metrics (request tracking), idempotency (duplicate protection)
- [x] **RLS:** tenant_id filtering active
- [x] **Security:** is_enabled=false kontrolü (403 error)
- [x] **Tests:** Integration tests (403, 404, auth, idempotency)

#### Production Active (Week 3)
- [x] **Projects resource:** is_enabled=true (first canary)
- [x] **GET /api/v1/data/projects:** 200 OK, pagination working
- [x] **GET /api/v1/data/projects/count:** 200 OK
- [x] **Migration cleanup:** Hotfix migrations deleted, clean system
- [x] **Test script:** test-backend.sh created

#### Scale + OpenAPI (Week 4)
- [x] **Users resource:** is_enabled=true (Migration 014)
- [x] **Tenants resource:** Added + enabled (Migration 015)
- [x] **OpenAPI Generator:** Auto-generates Swagger 3.0 spec (14KB JSON)
- [x] **Swagger UI:** Live at /api/v1/admin/docs
- [x] **Metrics Dashboard:** GET /api/v1/data/_metrics, _health
- [x] **3 Active Resources:** projects, users, tenants
- [x] **Test script:** 12 test cases (users, projects, tenants, openapi, metrics)
- [x] **Documentation:** 10-point critical info guide, old vs new comparison

#### Business Impact
- [x] **Endpoint patlaması önlendi:** 53 → 30-40 (sabit kalacak)
- [x] **Yeni tablo maliyeti:** 30 dakika → 5 dakika (%92 hız)
- [x] **Kod tasarrufu:** 280 satır → 15 satır (%95 azalma)
- [x] **Dokümantasyon:** Otomatik (OpenAPI 3.0)
- [x] **Bakım:** %90 azalma (merkezi generic handler)

#### Original Phase 2 Deliverables (PLANNED - Future Work)
- [ ] Project oluşturulabiliyor
- [ ] Table metadata kaydediliyor
- [ ] Record CRUD çalışıyor (generic_data tablosunda)
- [ ] JSONB sorguları performanslı çalışıyor
- [ ] 1000 record ile <100ms response time
- [ ] Hiçbir kullanıcı/proje için **yeni fiziksel tablo oluşturulmuyor** ✅
- [ ] **Field Types**: EMAIL, PHONE, DROPDOWN, RELATION çalışıyor
- [ ] **Validation**: Backend + Frontend tip kontrolü
- [ ] **Sequences**: Fatura/Kargo/Fiş otomatik sıra no üretimi
- [ ] **Shared Entities**: ABC Ltd. birden fazla projede kullanılabiliyor
- [ ] **Project Context**: Proje bazlı filtreleme çalışıyor
- [ ] **Duplicate Detection**: Benzer kayıt uyarısı çalışıyor
- [ ] **Import/Export**: Excel içe/dışa aktarım çalışıyor
- [ ] **Calculated Fields**: Formula engine çalışıyor (toplam = miktar * fiyat)
- [ ] **Bulk Operations**: 100+ kayıt toplu silinebiliyor
- [ ] **Conditional Visibility**: "Tip=Şirket" ise "Vergi No" görünüyor
- [ ] **Cascade Operations**: Firma silindiğinde personeller ne olacağı belirleniyor
- [ ] **Advanced Filters**: Karmaşık filtreler kaydedilip kullanılabiliyor
- [ ] Migration: `003_add_projects.sql`, `004_add_generic_data.sql`, `005_add_sequences.sql`, `006_add_shared_entities.sql`

### 🚨 Kritik Noktalar (Generic Handler - Week 4)

#### Yeni Sistem Kuralı (30 Ekim 2025)
- ❌ **ARTIK YAPMA:** Her yeni tablo için controller/routes/service yazma
- ✅ **YENİ YÖNTEM:** Sadece 1 migration (INSERT INTO api_resources)
- 🎯 **Kazanç:** 30 dakika → 5 dakika (%92 daha hızlı)
- 📊 **Kod:** 280 satır → 15 satır (%95 daha az)
- 📖 **Dokümantasyon:** Otomatik (OpenAPI 3.0 Swagger UI)

#### Güvenlik & Performance
- ⚠️ **Migration Numarası:** ASLA atlama (013 → 015 YASAK!)
- ⚠️ **tenant_id:** Her resource'da ZORUNLU (RLS için)
- ⚠️ **is_deleted:** Soft delete için ÖNERİLİR
- ⚠️ **password_hash:** ASLA readable=true yapma!
- ⚠️ **Index**: GIN index on JSONB fields (generic_data için)

#### Test & Debugging
- 🔴 **503:** Database bağlantısı yok
- 🔴 **404:** Resource api_resources'da yok
- 🔴 **403:** Resource is_enabled=false
- 🔴 **500:** RLS policy hatası, kolon adı yanlış
- 🔴 **401:** API key/password yanlış

#### Deprecation Timeline
- ✅ **Şimdi (Week 4):** Eski + Yeni sistem paralel çalışıyor
- 🔄 **3 ay sonra:** Eski endpoint'lere "deprecated" uyarısı
- ⚠️ **6 ay sonra:** Eski endpoint'ler kaldırılacak (breaking change)

#### Original Phase 2 Critical Points (Future Work)
- ⚠️ **Index**: `data` alanında GIN index zorunlu (JSONB sorguları için)
- ⚠️ **Performance**: 100k+ record'da partition by tenant_id/project_id düşün
- ⚠️ **Validation**: Schema'ya uymayan data DB'ye girmesin
- ⚠️ **Search**: `search_text` GENERATED column + GIN index
- ⚠️ **Shared Entities**: ABC Ltd. birden fazla projede olabilir, proje bazlı filtrele!
- ⚠️ **Duplicate Detection**: Threshold %85+ uyarı, %95+ error
- ⚠️ **Import**: Batch size 1000, progress tracking, rollback on error
- ⚠️ **Calculated Fields**: Circular dependency kontrolü!

---

## Phase 3: Security & RBAC (2 hafta) 🔥 P0

> **Hedef**: Rol tabanlı yetkilendirme

### 🎯 Deliverables

#### 3.1 Organizations
- [ ] `core.organizations` - **users'tan SONRA**
  - tenant_id, owner_id
  - name, settings
  - max_members

#### 3.2 RBAC Tables
- [ ] `core.roles` - Roller (admin, editor, viewer)
- [ ] `core.permissions` - İzinler (projects:read, tables:write)
- [ ] `core.role_permissions` - Role-Permission mapping
- [ ] `core.user_roles` - User-Role mapping
- [ ] `core.organization_members` - Org membership

#### 3.3 Permission Middleware
- [ ] `checkPermission(resource, action)`
- [ ] `hasRole(role_name)`
- [ ] `isTenantOwner()`
- [ ] `isPlatformAdmin()`

#### 3.3.1 Scopes & Permissions System (🆕 Granular Access)
- [ ] **Scope Format**: `resource:action` pattern
  - ✅ Examples: `projects:read`, `users:write`, `admin:all`
- [ ] **Resource Scope Matrix**:
  - projects → `projects:read`, `projects:write` (user, admin, master)
  - users → `users:read`, `users:write` (admin, master only)
  - api_keys → `keys:read`, `keys:write` (master only)
  - audit_logs → `audit:read` (admin, master)
- [ ] **Scope Enforcement**:
  - Extract scopes from `core.api_keys.scopes`
  - Check if required scope exists
  - If missing → `403 Forbidden`
- [ ] **Phase**: Scope system Phase 3

#### 3.4 Permission Check API
- [ ] `GET /api/v1/permissions/me` - Mevcut kullanıcı izinleri
- [ ] `POST /api/v1/organizations/:org_id/members` - Üye ekle
- [ ] `PUT /api/v1/organizations/:org_id/members/:user_id/role` - Rol değiştir

#### 3.4.1 Admin Endpoint Security (🆕 High-Risk Operations)
- [ ] **`GET /admin?type={type}` Security Requirements**:
  - ✅ **MFA**: REQUIRED for all admin operations
  - ✅ **IP Allowlist**: REQUIRED (defined in tenant settings)
  - ✅ **Rate Limit**: 10/minute per user, 5/minute per IP
  - ✅ **PII Masking**: AUTO (password_hash, api_key_hash → [REDACTED])
  - ✅ **Pagination**: REQUIRED (max 100 per page, cursor-based)
  - ✅ **Audit**: All admin operations logged to ops.audit_events
- [ ] **Masked Fields** (AUTO):
  - password_hash → `[REDACTED]`
  - api_password_hash → `[REDACTED]`
  - api_key_hash → `[REDACTED]`
  - refresh_token → `[REDACTED]`

#### 3.5 Field-Level Permissions (🆕 Granular Access Control)
- [ ] **Field Permissions** in `table_metadata.schema_definition`:
  ```json
  {
    "name": "maas",
    "type": "NUMBER",
    "permissions": [
      {"role": "admin", "read": true, "write": true},
      {"role": "muhasebe", "read": true, "write": true},
      {"role": "hr", "read": false, "write": false},
      {"role": "satis", "read": false, "write": false}
    ]
  }
  ```
- [ ] **Backend Middleware**:
  - `filterFieldsByPermission(data, userRole)` → Remove forbidden fields
  - `validateFieldPermissions(data, userRole)` → Block forbidden writes
- [ ] **Frontend UI**:
  - Hide forbidden fields
  - Show `🔒 Görme yetkiniz yok` for restricted fields
  - Disable editing for read-only fields
- [ ] **API Response**:
  - Filter fields based on user role
  - Return partial data (only permitted fields)

#### 3.6 Template System (🆕 Quick Start Templates)
- [ ] **core.project_templates** Table:
  ```sql
  CREATE TABLE core.project_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),  -- 'E-Ticaret', 'CRM', 'Lojistik'
    icon VARCHAR(50),
    tables JSONB NOT NULL,  -- Array of table definitions
    is_public BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [ ] **Built-in Templates**:
  - 📦 **E-Ticaret Paketi** (5 tablo): Müşteriler, Ürünler, Kategoriler, Siparişler, Sipariş Kalemleri
  - 🏢 **CRM Paketi** (4 tablo): Firmalar, Kişiler, Fırsatlar, Aktiviteler
  - 📦 **Lojistik Paketi** (6 tablo): Kargolar, Depolar, Ürünler, Stok Hareketleri, Sevkiyatlar, Faturalar
  - 🏭 **Üretim Paketi** (5 tablo): Ürünler, Hammaddeler, Üretim Emirleri, Kalite Kontrol, Stok
  - 💼 **HR Paketi** (4 tablo): Personeller, Departmanlar, İzinler, Performans
- [ ] **API Endpoints**:
  - `GET /api/v1/templates` → List all templates
  - `GET /api/v1/templates/:id` → Template details
  - `POST /api/v1/templates/:id/apply` → Create project from template
- [ ] **Frontend UI**:
  - Template gallery with preview
  - Template search and filter
  - One-click project creation
  - Preview tables and relations before creation

### ✅ Definition of Done
- [x] Organization oluşturulabiliyor
- [x] Roller ve izinler tanımlanabiliyor
- [x] User'a rol atanabiliyor
- [x] Permission middleware çalışıyor
- [x] Yetkisiz istekler 403 dönüyor
- [ ] **Field-Level Permissions**: HR "Maaş" alanını göremiyor
- [ ] **Template System**: "E-Ticaret Paketi" seçilerek 5 tablo otomatik oluşturuluyor
- [ ] **Built-in Templates**: 5 hazır paket var
- [x] Migration: `005_add_organizations.sql`, `006_add_rbac.sql`
- [ ] Migration: `007_add_field_permissions.sql`, `008_add_templates.sql`

### 📚 İlgili Dokümantasyon
- [02_RBAC_System.md](./03-Security/02_RBAC_System.md)
- [03_Organizations.md](./03-Security/03_Organizations.md)

---

## Phase 4: Infrastructure (2 hafta) ⚡ P1

> **Hedef**: Redis + Job Queue + File Storage

### 🎯 Deliverables

#### 4.1 Redis Setup
- [ ] Redis kurulumu (local/Railway/Upstash)
- [ ] Connection management: `ioredis`
- [ ] Namespaces: `app:{env}:{tenant}:{feature}:{key}`
- [ ] TTL stratejisi: cache 60s, rate limit 15m, widget state 24h
- [ ] Eviction policy: `allkeys-lru`

#### 4.2 Cache Layer
- [ ] Generic cache helper: `cache.get(key)`, `cache.set(key, value, ttl)`
- [ ] Cache middleware: `cacheMiddleware(ttl)`
- [ ] Invalidation: Tenant-wide flush
- [ ] Hit rate monitoring

#### 4.3 Rate Limiting
- [ ] Per-tenant rate limit: 1000 req/min
- [ ] Per-API-key rate limit: Custom limits
- [ ] Middleware: `rateLimitMiddleware()`
- [ ] Response: 429 Too Many Requests + Retry-After header

#### 4.4 Job Queue (BullMQ)
- [ ] Queue setup: `ai`, `email`, `webhook`, `report`
- [ ] Job processor: `processJob(job)`
- [ ] Retry strategy: Exponential backoff (1s, 5s, 30s, 5m)
- [ ] Dead letter queue
- [ ] Job status API: `GET /api/v1/jobs/:job_id`

#### 4.5 File Storage
- [ ] `core.files` tablosu - **users'tan SONRA**
- [ ] `core.image_variants` tablosu - **files'tan SONRA**
- [ ] Upload API: `POST /api/v1/files/upload`
- [ ] S3/Cloudflare R2 integration
- [ ] Image processing: Sharp (resize, crop, webp conversion)
- [ ] Virus scan: ClamAV/VirusTotal
- [ ] Signed URLs: `GET /api/v1/files/:file_id/signed-url`

#### 4.5.1 API Key Audit Fields (🆕 Enhanced Tracking)
- [ ] **Extend `core.api_keys` table**:
  - ✅ `label TEXT` - Display name: "Production Server", "CI/CD Pipeline"
  - ✅ `created_by INTEGER` - FK to users (who created this key)
  - ✅ `rotated_from_key_id UUID` - FK to api_keys (rotation history)
  - ✅ `CREATE INDEX idx_api_keys_rotated_from ON core.api_keys(rotated_from_key_id)`
- [ ] **Benefits**:
  - Better key management UI
  - Rotation audit trail
  - Multi-key per user support

#### 4.6 Version History (🆕 Field-Level Audit Trail)
- [ ] **core.field_history** Table:
  ```sql
  CREATE TABLE core.field_history (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    table_type VARCHAR(50) NOT NULL,    -- 'companies', 'contacts', 'generic_data'
    record_id INTEGER NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER NOT NULL,        -- user_id
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_type VARCHAR(20) DEFAULT 'update'  -- 'create', 'update', 'delete'
  );
  CREATE INDEX idx_field_history_record ON core.field_history(table_type, record_id);
  CREATE INDEX idx_field_history_date ON core.field_history(changed_at);
  ```
- [ ] **Automatic Tracking**:
  - Middleware to capture all UPDATE operations
  - Compare old vs new values
  - Store only changed fields
  - Capture user_id from JWT
- [ ] **API Endpoints**:
  - `GET /api/v1/history/:table/:record_id` → Get full history for record
  - `GET /api/v1/history/:table/:record_id/:field` → Get field-specific history
  - `POST /api/v1/history/:table/:record_id/:field/rollback` → Rollback to previous value
- [ ] **Frontend UI**:
  - "Geçmiş" button on each field
  - Timeline view of changes
  - User who made the change
  - "Geri Al" button for each change
  - Diff view (old → new)
- [ ] **Performance Optimization**:
  - Partition by month (for large-scale audit logs)
  - Archive old history (>1 year) to cold storage
  - Compression for `old_value` and `new_value` TEXT fields

### ✅ Definition of Done
- [x] Redis bağlantısı çalışıyor
- [x] Cache middleware aktif
- [x] Rate limiting 429 dönüyor
  - [ ] **Per Endpoint Limits** (🆕 Detailed):
    - /auth/register: 5/hour per IP
    - /auth/login: 10/min per user, 100/min per tenant, 50/min per IP
    - /data/* (READ): 60/min per user, 300/min per tenant
    - /data/* (WRITE): 30/min per user, 150/min per tenant
    - /admin: 10/min per user, 5/min per IP
    - /compute: 100/min per user, 1000/min per tenant
- [x] Job kuyruğu çalışıyor ve retry yapıyor
- [x] File upload S3'e gidiyor
- [x] Image processing çalışıyor
- [ ] **API Key Audit**: label, created_by, rotated_from_key_id fields added ✅
- [ ] **Version History**: "Kim bu fiyatı değiştirdi?" sorusu cevaplanabiliyor
- [ ] **Field Rollback**: Eski değere geri dönülebiliyor
- [ ] **Audit Trail**: Tüm değişiklikler loglanıyor
- [x] Migration: `007_add_file_storage.sql`
- [ ] Migration: `009_add_field_history.sql`, `010_add_api_key_audit.sql`

### 📚 İlgili Dokümantasyon
- [02_Redis_Architecture.md](./04-Infrastructure/02_Redis_Architecture.md)
- [03_Job_Queue_System.md](./04-Infrastructure/03_Job_Queue_System.md)
- [05_File_Storage.md](./04-Infrastructure/05_File_Storage.md)

---

## Phase 5: Business Features (3 hafta) ⚡ P1

> **Hedef**: Template System + Business Logic

### 🎯 Deliverables

#### 5.1 Template System
- [ ] Template JSON format standardize et
- [ ] Templates storage: `templates/` folder or DB
- [ ] Template categories: e-commerce, ride-sharing, mlm, logistics, ai, crm
- [ ] Template installation API: `POST /api/v1/templates/:template_id/install`
  - Project oluştur
  - Table metadata'ları oluştur
  - Seed data ekle (optional)
  - Webhooks setup (optional)

#### 5.2 Business Logic Modules
- [ ] Stock Management (inventory tracking)
- [ ] Pricing Engine (dynamic pricing, discounts)
- [ ] Commission Calculator (MLM için)
- [ ] Route Optimizer (logistics için)
- [ ] Booking System (ride-sharing için)

#### 5.3 Custom Endpoints & Compute Engine
- [ ] Hybrid API builder:
  - Custom endpoints: `/api/v1/custom/:endpoint_name`
  - Code injection: JavaScript/TypeScript function
  - Validation & sandboxing
- [ ] **Compute Endpoints** (🆕):
  - `POST /compute/formula` - Formula evaluation
  - `POST /compute/batch` - Batch calculations

#### 5.3.1 Compute Isolation Strategy (🆕 Security-First)
- [ ] **PRIMARY: Separate Process** (child_process)
  - ✅ Crash → API unaffected
  - ✅ CPU/memory limits via OS (cgroups)
  - ✅ Timeout: 5 seconds max
- [ ] **FALLBACK: Worker Thread** (same process)
  - If separate process unavailable
  - Circuit breaker (5 consecutive failures → disable)
- [ ] **NEVER: Same Thread** (RCE risk!)
- [ ] **Circuit Breaker**:
  - 5 consecutive failures → disable compute for 5 minutes
  - Alert admin
  - Audit log failure pattern
- [ ] **Security**:
  - VM2 sandbox (isolated-vm)
  - CPU limit (100ms per formula)
  - Memory limit (10MB)
  - Function whitelist
  - AST analysis (no loops)
  - Max formula length: 500 chars
  - Max variables: 20
  - Max concurrent computations: 10 per tenant

### ✅ Definition of Done
- [x] En az 3 template hazır (e-commerce, mlm, crm)
- [x] Template installation çalışıyor
- [x] 1 business logic modülü production'da (örn: stock management)
- [x] Custom endpoint oluşturulabiliyor
- [ ] **Compute Isolation**: Separate process with circuit breaker çalışıyor ✅
- [ ] **Compute Security**: VM2 sandbox, CPU/memory limits enforced ✅
- [ ] **Circuit Breaker**: 5 failures → 5min disable working ✅

### 📚 İlgili Dokümantasyon
- [01_Template_System.md](./02-Business-Features/01_Template_System.md)
- [02_Business_Logic_Modules.md](./02-Business-Features/02_Business_Logic_Modules.md)
- [02_Custom_API_Builder.md](./05-APIs/02_Custom_API_Builder.md)

---

## Phase 6: Advanced Features (4 hafta) 📊 P2

> **Hedef**: Reports + Widgets + MLM + Math APIs

### 🎯 Deliverables

#### 6.1 Reports & Analytics
- [ ] Materialized views: `mv_project_stats`, `mv_table_stats`
- [ ] Incremental refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- [ ] Dashboard widgets: chart, table, metric, map
- [ ] Export: PDF, Excel, CSV
- [ ] Report API: `POST /api/v1/reports/generate`

#### 6.2 Widget System
- [ ] Widget registry: `core.widget_registry`
- [ ] Widget state: Redis `widget:{id}:state`
- [ ] Widget types: chart, table, metric, map, custom
- [ ] Widget data sources: Generic data, aggregations
- [ ] Frontend integration: React components

#### 6.3 MLM System
- [ ] MLM schema: `mlm.network_members`, `mlm.commissions`
- [ ] Closure table: `mlm.network_tree`
- [ ] Commission calculation: Binary, unilevel, matrix
- [ ] Rank management
- [ ] Genealogy API: `GET /api/v1/mlm/tree/:member_id`

#### 6.4 Math APIs (30+ endpoints)
- [ ] Basic: add, subtract, multiply, divide
- [ ] Advanced: power, sqrt, log, factorial
- [ ] Statistics: mean, median, stddev, variance
- [ ] Financial: compound_interest, loan_payment, npv, irr
- [ ] Scientific: sin, cos, tan, matrix operations

### ✅ Definition of Done
- [x] 5+ materialized view çalışıyor
- [x] Widget system frontend'de render ediliyor
- [x] MLM tree visualization çalışıyor
- [x] Math API'ler dokümante ve çalışıyor
- [x] Migration: `010_add_mlm.sql`

### 📚 İlgili Dokümantasyon
- [03_Reports_Analytics.md](./02-Business-Features/03_Reports_Analytics.md)
- [04_Widget_System.md](./02-Business-Features/04_Widget_System.md)
- [05_MLM_System.md](./02-Business-Features/05_MLM_System.md)
- [01_Math_APIs.md](./05-APIs/01_Math_APIs.md)

---

## Phase 7: Communications (2 hafta) ⚡ P1

> **Hedef**: Notifications + Email + Webhooks

### 🎯 Deliverables

#### 7.1 Notifications
- [ ] `comms.notifications` - **tenants'tan SONRA**
- [ ] Notification types: info, warning, error, success
- [ ] Priority: low, normal, high, urgent
- [ ] Channels: in-app, email, sms, push
- [ ] API: `POST /api/v1/notifications/send`

#### 7.2 Email Queue
- [ ] `comms.email_queue` - **tenants'tan SONRA**
- [ ] Email templates: Handlebars
- [ ] SMTP provider: Nodemailer / SendGrid / AWS SES
- [ ] Queue worker: BullMQ
- [ ] Retry: 3 attempts with backoff
- [ ] Status tracking: pending, sent, failed

#### 7.3 Webhooks
- [ ] `comms.webhooks` - **tenants'tan SONRA**
- [ ] `comms.webhook_deliveries` - **webhooks'tan SONRA**
- [ ] Webhook events: record.created, record.updated, record.deleted
- [ ] HMAC signature: Verify authenticity
- [ ] Retry policy: 5 attempts (1m, 5m, 30m, 2h, 6h)
- [ ] Idempotency: `Idempotency-Key` header
- [ ] Management API: `POST /api/v1/webhooks`

### ✅ Definition of Done
- [x] In-app notification çalışıyor
- [x] Email gönderimi çalışıyor (template ile)
- [x] Webhook registration ve delivery çalışıyor
- [x] HMAC signature doğrulanıyor
- [x] Retry mekanizması test edildi
- [x] Migration: `008_add_notifications.sql`, `009_add_webhooks.sql`

### 📚 İlgili Dokümantasyon
- [01_Notification_System.md](./04-Infrastructure/01_Notification_System.md)
- [09_Webhook_System.md](./04-Infrastructure/09_Webhook_System.md)
- [README.md](./14-Email-Templates/README.md)

---

## Phase 8: Observability (1 hafta) ⚡ P1

> **Hedef**: Monitoring + Logging + Audit UI

### 🎯 Deliverables

#### 8.1 Logging
- [ ] Winston/Pino logger
- [ ] Log levels: error, warn, info, debug
- [ ] Log format: JSON
- [ ] Log enrichment: request_id, tenant_id, user_id
- [ ] Log storage: File + Elasticsearch/Loki

#### 8.2 Metrics
- [ ] Prometheus metrics: `/metrics` endpoint
- [ ] Custom metrics:
  - `http_requests_total{method, status, tenant_id}`
  - `db_query_duration_seconds{operation}`
  - `redis_cache_hit_rate`
  - `job_queue_size{queue_name}`
- [ ] Grafana dashboards

#### 8.3 Health Checks
- [ ] `GET /healthz` - Basic health
- [ ] `GET /readyz` - Readiness probe
- [ ] DB connection check
- [ ] Redis connection check
- [ ] Queue connection check

#### 8.4 Audit Trail UI
- [ ] Audit log API: `GET /api/v1/audit-logs`
- [ ] Filters: date range, entity_type, action, user_id
- [ ] Diff view: old_values vs new_values
- [ ] Export: CSV

### ✅ Definition of Done
- [x] Logs JSON formatında yazılıyor
- [x] Prometheus metrics `/metrics` endpoint'te
- [x] Grafana dashboard kuruldu
- [x] Health checks 200 OK dönüyor
- [x] Audit log UI frontend'de görünüyor
- [x] Migration: `011_add_monitoring.sql` (optional)

### 📚 İlgili Dokümantasyon
- [07_Monitoring_Dashboards.md](./04-Infrastructure/07_Monitoring_Dashboards.md)
- [02_Audit_Trail_UI.md](./07-Advanced-Features/02_Audit_Trail_UI.md)

---

## Phase 9: Production Ready (2 hafta) 🔥 P0

> **Hedef**: Testing + Documentation + Deployment

### 🎯 Deliverables

#### 9.1 Testing
- [ ] Unit tests: Jest, 80%+ coverage
- [ ] Integration tests: Supertest
- [ ] E2E tests: Playwright
- [ ] RLS tests: Tenant izolasyonu
- [ ] Load tests: k6/Artillery (1000+ concurrent users)
- [ ] CI/CD: GitHub Actions

#### 9.2 API Documentation
- [ ] OpenAPI 3.0 spec: `openapi.yaml`
- [ ] Swagger UI: `/api-docs`
- [ ] Postman collection
- [ ] Code examples: curl, JavaScript, Python

#### 9.2.1 Error Response Standardization (🆕 Consistency)
- [ ] **Standard Error Format** (All endpoints):
  ```json
  {
    "error": {
      "code": "AUTH_INVALID_API_KEY",
      "message": "API key is invalid or revoked",
      "details": { "key_id": "01H3K8..." }
    },
    "request_id": "req_abc123",
    "timestamp": "2025-10-23T14:30:00Z"
  }
  ```
- [ ] **Error Code Hierarchy** (30+ codes):
  - AUTH_* (401): Authentication errors
  - AUTHZ_* (403): Authorization errors  
  - VALIDATION_* (400): Input validation
  - RATE_LIMIT_* (429): Rate limiting
  - RESOURCE_* (404/409/410): Resource errors
  - SERVER_* (500/503): Server errors
- [ ] **HTTP Status Mapping**: Consistent error → status code mapping
- [ ] **Client Error Handling**: Documented best practices for each error type
- [ ] **Examples**: 4+ error response examples (auth, authz, validation, rate_limit)

#### 9.3 Deployment
- [ ] Docker multi-stage build
- [ ] `docker-compose.yml` (local dev)
- [ ] Railway deployment: `railway.toml`
- [ ] AWS deployment: ECS/EKS
- [ ] Environment variables: `.env.example`
- [ ] Database migrations: Auto-run on deploy
- [ ] Backup strategy: Daily PITR

#### 9.4 Security Audit
- [ ] Dependency scan: `npm audit`
- [ ] OWASP Top 10 check
- [ ] SQL injection test
- [ ] XSS test
- [ ] CSRF protection
- [ ] Rate limiting test
- [ ] Penetration test (optional)

#### 9.5 Documentation
- [ ] README.md (Quick Start)
- [ ] DEPLOYMENT_GUIDE.md
- [ ] API_DOCUMENTATION.md
- [ ] TROUBLESHOOTING.md
- [ ] CHANGELOG.md

### ✅ Definition of Done
- [x] Test coverage >80%
- [x] CI/CD pipeline yeşil
- [x] Production deploy başarılı
- [x] Load test: 1000+ concurrent users geçti
- [x] Security scan temiz
- [x] Documentation complete
- [ ] **Error Response Standardization**: All endpoints return consistent error format ✅
- [ ] **Error Codes**: 30+ error codes documented (AUTH_*, AUTHZ_*, VALIDATION_*, etc.) ✅
- [ ] **Client Libraries**: Error handling examples for each error type ✅

### 📚 İlgili Dokümantasyon
- [README.md](./11-Testing/README.md)
- [README.md](./12-Deployment/README.md)
- [README.md](./13-API-Documentation/README.md)

---

## 📊 Phase Dependencies (Gantt Chart)

```
Month 1:
Week 1: [Phase 0: Foundation]
Week 2-4: [Phase 1: Core Multi-Tenancy]  ← 3 hafta

Month 2:
Week 5-8: [Phase 2: Generic Table Pattern]  ← 4 hafta, EN KRİTİK! ⭐

Month 3:
Week 9-10: [Phase 3: Security & RBAC]
Week 11-12: [Phase 4: Infrastructure]

Month 4:
Week 13-15: [Phase 5: Business Features]
Week 16-17: [Phase 7: Communications]

Month 5:
Week 18-21: [Phase 6: Advanced Features]

Month 6:
Week 22: [Phase 8: Observability]
Week 23-24: [Phase 9: Production Ready]

TOTAL: ~24 hafta = 6 ay
```

### Critical Path (Kritik Yol)
```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 9
(1w)     (3w)       (4w)       (2w)       (2w)
= 12 hafta MVP + Production
```

### Paralel Çalışılabilir Phase'ler
- **Phase 3 (RBAC)** ve **Phase 4 (Infrastructure)**: Phase 2'den sonra paralel başlayabilir
- **Phase 5 (Business)** ve **Phase 7 (Comms)**: Phase 2'den sonra paralel
- **Phase 6 (Advanced)** ve **Phase 8 (Observability)**: Phase 4'ten sonra paralel

---

## 🎯 MVP Scope (Minimum Viable Product)

### MVP = Phase 0 + 1 + 2 + 3 (10 hafta)

**MVP ile yapabilecekleriniz:**
- ✅ Multi-tenant sistem (tenant izolasyonu)
- ✅ Kullanıcı kaydı/girişi
- ✅ Proje oluşturma
- ✅ Dinamik tablo oluşturma (metadata)
- ✅ CRUD operasyonları (generic_data)
- ✅ RBAC (roller ve izinler)
- ✅ API key authentication
- ✅ RLS ile veri izolasyonu
- ✅ Soft delete ve audit log

**MVP ile YAPAMAYACAKLARınız:**
- ❌ File upload
- ❌ Email gönderimi
- ❌ Job queue
- ❌ Reports & widgets
- ❌ MLM sistemi
- ❌ Template system

---

## 🏁 Production-Ready Checklist

### Before Going Live

#### Infrastructure
- [ ] PostgreSQL production instance (managed service)
- [ ] Redis production instance (managed service)
- [ ] PgBouncer connection pooling
- [ ] Database backup: Daily + PITR
- [ ] SSL/TLS certificates
- [ ] CDN for static assets
- [ ] DDoS protection (Cloudflare)

#### Security
- [ ] Secrets management: AWS Secrets Manager / Vault
- [ ] API rate limiting: 1000 req/min per tenant
- [ ] CORS configuration
- [ ] CSP headers
- [ ] Firewall rules
- [ ] Intrusion detection
- [ ] Dependency scan clean

#### Monitoring
- [ ] Error tracking: Sentry / Rollbar
- [ ] APM: New Relic / DataDog
- [ ] Uptime monitoring: UptimeRobot / Pingdom
- [ ] Log aggregation: ELK / Loki
- [ ] Alerting: PagerDuty / Opsgenie

#### Performance
- [ ] Database indexes optimized
- [ ] Redis cache hit rate >80%
- [ ] API response time <200ms (p95)
- [ ] Load test: 1000+ concurrent users passed

#### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide
- [ ] Admin guide
- [ ] Runbook (incident response)
- [ ] Architecture diagram

---

## 💰 Resource Estimation

### Team Size
- **1 Backend Developer**: 11 ay
- **2 Backend Developers**: 6 ay (recommended)
- **3 Backend Developers**: 4 ay (fast track)

### Cost Breakdown (USD/month)

| Service | MVP | Production |
|---------|-----|------------|
| Railway PostgreSQL | $25 | $50 |
| Railway Redis | $5 | $20 |
| Railway App | $20 | $50 |
| Cloudflare R2 (storage) | $5 | $20 |
| SendGrid (email) | Free | $15 |
| Sentry (errors) | Free | $26 |
| **TOTAL** | **$55/mo** | **$181/mo** |

### AWS Alternative (Production)

| Service | Cost |
|---------|------|
| RDS PostgreSQL (db.t3.medium) | $60/mo |
| ElastiCache Redis (cache.t3.micro) | $15/mo |
| ECS Fargate (2 tasks) | $40/mo |
| S3 + CloudFront | $20/mo |
| SES (email) | $10/mo |
| **TOTAL** | **$145/mo** |

---

## 🚀 Quick Start Commands

### Phase 0: Foundation
```bash
# PostgreSQL + Extensions
psql $DATABASE_URL -f migrations/001_initial_schema.sql

# Seed data
psql $DATABASE_URL -f migrations/seeds/001_default_languages.sql
psql $DATABASE_URL -f migrations/seeds/002_default_currencies.sql
```

### Phase 1: Core Multi-Tenancy
```bash
# Register first tenant
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "securePassword123!",
    "tenant_name": "ACME Corp",
    "tenant_slug": "acme"
  }'

# Login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "securePassword123!"
  }'
```

### Phase 2: Generic Table Pattern
```bash
# Create project
curl -X POST http://localhost:5000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My E-Commerce",
    "description": "Product catalog"
  }'

# Create table metadata
curl -X POST http://localhost:5000/api/v1/projects/1/tables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "products",
    "schema_definition": {
      "fields": [
        {"name": "name", "type": "string", "required": true},
        {"name": "price", "type": "number", "required": true},
        {"name": "stock", "type": "number", "default": 0}
      ]
    }
  }'

# Insert record (no new table created!)
curl -X POST http://localhost:5000/api/v1/projects/1/tables/1/records \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop",
    "price": 1299.99,
    "stock": 50
  }'
```

---

## 📈 Success Metrics

### Technical Metrics
- **API Response Time**: p95 <200ms, p99 <500ms
- **Database Query Time**: p95 <50ms
- **Cache Hit Rate**: >80%
- **Error Rate**: <0.1%
- **Test Coverage**: >80%
- **Uptime**: 99.9% (43.8m/month downtime)

### Business Metrics
- **Onboarding Time**: <10 min (tenant registration → first API call)
- **Time to First Value**: <30 min (create project + table + insert data)
- **API Calls per Tenant**: >1000/day (active usage indicator)
- **Tenant Retention**: >90% after 3 months

---

## 🔥 Risk Mitigation

### High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RLS bypass** | 🔴 Critical | Comprehensive testing, never skip `set_context()` |
| **SQL injection** | 🔴 Critical | Parameterized queries, ORM usage |
| **Performance degradation** | 🟡 Medium | Indexes, caching, load testing |
| **Data loss** | 🔴 Critical | Daily backups, PITR, replication |
| **Generic data scale** | 🟡 Medium | Partition by tenant_id/project_id when >1M rows |
| **Key leakage** | 🔴 Critical | Secrets management, never commit .env |

### Contingency Plans

**If RLS fails:**
1. Immediate rollback to previous version
2. Emergency fix: Add application-level tenant check
3. Comprehensive audit of all affected data

**If performance degrades:**
1. Enable slow query log
2. Add missing indexes
3. Scale database vertically
4. Implement database partitioning

**If data is lost:**
1. Restore from PITR backup
2. Notify affected tenants
3. Perform data integrity check
4. Post-mortem analysis

---

## 📚 Related Documents

### Generic Handler (Week 4 - 30 Ekim 2025)
- [18-Modular-Smart-Strategy/README.md](./18-Modular-Smart-Strategy/README.md) ⚡ **KRİTİK - WEEK 4 COMPLETE**
- [18-Modular-Smart-Strategy/01_Current_State_Analysis.md](./18-Modular-Smart-Strategy/01_Current_State_Analysis.md)
- [18-Modular-Smart-Strategy/02_Hybrid_Architecture_Plan.md](./18-Modular-Smart-Strategy/02_Hybrid_Architecture_Plan.md)
- [18-Modular-Smart-Strategy/03_Real_Migration_Plan.md](./18-Modular-Smart-Strategy/03_Real_Migration_Plan.md)

### Diğer Dokümanlar
- [00_MIGRATION_ORDER.md](./15-Database-Migrations/00_MIGRATION_ORDER.md) - Tablo oluşturma sırası
- [01_GENERIC_TABLE_PATTERN.md](./09-Oneriler/01_GENERIC_TABLE_PATTERN.md) - Generic data pattern
- [16-Platform-Independence/README.md](./16-Platform-Independence/README.md) - Platform bağımsızlığı 🔓
- [EKSIKLER_VE_ZAYIF_YONLER.md](./EKSIKLER_VE_ZAYIF_YONLER.md) - Zayıf noktalar analizi
- [README.md](./README.md) - Ana roadmap (v1.5.0 - Generic Handler active)

---

## 🎉 Conclusion

**10 phase'lik bu plan**, sıfırdan production-ready bir multi-tenant DBaaS backend'i inşa etmek için kapsamlı bir yol haritasıdır.

### Önerilen Yaklaşım:
1. ✅ **MVP First**: Phase 0-1-2-3 ile başlayın (10 hafta)
2. ✅ **Early Testing**: Her phase sonunda test edin
3. ✅ **Incremental Deploy**: MVP'den sonra diğer phase'leri deploy edin
4. ✅ **Monitor Closely**: Production'da metrics izleyin
5. 🔓 **Platform Freedom**: 12-Factor App prensiplerine uy, hiçbir platforma esir olma

### 🎯 Migration Sıralaması (Kronolojik)

#### Completed Migrations (Phase 0-2)
```sql
001_initial_schema.sql       -- Phase 0: Extensions, schemas, functions, cfg, ops, tenants, users ✅
002_seed_data.sql            -- Phase 0: Seed data (languages, currencies) ✅
003_add_api_keys.sql         -- Phase 1: API key system ✅
004_add_migration_checksum.sql -- Phase 1: Migration tracking ✅
005_create_projects_table.sql  -- Phase 2: Projects table ✅
006_cleanup_and_create_master_admin.sql -- Phase 1: Master admin user ✅
007_create_ai_knowledge_base.sql -- Phase 1: AI knowledge base ✅
008_add_live_report_types.sql  -- Phase 1: Report types ✅
009_create_currencies.sql      -- Phase 0: Currency system ✅
011_create_api_registry.sql    -- Phase 2 (Week 1): api_resources, api_resource_fields, api_policies ✅
012_create_table_metadata.sql  -- Phase 2 (Week 1): table_metadata, generic_data (PASIF) ✅
013_enable_projects_resource.sql -- Phase 2 (Week 3): Projects resource enabled ✅
014_enable_users_resource.sql  -- Phase 2 (Week 4): Users resource enabled ✅
015_add_tenants_resource.sql   -- Phase 2 (Week 4): Tenants resource added + enabled ✅
```

#### Planned Migrations (Phase 3-9)
```sql
016_add_organizations.sql    -- Phase 3: Organizations (PLANNED)
017_add_rbac.sql             -- Phase 3: Roles, permissions (PLANNED)
018_add_field_permissions.sql -- Phase 3: Field-level permissions (PLANNED)
019_add_templates.sql        -- Phase 3: Project templates (PLANNED)
020_add_file_storage.sql     -- Phase 4: Files, image variants (PLANNED)
021_add_sequences.sql        -- Phase 2: Sequence/barcode system (PLANNED)
022_add_shared_entities.sql  -- Phase 2: Companies, contacts, products (PLANNED)
023_add_notifications.sql    -- Phase 7: Notifications, email queue (PLANNED)
024_add_webhooks.sql         -- Phase 7: Webhooks, deliveries (PLANNED)
025_add_mlm.sql              -- Phase 6: MLM system (PLANNED)
026_add_monitoring.sql       -- Phase 8: Monitoring (PLANNED)
```

---

## 🎉 Changelog

### Phase 2 Update (30 Ekim 2025) - Week 4 Complete

**Generic Handler System Tamamlandı:**
- ✅ Migration 011-015 deployed
- ✅ Generic CRUD controller active
- ✅ OpenAPI Auto-Generator live
- ✅ Metrics Dashboard (_health, _metrics)
- ✅ 3 active resources (projects, users, tenants)
- ✅ Swagger UI: https://hzmdatabasebackend-production.up.railway.app/api/v1/admin/docs
- ✅ Yeni sistem kuralı: Migration-only approach (30 dk → 5 dk, %92 hız)
- ✅ Dokümantasyon: 18-Modular-Smart-Strategy/ (894 satır)

**Business Impact:**
- 🎯 Endpoint patlaması önlendi (400+ → 30-40 sabit)
- 🎯 Yeni tablo maliyeti: %92 azalma
- 🎯 Kod tasarrufu: %95 azalma
- 🎯 Dokümantasyon: Otomatik (OpenAPI 3.0)
- 🎯 Bakım: %90 azalma

**İyi şanslar!** 🚀

[Ana Sayfa](README.md)

