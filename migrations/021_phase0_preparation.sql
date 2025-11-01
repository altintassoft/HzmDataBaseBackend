-- Migration 021: Phase 0 - Titan ID Preparation
-- Date: 2025-11-01
-- Description: Prepare system for Titan ID multi-level isolation
-- Reference: docs/roadmap/titanduzenlephase.md - Phase 0
-- Status: PREPARATION
-- Risk: LOW (Extensions + Roles only)

-- ============================================================================
-- PHASE 0: PREPARATION
-- Purpose: Set up extensions, roles, and infrastructure for Titan ID system
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: VERIFY EXTENSIONS (Already exist from 001, but verify)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- For gen_random_bytes (titan_id generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- For UUID generation

-- ============================================================================
-- PART 2: CREATE MIGRATION ADMIN ROLE (Bypass RLS for migrations)
-- ============================================================================

-- Note: This role will be used for future migrations that modify RLS policies
-- It needs to bypass RLS to perform schema changes safely

DO $$
BEGIN
  -- Create role if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    -- Use dynamic SQL for CREATE ROLE (can't be in IF block directly)
    EXECUTE 'CREATE ROLE app_admin WITH LOGIN PASSWORD ' || quote_literal('changeme_' || md5(random()::text));
    RAISE NOTICE 'Migration 021: ✅ Created app_admin role';
  ELSE
    RAISE NOTICE 'Migration 021: ℹ️  app_admin role already exists';
  END IF;
END $$;

-- Grant BYPASSRLS privilege
ALTER ROLE app_admin BYPASSRLS;

-- Grant database permissions (connect + usage)
GRANT CONNECT ON DATABASE postgres TO app_admin;
GRANT USAGE ON SCHEMA core, app, cfg, ops, public TO app_admin;

-- Grant table permissions (current and future)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core, app, cfg, ops, public TO app_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core, app, cfg, ops, public TO app_admin;

-- Grant future table permissions (auto-grant for new tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL ON TABLES TO app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA cfg GRANT ALL ON TABLES TO app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT ALL ON TABLES TO app_admin;

-- ============================================================================
-- PART 3: CREATE AUDIT LOG FOR TITAN MIGRATION (Track changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.titan_migration_log (
  id SERIAL PRIMARY KEY,
  phase INTEGER NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  executed_by TEXT DEFAULT CURRENT_USER,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'rollback')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_titan_migration_log_phase ON ops.titan_migration_log(phase);
CREATE INDEX IF NOT EXISTS idx_titan_migration_log_status ON ops.titan_migration_log(status);

-- Log this migration
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (
  0,
  'Phase 0: Preparation',
  jsonb_build_object(
    'extensions', ARRAY['pgcrypto', 'uuid-ossp'],
    'roles', ARRAY['app_admin'],
    'description', 'Infrastructure preparation for Titan ID system'
  ),
  'success'
);

-- ============================================================================
-- PART 4: CREATE HELPER FUNCTION FOR TITAN ID GENERATION
-- ============================================================================

-- This function will be used in Phase 1 to generate titan_id for tenants
CREATE OR REPLACE FUNCTION core.generate_titan_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'titan_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION core.generate_titan_id() IS 
  'Generate unique Titan ID for tenants (titan_abc123...)';

-- ============================================================================
-- PART 5: VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  ext_pgcrypto BOOLEAN;
  ext_uuid BOOLEAN;
  role_exists BOOLEAN;
  log_table_exists BOOLEAN;
BEGIN
  -- Check extensions
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) INTO ext_pgcrypto;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ) INTO ext_uuid;
  
  -- Check role
  SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'app_admin'
  ) INTO role_exists;
  
  -- Check log table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'ops' AND table_name = 'titan_migration_log'
  ) INTO log_table_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Migration 021: ✅ PHASE 0 PREPARATION COMPLETED';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Infrastructure Status:';
  RAISE NOTICE '  - Extension pgcrypto: %', CASE WHEN ext_pgcrypto THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - Extension uuid-ossp: %', CASE WHEN ext_uuid THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - Role app_admin (BYPASSRLS): %', CASE WHEN role_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - Audit log table (ops.titan_migration_log): %', CASE WHEN log_table_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - Titan ID generator (core.generate_titan_id): ✅';
  RAISE NOTICE '';
  RAISE NOTICE 'System Ready:';
  RAISE NOTICE '  - Titan ID generation: ✅ Ready (use core.generate_titan_id())';
  RAISE NOTICE '  - Migration role: ✅ Ready (app_admin with BYPASSRLS)';
  RAISE NOTICE '  - Audit logging: ✅ Ready (ops.titan_migration_log)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Verify extensions: SELECT * FROM pg_extension WHERE extname IN (''pgcrypto'', ''uuid-ossp'');';
  RAISE NOTICE '  2. Test Titan ID generation: SELECT core.generate_titan_id();';
  RAISE NOTICE '  3. Proceed to Phase 1: Create 022_phase1_platform_tenants.sql';
  RAISE NOTICE '========================================================================';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- ============================================================================

-- To rollback this migration (run in separate transaction):
/*
BEGIN;

-- Drop function
DROP FUNCTION IF EXISTS core.generate_titan_id();

-- Drop audit log
DROP TABLE IF EXISTS ops.titan_migration_log;

-- Revoke permissions from app_admin
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA core, app, cfg, ops, public FROM app_admin;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core, app, cfg, ops, public FROM app_admin;
REVOKE CONNECT ON DATABASE postgres FROM app_admin;

-- Drop role (if no other dependencies)
-- DROP ROLE IF EXISTS app_admin;

-- Note: Extensions are kept (safe to keep, other migrations may depend on them)

COMMIT;
*/

-- ============================================================================
-- TEST PLAN (Quick verification)
-- ============================================================================

/*
-- 1. Check extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp');

-- 2. Check role
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'app_admin';

-- 3. Test Titan ID generation
SELECT core.generate_titan_id();
-- Expected output: titan_abc123def456... (64 chars hex)

-- 4. Check audit log
SELECT * FROM ops.titan_migration_log WHERE phase = 0;
-- Expected: 1 row with status='success'

-- 5. Verify role permissions
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_admin'
LIMIT 10;
*/

-- ============================================================================
-- MIGRATION COMPLETE - PHASE 0 ✅
-- ============================================================================
-- Status: LOW RISK - Only infrastructure setup
-- Duration: ~2 seconds
-- Impact: NO DATA CHANGES
-- Rollback: Available (see above)
-- Next: Phase 1 - Platform Users + Titan ID (022_phase1_platform_tenants.sql)
-- ============================================================================

