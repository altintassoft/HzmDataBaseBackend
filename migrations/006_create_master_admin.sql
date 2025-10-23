-- Migration: 006_create_master_admin.sql
-- FORCE-RERUN: true
-- Description: Create Master Admin user for system-wide API access
-- Author: HZM Platform
-- Date: 2025-10-22

-- Clean insert (delete if exists, then insert)
DELETE FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com';

INSERT INTO core.users (
  tenant_id,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
)
VALUES (
  1,
  'ozgurhzm@hzmsoft.com',
  '$2b$10$YcCewJ5gTNKVdZTJw.L5qOU3/Cgaanc2ha.Ulwr45DE.vzUTDhyRO',
  'master_admin',
  true,
  NOW(),
  NOW()
);

