# 🔑 API Keys Module

**API Key Yönetim Modülü**

## 📋 Amaç

Kullanıcıların API Key ve API Password oluşturma, yenileme, iptal etme işlemlerini sağlar.

## 🌐 API Endpoints

### User Endpoints (JWT required)

- `GET /api/v1/api-keys` - Kullanıcının tüm API keyleri
- `POST /api/v1/api-keys/generate` - Yeni API key oluşturma
- `POST /api/v1/api-keys/:keyId/regenerate` - API key yenileme
- `POST /api/v1/api-keys/:keyId/revoke` - API key iptal etme
- `GET /api/v1/api-keys/:keyId` - API key detayları

## 🏗️ Mimari Katmanları

```
api-key.routes.js → api-key.controller.js → api-key.service.js → api-key.model.js
     (HTTP)              (Validation)          (Business Logic)       (Database)
```

## 🔐 3-Layer Authentication

API Key Authentication için 3 katmanlı sistem:

1. **X-Email**: Kullanıcı emaili
2. **X-API-Key**: Opaque API key (hzm_xxx format)
3. **X-API-Password**: API password (plain text, DB'de encrypted)

## 📦 Key Format

```
hzm_<random_32_characters>
Example: hzm_1ce98c92189d4a109cd604b22bfd86b7
```

## 🚀 Kullanım Örneği

```javascript
// Generate new API key
POST /api/v1/api-keys/generate
Authorization: Bearer <jwt_token>
{
  "name": "Production API",
  "scopes": ["read", "write"]
}

// Response
{
  "success": true,
  "data": {
    "api_key": "hzm_...",
    "api_password": "secure_password_123",
    "message": "Store these credentials securely. Password won't be shown again."
  }
}
```

## 🔐 Security Features

- ✅ Opaque key format (no user info in key)
- ✅ API password encryption (AES-256)
- ✅ Last used tracking
- ✅ Revocation support
- ✅ Scope-based permissions
- ✅ Rate limiting per key
- 🔄 IP whitelist (planned)
- 🔄 Key rotation (planned)
- 🔄 Key expiration (planned)

## 🔄 Migration Status

- [ ] Migrate from `core.users.api_key` column
- [ ] Create `core.user_api_keys` table
- [ ] Add encryption for passwords
- [ ] Add scope-based permissions
- [ ] Add unit tests
- [ ] Add integration tests


