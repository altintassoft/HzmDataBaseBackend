# 🔐 HZM PLATFORM - API KEY AUTHENTICATION

## 📋 Genel Bakış

HZM Platform, **3 katmanlı güvenlik sistemi** ile çalışır:

1. **JWT Token** (Web Kullanıcıları için)
   - Email + Password ile giriş
   - Session-based authentication
   - Frontend uygulamaları için

2. **API Key** (Programatik Erişim için)
   - Uygulamalar arası iletişim
   - Terminal/CLI erişimi
   - Third-party entegrasyonlar

3. **API Password** (İkinci Doğrulama Katmanı)
   - API Key ile birlikte kullanılır
   - Çift faktörlü güvenlik
   - Ek koruma katmanı

---

## 🚀 Hızlı Başlangıç

### 1️⃣ Master Admin API Key Alma

**Frontend'den:**
```
1. http://localhost:5173 veya Netlify URL'ine git
2. ozgurhzm@gmail.com ile login yap (şifre: 135427)
3. Admin Panel -> Sistem Ayarları'na git
4. Master Admin API bölümünden API Key ve Password'ü kopyala
5. Eğer yoksa, "Generate API Key" butonuna tıkla
```

### 2️⃣ Terminal'den Test

```bash
# Test script'i çalıştır
./test-api-key.sh

# Manuel test
curl -H "X-API-Key: hzm_xxxxxx" \
     -H "X-API-Password: your-password" \
     https://hzmdatabasebackend-production.up.railway.app/api/v1/protected/test
```

---

## 📡 Protected Endpoints

### 🔹 Authentication Test
```bash
GET /api/v1/protected/test
```
Basit authentication testi. API Key ve Password'ün çalışıp çalışmadığını kontrol eder.

**Response:**
```json
{
  "success": true,
  "message": "API Key authentication successful!",
  "user": {
    "id": 1,
    "email": "ozgurhzm@hzmsoft.com",
    "role": "master_admin",
    "full_name": "Özgür Altıntaş - Master Admin"
  }
}
```

---

### 🔹 Kimlik Bilgisi
```bash
GET /api/v1/protected/whoami
```
Mevcut authenticated user bilgisini döner.

---

### 🔹 Veri Ekleme
```bash
POST /api/v1/protected/data
Content-Type: application/json

{
  "table_name": "customers",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+90 555 123 4567"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data created successfully",
  "data": {
    "id": 123,
    "table_name": "customers",
    "data": {...},
    "created_at": "2025-10-22T19:00:00.000Z"
  }
}
```

---

### 🔹 Veri Okuma
```bash
GET /api/v1/protected/data?table_name=customers&limit=10&offset=0
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 123,
      "table_name": "customers",
      "data": {...},
      "created_at": "2025-10-22T19:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0
  }
}
```

---

### 🔹 Admin-Only Endpoint
```bash
GET /api/v1/protected/admin/test
```
**Requires:** `role='admin'` or `role='master_admin'`

---

### 🔹 Master Admin-Only Endpoint
```bash
GET /api/v1/protected/master-admin/test
```
**Requires:** `role='master_admin'`

---

## 🔑 Authentication Detayları

### Headers

**Gerekli Header'lar:**
```
X-API-Key: hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-API-Password: your-24-character-password-here
```

### Hata Kodları

| HTTP Status | Açıklama |
|-------------|----------|
| `401` | Missing credentials (Header'lar eksik) |
| `401` | Invalid API Key (API Key bulunamadı) |
| `401` | Invalid API Password (Şifre yanlış) |
| `403` | Forbidden (Yetkisiz erişim - role kontrolü) |
| `500` | Internal server error |

### Hata Response Örnekleri

**Missing Credentials:**
```json
{
  "success": false,
  "error": "Missing credentials",
  "message": "Both X-API-Key and X-API-Password headers required",
  "required": {
    "headers": ["X-API-Key", "X-API-Password"]
  },
  "example": {
    "X-API-Key": "hzm_xxxxxxxx...",
    "X-API-Password": "your-api-password-here"
  }
}
```

**Invalid API Key:**
```json
{
  "success": false,
  "error": "Invalid API Key",
  "message": "API Key not found or user is inactive"
}
```

**Invalid API Password:**
```json
{
  "success": false,
  "error": "Invalid API Password",
  "message": "API Password does not match"
}
```

**Forbidden (role check):**
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Master Admin role required",
  "yourRole": "admin"
}
```

---

## 🛡️ Güvenlik

### API Key Format
```
hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
│   │
│   └─ 48 karakter (hex)
└───── Prefix (sabit)
```

### API Password Format
- 24 karakter uzunluğunda
- Büyük/küçük harf, rakam ve semboller içerir
- Her generate'de yeni random password üretilir

### Database'de Saklama

**Şu anki durum (Phase 1):**
- `api_key`: Plain text (hızlı lookup için)
- `api_password`: Plain text (geçici)

**Phase 2'de eklenecek:**
- `api_key_hash`: Hashed (bcrypt)
- `api_password_hash`: Hashed (bcrypt)
- `api_key_prefix`: Indexed prefix (hızlı lookup)
- `api_key_status`: active/revoked/expired

---

## 📊 Middleware Yapısı

### `authenticateApiKey`
```javascript
const { authenticateApiKey } = require('../middleware/auth');

router.get('/my-endpoint', authenticateApiKey, (req, res) => {
  // req.user artık mevcut!
  console.log(req.user.email); // ozgurhzm@hzmsoft.com
  console.log(req.user.role);  // master_admin
});
```

### `requireMasterAdmin`
```javascript
const { authenticateApiKey, requireMasterAdmin } = require('../middleware/auth');

router.get('/sensitive', authenticateApiKey, requireMasterAdmin, (req, res) => {
  // Sadece master_admin erişebilir!
});
```

### `requireAdmin`
```javascript
const { authenticateApiKey, requireAdmin } = require('../middleware/auth');

router.get('/admin-panel', authenticateApiKey, requireAdmin, (req, res) => {
  // admin veya master_admin erişebilir!
});
```

---

## 🧪 Test Senaryoları

### 1. Başarılı Authentication
```bash
curl -H "X-API-Key: hzm_valid_key" \
     -H "X-API-Password: valid_password" \
     http://localhost:8080/api/v1/protected/test

# Beklenen: 200 OK + user bilgisi
```

### 2. Missing Headers
```bash
curl http://localhost:8080/api/v1/protected/test

# Beklenen: 401 + "Missing credentials"
```

### 3. Invalid API Key
```bash
curl -H "X-API-Key: hzm_invalid_key" \
     -H "X-API-Password: any_password" \
     http://localhost:8080/api/v1/protected/test

# Beklenen: 401 + "Invalid API Key"
```

### 4. Invalid API Password
```bash
curl -H "X-API-Key: hzm_valid_key" \
     -H "X-API-Password: wrong_password" \
     http://localhost:8080/api/v1/protected/test

# Beklenen: 401 + "Invalid API Password"
```

### 5. Insufficient Role
```bash
# Normal user API Key ile Master Admin endpoint'e erişim
curl -H "X-API-Key: hzm_user_key" \
     -H "X-API-Password: user_password" \
     http://localhost:8080/api/v1/protected/master-admin/test

# Beklenen: 403 + "Master Admin role required"
```

---

## 📝 Örnek Kullanım Senaryoları

### 1. Python Script
```python
import requests

API_KEY = "hzm_xxxxxxxx..."
API_PASSWORD = "your-password"
BASE_URL = "https://hzmdatabasebackend-production.up.railway.app"

headers = {
    "X-API-Key": API_KEY,
    "X-API-Password": API_PASSWORD,
    "Content-Type": "application/json"
}

# Veri ekleme
response = requests.post(
    f"{BASE_URL}/api/v1/protected/data",
    headers=headers,
    json={
        "table_name": "products",
        "data": {
            "name": "iPhone 15",
            "price": 29999,
            "stock": 100
        }
    }
)

print(response.json())
```

### 2. Node.js Script
```javascript
const axios = require('axios');

const API_KEY = 'hzm_xxxxxxxx...';
const API_PASSWORD = 'your-password';
const BASE_URL = 'https://hzmdatabasebackend-production.up.railway.app';

const headers = {
  'X-API-Key': API_KEY,
  'X-API-Password': API_PASSWORD,
  'Content-Type': 'application/json'
};

// Veri okuma
axios.get(`${BASE_URL}/api/v1/protected/data`, {
  headers,
  params: {
    table_name: 'products',
    limit: 10
  }
})
.then(response => {
  console.log(response.data);
})
.catch(error => {
  console.error(error.response.data);
});
```

### 3. cURL (Bash Script)
```bash
#!/bin/bash

API_KEY="hzm_xxxxxxxx..."
API_PASSWORD="your-password"
BASE_URL="https://hzmdatabasebackend-production.up.railway.app"

# Veri ekleme
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "orders",
    "data": {
      "customer_id": 123,
      "total": 1500,
      "status": "pending"
    }
  }' \
  "$BASE_URL/api/v1/protected/data"
```

---

## 🔄 Yenileme İşlemleri

### API Key Yenileme
```bash
POST /api/v1/api-keys/master-admin/regenerate
```
**Sonuç:** Yeni API Key üretilir, eski geçersiz olur.

### API Password Yenileme
```bash
POST /api/v1/api-keys/master-admin/regenerate-password
```
**Sonuç:** Yeni API Password üretilir, eski geçersiz olur.

⚠️ **Dikkat:** API Key veya Password yenilendiğinde, tüm script'leri güncellemelisin!

---

## 📚 İleri Seviye Kullanım

### Rate Limiting (Phase 2)
```javascript
// TODO: Phase 2'de eklenecek
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100 // 100 istek limit
});

app.use('/api/v1/protected', apiLimiter);
```

### Request Logging
```javascript
// Her API Key isteği log'lanır
// src/middleware/auth.js içinde:

logger.info(`API Key authenticated: ${user.email} (${user.role})`);
```

### Last Used Timestamp
```sql
-- Her başarılı authentication'da güncellenir
UPDATE core.users
SET api_key_last_used_at = NOW()
WHERE id = $1;
```

---

## 🎯 Sonraki Adımlar (Phase 2)

- [ ] API Key hashing (bcrypt)
- [ ] API Password hashing
- [ ] API Key prefix indexing
- [ ] API Key status (active/revoked/expired)
- [ ] Rate limiting
- [ ] IP whitelist
- [ ] Request logging (audit trail)
- [ ] API Key expiration dates
- [ ] Scope-based permissions

---

## 🐛 Troubleshooting

### "Missing credentials" hatası
**Sebep:** Header'lar eksik veya yanlış yazılmış.
**Çözüm:** `X-API-Key` ve `X-API-Password` header'larını kontrol et (büyük/küçük harf önemli!).

### "Invalid API Key" hatası
**Sebep:** API Key yanlış veya user inactive.
**Çözüm:** Frontend'den API Key'i yeniden kopyala veya regenerate et.

### "Invalid API Password" hatası
**Sebep:** API Password yanlış.
**Çözüm:** Frontend'den API Password'ü yeniden kopyala veya regenerate et.

### "Forbidden" hatası
**Sebep:** Yetkisiz erişim (role problemi).
**Çözüm:** Endpoint'e erişmek için gerekli role'e sahip olduğundan emin ol.

---

**📅 Son Güncelleme:** 22 Ekim 2025  
**🔄 Versiyon:** 1.0.0 - Initial Release  
**👤 Yazar:** HZM Platform

