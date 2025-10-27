-- ============================================================================
-- Migration: 006_cleanup_and_create_master_admin.sql
-- Description: Cleanup old migration records & create Master Admin user
-- Author: HZM Platform
-- Date: 2025-10-27
-- FORCE-RERUN: true
-- ============================================================================

-- PART 1: Cleanup old migration records
-- Delete only old/renamed/duplicate migration records
DELETE FROM public.schema_migrations 
WHERE migration_name IN (
  '004_add_api_keys.sql',
  '005_add_api_keys.sql',
  '006_add_api_keys_fixed.sql',
  '007_fix_api_key_length.sql',
  '008_add_api_password_plain.sql',
  '009_create_master_admin.sql',
  '007_ensure_master_admin.sql',
  '008_force_master_admin_final.sql',
  '007_add_migration_checksum.sql',  -- Renamed to 004
  '008_create_projects_table.sql',   -- Renamed to 005
  '007_create_projects_table.sql'    -- Renamed to 005
);

-- Remove duplicate entries (keep only latest)
DELETE FROM public.schema_migrations a
USING public.schema_migrations b
WHERE a.id < b.id 
  AND a.migration_name = b.migration_name;

-- Ensure 001-005 are recorded (if they were lost during cleanup)
-- This is safe because tables already exist
INSERT INTO public.schema_migrations (migration_name, executed_at, executed_by)
SELECT * FROM (VALUES
  ('001_initial_schema.sql', NOW(), 'system'),
  ('002_seed_data.sql', NOW(), 'system'),
  ('003_add_api_keys.sql', NOW(), 'system'),
  ('004_add_migration_checksum.sql', NOW(), 'system'),
  ('005_create_projects_table.sql', NOW(), 'system')
) AS v(migration_name, executed_at, executed_by)
WHERE NOT EXISTS (
  SELECT 1 FROM public.schema_migrations 
  WHERE migration_name = v.migration_name
);

-- PART 2: Create Master Admin user for API access
-- Check if master admin exists, if not create
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com') THEN
    INSERT INTO core.users (
      tenant_id,
      email,
      password_hash,
      role,
      name,
      api_key,
      api_password,
      created_at,
      updated_at
    ) VALUES (
      1,
      'ozgurhzm@hzmsoft.com',
      '$2a$10$dummy.hash.for.master.admin.account',
      'master_admin',
      'Master Admin',
      'hzm_master_admin_2025_secure_key_01234567890',
      'MasterAdmin2025!SecurePassword',
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Master Admin user created successfully';
  ELSE
    -- Update existing master admin credentials
    UPDATE core.users 
    SET 
      api_key = 'hzm_master_admin_2025_secure_key_01234567890',
      api_password = 'MasterAdmin2025!SecurePassword',
      role = 'master_admin',
      updated_at = NOW()
    WHERE email = 'ozgurhzm@hzmsoft.com';
    RAISE NOTICE 'Master Admin user updated successfully';
  END IF;
END $$;
