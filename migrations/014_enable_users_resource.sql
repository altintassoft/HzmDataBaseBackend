-- Migration 014: Enable Users Resource (HAFTA 4 - Scale Up)
-- Purpose: Activate users resource in generic handler for CRUD operations
-- Rollback: UPDATE api_resources SET is_enabled = false WHERE resource = 'users';
-- Date: 30 Ekim 2025
-- Status: Week 4 - Scale Up

-- ============================================================================
-- STEP 1: Enable Users Resource
-- ============================================================================

-- Enable users resource for generic handler
UPDATE api_resources 
SET 
  is_enabled = true,
  updated_at = NOW()
WHERE resource = 'users';

-- ============================================================================
-- STEP 2: Verify Change
-- ============================================================================

-- Check if users is enabled
DO $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM api_resources
  WHERE resource = 'users';
  
  IF v_enabled = true THEN
    RAISE NOTICE 'SUCCESS: Users resource is now ENABLED';
  ELSE
    RAISE EXCEPTION 'FAILED: Users resource is still DISABLED';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Display Current Status
-- ============================================================================

-- Show all resources status
SELECT 
  resource,
  schema_name,
  table_name,
  is_enabled,
  is_readonly,
  updated_at
FROM api_resources
ORDER BY resource;

-- ============================================================================
-- ROLLBACK PLAN (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- UPDATE api_resources SET is_enabled = false WHERE resource = 'users';
-- UPDATE schema_migrations SET executed_at = NULL WHERE migration_name = '014_enable_users_resource';

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration activates users resource for Week 4.
-- The resource will now respond to:
--   - GET    /api/v1/data/users
--   - GET    /api/v1/data/users/:id
--   - POST   /api/v1/data/users
--   - PUT    /api/v1/data/users/:id
--   - DELETE /api/v1/data/users/:id
--   - GET    /api/v1/data/users/count
--
-- Old endpoints (/api/v1/users/) will continue to work.
-- This is a SAFE migration - easily rollbackable.
--

