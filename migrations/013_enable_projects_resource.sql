-- Migration 013: Enable Projects Resource (HAFTA 3 - Canary Test)
-- Purpose: Activate projects resource in generic handler for CRUD testing
-- Rollback: UPDATE api_resources SET is_enabled = false WHERE resource = 'projects';
-- Date: 30 Ekim 2025
-- Status: Week 3 - Canary Test

-- ============================================================================
-- STEP 1: Enable Projects Resource
-- ============================================================================

-- Enable projects resource for generic handler
UPDATE api_resources 
SET 
  is_enabled = true,
  updated_at = NOW()
WHERE resource = 'projects';

-- ============================================================================
-- STEP 2: Verify Change
-- ============================================================================

-- Check if projects is enabled
DO $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM api_resources
  WHERE resource = 'projects';
  
  IF v_enabled = true THEN
    RAISE NOTICE 'SUCCESS: Projects resource is now ENABLED';
  ELSE
    RAISE EXCEPTION 'FAILED: Projects resource is still DISABLED';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Display Current Status
-- ============================================================================

-- Show all resources status
SELECT 
  resource,
  is_enabled,
  rate_limit,
  updated_at
FROM api_resources
ORDER BY resource;

-- ============================================================================
-- ROLLBACK PLAN (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- UPDATE api_resources SET is_enabled = false WHERE resource = 'projects';
-- UPDATE schema_migrations SET executed_at = NULL WHERE migration_name = '013_enable_projects_resource';

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration activates projects resource for Week 3 testing.
-- The resource will now respond to:
--   - GET    /api/v1/data/projects
--   - GET    /api/v1/data/projects/:id
--   - POST   /api/v1/data/projects
--   - PUT    /api/v1/data/projects/:id
--   - DELETE /api/v1/data/projects/:id
--   - GET    /api/v1/data/projects/count
--
-- Old endpoints (/api/v1/projects/) will continue to work.
-- This is a SAFE canary test - easily rollbackable.

