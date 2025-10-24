# 📦 Template System

> **Hazır şablonlar ile hızlı başlangıç: E-commerce, Ride-sharing, MLM, Logistics, AI, CRM**

[◀️ Geri: RLS Strategy](04_RLS_Multi_Tenant_Strategy.md) | [Ana Sayfa](README.md) | [İleri: Business Logic ▶️](06_Business_Logic_Modules.md)

---

## 📋 İçindekiler

1. [Template Nedir?](#template-nedir)
2. [6 Kategori Template](#6-kategori-template)
3. [Template Yapısı](#template-yapısı)
4. [Template Installation API](#template-installation-api)
5. [Custom Template Oluşturma](#custom-template-oluşturma)

---

## Template Nedir?

**Template**, yaygın kullanım senaryoları için önceden hazırlanmış tablo şemaları ve ilişkileridir.

### Avantajları

- ✅ **Hızlı başlangıç** - 5 dakikada e-ticaret sitesi
- ✅ **Best practices** - Doğru ilişkiler, indexler, constraintler
- ✅ **Özelleştirilebilir** - İhtiyaca göre düzenlenebilir
- ✅ **Dokümante** - Her template için guide var
- ✅ **Güncellenebilir** - Yeni features eklenir

### Template vs Custom

| Özellik | Template | Custom |
|---------|----------|--------|
| **Hız** | 5 dakika | 2-3 hafta |
| **Hata riski** | Düşük | Yüksek |
| **Best practices** | ✅ Var | ⚠️ Developer'a bağlı |
| **Dokümantasyon** | ✅ Hazır | ❌ Kendin yaz |
| **Özelleştirme** | ✅ Kolay | ✅ Tam kontrol |

---

## 6 Kategori Template

### 1. E-Commerce (Trendyol, Amazon)

**Tablolar:**
- `products` - Ürünler
- `categories` - Kategoriler
- `customers` - Müşteriler
- `cart` - Sepet
- `orders` - Siparişler
- `order_items` - Sipariş detayları
- `reviews` - Yorumlar
- `wishlist` - Favoriler
- `coupons` - Kuponlar
- `shipping_methods` - Kargo yöntemleri

**İlişkiler:**
```
products → categories (Many-to-One)
products → reviews (One-to-Many)
cart → products (Many-to-Many)
orders → order_items → products
customers → orders (One-to-Many)
customers → wishlist → products
```

**Örnek Kullanım:**
```bash
POST /api/v1/templates/install
{
  "template_type": "ecommerce",
  "project_id": 123
}
```

### 2. Ride-Sharing (Uber, Lyft)

**Tablolar:**
- `drivers` - Sürücüler
- `passengers` - Yolcular
- `vehicles` - Araçlar
- `rides` - Sürüşler
- `locations` - Lokasyonlar
- `ratings` - Değerlendirmeler
- `payments` - Ödemeler
- `surge_pricing` - Dinamik fiyatlandırma

**İlişkiler:**
```
drivers → vehicles (One-to-Many)
drivers → rides (One-to-Many)
passengers → rides (One-to-Many)
rides → ratings (One-to-Many)
rides → payments (One-to-One)
```

### 3. MLM / Network Marketing (Forever Living, Herbalife)

**Tablolar:**
- `distributors` - Distribütörler
- `hierarchy` - Ağaç yapısı
- `commissions` - Komisyonlar
- `ranks` - Seviyeler
- `bonuses` - Bonuslar
- `sales` - Satışlar
- `team_performance` - Takım performansı

**İlişkiler:**
```
distributors → hierarchy (Self-referencing)
distributors → sales (One-to-Many)
sales → commissions (One-to-Many)
distributors → ranks (Many-to-One)
```

**MLM Logic:**
```javascript
// 5 seviye komisyon
Level 1: %10
Level 2: %5
Level 3: %3
Level 4: %2
Level 5: %1
```

### 4. Logistics (MNG, Aras, Yurtiçi Kargo)

**Tablolar:**
- `shipments` - Gönderiler
- `tracking` - Takip
- `warehouses` - Depolar
- `routes` - Rotalar
- `delivery_personnel` - Kurye
- `delivery_zones` - Bölgeler
- `pricing` - Fiyatlandırma

**İlişkiler:**
```
shipments → tracking (One-to-Many)
shipments → warehouses (Many-to-One)
shipments → routes (Many-to-One)
shipments → delivery_personnel (Many-to-One)
```

### 5. AI / ChatGPT

**Tablolar:**
- `conversations` - Konuşmalar
- `messages` - Mesajlar
- `models` - AI modelleri
- `prompts` - Prompt'lar
- `usage` - Kullanım istatistikleri
- `fine_tuning` - Model eğitimi

**İlişkiler:**
```
conversations → messages (One-to-Many)
messages → models (Many-to-One)
conversations → usage (One-to-Many)
```

### 6. CRM (Salesforce)

**Tablolar:**
- `leads` - Potansiyel müşteriler
- `contacts` - İletişimler
- `accounts` - Hesaplar
- `opportunities` - Fırsatlar
- `deals` - Anlaşmalar
- `tasks` - Görevler
- `notes` - Notlar

**İlişkiler:**
```
leads → contacts (One-to-One)
contacts → accounts (Many-to-One)
opportunities → accounts (Many-to-One)
deals → opportunities (One-to-One)
```

---

## Template Yapısı

### JSON Format

```json
{
  "template_id": "ecommerce-basic-v1",
  "name": "E-Commerce Basic",
  "description": "Temel e-ticaret sistemi (ürün, sepet, sipariş)",
  "version": "1.0.0",
  "category": "ecommerce",
  "tables": [
    {
      "name": "products",
      "display_name": "Ürünler",
      "icon": "shopping-bag",
      "fields": [
        {
          "name": "name",
          "type": "string",
          "label": "Ürün Adı",
          "required": true,
          "maxLength": 200
        },
        {
          "name": "sku",
          "type": "string",
          "label": "SKU",
          "required": true,
          "unique": true,
          "maxLength": 100
        },
        {
          "name": "price",
          "type": "decimal",
          "label": "Fiyat",
          "required": true,
          "precision": 12,
          "scale": 2,
          "defaultValue": "0.00"
        },
        {
          "name": "stock",
          "type": "integer",
          "label": "Stok",
          "required": true,
          "defaultValue": 0
        },
        {
          "name": "category_id",
          "type": "reference",
          "label": "Kategori",
          "references": "categories",
          "required": true
        },
        {
          "name": "images",
          "type": "array",
          "label": "Görseller",
          "required": false
        },
        {
          "name": "is_featured",
          "type": "boolean",
          "label": "Öne Çıkan",
          "defaultValue": false
        }
      ],
      "indexes": [
        { "columns": ["tenant_id", "sku"], "unique": true },
        { "columns": ["category_id"] },
        { "columns": ["tenant_id", "is_featured"], "where": "is_featured = TRUE" }
      ]
    },
    {
      "name": "categories",
      "display_name": "Kategoriler",
      "icon": "folder",
      "fields": [
        {
          "name": "name",
          "type": "string",
          "label": "Kategori Adı",
          "required": true,
          "maxLength": 200
        },
        {
          "name": "slug",
          "type": "string",
          "label": "Slug",
          "required": true,
          "maxLength": 200
        },
        {
          "name": "parent_id",
          "type": "reference",
          "label": "Üst Kategori",
          "references": "categories",
          "required": false
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "products",
      "to": "categories",
      "type": "many-to-one",
      "foreign_key": "category_id"
    }
  ],
  "seed_data": {
    "categories": [
      { "name": "Elektronik", "slug": "elektronik" },
      { "name": "Giyim", "slug": "giyim" },
      { "name": "Ev & Yaşam", "slug": "ev-yasam" }
    ]
  }
}
```

---

## Template Installation API

### Endpoints

#### 1. List Available Templates

```javascript
GET /api/v1/templates

Response:
{
  "success": true,
  "data": [
    {
      "id": "ecommerce-basic-v1",
      "name": "E-Commerce Basic",
      "category": "ecommerce",
      "description": "Temel e-ticaret sistemi",
      "tables_count": 10,
      "estimated_time": "2 minutes"
    },
    {
      "id": "ridesharing-uber-v1",
      "name": "Ride-Sharing (Uber)",
      "category": "ridesharing",
      "description": "Uber benzeri sistem",
      "tables_count": 8,
      "estimated_time": "2 minutes"
    }
  ]
}
```

#### 2. Get Template Details

```javascript
GET /api/v1/templates/:template_id

Response:
{
  "success": true,
  "data": {
    "id": "ecommerce-basic-v1",
    "name": "E-Commerce Basic",
    "tables": [...],  // Full schema
    "relationships": [...],
    "seed_data": {...}
  }
}
```

#### 3. Install Template

```javascript
POST /api/v1/templates/install
{
  "project_id": 123,
  "template_id": "ecommerce-basic-v1",
  "options": {
    "install_seed_data": true,
    "customize": {
      "products": {
        "add_fields": [
          { "name": "brand", "type": "string" }
        ]
      }
    }
  }
}

Response:
{
  "success": true,
  "data": {
    "tables_created": 10,
    "records_seeded": 25,
    "time_taken_ms": 1250
  }
}
```

### Installation Process

```javascript
// Node.js - Template installation
async function installTemplate(projectId, templateId, options = {}) {
  const template = await loadTemplate(templateId);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Create tables
    for (const table of template.tables) {
      await createTableFromTemplate(client, projectId, table);
    }
    
    // 2. Add relationships (foreign keys)
    for (const rel of template.relationships) {
      await addRelationship(client, projectId, rel);
    }
    
    // 3. Seed data (optional)
    if (options.install_seed_data) {
      await seedData(client, projectId, template.seed_data);
    }
    
    // 4. Mark project as using template
    await client.query(`
      UPDATE core.projects 
      SET template_type = $1, template_config = $2 
      WHERE id = $3
    `, [templateId, template, projectId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      tables_created: template.tables.length,
      records_seeded: countSeedRecords(template.seed_data)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Custom Template Oluşturma

### 1. Template File Oluştur

```javascript
// templates/my-custom-template.json
{
  "template_id": "my-custom-v1",
  "name": "My Custom Template",
  "description": "Özel iş modelim için",
  "category": "custom",
  "tables": [
    // ... tablolar
  ]
}
```

### 2. Template'i Yükle

```bash
node scripts/load-template.js templates/my-custom-template.json
```

### 3. Test Et

```bash
curl -X POST http://localhost:3000/api/v1/templates/install \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "project_id": 123,
    "template_id": "my-custom-v1"
  }'
```

---

## Best Practices

### ✅ DO

1. **Field naming** - Snake_case kullan (`created_at`, `order_id`)
2. **Relationships** - Foreign key'leri doğru tanımla
3. **Indexes** - Sık aranan kolonlara index ekle
4. **Seed data** - Minimal test verisi ekle
5. **Versioning** - Template versiyonlarını yönet

### ❌ DON'T

1. **Hardcode tenant_id** - Template'te tenant_id ekleme (otomatik!)
2. **Eksik constraints** - UNIQUE, CHECK constraints unutma
3. **Fazla tablo** - Başlangıç için minimum tablo yeter
4. **Seed data overload** - 1000 satır seed data gereksiz

---

## 🔗 İlgili Dökümanlar

- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - `core.projects` (template_type)
- [06_Business_Logic_Modules.md](06_Business_Logic_Modules.md) - Template logic
- [12_Table_Template.md](12_Table_Template.md) - Tablo standardı

---

**[◀️ Geri: RLS Strategy](04_RLS_Multi_Tenant_Strategy.md) | [Ana Sayfa](README.md) | [İleri: Business Logic ▶️](06_Business_Logic_Modules.md)**

