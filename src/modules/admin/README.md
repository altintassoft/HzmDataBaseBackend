# 📊 Admin Module

**Admin & Raporlama Modülü**

## 📋 Amaç

Master Admin API endpoint - tek endpoint ile tüm backend raporlarına erişim.

## 🌐 API Endpoint

### Master Endpoint

```
GET /api/v1/admin/database?type=<report_type>
```

**Supported Report Types:**

1. `tables` - Backend table information
2. `stats` - Database statistics
3. `migrations` - Migration report
4. `architecture` - Architecture compliance
5. `table-comparison` - Expected vs actual tables
6. `endpoint-compliance` - Endpoint compliance analysis
7. `plan-compliance` - Plan compliance check
8. `phase-progress` - Phase progress tracking
9. `wrong-progress` - Wrong progress detection
10. `project-structure` - Project structure analysis

## 🏗️ Mimari Katmanları

```
admin.routes.js → admin.controller.js → [10 Services] → [2 Models]
   (HTTP)            (Router)              (Reports)      (Database)
```

### Service Architecture

Her rapor kendi service dosyasında:

```
services/
├── tables-info.service.js
├── database-stats.service.js
├── migration-report.service.js
├── architecture-compliance.service.js
├── table-comparison.service.js
├── endpoint-compliance.service.js
├── plan-compliance.service.js
├── phase-progress.service.js
├── wrong-progress.service.js
└── project-structure.service.js
```

### Model Layer

```
models/
├── database-inspector.model.js  (DB introspection)
└── migration-tracker.model.js   (Migration tracking)
```

### Utilities

```
utils/
├── migrationParser.js       (Parse SQL migration files)
├── migrationComparator.js   (Compare expected vs actual)
└── schemaInspector.js       (Database schema inspection)
```

## 🔐 Authentication

**JWT or API Key Authentication Required**

Role-based access:
- `master_admin`: All reports, all tenants
- `admin`: All reports, own tenant only
- `user`: Only `tables` report, own tenant

## 🚀 Kullanım Örneği

```bash
# Backend Tables
GET /api/v1/admin/database?type=tables
X-Email: admin@example.com
X-API-Key: hzm_...
X-API-Password: ...

# Migration Report
GET /api/v1/admin/database?type=migrations
Authorization: Bearer <jwt_token>

# Architecture Compliance
GET /api/v1/admin/database?type=architecture
Authorization: Bearer <jwt_token>
```

## 📊 Report Outputs

### 1. Tables Report
```json
{
  "success": true,
  "type": "tables",
  "data": {
    "tables": [...],
    "summary": {
      "total": 15,
      "by_schema": {...}
    }
  }
}
```

### 2. Migration Report
```json
{
  "migrations": [...],
  "summary": {
    "total": 10,
    "executed": 8,
    "pending": 2,
    "errors": 0
  }
}
```

### 3. Architecture Compliance
```json
{
  "overall_score": 85,
  "categories": [...],
  "recommendations": [...]
}
```

## 🎯 Smart Features

- ✅ Tenant-based filtering (RLS)
- ✅ Role-based access control
- ✅ Real-time data (no mocking)
- ✅ Dynamic schema inspection
- ✅ Migration comparison
- ✅ Error detection
- ✅ Progress tracking

## 🔄 Migration Status

- [ ] Migrate from `/routes/admin.js`
- [ ] Move utils to module
- [ ] Add caching for heavy queries
- [ ] Add report scheduling
- [ ] Add export to Excel/PDF
- [ ] Add unit tests
- [ ] Add integration tests


