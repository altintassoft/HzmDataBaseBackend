-- Migration 015: Fix api_resource_fields for projects (HOTFIX)
-- Purpose: Remove 'settings' column from projects fields (doesn't exist in core.projects)
-- Reason: Migration 011 defined 'settings' field but core.projects table doesn't have it
-- Date: 30 Ekim 2025
-- Status: Hotfix for Week 3 Canary Test

-- ============================================================================
-- FIX: Remove non-existent column from api_resource_fields
-- ============================================================================

-- Delete 'settings' field from projects (doesn't exist in actual table)
DELETE FROM api_resource_fields
WHERE resource = 'projects' AND column_name = 'settings';

-- ============================================================================
-- ADD: Missing columns from core.projects table
-- ============================================================================

-- Add missing audit columns
INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('projects', 'created_by', true, false, false, 'integer', 'User who created the project'),
('projects', 'is_deleted', true, false, false, 'boolean', 'Soft delete flag'),
('projects', 'deleted_at', true, false, false, 'timestamp', 'Deletion timestamp'),
('projects', 'deleted_by', true, false, false, 'integer', 'User who deleted the project')
ON CONFLICT (resource, column_name) DO NOTHING;

-- ============================================================================
-- VERIFY: Show current projects fields
-- ============================================================================

SELECT 
  column_name,
  readable,
  writable,
  required,
  data_type,
  description
FROM api_resource_fields
WHERE resource = 'projects'
ORDER BY column_name;

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration fixes the mismatch between api_resource_fields and core.projects table.
-- The 'settings' column was defined in metadata but doesn't exist in the actual table.
--
-- core.projects actual columns:
-- - id, tenant_id, name, description, status
-- - created_at, updated_at, created_by
-- - is_deleted, deleted_at, deleted_by
--
-- After this fix, generic handler will only query existing columns.

