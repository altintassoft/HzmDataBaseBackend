# 👤 Users Module

**Kullanıcı Yönetimi Modülü**

## 📋 Amaç

Kullanıcı profil yönetimi, kullanıcı listesi ve admin operasyonlarını sağlar.

## 🌐 API Endpoints

### User Endpoints (Authenticated)

- `GET /api/v1/users/profile` - Kendi profili görüntüleme
- `PUT /api/v1/users/profile` - Kendi profilini güncelleme
- `POST /api/v1/users/profile/avatar` - Avatar yükleme

### Admin Endpoints (Admin role required)

- `GET /api/v1/users` - Tüm kullanıcıları listeleme
- `GET /api/v1/users/:id` - Kullanıcı detayı
- `PUT /api/v1/users/:id` - Kullanıcı güncelleme
- `DELETE /api/v1/users/:id` - Kullanıcı silme
- `POST /api/v1/users/:id/activate` - Kullanıcı aktifleştirme
- `POST /api/v1/users/:id/deactivate` - Kullanıcı pasifleştirme

## 🏗️ Mimari Katmanları

```
user.routes.js → user.controller.js → user.service.js → user.model.js
   (HTTP)           (Validation)        (Business Logic)   (Database)
```

## 🔐 Authorization

- **User**: Sadece kendi profili
- **Admin**: Tüm kullanıcılar
- **Master Admin**: Tüm operasyonlar + hard delete

## 📦 Dependencies

- `multer` - File upload (avatar)
- `sharp` - Image processing
- `express-validator` - Input validation

## 🚀 Kullanım Örneği

```javascript
// Get profile
GET /api/v1/users/profile
Authorization: Bearer <jwt_token>

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "avatar": "https://..."
  }
}
```

## 🔄 Migration Status

- [ ] Migrate from `/routes/auth.js` (user endpoints)
- [ ] Add avatar upload
- [ ] Add pagination
- [ ] Add search/filter
- [ ] Add unit tests
- [ ] Add integration tests


