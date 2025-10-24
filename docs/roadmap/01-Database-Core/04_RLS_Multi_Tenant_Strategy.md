# 🔒 RLS Multi-Tenant Strategy

> **PostgreSQL Row Level Security ile %100 güvenli multi-tenancy**

[◀️ Geri: i18n Tables](03_i18n_Tables.md) | [Ana Sayfa](README.md) | [İleri: Template System ▶️](05_Template_System.md)

---

## 📋 İçindekiler

1. [Neden RLS?](#neden-rls)
2. [RLS Nasıl Çalışır?](#rls-nasıl-çalışır)
3. [Node.js Implementation](#nodejs-implementation)
4. [RLS Policies](#rls-policies)
5. [Application-Level vs RLS](#application-level-vs-rls)
6. [Best Practices](#best-practices)

---

## Neden RLS?

### 🔥 RLS Kullanmamızın 5 Kritik Nedeni

#### 1. **Unutulması İmkansız**
```javascript
// ❌ Application-Level: Developer unutabilir!
SELECT * FROM products;  // WHERE tenant_id = $1 unutuldu → TEHLİKE!

// ✅ RLS: Otomatik çalışır, unutulamaz!
SELECT * FROM products;  // RLS otomatik tenant_id = X ekler
```

#### 2. **Database-Level Güvenlik**
```sql
-- RLS aktif olduğunda, SQL injection bile işe yaramaz!
SELECT * FROM products WHERE id = 1 OR 1=1;
-- RLS: "...AND tenant_id = 123" otomatik eklenir
```

#### 3. **%100 Garantili İzolasyon**
```javascript
// Developer kodu:
const query = 'SELECT * FROM orders';

// PostgreSQL çalıştırır:
'SELECT * FROM orders WHERE tenant_id = 123'  // Otomatik!
```

#### 4. **Performans**
- PostgreSQL optimize eder
- Index otomatik kullanılır
- Query planner akıllıca çalışır

#### 5. **Platform Admin Desteği**
```sql
-- Normal user: Sadece kendi tenant'ı
-- Platform admin: Tüm tenant'lar
CREATE POLICY rls_admin ON table
  USING (EXISTS (
    SELECT 1 FROM core.users 
    WHERE id = app.current_user_id() AND role = 'platform_admin'
  ));
```

---

## RLS Nasıl Çalışır?

### 1. Context Helper Functions

```sql
-- app.set_context() - Her request başında çağrılır
CREATE OR REPLACE FUNCTION app.set_context(p_tenant_id int, p_user_id int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.tenant_id', COALESCE(p_tenant_id::text, ''), true);
  PERFORM set_config('app.user_id',   COALESCE(p_user_id::text, ''), true);
END$$;

-- app.current_tenant() - RLS policy'lerde kullanılır
CREATE OR REPLACE FUNCTION app.current_tenant() 
RETURNS int LANGUAGE sql STABLE AS $$ 
  SELECT nullif(current_setting('app.tenant_id', true), '')::int 
$$;

-- app.current_user_id() - Audit logs için
CREATE OR REPLACE FUNCTION app.current_user_id() 
RETURNS int LANGUAGE sql STABLE AS $$ 
  SELECT nullif(current_setting('app.user_id', true), '')::int 
$$;
```

### 2. Enable RLS on Table

```sql
-- Her multi-tenant tabloda RLS aktif edilmeli
ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.table_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.api_keys ENABLE ROW LEVEL SECURITY;
-- ... diğer tablolar
```

### 3. Create RLS Policies

```sql
-- Tenant policy (herkes için)
CREATE POLICY rls_projects_tenant ON core.projects
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

-- Platform admin policy (opsiyonel)
CREATE POLICY rls_projects_admin ON core.projects
  USING (
    EXISTS (
      SELECT 1 FROM core.users 
      WHERE id = app.current_user_id() AND role = 'platform_admin'
    )
  );
```

### 4. Query Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. Client Request                                      │
│     GET /api/v1/projects                                 │
│     Authorization: Bearer <jwt_token>                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  2. Middleware: setTenantContext()                       │
│     - JWT decode → user_id = 123                        │
│     - Query: SELECT tenant_id FROM users WHERE id = 123 │
│     - Result: tenant_id = 10                            │
│     - Execute: SELECT app.set_context(10, 123)          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  3. Application Query                                    │
│     SELECT * FROM core.projects                          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  4. PostgreSQL RLS                                       │
│     SELECT * FROM core.projects                          │
│     WHERE tenant_id = app.current_tenant()  -- 10       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  5. Result: Sadece tenant_id = 10 olan projeler         │
└─────────────────────────────────────────────────────────┘
```

---

## Node.js Implementation

### Middleware: Set Tenant Context

```javascript
// middleware/tenantContext.js
const pool = require('../config/database');

async function setTenantContext(req, res, next) {
  try {
    // JWT'den user bilgisi al (authenticate middleware'den)
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // User'ın tenant_id'sini al
    const result = await pool.query(
      'SELECT tenant_id FROM core.users WHERE id = $1 AND is_active = true AND is_deleted = false',
      [user.id]
    );
    
    if (!result.rows[0]) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }
    
    const tenantId = result.rows[0].tenant_id;
    
    // PostgreSQL GUC'ye set et (RLS için)
    await pool.query('SELECT app.set_context($1, $2)', [tenantId, user.id]);
    
    // Request objesine ekle (logging için)
    req.tenant_id = tenantId;
    req.user_id = user.id;
    
    next();
  } catch (error) {
    console.error('setTenantContext error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { setTenantContext };
```

### Transaction Wrapper

```javascript
// utils/database.js
const pool = require('../config/database');

/**
 * Her request için transaction wrapper
 * RLS context'i set eder ve transaction içinde çalışır
 */
async function withTenantContext(tenantId, userId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Context set et (RLS için kritik!)
    await client.query('SELECT app.set_context($1, $2)', [tenantId, userId]);
    
    // Callback çalıştır
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { withTenantContext };
```

### Route Kullanımı

```javascript
// routes/projects.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { setTenantContext } = require('../middleware/tenantContext');
const { withTenantContext } = require('../utils/database');

// GET /api/v1/projects
router.get('/projects', authenticate, setTenantContext, async (req, res) => {
  try {
    await withTenantContext(req.tenant_id, req.user_id, async (client) => {
      // RLS otomatik çalışır, WHERE tenant_id = ... eklemeye gerek YOK!
      const result = await client.query('SELECT * FROM core.projects WHERE is_deleted = false');
      
      res.json({ 
        success: true, 
        data: result.rows 
      });
    });
  } catch (error) {
    console.error('GET /projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/v1/projects
router.post('/projects', authenticate, setTenantContext, async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await withTenantContext(req.tenant_id, req.user_id, async (client) => {
      // tenant_id otomatik set edilir (RLS WITH CHECK)
      const result = await client.query(`
        INSERT INTO core.projects (tenant_id, user_id, name, description, api_key)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [req.tenant_id, req.user_id, name, description, generateApiKey()]);
      
      res.json({ 
        success: true, 
        data: result.rows[0] 
      });
    });
  } catch (error) {
    console.error('POST /projects error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

module.exports = router;
```

---

## RLS Policies

### Standard Tenant Policy

```sql
-- Her tabloda aynı pattern
ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_{table}_tenant ON {schema}.{table}
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());
```

### Platform Admin Policy

```sql
-- Platform admin'ler tüm tenant'ları görebilir
CREATE POLICY rls_{table}_admin ON {schema}.{table}
  USING (
    EXISTS (
      SELECT 1 FROM core.users 
      WHERE id = app.current_user_id() AND role = 'platform_admin'
    )
  );
```

### User-Specific Policy

```sql
-- Sadece kendi verilerine erişim (örn: user_sessions)
CREATE POLICY rls_sessions_owner ON core.user_sessions
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
```

### Complex Policy (Tenant + Owner)

```sql
-- Tenant içinde sadece kendi kayıtlarını görebilir
CREATE POLICY rls_projects_owner ON core.projects
  USING (
    tenant_id = app.current_tenant() 
    AND user_id = app.current_user_id()
  )
  WITH CHECK (
    tenant_id = app.current_tenant()
    AND user_id = app.current_user_id()
  );
```

### Disable RLS for Superuser

```sql
-- Superuser (postgres) RLS'den muaf
ALTER TABLE core.projects FORCE ROW LEVEL SECURITY;  -- Force for superuser too
```

---

## Application-Level vs RLS

### Karşılaştırma Tablosu

| Özellik | Application-Level | RLS (PostgreSQL) |
|---------|-------------------|------------------|
| **Güvenlik** | ⚠️ Developer'a bağlı | ✅ Database garantisi |
| **Unutulabilir mi?** | ❌ Evet, her query'de WHERE eklemeli | ✅ Hayır (imkansız!) |
| **Performans** | ✅ İyi | ✅ Excellent (PostgreSQL optimize eder) |
| **Kod karmaşıklığı** | ⚠️ Her query'de WHERE tenant_id = $1 | ✅ Otomatik, kod temiz |
| **Testing** | ✅ Kolay (unit tests basit) | ⚠️ Biraz complex (context mock gerekli) |
| **Migration** | ✅ Basit (sadece query değişir) | ⚠️ RLS setup gerekli |
| **SQL Injection** | ⚠️ Risk var | ✅ Ekstra koruma |
| **Platform Admin** | ⚠️ Manuel if/else | ✅ Policy ile otomatik |
| **Debug** | ✅ Kolay (WHERE görülür) | ⚠️ Policy'leri bilmek gerekli |
| **Connection Pool** | ✅ Sorun yok | ⚠️ Context her connection'da set edilmeli |

### Application-Level Örnek (RLS Olmadan)

```javascript
// ❌ Her query'de manuel tenant_id kontrolü
const projects = await pool.query(
  'SELECT * FROM projects WHERE tenant_id = $1',
  [req.tenant_id]
);

// ❌ Developer unutursa →  TEHLİKE!
const allProjects = await pool.query('SELECT * FROM projects');  // Tüm tenant'lar!

// ❌ Complex joins'de unutma riski
const data = await pool.query(`
  SELECT p.*, t.* 
  FROM projects p 
  JOIN tables t ON p.id = t.project_id
  WHERE p.tenant_id = $1  -- ✅ Var
  -- t.tenant_id = $1  ❌ Unutuldu!
`, [req.tenant_id]);
```

### RLS Örnek (PostgreSQL)

```javascript
// ✅ Tenant_id otomatik eklenir
const projects = await pool.query('SELECT * FROM projects');
// PostgreSQL: SELECT * FROM projects WHERE tenant_id = 10

// ✅ JOIN'lerde bile otomatik
const data = await pool.query(`
  SELECT p.*, t.* 
  FROM projects p 
  JOIN tables t ON p.id = t.project_id
`);
// PostgreSQL: 
// SELECT p.*, t.* 
// FROM projects p 
// JOIN tables t ON p.id = t.project_id
// WHERE p.tenant_id = 10 AND t.tenant_id = 10  -- Otomatik!
```

---

## Best Practices

### ✅ DO

1. **Her request başında context set et**
   ```javascript
   app.use(authenticate);
   app.use(setTenantContext);  // Her route'tan önce
   ```

2. **Transaction kullan**
   ```javascript
   await withTenantContext(tenantId, userId, async (client) => {
     // Queries here
   });
   ```

3. **Her multi-tenant tabloda RLS aktif et**
   ```sql
   ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
   ```

4. **Standard policy pattern kullan**
   ```sql
   CREATE POLICY rls_{table}_tenant ON {table}
     USING (tenant_id = app.current_tenant());
   ```

5. **Platform admin policy ekle (ihtiyaç varsa)**
   ```sql
   CREATE POLICY rls_{table}_admin ON {table}
     USING (EXISTS (...role = 'platform_admin'));
   ```

### ❌ DON'T

1. **Context set etmeden query çalıştırma**
   ```javascript
   // ❌ YANLIŞ
   const result = await pool.query('SELECT * FROM projects');
   // Context set edilmemiş → app.current_tenant() NULL döner
   ```

2. **Connection pool'da context paylaşma**
   ```javascript
   // ❌ YANLIŞ
   await pool.query('SELECT app.set_context($1, $2)', [tenantId, userId]);
   // Başka request bu connection'ı alabilir!
   
   // ✅ DOĞRU
   const client = await pool.connect();
   await client.query('SELECT app.set_context($1, $2)', [tenantId, userId]);
   ```

3. **RLS'yi disable etme (superuser dışında)**
   ```sql
   -- ❌ YANLIŞ
   ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
   ```

4. **RLS policy'siz tablo bırakma**
   ```sql
   -- ❌ YANLIŞ
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   -- Policy yok → Kimse erişemez!
   
   -- ✅ DOĞRU
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY rls_projects_tenant ON projects ...;
   ```

---

## Testing RLS

### Unit Test Example

```javascript
// tests/rls.test.js
const { pool, withTenantContext } = require('../config/database');

describe('RLS Multi-Tenancy', () => {
  it('should isolate tenants', async () => {
    // Tenant 1: Insert project
    await withTenantContext(1, 1, async (client) => {
      await client.query(`
        INSERT INTO core.projects (tenant_id, user_id, name) 
        VALUES (1, 1, 'Project A')
      `);
    });
    
    // Tenant 2: Insert project
    await withTenantContext(2, 2, async (client) => {
      await client.query(`
        INSERT INTO core.projects (tenant_id, user_id, name) 
        VALUES (2, 2, 'Project B')
      `);
    });
    
    // Tenant 1: Should only see Project A
    await withTenantContext(1, 1, async (client) => {
      const result = await client.query('SELECT * FROM core.projects');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Project A');
    });
    
    // Tenant 2: Should only see Project B
    await withTenantContext(2, 2, async (client) => {
      const result = await client.query('SELECT * FROM core.projects');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Project B');
    });
  });
});
```

---

## 🔗 İlgili Dökümanlar

- [01_PostgreSQL_Setup.md](01_PostgreSQL_Setup.md) - Context helper functions
- [02_Core_Database_Schema.md](02_Core_Database_Schema.md) - RLS enabled tables
- [12_Table_Template.md](12_Table_Template.md) - Standard RLS policy template

---

**[◀️ Geri: i18n Tables](03_i18n_Tables.md) | [Ana Sayfa](README.md) | [İleri: Template System ▶️](05_Template_System.md)**

