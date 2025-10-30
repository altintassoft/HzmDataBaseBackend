-- ============================================================================
-- GENERIC TABLE PATTERN - Kullanıcı Tabloları İçin Metadata
-- ============================================================================
-- Dosya: 012_create_table_metadata.sql
-- Oluşturulma: 30 Ekim 2025
-- Amaç: Kullanıcıların custom tabloları için metadata (FIZIKSEL TABLO YOK!)
-- Durum: Pasif mod - Kullanılmaya başlanmadı (ileriki fazlarda)
-- ============================================================================
-- NOT: Bu, api_resources (CORE tablolar) ile AYRI bir sistem!
--      api_resources    → users, projects, tenants (GERÇEK TABLOLAR)
--      table_metadata   → Orders, Products, Customers (JSONB'de saklanır)
-- ============================================================================

-- ============================================================================
-- 1. TABLE METADATA - Kullanıcı Tablolarının Yapısı
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.table_metadata (
  id SERIAL PRIMARY KEY,
  
  -- Ownership
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
  
  -- Table Info (kullanıcı tarafından görülen)
  table_name VARCHAR(100) NOT NULL,  -- "Orders", "Products", "Customers"
  description TEXT,
  icon VARCHAR(50),  -- UI için icon
  
  -- Schema (JSONB - sütun tanımları)
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Örnek: [
  --   {"name": "OrderID", "type": "integer", "required": true},
  --   {"name": "CustomerName", "type": "text", "required": true},
  --   {"name": "TotalPrice", "type": "numeric", "required": false}
  -- ]
  
  -- Template Info (eğer template'ten geliyorsa)
  from_template BOOLEAN DEFAULT false,
  template_name VARCHAR(100),  -- 'ecommerce', 'crm', 'mlm'
  template_table_name VARCHAR(100),  -- 'products', 'orders', 'customers'
  
  -- Settings (JSONB)
  settings JSONB DEFAULT '{}'::jsonb,
  -- Örnek: {"allowExport": true, "rowLimit": 10000, "cacheEnabled": false}
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  
  -- Audit
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER,
  
  -- Constraints
  CONSTRAINT unique_table_per_project UNIQUE (tenant_id, project_id, table_name),
  CONSTRAINT valid_table_name CHECK (table_name ~ '^[A-Za-z][A-Za-z0-9_]*$')
);

-- ============================================================================
-- 2. GENERIC DATA - Tüm Kullanıcı Verisi (JSONB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.generic_data (
  id BIGSERIAL PRIMARY KEY,
  
  -- Ownership (HER SATIR İÇİN)
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES core.table_metadata(id) ON DELETE CASCADE,
  
  -- Asıl Veri (JSONB)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Örnek: {"OrderID": 1, "CustomerName": "Ali Yılmaz", "TotalPrice": 150.50}
  
  -- Search Optimization (full-text search için)
  search_text TEXT GENERATED ALWAYS AS (
    jsonb_to_tsvector('turkish', data, '["string"]')::text
  ) STORED,
  
  -- Status
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  
  -- Audit
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER,
  
  -- Composite index for fast lookups
  CONSTRAINT unique_row_per_table UNIQUE (tenant_id, project_id, table_id, id)
);

-- ============================================================================
-- 3. INDEXES - Performance
-- ============================================================================

-- table_metadata indexes
CREATE INDEX idx_table_metadata_tenant ON core.table_metadata(tenant_id);
CREATE INDEX idx_table_metadata_project ON core.table_metadata(project_id);
CREATE INDEX idx_table_metadata_active ON core.table_metadata(project_id) 
  WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_table_metadata_template ON core.table_metadata(template_name) 
  WHERE from_template = TRUE;

-- generic_data indexes
CREATE INDEX idx_generic_data_tenant ON app.generic_data(tenant_id);
CREATE INDEX idx_generic_data_project_table ON app.generic_data(project_id, table_id) 
  WHERE is_deleted = FALSE;
CREATE INDEX idx_generic_data_table ON app.generic_data(table_id) 
  WHERE is_deleted = FALSE;
CREATE INDEX idx_generic_data_created ON app.generic_data(created_at);

-- JSONB indexes (for fast filtering)
CREATE INDEX idx_generic_data_jsonb ON app.generic_data USING gin(data jsonb_path_ops);

-- Full-text search index
CREATE INDEX idx_generic_data_search ON app.generic_data USING gin(to_tsvector('turkish', search_text));

-- ============================================================================
-- 4. TRIGGERS - Updated_at otomatik güncelleme
-- ============================================================================

-- table_metadata için
CREATE TRIGGER trg_table_metadata_updated_at
  BEFORE UPDATE ON core.table_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- generic_data için
CREATE TRIGGER trg_generic_data_updated_at
  BEFORE UPDATE ON app.generic_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - Tenant İzolasyonu
-- ============================================================================

-- table_metadata için RLS
ALTER TABLE core.table_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_table_metadata_tenant ON core.table_metadata
  USING (tenant_id = current_setting('app.tenant_id', true)::integer);

-- generic_data için RLS
ALTER TABLE app.generic_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_generic_data_tenant ON app.generic_data
  USING (tenant_id = current_setting('app.tenant_id', true)::integer);

-- ============================================================================
-- 6. HELPER FUNCTIONS - Metadata ve Veri Okuma
-- ============================================================================

-- Bir tablonun metadata'sını getir
CREATE OR REPLACE FUNCTION get_table_metadata(p_table_id INTEGER)
RETURNS TABLE(
  table_id INTEGER,
  table_name VARCHAR,
  description TEXT,
  fields JSONB,
  from_template BOOLEAN,
  template_name VARCHAR,
  settings JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.table_name,
    tm.description,
    tm.fields,
    tm.from_template,
    tm.template_name,
    tm.settings,
    tm.created_at
  FROM core.table_metadata tm
  WHERE tm.id = p_table_id
    AND tm.is_active = true
    AND tm.is_deleted = false;
END;
$$ LANGUAGE plpgsql;

-- Bir tablodaki tüm satırları getir (JSONB)
CREATE OR REPLACE FUNCTION get_table_rows(
  p_table_id INTEGER,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  row_id BIGINT,
  data JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gd.id,
    gd.data,
    gd.created_at,
    gd.updated_at
  FROM app.generic_data gd
  WHERE gd.table_id = p_table_id
    AND gd.is_deleted = false
  ORDER BY gd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Toplam satır sayısı
CREATE OR REPLACE FUNCTION count_table_rows(p_table_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO row_count
  FROM app.generic_data
  WHERE table_id = p_table_id
    AND is_deleted = false;
  
  RETURN row_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. COMMENTS - Dokümantasyon
-- ============================================================================

COMMENT ON TABLE core.table_metadata IS 
'Metadata for user-created custom tables - NO physical tables created!';

COMMENT ON TABLE app.generic_data IS 
'All user data stored as JSONB - single table for infinite user tables';

COMMENT ON COLUMN core.table_metadata.fields IS 
'JSONB array of column definitions: [{"name": "OrderID", "type": "integer", "required": true}, ...]';

COMMENT ON COLUMN app.generic_data.data IS 
'Actual row data as JSONB: {"OrderID": 1, "CustomerName": "Ali", "TotalPrice": 150.50}';

COMMENT ON FUNCTION get_table_metadata IS 
'Get metadata for a user table by table_id';

COMMENT ON FUNCTION get_table_rows IS 
'Get all rows from a user table (JSONB data)';

COMMENT ON FUNCTION count_table_rows IS 
'Count total rows in a user table';

-- ============================================================================
-- 8. SEED DATA - Örnek Template Metadata (Opsiyonel)
-- ============================================================================

-- E-commerce template için örnek tablo metadata'sı (pasif)
-- Gerçek kullanım başladığında aktif edilecek

/*
INSERT INTO core.table_metadata (
  tenant_id, 
  project_id, 
  table_name, 
  description, 
  fields, 
  from_template, 
  template_name,
  is_active
) VALUES (
  1,  -- Örnek tenant_id
  1,  -- Örnek project_id
  'Products',
  'E-commerce products catalog',
  '[
    {"name": "ProductID", "type": "integer", "required": true, "primary": true},
    {"name": "ProductName", "type": "text", "required": true},
    {"name": "Price", "type": "numeric", "required": true},
    {"name": "Stock", "type": "integer", "required": false, "default": 0},
    {"name": "Category", "type": "text", "required": false}
  ]'::jsonb,
  true,
  'ecommerce',
  false  -- Henüz aktif değil
);
*/

-- ============================================================================
-- MIGRATION TAMAMLANDI
-- ============================================================================
-- ✅ 2 tablo oluşturuldu: table_metadata, generic_data
-- ✅ JSONB ile sonsuz kullanıcı tablosu desteği
-- ✅ RLS ile tenant izolasyonu
-- ✅ Helper functions (get_table_metadata, get_table_rows, count_table_rows)
-- ✅ Indexes (performance optimization)
-- ✅ Full-text search desteği
-- 
-- NOT: Bu migration şu anda PASİF!
-- Kullanıcı tabloları özelliği Roadmap Phase 2-5'te aktif edilecek.
-- Şimdilik sadece yapı hazır, kullanılmaya başlanmadı.
-- 
-- Generic Handler (api_resources) ile KARISTIRILMAMALI:
-- - api_resources    → CORE tablolar (users, projects) - GERÇEK TABLOLAR
-- - table_metadata   → KULLANICI tabloları (Orders, Products) - JSONB
-- ============================================================================

