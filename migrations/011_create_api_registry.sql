-- ============================================================================
-- API REGISTRY SYSTEM - Generic Handler İçin Metadata Katmanı
-- ============================================================================
-- Dosya: 011_create_api_registry.sql
-- Oluşturulma: 30 Ekim 2025
-- Amaç: Generic handler için resource metadata'sını saklar
-- Durum: Pasif mod (is_enabled=false) - Production güvenli
-- ============================================================================

-- 1. Hangi tablolar API'de yayınlanacak?
CREATE TABLE IF NOT EXISTS api_resources (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) UNIQUE NOT NULL,  -- 'users', 'projects', 'tables'
  schema_name VARCHAR(50) NOT NULL DEFAULT 'public',
  table_name VARCHAR(100) NOT NULL,
  
  -- Kontrol
  is_enabled BOOLEAN NOT NULL DEFAULT false,  -- Başlangıçta kapalı!
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

-- 4. Index'ler (Performance)
CREATE INDEX IF NOT EXISTS idx_api_resources_enabled ON api_resources(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_api_resource_fields_resource ON api_resource_fields(resource);
CREATE INDEX IF NOT EXISTS idx_api_resource_fields_readable ON api_resource_fields(resource, readable) WHERE readable = true;
CREATE INDEX IF NOT EXISTS idx_api_resource_fields_writable ON api_resource_fields(resource, writable) WHERE writable = true;
CREATE INDEX IF NOT EXISTS idx_api_policies_resource ON api_policies(resource);
CREATE INDEX IF NOT EXISTS idx_api_policies_enabled ON api_policies(resource, is_enabled) WHERE is_enabled = true;

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
-- NOT: is_enabled=false olduğu için hiçbir şeyi etkilemez!

-- Users tablosu
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('users', 'public', 'users', 'User management - authentication, profile, settings', false)
ON CONFLICT (resource) DO NOTHING;

-- Users fields (sadece readable olanlar)
INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('users', 'id', true, false, false, 'integer', 'User ID'),
('users', 'email', true, true, true, 'text', 'Email address'),
('users', 'first_name', true, true, false, 'text', 'First name'),
('users', 'last_name', true, true, false, 'text', 'Last name'),
('users', 'role', true, false, false, 'text', 'User role'),
('users', 'is_active', true, false, false, 'boolean', 'Account status'),
('users', 'created_at', true, false, false, 'timestamp', 'Account creation date'),
('users', 'updated_at', true, false, false, 'timestamp', 'Last update date')
ON CONFLICT (resource, column_name) DO NOTHING;
-- NOT: password_hash, api_key gibi hassas alanlar EXCLUDED (readable=false, writable=false)

-- Projects tablosu
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('projects', 'public', 'projects', 'Project management - CRUD operations', false)
ON CONFLICT (resource) DO NOTHING;

INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('projects', 'id', true, false, false, 'integer', 'Project ID'),
('projects', 'tenant_id', true, false, true, 'integer', 'Tenant ID (auto-set)'),
('projects', 'name', true, true, true, 'text', 'Project name'),
('projects', 'description', true, true, false, 'text', 'Project description'),
('projects', 'status', true, true, false, 'text', 'Project status'),
('projects', 'settings', true, true, false, 'json', 'Project settings'),
('projects', 'created_at', true, false, false, 'timestamp', 'Creation date'),
('projects', 'updated_at', true, false, false, 'timestamp', 'Last update date')
ON CONFLICT (resource, column_name) DO NOTHING;

-- RLS Policy örneği (tenant isolation)
INSERT INTO api_policies (resource, policy_name, predicate_sql, applies_to_roles, applies_to_operations) VALUES
('users', 'tenant_isolation', 'tenant_id = $tenant_id', ARRAY['user', 'admin'], ARRAY['SELECT', 'UPDATE', 'DELETE']),
('projects', 'tenant_isolation', 'tenant_id = $tenant_id', ARRAY['user', 'admin'], ARRAY['SELECT', 'UPDATE', 'DELETE'])
ON CONFLICT (resource, policy_name) DO NOTHING;

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

-- ============================================================================
-- COMMENTS - Dokümantasyon
-- ============================================================================

COMMENT ON TABLE api_resources IS 'Registry of API-exposed resources (tables)';
COMMENT ON TABLE api_resource_fields IS 'Field-level permissions and validation rules';
COMMENT ON TABLE api_policies IS 'Row-level security policies for generic handler';
COMMENT ON FUNCTION get_resource_metadata IS 'Get full metadata for a resource (helper for generic handler)';

-- ============================================================================
-- TABLE DESCRIPTIONS - Tüm Mevcut Tablolar
-- ============================================================================
-- Frontend'de Backend Tabloları sayfasında açıklamalar görünsün diye

-- cfg schema
COMMENT ON TABLE cfg.currencies IS 'Currency definitions for multi-currency support - ISO codes, symbols, and display formats';
COMMENT ON TABLE cfg.exchange_rates IS 'Real-time exchange rates between currencies - automatic daily updates from external API';

-- core schema
COMMENT ON TABLE core.projects IS 'Project management - CRUD operations for business projects with tenant isolation';
COMMENT ON TABLE core.tenants IS 'Multi-tenant isolation - organization/company data with subscription and settings';
COMMENT ON TABLE core.users IS 'User accounts - authentication, profile management, roles, and API key storage';

-- ops schema
COMMENT ON TABLE ops.ai_knowledge_base IS 'AI-powered knowledge base - stores generated backend reports (tables, migrations, architecture)';
COMMENT ON TABLE ops.ai_knowledge_base_audit IS 'Audit log for AI knowledge base - tracks all report generation, updates, and access history';

-- public schema
COMMENT ON TABLE public.schema_migrations IS 'Migration tracking - records all executed database migrations with checksums and timestamps';

-- ============================================================================
-- MIGRATION TAMAMLANDI
-- ============================================================================
-- ✅ 3 tablo oluşturuldu: api_resources, api_resource_fields, api_policies
-- ✅ Seed data eklendi: users, projects (is_enabled=false)
-- ✅ Helper function oluşturuldu: get_resource_metadata()
-- ✅ Production güvenli: is_enabled=false → hiçbir şeyi etkilemez
-- 
-- Sonraki adım: RegistryService oluştur (Node.js)
-- ============================================================================

