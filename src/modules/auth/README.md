# 🔐 Auth Module

**Kimlik Doğrulama ve Yetkilendirme Modülü**

## 📋 Amaç

Kullanıcı kayıt, giriş, çıkış ve token yönetimi işlemlerini sağlar.

## 🌐 API Endpoints

### Public Endpoints

- `POST /api/v1/auth/register` - Yeni kullanıcı kaydı
- `POST /api/v1/auth/login` - Kullanıcı girişi
- `POST /api/v1/auth/refresh` - JWT token yenileme

### Protected Endpoints (JWT gerekli)

- `GET /api/v1/auth/me` - Mevcut kullanıcı bilgisi
- `POST /api/v1/auth/logout` - Kullanıcı çıkışı
- `POST /api/v1/auth/change-password` - Şifre değiştirme

## 🏗️ Mimari Katmanları

```
auth.routes.js → auth.controller.js → auth.service.js → auth.model.js
    (HTTP)           (Validation)       (Business Logic)    (Database)
```

## 🔑 Kimlik Doğrulama Tipleri

1. **JWT Authentication** - Web frontend için
2. **API Key Authentication** - Backend-to-backend için
3. **Refresh Token** - Long-lived sessions için

## 📦 Dependencies

- `jsonwebtoken` - JWT generation/validation
- `argon2` - Password hashing
- `express-validator` - Input validation

## 🚀 Kullanım Örneği

```javascript
// Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

## 🔐 Security Features

- ✅ Password hashing (Argon2id)
- ✅ JWT with expiration
- ✅ Refresh token rotation
- ✅ Rate limiting
- ✅ Brute force protection
- ✅ Email verification (planned)
- ✅ 2FA support (planned)

## 🧪 Testing

```bash
npm test src/modules/auth
```

## 📚 Documentation

Detaylı API dokümantasyonu için `/docs/api/auth.md` dosyasına bakınız.

## ⚙️ Configuration

Environment variables:
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRES_IN` - Access token expiration (default: 1h)
- `REFRESH_TOKEN_EXPIRES_IN` - Refresh token expiration (default: 7d)

## 🔄 Migration Status

- [ ] Migrate from `/routes/auth.js`
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add API documentation
- [ ] Add rate limiting
- [ ] Add email verification


