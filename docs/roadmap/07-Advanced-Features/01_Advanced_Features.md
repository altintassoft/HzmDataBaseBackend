# ⚡ Advanced Features

## 📋 Genel Bakış

HZM Platform'da kullanıcı deneyimini iyileştiren ve geliştirici verimliliğini artıran gelişmiş özellikler.

## 🔖 Table Alias System

### Nedir?

Human-readable alias'lar ile table'lara kolay erişim sağlar.

### Database Schema

```sql
CREATE TABLE table_aliases (
  id SERIAL PRIMARY KEY,
  alias_name VARCHAR(100) UNIQUE NOT NULL,     -- @user-data, @products
  real_table_name VARCHAR(100) NOT NULL,       -- users_123, product_catalog
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  project_id INTEGER REFERENCES projects(id),
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  
  CONSTRAINT unique_alias_per_project UNIQUE (project_id, alias_name),
  CONSTRAINT valid_alias_format CHECK (
    alias_name ~ '^@[a-z0-9][a-z0-9-]*[a-z0-9]$|^@[a-z0-9]$'
  )
);
```

### Usage

```javascript
// Instead of:
SELECT * FROM users_project_26_1234567890;

// Use:
SELECT * FROM @users;

// API endpoint
GET /api/v1/data/@users/rows
```

### Benefits

- ✅ No hard-coded table IDs
- ✅ Readable queries
- ✅ Easy refactoring
- ✅ Better documentation

---

## 🌐 CORS Domain Management

### Dynamic CORS Control

```sql
ALTER TABLE projects 
  ADD COLUMN allowed_domains JSONB DEFAULT '[]',
  ADD COLUMN platform_patterns JSONB DEFAULT '[
    "*.netlify.app",
    "*.vercel.app", 
    "*.railway.app",
    "*.github.io"
  ]';
```

### API Management

```bash
POST /api/v1/projects/:id/cors/domains
Body: {
  "domains": [
    "https://myapp.com",
    "https://www.myapp.com",
    "https://staging.myapp.com"
  ]
}

GET /api/v1/projects/:id/cors/domains
→ List allowed domains

DELETE /api/v1/projects/:id/cors/domains/:domain
→ Remove domain
```

### Express Middleware

```javascript
app.use(cors({
  origin: (origin, callback) => {
    const project = getProjectFromRequest(req);
    
    if (isAllowedOrigin(origin, project.allowed_domains)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  }
}));
```

### Features

- ✅ Per-project CORS configuration
- ✅ Wildcard domain support (*.example.com)
- ✅ Platform pattern matching
- ✅ Auto-update without restart
- ✅ CORS preflight optimization

---

## 🔍 Code Scanning & Quality Metrics

### project_scan_data Table

```sql
CREATE TABLE project_scan_data (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  scan_type VARCHAR(50) DEFAULT 'general',
  
  -- Quality scores (0-100)
  cleanliness_score INTEGER CHECK (cleanliness_score BETWEEN 0 AND 100),
  security_score INTEGER CHECK (security_score BETWEEN 0 AND 100),
  performance_score INTEGER CHECK (performance_score BETWEEN 0 AND 100),
  maintainability_score INTEGER CHECK (maintainability_score BETWEEN 0 AND 100),
  
  -- Metrics
  code_lines INTEGER DEFAULT 0,
  comment_lines INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  
  -- Results
  scan_results JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  
  status VARCHAR(20) DEFAULT 'completed',
  initiated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Scan Categories

```javascript
{
  cleanliness: {
    factors: ['unused_code', 'duplicate_code', 'code_complexity'],
    weight: 0.25
  },
  security: {
    factors: ['sql_injection', 'xss', 'auth_issues', 'sensitive_data'],
    weight: 0.35
  },
  performance: {
    factors: ['n+1_queries', 'missing_indexes', 'slow_queries'],
    weight: 0.25
  },
  maintainability: {
    factors: ['code_comments', 'documentation', 'naming_conventions'],
    weight: 0.15
  }
}
```

### API Endpoints

```bash
POST /api/v1/projects/:id/scan
     → Initiate code scan

GET  /api/v1/projects/:id/scan/results
     → Get latest scan results

GET  /api/v1/projects/:id/scan/history
     → Scan history

GET  /api/v1/projects/:id/scan/recommendations
     → Get improvement recommendations
```

### Scan Results Example

```json
{
  "overall_score": 85,
  "scores": {
    "cleanliness": 90,
    "security": 75,
    "performance": 88,
    "maintainability": 87
  },
  "metrics": {
    "code_lines": 15234,
    "comment_lines": 1823,
    "file_count": 145,
    "critical_issues": 3
  },
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "message": "SQL injection vulnerability found",
      "file": "src/routes/users.js",
      "line": 45
    }
  ],
  "recommendations": [
    "Add missing indexes on foreign keys",
    "Implement caching for frequent queries",
    "Add input validation on user endpoints"
  ]
}
```

---

## 🐛 Debug Tools

### No-Auth Debug Endpoints

```bash
# Project API debugging (development only)
GET /api/v1/debug/project/:projectId/info
    → Project configuration

GET /api/v1/debug/project/:projectId/routes
    → Available routes

GET /api/v1/debug/user/:userId/filters
    → User filter testing

POST /api/v1/debug/query/test
     → Test raw SQL query
```

### Request Logging

```javascript
// Detailed request logging
{
  request_id: 'req_abc123',
  method: 'POST',
  url: '/api/v1/data/123/rows',
  headers: { ... },
  body: { ... },
  user: {
    id: 456,
    email: 'user@example.com',
    project_id: 26
  },
  response: {
    status: 200,
    time_ms: 45,
    size_bytes: 1234
  },
  sql_queries: [
    {
      query: 'SELECT * FROM users WHERE id = $1',
      params: [123],
      time_ms: 12
    }
  ]
}
```

### Performance Profiler

```bash
GET /api/v1/debug/performance/slow-queries
    → Queries slower than threshold

GET /api/v1/debug/performance/endpoints
    → Endpoint latency metrics

GET /api/v1/debug/performance/database
    → Database connection pool stats
```

---

## 📊 Additional Features

### Field-Level Encryption

```sql
CREATE TABLE encrypted_fields (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  field_name VARCHAR(100),
  encryption_method VARCHAR(50), -- AES-256, RSA
  key_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true
);
```

### Event Bus System

```javascript
// Publish event
eventBus.publish({
  type: 'user.created',
  data: { user_id: 123 },
  timestamp: new Date()
});

// Subscribe
eventBus.subscribe('user.created', async (event) => {
  await sendWelcomeEmail(event.data.user_id);
});
```

### CLI Tools

```bash
# Endpoint testing tool
node cli-endpoint-request.js \
  --endpoint /api/v1/tables \
  --method GET \
  --project 26

# Migration runner
node run-migration.js --phase 2

# Database seeder
node seed-database.js --env development
```

### JavaScript SDK

```javascript
import { HzmClient } from '@hzm/sdk';

const client = new HzmClient({
  apiKey: 'hzm_abc123',
  projectId: 26
});

// Easy API calls
const users = await client.tables('users').list();
const user = await client.tables('users').create({
  name: 'John',
  email: 'john@example.com'
});
```

---

## 🎯 Use Cases

### 1. Table Aliases for Better DX

```javascript
// Old way
const products = await db.query(
  'SELECT * FROM products_project_26_1698765432'
);

// New way with alias
const products = await db.query(
  'SELECT * FROM @products'
);
```

### 2. Dynamic CORS for Multi-Environment

```javascript
// Staging
allowed_domains: ['https://staging.myapp.com']

// Production  
allowed_domains: [
  'https://myapp.com',
  'https://www.myapp.com',
  'https://app.myapp.com'
]
```

### 3. Code Quality Gates

```javascript
// CI/CD integration
const scan = await runCodeScan(projectId);

if (scan.security_score < 70) {
  throw new Error('Security score too low! Deployment blocked.');
}

if (scan.critical_issues > 0) {
  throw new Error('Critical issues found! Fix before deploying.');
}
```

---

## ✅ Best Practices

1. **Table Aliases:** Use consistent naming (@entity-name)
2. **CORS:** Start restrictive, expand as needed
3. **Code Scanning:** Run automatically on git push
4. **Debug Tools:** Disable in production
5. **Event Bus:** Use for async operations
6. **Encryption:** Only encrypt sensitive fields

---

## 🎚️ Feature Flags

### Nedir?

Organization-level feature toggle sistemi. Plan bazlı veya beta özellikleri kontrol eder.

### Database Schema

```sql
-- Global feature tanımları
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT,
  default_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization-specific feature states
CREATE TABLE organization_features (
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key TEXT REFERENCES feature_flags(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, feature_key)
);
```

### Default Features

```sql
INSERT INTO feature_flags (key, description, default_enabled) VALUES
('advanced_analytics', 'Gelişmiş analitik özellikleri', false),
('webhooks', 'Webhook entegrasyonları', false),
('api_rate_limit_bypass', 'API rate limit bypass', false),
('custom_domains', 'Özel domain kullanımı', false),
('sso', 'Single Sign-On (SSO)', false),
('priority_support', 'Öncelikli destek', false);
```

### API Endpoints

```bash
GET  /api/v1/features
     → List all available features

GET  /api/v1/organizations/:orgId/features
     → Get organization's enabled features

POST /api/v1/organizations/:orgId/features/:featureKey
     → Enable feature for organization
     Requires: owner role

DELETE /api/v1/organizations/:orgId/features/:featureKey
       → Disable feature
       Requires: owner role
```

### Usage in Code

```javascript
// Check if feature enabled
async function hasFeature(orgId, featureKey) {
  const result = await pool.query(`
    SELECT 
      COALESCE(
        (SELECT enabled FROM organization_features 
         WHERE organization_id = $1 AND feature_key = $2),
        (SELECT default_enabled FROM feature_flags WHERE key = $2)
      ) as enabled
  `, [orgId, featureKey]);
  
  return result.rows[0]?.enabled || false;
}

// Use in route
router.get('/api/v1/analytics/advanced', async (req, res) => {
  const { orgId } = req.params;
  
  if (!await hasFeature(orgId, 'advanced_analytics')) {
    return res.status(403).json({
      error: 'Feature not enabled',
      feature: 'advanced_analytics',
      upgrade_url: '/pricing'
    });
  }
  
  // Return advanced analytics...
});
```

### Use Cases

#### 1. Plan-Based Features
```javascript
// Free plan
{ advanced_analytics: false, webhooks: false }

// Pro plan
{ advanced_analytics: true, webhooks: true }

// Enterprise plan
{ advanced_analytics: true, webhooks: true, sso: true, custom_domains: true }
```

#### 2. Beta Features
```javascript
// Enable for specific organizations for testing
await enableFeature(orgId, 'new_ai_assistant');

// Rollback if issues
await disableFeature(orgId, 'new_ai_assistant');
```

#### 3. Gradual Rollout
```javascript
// Enable for 10% of organizations
const orgs = await getAllOrganizations();
const subset = orgs.slice(0, Math.floor(orgs.length * 0.1));

for (const org of subset) {
  await enableFeature(org.id, 'new_dashboard');
}
```

### Frontend Integration

```javascript
// React component
function AdvancedAnalytics() {
  const { features } = useOrganization();
  
  if (!features.advanced_analytics) {
    return (
      <UpgradePrompt 
        feature="Advanced Analytics"
        plan="Pro"
      />
    );
  }
  
  return <AnalyticsDashboard />;
}
```

### Benefits

- ✅ **A/B Testing:** Test features with subset of users
- ✅ **Gradual Rollout:** Deploy features incrementally
- ✅ **Kill Switch:** Disable problematic features instantly
- ✅ **Plan Management:** Control features by subscription tier
- ✅ **Beta Access:** Give early access to selected customers
- ✅ **Feature Trials:** Temporary feature access

---

**Dosya:** `07-Advanced-Features/23_Advanced_Features.md`  
**Versiyon:** 1.0.0  
**Son Güncelleme:** 2025-10-21  
**Durum:** ✅ Production Ready

