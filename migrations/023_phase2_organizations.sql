-- Migration 023: Phase 2 - Organizations + User-Org M2M
-- Date: 2025-11-01
-- Description: Create default organizations and user-org pivot table
-- Reference: docs/roadmap/titanduzenlephase.md - Phase 2
-- Status: ORGANIZATION LEVEL ISOLATION
-- Risk: HIGH (Data migration + schema changes)

-- ============================================================================
-- PHASE 2: ORGANIZATIONS + M2M
-- Purpose: Create default organizations per tenant and M2M user relationships
-- ============================================================================

BEGIN;

-- Log start
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (2, 'Phase 2: Start', '{"description": "Organizations + User-Org M2M"}', 'pending');

-- ============================================================================
-- PART 1: VERIFY ORGANIZATIONS TABLE EXISTS
-- ============================================================================

-- Table already created in 016_add_organizations.sql
-- Just verify it exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'core' AND table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'core.organizations table does not exist. Run migration 016 first.';
  END IF;
  
  RAISE NOTICE 'Phase 2: core.organizations table exists ✅';
END $$;

-- ============================================================================
-- PART 2: CREATE DEFAULT ORGANIZATIONS FOR EACH TENANT
-- ============================================================================

-- Each tenant needs a "default" organization
DO $$
DECLARE
  tenant_record RECORD;
  new_org_id INTEGER;
BEGIN
  FOR tenant_record IN 
    SELECT id, name FROM core.tenants WHERE is_deleted = FALSE
  LOOP
    -- Check if default org already exists
    SELECT id INTO new_org_id
    FROM core.organizations
    WHERE tenant_id = tenant_record.id AND slug = 'default';
    
    IF new_org_id IS NULL THEN
      -- Create default organization
      INSERT INTO core.organizations (
        tenant_id,
        name,
        slug,
        description,
        plan,
        is_active
      )
      VALUES (
        tenant_record.id,
        tenant_record.name || ' (Default)',
        'default',
        'Default organization for ' || tenant_record.name,
        'free',
        TRUE
      )
      RETURNING id INTO new_org_id;
      
      RAISE NOTICE 'Created default org for tenant %: % (ID: %)', 
        tenant_record.id, tenant_record.name, new_org_id;
    ELSE
      RAISE NOTICE 'Default org already exists for tenant %: % (ID: %)', 
        tenant_record.id, tenant_record.name, new_org_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Default organizations creation completed ✅';
END $$;

-- ============================================================================
-- PART 3: VERIFY USER_ORGANIZATIONS PIVOT TABLE (from migration 016)
-- ============================================================================

-- Table name in migration 016 is: core.organization_members
-- We'll use this as the M2M pivot table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'core' AND table_name = 'organization_members'
  ) THEN
    RAISE EXCEPTION 'core.organization_members table does not exist. Run migration 016 first.';
  END IF;
  
  RAISE NOTICE 'Phase 2: core.organization_members table exists ✅';
END $$;

-- ============================================================================
-- PART 4: MIGRATE EXISTING USERS TO DEFAULT ORGANIZATIONS
-- ============================================================================

-- All existing users should be members of their tenant's default organization
DO $$
DECLARE
  user_record RECORD;
  default_org_id INTEGER;
  existing_membership INTEGER;
BEGIN
  FOR user_record IN 
    SELECT id, tenant_id, email, role 
    FROM core.users 
    WHERE is_deleted = FALSE
  LOOP
    -- Find default org for this tenant
    SELECT id INTO default_org_id
    FROM core.organizations
    WHERE tenant_id = user_record.tenant_id AND slug = 'default';
    
    IF default_org_id IS NULL THEN
      RAISE WARNING 'No default org found for tenant %. Skipping user %.', 
        user_record.tenant_id, user_record.email;
      CONTINUE;
    END IF;
    
    -- Check if membership already exists
    SELECT id INTO existing_membership
    FROM core.organization_members
    WHERE user_id = user_record.id 
      AND organization_id = default_org_id
      AND tenant_id = user_record.tenant_id;
    
    IF existing_membership IS NULL THEN
      -- Create membership
      INSERT INTO core.organization_members (
        tenant_id,
        organization_id,
        user_id,
        role,
        is_owner,
        status,
        is_active
      )
      VALUES (
        user_record.tenant_id,
        default_org_id,
        user_record.id,
        -- Map user role to org role
        CASE 
          WHEN user_record.role IN ('admin', 'master_admin', 'owner') THEN 'owner'
          WHEN user_record.role = 'user' THEN 'member'
          ELSE 'viewer'
        END,
        user_record.role IN ('admin', 'master_admin', 'owner'),
        'active',
        TRUE
      );
      
      RAISE NOTICE 'Added user % to default org % (tenant %)', 
        user_record.email, default_org_id, user_record.tenant_id;
    ELSE
      RAISE NOTICE 'User % already member of default org %', 
        user_record.email, default_org_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'User-organization memberships migration completed ✅';
END $$;

-- ============================================================================
-- PART 5: ADD ORGANIZATION_ID TO DATA TABLES
-- ============================================================================

-- Add organization_id to table_metadata (if not exists)
ALTER TABLE core.table_metadata
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES core.organizations(id);

-- Add organization_id to generic_data (if not exists)
ALTER TABLE app.generic_data
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES core.organizations(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_table_metadata_organization 
  ON core.table_metadata(organization_id);

CREATE INDEX IF NOT EXISTS idx_generic_data_organization 
  ON app.generic_data(organization_id);

-- ============================================================================
-- PART 6: MIGRATE EXISTING DATA TO DEFAULT ORGANIZATIONS
-- ============================================================================

-- Migrate table_metadata
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Update table_metadata with default org_id based on tenant_id
  UPDATE core.table_metadata tm
  SET organization_id = o.id
  FROM core.organizations o
  WHERE o.tenant_id = tm.tenant_id 
    AND o.slug = 'default'
    AND tm.organization_id IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'Migrated % table_metadata records to default orgs', affected_rows;
END $$;

-- Migrate generic_data
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Update generic_data with default org_id based on table_metadata
  UPDATE app.generic_data gd
  SET organization_id = tm.organization_id
  FROM core.table_metadata tm
  WHERE gd.table_id = tm.id
    AND gd.tenant_id = tm.tenant_id
    AND gd.organization_id IS NULL
    AND tm.organization_id IS NOT NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'Migrated % generic_data records to organizations', affected_rows;
END $$;

-- ============================================================================
-- PART 7: VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  total_tenants INTEGER;
  total_orgs INTEGER;
  default_orgs INTEGER;
  total_memberships INTEGER;
  orphan_users INTEGER;
  orphan_tables INTEGER;
  orphan_data INTEGER;
BEGIN
  -- Count statistics
  SELECT COUNT(*) INTO total_tenants FROM core.tenants WHERE is_deleted = FALSE;
  SELECT COUNT(*) INTO total_orgs FROM core.organizations WHERE is_deleted = FALSE;
  SELECT COUNT(*) INTO default_orgs FROM core.organizations WHERE slug = 'default' AND is_deleted = FALSE;
  SELECT COUNT(*) INTO total_memberships FROM core.organization_members WHERE is_active = TRUE;
  
  -- Check for orphans
  SELECT COUNT(*) INTO orphan_users 
  FROM core.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM core.organization_members om 
    WHERE om.user_id = u.id AND om.is_active = TRUE
  ) AND u.is_deleted = FALSE;
  
  SELECT COUNT(*) INTO orphan_tables 
  FROM core.table_metadata 
  WHERE organization_id IS NULL;
  
  SELECT COUNT(*) INTO orphan_data 
  FROM app.generic_data 
  WHERE organization_id IS NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Migration 023: ✅ PHASE 2 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Organizations:';
  RAISE NOTICE '  - Total tenants: %', total_tenants;
  RAISE NOTICE '  - Total organizations: %', total_orgs;
  RAISE NOTICE '  - Default organizations: % / %', default_orgs, total_tenants;
  RAISE NOTICE '  - Status: %', 
    CASE WHEN default_orgs = total_tenants THEN '✅ All tenants have default org' 
    ELSE '⚠️  Some tenants missing default org' END;
  RAISE NOTICE '';
  RAISE NOTICE 'User-Organization Memberships:';
  RAISE NOTICE '  - Total memberships: %', total_memberships;
  RAISE NOTICE '  - Orphan users (no org): % %', orphan_users,
    CASE WHEN orphan_users = 0 THEN '✅' ELSE '⚠️' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Data Migration:';
  RAISE NOTICE '  - table_metadata without org: % %', orphan_tables,
    CASE WHEN orphan_tables = 0 THEN '✅' ELSE '⚠️' END;
  RAISE NOTICE '  - generic_data without org: % %', orphan_data,
    CASE WHEN orphan_data = 0 THEN '✅' ELSE '⚠️' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Sample Organizations:';
  
  -- Show sample organizations
  DECLARE
    org_record RECORD;
    counter INTEGER := 0;
  BEGIN
    FOR org_record IN 
      SELECT o.id, o.name, o.slug, t.name as tenant_name, 
             (SELECT COUNT(*) FROM core.organization_members om 
              WHERE om.organization_id = o.id AND om.is_active = TRUE) as member_count
      FROM core.organizations o
      JOIN core.tenants t ON t.id = o.tenant_id
      WHERE o.is_deleted = FALSE
      ORDER BY o.id
      LIMIT 5
    LOOP
      counter := counter + 1;
      RAISE NOTICE '  %: % / % (% members)', 
        counter, org_record.tenant_name, org_record.name, org_record.member_count;
    END LOOP;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Verify default orgs: SELECT * FROM core.organizations WHERE slug = ''default'';';
  RAISE NOTICE '  2. Verify memberships: SELECT COUNT(*) FROM core.organization_members;';
  RAISE NOTICE '  3. Check orphans: SELECT COUNT(*) FROM core.users u WHERE NOT EXISTS (SELECT 1 FROM core.organization_members om WHERE om.user_id = u.id);';
  RAISE NOTICE '  4. Proceed to Phase 3: Create 024_phase3_rls_security.sql';
  RAISE NOTICE '========================================================================';
  
  -- Log success
  UPDATE ops.titan_migration_log
  SET status = 'success',
      details = jsonb_build_object(
        'total_orgs', total_orgs,
        'default_orgs', default_orgs,
        'total_memberships', total_memberships,
        'orphan_users', orphan_users,
        'orphan_tables', orphan_tables,
        'orphan_data', orphan_data
      )
  WHERE phase = 2 AND action = 'Phase 2: Start';
  
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To rollback this migration (run in separate transaction):
/*
BEGIN;

-- 1. Remove organization_id from data tables
ALTER TABLE core.table_metadata DROP COLUMN IF EXISTS organization_id;
ALTER TABLE app.generic_data DROP COLUMN IF EXISTS organization_id;

-- 2. Clear organization memberships
TRUNCATE core.organization_members;

-- 3. Remove default organizations
DELETE FROM core.organizations WHERE slug = 'default';

-- 4. Log rollback
INSERT INTO ops.titan_migration_log (phase, action, details, status)
VALUES (2, 'Phase 2: Rollback', '{"reason": "Manual rollback"}', 'rollback');

COMMIT;
*/

-- ============================================================================
-- TEST QUERIES (Run after migration)
-- ============================================================================

/*
-- Test 1: All tenants have default org?
SELECT t.id, t.name, o.id as org_id, o.name as org_name
FROM core.tenants t
LEFT JOIN core.organizations o ON o.tenant_id = t.id AND o.slug = 'default'
WHERE t.is_deleted = FALSE
ORDER BY t.id;
-- Expected: All tenants should have matching org_id

-- Test 2: All users are members?
SELECT u.id, u.email, u.tenant_id, 
       COUNT(om.id) as org_count,
       array_agg(o.name) as org_names
FROM core.users u
LEFT JOIN core.organization_members om ON om.user_id = u.id AND om.is_active = TRUE
LEFT JOIN core.organizations o ON o.id = om.organization_id
WHERE u.is_deleted = FALSE
GROUP BY u.id, u.email, u.tenant_id
ORDER BY org_count, u.id;
-- Expected: All users should have org_count >= 1

-- Test 3: Orphan check
SELECT 'Users without org' as type, COUNT(*) as count
FROM core.users u
WHERE NOT EXISTS (
  SELECT 1 FROM core.organization_members om 
  WHERE om.user_id = u.id AND om.is_active = TRUE
) AND u.is_deleted = FALSE
UNION ALL
SELECT 'Tables without org', COUNT(*)
FROM core.table_metadata
WHERE organization_id IS NULL
UNION ALL
SELECT 'Data without org', COUNT(*)
FROM app.generic_data
WHERE organization_id IS NULL;
-- Expected: All counts should be 0

-- Test 4: Organization member counts
SELECT o.id, o.name, t.name as tenant_name,
       COUNT(om.id) as member_count
FROM core.organizations o
JOIN core.tenants t ON t.id = o.tenant_id
LEFT JOIN core.organization_members om ON om.organization_id = o.id AND om.is_active = TRUE
WHERE o.is_deleted = FALSE
GROUP BY o.id, o.name, t.name
ORDER BY o.id;

-- Test 5: Data distribution by organization
SELECT o.id, o.name,
       (SELECT COUNT(*) FROM core.table_metadata tm WHERE tm.organization_id = o.id) as table_count,
       (SELECT COUNT(*) FROM app.generic_data gd WHERE gd.organization_id = o.id) as data_count
FROM core.organizations o
WHERE o.is_deleted = FALSE
ORDER BY o.id;
*/

-- ============================================================================
-- MIGRATION COMPLETE - PHASE 2 ✅
-- ============================================================================
-- Status: HIGH RISK - Data migration + M2M relationships
-- Duration: ~5-15 seconds (depends on user/data count)
-- Impact: DEFAULT ORGS CREATED + USER MEMBERSHIPS + DATA MIGRATION
-- Rollback: Available (see above)
-- Next: Phase 3 - RLS + Security (024_phase3_rls_security.sql)
-- ============================================================================

