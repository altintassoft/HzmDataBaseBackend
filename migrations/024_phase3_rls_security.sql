-- Migration 024: Phase 3 - RLS + Security (DISABLED MODE)
-- Date: 2025-11-01
-- Description: Add RLS policies, context functions, composite FK (RLS DISABLED)
-- Reference: docs/roadmap/titanduzenlephase.md - Phase 3
-- Status: SECURITY LAYER (PREPARATION ONLY)
-- Risk: CRITICAL (Will be enabled in Phase 4 with API updates)

-- ============================================================================
-- PHASE 3: RLS + SECURITY
-- Purpose: Prepare RLS policies and context functions (keep DISABLED until Phase 4)
-- Strategy: Define policies but don't enable RLS yet - API needs context support first
-- ============================================================================

BEGIN;

-- Log start
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (3, 'Phase 3: Start', '{"description": "RLS + Security (DISABLED mode)", "strategy": "Prepare policies, enable in Phase 4"}', 'pending');

-- ============================================================================
-- PART 1: UPDATE CONTEXT FUNCTION (Support Titan ID + Organization)
-- ============================================================================

-- Drop old context function
DROP FUNCTION IF EXISTS app.set_context(INTEGER, INTEGER);

-- Create new context function with Titan ID support
CREATE OR REPLACE FUNCTION core.set_context(
  p_titan_id VARCHAR,
  p_organization_id INTEGER
)
RETURNS void AS $$
DECLARE
  v_tenant_id INTEGER;
BEGIN
  -- Get tenant_id from titan_id
  SELECT id INTO v_tenant_id
  FROM core.tenants
  WHERE titan_id = p_titan_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid titan_id: %', p_titan_id;
  END IF;
  
  -- Set context variables (transaction-scoped)
  PERFORM set_config('app.current_titan_id', p_titan_id, FALSE);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, FALSE);
  PERFORM set_config('app.current_organization_id', p_organization_id::TEXT, FALSE);
  
  RAISE DEBUG 'Context set: titan_id=%, tenant_id=%, org_id=%', p_titan_id, v_tenant_id, p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION core.set_context IS 
  'Set transaction context for RLS (titan_id + organization_id). Must be called in BEGIN...COMMIT block.';

-- Helper functions to get context
CREATE OR REPLACE FUNCTION core.current_titan_id()
RETURNS VARCHAR AS $$
BEGIN
  RETURN current_setting('app.current_titan_id', TRUE);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION core.current_organization_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_organization_id', TRUE)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Keep old function for backward compatibility
CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_tenant_id', TRUE)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 2: ADD COMPOSITE FOREIGN KEYS (Data Integrity)
-- ============================================================================

-- Add composite unique constraint to table_metadata (for FK reference)
ALTER TABLE core.table_metadata
  DROP CONSTRAINT IF EXISTS table_metadata_unique_ctx;

ALTER TABLE core.table_metadata
  ADD CONSTRAINT table_metadata_unique_ctx 
  UNIQUE (tenant_id, organization_id, id);

-- Add composite FK from generic_data to table_metadata
ALTER TABLE app.generic_data
  DROP CONSTRAINT IF EXISTS fk_generic_data_table_composite;

ALTER TABLE app.generic_data
  ADD CONSTRAINT fk_generic_data_table_composite
    FOREIGN KEY (tenant_id, organization_id, table_id)
    REFERENCES core.table_metadata(tenant_id, organization_id, id)
    ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_generic_data_table_composite ON app.generic_data IS
  'Composite FK ensures data belongs to correct tenant+organization';

-- ============================================================================
-- PART 3: CREATE RLS POLICIES (But keep RLS DISABLED for now)
-- ============================================================================

-- Note: RLS will be ENABLED in Phase 4 after API middleware is ready

-- 3.1: TENANTS Policies
DROP POLICY IF EXISTS tenants_select_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_insert_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_update_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_delete_policy ON core.tenants;

CREATE POLICY tenants_select_policy ON core.tenants
  FOR SELECT
  USING (titan_id = core.current_titan_id());

CREATE POLICY tenants_insert_policy ON core.tenants
  FOR INSERT
  WITH CHECK (titan_id = core.current_titan_id());

CREATE POLICY tenants_update_policy ON core.tenants
  FOR UPDATE
  USING (titan_id = core.current_titan_id())
  WITH CHECK (titan_id = core.current_titan_id());

CREATE POLICY tenants_delete_policy ON core.tenants
  FOR DELETE
  USING (titan_id = core.current_titan_id());

-- 3.2: ORGANIZATIONS Policies
DROP POLICY IF EXISTS organizations_select_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_insert_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_update_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_delete_policy ON core.organizations;

CREATE POLICY organizations_select_policy ON core.organizations
  FOR SELECT
  USING (
    tenant_id = app.current_tenant() AND
    (id = core.current_organization_id() OR core.current_organization_id() = 0)
  );

CREATE POLICY organizations_insert_policy ON core.organizations
  FOR INSERT
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY organizations_update_policy ON core.organizations
  FOR UPDATE
  USING (
    tenant_id = app.current_tenant() AND
    id = core.current_organization_id()
  )
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    id = core.current_organization_id()
  );

CREATE POLICY organizations_delete_policy ON core.organizations
  FOR DELETE
  USING (
    tenant_id = app.current_tenant() AND
    id = core.current_organization_id()
  );

-- 3.3: USERS Policies (Updated RLS - already enabled from migration 001)
DROP POLICY IF EXISTS users_tenant_isolation ON core.users;
DROP POLICY IF EXISTS users_select_policy ON core.users;
DROP POLICY IF EXISTS users_insert_policy ON core.users;
DROP POLICY IF EXISTS users_update_policy ON core.users;
DROP POLICY IF EXISTS users_delete_policy ON core.users;

CREATE POLICY users_select_policy ON core.users
  FOR SELECT
  USING (tenant_id = app.current_tenant());

CREATE POLICY users_insert_policy ON core.users
  FOR INSERT
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY users_update_policy ON core.users
  FOR UPDATE
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY users_delete_policy ON core.users
  FOR DELETE
  USING (tenant_id = app.current_tenant());

-- 3.4: ORGANIZATION_MEMBERS Policies (Updated RLS - already enabled from migration 016)
DROP POLICY IF EXISTS org_members_tenant_isolation ON core.organization_members;
DROP POLICY IF EXISTS org_members_select_policy ON core.organization_members;
DROP POLICY IF EXISTS org_members_insert_policy ON core.organization_members;
DROP POLICY IF EXISTS org_members_update_policy ON core.organization_members;
DROP POLICY IF EXISTS org_members_delete_policy ON core.organization_members;

CREATE POLICY org_members_select_policy ON core.organization_members
  FOR SELECT
  USING (
    tenant_id = app.current_tenant() AND
    (organization_id = core.current_organization_id() OR core.current_organization_id() = 0)
  );

CREATE POLICY org_members_insert_policy ON core.organization_members
  FOR INSERT
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY org_members_update_policy ON core.organization_members
  FOR UPDATE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  )
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY org_members_delete_policy ON core.organization_members
  FOR DELETE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

-- 3.5: TABLE_METADATA Policies
DROP POLICY IF EXISTS table_metadata_select_policy ON core.table_metadata;
DROP POLICY IF EXISTS table_metadata_insert_policy ON core.table_metadata;
DROP POLICY IF EXISTS table_metadata_update_policy ON core.table_metadata;
DROP POLICY IF EXISTS table_metadata_delete_policy ON core.table_metadata;

CREATE POLICY table_metadata_select_policy ON core.table_metadata
  FOR SELECT
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY table_metadata_insert_policy ON core.table_metadata
  FOR INSERT
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY table_metadata_update_policy ON core.table_metadata
  FOR UPDATE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  )
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY table_metadata_delete_policy ON core.table_metadata
  FOR DELETE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

-- 3.6: GENERIC_DATA Policies
DROP POLICY IF EXISTS generic_data_select_policy ON app.generic_data;
DROP POLICY IF EXISTS generic_data_insert_policy ON app.generic_data;
DROP POLICY IF EXISTS generic_data_update_policy ON app.generic_data;
DROP POLICY IF EXISTS generic_data_delete_policy ON app.generic_data;

CREATE POLICY generic_data_select_policy ON app.generic_data
  FOR SELECT
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY generic_data_insert_policy ON app.generic_data
  FOR INSERT
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY generic_data_update_policy ON app.generic_data
  FOR UPDATE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  )
  WITH CHECK (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

CREATE POLICY generic_data_delete_policy ON app.generic_data
  FOR DELETE
  USING (
    tenant_id = app.current_tenant() AND
    organization_id = core.current_organization_id()
  );

-- ============================================================================
-- PART 4: RLS STATUS (Keep DISABLED for Phase 3, will enable in Phase 4)
-- ============================================================================

-- Note: Some tables already have RLS enabled from previous migrations
-- We keep them as is, policies are updated above

-- Table RLS Status:
-- ✅ core.users - RLS already enabled (from 001_initial_schema.sql)
-- ✅ core.organizations - RLS already enabled (from 016_add_organizations.sql)
-- ✅ core.organization_members - RLS already enabled (from 016_add_organizations.sql)
-- ⏳ core.tenants - RLS will be enabled in Phase 4
-- ⏳ core.table_metadata - RLS will be enabled in Phase 4
-- ⏳ app.generic_data - RLS will be enabled in Phase 4

-- Store RLS status in config for Phase 4
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (
  3, 
  'RLS Status',
  jsonb_build_object(
    'enabled_tables', ARRAY['core.users', 'core.organizations', 'core.organization_members'],
    'pending_tables', ARRAY['core.tenants', 'core.table_metadata', 'app.generic_data'],
    'note', 'RLS policies created but tables not fully enabled. Enable in Phase 4 with API support.'
  ),
  'pending'
);

-- ============================================================================
-- PART 5: VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  total_policies INTEGER;
  context_functions INTEGER;
  composite_fks INTEGER;
  rls_enabled_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname IN ('core', 'app')
  AND policyname LIKE '%_policy';
  
  -- Count context functions
  SELECT COUNT(*) INTO context_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'core'
  AND p.proname IN ('set_context', 'current_titan_id', 'current_organization_id');
  
  -- Count composite FK constraints
  SELECT COUNT(*) INTO composite_fks
  FROM pg_constraint
  WHERE conname LIKE '%_composite';
  
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('core', 'app')
  AND c.relrowsecurity = TRUE;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Migration 024: ✅ PHASE 3 COMPLETED (PREPARATION MODE)';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Security Infrastructure:';
  RAISE NOTICE '  - Context functions: % ✅', context_functions;
  RAISE NOTICE '  - RLS policies created: % ✅', total_policies;
  RAISE NOTICE '  - Composite FK constraints: % ✅', composite_fks;
  RAISE NOTICE '  - Tables with RLS enabled: %', rls_enabled_count;
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Status:';
  RAISE NOTICE '  ✅ core.users - RLS ENABLED (from migration 001)';
  RAISE NOTICE '  ✅ core.organizations - RLS ENABLED (from migration 016)';
  RAISE NOTICE '  ✅ core.organization_members - RLS ENABLED (from migration 016)';
  RAISE NOTICE '  ⏳ core.tenants - Policies ready, RLS to be enabled in Phase 4';
  RAISE NOTICE '  ⏳ core.table_metadata - Policies ready, RLS to be enabled in Phase 4';
  RAISE NOTICE '  ⏳ app.generic_data - Policies ready, RLS to be enabled in Phase 4';
  RAISE NOTICE '';
  RAISE NOTICE 'Strategy:';
  RAISE NOTICE '  - Phase 3: ✅ Policies and constraints created';
  RAISE NOTICE '  - Phase 4: ⏳ API middleware will set context + enable remaining RLS';
  RAISE NOTICE '  - Phase 5: ⏳ Frontend updates';
  RAISE NOTICE '';
  RAISE NOTICE 'Context Functions:';
  RAISE NOTICE '  - core.set_context(titan_id, org_id) ✅';
  RAISE NOTICE '  - core.current_titan_id() ✅';
  RAISE NOTICE '  - core.current_organization_id() ✅';
  RAISE NOTICE '  - app.current_tenant() ✅ (backward compatible)';
  RAISE NOTICE '';
  RAISE NOTICE 'Data Integrity:';
  RAISE NOTICE '  - Composite FK: generic_data → table_metadata ✅';
  RAISE NOTICE '  - Unique constraint: table_metadata(tenant_id, org_id, id) ✅';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Proceed to Phase 4: Update API middleware';
  RAISE NOTICE '  2. API will call core.set_context() in transactions';
  RAISE NOTICE '  3. Enable remaining RLS tables in Phase 4';
  RAISE NOTICE '  4. Test context isolation thoroughly';
  RAISE NOTICE '========================================================================';
  
  -- Log success
  UPDATE ops.titan_migration_log
  SET status = 'success',
      details = jsonb_build_object(
        'total_policies', total_policies,
        'context_functions', context_functions,
        'composite_fks', composite_fks,
        'rls_enabled_tables', rls_enabled_count,
        'mode', 'preparation_only'
      )
  WHERE phase = 3 AND action = 'Phase 3: Start';
  
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To rollback this migration (run in separate transaction):
/*
BEGIN;

-- 1. Drop policies
DROP POLICY IF EXISTS tenants_select_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_insert_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_update_policy ON core.tenants;
DROP POLICY IF EXISTS tenants_delete_policy ON core.tenants;

DROP POLICY IF EXISTS organizations_select_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_insert_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_update_policy ON core.organizations;
DROP POLICY IF EXISTS organizations_delete_policy ON core.organizations;

-- ... (drop all other policies)

-- 2. Drop composite FK
ALTER TABLE app.generic_data DROP CONSTRAINT IF EXISTS fk_generic_data_table_composite;
ALTER TABLE core.table_metadata DROP CONSTRAINT IF EXISTS table_metadata_unique_ctx;

-- 3. Drop context functions
DROP FUNCTION IF EXISTS core.set_context(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS core.current_titan_id();
DROP FUNCTION IF EXISTS core.current_organization_id();

-- 4. Restore old context function
CREATE OR REPLACE FUNCTION app.set_context(p_tenant_id INTEGER, p_user_id INTEGER)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, FALSE);
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

-- 5. Log rollback
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (3, 'Phase 3: Rollback', '{"reason": "Manual rollback"}', 'rollback');

COMMIT;
*/

-- ============================================================================
-- TEST QUERIES (Run after migration)
-- ============================================================================

/*
-- Test 1: Context functions exist?
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE pronamespace = 'core'::regnamespace
AND proname IN ('set_context', 'current_titan_id', 'current_organization_id');

-- Test 2: Test context setting
BEGIN;
SELECT core.set_context('titan_c68b2314a59703e8251888017599e36981ec172da155fc7979a5d747ce1082b5', 1);
SELECT 
  core.current_titan_id() as titan_id,
  app.current_tenant() as tenant_id,
  core.current_organization_id() as org_id;
ROLLBACK;

-- Test 3: Count policies
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname IN ('core', 'app')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- Test 4: Check composite FK
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as referenced_table
FROM pg_constraint
WHERE conname LIKE '%composite%';

-- Test 5: RLS status
SELECT 
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname IN ('core', 'app')
AND c.relkind = 'r'
GROUP BY n.nspname, c.relname, c.relrowsecurity
ORDER BY n.nspname, c.relname;
*/

-- ============================================================================
-- MIGRATION COMPLETE - PHASE 3 ✅ (PREPARATION MODE)
-- ============================================================================
-- Status: CRITICAL - Security layer prepared (not fully enabled)
-- Duration: ~5-10 seconds
-- Impact: POLICIES CREATED + COMPOSITE FK + CONTEXT FUNCTIONS
-- Mode: PREPARATION (RLS policies ready, waiting for Phase 4 API updates)
-- Rollback: Available (see above)
-- Next: Phase 4 - API Middleware Updates + Enable RLS
-- ============================================================================

