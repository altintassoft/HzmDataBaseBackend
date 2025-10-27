# 📦 Backend Modules

Bu klasör **Domain-Based Modular Architecture** kullanır.

## 🏗️ Mimari

Her modül 4 katmandan oluşur:

```
module/
├── {module}.model.js       # Database Access Layer
├── {module}.service.js     # Business Logic Layer
├── {module}.controller.js  # Request/Response Handler
└── {module}.routes.js      # API Endpoints
```

## 📂 Mevcut Modüller

### ✅ projects/
**Durum:** Active  
**Endpoint:** `/api/v1/projects`  
**Özellikler:**
- CRUD operations
- Role-based authorization
- API Key authentication (3-layer)

### 🚧 auth/ (Planlanan)
**Endpoint:** `/api/v1/auth`  
**Özellikler:**
- Login/Register
- Email verification
- Password reset
- Session management

### 🚧 users/ (Planlanan)
**Endpoint:** `/api/v1/users`  
**Özellikler:**
- User profile management
- Settings
- API Keys management

### 🚧 tables/ (Planlanan)
**Endpoint:** `/api/v1/tables`  
**Özellikler:**
- Dynamic table management
- Schema builder
- Data operations

### 🚧 api-keys/ (Planlanan)
**Endpoint:** `/api/v1/api-keys`  
**Özellikler:**
- API Key generation
- Key rotation
- Usage statistics

### 🚧 admin/ (Planlanan)
**Endpoint:** `/api/v1/admin`  
**Özellikler:**
- Database reports
- Migration management
- System health

---

## 🎯 Katman Sorumlulukları

### 1. Routes Layer
```javascript
// Sorumluluk: API endpoint tanımları
router.get('/', middleware, controller.method);
```
- HTTP method ve path tanımı
- Middleware attachment (auth, validation)
- Route documentation

### 2. Controller Layer
```javascript
// Sorumluluk: HTTP request/response handling
async method(req, res) {
  // Extract data from req
  // Call service
  // Format response
}
```
- Request validation
- Response formatting
- HTTP status codes
- Error handling (HTTP layer)

### 3. Service Layer
```javascript
// Sorumluluk: Business logic
async operation(data, user) {
  // Business rules
  // Authorization
  // Data transformation
  // Call model(s)
}
```
- Business rules enforcement
- Authorization logic
- Data validation
- Orchestration (multiple models)
- No HTTP concerns

### 4. Model Layer
```javascript
// Sorumluluk: Database access
static async query(params) {
  // SQL query
  // Return raw data
}
```
- Pure SQL queries
- No business logic
- Error handling (DB level)
- Returns raw database data

---

## 📋 Modül Oluşturma Kuralları

### 1. Dosya İsimlendirme
```
{module-name}.model.js
{module-name}.service.js
{module-name}.controller.js
{module-name}.routes.js
```

### 2. Class İsimlendirme
```javascript
class ProjectModel { }
class ProjectService { }
class ProjectController { }
```

### 3. Export Formatı
```javascript
// Model, Service, Controller
module.exports = ClassName;

// Routes
module.exports = router;
```

### 4. Import Formatı
```javascript
const XyzModel = require('./xyz.model');
const XyzService = require('./xyz.service');
```

---

## 🔄 Legacy vs Modular

### Legacy Routes (src/routes/)
```
routes/
├── auth.js          → Will migrate to modules/auth/
├── projects.js      → ✅ Migrated to modules/projects/
├── admin.js         → Will migrate to modules/admin/
└── api-keys.js      → Will migrate to modules/api-keys/
```

### Migration Strategy
1. ✅ **Modules öncelikli**: Yeni özellikler `modules/` altında
2. ⏳ **Kademeli taşıma**: Legacy kod zamanla taşınır
3. 🔄 **Hybrid dönem**: İki yapı birlikte çalışır
4. 🎯 **Hedef**: Tüm kod `modules/` altında

---

## 🧪 Testing Örneği

```bash
# Test: Create project
curl -X POST "http://localhost:3000/api/v1/projects" \
  -H "X-Email: user@example.com" \
  -H "X-API-Key: hzm_..." \
  -H "X-API-Password: ..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}'
```

---

## 📖 Best Practices

### ✅ DO
- Keep controllers thin (only HTTP handling)
- Put business logic in services
- Use services for authorization
- Make models database-focused
- Document all endpoints
- Write unit tests for services
- Use TypeScript (future)

### ❌ DON'T
- Don't put business logic in controllers
- Don't access database from controllers
- Don't put HTTP logic in services
- Don't mix concerns between layers
- Don't hardcode values
- Don't skip error handling

---

## 🔮 Gelecek Özellikler

### Planlanan Modüller
- [ ] webhooks/
- [ ] notifications/
- [ ] billing/
- [ ] analytics/
- [ ] backups/
- [ ] integrations/
- [ ] logs/
- [ ] teams/

### Planlanan İyileştirmeler
- [ ] TypeScript migration
- [ ] Validation library (Joi/Zod)
- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] API documentation (Swagger)
- [ ] GraphQL support (maybe)

---

## 📚 Kaynaklar

**Clean Architecture:**
- https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

**Layered Architecture:**
- https://www.oreilly.com/library/view/software-architecture-patterns/9781491971437/ch01.html

**Domain-Driven Design:**
- https://martinfowler.com/bliki/DomainDrivenDesign.html

---

**Oluşturulma Tarihi:** 27 Ekim 2025  
**Son Güncelleme:** 27 Ekim 2025

