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
  '$2b$10$YcCewJ5gTNKVdZTJw.L5qOU3/Cgaanc2ha.Ulwr45DE.vzUTDhyRO',
  'master_admin',
  true,
  'Özgür Altıntaş - Master Admin',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com'
);

