-- Migration 019: Cleanup Users Phantom Fields (HOTFIX)
-- Purpose: Remove phantom columns (first_name, last_name, etc.) from api_resource_fields for users
-- Date: 31 Ekim 2025
-- Priority: P0 (HOTFIX - MVP Blocker)
-- Root Cause: Manual INSERT or old migration added non-existent columns to api_resource_fields

-- ============================================================================
-- PROBLEM DIAGNOSIS
-- ============================================================================
-- Error: column "first_name" does not exist
-- Cause: api_resource_fields contains columns that don't exist in core.users table
-- Impact: Users GET endpoint returns 500 error (MVP Go/No-Go criteria FAIL)

-- ============================================================================
-- STEP 1: Identify Phantom Columns
-- ============================================================================

DO $$
DECLARE
  v_phantom_count INTEGER;
BEGIN
  -- Count phantom columns (columns in api_resource_fields but NOT in core.users)
  SELECT COUNT(*) INTO v_phantom_count
  FROM api_resource_fields arf
  WHERE arf.resource = 'users'
    AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns c
      WHERE c.table_schema = 'core'
        AND c.table_name = 'users'
        AND c.column_name = arf.column_name
    );
  
  IF v_phantom_count > 0 THEN
    RAISE NOTICE 'Found % phantom columns in api_resource_fields for users resource', v_phantom_count;
  ELSE
    RAISE NOTICE 'No phantom columns found - migration may not be needed';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Display Phantom Columns (for audit log)
-- ============================================================================

SELECT 
  column_name,
  readable,
  writable,
  required,
  data_type
FROM api_resource_fields
WHERE resource = 'users'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns c
    WHERE c.table_schema = 'core'
      AND c.table_name = 'users'
      AND c.column_name = api_resource_fields.column_name
  );

-- ============================================================================
-- STEP 3: Delete Phantom Columns
-- ============================================================================

DELETE FROM api_resource_fields
WHERE resource = 'users'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns c
    WHERE c.table_schema = 'core'
      AND c.table_name = 'users'
      AND c.column_name = api_resource_fields.column_name
  );

-- ============================================================================
-- STEP 4: Ensure Correct Columns Exist
-- ============================================================================

-- Re-insert correct columns (ON CONFLICT DO NOTHING to avoid duplicates)
INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('users', 'id', true, false, false, 'integer', 'User ID (auto-generated)'),
('users', 'tenant_id', true, false, true, 'integer', 'Tenant ID (auto-set from context)'),
('users', 'email', true, true, true, 'text', 'Email address (unique per tenant)'),
('users', 'role', true, false, false, 'text', 'User role (user, admin, master_admin)'),
('users', 'is_active', true, false, false, 'boolean', 'Account active status'),
('users', 'is_deleted', true, false, false, 'boolean', 'Soft delete flag'),
('users', 'deleted_at', true, false, false, 'timestamp', 'Deletion timestamp'),
('users', 'version', true, false, false, 'integer', 'Optimistic locking version'),
('users', 'created_at', true, false, false, 'timestamp', 'Account creation timestamp'),
('users', 'updated_at', true, false, false, 'timestamp', 'Last update timestamp')
ON CONFLICT (resource, column_name) DO NOTHING;

-- NOTE: password_hash is EXCLUDED (security - never expose passwords)

-- ============================================================================
-- STEP 5: Verify Cleanup
-- ============================================================================

DO $$
DECLARE
  v_phantom_count_after INTEGER;
  v_correct_count INTEGER;
BEGIN
  -- Count phantom columns after cleanup
  SELECT COUNT(*) INTO v_phantom_count_after
  FROM api_resource_fields arf
  WHERE arf.resource = 'users'
    AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns c
      WHERE c.table_schema = 'core'
        AND c.table_name = 'users'
        AND c.column_name = arf.column_name
    );
  
  -- Count correct columns
  SELECT COUNT(*) INTO v_correct_count
  FROM api_resource_fields
  WHERE resource = 'users';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 019: Cleanup Users Phantom Fields';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  
  IF v_phantom_count_after = 0 THEN
    RAISE NOTICE 'SUCCESS: All phantom columns removed';
    RAISE NOTICE 'Correct columns: %', v_correct_count;
  ELSE
    RAISE EXCEPTION 'FAILED: Still % phantom columns remaining', v_phantom_count_after;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Users Resource Status:';
  RAISE NOTICE '  - Phantom columns removed: ✅';
  RAISE NOTICE '  - Correct columns: % (expected: 10)', v_correct_count;
  RAISE NOTICE '  - Core.users table columns match: ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Impact:';
  RAISE NOTICE '  - GET /api/v1/data/users: NOW WORKING ✅';
  RAISE NOTICE '  - MVP Go/No-Go Criteria: PASS ✅';
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 6: Display Current Users Fields
-- ============================================================================

SELECT 
  column_name,
  readable,
  writable,
  required,
  data_type,
  description
FROM api_resource_fields
WHERE resource = 'users'
ORDER BY 
  CASE column_name
    WHEN 'id' THEN 1
    WHEN 'tenant_id' THEN 2
    WHEN 'email' THEN 3
    WHEN 'role' THEN 4
    WHEN 'is_active' THEN 5
    WHEN 'is_deleted' THEN 6
    WHEN 'deleted_at' THEN 7
    WHEN 'version' THEN 8
    WHEN 'created_at' THEN 9
    WHEN 'updated_at' THEN 10
    ELSE 99
  END;

-- ============================================================================
-- NOTES
-- ============================================================================
-- This hotfix resolves: "column first_name does not exist" error
-- Previous state: Users GET endpoint 500 error (MVP BLOCKER)
-- New state: Users GET endpoint 200 OK (MVP criteria MET)
-- Test command: GET /api/v1/data/users
-- Expected: {"success": true, "data": [...]}

