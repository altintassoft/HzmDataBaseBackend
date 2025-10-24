# 🔐 API Authentication & Usage Documentation

> **Comprehensive guide for HZM Database Backend API authentication and usage**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [3-Layer Security System](#3-layer-security-system)
4. [Header Formats](#header-formats)
5. [CRUD Operations](#crud-operations)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Future Enhancements](#future-enhancements)

---

## 🎯 Overview

The HZM Database Backend API supports multiple authentication methods to accommodate different use cases:

- **Web Applications**: JWT-based authentication (session-based)
- **External Systems**: API Key + API Password authentication
- **Hybrid Endpoints**: Both methods accepted (flexible authentication)

### Key Features

- ✅ **3-Layer Security**: Email + API Key + API Password
- ✅ **Automatic Discovery**: System finds tenant_id, user_id, role automatically
- ✅ **Multi-Tenant Isolation**: Row-Level Security (RLS) enforced
- ✅ **Flexible Authentication**: JWT or API Key based on use case
- ✅ **Rate Limiting**: (Coming soon)
- ✅ **IP Whitelisting**: (Coming soon)

---

## 🔑 Authentication Methods

### 1. JWT Authentication (Web/Frontend)

**Use Case**: Web applications, single-page apps (SPA)

**Flow**:
```
1. Login with email + password
2. Receive JWT token
3. Include token in Authorization header
4. System validates token and extracts user info
```

**Pros**:
- ✅ Session-based, secure for web apps
- ✅ Short-lived tokens (configurable expiry)
- ✅ No need to store credentials client-side

**Cons**:
- ❌ Requires login flow
- ❌ Not suitable for server-to-server communication

---

### 2. API Key Authentication (External Systems)

**Use Case**: Server-to-server, CLI tools, scripts, third-party integrations

**Flow**:
```
1. Generate API Key + API Password (once)
2. Include Email + API Key + API Password in headers
3. System validates all three and sets RLS context
4. Access granted based on role and tenant
```

**Pros**:
- ✅ No login required
- ✅ Long-lived credentials
- ✅ Perfect for automation
- ✅ Can be revoked/regenerated

**Cons**:
- ❌ Must be stored securely
- ❌ No automatic expiry (manual rotation recommended)

---

### 3. Hybrid Authentication (Flexible Endpoints)

**Use Case**: Admin panels, reporting tools, flexible access

**Flow**:
```
1. Try JWT first
2. If JWT fails, try API Key
3. Whichever succeeds, grant access
```

**Pros**:
- ✅ Maximum flexibility
- ✅ Single endpoint for multiple clients
- ✅ No duplicate code

---

## 🛡️ 3-Layer Security System

### Input (User Provides)

```
Layer 1: X-Email          → user@example.com
Layer 2: X-API-Key        → hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Layer 3: X-API-Password   → YourSecurePassword123!
```

### Automatic Discovery (System Finds)

```
✅ user_id       → 42
✅ tenant_id     → 1 (organization_id)
✅ role          → admin | master_admin | user
✅ scopes        → ['read', 'write', 'delete']
✅ project_id    → (if applicable)
```

### Security Checks

1. **Email Format Validation** → Valid email structure?
2. **API Key Prefix Check** → Starts with `hzm_`?
3. **User Lookup** → Email exists and active?
4. **API Key Ownership** → Key belongs to this email?
5. **Password Match** → API Password correct?
6. **RLS Context** → Set tenant_id and user_id for query isolation
7. **Role Authorization** → User has required role?

---

## 📨 Header Formats

### JWT Authentication Headers

```http
Authorization: Bearer <jwt_token>
```

**Example**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### API Key Authentication Headers

```http
X-Email: <user_email>
X-API-Key: <api_key>
X-API-Password: <api_password>
```

**Example**:
```http
X-Email: user@example.com
X-API-Key: hzm_1234567890abcdefghijklmnopqrstuvwxyz1234567890
X-API-Password: MySecurePassword123!
```

---

## 🔧 CRUD Operations

### 1. READ Operations (GET)

#### Get All Tables

```http
GET /api/v1/admin/database?type=tables&include=columns,indexes
```

**Headers**:
```
X-Email: your-email@example.com
X-API-Key: hzm_your_api_key_here
X-API-Password: YourAPIPassword
```

**Response**:
```json
{
  "success": true,
  "tables": [
    {
      "schema": "core",
      "name": "users",
      "fullName": "core.users",
      "columns": [...],
      "indexes": [...]
    }
  ]
}
```

---

#### Get Single Table Data

```http
GET /api/v1/admin/database?type=table&schema=core&table=users&include=data
```

**Response**:
```json
{
  "success": true,
  "table": "core.users",
  "data": [
    {
      "id": 1,
      "email": "admin@example.com",
      "role": "admin"
    }
  ]
}
```

---

### 2. CREATE Operations (POST)

#### Create New Record

```http
POST /api/v1/data/users
Content-Type: application/json
```

**Headers**:
```
X-Email: your-email@example.com
X-API-Key: hzm_your_api_key_here
X-API-Password: YourAPIPassword
```

**Body**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "role": "user"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "email": "newuser@example.com",
    "role": "user",
    "created_at": "2025-10-24T10:00:00Z"
  }
}
```

---

### 3. UPDATE Operations (PUT/PATCH)

#### Update Existing Record

```http
PUT /api/v1/data/users/42
Content-Type: application/json
```

**Headers**:
```
X-Email: your-email@example.com
X-API-Key: hzm_your_api_key_here
X-API-Password: YourAPIPassword
```

**Body**:
```json
{
  "role": "admin",
  "is_active": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "email": "newuser@example.com",
    "role": "admin",
    "is_active": true,
    "updated_at": "2025-10-24T10:30:00Z"
  }
}
```

---

### 4. DELETE Operations (DELETE)

#### Delete Record (Soft Delete)

```http
DELETE /api/v1/data/users/42
```

**Headers**:
```
X-Email: your-email@example.com
X-API-Key: hzm_your_api_key_here
X-API-Password: YourAPIPassword
```

**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully",
  "deleted_id": 42
}
```

---

## 💻 Usage Examples

### cURL Examples

#### GET Request with API Key

```bash
curl -X GET \
  -H "X-Email: your-email@example.com" \
  -H "X-API-Key: hzm_your_api_key_here" \
  -H "X-API-Password: YourAPIPassword" \
  "https://your-backend-url.com/api/v1/admin/database?type=tables"
```

#### POST Request with API Key

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Email: your-email@example.com" \
  -H "X-API-Key: hzm_your_api_key_here" \
  -H "X-API-Password: YourAPIPassword" \
  -d '{"email":"newuser@example.com","role":"user"}' \
  "https://your-backend-url.com/api/v1/data/users"
```

#### GET Request with JWT

```bash
curl -X GET \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  "https://your-backend-url.com/api/v1/admin/database?type=tables"
```

---

### JavaScript (Fetch) Examples

#### GET with API Key

```javascript
const response = await fetch('https://your-backend-url.com/api/v1/admin/database?type=tables', {
  method: 'GET',
  headers: {
    'X-Email': 'your-email@example.com',
    'X-API-Key': 'hzm_your_api_key_here',
    'X-API-Password': 'YourAPIPassword'
  }
});

const data = await response.json();
console.log(data);
```

#### POST with API Key

```javascript
const response = await fetch('https://your-backend-url.com/api/v1/data/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Email': 'your-email@example.com',
    'X-API-Key': 'hzm_your_api_key_here',
    'X-API-Password': 'YourAPIPassword'
  },
  body: JSON.stringify({
    email: 'newuser@example.com',
    role: 'user'
  })
});

const data = await response.json();
console.log(data);
```

#### GET with JWT

```javascript
const response = await fetch('https://your-backend-url.com/api/v1/admin/database?type=tables', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});

const data = await response.json();
console.log(data);
```

---

### Python (requests) Examples

#### GET with API Key

```python
import requests

headers = {
    'X-Email': 'your-email@example.com',
    'X-API-Key': 'hzm_your_api_key_here',
    'X-API-Password': 'YourAPIPassword'
}

response = requests.get(
    'https://your-backend-url.com/api/v1/admin/database?type=tables',
    headers=headers
)

data = response.json()
print(data)
```

#### POST with API Key

```python
import requests
import json

headers = {
    'Content-Type': 'application/json',
    'X-Email': 'your-email@example.com',
    'X-API-Key': 'hzm_your_api_key_here',
    'X-API-Password': 'YourAPIPassword'
}

payload = {
    'email': 'newuser@example.com',
    'role': 'user'
}

response = requests.post(
    'https://your-backend-url.com/api/v1/data/users',
    headers=headers,
    data=json.dumps(payload)
)

data = response.json()
print(data)
```

#### GET with JWT

```python
import requests

headers = {
    'Authorization': f'Bearer {jwt_token}'
}

response = requests.get(
    'https://your-backend-url.com/api/v1/admin/database?type=tables',
    headers=headers
)

data = response.json()
print(data)
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| **200** | Success | Request processed successfully |
| **400** | Bad Request | Invalid parameters or missing required fields |
| **401** | Unauthorized | Authentication failed (invalid/missing credentials) |
| **403** | Forbidden | Authenticated but insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **429** | Too Many Requests | Rate limit exceeded (future) |
| **500** | Internal Server Error | Backend error (check logs) |

---

### Error Response Format

All errors return a consistent JSON structure:

```json
{
  "success": false,
  "error": "Short error code",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context"
  }
}
```

---

### Common Error Scenarios

#### 1. Missing API Key Headers

```json
{
  "success": false,
  "error": "Missing credentials",
  "message": "X-Email, X-API-Key and X-API-Password headers required",
  "required": {
    "headers": ["X-Email", "X-API-Key", "X-API-Password"]
  }
}
```

**Solution**: Include all three headers

---

#### 2. Invalid Email Format

```json
{
  "success": false,
  "error": "Invalid email format",
  "message": "Please provide a valid email address"
}
```

**Solution**: Use a valid email format (user@domain.com)

---

#### 3. Invalid API Key

```json
{
  "success": false,
  "error": "Invalid API Key",
  "message": "This API Key does not belong to the provided email"
}
```

**Solution**: Verify API Key belongs to the correct email

---

#### 4. Wrong API Password

```json
{
  "success": false,
  "error": "Invalid API Password",
  "message": "API Password does not match"
}
```

**Solution**: Check API Password (case-sensitive)

---

#### 5. Insufficient Permissions

```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Admin or Master Admin role required",
  "yourRole": "user"
}
```

**Solution**: Request access from admin or use account with proper role

---

#### 6. JWT Token Expired

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "jwt expired"
}
```

**Solution**: Login again to get a fresh JWT token

---

## ✅ Best Practices

### 1. Security

#### DO ✅

- **Store API Keys securely** (environment variables, secret managers)
- **Use HTTPS** for all API calls (encryption in transit)
- **Rotate API Keys periodically** (recommended: every 90 days)
- **Limit API Key scope** to minimum required permissions
- **Monitor API Key usage** for suspicious activity
- **Revoke unused API Keys** immediately

#### DON'T ❌

- ❌ **Never commit API Keys** to version control
- ❌ **Never share API Keys** via email or chat
- ❌ **Never use API Keys in client-side code** (exposed to users)
- ❌ **Never log API Keys** in plain text
- ❌ **Never use same API Key** across multiple environments

---

### 2. Performance

- **Cache responses** when appropriate (use ETags)
- **Use pagination** for large datasets (`limit` & `offset` params)
- **Filter at API level** (don't fetch all data then filter locally)
- **Batch operations** when creating/updating multiple records
- **Use compression** (Accept-Encoding: gzip)

---

### 3. Error Handling

```javascript
// Good: Handle errors gracefully
async function fetchTables() {
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error.message);
      // Show user-friendly error
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Network Error:', error);
    // Handle network failure
    return null;
  }
}
```

---

### 4. Rate Limiting (Coming Soon)

**Current Status**: No rate limiting (trust-based)

**Future Implementation**:
- **Tier 1 (Free)**: 100 requests/minute
- **Tier 2 (Pro)**: 1,000 requests/minute
- **Tier 3 (Enterprise)**: 10,000 requests/minute

**Headers** (future):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765432
```

---

### 5. Versioning

All endpoints are versioned:

```
/api/v1/...  ← Current stable version
/api/v2/...  ← Future version (when breaking changes needed)
```

**Recommendation**: Always include version in API calls for stability

---

## 🚀 Future Enhancements

### Phase 1: Security Enhancements (Q1 2026)

- [ ] **API Key Hashing**: Store hashed keys (like passwords)
- [ ] **HMAC Signatures**: Request signing for replay protection
- [ ] **IP Whitelisting**: Restrict API Key usage by IP
- [ ] **Rate Limiting**: Multi-tier limits based on usage
- [ ] **MFA for Admin**: Two-factor authentication for high-risk operations

---

### Phase 2: Advanced Features (Q2 2026)

- [ ] **API Key Scopes**: Fine-grained permissions per key
  - `read:users` → Read user data only
  - `write:users` → Create/update users
  - `delete:users` → Delete users
- [ ] **Webhooks**: Real-time notifications for events
- [ ] **GraphQL Support**: Alternative to REST for complex queries
- [ ] **Cursor-Based Pagination**: Better performance for large datasets
- [ ] **Field Filtering**: `?fields=id,email,role` (return only specified fields)

---

### Phase 3: Developer Experience (Q3 2026)

- [ ] **SDKs**: Official libraries for popular languages
  - JavaScript/TypeScript SDK
  - Python SDK
  - Go SDK
  - PHP SDK
- [ ] **API Playground**: Interactive testing environment
- [ ] **OpenAPI/Swagger Docs**: Auto-generated, interactive documentation
- [ ] **Postman Collection**: Pre-built API collection
- [ ] **Code Generators**: Auto-generate client code from OpenAPI spec

---

### Phase 4: Monitoring & Analytics (Q4 2026)

- [ ] **Usage Dashboard**: Real-time API usage metrics
- [ ] **Audit Logs**: Detailed logs of all API calls
- [ ] **Alerting**: Notifications for anomalies or errors
- [ ] **Performance Metrics**: Latency, throughput, error rates
- [ ] **Cost Tracking**: Usage-based billing (if applicable)

---

## 📚 Additional Resources

### Internal Documentation

- **Backend API Reference**: [Coming soon - Detailed endpoint documentation]
- **Database Schema**: See `TABLOLAR.md`
- **Smart Endpoint Strategy**: See `SMART_ENDPOINT_STRATEGY_V2.md`
- **Backend Phase Plan**: See `BACKEND_PHASE_PLAN.md`

### External Resources

- **JWT Specification**: https://jwt.io/
- **RESTful API Design**: https://restfulapi.net/
- **HTTP Status Codes**: https://httpstatuses.com/
- **API Security Best Practices**: https://owasp.org/www-project-api-security/

---

## 🆘 Support

### Getting Help

1. **Check this documentation** first
2. **Review error messages** (they're descriptive!)
3. **Test with cURL** to isolate issues
4. **Contact Support**: [Contact method to be added]

### Reporting Issues

When reporting API issues, include:

- ✅ Full error message (JSON response)
- ✅ HTTP status code
- ✅ Request method (GET, POST, etc.)
- ✅ Endpoint URL (without sensitive data)
- ✅ Approximate timestamp
- ❌ DO NOT include API Keys or passwords

---

## 📝 Changelog

### Version 1.0.0 (2025-10-24)

- ✅ Initial release
- ✅ JWT authentication
- ✅ API Key authentication
- ✅ Hybrid authentication (JWT or API Key)
- ✅ 3-layer security system
- ✅ CRUD operations
- ✅ Multi-tenant isolation (RLS)
- ✅ Role-based access control (RBAC)

---

**Last Updated**: October 24, 2025  
**Version**: 1.0.0  
**Status**: ✅ Active

---


