-- ============================================================================
-- Migration: 006_cleanup_and_create_master_admin.sql
-- Description: Cleanup old migration records & create Master Admin user
-- Author: HZM Platform
-- Date: 2025-10-27
-- ============================================================================

-- PART 1: Cleanup old migration records
-- Delete all old/renamed migration records
DELETE FROM public.schema_migrations;

-- Re-insert only the valid migrations (will be executed by migrate.js)
-- This ensures a clean state

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
