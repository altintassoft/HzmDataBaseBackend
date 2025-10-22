-- Migration: 003_add_api_keys.sql
-- Description: Add API Key and API Password support for users
-- Author: HZM Platform
-- Date: 2025-10-22

-- Add API key columns to core.users table (one by one for idempotency)
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key VARCHAR(64);
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(255);
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;

-- Add unique constraint (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_api_key_unique' AND conrelid = 'core.users'::regclass
  ) THEN
    ALTER TABLE core.users ADD CONSTRAINT users_api_key_unique UNIQUE (api_key);
  END IF;
END $$;

-- Create index for API key lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_users_api_key ON core.users(api_key) WHERE api_key IS NOT NULL;

-- Add comments (wrapped in DO block to handle errors)
DO $$ 
BEGIN
  EXECUTE 'COMMENT ON COLUMN core.users.api_key IS ''User API Key (visible to user, used as username)''';
  EXECUTE 'COMMENT ON COLUMN core.users.api_key_hash IS ''Bcrypt hash of API Key Password (secret)''';
  EXECUTE 'COMMENT ON COLUMN core.users.api_key_created_at IS ''When API key was created/regenerated''';
  EXECUTE 'COMMENT ON COLUMN core.users.api_key_last_used_at IS ''Last time API key was used for authentication''';
EXCEPTION WHEN OTHERS THEN
  -- Ignore if columns don't exist yet
  NULL;
END $$;

