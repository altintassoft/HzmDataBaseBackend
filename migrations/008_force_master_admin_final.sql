-- Migration: 008_force_master_admin_final.sql
-- Description: FINAL attempt - Create Master Admin user
-- Author: HZM Platform
-- Date: 2025-10-22
-- Reason: Migration 007 did not run on Railway

-- First, check if user exists and delete if necessary (for clean insert)
DELETE FROM core.users WHERE email = 'ozgurhzm@hzmsoft.com';

-- Insert Master Admin user
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

