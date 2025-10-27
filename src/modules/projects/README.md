# 📦 Projects Module

Bu modül **Project** ile ilgili tüm backend işlemlerini içerir.

## 📂 Yapı

```
projects/
├── project.model.js       # Database Access Layer (SQL queries)
├── project.service.js     # Business Logic Layer
├── project.controller.js  # Request/Response Handler
├── project.routes.js      # API Endpoints
└── README.md              # Bu dosya
```

## 🏗️ Katman Mimarisi

### 1. Model Layer (`project.model.js`)
**Sorumluluk:** Database'e direkt erişim

```javascript
ProjectModel.findByUserId(userId, tenantId)
ProjectModel.create(projectData)
ProjectModel.update(projectId, updateData)
```

**Özellikleri:**
- Pure SQL queries
- No business logic
- Returns raw data from database
- Error handling at database level

---

### 2. Service Layer (`project.service.js`)
**Sorumluluk:** Business logic ve validation

```javascript
ProjectService.createProject(projectData, user)
ProjectService.updateProject(projectId, updateData, user)
ProjectService.deleteProject(projectId, user)
```

**Özellikleri:**
- Business rules (name uniqueness, validation)
- Authorization checks
- Data transformation
- Orchestration (calling multiple models)
- No HTTP concerns

---

### 3. Controller Layer (`project.controller.js`)
**Sorumluluk:** HTTP request/response handling

```javascript
ProjectController.list(req, res)
ProjectController.create(req, res)
ProjectController.update(req, res)
```

**Özellikleri:**
- Request validation
- Calling service methods
- Response formatting (JSON)
- HTTP status codes
- Error handling for HTTP layer

---

### 4. Routes Layer (`project.routes.js`)
**Sorumluluk:** API endpoint definition

```javascript
router.get('/', authenticateApiKey, ProjectController.list);
router.post('/', authenticateApiKey, ProjectController.create);
```

**Özellikleri:**
- Endpoint paths
- HTTP methods (GET, POST, PUT, DELETE)
- Middleware attachment (auth, validation)
- Route documentation

---

## 🔐 Authentication

**Tüm endpoint'ler 3-layer API Key authentication kullanır:**

```
Headers:
  X-Email: user@example.com
  X-API-Key: hzm_...
  X-API-Password: ...
```

**Authorization Logic:**
- Regular users: Only own projects
- Admin: All projects in their tenant
- Master Admin: All projects (all tenants)

---

## 📡 API Endpoints

### List Projects
```
GET /api/v1/projects
Response: { success: true, count: 5, data: [...] }
```

### Get Project
```
GET /api/v1/projects/:id
Response: { success: true, data: {...} }
```

### Create Project
```
POST /api/v1/projects
Body: { name, description, status, settings }
Response: { success: true, data: {...} }
```

### Update Project
```
PUT /api/v1/projects/:id
Body: { name, description, status, settings }
Response: { success: true, data: {...} }
```

### Delete Project
```
DELETE /api/v1/projects/:id
Response: { success: true, message: "..." }
```

### Get Statistics
```
GET /api/v1/projects/:id/statistics
Response: { success: true, data: {...} }
```

---

## 💾 Database Schema

**Table:** `core.projects`

```sql
CREATE TABLE core.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id),
  owner_id UUID NOT NULL REFERENCES core.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES core.users(id),
  updated_by UUID REFERENCES core.users(id)
);
```

---

## 🧪 Testing

```bash
# List projects
curl -X GET "http://localhost:3000/api/v1/projects" \
  -H "X-Email: user@example.com" \
  -H "X-API-Key: hzm_..." \
  -H "X-API-Password: ..."

# Create project
curl -X POST "http://localhost:3000/api/v1/projects" \
  -H "X-Email: user@example.com" \
  -H "X-API-Key: hzm_..." \
  -H "X-API-Password: ..." \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "description": "Test project"}'
```

---

## 🔮 Future Features

- [ ] Project API Keys management (sub-module)
- [ ] Project Tables management (sub-module)
- [ ] Project Team management
- [ ] Project Backups
- [ ] Project Analytics
- [ ] Project Webhooks
- [ ] Project Billing

---

## 📝 Best Practices

1. **Never put business logic in controllers** → Use services
2. **Never access database from controllers** → Use models
3. **Always validate in services** → Not in controllers
4. **Use try-catch in all layers** → Proper error handling
5. **Log important actions** → User audit trail
6. **Use transactions for multiple operations** → Data consistency

---

**Oluşturulma Tarihi:** 27 Ekim 2025  
**Son Güncelleme:** 27 Ekim 2025

