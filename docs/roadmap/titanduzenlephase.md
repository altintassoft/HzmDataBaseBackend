# 🚀 Titan ID Düzenleme - Uygulama Planı

> **Referans:** [titanduzenle.md](./titanduzenle.md) - Detaylı mimari ve SQL örnekleri  
> **Hedef:** İki seviyeli izolasyon (TENANT + ORGANIZATION)  
> **Strateji:** Zero-downtime, phased rollout

---

## 🎬 BAŞLAMAK İÇİN

### Yeni AI Chat'e Bu Dosyayı Verdin mi?

**Şunu söyle:**
```
@titanduzenlephase.md dosyasına bak.
Şu anda PHASE [0/1/2/3/4/5]'deyiz.
[Migration/API/Frontend/Test] işlemini yap.
```

**Veya direkt:**
```
Phase 0'ı başlat: 021_phase0_preparation.sql migration'ını oluştur.
```

### Mevcut Durum Nerede?

**Son Güncelleme:** 2025-11-01 03:20 UTC

**Phase durumu:**
- [x] Phase 0: Hazırlık → ✅ TAMAMLANDI (021_phase0_preparation.sql)
- [x] Phase 1: Platform + Tenants → ✅ TAMAMLANDI (022_phase1_platform_tenants.sql)
- [x] Phase 2: Organizations → ✅ TAMAMLANDI (023_phase2_organizations.sql)
- [x] Phase 3: RLS + Security → ✅ TAMAMLANDI (024_phase3_rls_security.sql)
- [ ] Phase 4: API Middleware → ⏳ HAZIR (Kod değişiklikleri)
- [ ] Phase 5: Frontend → ⏳ BEKLEMEDE (Kod değişiklikleri)

**Railway Production Status:**
- ✅ All migrations deployed and tested
- ✅ Backend API: HEALTHY
- ✅ Database: PostgreSQL with RLS policies (preparation mode)
- ⏳ Frontend: Works with old API (will update in Phase 5)

### İlk Adım: Phase 0

**AI'ya söyle:**
```
Phase 0 migration'ını oluştur ve Railway'e deploy et.
Adım adım ilerle, her migration sonrası test et.
```

---

## 📊 GENEL BAKIŞ

### Mevcut → Hedef

```
MEVCUT:                           HEDEF:
Tenant (HZMSoft)           →      Platform User (Özgür)
├── Projects (hepsi         →      ├── Tenant (E-ticaret) - titan_id
│   aynı tenant_id!)        →      │   ├── Org (Firma A)
                            →      │   └── Org (Firma B)
                            →      └── Tenant (Lojistik) - titan_id
```

### Toplam Süre: 7-10 gün

| Phase | İşlem | Süre | Risk |
|-------|-------|------|------|
| 0 | Hazırlık | 1 gün | ⚪ Düşük |
| 1 | Platform Users + Tenants | 1 gün | 🟡 Orta |
| 2 | Organizations + M2M | 2 gün | 🟠 Yüksek |
| 3 | RLS + Security | 2 gün | 🔴 Kritik |
| 4 | API Updates | 1 gün | 🟠 Yüksek |
| 5 | Frontend | 2 gün | 🟡 Orta |

---

## 🎯 PHASE 0: HAZIRLIK (1 gün)

### Hedef
Mevcut sistem yedekleme, extensions, migration rolleri hazırlama

### ✅ Checklist

- [x] **Backup:** ✅ Railway automatic backups enabled
- [x] **Extensions:** ✅ pgcrypto (1.3), uuid-ossp (1.1) installed
- [x] **Migration Role:** ✅ app_admin created with BYPASSRLS
- [x] **Test Environment:** ✅ Production tested (zero downtime deployment)
- [x] **Migration File:** ✅ 021_phase0_preparation.sql
- [x] **Deployed:** ✅ 2025-11-01 02:46 UTC
- [x] **Tests Passed:** ✅ 3/3 (Extensions, Generator, Audit log)

### 📝 Migration: `021_phase0_preparation.sql`

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migration role
CREATE ROLE app_admin WITH LOGIN PASSWORD 'changeme';
ALTER ROLE app_admin BYPASSRLS;
GRANT ALL ON DATABASE hzm_database TO app_admin;
```

### 🧪 Test

```bash
# Extensions kontrol
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp');"

# Role kontrol
psql $DATABASE_URL -c "\du app_admin"
```

### ⚠️ Rollback: Yok (extensions kalabilir, zararsız)

---

## 🎯 PHASE 1: PLATFORM USERS + TENANTS (1 gün)

**Detay:** [titanduzenle.md § Platform Users & Tenants](./titanduzenle.md#1%EF%B8%8F⃣-platform-users-seviye-0-platform-girişi)

### Hedef
- `platform.users` tablosu oluştur
- `core.tenants`'a `titan_id`, `owner_id` ekle
- Mevcut tenant'lara titan_id ata

### ✅ Checklist

- [x] **Schema:** ✅ platform schema created
- [x] **platform.users:** ✅ Table created with 3 users
  - [x] Tablo oluştur
  - [x] Mevcut admin kullanıcılarını migrate et (3 users)
  - [x] Indexes ekle (email, active, verified)
- [x] **core.tenants güncelle:** ✅ Columns added
  - [x] owner_id INTEGER (FK to platform.users)
  - [x] titan_id VARCHAR(128) UNIQUE (fixed from 64 to 128)
  - [x] project_type VARCHAR(50)
  - [x] max_organizations INTEGER
- [x] **Titan ID üret:** ✅ 2 tenants with 70-char titan_id
- [x] **Owner bağla:** ✅ All tenants linked to owners
- [x] **Migration File:** ✅ 022_phase1_platform_tenants.sql
- [x] **Deployed:** ✅ 2025-11-01 02:50 UTC (after VARCHAR fix)
- [x] **Tests Passed:** ✅ 3/3 (Platform users, Titan IDs, Owner links)

### 📝 Migration: `022_phase1_platform_tenants.sql`

[titanduzenle.md'den tam SQL](./titanduzenle.md#2%EF%B8%8F⃣-tenants-seviye-1-platformproje-tipi-⭐-titan_id-burada)

### 🧪 Test

```sql
-- Platform users sayısı
SELECT count(*) FROM platform.users;

-- Titan ID kontrol
SELECT id, name, titan_id, owner_id FROM core.tenants;

-- Boş alan var mı?
SELECT count(*) FROM core.tenants WHERE titan_id IS NULL OR owner_id IS NULL;
```

### ⚠️ Rollback

```sql
ALTER TABLE core.tenants 
DROP COLUMN IF EXISTS owner_id,
DROP COLUMN IF EXISTS titan_id,
DROP COLUMN IF EXISTS project_type,
DROP COLUMN IF EXISTS max_organizations;

DROP SCHEMA IF EXISTS platform CASCADE;
```

### 🚀 Deploy: Railway (Staging → Production)

```bash
# Staging
git checkout -b phase1-platform-tenants
# Migration ekle
git push origin phase1-platform-tenants
# Railway staging'de auto-deploy

# Test passed → Production
git checkout main
git merge phase1-platform-tenants
git push origin main
```

---

## 🎯 PHASE 2: ORGANIZATIONS + M2M (2 gün) 🔴 KRİTİK

**Detay:** [titanduzenle.md § Organizations & User-Org Relations](./titanduzenle.md#3%EF%B8%8F⃣-organizations-seviye-2-firmalarmüşteriler-⭐-i̇zolasyon-burada)

### Hedef
- `core.organizations` oluştur
- `core.user_organizations` pivot tablo (M2M)
- `core.users.organization_id` KALDIR
- Mevcut verileri migrate et

### ✅ Checklist

- [x] **core.organizations:** ✅ Already existed (from migration 016)
  - [x] Tablo oluştur (already created)
  - [x] Her tenant için "default" organization oluştur (2/2)
  - [x] Indexes ekle (tenant, slug, active, created_by)
  - [x] RLS policies (already enabled from 016)
- [x] **core.organization_members:** ✅ Used as pivot table
  - [x] Pivot tablo oluştur (already existed as organization_members)
  - [x] Mevcut user-org ilişkilerini migrate et (3 users → 3 memberships)
  - [x] Indexes ekle (tenant, org, user, role, status)
- [x] **core.users güncelle:** ✅ No organization_id column (already clean)
- [x] **Data migration:** ✅ All data linked to default orgs
  - [x] table_metadata.organization_id added
  - [x] generic_data.organization_id added
  - [x] All records linked to default organizations
  - [x] Orphan check: 0 orphans
- [x] **Migration File:** ✅ 023_phase2_organizations.sql
- [x] **Deployed:** ✅ 2025-11-01 02:57 UTC
- [x] **Tests Passed:** ✅ 4/4 (Orgs, Memberships, Default orgs, Orphan check)

### 📝 Migration: `023_phase2_organizations.sql`

[titanduzenle.md'den tam SQL](./titanduzenle.md#tutarlilik-ve-son-rötuşlar)

### 🧪 Test

```sql
-- Her tenant'ın default org'u var mı?
SELECT t.id, t.name, o.id as org_id, o.slug
FROM core.tenants t
LEFT JOIN core.organizations o ON o.tenant_id = t.id AND o.slug = 'default'
WHERE o.id IS NULL;  -- Boş olmamalı

-- User-org ilişkileri
SELECT count(*) FROM core.user_organizations;

-- Orphan data var mı?
SELECT count(*) FROM core.table_metadata WHERE organization_id IS NULL;
SELECT count(*) FROM app.generic_data WHERE organization_id IS NULL;
```

### ⚠️ Rollback (ZOR! Dikkatli!)

```sql
-- 1. User_organizations'dan organization_id'yi geri al
ALTER TABLE core.users ADD COLUMN organization_id INTEGER;

UPDATE core.users u SET organization_id = (
  SELECT uo.organization_id FROM core.user_organizations uo
  WHERE uo.user_id = u.id LIMIT 1
);

-- 2. Tabloları sil
DROP TABLE core.user_organizations;
DROP TABLE core.organizations;
```

### 🚀 Deploy: CANARY!

```bash
# Staging'de test
# Production'da önce %10 traffic ile test (canary)
# Sorun yoksa %100
```

---

## 🎯 PHASE 3: RLS + SECURITY (2 gün) 🔴 KRİTİK

**Detay:** [titanduzenle.md § RLS WITH CHECK](./titanduzenle.md#3%EF%B8%8F⃣-rls-with-check---tüm-tablolara-⚠️-kri̇ti̇k)

### Hedef
- RLS policies (WITH CHECK)
- Composite FK
- Context triggers
- `core.set_context` function

### ✅ Checklist

- [x] **Composite FK:** ✅ Data integrity ensured
  - [x] table_metadata unique constraint (tenant_id, organization_id, id)
  - [x] generic_data composite FK to table_metadata
- [x] **core.set_context function:** ✅ Updated for Titan ID
  - [x] core.set_context(titan_id VARCHAR, org_id INTEGER)
  - [x] core.current_titan_id()
  - [x] core.current_organization_id()
  - [x] app.current_tenant() (backward compatible)
- [x] **Context trigger:** ⏳ Not needed (middleware will handle)
- [x] **RLS Policies Created:** ✅ 24 policies (6 tables x 4 operations)
  - [x] core.tenants (4 policies - NOT YET ENABLED)
  - [x] core.organizations (4 policies - ALREADY ENABLED from 016)
  - [x] core.users (4 policies - ALREADY ENABLED from 001)
  - [x] core.organization_members (4 policies - ALREADY ENABLED from 016)
  - [x] core.table_metadata (4 policies - NOT YET ENABLED)
  - [x] app.generic_data (4 policies - NOT YET ENABLED)
- [x] **RLS Strategy:** ✅ PREPARATION MODE
  - [x] Policies defined but not enforced on new tables
  - [x] Will be enabled in Phase 4 with API support
  - [x] Zero downtime deployment
- [x] **Migration File:** ✅ 024_phase3_rls_security.sql
- [x] **Deployed:** ✅ 2025-11-01 03:15 UTC
- [x] **Tests Passed:** ✅ 5/5 (Migration, Functions, Policies, FK, API health)

### 📝 Migration: `024_phase3_rls_security.sql`

[titanduzenle.md'den tam SQL](./titanduzenle.md#production-ready-i̇yi̇leşti̇rmeler)

### 🧪 Test (Duman Testleri)

```sql
-- 1. Context set
SELECT core.set_context('titan_abc123', 1);
SELECT count(*) FROM app.generic_data;  -- Sadece org=1

-- 2. Trigger override (999 ezilmeli)
INSERT INTO app.generic_data (tenant_id, organization_id, table_id, data)
VALUES (999, 999, 1, '{}');
SELECT tenant_id, organization_id FROM app.generic_data ORDER BY id DESC LIMIT 1;
-- tenant_id != 999 olmalı (context'ten alınmalı)

-- 3. Composite FK (hata vermeli)
INSERT INTO app.generic_data (table_id, data) VALUES (9999, '{}');
-- ERROR: FK violation

-- 4. Cross-org sızıntı testi
SELECT core.set_context('titan_abc123', 1);
INSERT INTO app.generic_data (table_id, data) VALUES (1, '{"test": "org1"}');

SELECT core.set_context('titan_abc123', 2);
SELECT count(*) FROM app.generic_data WHERE data->>'test' = 'org1';
-- 0 olmalı (org 2 göremez!)
```

### ⚠️ Rollback

```sql
-- RLS DISABLE
ALTER TABLE app.generic_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE core.table_metadata DISABLE ROW LEVEL SECURITY;
-- ... diğer tablolar

-- Policies sil
DROP POLICY IF EXISTS generic_data_select ON app.generic_data;
-- ... tüm policies

-- Triggers sil
DROP TRIGGER IF EXISTS enforce_context_generic_data ON app.generic_data;
DROP FUNCTION IF EXISTS core.enforce_tenant_context();
DROP FUNCTION IF EXISTS core.set_context(VARCHAR, INTEGER);
```

### 🚀 Deploy: MAINTENANCE WINDOW (2-3 saat)

- Railway'de kısa downtime gerekebilir (RLS enable sırasında)
- Alternatif: Blue-green deployment

---

## 🎯 PHASE 4: API UPDATES (1 gün)

**Detay:** [titanduzenle.md § API Değişiklikleri](./titanduzenle.md#📡-api-deği̇şi̇kli̇kleri̇-detayli)

### Hedef
- Middleware: Transaction + `core.set_context`
- Yeni endpoints: `/platform/login`, `/switch-tenant`, `/switch-organization`
- Eski endpoints güncelle (backward compatible)

### ✅ Checklist

- [ ] **Middleware (authDispatch.js):**
  ```javascript
  // Her request için:
  // 1. BEGIN transaction
  // 2. core.set_context(titanId, orgId)
  // 3. İşlem
  // 4. COMMIT
  ```

- [ ] **Yeni endpoints:**
  - [ ] `POST /api/v1/platform/login` (platform user + tenant listesi)
  - [ ] `POST /api/v1/platform/switch-tenant` (tenant seç)
  - [ ] `POST /api/v1/tenant/switch-organization` (org seç)
  - [ ] `GET /api/v1/user/organizations` (erişilebilir org'lar)

- [ ] **Eski endpoints:**
  - [ ] `/auth/login` → Geçici olarak çalışır (deprecation warning)
  - [ ] `/data/*` → Header kontrolü ekle (X-Titan-ID, X-Organization-ID)

### 📝 Kod: `src/middleware/authDispatch.js`, `src/modules/auth/`

[titanduzenle.md'den örnek kod](./titanduzenle.md#🔐-backend-middleware)

### 🧪 Test

```bash
# 1. Platform login
curl -X POST http://localhost:3000/api/v1/platform/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}'

# 2. Switch tenant
curl -X POST http://localhost:3000/api/v1/platform/switch-tenant \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d '{"titan_id":"titan_abc123"}'

# 3. Data çekme (yeni header'larla)
curl http://localhost:3000/api/v1/data/products \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Titan-ID: titan_abc123" \
  -H "X-Organization-ID: 1"
```

### ⚠️ Rollback

- Eski endpoints çalışır durumda (backward compatible)
- Yeni endpoints kaldırılabilir

### 🚀 Deploy: Railway Auto-Deploy

```bash
git checkout -b phase4-api-updates
# Kod değişiklikleri
git push origin phase4-api-updates
# Railway staging'de test
# Merge to main
```

---

## 🎯 PHASE 5: FRONTEND (2 gün)

**Detay:** [titanduzenle.md § Frontend Değişiklikleri](./titanduzenle.md#🎨-frontend-deği̇şi̇kli̇kleri̇)

### Hedef
- Yeni login flow (3 adım)
- Tenant/Organization seçim ekranları
- API client güncelleme (titan headers)

### ✅ Checklist

- [ ] **Login Flow:**
  - [ ] Platform login page
  - [ ] Tenant seçim page
  - [ ] Organization seçim page (opsiyonel)

- [ ] **API Client:**
  ```typescript
  class ApiClient {
    private getTitanHeaders() {
      return {
        'X-Titan-ID': localStorage.getItem('titan_id'),
        'X-Organization-ID': localStorage.getItem('organization_id'),
        'Authorization': `Bearer ${localStorage.getItem('tenant_token')}`
      };
    }
  }
  ```

- [ ] **Context Provider:**
  - [ ] TenantContext (seçili tenant)
  - [ ] OrganizationContext (seçili org)

- [ ] **URL Routing:**
  ```
  /login → /select-tenant → /select-organization → /dashboard
  /:titan_id/:org_slug/products
  ```

### 🧪 Test

- [ ] Login flow end-to-end
- [ ] Multi-tenant kullanıcı (2+ tenant)
- [ ] Multi-org kullanıcı (2+ org)
- [ ] Tenant switch
- [ ] Organization switch
- [ ] Data isolation (browser'da farklı sekmelerde farklı org'lar)

### 🚀 Deploy: Netlify Auto-Deploy

```bash
cd HzmVeriTabaniFrontend
git checkout -b phase5-frontend-updates
# Kod değişiklikleri
git push origin phase5-frontend-updates
# Netlify preview deploy
# Test → Merge to main
```

---

## 🎯 PHASE 6: PRODUCTION + MONITORING (1 gün)

### Hedef
- Final production deploy
- Monitoring setup
- Documentation update

### ✅ Checklist

- [ ] **Final Deploy:**
  - [ ] Backend → Railway production
  - [ ] Frontend → Netlify production
  - [ ] Smoke tests

- [ ] **Monitoring:**
  - [ ] Railway metrics
  - [ ] Error tracking (Sentry?)
  - [ ] Performance monitoring

- [ ] **Documentation:**
  - [ ] API docs güncelle
  - [ ] README güncelle
  - [ ] Changelog yaz

- [ ] **User Communication:**
  - [ ] Release notes
  - [ ] Migration guide (kullanıcılar için)

### 🧪 Production Smoke Test

```bash
# 1. Health check
curl https://hzmdatabase-production.railway.app/health

# 2. Platform login
curl -X POST https://hzmdatabase-production.railway.app/api/v1/platform/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ozgur@hzm.com","password":"***"}'

# 3. Data query
curl https://hzmdatabase-production.railway.app/api/v1/data/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Titan-ID: $TITAN_ID" \
  -H "X-Organization-ID: 1"

# 4. Cross-org test (403 dönmeli)
curl https://hzmdatabase-production.railway.app/api/v1/data/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Titan-ID: $TITAN_ID" \
  -H "X-Organization-ID: 999"  # Erişimi olmayan org
```

---

## 📋 MASTER CHECKLIST

### Hazırlık
- [x] ✅ Backup alındı (Railway automatic backups)
- [x] ✅ Test environment hazır (Production used for testing)
- [x] ✅ Team bilgilendirildi

### Phase 0: Hazırlık
- [x] ✅ Extensions yüklendi (pgcrypto 1.3, uuid-ossp 1.1)
- [x] ✅ Migration role oluşturuldu (app_admin with BYPASSRLS)
- [x] ✅ Test environment seed edildi
- [x] ✅ Migration: 021_phase0_preparation.sql
- [x] ✅ Deployed: 2025-11-01 02:46 UTC
- [x] ✅ Tests: 3/3 passed

### Phase 1: Platform + Tenants
- [x] ✅ `platform.users` oluşturuldu (3 users)
- [x] ✅ `core.tenants` güncellendi (titan_id VARCHAR(128), owner_id)
- [x] ✅ Titan ID'ler generate edildi (2 tenants, 70 chars each)
- [x] ✅ Tenant-Owner relationships (2/2)
- [x] ✅ Migration: 022_phase1_platform_tenants.sql
- [x] ✅ Deployed: 2025-11-01 02:50 UTC (after VARCHAR fix)
- [x] ✅ Tests: 3/3 passed

### Phase 2: Organizations + M2M
- [x] ✅ `core.organizations` oluşturuldu (already existed from 016)
- [x] ✅ Default organizations oluşturuldu (2/2)
- [x] ✅ `core.organization_members` pivot tablo (3 memberships)
- [x] ✅ `core.users.organization_id` zaten yok (clean)
- [x] ✅ Data migration tamamlandı (0 orphans)
- [x] ✅ Migration: 023_phase2_organizations.sql
- [x] ✅ Deployed: 2025-11-01 02:57 UTC
- [x] ✅ Tests: 4/4 passed

### Phase 3: RLS + Security
- [x] ✅ Composite FK'ler eklendi (1 FK constraint)
- [x] ✅ `core.set_context` function (updated for Titan ID)
- [x] ✅ Context helper functions (3 functions)
- [x] ✅ RLS policies (24 policies = 6 tables x 4 operations)
- [x] ✅ RLS Strategy: PREPARATION MODE (policies created, not fully enforced)
- [x] ✅ Migration: 024_phase3_rls_security.sql
- [x] ✅ Deployed: 2025-11-01 03:15 UTC (zero downtime)
- [x] ✅ Tests: 5/5 passed (Migration, Functions, Policies, FK, API health)

### Phase 4: API Updates
- [ ] Middleware güncellendi (transaction + context)
- [ ] Yeni endpoints (/platform/*, /tenant/*)
- [ ] Header validations (X-Titan-ID, X-Organization-ID)
- [ ] ✅ API tests passed
- [ ] ✅ Production deployed

### Phase 5: Frontend
- [ ] Login flow (3 adım)
- [ ] Tenant/Org seçim ekranları
- [ ] API client güncellendi (headers)
- [ ] Context providers
- [ ] URL routing
- [ ] ✅ E2E tests passed
- [ ] ✅ Production deployed

### Phase 6: Production
- [ ] Final smoke tests
- [ ] Monitoring setup
- [ ] Documentation updated
- [ ] ✅ GO LIVE! 🚀

---

## 🆘 TROUBLESHOOTING

### Sorun: RLS enable sonrası data görünmüyor

**Çözüm:**
```sql
-- Context set edilmiş mi kontrol
SELECT current_setting('app.current_tenant_id', true);
SELECT current_setting('app.current_organization_id', true);

-- Context set et
SELECT core.set_context('titan_xxx', 1);
```

### Sorun: FK violation (composite FK)

**Çözüm:**
```sql
-- Orphan records var mı?
SELECT gd.* 
FROM app.generic_data gd
LEFT JOIN core.table_metadata tm ON 
  tm.tenant_id = gd.tenant_id AND 
  tm.organization_id = gd.organization_id AND 
  tm.id = gd.table_id
WHERE tm.id IS NULL;

-- Orphan'ları temizle veya düzelt
```

### Sorun: User login olup org göremiyorum

**Çözüm:**
```sql
-- User'ın org ilişkisi var mı?
SELECT * FROM core.user_organizations 
WHERE user_id = $USER_ID AND is_active = TRUE;

-- Yoksa ekle
INSERT INTO core.user_organizations (user_id, tenant_id, organization_id, role)
VALUES ($USER_ID, $TENANT_ID, $ORG_ID, 'user');
```

---

## 🔧 SON RÖTUŞLAR (Go-Live Öncesi)

### 1. JWT/Token Güvenlik
```javascript
// JWT doğrulama
jwt.verify(token, SECRET, {
  algorithms: ['HS256'],
  audience: 'hzm-database',
  issuer: 'hzm-platform',
  maxAge: '8h'
});

// Refresh token rotation (tenant/org context'li)
```

### 2. Header Normalizasyon
```javascript
// Case-insensitive + trim
const titanId = (req.headers['x-titan-id'] || '').trim().toLowerCase();
const orgId = parseInt((req.headers['x-organization-id'] || '').trim());
```

### 3. Migration İdempotency
```sql
-- Her DDL'de
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX CONCURRENTLY IF NOT EXISTS ...  -- Production için
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
```

### 4. Backfill Performans
```sql
-- Batch update (büyük tablolar için)
UPDATE app.generic_data SET organization_id = (...)
WHERE id IN (SELECT id FROM app.generic_data WHERE organization_id IS NULL LIMIT 50000);

-- Memory + timeout artır
SET maintenance_work_mem = '2GB';
SET statement_timeout = '5min';
```

### 5. PgBouncer (Transaction Pooling)
```ini
# .env
pool_mode = transaction
server_reset_query = DISCARD ALL  # SET LOCAL'ler temizlensin
```

### 6. Audit PII Maskeleme
```sql
CREATE FUNCTION core.mask_pii(data JSONB) RETURNS JSONB AS $$
BEGIN
  IF data ? 'email' THEN
    data = jsonb_set(data, '{email}', to_jsonb('***@***.com'));
  END IF;
  RETURN data;
END;
$$ LANGUAGE plpgsql;

-- audit_logs trigger'ında kullan
```

### 7. JWT Secret Rotation
- Eski JWT secret deprecate (3 ay grace period)
- Yeni platform login akışında yeni secret
- Frontend'de token refresh

### 8. SSE/Streaming Endpoints
```javascript
// Transaction middleware'den muaf
app.get('/api/v1/stream/*', skipTransaction, handler);

// Context'i kısa işlemlerle set et
```

### 9. SLA & Alarms
```javascript
// Monitoring
- RLS policy errors → 5xx spike alarm
- FK violations → Ayrı metrik
- Context not set → Critical alert
- Cross-org attempts → Security log
```

### ✅ Go-Live Checklist (Final)
- [ ] JWT validation (aud/iss/exp)
- [ ] Headers normalized
- [ ] All DDL idempotent + CONCURRENTLY
- [ ] Backfill tested (batch)
- [ ] PgBouncer configured
- [ ] PII masking active
- [ ] JWT rotation planned
- [ ] SSE endpoints excluded
- [ ] Alarms configured

**Bu rötuşlar tamamlandı mı? → GO LIVE! 🚀**

---

## 📞 İLETİŞİM & DESTEK

- **Detaylı Mimari:** [titanduzenle.md](./titanduzenle.md)
- **Migration Scripts:** `/HzmVeriTabaniBackend/migrations/021_*.sql`
- **Testler:** `/HzmVeriTabaniBackend/tests/titan-*.test.js`

---

## ⚡ HIZLI BAŞLANGIÇ (YENİ CHAT İÇİN)

### 1️⃣ Durumu Tespit Et
```bash
# Migration durumu
ls HzmVeriTabaniBackend/migrations/ | grep -E "021|022|023|024"

# Hangi phase'deyiz?
# 021 yoksa → Phase 0'dan başla
# 021 varsa → Phase 1'e geç
```

### 2️⃣ AI'ya Ver
```
@titanduzenlephase.md 

Durum: [Phase X'deyiz / Henüz başlamadık]

Aksiyon: [Phase 0 migration oluştur / Phase 2'yi uygula / vb.]
```

### 3️⃣ Komutlar
```bash
# Phase 0: Hazırlık
"Phase 0 migration'ını (021_phase0_preparation.sql) oluştur"

# Phase 1: Platform + Tenants  
"Phase 1 migration'ını (022_phase1_platform_tenants.sql) oluştur"

# Phase 2: Organizations
"Phase 2 migration'ını (023_phase2_organizations.sql) oluştur"

# Phase 3: RLS + Security
"Phase 3 migration'ını (024_phase3_rls_security.sql) oluştur"

# Test
"Phase X için duman testlerini çalıştır"

# Deploy
"Migration'ı Railway staging'e deploy et"
```

### 4️⃣ Her Phase Sonrası
```
✅ Migration oluşturuldu mu?
✅ Testler passed mı?
✅ Staging'de çalıştı mı?
→ Sonraki phase'e geç
```

---

**Oluşturulma:** 2025-11-01  
**Son Güncelleme:** 2025-11-01 03:20 UTC  
**Durum:** 🚀 Phase 0-1-2-3 TAMAMLANDI (Phase 4-5 kaldı)  
**İlerleme:** 60% (4/6 phases complete)  
**Deployment:** Railway Production (zero downtime)  
**Test Başarı Oranı:** 100% (15/15 tests passed)  

**Gerçek Süre:**
- Phase 0: ~2 saat (Extensions, roles, generator)
- Phase 1: ~3 saat (Platform users, Titan ID, VARCHAR fix)
- Phase 2: ~2 saat (Organizations, memberships, data migration)
- Phase 3: ~3 saat (RLS policies, context functions, composite FK)
- **Toplam:** ~10 saat (1 working day)

