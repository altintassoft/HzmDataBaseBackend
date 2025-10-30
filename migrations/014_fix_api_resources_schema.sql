-- Migration 014: Fix api_resources schema_name (HOTFIX)
-- Purpose: Update schema_name from 'public' to 'core' for users and projects
-- Reason: Migration 011 had incorrect schema (tables are in core schema, not public)
-- Date: 30 Ekim 2025
-- Status: Hotfix for Week 3 Canary Test

-- ============================================================================
-- FIX: Update schema_name
-- ============================================================================

-- Update users resource
UPDATE api_resources 
SET schema_name = 'core'
WHERE resource = 'users' AND schema_name = 'public';

-- Update projects resource
UPDATE api_resources 
SET schema_name = 'core'
WHERE resource = 'projects' AND schema_name = 'public';

-- ============================================================================
-- VERIFY: Check updates
-- ============================================================================

DO $$
DECLARE
  v_users_schema VARCHAR;
  v_projects_schema VARCHAR;
BEGIN
  SELECT schema_name INTO v_users_schema
  FROM api_resources
  WHERE resource = 'users';
  
  SELECT schema_name INTO v_projects_schema
  FROM api_resources
  WHERE resource = 'projects';
  
  IF v_users_schema = 'core' AND v_projects_schema = 'core' THEN
    RAISE NOTICE 'SUCCESS: Both users and projects now point to core schema';
  ELSE
    RAISE EXCEPTION 'FAILED: Schema update unsuccessful (users: %, projects: %)', 
      v_users_schema, v_projects_schema;
  END IF;
END $$;

-- ============================================================================
-- DISPLAY: Show current status
-- ============================================================================

SELECT 
  resource,
  schema_name,
  table_name,
  is_enabled,
  updated_at
FROM api_resources
ORDER BY resource;

-- ============================================================================
-- NOTES
-- ============================================================================

-- This is a HOTFIX migration to correct the schema_name in api_resources table.
-- The tables (users, projects) are actually in 'core' schema, not 'public'.
-- Migration 011 had the wrong schema name, causing "relation does not exist" errors.
--
-- After this migration:
-- - api_resources.users → core.users ✅
-- - api_resources.projects → core.projects ✅

