-- Migration: 003_add_api_keys.sql
-- Description: Add API Key and API Password support for users
-- Author: HZM Platform
-- Date: 2025-10-22

-- Add API key columns to core.users table
ALTER TABLE core.users 
ADD COLUMN IF NOT EXISTS api_key VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;

-- Create index for API key lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_users_api_key ON core.users(api_key) WHERE api_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN core.users.api_key IS 'User API Key (visible to user, used as username)';
COMMENT ON COLUMN core.users.api_key_hash IS 'Bcrypt hash of API Key Password (secret)';
COMMENT ON COLUMN core.users.api_key_created_at IS 'When API key was created/regenerated';
COMMENT ON COLUMN core.users.api_key_last_used_at IS 'Last time API key was used for authentication';

