# 📦 Modules

**Domain-Based Modular Architecture**

## 🏗️ Mimari Prensipler

### 4-Layer Architecture

Her modül 4 katmandan oluşur:

```
Routes → Controller → Service → Model
(HTTP)   (Validation)  (Business)  (Database)
```

### Separation of Concerns

1. **Routes**: HTTP endpoint tanımları
2. **Controller**: Request/response handling, validation
3. **Service**: Business logic, orchestration
4. **Model**: Database access, raw data

## 📁 Modül Yapısı

### Phase 1: Core Modüller (Şu an)

```
modules/
├── auth/              🔐 Authentication & Authorization
├── users/             👤 User Management
├── projects/          📁 Project Management
├── api-keys/          🔑 API Key Management
├── data/              💾 Generic Data Operations
├── admin/             📊 Admin Reports
└── health/            ❤️ Health Checks
```

### Phase 2: Business Modüller (Yakında)

```
modules/
├── tables/            📋 Dynamic Table Management
├── companies/         🏢 Company/Customer Management
├── contacts/          👥 Contact Management
├── sequences/         🔢 Sequence System
└── audit/             📝 Audit Logs
```

### Phase 3: Advanced Modüller (İleride)

```
modules/
├── webhooks/          🔗 Webhook Management
├── notifications/     🔔 Notification System
├── exports/           📤 Data Export
└── analytics/         📈 Analytics & Charts
```

## 🎯 Module Standards

### File Structure

Her modül şu dosyaları içerir:

```
module-name/
├── module-name.routes.js       (API endpoints)
├── module-name.controller.js   (HTTP handlers)
├── module-name.service.js      (Business logic)
├── module-name.model.js        (Database access)
├── middleware/                  (Module-specific - optional)
├── utils/                       (Module-specific - optional)
└── README.md                    (Documentation)
```

### Naming Convention

- **Files**: kebab-case (e.g., `api-key.routes.js`)
- **Classes**: PascalCase (e.g., `class ApiKeyController`)
- **Functions**: camelCase (e.g., `getUserById()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)

### Import Rules

✅ **Allowed:**
```javascript
// Import from shared/
const logger = require('../../shared/utils/logger');
const { authenticateJWT } = require('../../shared/middleware/auth');
const pool = require('../../shared/config/database');
```

❌ **Not Allowed:**
```javascript
// Don't import from other modules
const UserService = require('../users/user.service');  ❌

// Don't import from routes/
const authRoutes = require('../../routes/auth');  ❌
```

### Error Handling

Her katman kendi hatalarını handle eder:

```javascript
// Model - throw error
static async findById(id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    logger.error('Model find by ID error:', error);
    throw error;  // Let service handle it
  }
}

// Service - business logic error
static async getUser(id) {
  try {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    logger.error('Service get user error:', error);
    throw error;  // Let controller handle it
  }
}

// Controller - HTTP response
static async getUser(req, res) {
  try {
    const { id } = req.params;
    const user = await UserService.getUser(id);
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Controller get user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

## 🔐 Authentication Patterns

### API Key Authentication (Backend-to-Backend)

```javascript
const { authenticateApiKey } = require('../../shared/middleware/auth');

router.use(authenticateApiKey);
router.get('/data', DataController.list);
```

### JWT Authentication (Web Frontend)

```javascript
const { authenticateJWT } = require('../../shared/middleware/auth');

router.use(authenticateJWT);
router.get('/profile', UserController.getProfile);
```

### Hybrid Authentication

```javascript
const { authenticateJwtOrApiKey } = require('../../shared/middleware/auth');

router.use(authenticateJwtOrApiKey);
router.get('/admin/reports', AdminController.getReports);
```

### Role-Based Authorization

```javascript
const { authenticateJWT, requireAdmin } = require('../../shared/middleware/auth');

router.use(authenticateJWT);
router.use(requireAdmin);
router.get('/users', UserController.listUsers);
```

## 📊 Status Tracking

| Module | Routes | Controller | Service | Model | README | Status |
|--------|--------|------------|---------|-------|--------|--------|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ | 🏗️ Not implemented |
| users | ✅ | ✅ | ✅ | ✅ | ✅ | 🏗️ Not implemented |
| projects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Implemented |
| api-keys | ✅ | ✅ | ✅ | ✅ | ✅ | 🏗️ Not implemented |
| data | ✅ | ✅ | ✅ | ✅ | ✅ | 🏗️ Not implemented |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | 🏗️ Not implemented |
| health | ✅ | ✅ | - | - | ✅ | 🏗️ Not implemented |

## 🚀 Next Steps

1. ✅ Folder structure created
2. ✅ Skeleton files created
3. ⏳ Migrate existing code to modules
4. ⏳ Implement new features
5. ⏳ Add unit tests
6. ⏳ Add integration tests
7. ⏳ Update server.js to use modular routes

## 📚 Documentation

Her modülün kendi README'si var:
- [auth/README.md](./auth/README.md)
- [users/README.md](./users/README.md)
- [projects/README.md](./projects/README.md)
- [api-keys/README.md](./api-keys/README.md)
- [data/README.md](./data/README.md)
- [admin/README.md](./admin/README.md)
- [health/README.md](./health/README.md)

Shared utilities:
- [../shared/README.md](../shared/README.md)
