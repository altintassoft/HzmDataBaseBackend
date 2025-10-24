# 🚀 Custom API Builder - Hybrid Endpoint System

## 📋 Genel Bakış

Custom API Builder, her proje için otomatik olarak dinamik API endpoint'leri oluşturan gelişmiş bir sistemdir. Manuel endpoint konfigürasyonu gerektirmez.

### Temel Özellikler
- ✅ **Otomatik API Generation:** Proje oluşturulduğunda API'ler hazır
- ✅ **Project-Specific URLs:** `/api/v1/p{PROJECT_ID}/`
- ✅ **4-Layer Authentication:** API Key + Ownership + Password + RLS
- ✅ **Zero Configuration:** Manuel setup gerektirmez
- ✅ **Template-Based:** E-commerce, CRM, Blog vb. template'ler
- ✅ **CRUD Operations:** Otomatik table CRUD endpoint'leri

## 🏗️ Mimari

### System Components

```
Project Creation
     ↓
API Key Generation (HMAC-SHA256)
     ↓
Project Password (bcrypt)
     ↓
RLS Policy Setup
     ↓
Dynamic Route Mounting
     ↓
Rate Limiting Applied
     ↓
✅ Project API Ready!
```

### Endpoint Pattern

```bash
# Her proje için unique API prefix
/api/v1/p{PROJECT_ID}/

# Örnek (Project ID: 26)
/api/v1/p26/tables
/api/v1/p26/data/{table_id}/rows
/api/v1/p26/users
/api/v1/p26/products  # Template-based
```

## 🔐 4-Layer Authentication

### Layer 1: API Key Validation
```javascript
// HMAC-SHA256 hash kontrolü
const isValid = crypto
  .createHmac('sha256', apiSecret)
  .update(apiKey)
  .digest('hex') === storedHash;
```

### Layer 2: Project Ownership
```sql
SELECT 1 FROM projects 
WHERE id = $1 
  AND user_id = $2  -- Owner check
```

### Layer 3: Project Password
```javascript
// bcrypt verification
const passwordMatch = await bcrypt.compare(
  providedPassword, 
  project.password_hash
);
```

### Layer 4: RLS Context
```javascript
// Set PostgreSQL context
await pool.query('SELECT app.set_context($1, $2)', 
  [tenantId, userId]
);
```

## 📡 Generated Endpoints

### Core CRUD Endpoints

```bash
# Tables
GET    /api/v1/p{id}/tables           # List all tables
POST   /api/v1/p{id}/tables           # Create table
GET    /api/v1/p{id}/tables/{tableId} # Get table
PUT    /api/v1/p{id}/tables/{tableId} # Update table
DELETE /api/v1/p{id}/tables/{tableId} # Delete table

# Data
GET    /api/v1/p{id}/data/{tableId}/rows        # Get rows
POST   /api/v1/p{id}/data/{tableId}/rows        # Insert row
GET    /api/v1/p{id}/data/{tableId}/rows/{rowId} # Get row
PUT    /api/v1/p{id}/data/{tableId}/rows/{rowId} # Update row
DELETE /api/v1/p{id}/data/{tableId}/rows/{rowId} # Delete row

# Fields
GET    /api/v1/p{id}/fields/{tableId}  # List fields
POST   /api/v1/p{id}/fields/{tableId}  # Add field
PUT    /api/v1/p{id}/fields/{fieldId}  # Update field
DELETE /api/v1/p{id}/fields/{fieldId}  # Delete field
```

### Template-Specific Endpoints

#### E-commerce Template
```bash
GET    /api/v1/p{id}/products
POST   /api/v1/p{id}/products
GET    /api/v1/p{id}/categories
GET    /api/v1/p{id}/orders
POST   /api/v1/p{id}/cart/add
```

#### CRM Template
```bash
GET    /api/v1/p{id}/contacts
POST   /api/v1/p{id}/leads
GET    /api/v1/p{id}/deals
PUT    /api/v1/p{id}/opportunities/{id}
```

#### Blog Template
```bash
GET    /api/v1/p{id}/posts
POST   /api/v1/p{id}/posts
GET    /api/v1/p{id}/comments
GET    /api/v1/p{id}/categories
```

## 🎯 Usage Example

### 1. Create Project
```bash
POST /api/v1/projects
{
  "name": "My E-commerce Store",
  "template": "ecommerce"
}

Response:
{
  "project_id": 26,
  "api_key": "hzm_abc123...",
  "api_base": "https://api.example.com/api/v1/p26",
  "password": "generated_password_here"
}
```

### 2. Use Generated API
```bash
# List products
curl -X GET "https://api.example.com/api/v1/p26/products" \
  -H "X-API-Key: hzm_abc123..." \
  -H "X-User-Email: user@example.com" \
  -H "X-Project-Password: generated_password_here"

# Add product
curl -X POST "https://api.example.com/api/v1/p26/products" \
  -H "X-API-Key: hzm_abc123..." \
  -H "X-User-Email: user@example.com" \
  -H "X-Project-Password: generated_password_here" \
  -d '{
    "name": "Product Name",
    "price": 99.99,
    "stock": 100
  }'
```

## 🔄 API Generation Flow

```javascript
// 1. Project Create Event
const project = await createProject({ name, template });

// 2. Auto-generate API
const apiKey = generateApiKey();
const password = generateSecurePassword();

// 3. Setup authentication
await setupProjectAuth(project.id, apiKey, password);

// 4. Mount dynamic routes
app.use(`/api/v1/p${project.id}`, 
  projectAuth, 
  dynamicRouter(project)
);

// 5. Apply template routes
if (template === 'ecommerce') {
  mountEcommerceRoutes(project.id);
}

// ✅ API Ready!
console.log(`API available at: /api/v1/p${project.id}`);
```

## 📊 Template System

### Available Templates

```javascript
{
  ecommerce: {
    tables: ['products', 'categories', 'orders', 'customers', 'cart'],
    endpoints: ['products', 'categories', 'orders', 'cart/add']
  },
  crm: {
    tables: ['contacts', 'leads', 'deals', 'activities'],
    endpoints: ['contacts', 'leads', 'pipeline', 'tasks']
  },
  blog: {
    tables: ['posts', 'categories', 'comments', 'tags'],
    endpoints: ['posts', 'categories', 'comments', 'search']
  },
  saas: {
    tables: ['users', 'subscriptions', 'features', 'usage'],
    endpoints: ['users', 'billing', 'analytics']
  }
}
```

## ⚡ Performance

- **Route Caching:** Dynamic routes cached in memory
- **Connection Pooling:** Per-project connection pools
- **Rate Limiting:** 1000 req/hour per project (default)
- **Response Time:** <100ms for cached routes

## 🔒 Security

- ✅ HMAC-SHA256 API key validation
- ✅ bcrypt password hashing
- ✅ RLS (Row Level Security) enforcement
- ✅ Project ownership verification
- ✅ Rate limiting per project
- ✅ Request logging & audit trail

## 🎯 Best Practices

1. **Always use HTTPS** in production
2. **Store API keys securely** (environment variables)
3. **Rotate passwords** periodically
4. **Monitor API usage** per project
5. **Implement request caching** for read operations
6. **Use templates** for common use cases

---

**Dosya:** `05-APIs/21_Custom_API_Builder.md`  
**Versiyon:** 1.0.0  
**Son Güncelleme:** 2025-10-21  
**Durum:** ✅ Production Ready

