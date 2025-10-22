-- Migration: 007_ensure_master_admin.sql
-- Description: FORCE create Master Admin user (fixes migration tracking issue)
-- Author: HZM Platform
-- Date: 2025-10-22
-- Reason: 006 was skipped due to tracking table having old "009" name

-- FORCE insert Master Admin user (ignore if exists)
INSERT INTO core.users (
  tenant_id,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
)
SELECT
  1,
  'ozgurhzm@hzmsoft.com',
  '$2b$10$YcCewJ5gTNKVdZTJw.L5qOU3/Cgaanc2ha.Ulwr45DE.vzUTDhyRO',
  'master_admin',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com'
);

