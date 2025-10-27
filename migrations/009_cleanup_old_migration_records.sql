-- ============================================================================
-- Migration: 009_cleanup_old_migration_records.sql
-- Description: Clean up old/duplicate migration records and fix numbering
-- Author: HZM Platform
-- Date: 2025-10-27
-- ============================================================================

-- 1. Delete old/duplicate migration records that no longer exist as files
DELETE FROM public.schema_migrations 
WHERE migration_name IN (
  '004_add_api_keys.sql',
  '005_add_api_keys.sql', 
  '006_add_api_keys_fixed.sql',
  '007_fix_api_key_length.sql',
  '008_add_api_password_plain.sql',
  '009_create_master_admin.sql',
  '007_ensure_master_admin.sql',
  '008_force_master_admin_final.sql'
);

-- 2. Update renamed migration file (007 -> 008)
UPDATE public.schema_migrations 
SET migration_name = '008_create_projects_table.sql'
WHERE migration_name = '007_create_projects_table.sql';

-- 3. Keep only the latest execution for duplicate entries
DELETE FROM public.schema_migrations a
USING public.schema_migrations b
WHERE a.id < b.id 
  AND a.migration_name = b.migration_name;

-- Verify cleanup
-- Expected result: 8 migration records (001-008)
DO $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM public.schema_migrations;
  RAISE NOTICE 'Migration records after cleanup: %', record_count;
END $$;

