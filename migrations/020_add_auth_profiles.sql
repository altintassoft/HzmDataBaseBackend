-- Migration 020: Resource-Scoped Auth Profiles (A+ Plan - PR-1)
-- Date: 2025-10-31
-- Description: Add auth_profile, require_hmac, ip_allowlist, rate_limit_profile to api_resources
-- Status: SELF-HEALING - Creates table if missing, then adds columns
-- Strategy: Kalıcı çözüm - tablo yoksa oluştur, varsa güncelle

-- ============================================================================
-- PART 0: SELF-HEALING - Ensure api_resources table exists
-- ============================================================================

DO $$
BEGIN
  -- Check if api_resources table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources'
  ) THEN
    RAISE NOTICE 'Migration 020: api_resources table not found, creating minimal version...';
    
    -- Create minimal api_resources table (from Migration 011)
    CREATE TABLE app.api_resources (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      resource VARCHAR(100) UNIQUE NOT NULL,
      schema_name VARCHAR(100) NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_enabled BOOLEAN DEFAULT FALSE,
      is_readonly BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Essential indexes
    CREATE INDEX idx_api_resources_name ON app.api_resources(name);
    CREATE INDEX idx_api_resources_enabled ON app.api_resources(is_enabled) WHERE is_enabled = TRUE;
    
    RAISE NOTICE 'Migration 020: ✅ Minimal api_resources table created';
  ELSE
    RAISE NOTICE 'Migration 020: api_resources table exists, proceeding...';
  END IF;
END $$;

-- ============================================================================
-- PART 1: ADD AUTH PROFILE COLUMNS
-- ============================================================================

DO $$
BEGIN
  -- Check if auth_profile column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources' 
    AND column_name = 'auth_profile'
  ) THEN
    -- Add auth profile columns
    ALTER TABLE app.api_resources
      ADD COLUMN auth_profile TEXT NOT NULL DEFAULT 'EITHER',
      ADD COLUMN require_hmac BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN ip_allowlist CIDR[] NOT NULL DEFAULT '{}',
      ADD COLUMN rate_limit_profile TEXT DEFAULT 'standard';
    
    RAISE NOTICE 'Migration 020: ✅ Auth profile columns added';
  ELSE
    RAISE NOTICE 'Migration 020: ℹ️  Auth profile columns already exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- PART 2: ADD COLUMN COMMENTS
-- ============================================================================

DO $$
BEGIN
  COMMENT ON COLUMN app.api_resources.auth_profile IS 
    'Auth profile: JWT_ONLY, APIKEY_ONLY, EITHER, JWT_AND_APIKEY. Enforced when ENABLE_AUTH_PROFILES=true';
  
  COMMENT ON COLUMN app.api_resources.require_hmac IS 
    'Require HMAC signature (X-Timestamp, X-Nonce, X-Signature headers). Enforced when ENABLE_AUTH_PROFILES=true';
  
  COMMENT ON COLUMN app.api_resources.ip_allowlist IS 
    'IP allowlist (CIDR array). Empty = allow all. Enforced when ENABLE_AUTH_PROFILES=true';
  
  COMMENT ON COLUMN app.api_resources.rate_limit_profile IS 
    'Rate limit profile: standard (60/min), strict (10/min), generous (300/min)';
  
  RAISE NOTICE 'Migration 020: ✅ Column comments added';
END $$;

-- ============================================================================
-- PART 3: CREATE ENUM TYPE (optional validation)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_profile_enum') THEN
    CREATE TYPE app.auth_profile_enum AS ENUM (
      'JWT_ONLY',
      'APIKEY_ONLY',
      'EITHER',
      'JWT_AND_APIKEY'
    );
    RAISE NOTICE 'Migration 020: ✅ auth_profile_enum type created';
  ELSE
    RAISE NOTICE 'Migration 020: ℹ️  auth_profile_enum already exists';
  END IF;
END $$;

-- Note: We don't enforce this enum on the column for flexibility
-- Future profiles (MTLS_ONLY, DPOP_REQUIRED, etc.) can be added without migration

-- ============================================================================
-- PART 4: SEED AUTH PROFILES (Future Enforcement)
-- ============================================================================

DO $$
BEGIN
  -- Only seed if we have auth_profile column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources' 
    AND column_name = 'auth_profile'
  ) THEN
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

    RAISE NOTICE 'Migration 020: ✅ Auth profiles seeded';
  END IF;
END $$;

-- ============================================================================
-- PART 5: CREATE INDEXES (Performance)
-- ============================================================================

DO $$
BEGIN
  -- Create indexes if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'app' 
    AND tablename = 'api_resources' 
    AND indexname = 'idx_api_resources_auth_profile'
  ) THEN
    CREATE INDEX idx_api_resources_auth_profile 
      ON app.api_resources(auth_profile) 
      WHERE is_enabled = TRUE;
    
    RAISE NOTICE 'Migration 020: ✅ auth_profile index created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'app' 
    AND tablename = 'api_resources' 
    AND indexname = 'idx_api_resources_require_hmac'
  ) THEN
    CREATE INDEX idx_api_resources_require_hmac 
      ON app.api_resources(require_hmac) 
      WHERE is_enabled = TRUE AND require_hmac = TRUE;
    
    RAISE NOTICE 'Migration 020: ✅ require_hmac index created';
  END IF;
END $$;

-- ============================================================================
-- PART 6: VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  column_exists BOOLEAN;
  resource_count INTEGER;
BEGIN
  -- Check table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' AND table_name = 'api_resources'
  ) INTO table_exists;
  
  -- Check columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' 
    AND table_name = 'api_resources' 
    AND column_name = 'auth_profile'
  ) INTO column_exists;
  
  IF table_exists AND column_exists THEN
    -- Count resources
    SELECT COUNT(*) INTO resource_count FROM app.api_resources WHERE is_enabled = TRUE;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 020: ✅ COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Table: api_resources ✅';
    RAISE NOTICE 'Columns: auth_profile, require_hmac, ip_allowlist, rate_limit_profile ✅';
    RAISE NOTICE 'Active resources: % ', resource_count;
    RAISE NOTICE 'Feature flag: ENABLE_AUTH_PROFILES=false (default)';
    RAISE NOTICE 'Phase 1: Simple hybrid (JWT OR API Key) ACTIVE';
    RAISE NOTICE 'Phase 4: Resource-scoped profiles (set flag=true)';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING 'Migration 020: ⚠️  Partial completion - table: %, column: %', table_exists, column_exists;
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency use only)
-- ============================================================================

-- To rollback this migration:
/*
-- Drop auth profile columns
ALTER TABLE app.api_resources
  DROP COLUMN IF EXISTS auth_profile,
  DROP COLUMN IF EXISTS require_hmac,
  DROP COLUMN IF EXISTS ip_allowlist,
  DROP COLUMN IF EXISTS rate_limit_profile;

-- Drop enum type
DROP TYPE IF EXISTS app.auth_profile_enum;

-- Drop indexes
DROP INDEX IF EXISTS app.idx_api_resources_auth_profile;
DROP INDEX IF EXISTS app.idx_api_resources_require_hmac;

-- Note: This will NOT drop the api_resources table if it was created by this migration
-- To drop the entire table (DANGEROUS!):
-- DROP TABLE IF EXISTS app.api_resources CASCADE;
*/

-- ============================================================================
-- MIGRATION COMPLETE - SELF-HEALING ✅
-- ============================================================================
-- Strategy:
-- 1. Check if api_resources exists → No? Create minimal version
-- 2. Add auth_profile columns → Already exist? Skip
-- 3. Seed default profiles → Update existing resources
-- 4. Create indexes → Already exist? Skip
-- 5. Verify → Show summary
--
-- Benefits:
-- ✅ Never crashes (self-healing)
-- ✅ Idempotent (can run multiple times)
-- ✅ Backward compatible (works with existing tables)
-- ✅ Forward compatible (creates missing dependencies)
-- ✅ Informative (clear NOTICE messages)
--
-- Next steps:
-- 1. Deploy to Railway (migration runs safely)
-- 2. Test JWT auth on /data/projects
-- 3. Phase 4: Set ENABLE_AUTH_PROFILES=true
-- ============================================================================
