# 🛡️ Security Documentation

Bu klasör, HZM Database API'sinin güvenlik politikalarını ve best practices'i içerir.

---

## 🔐 3-Layer Authentication

### Layer 1: Email
```
X-Email: your-email@example.com
```
- Her API Key bir email'e bağlıdır
- Email doğrulaması zorunludur

### Layer 2: API Key
```
X-API-Key: hzm_user_abc123...
```
- Prefix-based format (`hzm_user_*`, `hzm_project_*`, `hzm_master_admin_*`)
- Revokable (iptal edilebilir)
- Regenerate edilebilir

### Layer 3: API Password
```
X-API-Password: YourSecurePassword123!
```
- Minimum 8 karakter
- En az 1 büyük harf, 1 küçük harf, 1 rakam, 1 özel karakter
- Plain text olarak saklanır (Phase 1), hash'lenecek (Phase 2)

---

## 🚨 Rate Limiting

**Status:** 📝 Planned (Phase 2)

### Planlanan Limitler:
- **Normal User:** 100 requests/minute
- **Admin:** 500 requests/minute
- **Master Admin:** 1000 requests/minute

---

## ❌ Error Handling

### Standart Error Response:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERR_CODE"
}
```

### Common Error Codes:
- `401`: Unauthorized (Auth gerekli)
- `403`: Forbidden (Yetki yetersiz)
- `404`: Not Found
- `429`: Too Many Requests (Rate limit)
- `500`: Internal Server Error

---

## ✅ Best Practices

### 1. API Key Güvenliği
- ❌ API Key'leri asla frontend'de saklamayın
- ❌ API Key'leri Git'e commit etmeyin
- ✅ Environment variables kullanın
- ✅ Düzenli olarak regenerate edin

### 2. Password Güvenliği
- ✅ Güçlü şifreler kullanın (min 12 karakter)
- ✅ Özel karakterler ekleyin
- ❌ Aynı şifreyi başka yerlerde kullanmayın

### 3. Request Güvenliği
- ✅ HTTPS kullanın (HTTP değil)
- ✅ Headers'ı doğru gönderin
- ✅ Timeout değerleri ayarlayın

### 4. Data Güvenliği
- ✅ RLS (Row Level Security) aktif
- ✅ Tenant isolation otomatik
- ✅ Her user sadece kendi verilerini görür

---

## 🔄 Security Roadmap

### Phase 1 (Current):
- ✅ 3-Layer Authentication
- ✅ RLS & Multi-tenant
- ❌ API Password plain text (güvensiz)

### Phase 2 (Planned):
- 📝 API Password hashing
- 📝 Rate limiting
- 📝 IP whitelist
- 📝 MFA (Multi-Factor Auth)

### Phase 3 (Future):
- 📝 API Key rotation policy
- 📝 Advanced RBAC
- 📝 Audit logging
- 📝 Security alerts

---

## 📚 İlgili Dokümantasyon

- **Authentication:** `/docs/api-integration/authentication/`
- **Roadmap:** `/docs/roadmap/03-Security/`


