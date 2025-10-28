# 🔧 Shared Module

**Ortak Kullanılan Utility, Middleware ve Konfigürasyon**

## 📋 Amaç

Tüm modüller tarafından kullanılan ortak fonksiyonları ve ayarları sağlar.

## 📁 Klasör Yapısı

```
shared/
├── middleware/          🛡️ Ortak middleware'ler
│   └── auth.js         (3-layer auth + JWT)
│
├── utils/              🔧 Ortak utility'ler
│   └── logger.js       (Centralized logging)
│
└── config/             ⚙️ Konfigürasyon
    ├── database.js     (PostgreSQL pool)
    └── index.js        (All configs)
```

## 🛡️ Middleware

### auth.js

**Authentication & Authorization:**

```javascript
const { authenticateApiKey, authenticateJWT, requireAdmin } = require('../shared/middleware/auth');

// API Key auth
router.use(authenticateApiKey);

// JWT auth
router.use(authenticateJWT);

// Hybrid (JWT or API Key)
router.use(authenticateJwtOrApiKey);

// Admin required
router.use(requireAdmin);

// Master Admin required
router.use(requireMasterAdmin);
```

## 🔧 Utils

### logger.js

**Centralized Logging:**

```javascript
const logger = require('../shared/utils/logger');

logger.info('User logged in', { userId: 123 });
logger.warn('Rate limit exceeded');
logger.error('Database connection failed', error);
logger.debug('Request payload', req.body);
```

## ⚙️ Config

### database.js

**PostgreSQL Connection Pool:**

```javascript
const pool = require('../shared/config/database');

const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### index.js

**Centralized Configuration:**

```javascript
const config = require('../shared/config');

console.log(config.env);          // 'production'
console.log(config.port);         // 3001
console.log(config.jwt.secret);   // 'your-jwt-secret'
console.log(config.database.url); // 'postgresql://...'
```

## 🚀 Usage Rules

### ✅ DO

1. Import from `shared/` in all modules
2. Use centralized logger
3. Use shared config
4. Use shared middleware
5. Keep shared code generic and reusable

### ❌ DON'T

1. Don't put business logic in shared/
2. Don't put module-specific code in shared/
3. Don't import from other modules in shared/
4. Don't create circular dependencies

## 📦 Future Additions

### Middleware (Planned)

```
middleware/
├── errorHandler.js     (Standardized error responses)
├── validator.js        (Input validation)
├── rateLimiter.js      (Rate limiting)
├── cors.js             (CORS handling)
└── logger.middleware.js (Request logging)
```

### Utils (Planned)

```
utils/
├── responseFormatter.js  (Standard JSON responses)
├── apiKeyGenerator.js    (Key generation)
├── encryption.js         (Argon2id, AES)
├── date.js               (Date formatting)
└── validation.js         (Common validators)
```

### Config (Planned)

```
config/
├── redis.js            (Redis connection)
├── constants.js        (System constants)
└── env.js              (Environment variables)
```

## 🔄 Migration Status

- [ ] Migrate middleware from `/middleware/*`
- [ ] Migrate utils from `/utils/*`
- [ ] Add error handler middleware
- [ ] Add validator middleware
- [ ] Add rate limiter middleware
- [ ] Add response formatter
- [ ] Add encryption utilities
- [ ] Add unit tests


