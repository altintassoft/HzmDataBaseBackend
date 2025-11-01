# 🎯 Titan ID & Mimari Düzenleme Planı

> **Durum:** Mevcut mimari yanlış seviyede izolasyon sağlıyor  
> **Hedef:** İKİ SEVİYELİ İZOLASYON (TENANT + ORGANIZATION)  
> **Öncelik:** 🔴 P0 - Kritik

---

## 📖 TERMİNOLOJİ & KAVRAMLAR

### ⚠️ ÖNEMLİ: "Platform" Kelimesi İki Farklı Anlamda Kullanılıyor!

| Terim | Ne Demek | Örnek | titan_id? |
|-------|----------|-------|-----------|
| **🌍 PLATFORM** | Tüm HZM Veritabanı sistemi (Tek bir uygulama instance'ı) | hzmdatabase.com | ❌ |
| **🎯 TENANT** | Platform/Proje tipi (Eskiden "platform" veya "proje" dediğimiz) | "E-ticaret Platform", "Lojistik Sistemi" | ✅ BURADA! |
| **👤 PLATFORM USER** | HZM'ye kayıt olan kişi | Özgür, Ahmet, Mehmet | ❌ |
| **🏢 ORGANIZATION** | Tenant içindeki firmalar/müşteriler | Ayakkabı Mağazası A, MNG Kargo | ❌ (org_id var) |

### 🔑 Detaylı Açıklamalar

#### 1. 🌍 PLATFORM (Application Level)
```
HZM Veritabanı Sistemi = TEK BİR UYGULAMA
└── Herkes bu uygulamayı kullanıyor
    └── Ama herkes kendi izole alanında!
```
- **Ne değil:** Proje değil, firma değil, kullanıcı değil
- **Ne:** Tüm sistemin kendisi (backend + frontend + database)
- **Karşılığı:** hzmdatabase.com sitesi
- **Tablo:** Yok (kavramsal seviye)

#### 2. 👤 PLATFORM USER (User Level)
```sql
CREATE TABLE platform.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR(200),
  -- HZM'ye kayıt olan herkes
);
```
- **Kim:** HZM Veritabanı'na kayıt yapan her kişi
- **Örnekler:** Özgür, Ahmet, Ayşe, Mehmet...
- **Yetki:** Platform seviyesinde giriş yapabilir
- **Sahip olduğu:** Birden fazla TENANT (proje tipi)

#### 3. 🎯 TENANT = PROJE TİPİ / PLATFORM TİPİ (Isolation Level 1)
```sql
CREATE TABLE core.tenants (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES platform.users(id),
  titan_id VARCHAR(64) UNIQUE NOT NULL, -- ⭐ BURADA!
  name VARCHAR(200) NOT NULL,
  project_type VARCHAR(50), -- 'ecommerce', 'logistics', 'mlm'
  max_organizations INTEGER DEFAULT 100
);
```
- **Ne:** Platform user'ın oluşturduğu her bir sistem tipi
- **Eski terminoloji:** "Proje" veya "Platform" dediğimiz şey
- **Örnekler:** 
  - "E-ticaret Platform" (Ticimax/Tsoft gibi)
  - "Lojistik Sistemi" (MNG/Aras gibi)
  - "MLM Platform" (Forever Living/Amway gibi)
- **titan_id:** HER TENANT'IN UNIQUE KIMLIĞI (titan_abc123)
- **İçinde:** 100+ ORGANIZATION olabilir

#### 4. 🏢 ORGANIZATION = FİRMALAR/MÜŞTERİLER (Isolation Level 2)
```sql
CREATE TABLE core.organizations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES core.tenants(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  -- Tenant içindeki her bir firma/müşteri
  UNIQUE(tenant_id, slug)
);
```
- **Ne:** Bir TENANT içindeki her bir firma/müşteri
- **Örnekler:**
  - E-ticaret Platform içinde: "Ayakkabı Mağazası A", "Elektronik Mağazası B"
  - Lojistik Platform içinde: "MNG Kargo", "Yurtiçi Kargo"
  - MLM Platform içinde: "Istanbul Bölgesi", "Ankara Bölgesi"
- **İzolasyon:** Her ORG diğer ORG'lerin verilerini GÖREMEZ!

### 🏗️ Hiyerarşi Özeti

```
🌍 PLATFORM (hzmdatabase.com)
   │
   ├─ 👤 PLATFORM USER 1: Özgür
   │  ├─ 🎯 TENANT 1: E-ticaret (titan_abc123)
   │  │  ├─ 🏢 ORG 1: Firma A
   │  │  ├─ 🏢 ORG 2: Firma B
   │  │  └─ 🏢 ORG 3-100...
   │  │
   │  └─ 🎯 TENANT 2: Lojistik (titan_def456)
   │     ├─ 🏢 ORG 1: MNG
   │     └─ 🏢 ORG 2: Yurtiçi
   │
   └─ 👤 PLATFORM USER 2: Ahmet
      └─ 🎯 TENANT 3: Muhasebe (titan_xyz789)
         ├─ 🏢 ORG 1: Restoran A
         └─ 🏢 ORG 2: Market B
```

### 🔐 İzolasyon Seviyeleri

```sql
-- Seviye 1: TENANT izolasyonu
WHERE tenant_id = 10  -- Sadece "E-ticaret Platform"

-- Seviye 2: ORGANIZATION izolasyonu
WHERE tenant_id = 10 AND organization_id = 1  -- Sadece "Firma A"
```

**Her seviye bir öncekini kapsayarak izole eder!** ✅

---

## ❌ Şu Anki Yanlış Yapı

```
TENANT (HZMSoft - id: 2)
  └── USER (ozgur@hzm.com)
      └── PROJECTS (Hepsi tenant_id: 2)
          ├── "E-ticaret Sistemi" ❌
          ├── "Lojistik Sistemi" ❌
          ├── "MLM Sistemi" ❌
          └── "Kuaför Sistemi" ❌
```

**Sorun:** Tüm projeler aynı tenant_id → **İZOLASYON YOK!**

---

## ✅ Olması Gereken Doğru Yapı (İKİ SEVİYELİ İZOLASYON)

```
PLATFORM
  │
  └── PLATFORM USER 1: Özgür (ozgur@hzm.com)
      │
      ├── 🎯 TENANT 10: "E-ticaret Platform" (titan_abc123)
      │   │              ↑ Ticimax/Tsoft gibi platform
      │   ├── 🏢 ORG 1: Firma A (Ayakkabı Mağazası)
      │   │   ├── Products: 500 ürün (İZOLE!)
      │   │   └── Users: admin@firmaA.com
      │   │
      │   ├── 🏢 ORG 2: Firma B (Elektronik Mağazası)
      │   │   ├── Products: 300 ürün (İZOLE!)
      │   │   └── Users: admin@firmaB.com
      │   │
      │   └── 🏢 ORG 3-100: Diğer firmalar...
      │
      ├── 🎯 TENANT 20: "Muhasebe Platform" (titan_def456)
      │   ├── 🏢 ORG 1: Müşteri A (Restoran)
      │   ├── 🏢 ORG 2: Müşteri B (Market)
      │   └── 🏢 ORG 3-50: Diğer müşteriler...
      │
      └── 🎯 TENANT 30: "MLM Platform" (titan_ghi789)
          ├── 🏢 ORG 1: Bölge Istanbul
          ├── 🏢 ORG 2: Bölge Ankara
          └── 🏢 ORG 3-10: Diğer bölgeler...
```

**Çözüm:** 
- **TENANT** = Platform/Proje tipi (Titan ID ile) ✅
- **ORGANIZATION** = İçindeki firmalar/müşteriler (Org ID ile) ✅
- **RLS** = tenant_id + organization_id (Çift seviye izolasyon) ✅

---

## 🔑 Temel Kavramlar

### Mevcut (Yanlış):
- **Tenant** = Firma/Müşteri (HZMSoft)
- **Project** = Alt proje (E-ticaret, Lojistik...)
- **Problem** = Projeler birbirini görüyor

### Olması Gereken (Doğru) - İKİ SEVİYELİ İZOLASYON:

#### Seviye 1: TENANT (Platform/Proje Tipi)
- **Platform User** = HZM'ye kayıt olan kişi (Özgür, Ahmet...)
- **Tenant** = Platform/Proje tipi (E-ticaret Platformu, Muhasebe Platformu)
- **Titan ID** = Her tenant'ın unique kimliği (titan_abc123)
- **Örnek:** "E-ticaret Platformu" = 1 tenant = 1 titan_id
  
#### Seviye 2: ORGANIZATION (Firmalar/Müşteriler)
- **Organization** = Tenant içindeki firmalar/müşteriler
- **Organization ID** = Her firmanın unique kimliği (org_id: 1, 2, 3...)
- **Örnek:** "Ayakkabı Mağazası A" = 1 organization
- **İzolasyon:** Firma A, Firma B'nin verilerini GÖREMEz!

#### RLS (Row Level Security):
```sql
WHERE tenant_id = 10          -- E-ticaret Platformu
  AND organization_id = 1     -- Firma A
```
**Çift seviye güvenlik!** ✅

---

## 📊 DETAYLI VERİTABANI ŞEMASI

### 🏗️ Genel Mimari

```
platform.users (Platform User)
    ↓ owner_id
core.tenants (Tenant/Proje Tipi) ← titan_id BURADA!
    ↓ tenant_id
core.organizations (Firmalar/Müşteriler)
    ↓ tenant_id + organization_id
core.users (Firma Çalışanları)
core.table_metadata (Firma Tabloları)
app.generic_data (Firma Verileri)
```

### 1️⃣ PLATFORM USERS (Seviye 0: Platform Girişi)

```sql
-- Schema oluştur
CREATE SCHEMA IF NOT EXISTS platform;

-- Platform kullanıcıları
CREATE TABLE platform.users (
  id SERIAL PRIMARY KEY,
  
  -- Auth
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  
  -- Profile
  name VARCHAR(200),
  company VARCHAR(200),
  phone VARCHAR(50),
  
  -- Plan & Limits
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  max_tenants INTEGER DEFAULT 3,   -- Free: 3, Starter: 10, Pro: 50
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_platform_users_email ON platform.users(email);
CREATE INDEX idx_platform_users_active ON platform.users(is_active);
```

**Rol:** HZM'ye kayıt olan her kişi  
**Giriş:** ozgur@hzm.com + şifre  
**Sonrası:** Tenant listesi gösterilir (E-ticaret, Lojistik, MLM...)

### 2️⃣ TENANTS (Seviye 1: Platform/Proje Tipi) ⭐ titan_id BURADA!

```sql
-- Mevcut tabloyu güncelle
ALTER TABLE core.tenants
ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES platform.users(id),
ADD COLUMN IF NOT EXISTS titan_id VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS project_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS max_organizations INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Tam tablo yapısı:
CREATE TABLE core.tenants (
  id SERIAL PRIMARY KEY,
  
  -- Owner
  owner_id INTEGER NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  
  -- Identity ⭐ ÖNEMLİ!
  titan_id VARCHAR(64) UNIQUE NOT NULL, -- 'titan_abc123def456...'
  
  -- Info
  name VARCHAR(200) NOT NULL,           -- "E-ticaret Platform"
  description TEXT,
  project_type VARCHAR(50),             -- 'ecommerce', 'logistics', 'mlm', 'custom'
  
  -- Limits
  max_organizations INTEGER DEFAULT 100,  -- Bu tenant'ta kaç firma olabilir
  max_users_per_org INTEGER DEFAULT 50,   -- Her firmada kaç kullanıcı
  max_tables_per_org INTEGER DEFAULT 100, -- Her firmada kaç tablo
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_tenants_titan_id ON core.tenants(titan_id);
CREATE INDEX idx_tenants_owner ON core.tenants(owner_id);
CREATE INDEX idx_tenants_active ON core.tenants(is_active);
CREATE INDEX idx_tenants_type ON core.tenants(project_type);

-- RLS (Owner görebilir)
ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_owner_access ON core.tenants
  FOR ALL
  USING (owner_id = current_setting('app.current_platform_user_id')::INTEGER);
```

**Değişiklik:** 
- ✅ Her TENANT = Bir proje tipi (E-ticaret, Lojistik, MLM)
- ✅ titan_id = TENANT seviyesinde unique kimlik
- ✅ Her tenant içinde 100+ organization olabilir
- ✅ Tenant sahibi tüm organizations'ı yönetir

**Örnek:**
```sql
INSERT INTO core.tenants (owner_id, titan_id, name, project_type)
VALUES (1, 'titan_ecommerce_abc123', 'E-ticaret Platform', 'ecommerce');
-- Bu tenant içinde: Ayakkabı Mağazası, Elektronik Mağazası, Giyim Mağazası...
```

### 3️⃣ ORGANIZATIONS (Seviye 2: Firmalar/Müşteriler) ⭐ İZOLASYON BURADA!

```sql
CREATE TABLE core.organizations (
  id SERIAL PRIMARY KEY,
  
  -- Parent (Hangi tenant'a ait)
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  
  -- Identity
  slug VARCHAR(100) NOT NULL,              -- 'ayakkabi-magazasi-a'
  
  -- Info
  name VARCHAR(200) NOT NULL,              -- "Ayakkabı Mağazası A"
  description TEXT,
  
  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  
  -- Branding
  logo_url VARCHAR(500),
  theme_color VARCHAR(7) DEFAULT '#3B82F6',
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ,
  subscription_status VARCHAR(50) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint (Bir tenant içinde slug unique)
  UNIQUE(tenant_id, slug)
);

-- Indexes
CREATE INDEX idx_organizations_tenant ON core.organizations(tenant_id);
CREATE INDEX idx_organizations_slug ON core.organizations(tenant_id, slug);
CREATE INDEX idx_organizations_active ON core.organizations(is_active);

-- RLS: Sadece kendi tenant'ındaki organizations görebilir
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_tenant_isolation ON core.organizations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);
```

**Rol:** Tenant içindeki her bir firma/müşteri  
**İzolasyon:** Her ORG diğer ORG'leri GÖREMEZ!

**Örnek:**
```sql
-- E-ticaret Platform (tenant_id: 10) içinde
INSERT INTO core.organizations (tenant_id, slug, name)
VALUES 
  (10, 'ayakkabi-a', 'Ayakkabı Mağazası A'),
  (10, 'elektronik-b', 'Elektronik Mağazası B'),
  (10, 'giyim-c', 'Giyim Mağazası C');

-- Her birinin verileri TAM İZOLE! ✅
```

### 4️⃣ USERS (Firma Çalışanları) - ÇİFT SEVİYE İZOLASYON

```sql
-- Mevcut tabloyu güncelle
ALTER TABLE core.users
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES core.organizations(id) ON DELETE CASCADE;

-- Tam tablo yapısı:
CREATE TABLE core.users (
  id SERIAL PRIMARY KEY,
  
  -- Isolation Keys ⭐ ÖNEMLİ!
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  
  -- Auth
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR NOT NULL,
  
  -- Profile
  name VARCHAR(200),
  avatar_url VARCHAR(500),
  
  -- Role
  role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user', 'viewer'
  permissions JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint (Email tenant içinde unique)
  UNIQUE(tenant_id, email)
);

-- Indexes
CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_organization ON core.users(organization_id);
CREATE INDEX idx_users_email ON core.users(tenant_id, email);
CREATE INDEX idx_users_active ON core.users(is_active);

-- RLS: ÇİFT SEVİYE İZOLASYON! ⭐
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON core.users;
CREATE POLICY users_double_isolation ON core.users
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );
```

**Değişiklik:** 
- ✅ Artık hem tenant_id hem organization_id gerekli
- ✅ Firma A çalışanı, Firma B kullanıcılarını GÖREMEZ!
- ✅ RLS çift seviye kontrol yapar

**Örnek:**
```sql
-- Ayakkabı Mağazası A (tenant: 10, org: 1)
INSERT INTO core.users (tenant_id, organization_id, email, name, role)
VALUES (10, 1, 'admin@ayakkabi-a.com', 'Ali Yılmaz', 'admin');

-- Elektronik Mağazası B (tenant: 10, org: 2)
INSERT INTO core.users (tenant_id, organization_id, email, name, role)
VALUES (10, 2, 'admin@elektronik-b.com', 'Ayşe Demir', 'admin');

-- Ali, Ayşe'yi GÖREMEZ! ✅
-- Ayşe, Ali'yi GÖREMEZ! ✅
```

### 5️⃣ PROJECTS - KALDIRILACAK VEYA MIGRATE EDİLECEK

```sql
-- SEÇENEK 1: Kaldır (ÖNERİLEN) ✅
-- Çünkü: TENANT artık PROJECT'in yerini alıyor
DROP TABLE IF EXISTS core.projects CASCADE;

-- SEÇENEK 2: Migration yap
-- Her mevcut proje → Ayrı tenant'a dönüşür
INSERT INTO core.tenants (owner_id, titan_id, name, project_type)
SELECT 
  p.owner_id,
  'titan_' || encode(gen_random_bytes(32), 'hex'),
  p.name,
  'custom'
FROM core.projects p;
```

**Karar:** Seçenek 1 öneriliyor (core.projects tablosu KALDIRILACAK)

---

### 6️⃣ TABLE_METADATA (Firma Tabloları) - ÇİFT SEVİYE İZOLASYON

```sql
-- Mevcut tabloyu güncelle
ALTER TABLE core.table_metadata
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES core.organizations(id) ON DELETE CASCADE;

-- Tam tablo yapısı:
CREATE TABLE core.table_metadata (
  id SERIAL PRIMARY KEY,
  
  -- Isolation Keys ⭐ ÖNEMLİ!
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  
  -- Table Definition
  table_name VARCHAR(100) NOT NULL,        -- 'products', 'orders', 'customers'
  display_name VARCHAR(200),               -- 'Ürünler', 'Siparişler'
  description TEXT,
  
  -- Fields (JSON Schema)
  fields JSONB NOT NULL DEFAULT '[]',
  
  -- Settings
  settings JSONB DEFAULT '{}',
  icon VARCHAR(50),
  color VARCHAR(7),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint (Bir organization içinde tablo adı unique)
  UNIQUE(tenant_id, organization_id, table_name)
);

-- Indexes
CREATE INDEX idx_table_metadata_tenant ON core.table_metadata(tenant_id);
CREATE INDEX idx_table_metadata_organization ON core.table_metadata(organization_id);
CREATE INDEX idx_table_metadata_name ON core.table_metadata(tenant_id, organization_id, table_name);

-- RLS: ÇİFT SEVİYE İZOLASYON! ⭐
ALTER TABLE core.table_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_metadata_double_isolation ON core.table_metadata
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );
```

**Kritik:** 
- ✅ Her ORG'un tabloları izole
- ✅ Ayakkabı Mağazası'nın "products" tablosu ≠ Elektronik Mağazası'nın "products" tablosu

---

### 7️⃣ GENERIC_DATA (Asıl Veriler) - ÇİFT SEVİYE İZOLASYON

```sql
-- Mevcut tabloyu güncelle
ALTER TABLE app.generic_data
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES core.organizations(id) ON DELETE CASCADE;

-- Tam tablo yapısı:
CREATE TABLE app.generic_data (
  id BIGSERIAL PRIMARY KEY,
  
  -- Isolation Keys ⭐ KRİTİK!
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES core.table_metadata(id) ON DELETE CASCADE,
  
  -- Data (JSON)
  data JSONB NOT NULL,
  
  -- Audit
  created_by INTEGER REFERENCES core.users(id),
  updated_by INTEGER REFERENCES core.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Soft delete
);

-- Indexes (PERFORMANCE!)
CREATE INDEX idx_generic_data_tenant ON app.generic_data(tenant_id);
CREATE INDEX idx_generic_data_organization ON app.generic_data(organization_id);
CREATE INDEX idx_generic_data_table ON app.generic_data(table_id);
CREATE INDEX idx_generic_data_tenant_org ON app.generic_data(tenant_id, organization_id);
CREATE INDEX idx_generic_data_created_at ON app.generic_data(created_at DESC);

-- JSONB indexes (for fast queries)
CREATE INDEX idx_generic_data_data_gin ON app.generic_data USING GIN(data);

-- RLS: ÇİFT SEVİYE İZOLASYON! ⭐⭐⭐ EN ÖNEMLİ!
ALTER TABLE app.generic_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY generic_data_double_isolation ON app.generic_data
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );
```

**KRİTİK:** 
- ✅ Her ORG'un verileri TAM İZOLE!
- ✅ PostgreSQL RLS seviyesinde garanti
- ✅ Kod hatası yapsan bile veri karışmaz!

**Örnek:**
```sql
-- Ayakkabı Mağazası A'nın ürünleri (tenant: 10, org: 1)
INSERT INTO app.generic_data (tenant_id, organization_id, table_id, data)
VALUES (10, 1, 5, '{"name": "Nike Air Max", "price": 1200}');

-- Elektronik Mağazası B'nin ürünleri (tenant: 10, org: 2)
INSERT INTO app.generic_data (tenant_id, organization_id, table_id, data)
VALUES (10, 2, 8, '{"name": "iPhone 15", "price": 45000}');

-- RLS sayesinde:
-- SET app.current_tenant_id = 10;
-- SET app.current_organization_id = 1;
-- SELECT * FROM app.generic_data;
-- --> SADECE Ayakkabı Mağazası A'nın verileri! ✅
```

---

## 🔄 Migration Planı

### Faz 1: Platform Users Oluştur (1 gün)

```sql
-- 1. Schema oluştur
CREATE SCHEMA platform;

-- 2. platform.users tablosu
CREATE TABLE platform.users (...);

-- 3. Mevcut user'ları migrate et
INSERT INTO platform.users (email, password_hash, name)
SELECT DISTINCT email, password_hash, name 
FROM core.users 
WHERE role = 'admin';
```

### Faz 2: Tenant'lara Titan ID Ekle (1 gün)

```sql
-- 1. Kolon ekle
ALTER TABLE core.tenants
ADD COLUMN titan_id VARCHAR(64),
ADD COLUMN owner_id INTEGER;

-- 2. Mevcut tenant'lara titan_id üret
UPDATE core.tenants
SET titan_id = 'titan_' || encode(gen_random_bytes(32), 'hex');

-- 3. Owner'ları bağla
UPDATE core.tenants t
SET owner_id = (
  SELECT pu.id FROM platform.users pu
  JOIN core.users cu ON cu.email = pu.email
  WHERE cu.tenant_id = t.id AND cu.role = 'admin'
  LIMIT 1
);
```

### Faz 3: Project → Tenant Migration (2 gün)

```sql
-- Her proje için yeni tenant oluştur
INSERT INTO core.tenants (owner_id, titan_id, name, project_type)
SELECT 
  p.owner_platform_id,
  'titan_' || encode(gen_random_bytes(32), 'hex'),
  p.name,
  'custom'
FROM core.projects p;

-- Data migrate et (table_metadata, generic_data)
-- Her proje'nin verileri → Yeni tenant_id'sine taşın
```

### Faz 4: RLS ve API Güncellemeleri (1 gün)

```sql
-- RLS policies güncelle (zaten var, değişiklik minimal)
-- API endpoints güncelle (titan_id kabul etsin)
-- Authentication flow güncelle
```

**Toplam Süre:** 5-7 gün

---

## 🔐 Güvenlik & İzolasyon

### Öncesi:
```sql
-- Tüm projeler aynı tenant_id
SELECT * FROM app.generic_data WHERE tenant_id = 2;
-- Sonuç: E-ticaret + Lojistik + MLM verileri (KARIŞIK!)
```

### Sonrası:
```sql
-- Her proje ayrı tenant
SELECT * FROM app.generic_data WHERE tenant_id = 10;
-- Sonuç: SADECE E-ticaret verileri (İZOLE!)

SELECT * FROM app.generic_data WHERE tenant_id = 20;
-- Sonuç: SADECE Lojistik verileri (İZOLE!)
```

**RLS Garantisi:** PostgreSQL seviyesinde izolasyon ✅

---

## 📡 API DEĞİŞİKLİKLERİ (DETAYLI)

### ❌ Önceki Akış (Yanlış)

```javascript
// 1. Login
POST /api/v1/auth/login
Body: { email: "ozgur@hzm.com", password: "***" }
→ Response: { token: "jwt_xxx", user: { tenant_id: 2 } }

// 2. API Çağrıları
GET /api/v1/data/projects
Headers: { Authorization: "Bearer jwt_xxx" }
→ Tüm projeler (E-ticaret, Lojistik, MLM) - AYNI TENANT_ID! ❌
```

**Sorun:** Tüm projeler aynı tenant_id'de, izolasyon yok!

---

### ✅ Yeni Akış (Doğru) - 3 ADIMLI AUTH

#### Adım 1: Platform Login

```javascript
POST /api/v1/platform/login
Body: {
  "email": "ozgur@hzm.com",
  "password": "***"
}

Response: {
  "platform_token": "jwt_platform_xxx",
  "user": {
    "id": 1,
    "email": "ozgur@hzm.com",
    "name": "Özgür",
    "plan": "pro"
  },
  "tenants": [
    {
      "id": 10,
      "titan_id": "titan_ecommerce_abc123",
      "name": "E-ticaret Platform",
      "project_type": "ecommerce",
      "organizations_count": 3
    },
    {
      "id": 20,
      "titan_id": "titan_logistics_def456",
      "name": "Lojistik Sistemi",
      "project_type": "logistics",
      "organizations_count": 2
    }
  ]
}
```

#### Adım 2: Tenant Seçimi

```javascript
POST /api/v1/platform/switch-tenant
Headers: { Authorization: "Bearer jwt_platform_xxx" }
Body: {
  "titan_id": "titan_ecommerce_abc123"
}

Response: {
  "tenant_token": "jwt_tenant_xxx",
  "tenant": {
    "id": 10,
    "titan_id": "titan_ecommerce_abc123",
    "name": "E-ticaret Platform",
    "project_type": "ecommerce"
  },
  "organizations": [
    {
      "id": 1,
      "slug": "ayakkabi-a",
      "name": "Ayakkabı Mağazası A"
    },
    {
      "id": 2,
      "slug": "elektronik-b",
      "name": "Elektronik Mağazası B"
    }
  ]
}
```

#### Adım 3: Organization Seçimi (Opsiyonel - Admin için)

```javascript
POST /api/v1/tenant/switch-organization
Headers: { 
  Authorization: "Bearer jwt_tenant_xxx",
  "X-Titan-ID": "titan_ecommerce_abc123"
}
Body: {
  "organization_id": 1
}

Response: {
  "org_token": "jwt_org_xxx",
  "organization": {
    "id": 1,
    "slug": "ayakkabi-a",
    "name": "Ayakkabı Mağazası A"
  }
}
```

#### Adım 4: Veri API Çağrıları

```javascript
// Products listesi
GET /api/v1/data/products
Headers: { 
  Authorization: "Bearer jwt_org_xxx",
  "X-Titan-ID": "titan_ecommerce_abc123",
  "X-Organization-ID": "1"
}

Response: {
  "data": [
    { "id": 1, "name": "Nike Air Max", "price": 1200 }
    // SADECE Ayakkabı Mağazası A'nın ürünleri! ✅
  ],
  "meta": { "total": 500, "tenant_id": 10, "organization_id": 1 }
}

// Yeni ürün ekle
POST /api/v1/data/products
Headers: { 
  Authorization: "Bearer jwt_org_xxx",
  "X-Titan-ID": "titan_ecommerce_abc123",
  "X-Organization-ID": "1"
}
Body: {
  "name": "Adidas Superstar",
  "price": 900
}

// Backend otomatik ekler:
// tenant_id: 10 (header'dan)
// organization_id: 1 (header'dan)
// RLS otomatik izole eder! ✅
```

---

### 🔐 Backend Middleware

```javascript
// authDispatch.js güncellemesi
async function extractTenantContext(req, res, next) {
  const titanId = req.headers['x-titan-id'];
  const orgId = req.headers['x-organization-id'];
  
  if (!titanId) {
    return res.status(400).json({ error: 'X-Titan-ID header gerekli' });
  }
  
  // Tenant'ı bul
  const tenant = await db.query(
    'SELECT id FROM core.tenants WHERE titan_id = $1 AND is_active = TRUE',
    [titanId]
  );
  
  if (!tenant.rows[0]) {
    return res.status(404).json({ error: 'Tenant bulunamadı' });
  }
  
  // PostgreSQL session'a set et
  await db.query('SET app.current_tenant_id = $1', [tenant.rows[0].id]);
  
  if (orgId) {
    await db.query('SET app.current_organization_id = $1', [orgId]);
  }
  
  req.tenantId = tenant.rows[0].id;
  req.organizationId = orgId ? parseInt(orgId) : null;
  req.titanId = titanId;
  
  next();
}
```

---

### 🎨 Frontend Değişiklikleri

#### Önceki Akış (Yanlış):
```typescript
// 1. Login
const response = await api.login(email, password);
localStorage.setItem('token', response.token);

// 2. Dashboard'a git
navigate('/dashboard');

// ❌ Hangi projedesin? → Belirsiz!
```

#### Yeni Akış (Doğru):
```typescript
// 1. Platform Login
const response = await api.platformLogin(email, password);
localStorage.setItem('platform_token', response.platform_token);
localStorage.setItem('user', JSON.stringify(response.user));

// 2. Tenant Seçim Ekranı
if (response.tenants.length === 1) {
  // Tek tenant → Otomatik seç
  await switchTenant(response.tenants[0].titan_id);
} else {
  // Çoklu tenant → Kullanıcı seçsin
  navigate('/select-tenant');
}

// 3. Tenant Switch
async function switchTenant(titanId: string) {
  const response = await api.switchTenant(titanId);
  localStorage.setItem('tenant_token', response.tenant_token);
  localStorage.setItem('titan_id', titanId);
  localStorage.setItem('tenant', JSON.stringify(response.tenant));
  
  // 4. Organization seç (varsa çoklu)
  if (response.organizations.length === 1) {
    // Tek org → Otomatik seç
    await switchOrganization(response.organizations[0].id);
  } else {
    // Çoklu org → Kullanıcı seçsin
    navigate('/select-organization');
  }
}

// 5. API Client güncellemesi
class ApiClient {
  private getTitanHeaders() {
    return {
      'X-Titan-ID': localStorage.getItem('titan_id'),
      'X-Organization-ID': localStorage.getItem('organization_id'),
      'Authorization': `Bearer ${localStorage.getItem('tenant_token')}`
    };
  }
  
  async getProducts() {
    return axios.get('/api/v1/data/products', {
      headers: this.getTitanHeaders()
    });
  }
}
```

---

### 🔄 URL Routing Değişiklikleri

#### Öncesi:
```
/login → /dashboard → /projects
```

#### Sonrası:
```
/login (Platform)
  ↓
/select-tenant (Tenant seç)
  ↓
/select-organization (Organization seç - opsiyonel)
  ↓
/dashboard (Artık hangi tenant/org'dasın belli!)
  ↓
/:titan_id/:org_slug/products
Örnek: /titan_abc123/ayakkabi-a/products
```

**Fayda:** URL'den bile hangi tenant/org'da olduğun belli! ✅

---

## ✅ Beklenen Faydalar

1. **Tam İzolasyon:** Her proje bağımsız, veri karışmaz
2. **Scalability:** 10,000+ proje destekler
3. **Security:** RLS PostgreSQL seviyesinde garanti
4. **API Routing:** Titan ID ile otomatik routing
5. **Multi-tenancy:** Industry standard mimari

---

## ⚠️ Riskler & Dikkat Edilecekler

### Risk 1: Mevcut Veri
- **Sorun:** 4 mevcut proje var (tenant_id: 2)
- **Çözüm:** Dikkatli migration scripti yazılmalı

### Risk 2: Frontend
- **Sorun:** Frontend localStorage kullanıyor
- **Çözüm:** Aynı anda güncellenecek

### Risk 3: Authentication
- **Sorun:** 2-step auth karmaşık
- **Çözüm:** Açık dokümantasyon + test

### Risk 4: Geriye Uyumluluk
- **Sorun:** Eski API çağrıları bozulabilir
- **Çözüm:** Geçiş süresi (deprecated warnings)

---

## 📝 Aksiyon Adımları

### Adım 1: Karar ✅
- [x] Mimari yanlış tespit edildi
- [x] Çözüm belirlendi (Project = Tenant)

### Adım 2: Migration Hazırlık
- [ ] Migration scriptleri yaz
- [ ] Test environment kur
- [ ] Rollback stratejisi hazırla

### Adım 3: Implementation
- [ ] platform.users tablosu oluştur
- [ ] core.tenants'a titan_id ekle
- [ ] core.projects → tenants migration

### Adım 4: API & Frontend
- [ ] API endpoints güncelle
- [ ] Frontend auth flow değiştir
- [ ] Test + Deploy

**Başlangıç Tarihi:** TBD  
**Hedef Tamamlanma:** 1 hafta  
**Sorumlu:** TBD

---

## 📚 İlgili Dokümanlar

- [09-Oneriler/01_GENERIC_TABLE_PATTERN.md](./09-Oneriler/01_GENERIC_TABLE_PATTERN.md) - Fiziksel tablo sorunu
- [01-Database-Core/02_Core_Database_Schema.md](./01-Database-Core/02_Core_Database_Schema.md) - Güncellenecek
- [01-Database-Core/04_RLS_Multi_Tenant_Strategy.md](./01-Database-Core/04_RLS_Multi_Tenant_Strategy.md) - Güncellenecek

---

## 🎓 TERMİNOLOJİ ÖZET TABLOSU

| Terim | Seviye | Ne Anlama Geliyor | titan_id | organization_id | Tablo |
|-------|--------|-------------------|----------|-----------------|-------|
| **🌍 PLATFORM** | 0 | Tüm HZM Veritabanı sistemi (Uygulama) | ❌ | ❌ | Yok (kavramsal) |
| **👤 PLATFORM USER** | 1 | HZM'ye kayıt olan kişi | ❌ | ❌ | platform.users |
| **🎯 TENANT** | 2 | Platform/Proje tipi (E-ticaret, Lojistik) | ✅ BURADA! | ❌ | core.tenants |
| **🏢 ORGANIZATION** | 3 | Tenant içindeki firmalar/müşteriler | ❌ | ✅ BURADA! | core.organizations |
| **👥 USER** | 4 | Organization çalışanları | ❌ | ✅ | core.users |
| **📊 TABLE** | 5 | Organization tabloları | ❌ | ✅ | core.table_metadata |
| **💾 DATA** | 6 | Asıl veriler | ❌ | ✅ | app.generic_data |

---

## ❓ SIK SORULAN SORULAR (SSS)

### S1: "Platform" nedir? Proje mi?

**CEVAP:** HAYIR! "Platform" kelimesi iki farklı anlamda kullanılıyor:

1. **🌍 PLATFORM (Application)** = Tüm HZM Veritabanı sistemi (hzmdatabase.com)
2. **🎯 TENANT = Platform/Proje Tipi** = Kullanıcının oluşturduğu her bir sistem tipi

**Özetle:**
- PLATFORM ≠ TENANT
- PLATFORM = Tek bir uygulama
- TENANT = Kullanıcının oluşturduğu proje (E-ticaret, Lojistik, MLM)

---

### S2: titan_id nerede?

**CEVAP:** `titan_id` **TENANT seviyesinde**!

```sql
-- ✅ DOĞRU
core.tenants → titan_id VARCHAR(64)

-- ❌ YANLIŞ
platform.users → titan_id YOK!
core.organizations → titan_id YOK!
```

**Çünkü:**
- Bir PLATFORM USER'ın birden fazla TENANT'ı olabilir
- Her TENANT'ın unique bir titan_id'si vardır
- titan_id = TENANT'ın eşsiz kimliği

---

### S3: Her proje ayrı tenant mı?

**CEVAP:** EVET! ✅

**Eski (Yanlış):**
```
TENANT 1: HZMSoft
  ├── Proje 1: E-ticaret (tenant_id: 1) ❌
  ├── Proje 2: Lojistik (tenant_id: 1) ❌
  └── Proje 3: MLM (tenant_id: 1) ❌
```

**Yeni (Doğru):**
```
PLATFORM USER 1: Özgür
  ├── TENANT 10: E-ticaret (titan_abc123) ✅
  ├── TENANT 20: Lojistik (titan_def456) ✅
  └── TENANT 30: MLM (titan_ghi789) ✅
```

---

### S4: Organization nedir?

**CEVAP:** TENANT içindeki firmalar/müşteriler!

**Örnek:**
```
TENANT: E-ticaret Platform (titan_abc123)
  ├── ORG 1: Ayakkabı Mağazası A
  ├── ORG 2: Elektronik Mağazası B
  └── ORG 3-100: Diğer firmalar...
```

**Her ORG:**
- Kendi kullanıcılarına sahip
- Kendi tablolarına sahip
- Kendi verilerine sahip
- **DİĞER ORG'LEİN VERİLERİNİ GÖREMEZ!** ✅

---

### S5: Bir firmada 100 kullanıcı olabilir mi?

**CEVAP:** EVET! ✅

```
TENANT: E-ticaret Platform
  └── ORG: Ayakkabı Mağazası A
      ├── User 1: admin@ayakkabi.com (Admin)
      ├── User 2: satis@ayakkabi.com (Satış)
      ├── User 3: depo@ayakkabi.com (Depo)
      └── User 4-100: Diğer çalışanlar...
```

**Tüm bu kullanıcılar:**
- Aynı organization_id'ye sahip
- Aynı verilere erişir
- Diğer firmaların verilerini GÖREMEZ!

---

### S6: RLS nasıl çalışır?

**CEVAP:** PostgreSQL seviyesinde otomatik izolasyon!

```sql
-- Backend her istekte şunu yapar:
SET app.current_tenant_id = 10;
SET app.current_organization_id = 1;

-- Artık tüm sorgular otomatik filtreli:
SELECT * FROM app.generic_data;
-- PostgreSQL otomatik ekler:
-- WHERE tenant_id = 10 AND organization_id = 1

-- Kod hatası yapsan bile diğer firmaların verilerini GÖREMEZ! ✅
```

---

### S7: API'de nasıl kullanılır?

**CEVAP:** Header'larda titan_id ve organization_id gönderilir!

```javascript
GET /api/v1/data/products
Headers: {
  "Authorization": "Bearer jwt_xxx",
  "X-Titan-ID": "titan_abc123",      // Hangi tenant
  "X-Organization-ID": "1"            // Hangi organization
}

// Backend:
// 1. titan_id'den tenant_id bulur (10)
// 2. SET app.current_tenant_id = 10
// 3. SET app.current_organization_id = 1
// 4. RLS otomatik devreye girer!
// 5. Sadece o firmanın verileri döner! ✅
```

---

### S8: Frontend'de nasıl yönetilir?

**CEVAP:** 3 adımlı giriş sistemi!

```
1. Platform Login → Kullanıcı giriş yapar
   ↓
2. Tenant Seçimi → Hangi proje? (E-ticaret, Lojistik...)
   ↓
3. Organization Seçimi → Hangi firma? (Ayakkabı A, Elektronik B...)
   ↓
4. Dashboard → Artık belli hangi tenant/org'dasın!
```

**localStorage'da:**
```javascript
{
  "platform_token": "jwt_platform_xxx",
  "tenant_token": "jwt_tenant_xxx",
  "titan_id": "titan_abc123",
  "organization_id": "1",
  "user": { ... },
  "tenant": { ... },
  "organization": { ... }
}
```

---

### S9: Mevcut projeler ne olacak?

**CEVAP:** Migration ile her proje ayrı tenant'a dönüşecek!

```sql
-- Mevcut core.projects tablosundaki her kayıt
-- → Yeni core.tenants tablosuna dönüşür

-- Örnek:
-- Proje: "E-ticaret Sistemi" (project_id: 5)
-- → TENANT: "E-ticaret Sistemi" (titan_abc123)
```

**Veri kaybı olmaz!** ✅

---

### S10: Ne zaman başlanacak?

**CEVAP:** Plan hazır, onayınızla başlayabiliriz!

**Süre:** 5-7 gün  
**Risk:** Orta (Dikkatli migration gerekli)  
**Fayda:** TAM İZOLASYON! ✅

---

## 🔑 EN ÖNEMLİ NOKTA

```
🌍 PLATFORM ≠ 🎯 TENANT ≠ 🏢 ORGANIZATION

PLATFORM  = Tüm uygulama (hzmdatabase.com)
TENANT    = Proje tipi (E-ticaret, Lojistik) ← titan_id BURADA!
ORGANIZATION = Firma/Müşteri (Ayakkabı A, Elektronik B)

İZOLASYON = tenant_id + organization_id (Çift seviye!)
```

---

---

## 🚀 PRODUCTION-READY İYİLEŞTİRMELER

> **Kaynak:** GPT Önerileri (2025-11-01)  
> **Durum:** Kritik güvenlik ve performans iyileştirmeleri  
> **Öncelik:** P0-P2 (Kategorize edilmiş)

### 🔴 P0 - KRİTİK (GÜVENLİK AÇIKLARI!)

#### 1. RLS WITH CHECK Eksik ⚠️ ÇOK ÖNEMLİ!

**Sorun:** Mevcut RLS sadece `USING` clause kullanıyor → INSERT/UPDATE ile başka org'a veri yazılabilir!

**Mevcut (Yanlış):**
```sql
CREATE POLICY generic_data_double_isolation ON app.generic_data
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );
```

**Doğru:**
```sql
CREATE POLICY generic_data_double_isolation ON app.generic_data
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );

-- Veya daha güvenli: FOR SELECT/INSERT/UPDATE ayrı ayrı
CREATE POLICY generic_data_select ON app.generic_data
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );

CREATE POLICY generic_data_insert ON app.generic_data
  FOR INSERT
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );

CREATE POLICY generic_data_update ON app.generic_data
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );

CREATE POLICY generic_data_delete ON app.generic_data
  FOR DELETE
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
  );
```

**Etki:** TÜM RLS POLICY'LERİ GÜNCELLENECEK! ✅

---

#### 2. Context'i Tabloya Otomatik Yaz (TRIGGER) ⚠️ ÇOK ÖNEMLİ!

**Sorun:** Client'tan `tenant_id`/`organization_id` alınıyor → Manipülasyon riski!

**Çözüm: BEFORE INSERT/UPDATE Trigger**

```sql
-- Generic trigger function (tüm tablolar için)
CREATE OR REPLACE FUNCTION core.enforce_tenant_context()
RETURNS TRIGGER AS $$
BEGIN
  -- Otomatik tenant_id/organization_id ata
  NEW.tenant_id := current_setting('app.current_tenant_id', true)::INTEGER;
  NEW.organization_id := current_setting('app.current_organization_id', true)::INTEGER;
  
  -- NULL kontrolü
  IF NEW.tenant_id IS NULL OR NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Context not set: tenant_id=%, organization_id=%', 
      NEW.tenant_id, NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Her tabloya uygula
CREATE TRIGGER enforce_context_generic_data
  BEFORE INSERT OR UPDATE ON app.generic_data
  FOR EACH ROW EXECUTE FUNCTION core.enforce_tenant_context();

CREATE TRIGGER enforce_context_table_metadata
  BEFORE INSERT OR UPDATE ON core.table_metadata
  FOR EACH ROW EXECUTE FUNCTION core.enforce_tenant_context();

CREATE TRIGGER enforce_context_users
  BEFORE INSERT OR UPDATE ON core.users
  FOR EACH ROW EXECUTE FUNCTION core.enforce_tenant_context();
```

**Fayda:**
- ✅ Client'tan `tenant_id`/`organization_id` alınmaz!
- ✅ SQL injection/manipülasyon riski SIFIR!
- ✅ Kod basitleşir (API'da tenant_id kontrolü gereksiz)

---

#### 3. GUC Set'ini Güvenli Yap 🔐

**Sorun:** Middleware direkt `SET app.current_tenant_id` yapıyor → Doğrulama yok!

**Çözüm: Güvenli Context Function**

```sql
CREATE OR REPLACE FUNCTION core.set_context(
  p_titan_id VARCHAR,
  p_organization_id INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_tenant_id INTEGER;
  v_org_check INTEGER;
BEGIN
  -- 1. titan_id'den tenant_id bul
  SELECT id INTO v_tenant_id
  FROM core.tenants
  WHERE titan_id = p_titan_id AND is_active = TRUE;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid titan_id: %', p_titan_id;
  END IF;
  
  -- 2. organization_id varsa, tenant'a ait mi kontrol et
  IF p_organization_id IS NOT NULL THEN
    SELECT id INTO v_org_check
    FROM core.organizations
    WHERE id = p_organization_id 
      AND tenant_id = v_tenant_id 
      AND is_active = TRUE;
    
    IF v_org_check IS NULL THEN
      RAISE EXCEPTION 'Organization % does not belong to tenant %', 
        p_organization_id, v_tenant_id;
    END IF;
  END IF;
  
  -- 3. SET LOCAL kullan (transaction sonunda otomatik reset)
  PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, true);
  
  IF p_organization_id IS NOT NULL THEN
    PERFORM set_config('app.current_organization_id', p_organization_id::TEXT, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Middleware kullanımı:
-- await db.query("SELECT core.set_context($1, $2)", [titanId, orgId]);
```

**Fayda:**
- ✅ Titan ID + Org ID eşleştirmesi doğrulanıyor
- ✅ SET LOCAL → Transaction sonunda otomatik reset
- ✅ SQL injection koruması

---

#### 4. Soft Delete + RLS 🗑️

**Sorun:** `deleted_at` olan tablolarda silinmiş veri listelenebilir!

**Çözüm:**

```sql
CREATE POLICY generic_data_select ON app.generic_data
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
    AND organization_id = current_setting('app.current_organization_id')::INTEGER
    AND deleted_at IS NULL  -- ⭐ ÖNEMLİ!
  );
```

**Tüm soft-delete tablolarına uygulanacak!** ✅

---

### 🟠 P1 - YÜKSEK ÖNCELİK (ÖLÇEKLENEBİLİRLİK)

#### 5. M2M User-Organization İlişkisi 👥

**Sorun:** `core.users.organization_id NOT NULL` → Kullanıcı tek org'a kilitli!

**Senaryo:**
- Muhasebeci: 10 farklı firmaya hizmet veriyor
- Holding yöneticisi: 5 şirket arasında geçiş yapıyor

**Çözüm: Pivot Tablo**

```sql
-- core.users tablosundan organization_id'yi KALDIR
ALTER TABLE core.users DROP COLUMN organization_id;

-- Yeni pivot tablo
CREATE TABLE core.user_organizations (
  id SERIAL PRIMARY KEY,
  
  -- Relations
  user_id INTEGER NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  
  -- Role (organization-specific)
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  permissions JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  
  UNIQUE(user_id, organization_id)
);

-- RLS
ALTER TABLE core.user_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_orgs_isolation ON core.user_organizations
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id')::INTEGER
  );

-- Index
CREATE INDEX idx_user_orgs_user ON core.user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON core.user_organizations(organization_id);
CREATE INDEX idx_user_orgs_tenant ON core.user_organizations(tenant_id);
```

**API Değişikliği:**
```javascript
// Kullanıcının erişebildiği organizasyonlar
GET /api/v1/user/organizations
Response: [
  { org_id: 1, org_name: "Firma A", role: "admin" },
  { org_id: 2, org_name: "Firma B", role: "viewer" },
  { org_id: 5, org_name: "Firma E", role: "user" }
]

// Organization switch
POST /api/v1/user/switch-organization
Body: { organization_id: 2 }
```

---

#### 6. Normalize Edilmiş Yetki Modeli 🔑

**Sorun:** `permissions JSONB` → Sorgu ve denetim zor!

**Çözüm:**

```sql
-- Roller
CREATE TABLE core.roles (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, name)
);

-- İzinler
CREATE TABLE core.permissions (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) NOT NULL,      -- 'products', 'orders'
  action VARCHAR(50) NOT NULL,         -- 'read', 'create', 'update', 'delete'
  description TEXT,
  UNIQUE(resource, action)
);

-- Rol-İzin İlişkisi
CREATE TABLE core.role_permissions (
  role_id INTEGER REFERENCES core.roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES core.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User-Organization ilişkisine role_id ekle
ALTER TABLE core.user_organizations
ADD COLUMN role_id INTEGER REFERENCES core.roles(id);

-- Seed: Varsayılan izinler
INSERT INTO core.permissions (resource, action) VALUES
  ('products', 'read'),
  ('products', 'create'),
  ('products', 'update'),
  ('products', 'delete'),
  ('orders', 'read'),
  ('orders', 'create'),
  -- ...
```

**Fayda:**
- ✅ "Hangi kullanıcılar 'products.delete' yapabilir?" sorgusu kolay
- ✅ Audit trail net
- ✅ RBAC standard

---

#### 7. API Key Yönetimi (Tenant/Org Scope) 🔐

```sql
CREATE TABLE core.api_keys (
  id SERIAL PRIMARY KEY,
  
  -- Scope
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  organization_id INTEGER REFERENCES core.organizations(id), -- NULL = tenant-wide
  
  -- Key
  key_hash VARCHAR NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,      -- 'hzm_live_xxx' or 'hzm_test_xxx'
  
  -- Info
  name VARCHAR(200) NOT NULL,
  scopes TEXT[] DEFAULT '{}',           -- ['products:read', 'orders:write']
  
  -- Limits
  rate_limit_rpm INTEGER DEFAULT 100,   -- Request per minute
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  -- Audit
  created_by INTEGER REFERENCES core.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique prefix for quick lookup
  CHECK (key_prefix ~ '^hzm_(live|test)_[a-z0-9]{8}$')
);

CREATE INDEX idx_api_keys_tenant ON core.api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON core.api_keys(key_prefix);
CREATE INDEX idx_api_keys_hash ON core.api_keys(key_hash);
```

---

#### 8. Rate Limit & Kota 📊

```sql
-- Kotalar
CREATE TABLE core.quotas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  organization_id INTEGER REFERENCES core.organizations(id),
  
  -- Limits
  max_requests_per_minute INTEGER DEFAULT 100,
  max_requests_per_day INTEGER DEFAULT 10000,
  max_storage_mb INTEGER DEFAULT 1000,
  max_rows INTEGER DEFAULT 100000,
  
  reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  
  UNIQUE(tenant_id, organization_id)
);

-- Kullanım sayaçları
CREATE TABLE core.usage_counters (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  organization_id INTEGER,
  
  -- Counters
  requests_count INTEGER DEFAULT 0,
  storage_used_mb NUMERIC(10,2) DEFAULT 0,
  rows_count INTEGER DEFAULT 0,
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, organization_id, period_start)
);

CREATE INDEX idx_usage_tenant_org ON core.usage_counters(tenant_id, organization_id);
CREATE INDEX idx_usage_period ON core.usage_counters(period_start, period_end);
```

---

### 🟡 P2 - ORTA ÖNCELİK (OPERASYONEL)

#### 9. Audit Log Standardı 📝

```sql
CREATE TABLE core.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  
  -- Context ⭐ HER ZAMAN!
  tenant_id INTEGER NOT NULL,
  organization_id INTEGER,
  user_id INTEGER,
  
  -- Request
  request_id UUID NOT NULL,             -- Tracking için
  ip_address INET,
  user_agent TEXT,
  
  -- Action
  resource VARCHAR(100) NOT NULL,       -- 'products'
  action VARCHAR(50) NOT NULL,          -- 'create', 'update', 'delete'
  resource_id INTEGER,
  
  -- Changes
  old_data JSONB,
  new_data JSONB,
  
  -- Result
  status VARCHAR(20) NOT NULL,          -- 'success', 'error'
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (PERFORMANCE!)
CREATE INDEX idx_audit_tenant_org_time ON core.audit_logs(tenant_id, organization_id, created_at DESC);
CREATE INDEX idx_audit_request ON core.audit_logs(request_id);
CREATE INDEX idx_audit_user ON core.audit_logs(user_id);
CREATE INDEX idx_audit_resource ON core.audit_logs(resource, action);

-- Partitioning (opsiyonel, çok veri varsa)
-- Aylık partition: audit_logs_2025_01, audit_logs_2025_02...
```

---

#### 10. Invite Sistemi 📧

```sql
CREATE TABLE core.invites (
  id SERIAL PRIMARY KEY,
  
  -- Scope
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id),
  
  -- Invite
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'accepted', 'expired'
  
  -- Timestamps
  invited_by INTEGER REFERENCES core.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, organization_id, email)
);

CREATE INDEX idx_invites_token ON core.invites(token);
CREATE INDEX idx_invites_email ON core.invites(email);
```

---

#### 11. Maintenance Role (RLS Bypass) 🔧

```sql
-- Özel DB role
CREATE ROLE maintenance_worker;

-- Background job fonksiyonu
CREATE OR REPLACE FUNCTION core.cleanup_old_data()
RETURNS VOID AS $$
BEGIN
  -- Bu fonksiyon RLS'i bypass eder
  DELETE FROM core.audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  DELETE FROM app.generic_data
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = core, app;

-- Sadece maintenance_worker çalıştırabilir
GRANT EXECUTE ON FUNCTION core.cleanup_old_data() TO maintenance_worker;
```

---

#### 12. JSONB İndeksleme 🚀

```sql
-- GIN index (genel)
CREATE INDEX idx_generic_data_data_gin 
  ON app.generic_data USING GIN(data);

-- jsonb_path_ops (daha hızlı ama sadece @> operatörü)
CREATE INDEX idx_generic_data_data_path 
  ON app.generic_data USING GIN(data jsonb_path_ops);

-- Generated column (sık kullanılan alanlar)
ALTER TABLE app.generic_data
ADD COLUMN data_name TEXT GENERATED ALWAYS AS (data->>'name') STORED;

CREATE INDEX idx_generic_data_name ON app.generic_data(data_name);

-- Kullanım:
-- WHERE data->>'name' = 'Nike'  →  WHERE data_name = 'Nike' (çok daha hızlı!)
```

---

#### 13. Observability (request_id Propagation) 🔍

```sql
-- Middleware'de:
const requestId = req.id || uuidv4();
req.requestId = requestId;

// Database context'e ekle
await db.query("SET LOCAL app.request_id = $1", [requestId]);

// Trigger'da kullan:
CREATE OR REPLACE FUNCTION core.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO core.audit_logs (
    request_id,
    tenant_id,
    organization_id,
    resource,
    action,
    old_data,
    new_data
  ) VALUES (
    current_setting('app.request_id', true)::UUID,
    current_setting('app.current_tenant_id')::INTEGER,
    current_setting('app.current_organization_id')::INTEGER,
    TG_TABLE_NAME,
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 📌 UYGULANMASI GEREKEN DEĞİŞİKLİKLER ÖZETİ

| # | Değişiklik | Öncelik | Süre | Etki |
|---|-----------|---------|------|------|
| 1 | RLS WITH CHECK | 🔴 P0 | 2 saat | TÜM RLS policies |
| 2 | TRIGGER ile auto-context | 🔴 P0 | 4 saat | TÜM veri tabloları |
| 3 | Güvenli GUC set | 🔴 P0 | 2 saat | Middleware |
| 4 | Soft delete RLS fix | 🔴 P0 | 1 saat | TÜM policies |
| 5 | M2M user-org | 🟠 P1 | 1 gün | Schema değişikliği |
| 6 | RBAC normalize | 🟠 P1 | 1 gün | Yeni tablolar |
| 7 | API Keys | 🟠 P1 | 4 saat | Yeni tablo |
| 8 | Rate limit & kota | 🟠 P1 | 1 gün | Yeni tablolar |
| 9 | Audit log | 🟡 P2 | 4 saat | Yeni tablo |
| 10 | Invite sistem | 🟡 P2 | 4 saat | Yeni tablo |
| 11 | Maintenance role | 🟡 P2 | 2 saat | DB role + function |
| 12 | JSONB index | 🟡 P2 | 2 saat | Performance |
| 13 | Observability | 🟡 P2 | 2 saat | Request tracking |

**Toplam Süre:**
- 🔴 P0 (Kritik): 9 saat (1 gün)
- 🟠 P1 (Yüksek): 3.5 gün
- 🟡 P2 (Orta): 1.5 gün

**TOPLAM: ~6 gün**

---

## 🔵 TUTARLILIK VE SON RÖTUŞLAR

> **Kaynak:** Final Review (2025-11-01)  
> **Durum:** Production-ready için kritik detaylar  
> **Öncelik:** P0-P1 (Tutarlılık zorunlu!)

### 1️⃣ Users Modeli Tutarlılığı ⚠️ KRİTİK!

**Sorun:** Dokümanda iki farklı model var:
- Üst bölümde: `core.users.organization_id NOT NULL` (tek org)
- P1'de: `core.user_organizations` pivot tablo (çok org)

**KARAR: PIVOT TABLO (M2M) KULLANILACAK!** ✅

**Güncelleme:**

```sql
-- ❌ KALDIRILAN: core.users.organization_id
ALTER TABLE core.users DROP COLUMN IF EXISTS organization_id;

-- ✅ YENİ: core.users (organization_id yok!)
CREATE TABLE core.users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR(200),
  avatar_url VARCHAR(500),
  
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Email tenant içinde unique (aynı user birden fazla org'da olabilir)
  UNIQUE(tenant_id, email)
);

-- ✅ YENİ: core.user_organizations (M2M)
CREATE TABLE core.user_organizations (
  id SERIAL PRIMARY KEY,
  
  user_id INTEGER NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  permissions JSONB DEFAULT '[]',
  
  is_active BOOLEAN DEFAULT TRUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  
  UNIQUE(user_id, organization_id)
);

-- RLS: User sadece kendi tenant'ındaki kayıtları görür
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON core.users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::INTEGER);

-- RLS: user_organizations da izole
ALTER TABLE core.user_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_orgs_isolation ON core.user_organizations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::INTEGER);
```

**API Değişikliği:**
```javascript
// Kullanıcının aktif organizasyonu JWT'den veya header'dan alınır
// Aktif org doğrulama:
const userOrg = await db.query(`
  SELECT uo.* 
  FROM core.user_organizations uo
  WHERE uo.user_id = $1 
    AND uo.organization_id = $2
    AND uo.is_active = TRUE
`, [userId, orgId]);

if (!userOrg.rows[0]) {
  return res.status(403).json({ error: 'Organization access denied' });
}
```

---

### 2️⃣ Composite FK ile Çapraz Referans Kilidi 🔒 ÖNEMLİ!

**Sorun:** `app.generic_data.table_id` tek kolon FK → Yanlışlıkla başka org'un tablosuna referans verebilir!

**Çözüm: Composite Foreign Key**

```sql
-- ❌ YANLIŞ (Mevcut)
ALTER TABLE app.generic_data
ADD CONSTRAINT fk_table_id FOREIGN KEY (table_id) 
REFERENCES core.table_metadata(id);

-- ✅ DOĞRU (Composite FK)
-- Önce core.table_metadata'ya composite unique constraint ekle
ALTER TABLE core.table_metadata
DROP CONSTRAINT IF EXISTS table_metadata_pkey CASCADE,
ADD CONSTRAINT table_metadata_pkey PRIMARY KEY (id),
ADD CONSTRAINT table_metadata_unique_ctx 
  UNIQUE (tenant_id, organization_id, id);

-- Şimdi composite FK ekle
ALTER TABLE app.generic_data
DROP CONSTRAINT IF EXISTS fk_table_id,
ADD CONSTRAINT fk_generic_data_table
  FOREIGN KEY (tenant_id, organization_id, table_id)
  REFERENCES core.table_metadata(tenant_id, organization_id, id)
  ON DELETE CASCADE;

-- Aynı şekilde created_by / updated_by için:
ALTER TABLE app.generic_data
ADD CONSTRAINT fk_generic_data_creator
  FOREIGN KEY (tenant_id, created_by)
  REFERENCES core.users(tenant_id, id)
  ON DELETE SET NULL;
```

**Uygulanacak Tablolar:**
- ✅ `app.generic_data` → `core.table_metadata`
- ✅ `app.generic_data` → `core.users` (created_by)
- ✅ `core.table_metadata` → `core.organizations`
- ✅ `core.user_organizations` → `core.users`, `core.organizations`

---

### 3️⃣ RLS WITH CHECK - TÜM TABLOLARA! ⚠️ KRİTİK!

**Durum:** Örneklerde gösterildi ama tüm tablolara uygulanmalı!

**Tam Liste:**

```sql
-- 1. core.tenants
ALTER TABLE core.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_owner_access ON core.tenants;

CREATE POLICY tenants_select ON core.tenants
  FOR SELECT
  USING (owner_id = current_setting('app.current_platform_user_id', true)::INTEGER);

CREATE POLICY tenants_insert ON core.tenants
  FOR INSERT
  WITH CHECK (owner_id = current_setting('app.current_platform_user_id', true)::INTEGER);

CREATE POLICY tenants_update ON core.tenants
  FOR UPDATE
  USING (owner_id = current_setting('app.current_platform_user_id', true)::INTEGER)
  WITH CHECK (owner_id = current_setting('app.current_platform_user_id', true)::INTEGER);

CREATE POLICY tenants_delete ON core.tenants
  FOR DELETE
  USING (owner_id = current_setting('app.current_platform_user_id', true)::INTEGER);

-- 2. core.organizations
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_tenant_isolation ON core.organizations;

CREATE POLICY organizations_select ON core.organizations
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND deleted_at IS NULL  -- Soft delete
  );

CREATE POLICY organizations_insert ON core.organizations
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY organizations_update ON core.organizations
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY organizations_delete ON core.organizations
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- 3. core.users
CREATE POLICY users_select ON core.users
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND deleted_at IS NULL
  );

CREATE POLICY users_insert ON core.users
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY users_update ON core.users
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY users_delete ON core.users
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- 4. core.user_organizations (Yeni!)
CREATE POLICY user_orgs_select ON core.user_organizations
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY user_orgs_insert ON core.user_organizations
  FOR INSERT
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    -- Ek kontrol: organization gerçekten bu tenant'a ait mi?
    AND EXISTS (
      SELECT 1 FROM core.organizations o 
      WHERE o.id = organization_id AND o.tenant_id = tenant_id
    )
  );

CREATE POLICY user_orgs_update ON core.user_organizations
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

CREATE POLICY user_orgs_delete ON core.user_organizations
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- 5. core.table_metadata
CREATE POLICY table_metadata_select ON core.table_metadata
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
    AND deleted_at IS NULL
  );

CREATE POLICY table_metadata_insert ON core.table_metadata
  FOR INSERT
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );

CREATE POLICY table_metadata_update ON core.table_metadata
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );

CREATE POLICY table_metadata_delete ON core.table_metadata
  FOR DELETE
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );

-- 6. app.generic_data (EN ÖNEMLİ!)
CREATE POLICY generic_data_select ON app.generic_data
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
    AND deleted_at IS NULL  -- Soft delete
  );

CREATE POLICY generic_data_insert ON app.generic_data
  FOR INSERT
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );

CREATE POLICY generic_data_update ON app.generic_data
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );

CREATE POLICY generic_data_delete ON app.generic_data
  FOR DELETE
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    AND organization_id = current_setting('app.current_organization_id', true)::INTEGER
  );
```

**Uygulanacak:** TÜM core.*, app.* tabloları! ✅

---

### 4️⃣ Context Trigger - Client Verisini EZME! ⚠️ KRİTİK!

**Sorun:** Trigger client'tan gelen değerleri override etmeli!

**Güncellenmiş Trigger:**

```sql
CREATE OR REPLACE FUNCTION core.enforce_tenant_context()
RETURNS TRIGGER AS $$
BEGIN
  -- ⭐ KRİTİK: Client'tan gelen değerleri EZME!
  -- Context'ten al ve OVERRIDE et
  NEW.tenant_id := current_setting('app.current_tenant_id', true)::INTEGER;
  NEW.organization_id := current_setting('app.current_organization_id', true)::INTEGER;
  
  -- NULL kontrolü
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Context not set: app.current_tenant_id is NULL';
  END IF;
  
  IF NEW.organization_id IS NULL AND TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME IN (
    'app.generic_data',
    'core.table_metadata',
    'core.user_organizations'
  ) THEN
    RAISE EXCEPTION 'Context not set: app.current_organization_id is NULL for table %', 
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = core, app, public;  -- ⭐ Fixed search_path
```

**NOT:** 
- Client'tan `tenant_id` veya `organization_id` gönderilse bile EZILIR!
- API'de artık bu alanları body'den almaya gerek YOK!
- Güvenlik 100% garantili! ✅

---

### 5️⃣ GUC/Context Güvenliği - Transaction Kapsamı 🔐

**Güncellenmiş `core.set_context`:**

```sql
CREATE OR REPLACE FUNCTION core.set_context(
  p_titan_id VARCHAR,
  p_organization_id INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_tenant_id INTEGER;
  v_org_check INTEGER;
BEGIN
  -- 1. titan_id'den tenant_id bul
  SELECT id INTO v_tenant_id
  FROM core.tenants
  WHERE titan_id = p_titan_id AND is_active = TRUE;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid titan_id: %', p_titan_id;
  END IF;
  
  -- 2. organization_id varsa, tenant'a ait mi kontrol et
  IF p_organization_id IS NOT NULL THEN
    SELECT id INTO v_org_check
    FROM core.organizations
    WHERE id = p_organization_id 
      AND tenant_id = v_tenant_id 
      AND is_active = TRUE;
    
    IF v_org_check IS NULL THEN
      RAISE EXCEPTION 'Organization % does not belong to tenant %', 
        p_organization_id, v_tenant_id;
    END IF;
  END IF;
  
  -- 3. SET LOCAL kullan (transaction sonunda otomatik reset)
  -- ⭐ LOCAL = Transaction scope!
  PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, true);
  
  IF p_organization_id IS NOT NULL THEN
    PERFORM set_config('app.current_organization_id', p_organization_id::TEXT, true);
  END IF;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path = core, public;  -- ⭐ Fixed search_path
```

**Middleware Kullanımı:**

```javascript
// Her HTTP request için transaction
app.use(async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    // Transaction başlat
    await client.query('BEGIN');
    
    // Context set et (SET LOCAL kapsamında)
    const titanId = req.headers['x-titan-id'];
    const orgId = req.headers['x-organization-id'];
    
    await client.query('SELECT core.set_context($1, $2)', [titanId, orgId]);
    
    // Request'i işle
    req.dbClient = client;
    await next();
    
    // Commit
    await client.query('COMMIT');
  } catch (error) {
    // Rollback
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Context otomatik reset oldu (SET LOCAL + COMMIT/ROLLBACK)
    client.release();
  }
});
```

**Garanti:**
- ✅ Her request ayrı transaction
- ✅ SET LOCAL → Transaction sonunda otomatik reset
- ✅ search_path sabit → SQL injection koruması
- ✅ SECURITY DEFINER → Güvenli erişim

---

### 6️⃣ Silme Zinciri Stratejisi 🗑️

**Sorun:** Yanlışlıkla tenant silme çok tehlikeli!

**Öneri: RESTRICT + Manuel Archive**

```sql
-- ❌ MEVCUT (Tehlikeli!)
CREATE TABLE core.tenants (
  -- ...
  ON DELETE CASCADE  -- Tüm data uçar!
);

-- ✅ ÖNERİLEN (Güvenli!)
-- 1. platform.users → core.tenants: RESTRICT
ALTER TABLE core.tenants
DROP CONSTRAINT IF EXISTS tenants_owner_fkey,
ADD CONSTRAINT tenants_owner_fkey
  FOREIGN KEY (owner_id) 
  REFERENCES platform.users(id) 
  ON DELETE RESTRICT;  -- ⭐ RESTRICT: Manuel onay gerekli

-- 2. core.tenants → core.organizations: RESTRICT
ALTER TABLE core.organizations
DROP CONSTRAINT IF EXISTS organizations_tenant_fkey,
ADD CONSTRAINT organizations_tenant_fkey
  FOREIGN KEY (tenant_id) 
  REFERENCES core.tenants(id) 
  ON DELETE RESTRICT;  -- ⭐ RESTRICT

-- 3. core.organizations → app.generic_data: CASCADE (mantıklı)
ALTER TABLE app.generic_data
DROP CONSTRAINT IF EXISTS generic_data_organization_fkey,
ADD CONSTRAINT generic_data_organization_fkey
  FOREIGN KEY (organization_id) 
  REFERENCES core.organizations(id) 
  ON DELETE CASCADE;  -- ✅ CASCADE: Org silinince data da silinsin

-- 4. Soft delete için helper function
CREATE OR REPLACE FUNCTION core.soft_delete_organization(p_org_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Önce tüm verileri soft delete
  UPDATE app.generic_data 
  SET deleted_at = NOW() 
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  
  UPDATE core.table_metadata 
  SET deleted_at = NOW() 
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  
  UPDATE core.users 
  SET deleted_at = NOW(), is_active = FALSE
  WHERE id IN (
    SELECT user_id FROM core.user_organizations 
    WHERE organization_id = p_org_id
  );
  
  -- Son olarak organization'ı soft delete
  UPDATE core.organizations 
  SET deleted_at = NOW(), is_active = FALSE 
  WHERE id = p_org_id;
  
  RAISE NOTICE 'Organization % soft deleted', p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Hard delete (30 gün sonra)
CREATE OR REPLACE FUNCTION core.purge_deleted_data()
RETURNS VOID AS $$
BEGIN
  DELETE FROM app.generic_data 
  WHERE deleted_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM core.table_metadata 
  WHERE deleted_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM core.organizations 
  WHERE deleted_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Purged data older than 30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Strateji:**
- ✅ Tenant/Organization silme: RESTRICT (önce soft delete)
- ✅ Data silme: CASCADE (org silinince data da gitsin)
- ✅ 30 günlük geri alma süresi (soft delete)
- ✅ Manuel purge (cron job)

---

### 7️⃣ Slug/Email Benzersizliği Politikası 📧

**Slug Normalizasyonu:**

```sql
-- core.organizations.slug için CHECK constraint
ALTER TABLE core.organizations
ADD CONSTRAINT check_slug_format CHECK (
  slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'  -- lowercase + hyphen
  AND length(slug) >= 3
  AND length(slug) <= 100
);

-- Slug generate helper
CREATE OR REPLACE FUNCTION core.generate_slug(p_name TEXT)
RETURNS VARCHAR AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(
      trim(p_name), 
      '[^a-zA-Z0-9\s]', '', 'g'  -- Özel karakterleri kaldır
    ), 
    '\s+', '-', 'g'  -- Boşlukları tire ile değiştir
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: slug otomatik generate
CREATE OR REPLACE FUNCTION core.auto_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := core.generate_slug(NEW.name);
    
    -- Collision check
    WHILE EXISTS (
      SELECT 1 FROM core.organizations 
      WHERE tenant_id = NEW.tenant_id AND slug = NEW.slug AND id != COALESCE(NEW.id, 0)
    ) LOOP
      NEW.slug := NEW.slug || '-' || floor(random() * 1000)::TEXT;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_slug_organizations
  BEFORE INSERT OR UPDATE ON core.organizations
  FOR EACH ROW EXECUTE FUNCTION core.auto_generate_slug();
```

**Email Benzersizliği:**

```sql
-- KARAR: Email TENANT seviyesinde unique (kullanıcı birden fazla org'da olabilir)

-- core.users
ALTER TABLE core.users
ADD CONSTRAINT users_email_unique UNIQUE (tenant_id, email);

-- Email normalizasyon
CREATE OR REPLACE FUNCTION core.normalize_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_email_users
  BEFORE INSERT OR UPDATE ON core.users
  FOR EACH ROW EXECUTE FUNCTION core.normalize_email();
```

**Gerekçe:**
- ✅ Slug: Lowercase + hyphen + collision protection
- ✅ Email: Tenant seviyesinde unique (özgür@hzm.com E-ticaret'te ve Lojistik'te farklı kullanıcı olabilir)
- ✅ Otomatik normalizasyon (trigger)

---

### 8️⃣ Soft-Delete Tutarlılığı 🗑️

**Tüm Soft-Delete Tablolarına `deleted_at` Ekleme:**

```sql
-- core.organizations
ALTER TABLE core.organizations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- core.users
ALTER TABLE core.users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- core.table_metadata
ALTER TABLE core.table_metadata
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- app.generic_data (zaten var)
-- Diğer tablolar...

-- Index (performance!)
CREATE INDEX idx_organizations_deleted ON core.organizations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_deleted ON core.users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_table_metadata_deleted ON core.table_metadata(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_generic_data_deleted ON app.generic_data(deleted_at) WHERE deleted_at IS NOT NULL;
```

**RLS'e Soft-Delete Ekleme (Yukarıda zaten ekledik!):**

```sql
-- Tüm SELECT policy'lerine:
AND deleted_at IS NULL
```

**FK Hedefi Soft-Deleted İse Insert Engelleme:**

```sql
-- Örnek: generic_data eklenirken table_metadata soft-deleted olmamalı
CREATE OR REPLACE FUNCTION core.check_fk_not_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- table_metadata kontrolü
  IF TG_TABLE_NAME = 'generic_data' AND NEW.table_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM core.table_metadata 
      WHERE id = NEW.table_id AND deleted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot insert: table_metadata % is deleted', NEW.table_id;
    END IF;
  END IF;
  
  -- Diğer kontroller...
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_fk_not_deleted_generic_data
  BEFORE INSERT OR UPDATE ON app.generic_data
  FOR EACH ROW EXECUTE FUNCTION core.check_fk_not_deleted();
```

---

## 🎯 MINOR ÖNERİLER (Nice-to-Have)

### 9️⃣ Partitioning Stratejisi 📊

```sql
-- app.generic_data için time-range partitioning
CREATE TABLE app.generic_data (
  -- ... kolonlar ...
) PARTITION BY RANGE (created_at);

-- Aylık partitionlar
CREATE TABLE app.generic_data_2025_01 PARTITION OF app.generic_data
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE app.generic_data_2025_02 PARTITION OF app.generic_data
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Otomatik partition oluşturma (pg_cron ile)
-- NOT: Production'da pg_partman extension kullanılabilir
```

**Avantaj:**
- ✅ Query performance (eski data ayrı partition)
- ✅ Backup kolaylığı (partition bazlı)
- ✅ Purge kolaylığı (DROP PARTITION)

---

### 🔟 Default Organization Migration

**Migration Planına Ekleme:**

```sql
-- Projects → Tenants migration sırasında
INSERT INTO core.tenants (owner_id, titan_id, name, project_type)
SELECT 
  p.owner_id,
  'titan_' || encode(gen_random_bytes(32), 'hex'),
  p.name,
  'custom'
FROM core.projects p;

-- ⭐ HER YENİ TENANT İÇİN DEFAULT ORGANIZATION OLUŞTUR!
INSERT INTO core.organizations (tenant_id, slug, name, is_active)
SELECT 
  t.id,
  'default',
  t.name || ' - Default',
  TRUE
FROM core.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM core.organizations o WHERE o.tenant_id = t.id
);

-- Mevcut verileri default org'a taşı
UPDATE app.generic_data gd
SET organization_id = (
  SELECT id FROM core.organizations o 
  WHERE o.tenant_id = gd.tenant_id AND o.slug = 'default'
)
WHERE organization_id IS NULL;
```

---

### 1️⃣1️⃣ Auth - switch-organization Doğrulama

```javascript
// POST /api/v1/user/switch-organization
async function switchOrganization(req, res) {
  const { organization_id } = req.body;
  const userId = req.user.id;  // JWT'den
  const tenantId = req.tenantId;  // Context'ten
  
  // ⭐ Doğrulama: Kullanıcı bu org'a erişebilir mi?
  const access = await db.query(`
    SELECT uo.* 
    FROM core.user_organizations uo
    WHERE uo.user_id = $1 
      AND uo.tenant_id = $2
      AND uo.organization_id = $3
      AND uo.is_active = TRUE
  `, [userId, tenantId, organization_id]);
  
  if (!access.rows[0]) {
    return res.status(403).json({ 
      error: 'You do not have access to this organization' 
    });
  }
  
  // Yeni token oluştur (org_id ile)
  const token = jwt.sign(
    { 
      user_id: userId, 
      tenant_id: tenantId, 
      organization_id,
      role: access.rows[0].role
    }, 
    JWT_SECRET
  );
  
  res.json({ token, organization: access.rows[0] });
}
```

---

## ✅ TUTARLILIK KONTROLLERİ ÖZETİ

| # | Konu | Durum | Öncelik |
|---|------|-------|---------|
| 1 | Users modeli (M2M pivot) | ✅ Güncellendi | 🔴 P0 |
| 2 | Composite FK | ✅ Eklendi | 🔴 P0 |
| 3 | RLS WITH CHECK (tüm tablolar) | ✅ Tam liste | 🔴 P0 |
| 4 | Trigger override client data | ✅ Vurgulandı | 🔴 P0 |
| 5 | GUC güvenliği (transaction) | ✅ Güncellendi | 🔴 P0 |
| 6 | ON DELETE stratejisi | ✅ RESTRICT önerildi | 🟠 P1 |
| 7 | Slug/email normalization | ✅ CHECK + trigger | 🟠 P1 |
| 8 | Soft-delete tutarlılığı | ✅ RLS + trigger | 🟠 P1 |
| 9 | Partitioning | ✅ Not eklendi | 🟡 P2 |
| 10 | Default org migration | ✅ Script eklendi | 🟡 P2 |
| 11 | Auth validation | ✅ Örnek kod | 🟡 P2 |

---

---

## 🔧 NİHAİ RÖTUŞLAR (Son Kontrol Listesi)

### ✅ Onaylandı
- [x] Users modeli M2M (organization_id kaldırıldı)
- [x] RLS WITH CHECK tüm tablolarda
- [x] Trigger client override
- [x] core.set_context güvenli (SECURITY DEFINER + SET LOCAL)
- [x] Composite FK çapraz referans kilidi

### 🔸 Ek Kontroller

| # | Konu | Aksiyon | Öncelik |
|---|------|---------|---------|
| 1 | Extensions | `CREATE EXTENSION IF NOT EXISTS pgcrypto;` | 🔴 P0 |
| 2 | Platform context | `current_setting('app.current_platform_user_id', true)` → `true` parametresi | 🔴 P0 |
| 3 | Migration role | `CREATE ROLE app_admin; ALTER ROLE app_admin BYPASSRLS;` | 🔴 P0 |
| 4 | Audit FK | `audit_logs.user_id` → `(tenant_id, user_id)` composite FK | 🟠 P1 |
| 5 | Slug UI | Çakışma hatası → "Başka ad deneyin" UX mesajı | 🟠 P1 |
| 6 | New tables RLS | `api_keys, quotas, usage_counters, invites, roles` → RLS şablonu uygula | 🟠 P1 |
| 7 | SSE/Streaming | Long-lived connections için transaction stratejisi | 🟡 P2 |
| 8 | Exception log | `app.current_request_id` → Exception block'ta da logla | 🟡 P2 |

### 🧪 Duman Testleri

```sql
-- 1. Context + RLS
SELECT core.set_context('titan_abc', 1);
SELECT count(*) FROM app.generic_data;  -- Sadece org=1

-- 2. Trigger override (999 ezilmeli)
INSERT INTO app.generic_data (tenant_id, organization_id, table_id, data)
VALUES (999, 999, 1, '{}');

-- 3. Composite FK (başka tenant'ın table_id → hata)
INSERT INTO app.generic_data (table_id, data) VALUES (9999, '{}');  -- FK error

-- 4. Soft-delete (görünmemeli)
UPDATE app.generic_data SET deleted_at=NOW() WHERE id=1;
SELECT * FROM app.generic_data WHERE id=1;  -- boş

-- 5. M2M (yetkisiz org → 403)
-- POST /api/v1/user/switch-organization {org: 999}
```

### 🚀 Deploy Sırası

1. Extensions + şema (RLS disabled)
2. `core.set_context` + middleware
3. Composite FK (mevcut data hizalama)
4. **RLS ENABLE** (tüm tablolar)
5. API/Frontend release
6. Smoke test → Canary → Production

---

**Son Güncelleme:** 2025-11-01 (Final Checklist)  
**Durum:** ✅ Production-Ready!  
**Öncelik:** P0 - Kritik

