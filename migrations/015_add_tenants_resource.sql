-- Migration 015: Add Tenants Resource (HAFTA 4 - Scale Up)
-- Purpose: Add tenants resource to generic handler and enable it
-- Rollback: DELETE FROM api_resources WHERE resource = 'tenants';
-- Date: 30 Ekim 2025
-- Status: Week 4 - Scale Up

-- ============================================================================
-- STEP 1: Add Tenants Resource
-- ============================================================================

-- Insert tenants resource (ENABLED from start)
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('tenants', 'core', 'tenants', 'Multi-tenant management - organization/company CRUD operations', true)
ON CONFLICT (resource) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: Add Tenants Fields (Real columns from core.tenants table)
-- ============================================================================

INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
-- Primary Key
('tenants', 'id', true, false, false, 'integer', 'Tenant ID (auto-generated)'),

-- Basic Info
('tenants', 'name', true, true, true, 'text', 'Tenant name (organization/company name)'),
('tenants', 'slug', true, true, true, 'text', 'URL-friendly identifier (unique)'),
('tenants', 'domain', true, true, false, 'text', 'Custom domain (optional, unique)'),

-- Localization
('tenants', 'default_language', true, true, false, 'text', 'Default language code (e.g., en, tr)'),
('tenants', 'default_currency', true, true, false, 'text', 'Default currency code (e.g., USD, TRY)'),

-- Subscription
('tenants', 'plan', true, true, false, 'text', 'Subscription plan (free, basic, premium, enterprise)'),

-- Status
('tenants', 'is_active', true, true, false, 'boolean', 'Tenant active status'),
('tenants', 'is_deleted', true, false, false, 'boolean', 'Soft delete flag'),
('tenants', 'deleted_at', true, false, false, 'timestamp', 'Deletion timestamp'),

-- Audit
('tenants', 'version', true, false, false, 'integer', 'Optimistic locking version'),
('tenants', 'created_at', true, false, false, 'timestamp', 'Tenant creation timestamp'),
('tenants', 'updated_at', true, false, false, 'timestamp', 'Last update timestamp')
ON CONFLICT (resource, column_name) DO NOTHING;

-- ============================================================================
-- STEP 3: Add Tenants RLS Policy
-- ============================================================================

-- RLS Policy for tenants (master_admin only - no tenant_id filtering for tenants table itself)
INSERT INTO api_policies (resource, policy_name, predicate_sql, applies_to_roles, applies_to_operations) VALUES
('tenants', 'master_admin_only', '1=1', ARRAY['master_admin'], ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
ON CONFLICT (resource, policy_name) DO NOTHING;

-- ============================================================================
-- STEP 4: Verify Changes
-- ============================================================================

-- Check if tenants resource is created
DO $$
DECLARE
  v_enabled BOOLEAN;
  v_field_count INTEGER;
BEGIN
  -- Check resource
  SELECT is_enabled INTO v_enabled
  FROM api_resources
  WHERE resource = 'tenants';
  
  IF v_enabled = true THEN
    RAISE NOTICE 'SUCCESS: Tenants resource is ENABLED';
  ELSE
    RAISE EXCEPTION 'FAILED: Tenants resource is DISABLED or not found';
  END IF;
  
  -- Check fields
  SELECT COUNT(*) INTO v_field_count
  FROM api_resource_fields
  WHERE resource = 'tenants';
  
  RAISE NOTICE 'INFO: Tenants has % fields configured', v_field_count;
END $$;

-- ============================================================================
-- STEP 5: Display Current Status
-- ============================================================================

-- Show all resources status
SELECT 
  resource,
  schema_name,
  table_name,
  is_enabled,
  is_readonly,
  description
FROM api_resources
ORDER BY resource;

-- Show tenants fields
SELECT 
  column_name,
  readable,
  writable,
  required,
  data_type,
  description
FROM api_resource_fields
WHERE resource = 'tenants'
ORDER BY 
  CASE 
    WHEN column_name = 'id' THEN 1
    WHEN column_name LIKE '%_id' THEN 2
    WHEN column_name LIKE '%_at' THEN 99
    ELSE 50
  END,
  column_name;

-- ============================================================================
-- ROLLBACK PLAN (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DELETE FROM api_resource_fields WHERE resource = 'tenants';
-- DELETE FROM api_policies WHERE resource = 'tenants';
-- DELETE FROM api_resources WHERE resource = 'tenants';
-- UPDATE schema_migrations SET executed_at = NULL WHERE migration_name = '015_add_tenants_resource';

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration adds tenants resource to generic handler (Week 4).
-- The resource will now respond to:
--   - GET    /api/v1/data/tenants
--   - GET    /api/v1/data/tenants/:id
--   - POST   /api/v1/data/tenants
--   - PUT    /api/v1/data/tenants/:id
--   - DELETE /api/v1/data/tenants/:id
--   - GET    /api/v1/data/tenants/count
--
-- Security: Only master_admin role can access tenants (no tenant_id filtering).
-- This is a SAFE migration - easily rollbackable.
--

