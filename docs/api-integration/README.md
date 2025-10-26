# 📚 HZM Database - API Integration Documentation

> **Erişim:** 3-Layer Authentication (Email + API Key + API Password)

Bu klasör, HZM Database API'sinin entegrasyon dokümantasyonunu içerir.

---

## 📁 İçerik Yapısı

### 🔐 [`authentication/`](./authentication/)
3 katmanlı güvenlik sisteminin detaylı açıklaması:
- Email validation
- API Key format & management
- API Password rules & security

### 🌐 [`endpoints/`](./endpoints/)
Tüm API endpoint'lerinin modüler dokümantasyonu:
- Authentication endpoints (`/auth/*`)
- API Key management endpoints (`/api-keys/*`)
- Project endpoints (`/projects/*`)
- Generic data endpoints (`/data/*`)

### 💡 [`examples/`](./examples/)
Pratik kullanım örnekleri:
- cURL örnekleri
- Postman collection
- Code snippets (Node.js, Python, etc.)

### 🛡️ [`security/`](./security/)
Güvenlik politikaları ve best practices:
- Rate limiting
- Error handling
- Security best practices

---

## 🚀 Hızlı Başlangıç

### 1️⃣ Authentication Setup

```bash
# 3-Layer Auth gereklidir:
X-Email: your-email@example.com
X-API-Key: hzm_user_abc123...
X-API-Password: YourSecurePassword123!
```

### 2️⃣ Test Request

```bash
curl -X GET https://hzmdatabasebackend-production.up.railway.app/api/v1/admin/database?type=tables \
  -H "X-Email: your-email@example.com" \
  -H "X-API-Key: your-api-key" \
  -H "X-API-Password: your-api-password"
```

### 3️⃣ Detaylı Dokümantasyon

Her modül kendi README.md dosyasında detaylı açıklanmıştır.

---

## 📊 Endpoint Kategorileri

| Kategori | Endpoint Count | Status |
|----------|----------------|--------|
| Authentication | 4 | ✅ Active |
| API Keys | 9 | ✅ Active |
| Projects | 6 | ✅ Active |
| Generic Data | 6 | ✅ Active |
| Admin | 1 | 🚧 Partial |
| Health | 8 | 📝 Planned |

---

## 🔗 İlgili Dokümantasyon

- **Roadmap:** `/docs/roadmap/` (Master Admin only)
- **Migration Docs:** `/HzmVeriTabaniBackend/migrations/README.md`
- **Database Operations:** `/HzmVeriTabaniBackend/DATABASE_OPERATIONS.md`

---

## 📞 Destek

API entegrasyonu ile ilgili sorularınız için:
- Email: ozgurhzm@hzmsoft.com
- API Key: Settings sayfasından oluşturabilirsiniz

