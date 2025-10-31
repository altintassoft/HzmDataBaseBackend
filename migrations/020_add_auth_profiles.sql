-- Migration 020: Resource-Scoped Auth Profiles (A+ Plan - PR-1)
-- Date: 2025-10-31
-- Description: Add auth_profile, require_hmac, ip_allowlist, rate_limit_profile to api_resources
-- Status: Schema extension only (enforcement disabled via feature flag)

-- ============================================================================
-- PART 1: CHECK TABLE EXISTS & ALTER TABLE api_resources
-- ============================================================================

-- Check if api_resources table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources'
  ) THEN
    RAISE NOTICE 'Migration 020 SKIPPED: app.api_resources table does not exist. Run migration 011 first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Migration 020: api_resources table found, proceeding...';
END $$;

-- Only proceed if table exists (using DO block for safety)
DO $$
BEGIN
  -- Check if columns already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources' 
    AND column_name = 'auth_profile'
  ) THEN
    ALTER TABLE app.api_resources
      ADD COLUMN auth_profile TEXT NOT NULL DEFAULT 'EITHER',
      ADD COLUMN require_hmac BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN ip_allowlist CIDR[] NOT NULL DEFAULT '{}',
      ADD COLUMN rate_limit_profile TEXT DEFAULT 'standard';
    
    RAISE NOTICE 'Migration 020: Columns added successfully';
  ELSE
    RAISE NOTICE 'Migration 020: Columns already exist, skipping ALTER';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Migration 020: Error during ALTER - %', SQLERRM;
    RAISE;
END $$;

-- Add column comments (safe - will skip if table/column doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'api_resources' AND column_name = 'auth_profile') THEN
    COMMENT ON COLUMN app.api_resources.auth_profile IS 
      'Auth profile: JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY. Enforced when ENABLE_AUTH_PROFILES=true';
    
    COMMENT ON COLUMN app.api_resources.require_hmac IS 
      'Require HMAC signature (X-Timestamp, X-Nonce, X-Signature headers). Enforced when ENABLE_AUTH_PROFILES=true';
    
    COMMENT ON COLUMN app.api_resources.ip_allowlist IS 
      'IP allowlist (CIDR array). Empty = allow all. Enforced when ENABLE_AUTH_PROFILES=true';
    
    COMMENT ON COLUMN app.api_resources.rate_limit_profile IS 
      'Rate limit profile: standard (60/min), strict (10/min), generous (300/min)';
    
    RAISE NOTICE 'Migration 020: Column comments added';
  END IF;
END $$;

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
-- PART 3: SEED AUTH PROFILES (Future Enforcement) - SAFE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'api_resources' AND column_name = 'auth_profile') THEN
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

    RAISE NOTICE 'Migration 020: Auth profiles seeded';
  END IF;
END $$;

-- ============================================================================
-- PART 4: INDEXES (Performance) - SAFE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'api_resources' AND column_name = 'auth_profile') THEN
    CREATE INDEX IF NOT EXISTS idx_api_resources_auth_profile 
      ON app.api_resources(auth_profile) 
      WHERE is_enabled = TRUE;

    CREATE INDEX IF NOT EXISTS idx_api_resources_require_hmac 
      ON app.api_resources(require_hmac) 
      WHERE is_enabled = TRUE AND require_hmac = TRUE;
    
    RAISE NOTICE 'Migration 020: Indexes created';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration) - SAFE
-- ============================================================================

-- Check column additions (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'app' 
      AND table_name = 'api_resources' 
      AND column_name = 'auth_profile'
    ) THEN
      RAISE NOTICE 'Migration 020: ✅ All columns verified successfully';
    ELSE
      RAISE NOTICE 'Migration 020: ⚠️  Columns not found (migration may have been skipped)';
    END IF;
  ELSE
    RAISE NOTICE 'Migration 020: ℹ️  Table api_resources does not exist - migration skipped';
  END IF;
END $$;

-- Display auth profiles (safe - only if table exists)
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'api_resources' AND column_name = 'auth_profile') THEN
    RAISE NOTICE 'Migration 020: Auth profiles summary:';
    FOR r IN 
      SELECT name, auth_profile, require_hmac, rate_limit_profile, is_enabled
      FROM app.api_resources
      WHERE is_enabled = TRUE
      ORDER BY name
    LOOP
      RAISE NOTICE '  - %: % (HMAC: %, Rate: %)', r.name, r.auth_profile, r.require_hmac, r.rate_limit_profile;
    END LOOP;
  END IF;
END $$;

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

