# 🌐 API Endpoints Documentation

Bu klasör, tüm API endpoint'lerinin modüler dokümantasyonunu içerir.

---

## 📋 Endpoint Kategorileri

### 🔐 Authentication (`/api/v1/auth/*`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/me` - Get current user info

**Dokümantasyon:** `auth/` klasörü (yakında)

---

### 🔑 API Keys (`/api/v1/api-keys/*`)
- `GET /api-keys/user` - Get user's API key
- `POST /api-keys/user/generate` - Generate new API key
- `POST /api-keys/user/regenerate` - Regenerate API key
- `POST /api-keys/user/revoke` - Revoke API key
- `GET /api-keys/master-admin` - Get master admin API key
- `GET /api-keys/project/:id` - Get project API keys
- `POST /api-keys/project/:id/generate` - Generate project API key
- `POST /api-keys/project/:id/regenerate` - Regenerate project API key
- `POST /api-keys/project/:id/revoke` - Revoke project API key

**Dokümantasyon:** `api-keys/` klasörü (yakında)

---

### 📁 Projects (`/api/v1/projects/*`)
- `GET /projects` - List all projects
- `GET /projects/:id` - Get project details
- `POST /projects` - Create new project
- `PUT /projects/:id` - Update project
- `PATCH /projects/:id` - Partial update
- `DELETE /projects/:id` - Delete project

**Dokümantasyon:** `projects/` klasörü (yakında)

---

### 📊 Generic Data (`/api/v1/data/:resource`)
- `GET /data/:resource` - List resources
- `GET /data/:resource/:id` - Get resource by ID
- `POST /data/:resource` - Create resource
- `PUT /data/:resource/:id` - Update resource
- `PATCH /data/:resource/:id` - Partial update
- `DELETE /data/:resource/:id` - Delete resource

**Dokümantasyon:** `generic-data/` klasörü (yakında)

---

### 🔧 Admin (`/api/v1/admin/*`)
- `GET /admin/database` - Query database metadata

**Dokümantasyon:** `admin/` klasörü (yakında)

---

### 💚 Health (`/health/*`)
- `GET /health` - Overall health check
- `GET /health/database` - Database health
- `GET /health/redis` - Redis health
- `GET /health/metrics` - System metrics
- `GET /health/ping` - Simple ping
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/startup` - Startup probe

**Status:** 📝 Planned

---

## 🔐 Authentication

Tüm endpoint'ler **3-Layer Authentication** gerektirir:

```bash
X-Email: your-email@example.com
X-API-Key: hzm_user_abc123...
X-API-Password: YourSecurePassword123!
```

---

## 📚 Detaylı Dokümantasyon

Her endpoint kategorisi için detaylı dokümantasyon ilgili alt klasörde bulunabilir.

