# 🎯 Akıllı Endpoint Stratejisi (v2.1)

> **28 Endpoint, Sıfır Belirsizlik: Production-Ready DBaaS API Mimarisi**

[Ana Sayfa](README.md) | [Backend Phase Plan](BACKEND_PHASE_PLAN.md) | [Güvenlik](./03-Security/01_Security_Auth.md)

---

## 📋 Executive Summary

### Problem
- 50+ endpoint → bakım zorluğu
- Tutarsız güvenlik modeli
- Belirsiz authorization
- Eksik validation

### Çözüm
- **28 endpoint** (balanced: generic + specialized)
- **Opak API keys** (güvenli)
- **Net authorization** (resource + role matrix)
- **Katmanlı validation** (her seviyede)

### Sonuç
- ✅ %70 daha az endpoint
- ✅ Sıfır çelişki
- ✅ Production-ready güvenlik
- ✅ Net implementation plan

---

## 🎯 Temel İlkeler (Çelişkisiz)

### 1. JWT Sadece İlk Giriş İçin

**Ne Zaman:**
- ✅ `/auth/login` - İlk giriş
- ✅ `/auth/register` - Kayıt
- ✅ `/auth/refresh` - Token yenileme

**Ne Zaman DEĞİL:**
- ❌ Data operations (API Key kullan)
- ❌ Admin operations (API Key kullan)
- ❌ Settings (API Key kullan)

**Neden:**
- JWT revoke edilemez (stateless)
- API Key revoke edilebilir (stateful)
- API Key tenant-scoped (RLS friendly)

---

### 2. Opak API Key (GÜVENLİ)

**❌ ESKİ (Güvensiz):**
```
hzm_live_t1_u123_xxx
         ^^  ^^^^
         │    └─ User ID AÇIKTA (enumeration riski!)
         └────── Tenant ID AÇIKTA (discovery riski!)
```

**✅ YENİ (Güvenli):**
```
hzm_live_01H3K8N2PQ7R8XWVZ5M6T9Y4.AbCdEfGh12345678
         └────────────────────────┘ └───────────────┘
         Key ID (UUID)              Random (32 char)
```

**Nasıl Çalışır:**
1. API Key generate edilir: `hzm_live_{keyId}.{random}`
2. Database'de saklanır: `key_id`, `user_id`, `tenant_id`, `key_hash`
3. Lookup: `key_id` ile → `user_id` ve `tenant_id` bulunur
4. Hiçbir bilgi DIŞARI sızmaz!

**Tablo:**
```sql
core.api_keys:
  - key_id (UUID, UNIQUE)
  - user_id (FK)
  - tenant_id (FK)
  - key_hash (SHA-256)
  - last_four (görünür kısım)
  - scopes (TEXT[])
  - expires_at
  - is_active
```

---

### 3. Generic Endpoint + Authorization

**Pattern:**
```
GET /api/v1/data/:resource
```

**Authorization Matrix:**
```
RESOURCE          | user | admin | master_admin
------------------+------+-------+-------------
projects          |  ✅  |  ✅   |     ✅
users             |  ❌  |  ✅   |     ✅
api_keys          |  ❌  |  ❌   |     ✅
tenants           |  ❌  |  ❌   |     ✅
audit_logs        |  ❌  |  ✅   |     ✅
generic_data      |  ✅  |  ✅   |     ✅
```

**Implementation:**
- Resource whitelist per role
- Schema-based access (core.* = admin, app.* = user)
- RLS her zaman aktif

---

### 4. Katmanlı Validation

**Layer 1: API Key Validation**
- Key format check
- Key ID lookup
- Revoke check
- Expiry check

**Layer 2: API Password Validation**
- Argon2id hash compare
- Brute force protection (rate limit)
- Password rotation check

**Layer 3: Authorization**
- Resource whitelist check
- Role check
- Tenant scope check

**Layer 4: Input Validation**
- Field name regex: `/^[a-zA-Z0-9_]+$/`
- Operator whitelist
- Value type check
- Array size limit (max 100)
- Depth limit (max 2)

**Layer 5: RLS Context**
- `app.set_context(tenant_id, user_id)`
- Transaction-scoped (LOCAL)
- Verification query

---

## 🔐 Scopes & Permissions

### Scope Format
**Pattern:** `resource:action`

**Examples:**
- `projects:read` - Read projects
- `projects:write` - Create/update/delete projects
- `users:read` - Read users (admin only)
- `users:write` - Manage users (admin only)
- `admin:all` - All admin operations (master_admin only)

---

### Resource Scope Matrix

| Resource          | Read Scope       | Write Scope      | Who Can Access          |
|-------------------|------------------|------------------|-------------------------|
| `projects`        | `projects:read`  | `projects:write` | user, admin, master     |
| `generic_data`    | `data:read`      | `data:write`     | user, admin, master     |
| `users`           | `users:read`     | `users:write`    | admin, master           |
| `api_keys`        | `keys:read`      | `keys:write`     | master only             |
| `tenants`         | `tenants:read`   | `tenants:write`  | master only             |
| `audit_logs`      | `audit:read`     | -                | admin, master           |

---

### Scope Enforcement

**Validation Steps:**
1. Extract scopes from `core.api_keys.scopes`
2. Check if required scope exists
3. If missing → `403 Forbidden`

**Example:**
```
GET /data/projects requires: projects:read
POST /data/users requires: users:write
GET /admin?type=users requires: users:read + admin role
```

**Phase:** Scope system eklenecek - Phase 3

---

## 📊 28 Endpoint Inventory

### **OZET (Quick Reference):**
```
1️⃣  Authentication (JWT)           4 endpoint
2️⃣  API Keys Management             9 endpoint  
3️⃣  Projects (Core Entity)          6 endpoint
4️⃣  Generic Data (Dynamic)          6 endpoint
5️⃣  Admin Operations                1 endpoint
6️⃣  Health & Monitoring             2 endpoint
──────────────────────────────────────────────
TOPLAM:                            28 endpoint
```

---

### 1️⃣ Authentication (4 Endpoint - JWT)

#### POST /auth/register
- **Auth**: Public
- **Phase**: Phase 1
- **Rate Limit**: 5/hour per IP

**Input:**
- email (required, email format)
- password (required, min 12 char)
- tenant_name (optional)

**Output:**
- JWT token (7 days)
- Refresh token (30 days)
- API key (opak, show once!)
- API password (auto-generated, show once!)

**Side Effects:**
- Tenant oluşturulur (yoksa)
- User oluşturulur
- API key oluşturulur

---

#### POST /auth/login
- **Auth**: Public
- **Phase**: Phase 1
- **Rate Limit**: 10/minute per email

**Input:**
- email (required)
- password (required)

**Output:**
- JWT token
- Refresh token
- Organizations list (user'ın erişebildiği)
- API keys (her org için - SADECE key_id + last_four)

**Multi-Org:**
- User birden fazla org'da olabilir
- Her org için ayrı API key
- Context switch desteklenir

---

#### POST /auth/refresh
- **Auth**: Refresh Token
- **Phase**: Phase 1
- **Rate Limit**: 60/hour per user

**Input:**
- refresh_token (required)

**Output:**
- JWT token (yeni)
- Refresh token (yeni, rotated)

**Security:**
- Token family tracking
- Reuse detection → revoke entire family
- Max 1 refresh/minute

---

#### GET /auth/me
- **Auth**: JWT Token
- **Phase**: Phase 1
- **Rate Limit**: 100/minute per user

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Output:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin",
    "tenant_id": "uuid",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Use Case:**
- Frontend'de current user bilgisi almak için
- Session validation
- Role-based UI rendering

---

### 2️⃣ API Keys Management (9 Endpoint - API Key + JWT)

**Purpose:** 
- User ve Master Admin için API key yönetimi
- Generate, regenerate, revoke operations
- Security-critical operations (ayrı endpoint grubu!)

**Why Separate from Settings?**
- API Keys are security-critical
- Require special audit logging
- Need different rate limits
- Clear separation of concerns

---

#### GET /api-keys/me
- **Auth**: JWT or API Key + Password
- **Phase**: Phase 1

**Output:**
```json
{
  "api_key": "hzm_live_...",
  "api_password": "***",
  "created_at": "2025-01-01",
  "last_used": "2025-01-15"
}
```

---

#### POST /api-keys/generate
- **Auth**: JWT
- **Phase**: Phase 1

**Output:**
- New API Key (opak)
- New API Password (show once!)

---

#### POST /api-keys/regenerate
- **Auth**: JWT + MFA
- **Phase**: Phase 1

**Security:**
- Old key revoked immediately
- All active sessions invalidated
- Email notification sent

---

#### POST /api-keys/regenerate-password
- **Auth**: JWT + MFA
- **Phase**: Phase 1

**Security:**
- Only password changes
- Key remains same
- Email notification sent

---

#### DELETE /api-keys/revoke
- **Auth**: JWT
- **Phase**: Phase 1

**Effect:**
- Soft delete (is_active = false)
- All sessions invalidated
- Audit log entry

---

#### GET /api-keys/master-admin
- **Auth**: JWT (master_admin role)
- **Phase**: Phase 1

**Output:**
- Master Admin API Key info
- **NOT** the actual keys (security!)

---

#### POST /api-keys/master-admin/generate
- **Auth**: JWT (master_admin role) + MFA
- **Phase**: Phase 1

**Security:**
- Requires MFA
- IP whitelist check
- Full audit trail

---

#### POST /api-keys/master-admin/regenerate
- **Auth**: JWT (master_admin role) + MFA
- **Phase**: Phase 1

**Security:**
- Same as generate
- Old key revoked

---

#### POST /api-keys/master-admin/regenerate-password
- **Auth**: JWT (master_admin role) + MFA
- **Phase**: Phase 1

**Security:**
- Password only
- Full audit trail

---

### 3️⃣ Projects (6 Endpoint - API Key)

**Purpose:**
- Core entity management
- Projects are fundamental to the system
- Each project can have its own API keys (future)
- Separate from generic data (special logic)

**Why Separate from Generic Data?**
- Projects have special permissions (members, roles)
- Projects can be shared across users
- Projects need status management
- Projects are referenced by many other entities

---

#### GET /projects
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: user, admin, master_admin

**Query:**
```
filter[status]=active
sort=-created_at
limit=50
```

---

#### POST /projects
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: admin, master_admin

**Input:**
```json
{
  "name": "E-Commerce Platform",
  "description": "Online store project",
  "status": "active"
}
```

---

#### GET /projects/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2

**Output:**
- Full project details
- Members list (future)
- Statistics (future)

---

#### PUT /projects/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: admin, master_admin

**Input:**
- All project fields (full replacement)

---

#### PATCH /projects/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: admin, master_admin

**Input:**
- Partial update (only provided fields)

---

#### DELETE /projects/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: admin, master_admin

**Effect:**
- Soft delete (is_deleted = true)
- Cascade to related entities (optional)

---

### 4️⃣ Generic Data Operations (6 Endpoint - API Key)

**Headers:**
```
X-API-Key: hzm_live_...
X-API-Password: ***
X-Tenant-Id: 5 (optional, switch org)

# HMAC Headers (Optional for frontend, REQUIRED for server-to-server)
X-Timestamp: 1698765432 (epoch seconds)
X-Nonce: random_string
X-Signature: hmac_sha256_hex (server-to-server only)
```

**HMAC Policy:**
- Frontend → API: Optional (recommended Phase 4+)
- Server → Server: REQUIRED (Phase 3+)
- Compute → API: REQUIRED (Phase 5)

---

#### GET /data/:resource
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: Depends on resource

**Query Parameters:**
```
filter[field][eq]=value
filter[field][gt]=100
sort=-created_at
cursor=base64_encrypted
limit=50 (max 100)
include=relation (max 5, depth 1)
fields=name,email (whitelist)
```

**Validation:**
- Resource authorization check
- Field whitelist per role
- Operator whitelist
- Filter depth max 2
- Array size max 100
- Include max 5, depth 1

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "encrypted_cursor",
    "has_more": true
  }
}
```

---

#### POST /data/:resource
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: user, admin, master_admin

**Input:**
- Resource fields (validated)

**Auto-Inject:**
- tenant_id (from API key)
- created_by (from API key)
- created_at (NOW())

**Validation:**
- Field whitelist per resource
- Type validation
- Required fields
- Unique constraints

---

#### GET /data/:resource/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2

**Query:**
```
include=relation
fields=name,email
```

**RLS:**
- Automatic tenant filter
- Row-level permissions

---

#### PUT /data/:resource/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: user, admin, master_admin

**Headers:**
```
If-Match: v5 (optimistic concurrency)
```

**Validation:**
- Version check
- Field whitelist
- Permission check

---

#### PATCH /data/:resource/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2

**Same as PUT but:**
- Partial update
- Only provided fields updated

---

#### DELETE /data/:resource/:id
- **Auth**: API Key + Password
- **Phase**: Phase 2
- **Roles**: admin, master_admin

**Soft Delete:**
- `is_deleted = TRUE`
- `deleted_at = NOW()`
- `deleted_by = user_id`

**Cascade:**
- Children soft delete (optional)
- Restore option (with children)

---

### 5️⃣ Admin Operations (1 Endpoint - API Key)

**Purpose:**
- Master admin dashboard queries
- Tenant-wide statistics
- Cross-tenant visibility (master_admin only)

---

#### GET /admin/database?type={type}
- **Auth**: API Key + Password
- **Phase**: Phase 3
- **Roles**: admin (own tenant), master_admin (all tenants)

**Types:**

**`tables`** (admin, master_admin):
```
GET /admin/database?type=tables&include=columns
```
- Returns: Table list with metadata

**`schemas`** (master_admin):
```
GET /admin/database?type=schemas
```
- Returns: Database schemas

**`users`** (admin - own tenant, master_admin - all):
```
GET /admin/database?type=users&filter[role]=admin
```
- Sensitive fields masked (password_hash REDACTED)

**`audit-logs`** (admin, master_admin):
```
GET /admin/database?type=audit-logs&filter[action]=DELETE
```
- 90 days retention

**`stats`** (admin, master_admin):
```
GET /admin/database?type=stats
```
- Usage metrics

**Authorization:**
- Type whitelist per role
- Tenant scope enforced (admin)
- Cross-tenant (master_admin + MFA)

**Security Requirements:**
- ✅ MFA: REQUIRED for all admin operations
- ✅ IP Allowlist: REQUIRED (defined in tenant settings)
- ✅ Rate Limit: 10/minute per user, 5/minute per IP
- ✅ PII Masking: AUTO (password_hash, api_key_hash → REDACTED)
- ✅ Pagination: REQUIRED (max 100 per page, cursor-based)
- ✅ Audit: All admin operations logged to ops.audit_events

**Masked Fields (AUTO):**
- `password_hash` → `[REDACTED]`
- `api_password_hash` → `[REDACTED]`
- `api_key_hash` → `[REDACTED]`
- `refresh_token` → `[REDACTED]`

---

### 6️⃣ Health & Monitoring (2 Endpoint - Public/API Key)

**Purpose:**
- System health checks
- Uptime monitoring
- Kubernetes/Railway readiness probes

---

#### GET /health
- **Auth**: Public
- **Phase**: Phase 1
- **Rate Limit**: 1000/minute (lenient for monitoring)

**Output:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": 1698765432,
  "checks": {
    "database": { "status": "ok", "responseTime": 5 },
    "redis": { "status": "ok", "responseTime": 2 }
  }
}
```

**Use Cases:**
- Monitoring services (Datadog, New Relic)
- Load balancer health checks
- CI/CD pipeline validation

---

#### GET /health/ready
- **Auth**: Public
- **Phase**: Phase 1
- **Rate Limit**: 1000/minute

**Output:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true,
    "migrations": true
  }
}
```

**Use Cases:**
- Kubernetes readiness probe
- Railway deployment validation
- Zero-downtime deployments

**Difference from /health:**
- `/health` → Basic liveness check
- `/health/ready` → Full readiness check (migrations, connections)

---

## 🚀 Future Endpoints (Not in v2.1)

These endpoints are planned for future phases but not included in the current 28-endpoint strategy:

### 🔮 Compute (2 Endpoint - Phase 5)

#### POST /compute/formula
- Formula execution in sandbox
- Security: VM2, CPU/memory limits

#### POST /compute/batch
- Batch formula execution
- 100 operations max

### ⚙️ Settings (3 Endpoint - Phase 4+)

Settings functionality will be:
- **User Settings**: Handled via `/data/users/:id` (generic data)
- **Tenant Settings**: Handled via `/data/tenants/:id` (generic data)
- **API Keys**: Already handled via `/api-keys/*` (9 endpoints)

No separate `/settings/*` endpoints needed!

---

#### POST /compute/formula
- **Auth**: API Key + Password
- **Phase**: Phase 5
- **Rate Limit**: 100/minute

**Input:**
```json
{
  "formula": "price * quantity",
  "variables": { "price": 100, "quantity": 5 }
}
```

**Security:**
- VM2 sandbox (isolated-vm)
- CPU limit (100ms)
- Memory limit (10MB)
- Function whitelist
- AST analysis (no loops)

**Isolation Strategy:**
- ✅ **PRIMARY**: Separate process (child_process)
  - Crash → API unaffected
  - CPU/memory limits via OS (cgroups)
  - Timeout: 5 seconds max
- ✅ **FALLBACK**: Worker thread (same process)
  - If separate process unavailable
  - Circuit breaker (5 consecutive failures → disable)
- ✅ **NEVER**: Same thread (RCE risk!)

**Circuit Breaker:**
- 5 consecutive failures → disable compute for 5 minutes
- Alert admin
- Audit log failure pattern

**Limits:**
- Formula max length: 500 chars
- Variables max: 20
- Timeout: 5 seconds (hard limit)
- Max concurrent computations: 10 per tenant

---

#### POST /compute/batch
- **Auth**: API Key + Password
- **Phase**: Phase 5
- **Rate Limit**: 10/minute

**Input:**
```json
{
  "formula": "price * quantity",
  "records": [...]  // max 1000
}
```

**Limits:**
- Max records: 1000
- Timeout: 5 seconds

---

### 6️⃣ Health (2 Endpoint - Public)

#### GET /health
- **Auth**: Public
- **Phase**: Phase 1

**Response:**
```json
{
  "status": "healthy",
  "build": {
    "version": "1.2.3",
    "commit": "abc123",
    "date": "2025-10-20"
  },
  "services": {
    "database": { "status": "ok", "latency_ms": 5 },
    "redis": { "status": "ok", "latency_ms": 2 }
  }
}
```

---

#### GET /health/ready
- **Auth**: Public
- **Phase**: Phase 1

**Kubernetes Readiness:**
```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "migrations": "up_to_date"
  }
}
```

---

## 🗄️ Database Schema

### core.users
```sql
CREATE TABLE core.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  -- Argon2id
  
  -- API Password (Argon2id hashed)
  api_password_hash TEXT,
  api_password_previous_hash TEXT,  -- Grace period (7 days)
  api_password_rotated_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** Plaintext password YOK! Her zaman hash.

---

### core.tenants
```sql
CREATE TABLE core.tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  
  -- Settings
  default_language VARCHAR(10) DEFAULT 'en',
  default_currency VARCHAR(10) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Limits
  max_api_requests_per_day INTEGER DEFAULT 10000,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### core.user_organizations
```sql
CREATE TABLE core.user_organizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES core.users(id),
  tenant_id INTEGER REFERENCES core.tenants(id),
  
  role VARCHAR(50) NOT NULL,  -- user, admin, master_admin
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);
```

---

### core.api_keys (OPAK!)
```sql
CREATE TABLE core.api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES core.users(id),
  tenant_id INTEGER REFERENCES core.tenants(id),
  
  -- Opak Key
  key_id UUID DEFAULT gen_random_uuid() UNIQUE,
  key_hash VARCHAR(255) NOT NULL,  -- SHA-256 of full key
  last_four CHAR(4),  -- For display
  environment VARCHAR(20) DEFAULT 'live',
  
  -- Permissions
  scopes TEXT[] DEFAULT '{}',
  ip_allowlist CIDR[] DEFAULT '{}',
  
  -- Audit & Management
  label TEXT,  -- Display name: "Production Server", "CI/CD Pipeline"
  created_by INTEGER REFERENCES core.users(id),  -- Who created this key
  rotated_from_key_id UUID REFERENCES core.api_keys(key_id),  -- Rotation history
  
  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, environment)
);

CREATE INDEX idx_api_keys_rotated_from ON core.api_keys(rotated_from_key_id);
```

---

### ops.audit_events
```sql
CREATE TABLE ops.audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Actor
  actor_user_id INTEGER,
  actor_tenant_id INTEGER,
  actor_role VARCHAR(50),
  
  -- Action
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id TEXT,
  
  -- Changes (selective, not all fields!)
  changes JSONB,  -- Only sensitive fields
  
  -- Context
  ip_address INET,
  request_id UUID,
  
  metadata JSONB DEFAULT '{}'::jsonb
)
PARTITION BY RANGE (event_at);

-- Monthly partitions (auto-drop after 90 days)
CREATE TABLE ops.audit_events_2025_10 PARTITION OF ops.audit_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

---

## 🔐 Authentication & Authorization

### Flow 1: Register + Login
```
1. POST /auth/register
   Input: email, password, tenant_name
   
2. Backend:
   a) Hash password (Argon2id)
   b) Create tenant
   c) Create user
   d) Create user_organization (role: admin)
   e) Generate API key (opak)
   f) Generate API password (hash)
   g) Create JWT + refresh token
   
3. Response:
   - JWT token (7 days)
   - Refresh token (30 days)
   - API key (opak, show once!)
   - API password (show once!)
   
4. Frontend:
   - Store JWT in sessionStorage
   - Store API key in secure storage
   - Store API password in secure storage
```

---

### Flow 2: API Key Usage
```
1. Request:
   Headers:
     X-API-Key: hzm_live_01H3K8N2PQ7R8XWVZ5M6T9Y4.abc...
     X-API-Password: ***
     X-Tenant-Context: 5 (optional)

2. Backend Validation:
   
   LAYER 1: Parse & Lookup
     - Extract key_id: 01H3K8N2PQ7R8XWVZ5M6T9Y4
     - Lookup in core.api_keys
     - Get: user_id, tenant_id, scopes
     - Check: is_active, expires_at
   
   LAYER 2: Password Verify
     - Get user's api_password_hash
     - Verify with Argon2
     - Check grace period (previous hash)
   
   LAYER 3: Authorization
     - If X-Tenant-Context:
       - Check user_organizations
       - Validate access
       - Log context switch
       - Apply cooldown (max 5/minute)
     - Else: Use API key's tenant_id
   
   LAYER 4: Resource Authorization
     - Check resource whitelist
     - Check role permissions
     - Check field permissions
   
   LAYER 5: RLS Context
     - BEGIN TRANSACTION
     - SELECT app.set_context(tenant_id, user_id)
     - Execute query
     - COMMIT

3. Response:
   - Data (filtered by RLS)
   - Metadata
```

---

## 🛡️ Security & Validation

### Filter Validation
```javascript
// Field name validation
const FIELD_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

// Operator whitelist
const ALLOWED_OPERATORS = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'IN',
  contains: 'ILIKE',
  is_null: 'IS NULL'
};

// Type-operator validation
const OPERATOR_TYPE_MAP = {
  string: ['eq', 'ne', 'in', 'contains', 'is_null'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null'],
  boolean: ['eq', 'ne', 'is_null'],
  date: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'is_null']
};

// Limits
const FILTER_LIMITS = {
  max_depth: 2,
  max_array_size: 100,
  max_filters: 20
};
```

**Example Safe Query:**
```javascript
function buildWhereClause(filters, fieldTypes, allowedFields) {
  // 1. Field whitelist check
  for (const field of Object.keys(filters)) {
    if (!allowedFields.includes(field)) {
      throw new Error(`Field not allowed: ${field}`);
    }
    if (!FIELD_NAME_REGEX.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
  }
  
  // 2. Operator + type validation
  // 3. Build prepared statement
  // 4. Return { where, params }
}
```

---

### Include (Join) Validation
```javascript
const INCLUDE_LIMITS = {
  max_includes: 5,
  max_depth: 1,  // No nested includes
  circular_detection: true
};

// Whitelist per resource
const ALLOWED_INCLUDES = {
  projects: ['owner', 'members', 'tenant'],
  users: ['tenant', 'organizations'],
  // ...
};
```

---

### Cursor Security

**Allowed Fields (WHITELIST ONLY):**
- ✅ `id` (technical field)
- ✅ `created_at` (technical field)
- ✅ `tenant_id` (context binding)
- ✅ `user_id` (context binding)
- ❌ PII fields (email, name, phone) - FORBIDDEN!

**Expiry:** 1 hour (prevents stale cursors)

```javascript
// ❌ BAD: Unencrypted cursor
const cursor = Buffer.from(JSON.stringify({ id, created_at })).toString('base64');

// ✅ GOOD: HMAC-signed cursor with tenant/user binding
function createCursor(data, context, secret) {
  // ONLY technical fields + context
  const payload = {
    id: data.id,
    created_at: data.created_at,
    tenant_id: context.tenant_id,  // Bind to tenant
    user_id: context.user_id,      // Bind to user
    exp: Date.now() + 3600_000     // 1 hour expiry
  };
  
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `${b64}.${signature}`;
}

function verifyCursor(cursor, context, secret) {
  const [b64, signature] = cursor.split('.');
  const expected = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  
  if (signature !== expected) {
    throw new Error('Invalid cursor signature');
  }
  
  const data = JSON.parse(Buffer.from(b64, 'base64url').toString());
  
  // Expiry check
  if (data.exp < Date.now()) {
    throw new Error('Cursor expired');
  }
  
  // Context binding check (CRITICAL!)
  if (data.tenant_id !== context.tenant_id || data.user_id !== context.user_id) {
    throw new Error('Cursor tenant/user mismatch');
  }
  
  return data;
}
```

---

### Rate Limiting

**Per Endpoint Limits:**

| Endpoint Group      | Per User | Per Tenant | Per IP  | Window  |
|---------------------|----------|------------|---------|---------|
| `/auth/register`    | -        | -          | 5       | hour    |
| `/auth/login`       | 10       | 100        | 50      | minute  |
| `/auth/refresh`     | 60       | -          | -       | hour    |
| `/data/*` (READ)    | 60       | 300        | -       | minute  |
| `/data/*` (WRITE)   | 30       | 150        | -       | minute  |
| `/admin`            | 10       | -          | 5       | minute  |
| `/settings` (GET)   | 60       | -          | -       | minute  |
| `/settings` (PUT)   | 10       | -          | -       | minute  |
| `/compute/formula`  | 100      | 1000       | -       | minute  |
| `/compute/batch`    | 10       | 50         | -       | minute  |
| `/health`           | -        | -          | -       | -       |

**Notes:**
- `-` means no limit
- Per user limits apply after authentication
- Per tenant limits are global across all users
- Per IP limits apply to unauthenticated endpoints

---

```javascript
// Multi-tier + Fallback
const RATE_LIMITS = {
  // Per user
  user: {
    requests_per_minute: 60,
    requests_per_hour: 1000,
    requests_per_day: 10000
  },
  
  // Per tenant (GLOBAL)
  tenant: {
    requests_per_minute: 300,
    requests_per_hour: 10000,
    requests_per_day: 100000
  },
  
  // Redis failure → fallback (PostgreSQL)
  fallback_tier: 'user',
  fallback_storage: 'postgresql',
  
  // Algorithm: Token bucket (smoother than fixed window)
  algorithm: 'token_bucket'
};
```

---

### RLS Context Safety
```sql
-- SECURITY DEFINER (run as function owner)
CREATE OR REPLACE FUNCTION app.set_context(p_tenant INT, p_user INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
BEGIN
  -- LOCAL scope (transaction-scoped, auto-cleared)
  PERFORM set_config('app.tenant_id', p_tenant::TEXT, TRUE);
  PERFORM set_config('app.user_id', p_user::TEXT, TRUE);
  
  -- Verification (critical!)
  IF current_setting('app.tenant_id', TRUE)::INT != p_tenant THEN
    RAISE EXCEPTION 'RLS context mismatch!';
  END IF;
END;
$$;
```

**Usage:**
```javascript
async function executeQuery(sql, params, context) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_context($1, $2)', [
      context.tenant_id,
      context.user_id
    ]);
    
    const result = await client.query(sql, params);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## ⚠️ Error Response Standard

### Standard Error Format

**All endpoints MUST return errors in this format:**

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key is invalid or revoked",
    "details": {
      "key_id": "01H3K8...",
      "reason": "revoked_at: 2025-10-20T10:30:00Z"
    }
  },
  "request_id": "req_abc123def456",
  "timestamp": "2025-10-23T14:30:00Z"
}
```

---

### Error Code Hierarchy

**AUTH_* (Authentication Errors) - 401:**
- `AUTH_MISSING_API_KEY` - X-API-Key header missing
- `AUTH_INVALID_API_KEY` - API key format invalid
- `AUTH_REVOKED_API_KEY` - API key has been revoked
- `AUTH_EXPIRED_API_KEY` - API key has expired
- `AUTH_INVALID_PASSWORD` - API password incorrect
- `AUTH_MISSING_TOKEN` - JWT token missing
- `AUTH_INVALID_TOKEN` - JWT token invalid or expired

**AUTHZ_* (Authorization Errors) - 403:**
- `AUTHZ_RESOURCE_FORBIDDEN` - User cannot access this resource
- `AUTHZ_SCOPE_MISSING` - Required scope not in API key
- `AUTHZ_TENANT_MISMATCH` - Resource belongs to different tenant
- `AUTHZ_MFA_REQUIRED` - MFA required for this operation
- `AUTHZ_IP_NOT_ALLOWED` - IP not in allowlist

**VALIDATION_* (Input Validation) - 400:**
- `VALIDATION_FIELD_INVALID` - Field name contains invalid characters
- `VALIDATION_OPERATOR_INVALID` - Operator not allowed
- `VALIDATION_TYPE_MISMATCH` - Value type doesn't match field type
- `VALIDATION_ARRAY_TOO_LARGE` - Array exceeds max size (100)
- `VALIDATION_DEPTH_EXCEEDED` - Filter depth exceeds max (2)
- `VALIDATION_REQUIRED_FIELD` - Required field missing

**RATE_LIMIT_* (Rate Limiting) - 429:**
- `RATE_LIMIT_USER_EXCEEDED` - Per-user rate limit exceeded
- `RATE_LIMIT_TENANT_EXCEEDED` - Per-tenant rate limit exceeded
- `RATE_LIMIT_IP_EXCEEDED` - Per-IP rate limit exceeded

**RESOURCE_* (Resource Errors) - 404/409:**
- `RESOURCE_NOT_FOUND` - Resource not found (404)
- `RESOURCE_CONFLICT` - Resource already exists (409)
- `RESOURCE_VERSION_CONFLICT` - Optimistic concurrency conflict (409)
- `RESOURCE_SOFT_DELETED` - Resource is soft-deleted (410)

**SERVER_* (Server Errors) - 500:**
- `SERVER_INTERNAL_ERROR` - Unexpected server error
- `SERVER_DATABASE_ERROR` - Database connection/query error
- `SERVER_TIMEOUT` - Request timeout
- `SERVER_UNAVAILABLE` - Service temporarily unavailable (503)

---

### HTTP Status Code Mapping

| Error Code Prefix | HTTP Status | Meaning                      |
|-------------------|-------------|------------------------------|
| `AUTH_*`          | 401         | Authentication failed        |
| `AUTHZ_*`         | 403         | Authorization denied         |
| `VALIDATION_*`    | 400         | Invalid input                |
| `RATE_LIMIT_*`    | 429         | Too many requests            |
| `RESOURCE_*`      | 404/409/410 | Resource state issue         |
| `SERVER_*`        | 500/503     | Server-side error            |

---

### Error Response Examples

**Authentication Error:**
```json
{
  "error": {
    "code": "AUTH_REVOKED_API_KEY",
    "message": "This API key has been revoked",
    "details": {
      "key_id": "01H3K8N2PQ7R8XWVZ5M6T9Y4",
      "revoked_at": "2025-10-20T10:30:00Z",
      "revoked_by": "user@example.com"
    }
  },
  "request_id": "req_abc123",
  "timestamp": "2025-10-23T14:30:00Z"
}
```

**Authorization Error:**
```json
{
  "error": {
    "code": "AUTHZ_SCOPE_MISSING",
    "message": "API key is missing required scope",
    "details": {
      "required_scope": "users:write",
      "available_scopes": ["projects:read", "projects:write"]
    }
  },
  "request_id": "req_def456",
  "timestamp": "2025-10-23T14:30:00Z"
}
```

**Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ARRAY_TOO_LARGE",
    "message": "Array size exceeds maximum allowed",
    "details": {
      "field": "filter[status][in]",
      "size": 150,
      "max_size": 100
    }
  },
  "request_id": "req_ghi789",
  "timestamp": "2025-10-23T14:30:00Z"
}
```

**Rate Limit Error:**
```json
{
  "error": {
    "code": "RATE_LIMIT_USER_EXCEEDED",
    "message": "Rate limit exceeded for your user",
    "details": {
      "limit": 60,
      "window": "minute",
      "retry_after": 45
    }
  },
  "request_id": "req_jkl012",
  "timestamp": "2025-10-23T14:30:00Z"
}
```

---

### Client Error Handling

**Recommended Client Logic:**

```javascript
async function handleApiError(response) {
  const error = await response.json();
  
  switch (error.error.code) {
    case 'AUTH_REVOKED_API_KEY':
    case 'AUTH_EXPIRED_API_KEY':
      // Redirect to settings to regenerate key
      break;
      
    case 'AUTHZ_SCOPE_MISSING':
      // Show upgrade prompt
      break;
      
    case 'RATE_LIMIT_USER_EXCEEDED':
      // Wait retry_after seconds
      await sleep(error.error.details.retry_after * 1000);
      break;
      
    case 'RESOURCE_VERSION_CONFLICT':
      // Retry with latest version
      break;
      
    default:
      // Show generic error
  }
}
```

---

## 📅 Phase-Based Implementation

### Phase 0: Foundation ✅
- PostgreSQL setup
- Schema organization
- Helper functions
- Migration system

**Endpoints**: None

---

### Phase 1: Authentication (2 weeks) 🔥
**Endpoints:**
- ✅ POST /auth/register
- ✅ POST /auth/login
- ✅ POST /auth/refresh
- ✅ GET /health
- ✅ GET /health/ready

**Database:**
- ✅ core.users (with api_password_hash)
- ✅ core.tenants
- ✅ core.user_organizations
- ✅ core.api_keys (OPAK!)

**Critical:**
- Opak API key generation
- Argon2id hashing
- JWT refresh rotation

---

### Phase 2: Generic CRUD (4 weeks) 🔥
**Endpoints:**
- ✅ GET /data/:resource
- ✅ POST /data/:resource
- ✅ GET /data/:resource/:id
- ✅ PUT /data/:resource/:id
- ✅ PATCH /data/:resource/:id
- ✅ DELETE /data/:resource/:id

**Security:**
- ✅ Resource authorization matrix
- ✅ Field whitelist per role
- ✅ Filter validation (5-layer)
- ✅ Include validation
- ✅ Cursor HMAC

**Database:**
- app.generic_data
- core.projects
- RLS policies

---

### Phase 3: Admin & Settings (2 weeks) 🔥
**Endpoints:**
- ✅ GET /admin?type={type}
- ✅ GET /settings?type={type}
- ✅ PUT /settings?type={type}
- ✅ POST /settings/action

**Security:**
- ✅ Admin type whitelist
- ✅ Mass assignment protection
- ✅ Context switch audit + cooldown
- ✅ MFA for sensitive operations

**Database:**
- ops.audit_events (partitioned)

---

### Phase 4: Infrastructure (2 weeks)
**Focus:**
- Rate limiting (token bucket)
- Cache layer (Redis)
- Monitoring & alerts
- Graceful degradation

**No New Endpoints**

---

### Phase 5: Compute (3 weeks)
**Endpoints:**
- ✅ POST /compute/formula
- ✅ POST /compute/batch

**Security:**
- VM2 sandbox (isolated-vm)
- CPU + memory limits
- AST analysis
- Function whitelist

---

### Phase 6-9: Advanced Features (11 weeks)
**Focus:**
- MLM system
- Templates
- Reports
- Email
- Production hardening

**No New Endpoints**

---

## ✅ Implementation Checklist

### P0 - Kritik (Week 1-2)
- [ ] Opak API key generation
- [ ] API password Argon2id hashing
- [ ] Resource authorization matrix
- [ ] Filter validation (5-layer)
- [ ] RLS SECURITY DEFINER
- [ ] Cursor HMAC signing

### P1 - Yüksek (Week 3-4)
- [ ] Include validation (max 5, depth 1)
- [ ] Context switch audit + cooldown
- [ ] Rate limiting (token bucket)
- [ ] Soft delete cascade
- [ ] Pagination cursor expiry
- [ ] JWT refresh rotation

### P2 - Orta (Week 5-8)
- [ ] Mass assignment protection
- [ ] Audit log partitioning
- [ ] Admin type whitelist
- [ ] Version field (BIGINT)
- [ ] API password grace period
- [ ] Compute sandbox (VM2)

---

## 📚 Ek Dökümanlar

**Implementation Examples:**
- Kod örnekleri bu dökümanda YOK
- Sadece YAPISAL örnekler var
- Gerçek implementation için:
  - Backend kod tabanına bak
  - Test case'lere bak
  - Migration dosyalarına bak

**Neden?**
- Kod örnekleri yapıya uymayabilir
- Context'e göre değişir
- Güncel kalmayabilir

**Prensip:**
- Bu döküman: YAPISAL rehber
- Kod: PRATIK implementation
- İkisi birbirini tamamlar

---

## 🎯 Kritik Kararlar (Çelişkisiz)

### 1. API Key: OPAK (Final!)
- ✅ Güvenli (no info leak)
- ✅ Key ID lookup
- ❌ Tenant-scoped GERİ ALINMAMIŞTIR

### 2. HMAC: OPSİYONEL
- Phase 2: API Key + Password yeterli
- Phase 4: HMAC opsiyonel eklenebilir
- Zorunlu değil!

### 3. Pagination: HMAC-Signed Cursor
- Encrypted değil, signed
- Expiry: 1 saat
- User + tenant bound

### 4. Rate Limit: Multi-Tier + Fallback
- Redis primary
- PostgreSQL fallback
- Token bucket algorithm

### 5. RLS: Transaction-Scoped
- Her query BEGIN/COMMIT
- LOCAL scope
- Verification query

---

**[Ana Sayfa](README.md) | [Backend Phase Plan](BACKEND_PHASE_PLAN.md) | [Güvenlik](./03-Security/01_Security_Auth.md)**

