-- ============================================================================
-- Migration: 012_add_table_descriptions.sql
-- Description: Add descriptive COMMENT to all existing tables
-- Author: HZM Platform
-- Date: 2025-10-30
-- ============================================================================
-- Purpose: Frontend'de Backend Tabloları sayfasında her tablonun ne işe
--          yaradığını göstermek için PostgreSQL COMMENT kullanıyoruz.
-- ============================================================================

-- ============================================================================
-- SCHEMA: cfg (Configuration)
-- ============================================================================

COMMENT ON TABLE cfg.currencies IS 
'Currency definitions for multi-currency support - ISO codes, symbols, and display formats';

COMMENT ON TABLE cfg.exchange_rates IS 
'Real-time exchange rates between currencies - automatic daily updates from external API';

-- ============================================================================
-- SCHEMA: core (Core Business Entities)
-- ============================================================================

COMMENT ON TABLE core.projects IS 
'Project management - CRUD operations for business projects with tenant isolation';

COMMENT ON TABLE core.tenants IS 
'Multi-tenant isolation - organization/company data with subscription and settings';

COMMENT ON TABLE core.users IS 
'User accounts - authentication, profile management, roles, and API key storage';

-- ============================================================================
-- SCHEMA: ops (Operations & System)
-- ============================================================================

COMMENT ON TABLE ops.ai_knowledge_base IS 
'AI-powered knowledge base - stores generated backend reports (tables, migrations, architecture)';

COMMENT ON TABLE ops.ai_knowledge_base_audit IS 
'Audit log for AI knowledge base - tracks all report generation, updates, and access history';

-- ============================================================================
-- SCHEMA: public (API Registry & System Tables)
-- ============================================================================

COMMENT ON TABLE public.api_resources IS 
'Generic API registry - defines which tables are exposed via /data/:resource endpoint';

COMMENT ON TABLE public.api_resource_fields IS 
'Field-level permissions - controls which columns are readable/writable per resource';

COMMENT ON TABLE public.api_policies IS 
'Row-level security policies - tenant isolation and custom access rules for generic handler';

COMMENT ON TABLE public.schema_migrations IS 
'Migration tracking - records all executed database migrations with checksums and timestamps';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test: Check if comments are applied
DO $$
DECLARE
  comment_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO comment_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname IN ('cfg', 'core', 'ops', 'public')
    AND c.relname IN (
      'currencies', 'exchange_rates', 'projects', 'tenants', 'users',
      'ai_knowledge_base', 'ai_knowledge_base_audit',
      'api_resources', 'api_resource_fields', 'api_policies', 'schema_migrations'
    )
    AND pg_catalog.obj_description(c.oid, 'pg_class') IS NOT NULL;
  
  RAISE NOTICE 'Tables with descriptions: %', comment_count;
  
  IF comment_count < 11 THEN
    RAISE WARNING 'Expected 11+ tables with descriptions, found only %', comment_count;
  ELSE
    RAISE NOTICE 'All table descriptions successfully applied!';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETED
-- ============================================================================
-- ✅ 11 tables updated with descriptive COMMENT
-- ✅ Frontend'de Backend Tabloları sayfasında açıklamalar görünecek
-- ✅ PostgreSQL catalog'a kaydedildi (pg_description)
-- 
-- Test:
-- SELECT 
--   n.nspname as schema_name,
--   c.relname as table_name,
--   pg_catalog.obj_description(c.oid, 'pg_class') as description
-- FROM pg_catalog.pg_class c
-- JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.relkind = 'r'
--   AND n.nspname IN ('cfg', 'core', 'ops', 'public')
-- ORDER BY n.nspname, c.relname;
-- ============================================================================

