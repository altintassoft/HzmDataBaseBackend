ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key VARCHAR(64);
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(255);
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_api_key ON core.users(api_key) WHERE api_key IS NOT NULL;

