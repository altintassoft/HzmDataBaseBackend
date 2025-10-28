# 💾 Data Module

**Generic Data Operations Modülü**

## 📋 Amaç

Tüm tablolar için generic CRUD operasyonları sağlar. Smart endpoint stratejisi - tek endpoint, binlerce tablo.

## 🌐 API Endpoints

### Generic CRUD

- `GET /api/v1/data/:resource` - List all records
- `POST /api/v1/data/:resource` - Create record
- `GET /api/v1/data/:resource/:id` - Get record by ID
- `PUT /api/v1/data/:resource/:id` - Update record
- `DELETE /api/v1/data/:resource/:id` - Delete record

### Batch Operations

- `POST /api/v1/data/:resource/batch` - Create multiple records
- `PUT /api/v1/data/:resource/batch` - Update multiple records
- `DELETE /api/v1/data/:resource/batch` - Delete multiple records

### Search & Filter

- `POST /api/v1/data/:resource/search` - Advanced search
- `GET /api/v1/data/:resource/count` - Count records

## 🏗️ Mimari Katmanları

```
data.routes.js → data.controller.js → data.service.js → data.model.js
   (HTTP)           (Validation)        (Business Logic)   (Database)
                                              ↓
                                        query-builder.js
                                        validator.js
```

## 🔐 Authentication

**API Key Authentication Required** (3-layer):
- X-Email
- X-API-Key
- X-API-Password

## 🚀 Kullanım Örneği

```bash
# List companies
GET /api/v1/data/companies?page=1&limit=50&sort=name
X-Email: user@example.com
X-API-Key: hzm_...
X-API-Password: ...

# Create company
POST /api/v1/data/companies
X-Email: user@example.com
X-API-Key: hzm_...
X-API-Password: ...
{
  "name": "Acme Corp",
  "tax_number": "1234567890",
  "status": "active"
}

# Advanced search
POST /api/v1/data/companies/search
{
  "filters": {
    "status": { "eq": "active" },
    "created_at": { "gte": "2024-01-01" }
  },
  "sort": { "name": "asc" },
  "page": 1,
  "limit": 50
}
```

## 🎯 Smart Features

1. **Dynamic Resource Discovery**: Automatically detects tables
2. **Schema Validation**: Validates data against table schema
3. **Tenant Isolation**: Automatic RLS context
4. **Query Builder**: Safe SQL generation
5. **Batch Operations**: Efficient bulk operations
6. **Advanced Filters**: Flexible querying

## 📦 Supported Resources

- `companies` (app.companies)
- `contacts` (app.contacts)
- `products` (app.products)
- `invoices` (app.invoices)
- `orders` (app.orders)
- ... (any table in app schema)

## 🔒 Security

- ✅ SQL injection prevention
- ✅ Tenant isolation (RLS)
- ✅ Permission checking
- ✅ Input validation
- ✅ Rate limiting
- ✅ Audit logging

## 🎨 Filter Operators

```javascript
{
  "field": { "eq": value },      // Equal
  "field": { "ne": value },      // Not equal
  "field": { "gt": value },      // Greater than
  "field": { "lt": value },      // Less than
  "field": { "gte": value },     // Greater or equal
  "field": { "lte": value },     // Less or equal
  "field": { "like": "%value%" },// Pattern match
  "field": { "in": [v1, v2] },   // In list
  "field": { "not_in": [v1, v2] }// Not in list
}
```

## 🧪 Testing

```bash
npm test src/modules/data
```

## 🔄 Migration Status

- [ ] Implement query builder
- [ ] Implement validator
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add rate limiting
- [ ] Add caching
- [ ] Add audit logging


