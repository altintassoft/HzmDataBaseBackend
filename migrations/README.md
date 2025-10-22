# 🗄️ Database Migrations

> **HZM Veri Tabanı Migration Kuralları ve Rehberi**

---

## 📚 Mevcut Migration'lar

| # | Dosya | Açıklama | Durum |
|---|-------|----------|-------|
| 001 | `initial_schema.sql` | Core schemas + tables (tenants, users, projects, generic_data) | ✅ Production |
| 002 | `seed_data.sql` | İlk tenant (#1) + Admin user (ozgurhzm@gmail.com) | ✅ Production |
| 003 | `add_api_keys.sql` | API Key columns (api_key, api_key_hash, timestamps) | ✅ Production |
| 004 | `fix_api_key_length.sql` | VARCHAR(64) → VARCHAR(100) | ✅ Production |
| 005 | `add_api_password_plain.sql` | API Password column (plain text) | ✅ Production |
| 006 | `create_master_admin.sql` | Master Admin user (ozgurhzm@hzmsoft.com) | ✅ Production |

---

## 🎯 Migration Kuralları

### 🚨 KURAL 1: PRODUCTION'DA ÇALIŞMIŞ MI?

#### ✅ **EĞER PRODUCTION'DA ÇALIŞMIŞSA:**

**❌ ESKİ MIGRATION'A DOKUNMA!**
- Dosyayı değiştirme
- SQL'i değiştirme
- Sadece YENİ migration ekle!

**✅ YENİ MIGRATION EKLE:**
```bash
# Yeni dosya oluştur
007_your_new_migration.sql

# İçeriği yaz
ALTER TABLE core.users ADD COLUMN new_column TEXT;

# Git commit + push
git add migrations/007_your_new_migration.sql
git commit -m "feat: Add new_column to users"
git push origin main
```

**SEBEP:**
- ⚠️ Railway'de zaten çalışmış
- ⚠️ `schema_migrations` table'da kayıtlı
- ⚠️ Eski migration'ı değiştirirsen → TUTARSIZLIK!
- ⚠️ Yeni backend'ler farklı çalışır

---

#### ✅ **EĞER HENÜZ DEVELOPMENT'TAYSA (Production'da YOK):**

**✅ ESKİ MIGRATION'I DÜZELTEBİLİRSİN!**
```bash
# Mevcut dosyayı düzenle
nano migrations/006_create_master_admin.sql

# Eklemeler yap
ALTER TABLE core.users ADD COLUMN new_column TEXT;

# Git commit + push
git add migrations/006_create_master_admin.sql
git commit -m "feat: Add new_column to master admin migration"
git push origin main
```

**SEBEP:**
- ✅ Kimse kullanmıyor
- ✅ Dosya sayısı az olur
- ✅ History daha temiz

---

### 📋 KURAL 2: Production Check

**Production'da çalışmış mı kontrol et:**

```sql
-- Railway → PostgreSQL → Connect → Query
SELECT * FROM public.schema_migrations 
WHERE migration_name = '006_create_master_admin.sql';

-- EĞER KAYIT VARSA → PRODUCTION'DA! (YENİ MIGRATION EKLE!)
-- EĞER KAYIT YOKSA → DEVELOPMENT'TA! (ESKİ DOSYAYI DÜZELT!)
```

---

### 🔄 KURAL 3: Forward-Only Migrations

**❌ ROLLBACK YASAK!**

Yanlış migration yazarsan:
- ❌ Eski migration'ı silme
- ❌ Eski migration'ı değiştirme
- ✅ YENİ migration ile DÜZELT!

**Örnek:**
```sql
-- 005_wrong_column.sql (YANLIŞLIKLA)
ALTER TABLE core.users ADD COLUMN wrong_name TEXT;

-- ❌ 005'i silme!
-- ✅ 006 oluştur:
ALTER TABLE core.users DROP COLUMN wrong_name;
ALTER TABLE core.users ADD COLUMN correct_name TEXT;
```

---

### 🛡️ KURAL 4: Idempotent SQL

**Her migration TEKRAR çalıştırılabilir olmalı!**

```sql
-- ❌ KÖTÜ:
ALTER TABLE core.users ADD COLUMN api_key VARCHAR(100);
-- 2. kez çalışırsa HATA!

-- ✅ İYİ:
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key VARCHAR(100);
-- 2. kez çalışırsa ATLAYACAK!

-- ✅ İYİ:
CREATE TABLE IF NOT EXISTS core.users (...);
CREATE INDEX IF NOT EXISTS idx_users_email ON core.users(email);
```

---

### 📝 KURAL 5: Migration Formatı

**Dosya Adı:**
```
<number>_<action>_<description>.sql

Örnekler:
001_initial_schema.sql
002_seed_data.sql
003_add_api_keys.sql
004_fix_api_key_length.sql
```

**Dosya İçeriği:**
```sql
-- Migration: 007_your_migration.sql
-- Description: What does this migration do?
-- Author: HZM Platform
-- Date: 2025-10-22

-- SQL statements here
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS new_column TEXT;

-- Always end with empty line

```

---

## 🚀 Yeni Migration Ekleme Rehberi

### ADIM 1: Yeni Migration Dosyası Oluştur

```bash
# migrations/ klasöründe
cd migrations/

# Son numarayı bul
ls -1 *.sql | tail -1
# → 006_create_master_admin.sql

# Yeni dosya oluştur (007)
nano 007_your_new_migration.sql
```

### ADIM 2: SQL Yaz

```sql
-- Migration: 007_your_new_migration.sql
-- Description: Add phone number to users
-- Author: HZM Platform
-- Date: 2025-10-22

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_phone ON core.users(phone);

```

### ADIM 3: Test Et (Local)

```bash
# Docker Compose ile test
docker-compose up -d

# Backend start
npm run dev

# Migration çalıştı mı kontrol et
# Logs'da göreceksin:
# ✅ Running migration: 007_your_new_migration.sql
```

### ADIM 4: Commit + Push

```bash
git add migrations/007_your_new_migration.sql
git commit -m "feat: Add phone column to users"
git push origin main
```

### ADIM 5: Railway Auto-Deploy

Railway otomatik deploy edecek:
1. GitHub push algılandı
2. Docker build başladı
3. Migration script çalıştı
4. ✅ 007 executed successfully!

---

## 📊 Migration Tracking

**`public.schema_migrations` tablosu:**

```sql
CREATE TABLE public.schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Çalışan migration'ları görmek için:**

```sql
SELECT * FROM public.schema_migrations ORDER BY id;
```

**Output:**
```
id | migration_name                 | executed_at
---|--------------------------------|-------------------------
1  | 001_initial_schema.sql         | 2025-10-22 07:00:00
2  | 002_seed_data.sql              | 2025-10-22 07:00:01
3  | 003_add_api_keys.sql           | 2025-10-22 10:00:00
4  | 004_fix_api_key_length.sql     | 2025-10-22 10:05:00
5  | 005_add_api_password_plain.sql | 2025-10-22 10:30:00
6  | 006_create_master_admin.sql    | 2025-10-22 12:00:00
```

---

## ⚠️ Sık Yapılan Hatalar

### ❌ HATA 1: Production Migration'ını Değiştirmek

```sql
-- ❌ YANLIŞ:
# 003_add_api_keys.sql dosyasını düzenledim (zaten production'da!)
ALTER TABLE core.users ADD COLUMN api_key VARCHAR(200);  # 100'den 200'e değiştirdim

# SORUN: Railway'de VARCHAR(100), yeni backend'de VARCHAR(200) olacak!
```

**✅ DOĞRU:**
```sql
# 007_extend_api_key.sql (YENİ DOSYA)
ALTER TABLE core.users ALTER COLUMN api_key TYPE VARCHAR(200);
```

---

### ❌ HATA 2: Idempotent Olmayan SQL

```sql
-- ❌ YANLIŞ:
ALTER TABLE core.users ADD COLUMN phone VARCHAR(20);
# 2. kez çalışırsa: "column already exists" hatası!

-- ✅ DOĞRU:
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
```

---

### ❌ HATA 3: Migration Numarasını Atlamak

```sql
-- ❌ YANLIŞ:
006_create_master_admin.sql
008_add_phone.sql  # 007'yi atladık!

-- ✅ DOĞRU:
006_create_master_admin.sql
007_add_phone.sql
008_add_address.sql
```

---

## 🎯 Özet

### ✅ YAPILACAKLAR:

1. **Production'da çalışmışsa** → YENİ migration EKLE!
2. **Development'taysa** → Eski migration'ı DÜZELTEBİLİRSİN!
3. **Her zaman idempotent SQL yaz** (IF NOT EXISTS)
4. **Forward-only migrations** (rollback yok!)
5. **Migration tracking kullan** (schema_migrations)

### ❌ YAPILMAYACAKLAR:

1. ❌ Production migration'ını değiştirme
2. ❌ Migration'ları silme
3. ❌ Numaraları atlama
4. ❌ Rollback için SQL silme

---

## 📞 Yardım

Sorular için:
- 📧 ozgurhzm@hzmsoft.com
- 📚 [Backend Phase Plan](../HzmVeriTabaniYolHaritasi/BACKEND_PHASE_PLAN.md)
- 🗄️ [Tablolar Dokümantasyonu](../HzmVeriTabaniYolHaritasi/TABLOLAR.md)

---

**Son Güncelleme:** 2025-10-22
**Versiyon:** 1.0

