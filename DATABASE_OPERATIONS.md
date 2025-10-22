# 🗄️ HZM VERİ TABANI - İŞLEM REHBERİ

## 📋 İKİ FARKLI İŞLEM TÜRÜ

HZM Veri Tabanı'nda iki farklı işlem türü vardır ve **her biri farklı yöntemle yapılır:**

---

## 1️⃣ VERİ İŞLEMLERİ (CRUD Operations)

**Ne yapılır:**
- ✅ Veri ekleme (INSERT)
- ✅ Veri okuma (SELECT)
- ✅ Veri güncelleme (UPDATE)
- ✅ Veri silme (DELETE)

**Nasıl yapılır:**
- 🔑 **Master Admin API Key + Password** ile
- 🖥️ **Terminal/curl** veya **Python/Node.js** script'leri ile
- 🌐 **HTTP API** endpoint'leri üzerinden

**Örnek:**
```bash
# Veri ekleme
curl -X POST \
     -H "X-API-Key: hzm_xxx" \
     -H "X-API-Password: xxx" \
     -H "Content-Type: application/json" \
     -d '{"table_name": "customers", "data": {"name": "John"}}' \
     https://hzmdatabasebackend-production.up.railway.app/api/v1/protected/data

# Veri okuma
curl -H "X-API-Key: hzm_xxx" \
     -H "X-API-Password: xxx" \
     'https://hzmdatabasebackend-production.up.railway.app/api/v1/protected/data?table_name=customers&limit=10'
```

**Dokümantasyon:**
- 📄 `HzmVeriTabaniBackend/API_AUTHENTICATION.md`
- 🧪 `HzmVeriTabaniBackend/test-api-key.sh` (test script)

---

## 2️⃣ SCHEMA İŞLEMLERİ (DDL Operations)

**Ne yapılır:**
- ✅ Tablo oluşturma (CREATE TABLE)
- ✅ Tablo silme (DROP TABLE)
- ✅ Kolon ekleme (ALTER TABLE ADD COLUMN)
- ✅ Kolon silme (ALTER TABLE DROP COLUMN)
- ✅ Kolon düzeltme (ALTER TABLE ALTER COLUMN)
- ✅ Index ekleme (CREATE INDEX)
- ✅ Foreign key ekleme (ADD CONSTRAINT)
- ✅ RLS policy ekleme (CREATE POLICY)

**Nasıl yapılır:**
- 📁 **`HzmVeriTabaniBackend/migrations/` klasöründe** yeni dosya oluştur
- 🔢 **Sıralı numara** ile (008, 009, 010, ...)
- 💾 **SQL dosyası** olarak kaydet
- 🚀 **Git push** yap → Railway otomatik deploy eder ve migration'ı çalıştırır

**Örnek:**
```sql
-- HzmVeriTabaniBackend/migrations/008_add_full_name_to_users.sql

-- Description: Add full_name column to core.users table
-- Author: HZM Platform
-- Date: 2025-10-22

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
```

**İşlem Adımları:**
1. Yeni migration dosyası oluştur
2. SQL komutlarını yaz (idempotent olmalı!)
3. Git commit + push
4. Railway otomatik deploy eder
5. Migration çalışır ve schema güncellenir

**Dokümantasyon:**
- 📄 `HzmVeriTabaniBackend/migrations/README.md`

---

## 📊 KARŞILAŞTIRMA TABLOSU

| İşlem Türü | Yöntem | Dosya/Endpoint | Otomatik Deploy | Geri Alınabilir |
|------------|--------|----------------|-----------------|-----------------|
| **Veri Ekleme** | API Key + curl | `/api/v1/protected/data` | ❌ | ✅ (DELETE ile) |
| **Veri Okuma** | API Key + curl | `/api/v1/protected/data` | ❌ | N/A |
| **Veri Güncelleme** | API Key + curl | `/api/v1/protected/data/:id` | ❌ | ✅ (UPDATE ile) |
| **Veri Silme** | API Key + curl | `/api/v1/protected/data/:id` | ❌ | ⚠️ (Dikkatli!) |
| **Tablo Oluştur** | Migration SQL | `migrations/008_xxx.sql` | ✅ | ⚠️ (Forward-only) |
| **Kolon Ekle** | Migration SQL | `migrations/009_xxx.sql` | ✅ | ⚠️ (Forward-only) |
| **Index Ekle** | Migration SQL | `migrations/010_xxx.sql` | ✅ | ⚠️ (Forward-only) |

---

## 🔍 HANGI YÖNTEM NE ZAMAN?

### ✅ API Key Kullan (Terminal/curl):
- Müşteri verisi ekliyorsan
- Ürün bilgisi güncelleyeceksen
- Rapor almak istiyorsan
- Test verisi ekleyeceksen
- Toplu veri import edeceksen

### ✅ Migration Dosyası Oluştur:
- Yeni tablo oluşturacaksan
- Mevcut tabloya kolon ekleyeceksen
- Kolon tipini değiştireceksen
- Index ekleyeceksen
- Foreign key tanımlayacaksan
- RLS policy ekleyeceksen
- Database schema'sını güncelleyeceksen

---

## 💡 ÖRNEKLER

### Örnek 1: Yeni Müşteri Ekleme
**DURUM:** Sisteme yeni müşteri eklemek istiyorum.
**YÖNTEM:** ✅ Master Admin API Key ile curl

```bash
curl -X POST \
     -H "X-API-Key: $MASTER_ADMIN_API_KEY" \
     -H "X-API-Password: $MASTER_ADMIN_API_PASSWORD" \
     -H "Content-Type: application/json" \
     -d '{
       "table_name": "customers",
       "data": {
         "name": "Ahmet Yılmaz",
         "email": "ahmet@example.com",
         "phone": "+90 555 123 4567"
       }
     }' \
     $BACKEND_URL/api/v1/protected/data
```

---

### Örnek 2: Müşteri Tablosuna "Vergi No" Kolonu Ekleme
**DURUM:** Müşteri tablosuna vergi numarası kolonu eklemek istiyorum.
**YÖNTEM:** ✅ Migration dosyası oluştur

**Adım 1:** Yeni dosya oluştur:
```bash
# HzmVeriTabaniBackend/migrations/008_add_tax_number_to_customers.sql
```

**Adım 2:** SQL komutlarını yaz:
```sql
-- Migration: 008_add_tax_number_to_customers.sql
-- Description: Add tax_number column to customers table
-- Author: HZM Platform
-- Date: 2025-10-22

ALTER TABLE app.customers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(20);

-- Optional: Add index
CREATE INDEX IF NOT EXISTS idx_customers_tax_number 
ON app.customers(tax_number) 
WHERE tax_number IS NOT NULL;
```

**Adım 3:** Git push:
```bash
git add migrations/008_add_tax_number_to_customers.sql
git commit -m "feat: Add tax_number column to customers table"
git push origin main
```

**Adım 4:** Railway otomatik deploy eder ve migration'ı çalıştırır!

---

### Örnek 3: Müşteri Verilerini Toplu Güncelleme
**DURUM:** Tüm müşterilerin telefon formatını güncellemek istiyorum.
**YÖNTEM:** ✅ Master Admin API Key ile Python script

```python
import requests

API_KEY = "hzm_xxx"
API_PASSWORD = "xxx"
BACKEND_URL = "https://hzmdatabasebackend-production.up.railway.app"

headers = {
    "X-API-Key": API_KEY,
    "X-API-Password": API_PASSWORD,
    "Content-Type": "application/json"
}

# 1. Tüm müşterileri al
response = requests.get(
    f"{BACKEND_URL}/api/v1/protected/data",
    headers=headers,
    params={"table_name": "customers", "limit": 1000}
)

customers = response.json()["data"]

# 2. Her müşteri için telefon formatını güncelle
for customer in customers:
    # Telefon formatını düzenle
    # ... işlemler ...
    
    # Güncelle
    requests.put(
        f"{BACKEND_URL}/api/v1/protected/data/{customer['id']}",
        headers=headers,
        json={"data": customer}
    )
```

---

### Örnek 4: Yeni "Orders" Tablosu Oluşturma
**DURUM:** Sipariş takibi için yeni tablo oluşturmak istiyorum.
**YÖNTEM:** ✅ Migration dosyası oluştur

**Dosya:** `migrations/009_create_orders_table.sql`

```sql
-- Migration: 009_create_orders_table.sql
-- Description: Create orders table for order management
-- Author: HZM Platform
-- Date: 2025-10-22

CREATE TABLE IF NOT EXISTS app.orders (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  customer_id INTEGER NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON app.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON app.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON app.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON app.orders(order_date);

-- RLS Policy
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_isolation ON app.orders;
CREATE POLICY orders_tenant_isolation ON app.orders
  USING (tenant_id = app.current_tenant());
```

---

## 🚨 YAPILAMAYACAKLAR

### ❌ API Key ile Schema Değişikliği YAPMA!
```bash
# YANLIŞ! Bu çalışmaz!
curl -X POST \
     -H "X-API-Key: xxx" \
     -d "ALTER TABLE users ADD COLUMN age INTEGER" \
     $BACKEND_URL/api/v1/xxx
```

**Neden:** Güvenlik riski! Schema değişiklikleri sadece migration dosyaları ile yapılmalı.

---

### ❌ Migration Dosyası ile Veri Ekleme/Silme YAPMA!
```sql
-- YANLIŞ! Migration'da veri silme yapma!
DELETE FROM app.customers WHERE id = 123;
```

**Neden:** 
- Forward-only migration prensibi ihlali
- Veri kaybı riski
- Rollback zorluğu

**İstisna:** Seed data (ilk kurulum verileri) eklenebilir (örnek: `002_seed_data.sql`)

---

## 📚 KAYNAKLAR

### Veri İşlemleri (CRUD):
- 📄 `HzmVeriTabaniBackend/API_AUTHENTICATION.md`
- 🧪 `HzmVeriTabaniBackend/test-api-key.sh`
- 🔐 `.env.example` (Master Admin credentials)

### Schema İşlemleri (DDL):
- 📄 `HzmVeriTabaniBackend/migrations/README.md`
- 📁 `HzmVeriTabaniBackend/migrations/` (örnek dosyalar)
- 📊 `HzmVeriTabaniYolHaritasi/BACKEND_PHASE_PLAN.md`

### Genel Dokümantasyon:
- 📄 `README.md` (proje ana dokümantasyonu)
- 📄 `BACKEND_CHECKLIST.md` (backend geliştirme checklist)

---

## 🎯 ÖZET

| Soru | Cevap |
|------|-------|
| **Veri eklemek istiyorum** | → Master Admin API Key + curl kullan |
| **Veri okumak istiyorum** | → Master Admin API Key + curl kullan |
| **Veri silmek istiyorum** | → Master Admin API Key + curl kullan |
| **Tablo oluşturmak istiyorum** | → migrations/ klasöründe SQL dosyası oluştur |
| **Kolon eklemek istiyorum** | → migrations/ klasöründe SQL dosyası oluştur |
| **Index eklemek istiyorum** | → migrations/ klasöründe SQL dosyası oluştur |
| **Foreign key eklemek istiyorum** | → migrations/ klasöründe SQL dosyası oluştur |

---

**📅 Son Güncelleme:** 22 Ekim 2025  
**🔄 Versiyon:** 1.0.0 - Initial Release  
**👤 Yazar:** HZM Platform

**⚠️ ÖNEMLİ:** Bu iki yöntemi karıştırma! Schema işlemleri için migration, veri işlemleri için API Key kullan!

