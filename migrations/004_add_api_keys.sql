-- Migration: 004_add_api_keys.sql
-- Description: Add API Key and API Password support for users
-- Author: HZM Platform
-- Date: 2025-10-22

-- Add API key columns to core.users table (one by one for idempotency)
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key VARCHAR(64);

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(255);

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;

-- Create index for API key lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_users_api_key ON core.users(api_key) WHERE api_key IS NOT NULL;

-- Note: UNIQUE constraint will be added manually if needed
-- ALTER TABLE core.users ADD CONSTRAINT users_api_key_unique UNIQUE (api_key);

