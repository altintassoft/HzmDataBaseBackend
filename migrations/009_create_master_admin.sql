-- Migration: 009_create_master_admin.sql
-- Description: Create Master Admin user for system-wide API access
-- Author: HZM Platform
-- Date: 2025-10-22

-- Insert Master Admin user (if not exists)
INSERT INTO core.users (
  tenant_id,
  email,
  password_hash,
  role,
  is_active,
  full_name,
  created_at,
  updated_at
)
SELECT
  1,
  'ozgurhzm@hzmsoft.com',
  '$2b$10$rN8xQ5XvH.kXJH5K7Z8xQu5J3K5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  'master_admin',
  true,
  'Master Admin System',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com'
);

