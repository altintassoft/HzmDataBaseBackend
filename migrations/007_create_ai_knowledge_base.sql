-- FORCE-RERUN
-- ============================================================================
-- AI KNOWLEDGE BASE - PRODUCTION SCHEMA
-- Version: 2.0 (Security + Multi-language + Audit Enhanced)
-- ============================================================================

-- ============================================================================
-- STEP 1: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS unaccent;     -- FTS için (Türkçe karakterler)
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Trigram index (fuzzy search)

-- ============================================================================
-- STEP 2: SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS ops;

-- ============================================================================
-- STEP 3: ENUM TYPES (Type Safety)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_kb_report_type') THEN
    CREATE TYPE ops.ai_kb_report_type AS ENUM (
      'analysis',
      'quality',
      'phase_plan',
      'endpoint_strategy',
      'architecture',
      'compliance'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_kb_access_level') THEN
    CREATE TYPE ops.ai_kb_access_level AS ENUM (
      'private',
      'internal',
      'public'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_kb_change_type') THEN
    CREATE TYPE ops.ai_kb_change_type AS ENUM (
      'major',
      'minor',
      'patch',
      'hotfix'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_kb_status') THEN
    CREATE TYPE ops.ai_kb_status AS ENUM (
      'draft',
      'review',
      'published',
      'archived'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_kb_priority') THEN
    CREATE TYPE ops.ai_kb_priority AS ENUM (
      'P0',
      'P1',
      'P2'
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 4: MAIN TABLE
-- ============================================================================
DROP TABLE IF EXISTS ops.ai_knowledge_base CASCADE;

CREATE TABLE ops.ai_knowledge_base (
  -- PRIMARY KEY & IDENTITY
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type ops.ai_kb_report_type NOT NULL,
  report_category VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  summary TEXT,
  
  -- CONTENT
  content TEXT NOT NULL,
  content_format VARCHAR(20) DEFAULT 'markdown',
  content_hash VARCHAR(64),
  word_count INTEGER,
  line_count INTEGER,
  char_count INTEGER,
  estimated_read_time INTEGER,
  
  -- FILE SYNC
  source_file VARCHAR(500),
  source_file_size INTEGER,
  source_file_modified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_status VARCHAR(20),
  
  -- VERSIONING
  version INTEGER DEFAULT 1,
  version_label VARCHAR(50),
  previous_version_id UUID REFERENCES ops.ai_knowledge_base(id),
  is_latest_version BOOLEAN DEFAULT TRUE,
  change_summary TEXT,
  change_type ops.ai_kb_change_type,
  
  -- TAGS & CATEGORIZATION
  tags TEXT[],
  keywords TEXT[],
  topics TEXT[],
  priority ops.ai_kb_priority,
  status ops.ai_kb_status DEFAULT 'draft',
  
  -- RELATIONSHIPS
  parent_id UUID REFERENCES ops.ai_knowledge_base(id),
  related_report_ids UUID[],
  depends_on_ids UUID[],
  
  -- METADATA
  metadata JSONB DEFAULT '{}',
  
  -- ACCESS CONTROL
  is_public BOOLEAN DEFAULT FALSE,
  visible_to_roles TEXT[] DEFAULT ARRAY['master_admin'],
  access_level ops.ai_kb_access_level DEFAULT 'private',
  
  -- STATISTICS
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  last_viewed_by INTEGER REFERENCES core.users(id),
  edit_count INTEGER DEFAULT 0,
  export_count INTEGER DEFAULT 0,
  ai_query_count INTEGER DEFAULT 0,
  
  -- AI INTERACTION
  ai_indexed BOOLEAN DEFAULT FALSE,
  ai_indexed_at TIMESTAMPTZ,
  ai_relevance_score DECIMAL(5,2) CHECK (ai_relevance_score >= 0 AND ai_relevance_score <= 100),
  ai_last_queried_at TIMESTAMPTZ,
  ai_embedding_id VARCHAR(100),
  
  -- SEARCH OPTIMIZATION (TR + EN Hybrid)
  search_vector TSVECTOR,
  search_rank INTEGER DEFAULT 0,
  
  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- USER TRACKING & MULTI-TENANT
  created_by INTEGER REFERENCES core.users(id),
  updated_by INTEGER REFERENCES core.users(id),
  tenant_id INTEGER NOT NULL DEFAULT 1,
  
  -- STATUS FLAGS
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- CONSTRAINTS
  CONSTRAINT uq_ai_kb_source_hash UNIQUE (source_file, content_hash),
  CONSTRAINT chk_ai_kb_content_not_empty CHECK (char_length(content) > 0)
);

-- ============================================================================
-- STEP 5: INDEXES (Performance)
-- ============================================================================

-- Basic indexes
CREATE INDEX idx_ai_kb_type       ON ops.ai_knowledge_base(report_type);
CREATE INDEX idx_ai_kb_category   ON ops.ai_knowledge_base(report_category);
CREATE INDEX idx_ai_kb_status     ON ops.ai_knowledge_base(status);
CREATE INDEX idx_ai_kb_priority   ON ops.ai_knowledge_base(priority);

-- Array indexes (GIN)
CREATE INDEX idx_ai_kb_tags       ON ops.ai_knowledge_base USING GIN(tags);
CREATE INDEX idx_ai_kb_keywords   ON ops.ai_knowledge_base USING GIN(keywords);
CREATE INDEX idx_ai_kb_topics     ON ops.ai_knowledge_base USING GIN(topics);
CREATE INDEX idx_ai_kb_roles      ON ops.ai_knowledge_base USING GIN(visible_to_roles);

-- Versioning
CREATE INDEX idx_ai_kb_latest     ON ops.ai_knowledge_base(is_latest_version);
CREATE INDEX idx_ai_kb_version    ON ops.ai_knowledge_base(version);

-- Status flags
CREATE INDEX idx_ai_kb_active     ON ops.ai_knowledge_base(is_active, is_deleted);
CREATE INDEX idx_ai_kb_featured   ON ops.ai_knowledge_base(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_ai_kb_pinned     ON ops.ai_knowledge_base(is_pinned) WHERE is_pinned = TRUE;

-- Multi-tenant
CREATE INDEX idx_ai_kb_tenant     ON ops.ai_knowledge_base(tenant_id);

-- Timestamps
CREATE INDEX idx_ai_kb_created    ON ops.ai_knowledge_base(created_at);
CREATE INDEX idx_ai_kb_updated    ON ops.ai_knowledge_base(updated_at DESC);

-- Trigram indexes (Fuzzy search)
CREATE INDEX idx_ai_kb_slug_trgm  ON ops.ai_knowledge_base USING GIN (slug gin_trgm_ops);
CREATE INDEX idx_ai_kb_title_trgm ON ops.ai_knowledge_base USING GIN (title gin_trgm_ops);

-- Partial unique: Sadece latest version için slug unique
CREATE UNIQUE INDEX uq_ai_kb_slug_latest
  ON ops.ai_knowledge_base(slug)
  WHERE is_latest_version = TRUE AND is_deleted = FALSE;

-- Full-text search (TR + EN hybrid)
CREATE INDEX idx_ai_kb_search ON ops.ai_knowledge_base USING GIN(search_vector);

-- AI indexes
CREATE INDEX idx_ai_kb_ai_indexed ON ops.ai_knowledge_base(ai_indexed);
CREATE INDEX idx_ai_kb_ai_score   ON ops.ai_knowledge_base(ai_relevance_score DESC) 
  WHERE ai_relevance_score IS NOT NULL;

-- ============================================================================
-- STEP 6: HELPER FUNCTIONS (RLS)
-- ============================================================================

-- Current user ID
CREATE OR REPLACE FUNCTION ops.current_user_id() 
RETURNS INTEGER
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::INTEGER
$$;

-- Current user role
CREATE OR REPLACE FUNCTION ops.current_user_role() 
RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.current_user_role', true), 'anonymous')
$$;

-- Current tenant ID
CREATE OR REPLACE FUNCTION ops.current_tenant_id() 
RETURNS INTEGER
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::INTEGER
$$;

-- ============================================================================
-- STEP 7: RLS POLICIES (Security)
-- ============================================================================

ALTER TABLE ops.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy 1: Master Admin - Full Access (Bypass)
CREATE POLICY ai_kb_master_admin_all
  ON ops.ai_knowledge_base
  FOR ALL TO PUBLIC
  USING (ops.current_user_role() = 'master_admin')
  WITH CHECK (ops.current_user_role() = 'master_admin');

-- Policy 2: Tenant Read - Only own tenant (if not master_admin)
CREATE POLICY ai_kb_tenant_read
  ON ops.ai_knowledge_base
  FOR SELECT TO PUBLIC
  USING (
    ops.current_user_role() <> 'master_admin'
    AND tenant_id = ops.current_tenant_id()
    AND is_active = TRUE 
    AND is_deleted = FALSE
    AND (
      is_public = TRUE
      OR ops.current_user_role() = ANY(visible_to_roles)
    )
  );

-- Policy 3: INSERT - Master Admin only
CREATE POLICY ai_kb_master_admin_insert
  ON ops.ai_knowledge_base
  FOR INSERT TO PUBLIC
  WITH CHECK (ops.current_user_role() = 'master_admin');

-- Policy 4: UPDATE - Master Admin only
CREATE POLICY ai_kb_master_admin_update
  ON ops.ai_knowledge_base
  FOR UPDATE TO PUBLIC
  USING (ops.current_user_role() = 'master_admin')
  WITH CHECK (ops.current_user_role() = 'master_admin');

-- Policy 5: DELETE - Master Admin only
CREATE POLICY ai_kb_master_admin_delete
  ON ops.ai_knowledge_base
  FOR DELETE TO PUBLIC
  USING (ops.current_user_role() = 'master_admin');

-- ============================================================================
-- STEP 8: TRIGGERS (Automation)
-- ============================================================================

-- Trigger 1: Auto-update timestamps
CREATE OR REPLACE FUNCTION ops.update_ai_kb_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'UPDATE' THEN
    NEW.edit_count = OLD.edit_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_kb_update
  BEFORE UPDATE ON ops.ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION ops.update_ai_kb_timestamp();

-- Trigger 2: Auto-update search_vector (TR + EN hybrid)
CREATE OR REPLACE FUNCTION ops.update_ai_kb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('turkish', unaccent(COALESCE(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('turkish', unaccent(COALESCE(NEW.description, ''))), 'B') ||
    setweight(to_tsvector('turkish', unaccent(COALESCE(NEW.content, ''))), 'C') ||
    setweight(to_tsvector('english', unaccent(COALESCE(NEW.title, ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(COALESCE(NEW.description, ''))), 'C') ||
    setweight(to_tsvector('english', unaccent(COALESCE(NEW.content, ''))), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_kb_search
  BEFORE INSERT OR UPDATE OF title, description, content
  ON ops.ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION ops.update_ai_kb_search_vector();

-- Trigger 3: Auto-generate slug (Turkish-aware)
CREATE OR REPLACE FUNCTION ops.generate_ai_kb_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = lower(
      regexp_replace(
        NEW.title, 
        '[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+', 
        '-', 
        'g'
      )
    );
    NEW.slug = trim(both '-' from NEW.slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_kb_slug
  BEFORE INSERT ON ops.ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION ops.generate_ai_kb_slug();

-- Trigger 4: Auto-calculate content analysis
CREATE OR REPLACE FUNCTION ops.analyze_ai_kb_content()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count          = array_length(regexp_split_to_array(NEW.content, '\s+'), 1);
  NEW.char_count          = length(NEW.content);
  NEW.line_count          = array_length(regexp_split_to_array(NEW.content, '\n'), 1);
  NEW.estimated_read_time = GREATEST(1, COALESCE(NEW.word_count, 0) / 200);
  NEW.content_hash        = encode(digest(COALESCE(NEW.content, ''), 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_kb_analyze
  BEFORE INSERT OR UPDATE OF content
  ON ops.ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION ops.analyze_ai_kb_content();

-- Trigger 5: Auto-manage versioning
CREATE OR REPLACE FUNCTION ops.mark_previous_versions_not_latest()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ops.ai_knowledge_base
  SET is_latest_version = FALSE
  WHERE slug = NEW.slug
    AND id <> NEW.id
    AND is_latest_version = TRUE
    AND is_deleted = FALSE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_kb_latest_uniqueness
  AFTER INSERT ON ops.ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION ops.mark_previous_versions_not_latest();

-- ============================================================================
-- STEP 9: VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW ops.ai_knowledge_base_latest AS
SELECT * FROM ops.ai_knowledge_base
WHERE is_latest_version = TRUE
  AND is_active = TRUE
  AND is_deleted = FALSE
ORDER BY updated_at DESC;

CREATE OR REPLACE VIEW ops.ai_knowledge_base_stats AS
SELECT 
  report_type,
  COUNT(*) as total_reports,
  SUM(view_count) as total_views,
  SUM(word_count) as total_words,
  AVG(ai_relevance_score) as avg_relevance,
  MAX(updated_at) as last_updated
FROM ops.ai_knowledge_base
WHERE is_active = TRUE AND is_deleted = FALSE
GROUP BY report_type;

CREATE OR REPLACE VIEW ops.ai_knowledge_base_recent_changes AS
SELECT 
  id,
  title,
  report_type,
  version,
  change_type,
  change_summary,
  updated_by,
  updated_at
FROM ops.ai_knowledge_base
WHERE is_deleted = FALSE
ORDER BY updated_at DESC
LIMIT 50;

-- ============================================================================
-- STEP 10: AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.ai_knowledge_base_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  kb_id UUID REFERENCES ops.ai_knowledge_base(id),
  action VARCHAR(20) NOT NULL,
  changed_fields JSONB,
  user_id INTEGER REFERENCES core.users(id),
  user_role VARCHAR(50),
  tenant_id INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_kb_audit_kb_id ON ops.ai_knowledge_base_audit(kb_id);
CREATE INDEX idx_ai_kb_audit_action ON ops.ai_knowledge_base_audit(action);
CREATE INDEX idx_ai_kb_audit_user ON ops.ai_knowledge_base_audit(user_id);
CREATE INDEX idx_ai_kb_audit_created ON ops.ai_knowledge_base_audit(created_at DESC);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ AI Knowledge Base schema created successfully!';
  RAISE NOTICE '📊 Table: ops.ai_knowledge_base';
  RAISE NOTICE '🔒 RLS: Enabled (5 policies)';
  RAISE NOTICE '⚡ Triggers: 5 active';
  RAISE NOTICE '📑 Views: 3 created';
  RAISE NOTICE '🔍 Indexes: 20+ created';
  RAISE NOTICE '📝 Audit: ops.ai_knowledge_base_audit';
END $$;

