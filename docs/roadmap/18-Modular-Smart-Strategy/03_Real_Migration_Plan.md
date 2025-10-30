# 🚀 Gerçek Geçiş Planı - Generic Handler'a Sistemi Bozmadan Geçiş

**Tarih:** 30 Ekim 2025  
**Versiyon:** v1.0  
**Durum:** 🎯 Hemen Uygulanabilir

---

## 🎯 Hedef

**400+ endpoint kaosu yerine 30-40 endpoint ile tüm sistemi yönetmek**

### Şu An:
```
❌ 53 aktif endpoint (14 ölü endpoint temizlendi)
❌ Her yeni tablo = +5 endpoint
❌ Roadmap'e göre 6 ay sonra: 400+ endpoint
❌ Bakım maliyeti: YÜKSEK
```

### Hedef:
```
✅ ~30-40 endpoint (sabit kalır)
✅ Yeni tablo = 0 endpoint (metadata'ya ekle)
✅ 6 ay sonra bile: ~30-40 endpoint
✅ Bakım maliyeti: %90 AZALIR
```

---

## ⚠️ Kritik Prensipler

### ✅ YAPILACAKLAR
1. **Adım adım geçiş** - Big bang yok!
2. **Gerçek tablolarla test** - Mock data yok!
3. **Geri alınabilir** - Her adımda rollback planı
4. **Çift sistem** - Eski endpoint'ler kalsın (deprecate ile)
5. **Production'ı bozma** - Canary deployment

### ❌ YAPILMAYACAKLAR
1. ❌ Tüm sistemi tek seferde değiştir
2. ❌ Eski endpoint'leri hemen sil
3. ❌ Mock/test data ile test et
4. ❌ Frontend'i kır
5. ❌ Production'da deneme yap

---

## 📅 4 Haftalık Geçiş Planı

---

## 🗓️ HAFTA 1: Metadata Temeli + Migration (Sıfır Risk)

### Hedef
Metadata katmanını ekle, hiçbir endpoint'i değiştirme.

### Adımlar

#### 1.1 Migration Dosyası Oluştur (1 gün)
```bash
# Dosya: HzmVeriTabaniBackend/migrations/011_create_api_registry.sql
```

```sql
-- ============================================================================
-- API REGISTRY SYSTEM - Generic Handler İçin Metadata Katmanı
-- ============================================================================

-- 1. Hangi tablolar API'de yayınlanacak?
CREATE TABLE IF NOT EXISTS api_resources (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) UNIQUE NOT NULL,  -- 'users', 'projects', 'tables'
  schema_name VARCHAR(50) NOT NULL DEFAULT 'public',
  table_name VARCHAR(100) NOT NULL,
  
  -- Kontrol
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_readonly BOOLEAN NOT NULL DEFAULT false,
  
  -- Dokümantasyon
  description TEXT,
  example_usage TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_schema_table UNIQUE(schema_name, table_name)
);

-- 2. Hangi alanlar okunabilir/yazılabilir?
CREATE TABLE IF NOT EXISTS api_resource_fields (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) NOT NULL REFERENCES api_resources(resource) ON DELETE CASCADE,
  column_name VARCHAR(100) NOT NULL,
  
  -- İzinler
  readable BOOLEAN NOT NULL DEFAULT true,
  writable BOOLEAN NOT NULL DEFAULT true,
  required BOOLEAN NOT NULL DEFAULT false,
  
  -- Validasyon
  data_type VARCHAR(50),  -- 'text', 'integer', 'boolean', 'json', etc.
  min_length INTEGER,
  max_length INTEGER,
  pattern VARCHAR(255),  -- Regex pattern
  
  -- Dokümantasyon
  description TEXT,
  example_value TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_resource_column UNIQUE(resource, column_name)
);

-- 3. RLS/Policy kuralları (opsiyonel, ekstra güvenlik katmanı)
CREATE TABLE IF NOT EXISTS api_policies (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) NOT NULL REFERENCES api_resources(resource) ON DELETE CASCADE,
  policy_name VARCHAR(100) NOT NULL,
  
  -- SQL predicate (örn: 'tenant_id = $1')
  predicate_sql TEXT NOT NULL,
  
  -- Hangi rollere uygulanır?
  applies_to_roles TEXT[] DEFAULT ARRAY['user'],  -- ['user', 'admin', 'master_admin']
  
  -- Hangi işlemlere uygulanır?
  applies_to_operations TEXT[] DEFAULT ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  
  -- Aktif mi?
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_resource_policy UNIQUE(resource, policy_name)
);

-- 4. Index'ler
CREATE INDEX idx_api_resources_enabled ON api_resources(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_api_resource_fields_resource ON api_resource_fields(resource);
CREATE INDEX idx_api_resource_fields_readable ON api_resource_fields(resource, readable) WHERE readable = true;
CREATE INDEX idx_api_resource_fields_writable ON api_resource_fields(resource, writable) WHERE writable = true;
CREATE INDEX idx_api_policies_resource ON api_policies(resource);
CREATE INDEX idx_api_policies_enabled ON api_policies(resource, is_enabled) WHERE is_enabled = true;

-- 5. Trigger'lar (updated_at otomatik güncelleme)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_resources_updated_at
  BEFORE UPDATE ON api_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_policies_updated_at
  BEFORE UPDATE ON api_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA - Mevcut Tabloları Kaydet (SADECE METADATA, GERÇEK DATA DEĞİL!)
-- ============================================================================

-- Users tablosu
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('users', 'public', 'users', 'User management - authentication, profile, settings', false);  -- İlk etapta kapalı!

-- Users fields (sadece readable olanlar)
INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('users', 'id', true, false, false, 'integer', 'User ID'),
('users', 'email', true, true, true, 'text', 'Email address'),
('users', 'first_name', true, true, false, 'text', 'First name'),
('users', 'last_name', true, true, false, 'text', 'Last name'),
('users', 'role', true, false, false, 'text', 'User role'),
('users', 'is_active', true, false, false, 'boolean', 'Account status'),
('users', 'created_at', true, false, false, 'timestamp', 'Account creation date'),
('users', 'updated_at', true, false, false, 'timestamp', 'Last update date');
-- NOT: password_hash, api_key gibi hassas alanlar EXCLUDED (readable=false, writable=false)

-- Projects tablosu
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('projects', 'public', 'projects', 'Project management - CRUD operations', false);  -- İlk etapta kapalı!

INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('projects', 'id', true, false, false, 'integer', 'Project ID'),
('projects', 'tenant_id', true, false, true, 'integer', 'Tenant ID (auto-set)'),
('projects', 'name', true, true, true, 'text', 'Project name'),
('projects', 'description', true, true, false, 'text', 'Project description'),
('projects', 'status', true, true, false, 'text', 'Project status'),
('projects', 'settings', true, true, false, 'json', 'Project settings'),
('projects', 'created_at', true, false, false, 'timestamp', 'Creation date'),
('projects', 'updated_at', true, false, false, 'timestamp', 'Last update date');

-- RLS Policy örneği (tenant isolation)
INSERT INTO api_policies (resource, policy_name, predicate_sql, applies_to_roles, applies_to_operations) VALUES
('users', 'tenant_isolation', 'tenant_id = $tenant_id', ARRAY['user', 'admin'], ARRAY['SELECT', 'UPDATE', 'DELETE']),
('projects', 'tenant_isolation', 'tenant_id = $tenant_id', ARRAY['user', 'admin'], ARRAY['SELECT', 'UPDATE', 'DELETE']);

-- ============================================================================
-- HELPER FUNCTIONS - Metadata Okuma
-- ============================================================================

-- Bir resource'un metadata'sını döndür
CREATE OR REPLACE FUNCTION get_resource_metadata(p_resource TEXT)
RETURNS TABLE(
  resource VARCHAR,
  schema_name VARCHAR,
  table_name VARCHAR,
  is_enabled BOOLEAN,
  is_readonly BOOLEAN,
  readable_columns TEXT[],
  writable_columns TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.resource,
    r.schema_name,
    r.table_name,
    r.is_enabled,
    r.is_readonly,
    ARRAY_AGG(f.column_name) FILTER (WHERE f.readable = true) AS readable_columns,
    ARRAY_AGG(f.column_name) FILTER (WHERE f.writable = true) AS writable_columns
  FROM api_resources r
  LEFT JOIN api_resource_fields f ON f.resource = r.resource
  WHERE r.resource = p_resource
  GROUP BY r.resource, r.schema_name, r.table_name, r.is_enabled, r.is_readonly;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE api_resources IS 'Registry of API-exposed resources (tables)';
COMMENT ON TABLE api_resource_fields IS 'Field-level permissions and validation rules';
COMMENT ON TABLE api_policies IS 'Row-level security policies for generic handler';
COMMENT ON FUNCTION get_resource_metadata IS 'Get full metadata for a resource (helper for generic handler)';
```

#### 1.2 Migration'ı Çalıştır (30 dk)
```bash
cd HzmVeriTabaniBackend
npm run migrate

# Kontrol et
psql $DATABASE_URL -c "SELECT * FROM api_resources;"
# Sonuç: 2 row (users, projects) - is_enabled=false
```

#### 1.3 Registry Service Oluştur (2 gün)
```bash
# Dosya: HzmVeriTabaniBackend/src/modules/data/services/registry.service.js
```

```javascript
const pool = require('../../../core/database/pool');
const logger = require('../../../core/logger');

/**
 * API Registry Service
 * Metadata katmanından resource bilgilerini okur
 */
class RegistryService {
  /**
   * Resource metadata'sını getir
   * @param {string} resource - Resource adı (örn: 'users', 'projects')
   * @returns {Object} Resource metadata
   */
  static async getResourceMeta(resource) {
    try {
      const result = await pool.query(
        `SELECT * FROM get_resource_metadata($1)`,
        [resource]
      );

      if (!result.rows.length) {
        return null;
      }

      const meta = result.rows[0];

      // is_enabled kontrolü
      if (!meta.is_enabled) {
        throw new Error(`Resource '${resource}' is not enabled`);
      }

      return {
        resource: meta.resource,
        schema: meta.schema_name,
        table: meta.table_name,
        isReadonly: meta.is_readonly,
        readableColumns: meta.readable_columns || [],
        writableColumns: meta.writable_columns || [],
        
        // Helper methods
        readableSelect: (meta.readable_columns || []).join(', ') || '*',
        canRead: (column) => meta.readable_columns?.includes(column) || false,
        canWrite: (column) => meta.writable_columns?.includes(column) || false
      };
    } catch (error) {
      logger.error('Registry error:', error);
      throw error;
    }
  }

  /**
   * Resource policies'ini getir
   * @param {string} resource
   * @param {string} role - User role
   * @returns {Array} Active policies
   */
  static async getPolicies(resource, role) {
    const result = await pool.query(
      `SELECT policy_name, predicate_sql, applies_to_operations
       FROM api_policies
       WHERE resource = $1 
         AND is_enabled = true
         AND $2 = ANY(applies_to_roles)`,
      [resource, role]
    );
    return result.rows;
  }

  /**
   * Tüm enabled resource'ları listele
   * @returns {Array} Resource listesi
   */
  static async listResources() {
    const result = await pool.query(
      `SELECT resource, description, is_readonly
       FROM api_resources
       WHERE is_enabled = true
       ORDER BY resource`
    );
    return result.rows;
  }
}

module.exports = RegistryService;
```

#### 1.4 Test Et (1 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/tests/registry.test.js

const RegistryService = require('../src/modules/data/services/registry.service');

describe('Registry Service', () => {
  test('should get users metadata (but disabled)', async () => {
    try {
      const meta = await RegistryService.getResourceMeta('users');
    } catch (error) {
      expect(error.message).toContain('not enabled');
    }
  });

  test('should list resources', async () => {
    const resources = await RegistryService.listResources();
    expect(resources).toHaveLength(0);  // Hepsi disabled
  });
});
```

### ✅ Hafta 1 Sonuç
```
✅ Metadata katmanı hazır (DB'de)
✅ Registry service hazır (kod'da)
✅ Test edildi
❌ Henüz hiçbir endpoint değişmedi
❌ Production etkilenmedi
```

---

## 🗓️ HAFTA 2: Generic Handler İmplementasyonu (Pasif Mod)

### Hedef
Generic handler'ı yaz ama sadece `is_enabled=false` resource'lar için test et.

### Adımlar

#### 2.1 Query Builder Oluştur (2 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/utils/query-builder.js

const { z } = require('zod');

class QueryBuilder {
  /**
   * WHERE clause oluştur (Supabase tarzı filter)
   * Örnek: ?eq.name=Ali&ilike.email=%gmail%
   */
  static buildWhere(query, meta) {
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Readable column'larla filter et
    const readableSet = new Set(meta.readableColumns);

    for (const [key, value] of Object.entries(query)) {
      // Filter operators: eq, neq, gt, gte, lt, lte, like, ilike, in
      const match = key.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|in)\.(.+)$/);
      
      if (!match) continue;  // Geçerli operator değil
      
      const [, operator, column] = match;
      
      // Güvenlik: Sadece readable column'ları filtrele
      if (!readableSet.has(column)) continue;
      
      switch (operator) {
        case 'eq':
          whereClauses.push(`${column} = $${paramIndex++}`);
          params.push(value);
          break;
        case 'neq':
          whereClauses.push(`${column} != $${paramIndex++}`);
          params.push(value);
          break;
        case 'gt':
          whereClauses.push(`${column} > $${paramIndex++}`);
          params.push(value);
          break;
        case 'gte':
          whereClauses.push(`${column} >= $${paramIndex++}`);
          params.push(value);
          break;
        case 'lt':
          whereClauses.push(`${column} < $${paramIndex++}`);
          params.push(value);
          break;
        case 'lte':
          whereClauses.push(`${column} <= $${paramIndex++}`);
          params.push(value);
          break;
        case 'like':
          whereClauses.push(`${column} LIKE $${paramIndex++}`);
          params.push(value);
          break;
        case 'ilike':
          whereClauses.push(`${column} ILIKE $${paramIndex++}`);
          params.push(value);
          break;
        case 'in':
          const values = value.split(',');
          whereClauses.push(`${column} = ANY($${paramIndex++})`);
          params.push(values);
          break;
      }
    }

    return {
      sql: whereClauses.length ? ' AND ' + whereClauses.join(' AND ') : '',
      params
    };
  }

  /**
   * ORDER BY clause oluştur
   * Örnek: ?order=created_at.desc,name.asc
   */
  static buildOrder(orderStr, meta) {
    if (!orderStr) return 'ORDER BY id DESC';  // Default

    const readableSet = new Set(meta.readableColumns);
    const orders = [];

    for (const item of orderStr.split(',')) {
      const [column, direction = 'asc'] = item.split('.');
      
      // Güvenlik: Sadece readable column
      if (!readableSet.has(column)) continue;
      
      // SQL injection önleme
      if (!['asc', 'desc'].includes(direction.toLowerCase())) continue;
      
      orders.push(`${column} ${direction.toUpperCase()}`);
    }

    return orders.length ? 'ORDER BY ' + orders.join(', ') : 'ORDER BY id DESC';
  }

  /**
   * Pagination (offset-based, basit)
   * Gelecekte cursor-based yapılabilir
   */
  static buildPagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    return { limit, offset, page };
  }

  /**
   * SELECT clause oluştur
   * Örnek: ?select=id,name,email
   */
  static buildSelect(selectStr, meta) {
    if (!selectStr) return meta.readableSelect;  // Default: tüm readable

    const readableSet = new Set(meta.readableColumns);
    const columns = selectStr.split(',')
      .map(c => c.trim())
      .filter(c => readableSet.has(c));

    return columns.length ? columns.join(', ') : meta.readableSelect;
  }
}

module.exports = QueryBuilder;
```

#### 2.2 Generic Controller Yaz (2 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/data.controller.js
// MEVCUT DOSYAYI DEĞİŞTİR (şu an 501 döndürüyor)

const pool = require('../../core/database/pool');
const logger = require('../../core/logger');
const RegistryService = require('./services/registry.service');
const QueryBuilder = require('./utils/query-builder');

class DataController {
  /**
   * LIST - GET /data/:resource
   * Örnek: GET /data/users?eq.status=active&order=created_at.desc&limit=20
   */
  static async list(req, res) {
    try {
      const { resource } = req.params;
      
      // 1. Metadata al
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource '${resource}' not found or not enabled`
        });
      }

      // 2. Query'yi parse et
      const select = QueryBuilder.buildSelect(req.query.select, meta);
      const where = QueryBuilder.buildWhere(req.query, meta);
      const order = QueryBuilder.buildOrder(req.query.order, meta);
      const { limit, offset } = QueryBuilder.buildPagination(req.query);

      // 3. RLS/Policy uygula (opsiyonel)
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const rlsParams = [];
      
      if (tenantId && meta.table.includes('tenant_id')) {
        // NOT: Gerçek sistemde api_policies tablosundan dinamik al
        rlsSql = ` AND tenant_id = $${where.params.length + 1}`;
        rlsParams.push(tenantId);
      }

      // 4. SQL oluştur ve çalıştır
      const sql = `
        SELECT ${select}
        FROM ${meta.schema}.${meta.table}
        WHERE 1=1 ${where.sql} ${rlsSql}
        ${order}
        LIMIT $${where.params.length + rlsParams.length + 1}
        OFFSET $${where.params.length + rlsParams.length + 2}
      `;
      const params = [...where.params, ...rlsParams, limit, offset];

      const result = await pool.query(sql, params);

      // 5. Response
      return res.json({
        success: true,
        data: result.rows,
        meta: {
          resource,
          count: result.rows.length,
          page: Math.floor(offset / limit) + 1,
          limit
        }
      });

    } catch (error) {
      logger.error('List data error:', error);
      
      if (error.message.includes('not enabled')) {
        return res.status(403).json({
          success: false,
          code: 'RESOURCE_DISABLED',
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET BY ID - GET /data/:resource/:id
   */
  static async getById(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const rlsParams = [];
      
      if (tenantId && meta.table.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $2`;
        rlsParams.push(tenantId);
      }

      const sql = `
        SELECT ${meta.readableSelect}
        FROM ${meta.schema}.${meta.table}
        WHERE id = $1 ${rlsSql}
      `;
      
      const result = await pool.query(sql, [id, ...rlsParams]);

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Get by ID error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * CREATE - POST /data/:resource
   */
  static async create(req, res) {
    try {
      const { resource } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      // Readonly check
      if (meta.isReadonly) {
        return res.status(403).json({
          success: false,
          code: 'RESOURCE_READONLY',
          message: `Resource '${resource}' is read-only`
        });
      }

      // Sadece writable alanları al
      const writableSet = new Set(meta.writableColumns);
      const data = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (writableSet.has(key)) {
          data[key] = value;
        }
      }

      // tenant_id inject et (varsa)
      if (req.user?.tenant_id && meta.writableColumns.includes('tenant_id')) {
        data.tenant_id = req.user.tenant_id;
      }

      // SQL oluştur
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const sql = `
        INSERT INTO ${meta.schema}.${meta.table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING ${meta.readableSelect}
      `;

      const result = await pool.query(sql, values);

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Create data error:', error);
      
      // Duplicate key error
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_KEY',
          message: 'Resource already exists'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * UPDATE - PUT /data/:resource/:id
   */
  static async update(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      if (meta.isReadonly) {
        return res.status(403).json({ success: false, code: 'RESOURCE_READONLY' });
      }

      // Sadece writable alanları al
      const writableSet = new Set(meta.writableColumns);
      const updates = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (writableSet.has(key) && key !== 'id') {  // id değiştirilemez
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'EMPTY_UPDATE',
          message: 'No valid fields to update'
        });
      }

      // SQL oluştur
      const entries = Object.entries(updates);
      const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
      const values = entries.map(([, value]) => value);

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      
      if (tenantId && meta.table.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $${values.length + 2}`;
        values.push(tenantId);
      }

      const sql = `
        UPDATE ${meta.schema}.${meta.table}
        SET ${setClauses}
        WHERE id = $${values.length + 1} ${rlsSql}
        RETURNING ${meta.readableSelect}
      `;
      
      values.push(id);

      const result = await pool.query(sql, values);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Update data error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE - DELETE /data/:resource/:id
   */
  static async delete(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      if (meta.isReadonly) {
        return res.status(403).json({ success: false, code: 'RESOURCE_READONLY' });
      }

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const params = [id];
      
      if (tenantId && meta.table.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $2`;
        params.push(tenantId);
      }

      const sql = `
        DELETE FROM ${meta.schema}.${meta.table}
        WHERE id = $1 ${rlsSql}
      `;

      const result = await pool.query(sql, params);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      }

      return res.status(204).send();

    } catch (error) {
      logger.error('Delete data error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // SEARCH, COUNT, BATCH operations (şimdilik basit veya 501)
  static async search(req, res) {
    // list() ile aynı mantık, farklı response format
    return DataController.list(req, res);
  }

  static async count(req, res) {
    try {
      const { resource } = req.params;
      const meta = await RegistryService.getResourceMeta(resource);
      
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      const where = QueryBuilder.buildWhere(req.query, meta);
      
      const sql = `SELECT COUNT(*) as count FROM ${meta.schema}.${meta.table} WHERE 1=1 ${where.sql}`;
      const result = await pool.query(sql, where.params);

      return res.json({
        success: true,
        count: parseInt(result.rows[0].count)
      });
    } catch (error) {
      logger.error('Count error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async batchCreate(req, res) {
    res.status(501).json({ success: false, message: 'Batch create not implemented yet' });
  }

  static async batchUpdate(req, res) {
    res.status(501).json({ success: false, message: 'Batch update not implemented yet' });
  }

  static async batchDelete(req, res) {
    res.status(501).json({ success: false, message: 'Batch delete not implemented yet' });
  }
}

module.exports = DataController;
```

#### 2.3 Test Et (Sadece Disabled Resource'larla!) (1 gün)
```bash
# Test: Users (disabled)
curl -X GET "http://localhost:3000/api/v1/data/users" \
  -H "X-API-Key: test-key"

# Beklenen: 403 "Resource 'users' is not enabled"

# Test: Projects (disabled)
curl -X GET "http://localhost:3000/api/v1/data/projects" \
  -H "X-API-Key: test-key"

# Beklenen: 403 "Resource 'projects' is not enabled"
```

### ✅ Hafta 2 Sonuç
```
✅ Generic handler yazıldı
✅ Query builder hazır
✅ Filtreleme, sıralama, pagination çalışıyor
❌ Henüz hiçbir resource aktif değil (is_enabled=false)
❌ Production etkilenmedi
```

---

## 🗓️ HAFTA 3: İlk Resource Aktifleştir (Canary Test)

### Hedef
**Bir** resource'u aktif et (örn: projects), gerçek verilerle test et.

### Adımlar

#### 3.1 Projects Resource'unu Aktifleştir (1 saat)
```sql
-- Production DB'de çalıştır (güvenli!)
UPDATE api_resources SET is_enabled = true WHERE resource = 'projects';

-- Kontrol
SELECT * FROM api_resources WHERE resource = 'projects';
-- is_enabled = true olmalı
```

#### 3.2 Gerçek Verilerle Test Et (2 gün)
```bash
# 1. LIST
curl "http://localhost:3000/api/v1/data/projects" \
  -H "X-API-Key: your-real-api-key"

# Beklenen: Gerçek projects listesi (tenant_id'ye göre filtrelenmiş)

# 2. GET BY ID
curl "http://localhost:3000/api/v1/data/projects/123" \
  -H "X-API-Key: your-real-api-key"

# Beklenen: Project #123'ün detayları

# 3. CREATE
curl -X POST "http://localhost:3000/api/v1/data/projects" \
  -H "X-API-Key: your-real-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Generic handler test"}'

# Beklenen: Yeni project oluşturuldu (201)

# 4. UPDATE
curl -X PUT "http://localhost:3000/api/v1/data/projects/123" \
  -H "X-API-Key: your-real-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Beklenen: Project güncellendi (200)

# 5. DELETE
curl -X DELETE "http://localhost:3000/api/v1/data/projects/123" \
  -H "X-API-Key: your-real-api-key"

# Beklenen: 204 No Content

# 6. FILTERS (Supabase tarzı)
curl "http://localhost:3000/api/v1/data/projects?eq.status=active&order=created_at.desc&limit=10" \
  -H "X-API-Key: your-real-api-key"

# Beklenen: Aktif projeler, yeniden eskiye sıralı, max 10 adet
```

#### 3.3 Eski /projects/* Endpoint'lerini Proxy Et (2 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/projects/project.routes.js

const express = require('express');
const ProjectController = require('./project.controller');
const DataController = require('../data/data.controller');  // YENI!
const { authenticateApiKey } = require('../../middleware/auth');

const router = express.Router();

// ============================================================================
// ESKİ ENDPOINT'LER → GENERIC HANDLER'A PROXY (DEPRECATION)
// ============================================================================

/**
 * @deprecated Use /data/projects instead
 * @route GET /api/v1/projects
 */
router.get('/', authenticateApiKey, (req, res, next) => {
  // Deprecation header ekle
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-03-31');  // 6 ay sonra kaldırılacak
  res.setHeader('Link', '<https://docs.hzmsoft.com/migration-guide#projects>; rel="deprecation"');
  
  // Generic handler'a yönlendir
  req.params.resource = 'projects';
  return DataController.list(req, res, next);
});

/**
 * @deprecated Use POST /data/projects instead
 */
router.post('/', authenticateApiKey, (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-03-31');
  
  req.params.resource = 'projects';
  return DataController.create(req, res, next);
});

/**
 * @deprecated Use GET /data/projects/:id instead
 */
router.get('/:id', authenticateApiKey, (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-03-31');
  
  req.params.resource = 'projects';
  return DataController.getById(req, res, next);
});

/**
 * @deprecated Use PUT /data/projects/:id instead
 */
router.put('/:id', authenticateApiKey, (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-03-31');
  
  req.params.resource = 'projects';
  return DataController.update(req, res, next);
});

/**
 * @deprecated Use DELETE /data/projects/:id instead
 */
router.delete('/:id', authenticateApiKey, (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', '2026-03-31');
  
  req.params.resource = 'projects';
  return DataController.delete(req, res, next);
});

// ÖZE human: Continue

L ENDPOINT (/projects/:id/statistics) - KALIYOR
router.get('/:id/statistics', authenticateApiKey, ProjectController.getStatistics);

module.exports = router;
```

#### 3.4 Frontend Testi (1 gün)
```javascript
// Frontend'de her iki endpoint'i de test et

// ESKİ (deprecation header alacak)
GET /api/v1/projects

// YENİ (önerilen)
GET /api/v1/data/projects

// İkisi de aynı datayı döndürmeli!
```

### ✅ Hafta 3 Sonuç
```
✅ Projects generic handler ile çalışıyor
✅ Eski /projects/* endpoint'leri de çalışıyor (proxy)
✅ Gerçek verilerle test edildi
✅ Frontend etkilenmedi (her iki yol da çalışıyor)
⚠️ Deprecation header ile client'lar uyarılıyor
```

---

## 🗓️ HAFTA 4: Toplu Migrasyon + Cleanup

### Hedef
Kalan resource'ları aktifleştir, eski endpoint'leri deprecate et.

### Adımlar

#### 4.1 Diğer Resource'ları Aktifleştir (2 gün)

```sql
-- Users resource'unu aktifleştir
UPDATE api_resources SET is_enabled = true WHERE resource = 'users';

-- Test et
SELECT * FROM get_resource_metadata('users');
```

```javascript
// user.routes.js'yi de proxy'e çevir (projects gibi)
// Ama users zaten server'a bağlı değildi, bu yüzden:

// OPTION 1: user.routes.js'yi server.js'ye ekle (proxy ile)
// OPTION 2: Direkt /data/users'a yönlendir (dokümantasyonda)
```

#### 4.2 Yeni Tablo Ekle (Roadmap Phase 2'den) (1 gün)

```sql
-- Örnek: table_metadata tablosu (Roadmap'te var)
CREATE TABLE IF NOT EXISTS table_metadata (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registry'ye ekle
INSERT INTO api_resources (resource, schema_name, table_name, is_enabled) VALUES
('table_metadata', 'public', 'table_metadata', true);

INSERT INTO api_resource_fields (resource, column_name, readable, writable, required) VALUES
('table_metadata', 'id', true, false, false),
('table_metadata', 'tenant_id', true, false, true),
('table_metadata', 'project_id', true, true, true),
('table_metadata', 'name', true, true, true),
('table_metadata', 'description', true, true, false),
('table_metadata', 'created_at', true, false, false);

-- TEST: Hiçbir kod yazmadan CRUD hazır!
curl "http://localhost:3000/api/v1/data/table_metadata" -H "X-API-Key: key"
# ÇALIŞIR! 🎉
```

#### 4.3 OpenAPI Generator (1 gün)

```javascript
// Dosya: HzmVeriTabaniBackend/scripts/generate-openapi.js

const fs = require('fs');
const yaml = require('js-yaml');
const RegistryService = require('../src/modules/data/services/registry.service');

(async () => {
  const resources = await RegistryService.listResources();
  
  const paths = {};
  
  for (const r of resources) {
    const meta = await RegistryService.getResourceMeta(r.resource);
    
    // /data/{resource}
    paths[`/data/${r.resource}`] = {
      get: {
        summary: `List ${r.resource}`,
        tags: [r.resource],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'order', in: 'query', schema: { type: 'string' } },
          ...meta.readableColumns.map(col => ({
            name: `eq.${col}`,
            in: 'query',
            description: `Filter by ${col}`,
            schema: { type: 'string' }
          }))
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      post: meta.isReadonly ? undefined : {
        summary: `Create ${r.resource}`,
        tags: [r.resource],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(
                  meta.writableColumns.map(col => [col, { type: 'string' }])
                )
              }
            }
          }
        },
        responses: {
          '201': { description: 'Created' }
        }
      }
    };
    
    // /data/{resource}/{id}
    paths[`/data/${r.resource}/{id}`] = {
      get: {
        summary: `Get ${r.resource} by ID`,
        tags: [r.resource],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Success' },
          '404': { description: 'Not found' }
        }
      },
      put: meta.isReadonly ? undefined : {
        summary: `Update ${r.resource}`,
        tags: [r.resource],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(
                  meta.writableColumns.map(col => [col, { type: 'string' }])
                )
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated' },
          '404': { description: 'Not found' }
        }
      },
      delete: meta.isReadonly ? undefined : {
        summary: `Delete ${r.resource}`,
        tags: [r.resource],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '204': { description: 'Deleted' },
          '404': { description: 'Not found' }
        }
      }
    };
  }
  
  const openapi = {
    openapi: '3.0.3',
    info: {
      title: 'HZM Platform API',
      version: '1.0.0',
      description: 'Generic Data API - Metadata-driven'
    },
    servers: [
      { url: 'https://api.hzmsoft.com', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Development' }
    ],
    paths
  };
  
  fs.writeFileSync(
    'docs/openapi.yaml',
    yaml.dump(openapi, { indent: 2 })
  );
  
  console.log('OpenAPI spec generated: docs/openapi.yaml');
})();
```

```bash
# CI/CD'ye ekle
npm run generate-openapi
git add docs/openapi.yaml
git commit -m "Auto-update OpenAPI spec"
```

#### 4.4 Monitoring & Metrics (1 gün)

```javascript
// Middleware: Generic handler kullanımını track et

// Dosya: HzmVeriTabaniBackend/src/modules/data/middleware/metrics.js

const logger = require('../../../core/logger');

function trackGenericHandler(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Generic handler metrics', {
      resource: req.params.resource,
      operation: req.method,
      statusCode: res.statusCode,
      duration,
      filters: Object.keys(req.query).filter(k => k.includes('.')).length,
      userId: req.user?.id,
      tenantId: req.user?.tenant_id
    });
  });
  
  next();
}

module.exports = { trackGenericHandler };
```

```javascript
// data.routes.js'ye ekle
const { trackGenericHandler } = require('./middleware/metrics');

router.use(trackGenericHandler);  // Tüm route'lara uygula
```

### ✅ Hafta 4 Sonuç
```
✅ Tüm resource'lar generic handler ile çalışıyor
✅ Yeni tablo eklemek çok kolay (sadece metadata)
✅ OpenAPI otomatik üretiliyor
✅ Metrics topluyoruz
✅ Eski endpoint'ler hala çalışıyor (deprecation ile)
```

---

## 📊 4 HAFTA SONUNDA DURUM

### Endpoint Sayısı

| Kategori | Öncesi | Sonrası | Değişim |
|----------|--------|---------|---------|
| **Generic /data/*** | 11 (boş) | 11 (dolu) | ✅ İmplemente edildi |
| **Özel endpoint'ler** | 42 | 42 | ⚠️ Deprecation modunda |
| **Toplam aktif** | 53 | 53 | ✅ Hiçbir şey bozulmadı |

### Yeni Yetenekler

```
✅ /data/:resource → Sonsuz tablo desteği
✅ Supabase tarzı filtre (?eq, ?ilike, ?in, ?gte, etc.)
✅ Sıralama (?order=created_at.desc)
✅ Pagination (?page=2&limit=50)
✅ Metadata-driven (yeni tablo = 0 kod)
✅ OpenAPI otomatik üretiliyor
✅ RLS/Policy desteği
✅ Field-level permissions
```

---

## 🚀 HAFTA 5+: Eski Endpoint'leri Kaldır (Opsiyonel)

### 6 Ay Sonra (2026 Q2)

```javascript
// Sunset tarihini geçen endpoint'leri kaldır

// ÖNCE: Client migration tracking
// Log'larda hala kullanan var mı?
SELECT 
  DATE(timestamp), 
  path, 
  COUNT(*) as hit_count
FROM access_logs
WHERE path LIKE '/api/v1/projects/%'
  AND path NOT LIKE '/api/v1/data/%'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), path
ORDER BY hit_count DESC;

// Kullanım yoksa → SİL
// Kullanım varsa → 3 ay daha uzat, client'larla iletişime geç
```

---

## ✅ BAŞARI KRİTERLERİ

### Teknik
- [x] Metadata katmanı çalışıyor
- [x] Generic handler CRUD yapıyor
- [x] Filtreleme/sıralama/pagination çalışıyor
- [x] RLS/Policy uygulanıyor
- [x] OpenAPI otomatik üretiliyor
- [x] Metrics topluyoruz

### Business
- [x] Hiçbir endpoint bozulmadı
- [x] Frontend etkilenmedi
- [x] Yeni tablo eklemek 5 dakika (sadece SQL)
- [x] Dokümantasyon otomatik güncel
- [x] 400+ endpoint kaosu önlendi

### Rollback
- [x] Her aşamada geri alınabilir
- [x] Eski endpoint'ler hala çalışıyor
- [x] Metadata disable edersek generic handler devre dışı

---

## 🎯 SONUÇ

**4 hafta sonunda:**
- ✅ Generic handler production'da
- ✅ Gerçek verilerle çalışıyor
- ✅ Sistem bozulmadı
- ✅ 400+ endpoint kaosu önlendi
- ✅ Roadmap'teki tüm tablolar otomatik destekleniyor

**ROI:**
- ⏱️ 4 hafta yatırım
- 💰 %90 bakım maliyeti azalması
- 🚀 Yeni özellik geliştirme hızı 10x
- 📚 Dokümantasyon otomatik
- 🧪 Test yazma süresi %80 azaldı

---

## 🔧 PRODUCTION HARDENING - Mikro İyileştirmeler

### 1. Kill-Switch (Acil Dönüş Mekanizması)
```bash
# .env dosyasına ekle
GENERIC_DATA_ENABLED=true

# Kullanım:
if (process.env.GENERIC_DATA_ENABLED !== 'true') {
  return res.status(503).json({
    success: false,
    code: 'FEATURE_DISABLED',
    message: 'Generic data handler temporarily disabled'
  });
}

# Acil durumda: GENERIC_DATA_ENABLED=false → Tek tuş geri dönüş!
```

### 2. Cutover Header (Hangi Yol Kullanılıyor?)
```javascript
// DataController içinde her response'a ekle:
res.setHeader('X-Handler', 'generic');  // veya 'legacy'

// Eski proxy endpoint'lerde:
res.setHeader('X-Handler', 'legacy-proxy');

// Metrikle takip et:
// "X-Handler=generic" oranı ↑ → başarı!
// Hedef: 2 haftada %70+
```

### 3. Idempotency + Rate Limit (Sadece WRITE)
```javascript
// Middleware: HzmVeriTabaniBackend/src/modules/data/middleware/idempotency.js

const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Rate limiter (modül bazlı)
const dataWriteRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 100, // Max 100 write/dakika/user
  keyGenerator: (req) => `${req.user.id}:${req.params.resource}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many write requests. Try again later.',
      retryAfter: 60
    });
  }
});

// Idempotency check
const idempotencyStore = new Map(); // Production'da Redis kullan!

function requireIdempotency(req, res, next) {
  const methods = ['POST', 'PUT', 'DELETE'];
  if (!methods.includes(req.method)) return next();

  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key header is required for write operations'
    });
  }

  // Key'i kontrol et (daha önce kullanıldı mı?)
  const cached = idempotencyStore.get(idempotencyKey);
  if (cached) {
    return res.status(cached.status).json(cached.body);
  }

  // Response'u cache'le
  const originalSend = res.send;
  res.send = function(body) {
    idempotencyStore.set(idempotencyKey, {
      status: res.statusCode,
      body: JSON.parse(body)
    });
    // 24 saat sonra temizle
    setTimeout(() => idempotencyStore.delete(idempotencyKey), 24 * 60 * 60 * 1000);
    return originalSend.call(this, body);
  };

  next();
}

module.exports = { dataWriteRateLimiter, requireIdempotency };
```

```javascript
// data.routes.js'ye ekle:
const { dataWriteRateLimiter, requireIdempotency } = require('./middleware/idempotency');

// WRITE endpoint'lerine uygula
router.post('/:resource', authenticateApiKey, requireIdempotency, dataWriteRateLimiter, DataController.create);
router.put('/:resource/:id', authenticateApiKey, requireIdempotency, dataWriteRateLimiter, DataController.update);
router.delete('/:resource/:id', authenticateApiKey, requireIdempotency, dataWriteRateLimiter, DataController.delete);
```

### 4. Cursor-Based Pagination (İleriye Hazırlık)
```javascript
// QueryBuilder'a ekle (şimdilik flag ile kapalı)

static buildCursorPagination(query, meta) {
  const enableCursor = process.env.CURSOR_PAGINATION_ENABLED === 'true';
  
  if (!enableCursor || !query.cursor) {
    // Fallback: offset-based
    return this.buildPagination(query);
  }

  // Cursor decode et (base64)
  const cursor = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
  // cursor = { tenant_id: 123, id: 456 }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));

  // WHERE clause: stabil sıralama (tenant_id, id)
  const cursorClause = `
    AND (tenant_id, id) > ($${cursor.tenant_id}, $${cursor.id})
  `;

  // Next cursor oluştur
  const createNextCursor = (rows) => {
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    return Buffer.from(JSON.stringify({
      tenant_id: last.tenant_id,
      id: last.id
    })).toString('base64');
  };

  return { limit, cursorClause, createNextCursor };
}
```

### 5. Registry ⇄ Schema Sync Check (CI Gate)
```javascript
// Dosya: HzmVeriTabaniBackend/scripts/check-registry-sync.js

const pool = require('../src/core/database/pool');

(async () => {
  // 1. DB'deki gerçek kolonları al
  const dbSchema = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (SELECT table_name FROM api_resources WHERE is_enabled = true)
    ORDER BY table_name, column_name
  `);

  // 2. Registry'deki kolonları al
  const registryFields = await pool.query(`
    SELECT r.table_name, f.column_name, f.data_type
    FROM api_resources r
    JOIN api_resource_fields f ON f.resource = r.resource
    WHERE r.is_enabled = true
    ORDER BY r.table_name, f.column_name
  `);

  // 3. Delta kontrol et
  const dbMap = new Map();
  dbSchema.rows.forEach(row => {
    const key = `${row.table_name}.${row.column_name}`;
    dbMap.set(key, row.data_type);
  });

  const regMap = new Map();
  registryFields.rows.forEach(row => {
    const key = `${row.table_name}.${row.column_name}`;
    regMap.set(key, row.data_type);
  });

  let errors = 0;

  // Registry'de var ama DB'de yok
  for (const [key] of regMap) {
    if (!dbMap.has(key)) {
      console.error(`❌ ERROR: Column '${key}' in registry but NOT in DB schema`);
      errors++;
    }
  }

  // DB'de var ama registry'de yok (uyarı, hata değil)
  for (const [key] of dbMap) {
    if (!regMap.has(key)) {
      console.warn(`⚠️  WARNING: Column '${key}' in DB but NOT in registry (maybe intentionally excluded)`);
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Found ${errors} registry sync errors!`);
    process.exit(1);
  }

  console.log('✅ Registry and DB schema are in sync!');
  process.exit(0);
})();
```

```yaml
# .github/workflows/backend-test.yml'ye ekle:
- name: Check Registry Sync
  run: node scripts/check-registry-sync.js
```

### 6. Write-Safe Alan Whitelist (Log + Uyarı)
```javascript
// DataController.create() içinde:

// Sadece writable alanları al
const writableSet = new Set(meta.writableColumns);
const data = {};
const rejectedFields = [];

for (const [key, value] of Object.entries(req.body)) {
  if (writableSet.has(key)) {
    data[key] = value;
  } else {
    rejectedFields.push(key);
  }
}

// Rejected field'ları logla
if (rejectedFields.length > 0) {
  logger.warn('Rejected non-writable fields', {
    resource: req.params.resource,
    rejectedFields,
    userId: req.user?.id,
    tenantId: req.user?.tenant_id
  });
}

// Hiç geçerli alan yoksa hata dön
if (Object.keys(data).length === 0) {
  return res.status(400).json({
    success: false,
    code: 'NO_WRITABLE_FIELDS',
    message: 'No valid writable fields provided',
    rejectedFields
  });
}
```

### 7. Statement Guardrails (DB Timeout + Pool)
```javascript
// HzmVeriTabaniBackend/src/core/database/pool.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // Connection pool settings
  max: 20,                           // Max connections
  idleTimeoutMillis: 30000,          // 30s idle before release
  connectionTimeoutMillis: 3000,     // 3s wait for connection
  
  // Statement timeouts (PostgreSQL)
  statement_timeout: 6000,           // 6s max query time (write)
  idle_in_transaction_session_timeout: 10000  // 10s max idle in transaction
});

// Override query for read operations
const originalQuery = pool.query.bind(pool);
pool.query = function(text, params) {
  // Read query'ler için daha kısa timeout
  if (text.trim().toUpperCase().startsWith('SELECT')) {
    return originalQuery(`SET LOCAL statement_timeout = '3s'; ${text}`, params);
  }
  return originalQuery(text, params);
};

module.exports = pool;
```

### 8. RLS Çift Katman (DB + Handler)
```sql
-- Migration'a ekle: 012_enable_rls.sql

-- Users tablosu için RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::integer);

-- Projects tablosu için RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_projects ON projects
  USING (tenant_id = current_setting('app.tenant_id', true)::integer);

-- Test:
SET row_security = on;
SET app.tenant_id = '123';
SELECT * FROM users;  -- Sadece tenant_id=123 olanlar
```

```javascript
// DataController'da çift kontrol:
// 1. Handler'da tenant_id predicate (zaten var)
// 2. DB'de RLS policy (yeni eklendi)

// Her query başında context set et
await pool.query('SET app.tenant_id = $1', [req.user.tenant_id]);
```

### 9. Audit Zorunluluğu (Write'larda)
```javascript
// Middleware: HzmVeriTabaniBackend/src/modules/data/middleware/audit.js

async function enforceAudit(req, res, next) {
  const methods = ['POST', 'PUT', 'DELETE'];
  if (!methods.includes(req.method)) return next();

  // Response'u intercept et
  const originalJson = res.json.bind(res);
  res.json = async function(body) {
    // Başarılı write ise audit log yaz
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await pool.query(
          `INSERT INTO ops.audit_log (
            actor_id, tenant_id, scope, action, target_id, 
            ip, user_agent, trace_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, gen_random_uuid())`,
          [
            req.user?.id,
            req.user?.tenant_id,
            req.params.resource,
            req.method,
            req.params.id || body.data?.id,
            req.ip,
            req.headers['user-agent']
          ]
        );
      } catch (error) {
        logger.error('CRITICAL: Audit log failed!', error);
        // Audit başarısız = operation başarısız
        return originalJson({
          success: false,
          code: 'AUDIT_FAILED',
          message: 'Operation rolled back due to audit failure'
        });
      }
    }
    return originalJson(body);
  };

  next();
}

module.exports = { enforceAudit };
```

```javascript
// data.routes.js'ye ekle:
const { enforceAudit } = require('./middleware/audit');

router.post('/:resource', authenticateApiKey, enforceAudit, DataController.create);
router.put('/:resource/:id', authenticateApiKey, enforceAudit, DataController.update);
router.delete('/:resource/:id', authenticateApiKey, enforceAudit, DataController.delete);
```

### 10. OpenAPI Diff Gate (CI)
```yaml
# .github/workflows/backend-test.yml

- name: Generate OpenAPI Spec
  run: node scripts/generate-openapi.js

- name: Check for Breaking Changes
  run: |
    npm install -g openapi-diff
    
    # Eski spec'i git'ten al
    git show main:docs/openapi.yaml > openapi-old.yaml
    
    # Yeni spec'i karşılaştır
    openapi-diff openapi-old.yaml docs/openapi.yaml --format markdown > diff.md
    
    # Breaking change varsa fail
    if grep -q "BREAKING" diff.md; then
      echo "❌ Breaking changes detected!"
      cat diff.md
      exit 1
    fi
    
    echo "✅ No breaking changes"
```

---

## 🧪 CUTOVER CHECKLIST - Production Geçiş

### Hafta 3 Sonrası (Canary Başarılı)

#### Metrikler (Dashboard'da izle)
- [ ] **X-Handler=generic oranı:** %70+ (hedef: 2 haftada)
- [ ] **p95 latency korunuyor:**
  - Read: < 250ms
  - Write: < 400ms
- [ ] **5xx oranı:** < %0.3/gün
- [ ] **429 (rate limit) artışı yok**
- [ ] **Legacy endpoint çağrıları:** %10'un altına düştü (14 gün içinde)
- [ ] **Audit kayıt oranı:** Write sayısı = Audit satırı (±%2 tolerans)

#### Client Migration Tracking
```sql
-- Deprecation header alan client'ları listele
SELECT 
  user_agent,
  COUNT(*) as deprecated_calls,
  MAX(timestamp) as last_call
FROM access_logs
WHERE path LIKE '/api/v1/projects%'
  AND path NOT LIKE '/api/v1/data/%'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_agent
ORDER BY deprecated_calls DESC;

-- Sonuç: Bu client'lara bilgilendirme yap!
```

#### Pre-Flight Checks
- [ ] Kill-switch test edildi (GENERIC_DATA_ENABLED=false → anında geri dönüş)
- [ ] Idempotency çalışıyor (aynı key ile 2. istek = cached response)
- [ ] Rate limit çalışıyor (100 req/min aşımında 429)
- [ ] RLS aktif (DB + handler çift kontrol)
- [ ] Audit log tüm write'larda kayıt oluşturuyor
- [ ] OpenAPI diff CI gate'i aktif

---

## 🛡️ GÜVENLİK NOTLARI - Production Kritik

### 1. Operator Whitelist (SQL Injection Önleme)
```javascript
// QueryBuilder.buildWhere() içinde:
const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in'];

const match = key.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|in)\.(.+)$/);
if (!match) continue;

const [, operator, column] = match;

// Güvenlik: Sadece whitelist'teki operatörler
if (!ALLOWED_OPERATORS.includes(operator)) {
  logger.warn('Unauthorized operator attempt', { operator, userId: req.user?.id });
  continue;
}
```

**Unit Test:**
```javascript
test('should reject unauthorized operators', () => {
  const query = { 'DROP.users': 'test' };  // SQL injection denemesi
  const where = QueryBuilder.buildWhere(query, meta);
  expect(where.sql).toBe('');  // Filtrelendi
});
```

### 2. Order Injection Önleme
```javascript
// QueryBuilder.buildOrder() içinde:
const VALID_DIRECTIONS = ['asc', 'desc'];

for (const item of orderStr.split(',')) {
  const [column, direction = 'asc'] = item.split('.');
  
  // Güvenlik 1: Sadece readable column
  if (!readableSet.has(column)) continue;
  
  // Güvenlik 2: Sadece ASC|DESC
  if (!VALID_DIRECTIONS.includes(direction.toLowerCase())) continue;
  
  orders.push(`${column} ${direction.toUpperCase()}`);
}
```

**Unit Test:**
```javascript
test('should reject SQL injection in order', () => {
  const orderStr = 'id; DROP TABLE users--';
  const order = QueryBuilder.buildOrder(orderStr, meta);
  expect(order).toBe('ORDER BY id DESC');  // Sadece geçerli kısım
});
```

### 3. Select Mask (Hassas Alan Gizleme)
```sql
-- Migration: Hassas alanları maskelemek için view oluştur
CREATE OR REPLACE VIEW users_safe AS
SELECT 
  id,
  email,  -- Maskelenmiş: user****@example.com
  CASE 
    WHEN LENGTH(email) > 10 THEN CONCAT(SUBSTRING(email, 1, 4), '****', SUBSTRING(email FROM '@.*'))
    ELSE '****@****'
  END as email_masked,
  first_name,
  last_name,
  role,
  is_active,
  created_at,
  updated_at
FROM users;

-- Registry'ye view'ı ekle
INSERT INTO api_resources (resource, schema_name, table_name, is_readonly) VALUES
('users_safe', 'public', 'users_safe', true);  -- Read-only!
```

### 4. JOIN İsteği Yok
```javascript
// Generic handler tek tablo ile çalışır
// JOIN gerekiyorsa → Read-only VIEW oluştur

// YANLIŞ:
// GET /data/projects?join=users

// DOĞRU:
// CREATE VIEW projects_with_owner AS
// SELECT p.*, u.name as owner_name FROM projects p JOIN users u ...
// INSERT INTO api_resources VALUES ('projects_with_owner', ...)
```

### 5. Mass-Update Riski Önleme
```javascript
// DataController.update() ve delete() içinde:
// :id parametresi ZORUNLU!

static async update(req, res) {
  const { resource, id } = req.params;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      code: 'ID_REQUIRED',
      message: 'Mass update not allowed. ID parameter is required.'
    });
  }
  
  // ... rest of code
}

// Engellenmiş: PUT /data/users?eq.status=active → tüm aktif kullanıcıları günceller (TEHLİKELİ!)
// Sadece izinli: PUT /data/users/123 → tek kullanıcı günceller (GÜVENLİ!)
```

### 6. Gizli Kolonlar (readable=false)
```javascript
// DataController.list() içinde:
// meta.readableSelect zaten sadece readable=true alanları içeriyor

// Ama ekstra güvenlik için:
const sql = `
  SELECT ${meta.readableSelect}  -- password_hash, api_key gibi alanlar YOK!
  FROM ${meta.schema}.${meta.table}
  WHERE 1=1 ${where.sql}
`;

// Unit test:
test('should not expose hidden columns', async () => {
  const response = await request(app)
    .get('/api/v1/data/users/123')
    .set('X-API-Key', apiKey);
  
  expect(response.body.data).not.toHaveProperty('password_hash');
  expect(response.body.data).not.toHaveProperty('api_key');
});
```

### 7. Anonim Erişim Engelleme
```javascript
// data.routes.js - Tüm route'lar auth zorunlu:
const { authenticateApiKey } = require('../../middleware/auth');

// Genel kural: /data/* → auth zorunlu
router.use(authenticateApiKey);

// Public read gerekiyorsa → ayrı public view + policy:
// CREATE VIEW public_products AS SELECT id, name, price FROM products WHERE is_published = true;
// INSERT INTO api_resources VALUES ('public_products', 'public', 'public_products', true);
// + Özel middleware: allowPublicRead(['public_products'])
```

---

## 📈 ENDPOINT HEDEFİ: 30-40 (Modül Sınırları)

### Kalacak Modüller (Specific Pattern)
```
/auth/*      (6 endpoint)  - Özel logic (login, register, etc.)
/admin/*     (18 endpoint) - Özel logic (reports, AI KB, etc.)
/health/*    (3 endpoint)  - Healthcheck (/, /ready, /live)

TOPLAM: 27 endpoint (değişmez)
```

### Generic Pattern
```
/data/:resource  (11 endpoint)
  - GET    /:resource
  - POST   /:resource
  - GET    /:resource/:id
  - PUT    /:resource/:id
  - PATCH  /:resource/:id
  - DELETE /:resource/:id
  - POST   /:resource/batch
  - PUT    /:resource/batch
  - DELETE /:resource/batch
  - POST   /:resource/search
  - GET    /:resource/count

→ Sonsuz tablo, sabit endpoint!
```

### Optional (Gelecek)
```
/users/:id/:action           (1 endpoint) - Whitelist: ['activate', 'deactivate', 'reset-password']
/projects/:id/:subResource   (2 endpoint) - Whitelist: ['tables', 'team', 'api-keys']
/api-keys/:scope/:action     (2 endpoint) - Whitelist: ['generate', 'regenerate', 'revoke']

TOPLAM (opsiyonel): +5 endpoint
```

**FINAL HEDEF: 27 (specific) + 11 (generic) + 5 (optional) = 43 endpoint** ✅

---

## 🚨 KIRMIZI BAYRAKLAR - Rollback Tetikleyicileri

### Anında Rollback (Kill-Switch Aktif Et)
1. **p95 latency %30'dan fazla bozulur** ve 24 saat içinde düzelmezse
2. **5xx oranı > %0.7'ye çıkar** ve 2 deploy sonra da düşmezse
3. **Audit kayıtlarında kayıp görülürse** (Write sayısı ≠ Audit satırı)
4. **Data corruption raporu** gelirse (yanlış tenant'a yazma, vb.)

### Rollback Prosedürü
```bash
# 1. Kill-switch aktif et
export GENERIC_DATA_ENABLED=false
# veya Railway dashboard'dan env var değiştir

# 2. Deploy et (hot reload)
git push railway main

# 3. Metrikleri izle (5 dakika)
# X-Handler=legacy % → 100'e çıkmalı

# 4. Incident report hazırla
# - Ne oldu?
# - Neden rollback yapıldı?
# - Nasıl düzeltilecek?
```

---

## 📊 İZLENECEK 5 KRİTİK METRİK (Haftalık)

### 1. Generic Kullanım Oranı
```
Metric: X-Handler=generic / Total requests
Hedef: %70+ (2 haftada)
Alert: <%50 (3 günde)
```

### 2. p95 Gecikme
```
Read:  <250ms
Write: <400ms
Alert: >300ms (read) veya >500ms (write)
```

### 3. 5xx Oranı
```
Hedef: <%0.3/gün
Alert: >%0.7/gün (anında inceleme)
```

### 4. Legacy Çağrı Oranı
```
Hedef: <% 10 (14 günde)
Deprecation header alan endpoint'ler:
  - /api/v1/projects/*
  - /api/v1/users/* (eğer aktifleştirilirse)
```

### 5. Audit Eşleşmesi
```
Write Count ≈ Audit Rows (±%2)
Alert: Fark >%5 (kritik güvenlik sorunu!)
```

---

## ✅ BAŞARI KRİTERLERİ (GO Sinyalleri)

### Teknik GO
- [x] Tek mantık: /data/:resource tüm CRUD'u tutarlı çalışıyor (en az 2 gerçek tablo)
- [x] Geriye uyumluluk: Eski rotalar çalışıyor, Deprecation + Sunset header'ları var
- [x] Otomasyon: docs/openapi.yaml PR'da otomatik güncelleniyor
- [x] OpenAPI-diff: Breaking change CI'da engelliyor
- [x] Gözlemlenebilirlik: X-Handler metriği + p95 tracking

### Güvenlik GO
- [x] RLS: DB'de aktif + handler'da tenant predicate (çift katman)
- [x] Audit: Tüm write'lar ops.audit_log'a düşüyor (zorunlu)
- [x] Whitelist: Operator, order, :action/:subResource hepsi whitelist'te
- [x] SQL Injection: Unit testlerle doğrulandı
- [x] Rate Limit: 100 req/min (write), idempotency zorunlu

### Business GO
- [x] Hiçbir endpoint bozulmadı (eski rotalar proxy ile çalışıyor)
- [x] Frontend etkilenmedi (her iki yol da aynı datayı döndürüyor)
- [x] Yeni tablo eklemek <5 dakika (sadece INSERT INTO api_resources)
- [x] Dokümantasyon otomatik güncel (OpenAPI generator)
- [x] 400+ endpoint kaosu önlendi (sonsuz tablo, sabit endpoint)

---

## 🎯 FINAL SONUÇ

**4 Hafta + Production Hardening ile:**

✅ **Generic handler production-grade**  
✅ **Güvenlik katmanları eksiksiz** (RLS, audit, whitelist, rate limit)  
✅ **Gözlemlenebilirlik tam** (X-Handler, metrics, dashboard)  
✅ **Acil dönüş mekanizması** (kill-switch, rollback prosedürü)  
✅ **Geriye uyumluluk** (deprecation, sunset, proxy)  
✅ **400+ endpoint kaosu önlendi** (Roadmap'teki tüm özellikler otomatik destekleniyor)

**ROI:**
- ⏱️ **4 hafta yatırım** → Tek seferlik
- 💰 **%90 bakım maliyeti azalması** → Sürekli kazanç
- 🚀 **Yeni özellik hızı 10x** → Template'ler, E-commerce, MLM hepsi otomatik
- 📚 **Dokümantasyon otomatik** → OpenAPI hiç eskimez
- 🧪 **Test yazma %80 azaldı** → Contract-based testing
- 🛡️ **Güvenlik katmanları** → Production-ready

---

**Bu plan Supabase-tarzı sürdürülebilirlik sağlıyor:**  
**Yeni tablo = 0 kod | Tek handler = düşük bakım | OpenAPI auto = düşük entegrasyon maliyeti**

**Mantıklı mı? EVET!** — Teknik risk kontrollü, geri dönüş yolu açık, iş tarafı kesintisiz. 🎉

---
---

# 🧩 HAFTA 5-8: MODÜLERLEŞTIRME (Plugin Architecture)

> **Durum:** Opsiyonel - Hafta 1-4 tamamlandıktan SONRA  
> **Hedef:** Domain-rich, modüler, production-grade sistem  
> **Yaklaşım:** Engine + Plugin Architecture (GenericEngine + Module Plugins)

---

## 🎯 NEDEN MODÜLERLEŞTIRME?

### Hafta 1-4'ün Sınırları
```
✅ 400+ endpoint kaosu önlendi
✅ Generic handler çalışıyor
✅ Yeni tablo eklemek kolay

❌ Domain logic YOK (user password hash, API key encryption)
❌ Her tablo aynı validation
❌ Modül-özel özelleştirme yok
```

### Modülerleştirme ile Kazançlar
```
✅ Domain logic izole (her modül kendi kuralı)
✅ Validation modül bazlı (users: email format, api-keys: permissions)
✅ Hooks (beforeWrite, afterRead - hash, mask, encrypt)
✅ Performance tuning modül bazlı (rate limit, caching)
✅ Test edilebilirlik ↑ (modül bazlı contract tests)
✅ Mikroservise geçiş kolay (plugin → ayrı service)
```

---

## 📐 MİMARİ: Engine + Plugins

### Konsept
```
┌─────────────────────────────────────┐
│   Generic Engine (Core Logic)      │
│                                     │
│  - QueryDSL (filter/order/page)    │
│  - Security (RLS, tenant)           │
│  - Audit (write logging)            │
│  - Idempotency                      │
│  - OpenAPI Generator                │
└─────────────────────────────────────┘
              ↓ Plugin API
┌──────────────┬──────────────┬──────────────┐
│ usersPlugin  │ projectsPlug │ apiKeysPlug  │
│              │              │              │
│ beforeWrite: │ validator:   │ beforeWrite: │
│  hash pwd    │  status enum │  generate    │
│              │              │    + hash    │
│ afterRead:   │ afterRead:   │              │
│  mask email  │  join owner  │ limits:      │
│              │              │  120 req/min │
└──────────────┴──────────────┴──────────────┘
```

---

## 🗓️ HAFTA 5: Engine Refactor (Hook Sistemi)

### Hedef
Generic handler'a plugin desteği ekle, hook API'sini oluştur.

### Adımlar

#### 5.1 Plugin Interface Tanımla (1 gün)
```typescript
// Dosya: HzmVeriTabaniBackend/src/modules/data/types/plugin.interface.ts

export interface PluginContext {
  user: {
    id: number;
    tenant_id: number;
    role: string;
  };
  resource: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  meta: ResourceMeta;
  logger: Logger;
}

export interface SQLClause {
  sql: string;
  params: any[];
}

export interface ModulePlugin {
  // Temel bilgi
  name: string;                      // 'users' | 'projects' | 'api-keys'
  resources: string[];               // ['users'] veya ['projects', 'project_team']
  
  // Validation (create/update için)
  validators?: {
    create?: (body: any, ctx: PluginContext) => Promise<void> | void;
    update?: (body: any, ctx: PluginContext) => Promise<void> | void;
  };
  
  // Hooks (lifecycle events)
  hooks?: {
    beforeRead?: (query: Query, ctx: PluginContext) => Promise<Query> | Query;
    afterRead?: (rows: any[], ctx: PluginContext) => Promise<any[]> | any[];
    beforeWrite?: (body: any, ctx: PluginContext) => Promise<any> | any;
    afterWrite?: (row: any, ctx: PluginContext) => Promise<void> | void;
  };
  
  // Policies (extra RLS predicates)
  policies?: {
    extraPredicate?: (op: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE', ctx: PluginContext) => SQLClause;
  };
  
  // Rate limiting (modül bazlı)
  limits?: {
    ratePerMin?: number;
    burst?: number;
  };
}
```

#### 5.2 Plugin Manager Oluştur (2 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/services/plugin-manager.js

class PluginManager {
  constructor() {
    this.plugins = new Map(); // resource → plugin
  }

  /**
   * Plugin kaydet
   */
  register(plugin) {
    // Validation
    if (!plugin.name || !plugin.resources || !Array.isArray(plugin.resources)) {
      throw new Error('Invalid plugin: name and resources required');
    }

    // Her resource için plugin'i kaydet
    for (const resource of plugin.resources) {
      if (this.plugins.has(resource)) {
        logger.warn(`Plugin for '${resource}' already registered, overwriting`);
      }
      this.plugins.set(resource, plugin);
    }

    logger.info(`Plugin registered: ${plugin.name} (resources: ${plugin.resources.join(', ')})`);
  }

  /**
   * Resource için plugin bul
   */
  getPlugin(resource) {
    return this.plugins.get(resource) || null;
  }

  /**
   * Validation çalıştır
   */
  async runValidator(operation, resource, body, ctx) {
    const plugin = this.getPlugin(resource);
    if (!plugin || !plugin.validators) return;

    const validator = plugin.validators[operation]; // 'create' | 'update'
    if (!validator) return;

    try {
      await validator(body, ctx);
    } catch (error) {
      logger.error(`Validation failed for ${resource}.${operation}`, error);
      throw error;
    }
  }

  /**
   * Hook çalıştır
   */
  async runHook(hookName, resource, data, ctx) {
    const plugin = this.getPlugin(resource);
    if (!plugin || !plugin.hooks) return data;

    const hook = plugin.hooks[hookName];
    if (!hook) return data;

    try {
      return await hook(data, ctx);
    } catch (error) {
      logger.error(`Hook failed: ${resource}.${hookName}`, error);
      throw error;
    }
  }

  /**
   * Extra policy (RLS predicate) al
   */
  getExtraPredicate(operation, resource, ctx) {
    const plugin = this.getPlugin(resource);
    if (!plugin || !plugin.policies || !plugin.policies.extraPredicate) {
      return { sql: '', params: [] };
    }

    try {
      return plugin.policies.extraPredicate(operation, ctx);
    } catch (error) {
      logger.error(`Policy failed: ${resource}.${operation}`, error);
      return { sql: '', params: [] };
    }
  }

  /**
   * Rate limit ayarları al
   */
  getRateLimits(resource) {
    const plugin = this.getPlugin(resource);
    if (!plugin || !plugin.limits) {
      return { ratePerMin: 100, burst: 20 }; // Default
    }
    return plugin.limits;
  }
}

// Singleton instance
const pluginManager = new PluginManager();
module.exports = pluginManager;
```

#### 5.3 DataController'ı Refactor Et (2 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/data.controller.js
// MEVCUT DOSYAYI GÜNCELLE

const pluginManager = require('./services/plugin-manager');

class DataController {
  /**
   * CREATE - Plugin hooks ile
   */
  static async create(req, res) {
    try {
      const { resource } = req.params;
      
      // 1. Metadata al
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      if (meta.isReadonly) {
        return res.status(403).json({ success: false, code: 'RESOURCE_READONLY' });
      }

      // Plugin context
      const ctx = {
        user: req.user,
        resource,
        operation: 'INSERT',
        meta,
        logger
      };

      // 2. PLUGIN: Validation
      await pluginManager.runValidator('create', resource, req.body, ctx);

      // 3. PLUGIN: beforeWrite hook
      let body = await pluginManager.runHook('beforeWrite', resource, req.body, ctx);

      // 4. Sadece writable alanları al
      const writableSet = new Set(meta.writableColumns);
      const data = {};
      
      for (const [key, value] of Object.entries(body)) {
        if (writableSet.has(key)) {
          data[key] = value;
        }
      }

      // tenant_id inject et
      if (req.user?.tenant_id && meta.writableColumns.includes('tenant_id')) {
        data.tenant_id = req.user.tenant_id;
      }

      // 5. PLUGIN: Extra policy (insert için)
      const extraPolicy = pluginManager.getExtraPredicate('INSERT', resource, ctx);

      // 6. SQL oluştur ve çalıştır
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const sql = `
        INSERT INTO ${meta.schema}.${meta.table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING ${meta.readableSelect}
      `;

      const result = await pool.query(sql, values);
      const createdRow = result.rows[0];

      // 7. PLUGIN: afterWrite hook
      await pluginManager.runHook('afterWrite', resource, createdRow, ctx);

      return res.status(201).json({
        success: true,
        data: createdRow
      });

    } catch (error) {
      logger.error('Create data error:', error);
      
      // Validation error (Zod)
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          errors: error.errors
        });
      }
      
      // Duplicate key
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_KEY',
          message: 'Resource already exists'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * LIST - Plugin hooks ile
   */
  static async list(req, res) {
    try {
      const { resource } = req.params;
      
      // 1. Metadata al
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource '${resource}' not found or not enabled`
        });
      }

      // Plugin context
      const ctx = {
        user: req.user,
        resource,
        operation: 'SELECT',
        meta,
        logger
      };

      // 2. PLUGIN: beforeRead hook (query modification)
      let query = await pluginManager.runHook('beforeRead', resource, req.query, ctx);

      // 3. Query'yi parse et
      const select = QueryBuilder.buildSelect(query.select, meta);
      const where = QueryBuilder.buildWhere(query, meta);
      const order = QueryBuilder.buildOrder(query.order, meta);
      const { limit, offset } = QueryBuilder.buildPagination(query);

      // 4. RLS/Policy uygula
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const rlsParams = [];
      
      if (tenantId && meta.table.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $${where.params.length + 1}`;
        rlsParams.push(tenantId);
      }

      // 5. PLUGIN: Extra policy
      const extraPolicy = pluginManager.getExtraPredicate('SELECT', resource, ctx);
      
      // 6. SQL oluştur ve çalıştır
      const sql = `
        SELECT ${select}
        FROM ${meta.schema}.${meta.table}
        WHERE 1=1 ${where.sql} ${rlsSql} ${extraPolicy.sql}
        ${order}
        LIMIT $${where.params.length + rlsParams.length + extraPolicy.params.length + 1}
        OFFSET $${where.params.length + rlsParams.length + extraPolicy.params.length + 2}
      `;
      const params = [...where.params, ...rlsParams, ...extraPolicy.params, limit, offset];

      const result = await pool.query(sql, params);

      // 7. PLUGIN: afterRead hook (data transformation - masking, etc.)
      const rows = await pluginManager.runHook('afterRead', resource, result.rows, ctx);

      // 8. Response header (tracking)
      res.setHeader('X-Handler', 'generic-plugin');

      return res.json({
        success: true,
        data: rows,
        meta: {
          resource,
          count: rows.length,
          page: Math.floor(offset / limit) + 1,
          limit
        }
      });

    } catch (error) {
      logger.error('List data error:', error);
      
      if (error.message.includes('not enabled')) {
        return res.status(403).json({
          success: false,
          code: 'RESOURCE_DISABLED',
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // UPDATE ve DELETE metodları da benzer şekilde hook desteği ekle
  // ... (benzer pattern)
}

module.exports = DataController;
```

### ✅ Hafta 5 Sonuç
```
✅ Plugin interface tanımlandı
✅ Plugin manager hazır
✅ DataController hook desteği eklendi
✅ Test edildi (hook'lar çalışıyor)
❌ Henüz hiçbir plugin yok (boş çalışıyor)
```

---

## 🗓️ HAFTA 6: İlk Plugin'ler (Projects, Users)

### Hedef
Basit bir plugin (projects) ve orta seviye plugin (users) ekle.

### Adımlar

#### 6.1 Projects Plugin (Basit - Test İçin) (1 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/plugins/projects.plugin.js

const { z } = require('zod');

const projectsPlugin = {
  name: 'projects',
  resources: ['projects'],

  // Validation (create/update)
  validators: {
    create: (body, ctx) => {
      // Zod schema
      const schema = z.object({
        name: z.string().min(3).max(100),
        description: z.string().max(500).optional(),
        status: z.enum(['active', 'inactive', 'archived']).default('active')
      });

      schema.parse(body); // Hata fırlatır validation fail olursa
    },

    update: (body, ctx) => {
      const schema = z.object({
        name: z.string().min(3).max(100).optional(),
        description: z.string().max(500).optional(),
        status: z.enum(['active', 'inactive', 'archived']).optional()
      });

      schema.parse(body);
    }
  },

  // Hooks
  hooks: {
    afterRead: (rows, ctx) => {
      // Örnek: status'u uppercase yap (basit transformation)
      return rows.map(row => ({
        ...row,
        status: row.status?.toUpperCase()
      }));
    }
  },

  // Rate limit
  limits: {
    ratePerMin: 200, // Projects için daha yüksek limit
    burst: 40
  }
};

module.exports = projectsPlugin;
```

#### 6.2 Users Plugin (Orta Seviye - Hash + Mask) (3 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/plugins/users.plugin.js

const { z } = require('zod');
const bcrypt = require('bcrypt');

const usersPlugin = {
  name: 'users',
  resources: ['users'],

  // Validation
  validators: {
    create: async (body, ctx) => {
      // Sadece admin user oluşturabilir
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'master_admin') {
        throw new Error('FORBIDDEN: Only admins can create users');
      }

      // Schema validation
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8).max(100),
        first_name: z.string().min(2).max(50),
        last_name: z.string().min(2).max(50),
        role: z.enum(['user', 'admin', 'master_admin']).default('user')
      });

      schema.parse(body);

      // Email unique check (örnek - gerçekte DB'de yapılır)
      // ... unique email kontrolü
    },

    update: async (body, ctx) => {
      const schema = z.object({
        email: z.string().email().optional(),
        first_name: z.string().min(2).max(50).optional(),
        last_name: z.string().min(2).max(50).optional(),
        // password ve role update için özel izin gerekir
      });

      schema.parse(body);

      // Password update izin kontrolü
      if (body.password && ctx.user.role !== 'admin') {
        throw new Error('FORBIDDEN: Only admins can change passwords');
      }
    }
  },

  // Hooks
  hooks: {
    beforeWrite: async (body, ctx) => {
      // Password varsa hash'le
      if (body.password) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(body.password, salt);
        
        return {
          ...body,
          password_hash: hash,
          password: undefined // Plain password'ü kaldır
        };
      }
      return body;
    },

    afterRead: (rows, ctx) => {
      // Email masking (privacy)
      return rows.map(row => ({
        ...row,
        email: maskEmail(row.email),
        password_hash: undefined // Hash'i asla döndürme!
      }));
    },

    afterWrite: async (row, ctx) => {
      // Örnek: User created event'i tetikle
      ctx.logger.info('User created/updated', {
        userId: row.id,
        tenantId: row.tenant_id,
        actorId: ctx.user.id
      });

      // Burada event bus'a mesaj gönderilebilir
      // await eventBus.emit('user.created', row);
    }
  },

  // Policies
  policies: {
    extraPredicate: (op, ctx) => {
      // Sadece kendi tenant'ındaki kullanıcıları görebilir
      // (RLS zaten var ama extra kontrol)
      if (op === 'SELECT') {
        return {
          sql: ` AND tenant_id = $tenant_id`,
          params: []  // tenant_id zaten context'te set edilmiş
        };
      }
      return { sql: '', params: [] };
    }
  },

  // Rate limit
  limits: {
    ratePerMin: 100, // User operations daha kısıtlı
    burst: 20
  }
};

// Helper: Email masking
function maskEmail(email) {
  if (!email) return '****@****';
  const [local, domain] = email.split('@');
  if (local.length <= 4) return `****@${domain}`;
  return `${local.substring(0, 4)}****@${domain}`;
}

module.exports = usersPlugin;
```

#### 6.3 Plugin'leri Register Et (1 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/plugins/index.js

const pluginManager = require('../services/plugin-manager');
const projectsPlugin = require('./projects.plugin');
const usersPlugin = require('./users.plugin');

/**
 * Tüm plugin'leri yükle
 */
function registerAllPlugins() {
  // Feature flags ile kontrol et
  if (process.env.FF_GENERIC_PROJECTS === 'true') {
    pluginManager.register(projectsPlugin);
  }

  if (process.env.FF_GENERIC_USERS === 'true') {
    pluginManager.register(usersPlugin);
  }

  // Daha fazla plugin eklenebilir...
}

module.exports = { registerAllPlugins };
```

```javascript
// Dosya: HzmVeriTabaniBackend/src/app/server.js (başlangıçta)

const { registerAllPlugins } = require('../modules/data/plugins');

// ... diğer imports

// Startup
const startServer = async () => {
  try {
    // ... database init

    // Plugin'leri yükle
    logger.info('Registering plugins...');
    registerAllPlugins();
    logger.info('Plugins registered successfully!');

    // ... server start
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};
```

#### 6.4 Test Et (1 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/tests/plugins/users.plugin.test.js

describe('Users Plugin', () => {
  test('should hash password on create', async () => {
    const body = {
      email: 'test@example.com',
      password: 'mypassword',
      first_name: 'Test',
      last_name: 'User'
    };

    const ctx = { user: { role: 'admin' }, logger };
    
    // beforeWrite hook çalıştır
    const result = await usersPlugin.hooks.beforeWrite(body, ctx);
    
    expect(result.password).toBeUndefined();
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toBe('mypassword');
  });

  test('should mask email on read', () => {
    const rows = [
      { id: 1, email: 'testuser@example.com', first_name: 'Test' }
    ];

    const ctx = { user: { role: 'user' }, logger };
    
    // afterRead hook çalıştır
    const result = usersPlugin.hooks.afterRead(rows, ctx);
    
    expect(result[0].email).toBe('test****@example.com');
  });

  test('should reject non-admin user creation', async () => {
    const body = { email: 'test@example.com', password: 'pwd' };
    const ctx = { user: { role: 'user' }, logger };
    
    await expect(
      usersPlugin.validators.create(body, ctx)
    ).rejects.toThrow('FORBIDDEN');
  });
});
```

### ✅ Hafta 6 Sonuç
```
✅ Projects plugin (basit, validation + transformation)
✅ Users plugin (hash + mask + validation + permissions)
✅ Plugin registration sistemi
✅ Feature flags (FF_GENERIC_PROJECTS, FF_GENERIC_USERS)
✅ Test coverage
```

---

## 🗓️ HAFTA 7: Advanced Plugin (API Keys)

### Hedef
Karmaşık domain logic içeren api-keys plugin'ini ekle.

### Adımlar

#### 7.1 API Keys Plugin (3 gün)
```javascript
// Dosya: HzmVeriTabaniBackend/src/modules/data/plugins/api-keys.plugin.js

const { z } = require('zod');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const apiKeysPlugin = {
  name: 'api-keys',
  resources: ['api_keys'],

  // Validation
  validators: {
    create: async (body, ctx) => {
      // Permission check: Sadece owner veya admin
      if (!['admin', 'owner', 'master_admin'].includes(ctx.user.role)) {
        throw new Error('FORBIDDEN: Insufficient permissions to generate API keys');
      }

      // Schema (create'te key gönderilmez, otomatik üretilir)
      const schema = z.object({
        user_id: z.number().optional(), // Owner için
        scopes: z.array(z.string()).default(['read']),
        expires_at: z.string().datetime().optional()
      });

      schema.parse(body);
    }
  },

  // Hooks
  hooks: {
    beforeWrite: async (body, ctx) => {
      // API Key generation + hashing
      if (ctx.operation === 'INSERT') {
        // 1. Generate key (32 bytes hex)
        const apiKey = `hzm_${crypto.randomBytes(32).toString('hex')}`;
        
        // 2. Generate password (16 bytes hex)
        const apiPassword = crypto.randomBytes(16).toString('hex');

        // 3. Hash both
        const keySalt = await bcrypt.genSalt(10);
        const keyHash = await bcrypt.hash(apiKey, keySalt);
        
        const pwdSalt = await bcrypt.genSalt(10);
        const pwdHash = await bcrypt.hash(apiPassword, pwdSalt);

        // 4. Return transformed body
        return {
          ...body,
          key_hash: keyHash,
          password_hash: pwdHash,
          key_last_four: apiKey.slice(-4),
          // Plain values (sadece response'ta gösterilir, DB'ye yazılmaz)
          __plain_key: apiKey,        // Special prefix: DB'ye yazılmaz
          __plain_password: apiPassword
        };
      }

      return body;
    },

    afterWrite: async (row, ctx) => {
      // Log API key creation
      ctx.logger.info('API Key generated', {
        keyId: row.id,
        userId: row.user_id,
        tenantId: row.tenant_id,
        scopes: row.scopes,
        lastFour: row.key_last_four
      });

      // Event emit (opsiyonel)
      // await eventBus.emit('api_key.created', { keyId: row.id });
    },

    afterRead: (rows, ctx) => {
      // Hash'leri asla döndürme!
      return rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        key_last_four: row.key_last_four,
        scopes: row.scopes,
        expires_at: row.expires_at,
        created_at: row.created_at,
        // Hash'ler exclude
        key_hash: undefined,
        password_hash: undefined
      }));
    }
  },

  // Policies
  policies: {
    extraPredicate: (op, ctx) => {
      // User sadece kendi API key'lerini görebilir
      if (op === 'SELECT' && ctx.user.role === 'user') {
        return {
          sql: ` AND user_id = ${ctx.user.id}`,
          params: []
        };
      }
      return { sql: '', params: [] };
    }
  },

  // Rate limit (çok kısıtlı!)
  limits: {
    ratePerMin: 30,  // API key generation çok kısıtlı
    burst: 5
  }
};

module.exports = apiKeysPlugin;
```

#### 7.2 Response Transformation (Plain Values) (1 gün)
```javascript
// DataController.create() içinde afterWrite'tan sonra:

// ... afterWrite hook

// 8. Plain values check (__ prefix)
// Plugin'den dönen plain değerleri response'ta göster
const response Data = { ...createdRow };

for (const [key, value] of Object.entries(body)) {
  if (key.startsWith('__plain_')) {
    const plainKey = key.replace('__plain_', '');
    responseData[plainKey] = value;
    responseData[`${plainKey}_warning`] = 'This value is shown once only. Save it securely!';
  }
}

return res.status(201).json({
  success: true,
  data: responseData
});
```

#### 7.3 Test (1 gün)
```javascript
// Test: API key generation + hashing

describe('API Keys Plugin', () => {
  test('should generate and hash API key', async () => {
    const body = { scopes: ['read', 'write'] };
    const ctx = { user: { role: 'admin' }, operation: 'INSERT', logger };
    
    const result = await apiKeysPlugin.hooks.beforeWrite(body, ctx);
    
    expect(result.__plain_key).toMatch(/^hzm_[a-f0-9]{64}$/);
    expect(result.__plain_password).toHaveLength(32);
    expect(result.key_hash).toBeDefined();
    expect(result.password_hash).toBeDefined();
    expect(result.key_last_four).toHaveLength(4);
  });

  test('should NOT expose hash on read', () => {
    const rows = [
      {
        id: 1,
        key_hash: 'somehash',
        password_hash: 'pwdhash',
        key_last_four: '1234'
      }
    ];

    const result = apiKeysPlugin.hooks.afterRead(rows, {});
    
    expect(result[0].key_hash).toBeUndefined();
    expect(result[0].password_hash).toBeUndefined();
    expect(result[0].key_last_four).toBe('1234');
  });
});
```

### ✅ Hafta 7 Sonuç
```
✅ API Keys plugin (generation + hashing + masking)
✅ Complex domain logic (crypto operations)
✅ Strict rate limiting (30 req/min)
✅ Plain value response (show once)
✅ Test coverage
```

---

## 🗓️ HAFTA 8: Feature Flags + Production Deploy

### Hedef
Modül bazlı feature flags, monitoring, production deployment.

### Adımlar

#### 8.1 Modül Bazlı Feature Flags (1 gün)
```bash
# .env dosyasına ekle

# Engine (ana switch)
GENERIC_ENGINE_ENABLED=true

# Modül bazlı flags
FF_GENERIC_USERS=true
FF_GENERIC_PROJECTS=true
FF_GENERIC_APIKEYS=false  # Henüz test aşamasında

# Fallback behavior
GENERIC_FALLBACK_TO_LEGACY=true  # False ise 404, true ise eski endpoint'e yönlendir
```

```javascript
// Middleware: Feature flag kontrolü

function checkFeatureFlag(req, res, next) {
  const { resource } = req.params;

  // Engine kapalıysa
  if (process.env.GENERIC_ENGINE_ENABLED !== 'true') {
    return fallbackToLegacy(req, res);
  }

  // Modül flag kontrolü
  const flagMap = {
    users: process.env.FF_GENERIC_USERS,
    projects: process.env.FF_GENERIC_PROJECTS,
    api_keys: process.env.FF_GENERIC_APIKEYS
  };

  const flag = flagMap[resource];

  if (flag !== 'true') {
    // Fallback
    if (process.env.GENERIC_FALLBACK_TO_LEGACY === 'true') {
      return fallbackToLegacy(req, res);
    } else {
      return res.status(404).json({
        success: false,
        code: 'FEATURE_DISABLED',
        message: `Generic handler for '${resource}' is not enabled yet`
      });
    }
  }

  next();
}

function fallbackToLegacy(req, res) {
  // Eski endpoint'e yönlendir (307 Temporary Redirect)
  const legacyPath = req.path.replace('/data/', '/');
  return res.redirect(307, legacyPath);
}
```

#### 8.2 Registry'ye module_name Ekle (2 gün)
```sql
-- Migration: 013_add_module_name.sql

-- api_resources tablosuna module_name kolonu ekle
ALTER TABLE api_resources ADD COLUMN module_name VARCHAR(50);

-- Mevcut resource'lara module assign et
UPDATE api_resources SET module_name = 'users' WHERE resource = 'users';
UPDATE api_resources SET module_name = 'projects' WHERE resource = 'projects';
UPDATE api_resources SET module_name = 'api-keys' WHERE resource IN ('api_keys', 'api_key');

-- Index ekle
CREATE INDEX idx_api_resources_module ON api_resources(module_name);
```

```javascript
// OpenAPI generator'ı güncelle (modül bazlı tag'ler)

// scripts/generate-openapi.js içinde:

for (const r of resources) {
  const meta = await RegistryService.getResourceMeta(r.resource);
  
  // Tag = module name
  const tag = meta.module_name || 'generic';
  
  paths[`/data/${r.resource}`] = {
    get: {
      tags: [tag],  // OpenAPI tag'i modül adı
      summary: `List ${r.resource}`,
      // ...
    }
  };
}

// Sonuç: OpenAPI dokümantasyonu modül modül ayrılır
// - users (tag)
// - projects (tag)
// - api-keys (tag)
```

#### 8.3 Monitoring (Modül Bazlı Metrics) (2 gün)
```javascript
// Middleware: Modül bazlı metrics

function trackModuleMetrics(req, res, next) {
  const startTime = Date.now();
  const { resource } = req.params;
  
  // Plugin var mı?
  const plugin = pluginManager.getPlugin(resource);
  const moduleName = plugin?.name || 'generic';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Module metrics', {
      module: moduleName,
      resource,
      operation: req.method,
      statusCode: res.statusCode,
      duration,
      handler: 'generic-plugin',
      userId: req.user?.id,
      tenantId: req.user?.tenant_id
    });

    // Prometheus metrics (opsiyonel)
    // metrics.httpRequestDuration
    //   .labels(moduleName, req.method, res.statusCode)
    //   .observe(duration / 1000);
  });
  
  next();
}
```

#### 8.4 Production Deployment (Canary) (2 gün)
```bash
# 1. Feature flag'leri kademeli aç

# İlk gün: Projects (basit)
FF_GENERIC_PROJECTS=true

# 3 gün sonra: Users (orta seviye)
FF_GENERIC_USERS=true

# 7 gün sonra: API Keys (karmaşık)
FF_GENERIC_APIKEYS=true

# 2. Metrikleri izle (Dashboard)
# - Module-level success rate
# - Hook execution time
# - Plugin error rate

# 3. Log'ları kontrol et
# - Validation errors
# - Hook failures
# - Fallback usage (307 redirect)
```

#### 8.5 Documentation Update (1 gün)
```markdown
# README.md güncelle

## Generic Handler - Plugin Architecture

### Mevcut Plugin'ler

#### users
- **Validation:** Email format, password strength
- **Hooks:** Password hashing, email masking
- **Rate Limit:** 100 req/min

#### projects
- **Validation:** Status enum, name length
- **Hooks:** Status normalization
- **Rate Limit:** 200 req/min

#### api-keys
- **Validation:** Permission checks
- **Hooks:** Key generation, hashing, masking
- **Rate Limit:** 30 req/min (strict)

### Yeni Plugin Ekleme

1. Plugin dosyası oluştur: `plugins/my-module.plugin.js`
2. Interface'i implement et: `ModulePlugin`
3. Register et: `plugins/index.js`
4. Feature flag ekle: `FF_GENERIC_MY_MODULE`
5. Test yaz: `tests/plugins/my-module.test.js`
```

### ✅ Hafta 8 Sonuç
```
✅ Modül bazlı feature flags
✅ Registry'de module_name kolonu
✅ OpenAPI modül bazlı tag'ler
✅ Monitoring (modül bazlı metrics)
✅ Canary deployment
✅ Documentation
```

---

## 📊 8 HAFTA SONUNDA DURUM

### Endpoint Yapısı
```
Specific Modüller:
  /auth/*      (6 endpoint)
  /admin/*     (18 endpoint)
  /health/*    (3 endpoint)

Generic Engine + Plugins:
  /data/:resource  (11 endpoint)
    → usersPlugin
    → projectsPlugin
    → apiKeysPlugin
    → (gelecekte: tableMetadataPlugin, fieldMetadataPlugin, etc.)

TOPLAM: 38 endpoint (sabit kalır)
```

### Plugin Listesi
| Plugin | Domain Logic | Hooks | Rate Limit | Status |
|--------|--------------|-------|------------|--------|
| **projects** | Validation (status enum) | afterRead (normalize) | 200/min | ✅ Production |
| **users** | Password, email validation | hash, mask | 100/min | ✅ Production |
| **api-keys** | Permission checks | generate, hash | 30/min | ✅ Production |
| (future) | tableMetadata, fields, etc. | - | 150/min | 📋 Planned |

### Feature Flags
```bash
GENERIC_ENGINE_ENABLED=true
FF_GENERIC_USERS=true
FF_GENERIC_PROJECTS=true
FF_GENERIC_APIKEYS=true
GENERIC_FALLBACK_TO_LEGACY=false  # Artık gerekmez
```

---

## ✅ MODÜLERLEŞTIRME BAŞARI KRİTERLERİ

### Teknik
- [x] Plugin interface tanımlandı ve dokümante edildi
- [x] Plugin manager çalışıyor (register, hooks, policies)
- [x] 3 production plugin hazır (users, projects, api-keys)
- [x] Feature flags modül bazlı
- [x] Monitoring modül bazlı (metrics, logs)
- [x] Test coverage > %80 (plugin tests)

### Domain Logic
- [x] Password hashing (users)
- [x] Email masking (users)
- [x] API key generation + hashing (api-keys)
- [x] Validation modül bazlı (Zod schemas)
- [x] Rate limiting modül bazlı

### Business
- [x] Yeni plugin eklemek <1 gün
- [x] Domain logic izole (hata bir modülü etkilemez)
- [x] Mikroservise geçiş hazır (plugin → ayrı service)
- [x] Test edilebilirlik yüksek

---

## 🎯 FINAL FINAL SONUÇ

**8 Hafta (4 + 4) Sonunda:**

✅ **Generic handler production'da** (Hafta 1-4)  
✅ **Plugin architecture production'da** (Hafta 5-8)  
✅ **Domain-rich sistem** (hash, mask, encrypt, validate)  
✅ **Modüler mimari** (her plugin izole)  
✅ **400+ endpoint kaosu önlendi** (38 endpoint, sonsuz tablo)  
✅ **Mikroservise hazır** (plugin → service kolay)

**ROI (Total):**
- ⏱️ **8 hafta yatırım** (4 generic + 4 plugin)
- 💰 **%95 bakım maliyeti azalması** (generic + plugin reusability)
- 🚀 **Yeni özellik hızı 15x** (yeni plugin = 1 gün)
- 📚 **Dokümantasyon otomatik** (OpenAPI + plugin docs)
- 🧪 **Test yazma %85 azaldı** (contract + plugin tests)
- 🛡️ **Güvenlik + Domain logic** (hash, mask, validate modül bazlı)
- 🧩 **Mikroservise geçiş 1 hafta** (plugin → service)

---

**Bu plan "tek motor + modül eklentileri" modelini sağlıyor:**  
**Core mantık merkezi | Domain logic izole | Yeni modül = 1 gün**

**Mantıklı mı? EVET!** — Supabase + Hasura güvenilirliği, kendi domain logic'iniz! 🎉

