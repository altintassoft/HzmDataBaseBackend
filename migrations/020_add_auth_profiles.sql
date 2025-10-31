-- Migration 020: Resource-Scoped Auth Profiles (A+ Plan - PR-1)
-- Date: 2025-10-31
-- Description: Add auth_profile, require_hmac, ip_allowlist, rate_limit_profile to api_resources
-- Status: Schema extension only (enforcement disabled via feature flag)

-- ============================================================================
-- PART 1: ALTER TABLE api_resources
-- ============================================================================

ALTER TABLE app.api_resources
  ADD COLUMN auth_profile TEXT NOT NULL DEFAULT 'EITHER',
  ADD COLUMN require_hmac BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ip_allowlist CIDR[] NOT NULL DEFAULT '{}',
  ADD COLUMN rate_limit_profile TEXT DEFAULT 'standard';

-- Add column comments
COMMENT ON COLUMN app.api_resources.auth_profile IS 
  'Auth profile: JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY. Enforced when ENABLE_AUTH_PROFILES=true';

COMMENT ON COLUMN app.api_resources.require_hmac IS 
  'Require HMAC signature (X-Timestamp, X-Nonce, X-Signature headers). Enforced when ENABLE_AUTH_PROFILES=true';

COMMENT ON COLUMN app.api_resources.ip_allowlist IS 
  'IP allowlist (CIDR array). Empty = allow all. Enforced when ENABLE_AUTH_PROFILES=true';

COMMENT ON COLUMN app.api_resources.rate_limit_profile IS 
  'Rate limit profile: standard (60/min), strict (10/min), generous (300/min)';

-- ============================================================================
-- PART 2: CREATE ENUM TYPE (optional validation)
-- ============================================================================

CREATE TYPE app.auth_profile_enum AS ENUM (
  'JWT_ONLY',
  'APIKEY_ONLY',
  'EITHER',
  'JWT_AND_APIKEY'
);

-- Note: We don't enforce this enum on the column for flexibility
-- Future profiles (MTLS_ONLY, DPOP_REQUIRED, etc.) can be added without migration

-- ============================================================================
-- PART 3: SEED AUTH PROFILES (Future Enforcement)
-- ============================================================================

-- Admin endpoints: Require JWT + API Key + HMAC (Phase 4)
UPDATE app.api_resources 
SET 
  auth_profile = 'JWT_AND_APIKEY',
  require_hmac = TRUE,
  rate_limit_profile = 'strict'
WHERE name LIKE 'admin.%';

-- Users & Tenants: JWT only (web apps)
UPDATE app.api_resources 
SET auth_profile = 'JWT_ONLY'
WHERE name IN ('users', 'tenants');

-- Projects & Organizations: Either (flexible)
UPDATE app.api_resources 
SET auth_profile = 'EITHER'
WHERE name IN ('projects', 'organizations');

-- Future: Webhooks (API Key only + HMAC)
-- UPDATE app.api_resources 
-- SET auth_profile = 'APIKEY_ONLY', require_hmac = TRUE
-- WHERE name = 'webhooks';

-- ============================================================================
-- PART 4: INDEXES (Performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_resources_auth_profile 
  ON app.api_resources(auth_profile) 
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_api_resources_require_hmac 
  ON app.api_resources(require_hmac) 
  WHERE is_enabled = TRUE AND require_hmac = TRUE;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check column additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources' 
    AND column_name = 'auth_profile'
  ) THEN
    RAISE EXCEPTION 'Migration 020 FAILED: auth_profile column not created';
  END IF;
  
  RAISE NOTICE 'Migration 020: ✅ All columns created successfully';
END $$;

-- Display auth profiles
SELECT 
  name,
  auth_profile,
  require_hmac,
  ip_allowlist,
  rate_limit_profile,
  is_enabled
FROM app.api_resources
WHERE is_enabled = TRUE
ORDER BY name;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To rollback this migration:
/*
ALTER TABLE app.api_resources
  DROP COLUMN IF EXISTS auth_profile,
  DROP COLUMN IF EXISTS require_hmac,
  DROP COLUMN IF EXISTS ip_allowlist,
  DROP COLUMN IF EXISTS rate_limit_profile;

DROP TYPE IF EXISTS app.auth_profile_enum;

DROP INDEX IF EXISTS app.idx_api_resources_auth_profile;
DROP INDEX IF EXISTS app.idx_api_resources_require_hmac;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Deploy authDispatch middleware (feature flagged)
-- 2. Set ENABLE_AUTH_PROFILES=false (default)
-- 3. Test: Frontend should work with JWT
-- 4. Phase 4: Set ENABLE_AUTH_PROFILES=true (enable enforcement)
-- ============================================================================

