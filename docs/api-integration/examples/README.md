# 💡 API Usage Examples

Bu klasör, HZM Database API'sinin pratik kullanım örneklerini içerir.

---

## 📁 İçerik

### 🔧 cURL Examples
```bash
# Coming soon: curl/
```

### 📮 Postman Collection
```json
# Coming soon: postman/
```

### 💻 Code Snippets
```
# Coming soon:
- Node.js examples
- Python examples
- PHP examples
```

---

## 🚀 Hızlı Başlangıç Örneği

### Authentication Test

```bash
curl -X GET https://hzmdatabasebackend-production.up.railway.app/api/v1/admin/database?type=tables \
  -H "X-Email: ozgurhzm@hzmsoft.com" \
  -H "X-API-Key: hzm_master_admin_2025_secure_key_01234567890" \
  -H "X-API-Password: MasterAdmin2025!SecurePassword"
```

### Create Project

```bash
curl -X POST https://hzmdatabasebackend-production.up.railway.app/api/v1/projects \
  -H "X-Email: your-email@example.com" \
  -H "X-API-Key: your-api-key" \
  -H "X-API-Password: your-api-password" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "Project description",
    "tenant_id": 1
  }'
```

### List Projects

```bash
curl -X GET https://hzmdatabasebackend-production.up.railway.app/api/v1/projects \
  -H "X-Email: your-email@example.com" \
  -H "X-API-Key: your-api-key" \
  -H "X-API-Password: your-api-password"
```

---

## 📚 Detaylı Örnekler

Yakında detaylı örnekler eklenecektir.


