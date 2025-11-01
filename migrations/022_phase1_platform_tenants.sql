-- Migration 022: Phase 1 - Platform Users + Titan ID
-- Date: 2025-11-01
-- Description: Create platform.users and add titan_id to tenants
-- Reference: docs/roadmap/titanduzenlephase.md - Phase 1
-- Status: PLATFORM LEVEL ISOLATION
-- Risk: MEDIUM (Schema changes + data migration)

-- ============================================================================
-- PHASE 1: PLATFORM USERS + TENANTS
-- Purpose: Create platform-level users and assign titan_id to tenants
-- ============================================================================

BEGIN;

-- Log start
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (1, 'Phase 1: Start', '{"description": "Platform users + Titan ID"}', 'pending');

-- ============================================================================
-- PART 1: CREATE PLATFORM SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS platform;

COMMENT ON SCHEMA platform IS 
  'Platform-level resources: Users who can own multiple tenants';

-- ============================================================================
-- PART 2: CREATE PLATFORM.USERS TABLE
-- ============================================================================

-- Platform users are "super users" who can own multiple tenants
-- Example: Özgür (platform user) owns Tenant1 (E-commerce) + Tenant2 (Logistics)

CREATE TABLE IF NOT EXISTS platform.users (
  id SERIAL PRIMARY KEY,
  
  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Profile
  full_name VARCHAR(200),
  phone VARCHAR(50),
  
  -- Account status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  -- Security
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  -- MFA
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  
  -- Preferences
  preferences JSONB DEFAULT '{
    "language": "en-US",
    "timezone": "UTC",
    "theme": "light"
  }'::jsonb,
  
  -- Metadata
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform.users(email);
CREATE INDEX IF NOT EXISTS idx_platform_users_active ON platform.users(is_active) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_platform_users_verified ON platform.users(is_verified) WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER trg_platform_users_touch
  BEFORE UPDATE ON platform.users
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();

COMMENT ON TABLE platform.users IS 
  'Platform-level users who can own and manage multiple tenants';

-- ============================================================================
-- PART 3: ADD TITAN_ID TO TENANTS
-- ============================================================================

-- Add new columns to core.tenants
ALTER TABLE core.tenants
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES platform.users(id),
  ADD COLUMN IF NOT EXISTS titan_id VARCHAR(128) UNIQUE,
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS max_organizations INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_users_per_org INTEGER DEFAULT 50;

-- Add constraints
DO $$
BEGIN
  -- Check constraint for project_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_tenants_project_type'
  ) THEN
    ALTER TABLE core.tenants
      ADD CONSTRAINT chk_tenants_project_type
      CHECK (project_type IN ('generic', 'ecommerce', 'logistics', 'saas', 'education', 'healthcare', 'finance'));
  END IF;
  
  -- Check constraint for limits
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_tenants_limits'
  ) THEN
    ALTER TABLE core.tenants
      ADD CONSTRAINT chk_tenants_limits
      CHECK (max_organizations > 0 AND max_users_per_org > 0);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_titan_id ON core.tenants(titan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON core.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_project_type ON core.tenants(project_type);

-- Comments
COMMENT ON COLUMN core.tenants.titan_id IS 
  'Unique Titan ID for tenant (titan_abc123...) - Used for API authentication and isolation';

COMMENT ON COLUMN core.tenants.owner_id IS 
  'Platform user who owns this tenant';

COMMENT ON COLUMN core.tenants.project_type IS 
  'Project type: generic, ecommerce, logistics, saas, etc.';

-- ============================================================================
-- PART 4: MIGRATE EXISTING DATA
-- ============================================================================

-- 4.1: Create platform users from existing tenant admins
DO $$
DECLARE
  admin_record RECORD;
  new_platform_user_id INTEGER;
BEGIN
  -- Find all tenant admins (role='admin' or role='owner')
  FOR admin_record IN 
    SELECT DISTINCT ON (email) 
      u.id, u.email, u.password_hash, t.id as tenant_id, t.name as tenant_name
    FROM core.users u
    JOIN core.tenants t ON t.id = u.tenant_id
    WHERE u.role IN ('admin', 'owner', 'master_admin')
    AND u.is_active = TRUE
    AND u.is_deleted = FALSE
    ORDER BY email, u.created_at ASC
  LOOP
    -- Check if platform user already exists
    SELECT id INTO new_platform_user_id
    FROM platform.users
    WHERE email = admin_record.email;
    
    IF new_platform_user_id IS NULL THEN
      -- Create platform user
      INSERT INTO platform.users (email, password_hash, full_name, is_active, is_verified)
      VALUES (
        admin_record.email,
        admin_record.password_hash,
        admin_record.email, -- Use email as full_name temporarily
        TRUE,
        TRUE
      )
      RETURNING id INTO new_platform_user_id;
      
      RAISE NOTICE 'Created platform user: % (ID: %)', admin_record.email, new_platform_user_id;
    END IF;
    
    -- Update tenant owner_id
    UPDATE core.tenants
    SET owner_id = new_platform_user_id
    WHERE id = admin_record.tenant_id AND owner_id IS NULL;
    
  END LOOP;
  
  RAISE NOTICE 'Platform users migration completed';
END $$;

-- 4.2: Generate Titan IDs for all tenants
UPDATE core.tenants
SET titan_id = core.generate_titan_id()
WHERE titan_id IS NULL;

-- 4.3: Set default project_type based on tenant name (smart detection)
UPDATE core.tenants
SET project_type = CASE
  WHEN name ILIKE '%ecommerce%' OR name ILIKE '%shop%' OR name ILIKE '%store%' THEN 'ecommerce'
  WHEN name ILIKE '%logistic%' OR name ILIKE '%shipping%' OR name ILIKE '%cargo%' THEN 'logistics'
  WHEN name ILIKE '%saas%' OR name ILIKE '%software%' THEN 'saas'
  WHEN name ILIKE '%school%' OR name ILIKE '%education%' OR name ILIKE '%university%' THEN 'education'
  WHEN name ILIKE '%health%' OR name ILIKE '%hospital%' OR name ILIKE '%clinic%' THEN 'healthcare'
  WHEN name ILIKE '%bank%' OR name ILIKE '%finance%' OR name ILIKE '%payment%' THEN 'finance'
  ELSE 'generic'
END
WHERE project_type = 'generic';

-- ============================================================================
-- PART 5: MAKE TITAN_ID REQUIRED (After migration)
-- ============================================================================

-- Now that all tenants have titan_id, make it NOT NULL
ALTER TABLE core.tenants
  ALTER COLUMN titan_id SET NOT NULL;

-- ============================================================================
-- PART 6: VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  platform_users_count INTEGER;
  tenants_with_titan_id INTEGER;
  tenants_without_owner INTEGER;
  total_tenants INTEGER;
  project_type_stats JSONB;
BEGIN
  -- Count platform users
  SELECT COUNT(*) INTO platform_users_count
  FROM platform.users
  WHERE is_deleted = FALSE;
  
  -- Count tenants with titan_id
  SELECT COUNT(*) INTO tenants_with_titan_id
  FROM core.tenants
  WHERE titan_id IS NOT NULL;
  
  -- Count tenants without owner
  SELECT COUNT(*) INTO tenants_without_owner
  FROM core.tenants
  WHERE owner_id IS NULL;
  
  -- Total tenants
  SELECT COUNT(*) INTO total_tenants
  FROM core.tenants;
  
  -- Project type statistics
  SELECT jsonb_object_agg(project_type, count)
  INTO project_type_stats
  FROM (
    SELECT project_type, COUNT(*) as count
    FROM core.tenants
    GROUP BY project_type
  ) stats;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Migration 022: ✅ PHASE 1 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Platform Infrastructure:';
  RAISE NOTICE '  - Schema: platform ✅';
  RAISE NOTICE '  - Table: platform.users ✅ (% users)', platform_users_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Tenant Updates:';
  RAISE NOTICE '  - Total tenants: %', total_tenants;
  RAISE NOTICE '  - Tenants with Titan ID: % / %', tenants_with_titan_id, total_tenants;
  RAISE NOTICE '  - Tenants without owner: % (% if any)', tenants_without_owner, 
    CASE WHEN tenants_without_owner > 0 THEN 'WARNING' ELSE 'OK' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Project Type Distribution:';
  RAISE NOTICE '  %', project_type_stats;
  RAISE NOTICE '';
  RAISE NOTICE 'Sample Titan IDs:';
  
  -- Show sample titan IDs
  FOR i IN 1..LEAST(3, total_tenants) LOOP
    DECLARE
      sample_tenant RECORD;
    BEGIN
      SELECT name, titan_id, project_type INTO sample_tenant
      FROM core.tenants
      WHERE is_deleted = FALSE
      ORDER BY id
      LIMIT 1 OFFSET (i-1);
      
      IF sample_tenant.titan_id IS NOT NULL THEN
        RAISE NOTICE '  - %: % (%)', sample_tenant.name, sample_tenant.titan_id, sample_tenant.project_type;
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Data Integrity:';
  RAISE NOTICE '  - All tenants have titan_id: %', 
    CASE WHEN tenants_with_titan_id = total_tenants THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  - Titan IDs are unique: ✅ (enforced by UNIQUE constraint)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Verify platform users: SELECT * FROM platform.users LIMIT 5;';
  RAISE NOTICE '  2. Verify titan IDs: SELECT id, name, titan_id, owner_id FROM core.tenants;';
  RAISE NOTICE '  3. Check orphan tenants: SELECT * FROM core.tenants WHERE owner_id IS NULL;';
  RAISE NOTICE '  4. Proceed to Phase 2: Create 023_phase2_organizations.sql';
  RAISE NOTICE '========================================================================';
  
  -- Log success
  UPDATE ops.titan_migration_log
  SET status = 'success',
      details = jsonb_build_object(
        'platform_users', platform_users_count,
        'tenants_with_titan_id', tenants_with_titan_id,
        'total_tenants', total_tenants,
        'project_types', project_type_stats
      )
  WHERE phase = 1 AND action = 'Phase 1: Start';
  
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To rollback this migration (run in separate transaction):
/*
BEGIN;

-- 1. Remove titan_id columns from tenants
ALTER TABLE core.tenants
  DROP CONSTRAINT IF EXISTS chk_tenants_project_type,
  DROP CONSTRAINT IF EXISTS chk_tenants_limits,
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS titan_id,
  DROP COLUMN IF EXISTS project_type,
  DROP COLUMN IF EXISTS max_organizations,
  DROP COLUMN IF EXISTS max_users_per_org;

-- 2. Drop platform.users
DROP TABLE IF EXISTS platform.users CASCADE;

-- 3. Drop platform schema
DROP SCHEMA IF EXISTS platform CASCADE;

-- 4. Log rollback
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (1, 'Phase 1: Rollback', '{"reason": "Manual rollback"}', 'rollback');

COMMIT;
*/

-- ============================================================================
-- TEST QUERIES (Run after migration)
-- ============================================================================

/*
-- Test 1: Count platform users
SELECT COUNT(*) as platform_users FROM platform.users;

-- Test 2: List all tenants with titan_id
SELECT id, name, titan_id, owner_id, project_type 
FROM core.tenants 
ORDER BY id;

-- Test 3: Check for tenants without owner (should be 0)
SELECT COUNT(*) as orphan_tenants 
FROM core.tenants 
WHERE owner_id IS NULL;

-- Test 4: Check for duplicate titan_ids (should be 0)
SELECT titan_id, COUNT(*) 
FROM core.tenants 
GROUP BY titan_id 
HAVING COUNT(*) > 1;

-- Test 5: Join platform users with their tenants
SELECT 
  pu.id as platform_user_id,
  pu.email,
  COUNT(t.id) as tenant_count,
  array_agg(t.name) as tenant_names
FROM platform.users pu
LEFT JOIN core.tenants t ON t.owner_id = pu.id
WHERE pu.is_deleted = FALSE
GROUP BY pu.id, pu.email
ORDER BY tenant_count DESC;

-- Test 6: Check titan_id format (should all start with 'titan_')
SELECT COUNT(*) as valid_titan_ids
FROM core.tenants
WHERE titan_id ~ '^titan_[a-f0-9]{64}$';

-- Test 7: Project type distribution
SELECT project_type, COUNT(*) as count
FROM core.tenants
GROUP BY project_type
ORDER BY count DESC;
*/

-- ============================================================================
-- MIGRATION COMPLETE - PHASE 1 ✅
-- ============================================================================
-- Status: MEDIUM RISK - Schema changes + data migration
-- Duration: ~10-30 seconds (depends on tenant count)
-- Impact: NEW COLUMNS + PLATFORM SCHEMA + DATA MIGRATION
-- Rollback: Available (see above)
-- Next: Phase 2 - Organizations Update (023_phase2_organizations.sql)
-- ============================================================================

