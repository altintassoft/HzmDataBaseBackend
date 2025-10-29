# 🎯 AI KNOWLEDGE BASE - PRODUCTION-READY PLAN

**Tarih:** 29 Ekim 2025  
**Görev:** Private Master Admin Report Database System  
**Versiyon:** 2.0 (Security + Multi-language + Audit Enhanced)

---

## 📋 PROJE ÖZET

### **Neden?**
- `ANALIZ.md`, `QUALITY_REPORT.txt` gibi hassas raporlar Git'te durmamalı
- Master Admin özel erişim + Multi-tenant isolation
- AI query edilebilir (TR + EN full-text search)
- Version control + Audit trail
- Güvenli (RLS role + tenant based)

### **Ne Olacak?**
```
MEVCUT:
docs/roadmap/ANALIZ.md (1581 satır)
docs/roadmap/QUALITY_REPORT.txt
docs/roadmap/BACKEND_PHASE_PLAN.md
docs/roadmap/SMART_ENDPOINT_STRATEGY_V2.md

YENİ:
PostgreSQL Tablosu: ops.ai_knowledge_base
- 70+ sütun (versioning, search, AI, stats)
- RLS (master_admin + tenant isolation)
- Full-text search (TR + EN hybrid)
- Auto-triggers (5 adet)
- Audit log
- Frontend tab
```

---

## 🗃️ DATABASE SCHEMA (PRODUCTION-READY)

### **Migration File: 007_create_ai_knowledge_base.sql**

```sql
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
  -- ============================================================================
  -- PRIMARY KEY & IDENTITY
  -- ============================================================================
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type ops.ai_kb_report_type NOT NULL,
  report_category VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255), -- Auto-generated, unique per latest version
  description TEXT,
  summary TEXT, -- AI için kısa özet
  
  -- ============================================================================
  -- CONTENT
  -- ============================================================================
  content TEXT NOT NULL, -- Full markdown/text
  content_format VARCHAR(20) DEFAULT 'markdown', -- 'markdown', 'json', 'text', 'html'
  content_hash VARCHAR(64), -- SHA-256 (auto-calculated)
  word_count INTEGER, -- Auto-calculated
  line_count INTEGER, -- Auto-calculated
  char_count INTEGER, -- Auto-calculated
  estimated_read_time INTEGER, -- Dakika (word_count / 200)
  
  -- ============================================================================
  -- FILE SYNC (Opsiyonel)
  -- ============================================================================
  source_file VARCHAR(500), -- 'docs/roadmap/ANALIZ.md'
  source_file_size INTEGER,
  source_file_modified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  sync_status VARCHAR(20), -- 'synced', 'outdated', 'manual', 'never'
  
  -- ============================================================================
  -- VERSIONING
  -- ============================================================================
  version INTEGER DEFAULT 1,
  version_label VARCHAR(50), -- 'v3.0', '2025-Q4'
  previous_version_id UUID REFERENCES ops.ai_knowledge_base(id),
  is_latest_version BOOLEAN DEFAULT TRUE,
  change_summary TEXT,
  change_type ops.ai_kb_change_type,
  
  -- ============================================================================
  -- TAGS & CATEGORIZATION
  -- ============================================================================
  tags TEXT[], -- ['roadmap', 'compliance', 'p0']
  keywords TEXT[], -- ['multi-tenant', 'rls', 'api-versioning']
  topics TEXT[], -- ['Security', 'Database', 'API']
  priority ops.ai_kb_priority,
  status ops.ai_kb_status DEFAULT 'draft',
  
  -- ============================================================================
  -- RELATIONSHIPS
  -- ============================================================================
  parent_id UUID REFERENCES ops.ai_knowledge_base(id),
  related_report_ids UUID[],
  depends_on_ids UUID[],
  
  -- ============================================================================
  -- METADATA (JSONB)
  -- ============================================================================
  metadata JSONB DEFAULT '{}', -- { "author": "admin", "source": "manual" }
  
  -- ============================================================================
  -- ACCESS CONTROL
  -- ============================================================================
  is_public BOOLEAN DEFAULT FALSE,
  visible_to_roles TEXT[] DEFAULT ARRAY['master_admin'],
  access_level ops.ai_kb_access_level DEFAULT 'private',
  
  -- ============================================================================
  -- STATISTICS
  -- ============================================================================
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  last_viewed_by INTEGER REFERENCES core.users(id),
  edit_count INTEGER DEFAULT 0,
  export_count INTEGER DEFAULT 0,
  ai_query_count INTEGER DEFAULT 0,
  
  -- ============================================================================
  -- AI INTERACTION
  -- ============================================================================
  ai_indexed BOOLEAN DEFAULT FALSE,
  ai_indexed_at TIMESTAMPTZ,
  ai_relevance_score DECIMAL(5,2) CHECK (ai_relevance_score >= 0 AND ai_relevance_score <= 100),
  ai_last_queried_at TIMESTAMPTZ,
  ai_embedding_id VARCHAR(100), -- Vector DB embedding ID (future)
  
  -- ============================================================================
  -- SEARCH OPTIMIZATION (TR + EN Hybrid)
  -- ============================================================================
  search_vector TSVECTOR, -- PostgreSQL full-text search (TR + EN)
  search_rank INTEGER DEFAULT 0,
  
  -- ============================================================================
  -- TIMESTAMPS
  -- ============================================================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- ============================================================================
  -- USER TRACKING & MULTI-TENANT
  -- ============================================================================
  created_by INTEGER REFERENCES core.users(id),
  updated_by INTEGER REFERENCES core.users(id),
  tenant_id INTEGER NOT NULL, -- RLS için ZORUNLU
  
  -- ============================================================================
  -- STATUS FLAGS
  -- ============================================================================
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- ============================================================================
  -- CONSTRAINTS
  -- ============================================================================
  -- Aynı source file + content hash = duplicate prevention
  CONSTRAINT uq_ai_kb_source_hash UNIQUE (source_file, content_hash),
  
  -- Content boş olamaz
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
  NEW.edit_count = OLD.edit_count + 1;
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
  -- Turkish (primary) + English (secondary)
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
    -- Turkish character support
    NEW.slug = lower(
      regexp_replace(
        NEW.title, 
        '[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+', 
        '-', 
        'g'
      )
    );
    -- Remove leading/trailing dashes
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

-- Trigger 5: Auto-manage versioning (Mark old versions as not latest)
CREATE OR REPLACE FUNCTION ops.mark_previous_versions_not_latest()
RETURNS TRIGGER AS $$
BEGIN
  -- Aynı slug'a sahip önceki versiyonları "not latest" yap
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

-- View 1: Latest versions only
CREATE OR REPLACE VIEW ops.ai_knowledge_base_latest AS
SELECT * FROM ops.ai_knowledge_base
WHERE is_latest_version = TRUE
  AND is_active = TRUE
  AND is_deleted = FALSE
ORDER BY updated_at DESC;

-- View 2: Statistics summary
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

-- View 3: Audit trail (recent changes)
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
-- STEP 10: AUDIT LOG TABLE (Future Feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.ai_knowledge_base_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  kb_id UUID REFERENCES ops.ai_knowledge_base(id),
  action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'
  changed_fields JSONB, -- { "title": {"old": "...", "new": "..."} }
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
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify installation
DO $$
BEGIN
  RAISE NOTICE '✅ AI Knowledge Base schema created successfully!';
  RAISE NOTICE '📊 Table: ops.ai_knowledge_base';
  RAISE NOTICE '🔒 RLS: Enabled (5 policies)';
  RAISE NOTICE '⚡ Triggers: 5 active';
  RAISE NOTICE '📑 Views: 3 created';
  RAISE NOTICE '🔍 Indexes: 20+ created';
END $$;
```

---

## 📝 BACKEND SERVICE (PRODUCTION-READY)

### **File:** `src/modules/admin/services/ai-knowledge-base.service.js`

```javascript
const pool = require('../../../core/database');
const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');

class AIKnowledgeBaseService {
  /**
   * Set RLS context for current request
   */
  static async setRLSContext(client, user) {
    await client.query(`SET LOCAL app.current_user_id = '${user.id}'`);
    await client.query(`SET LOCAL app.current_user_role = '${user.role}'`);
    await client.query(`SET LOCAL app.current_tenant_id = '${user.tenant_id || 1}'`);
  }

  /**
   * Get all reports (with filters)
   */
  static async getAllReports(filters = {}, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const { report_type, category, tags, status, search, limit = 50, offset = 0 } = filters;
      
      const whereParts = ['is_active = TRUE', 'is_deleted = FALSE'];
      const params = [];
      let paramCount = 1;
      
      if (report_type) {
        whereParts.push(`report_type = $${paramCount++}`);
        params.push(report_type);
      }
      
      if (category) {
        whereParts.push(`report_category = $${paramCount++}`);
        params.push(category);
      }
      
      if (status) {
        whereParts.push(`status = $${paramCount++}`);
        params.push(status);
      }
      
      if (tags && tags.length > 0) {
        whereParts.push(`tags && $${paramCount++}::text[]`);
        params.push(tags);
      }
      
      if (search) {
        whereParts.push(`(
          search_vector @@ to_tsquery('turkish', unaccent($${paramCount}))
          OR search_vector @@ plainto_tsquery('turkish', unaccent($${paramCount}))
          OR search_vector @@ plainto_tsquery('english', unaccent($${paramCount}))
        )`);
        params.push(search);
        paramCount++;
      }
      
      const whereClause = whereParts.join(' AND ');
      
      // Main query
      const query = `
        SELECT 
          id, report_type, report_category, title, slug, description, summary,
          version, version_label, is_latest_version, tags, keywords, topics,
          priority, status, word_count, estimated_read_time, view_count,
          created_at, updated_at, published_at, is_featured, is_pinned
        FROM ops.ai_knowledge_base
        WHERE ${whereClause}
        ORDER BY is_pinned DESC, is_featured DESC, updated_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;
      
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      
      // Count query (with same filters)
      const countQuery = `SELECT COUNT(*) FROM ops.ai_knowledge_base WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params.slice(0, -2)); // Remove limit/offset
      
      return {
        success: true,
        reports: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to get reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get single report by ID or slug
   */
  static async getReport(identifier, incrementView = false, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      const query = `
        SELECT * FROM ops.ai_knowledge_base
        WHERE ${isUUID ? 'id' : 'slug'} = $1
        AND is_active = TRUE AND is_deleted = FALSE
      `;
      
      const result = await client.query(query, [identifier]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Report not found' };
      }
      
      const report = result.rows[0];
      
      // Increment view count
      if (incrementView) {
        await client.query(
          `UPDATE ops.ai_knowledge_base 
           SET view_count = view_count + 1, last_viewed_at = NOW(), last_viewed_by = $1
           WHERE id = $2`,
          [user.id, report.id]
        );
        report.view_count += 1;
        
        // Audit log
        await this.logAudit(client, report.id, 'VIEW', null, user);
      }
      
      return { success: true, report };
    } catch (error) {
      logger.error('Failed to get report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create new report
   */
  static async createReport(data, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      const {
        report_type, report_category, title, description, summary, content,
        tags = [], keywords = [], topics = [], priority = 'P2', status = 'draft',
        metadata = {}, source_file = null
      } = data;
      
      // Validate tenant_id
      const tenant_id = user.tenant_id || 1;
      
      const query = `
        INSERT INTO ops.ai_knowledge_base (
          report_type, report_category, title, description, summary, content,
          tags, keywords, topics, priority, status, metadata, source_file,
          created_by, updated_by, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $15)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        report_type, report_category, title, description, summary, content,
        tags, keywords, topics, priority, status, JSON.stringify(metadata),
        source_file, user.id, tenant_id
      ]);
      
      // Audit log
      await this.logAudit(client, result.rows[0].id, 'INSERT', { data }, user);
      
      await client.query('COMMIT');
      logger.info(`Report created: ${result.rows[0].id} by user ${user.id}`);
      
      return { success: true, report: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update report
   */
  static async updateReport(id, data, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      // Get old data for audit
      const oldData = await client.query('SELECT * FROM ops.ai_knowledge_base WHERE id = $1', [id]);
      if (oldData.rows.length === 0) {
        return { success: false, error: 'Report not found' };
      }
      
      const updates = [];
      const params = [];
      let paramCount = 1;
      
      const allowedFields = [
        'report_category', 'title', 'description', 'summary', 'content',
        'tags', 'keywords', 'topics', 'priority', 'status', 'metadata',
        'is_featured', 'is_pinned'
      ];
      
      const changedFields = {};
      
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          const value = field === 'metadata' ? JSON.stringify(data[field]) : data[field];
          params.push(value);
          changedFields[field] = { old: oldData.rows[0][field], new: value };
        }
      }
      
      if (updates.length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      
      updates.push(`updated_by = $${paramCount++}`);
      params.push(user.id);
      
      params.push(id);
      
      const query = `
        UPDATE ops.ai_knowledge_base
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND is_active = TRUE
        RETURNING *
      `;
      
      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Report not found or update failed' };
      }
      
      // Audit log
      await this.logAudit(client, id, 'UPDATE', { changed_fields: changedFields }, user);
      
      await client.query('COMMIT');
      logger.info(`Report updated: ${id} by user ${user.id}`);
      
      return { success: true, report: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete report (soft delete)
   */
  static async deleteReport(id, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      const query = `
        UPDATE ops.ai_knowledge_base
        SET is_deleted = TRUE, is_active = FALSE, updated_by = $1, archived_at = NOW()
        WHERE id = $2
        RETURNING id, title
      `;
      
      const result = await client.query(query, [user.id, id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Report not found' };
      }
      
      // Audit log
      await this.logAudit(client, id, 'DELETE', null, user);
      
      await client.query('COMMIT');
      logger.info(`Report deleted: ${id} by user ${user.id}`);
      
      return { success: true, message: 'Report deleted successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Import from file (with path security)
   */
  static async importFromFile(filePath, metadata, user) {
    const client = await pool.connect();
    try {
      // Security: Only allow docs/roadmap/ directory
      const allowedPath = path.join(process.cwd(), 'docs', 'roadmap');
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fullPath.startsWith(allowedPath)) {
        return { 
          success: false, 
          error: 'Invalid path. Only files in docs/roadmap/ are allowed.' 
        };
      }
      
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'File not found' };
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);
      
      const data = {
        ...metadata,
        content,
        source_file: filePath,
        metadata: {
          ...metadata.metadata,
          imported_from: filePath,
          file_size: stats.size,
          import_date: new Date().toISOString()
        }
      };
      
      return await this.createReport(data, user);
    } catch (error) {
      logger.error('Failed to import from file:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search reports (TR + EN hybrid)
   */
  static async searchReports(searchTerm, filters = {}, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const query = `
        SELECT 
          id, report_type, report_category, title, description, summary,
          tags, keywords, priority, status, word_count, view_count,
          ts_rank(search_vector, to_tsquery('turkish', unaccent($1))) +
          ts_rank(search_vector, plainto_tsquery('turkish', unaccent($1))) +
          ts_rank(search_vector, plainto_tsquery('english', unaccent($1))) AS rank
        FROM ops.ai_knowledge_base
        WHERE (
          search_vector @@ to_tsquery('turkish', unaccent($1))
          OR search_vector @@ plainto_tsquery('turkish', unaccent($1))
          OR search_vector @@ plainto_tsquery('english', unaccent($1))
        )
        AND is_active = TRUE AND is_deleted = FALSE
        ORDER BY rank DESC, view_count DESC
        LIMIT 20
      `;
      
      const result = await client.query(query, [searchTerm]);
      
      return { success: true, results: result.rows };
    } catch (error) {
      logger.error('Failed to search reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Export report
   */
  static async exportReport(id, format = 'md', user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const result = await this.getReport(id, false, user);
      
      if (!result.success) {
        return result;
      }
      
      // Increment export count
      await client.query(
        'UPDATE ops.ai_knowledge_base SET export_count = export_count + 1 WHERE id = $1',
        [id]
      );
      
      // Audit log
      await this.logAudit(client, id, 'EXPORT', { format }, user);
      
      return {
        success: true,
        content: result.report.content,
        filename: `${result.report.slug}.${format}`,
        format
      };
    } catch (error) {
      logger.error('Failed to export report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics
   */
  static async getStatistics(user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const query = `SELECT * FROM ops.ai_knowledge_base_stats`;
      const result = await client.query(query);
      
      return { success: true, statistics: result.rows };
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Audit log helper
   */
  static async logAudit(client, kb_id, action, changed_fields, user) {
    try {
      const query = `
        INSERT INTO ops.ai_knowledge_base_audit (
          kb_id, action, changed_fields, user_id, user_role, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
        kb_id,
        action,
        changed_fields ? JSON.stringify(changed_fields) : null,
        user.id,
        user.role,
        user.tenant_id || 1
      ]);
    } catch (error) {
      // Non-blocking: log but don't fail the main operation
      logger.warn('Failed to create audit log:', error);
    }
  }
}

module.exports = AIKnowledgeBaseService;
```

---

## 🔧 BACKEND CONTROLLER (UPDATE)

### **File:** `src/modules/admin/admin.controller.js` (Add these methods)

```javascript
const AIKnowledgeBaseService = require('./services/ai-knowledge-base.service');
const logger = require('../../core/logger');

class AdminController {
  // ... existing methods ...

  /**
   * GET /api/v1/admin/knowledge-base
   */
  static async getKnowledgeBaseReports(req, res) {
    try {
      const filters = {
        report_type: req.query.report_type,
        category: req.query.category,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        status: req.query.status,
        search: req.query.search,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };
      
      const result = await AIKnowledgeBaseService.getAllReports(filters, req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base reports:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/:id
   */
  static async getKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const incrementView = req.query.view === 'true';
      
      const result = await AIKnowledgeBaseService.getReport(id, incrementView, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/admin/knowledge-base
   */
  static async createKnowledgeBaseReport(req, res) {
    try {
      const result = await AIKnowledgeBaseService.createReport(req.body, req.user);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to create knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/admin/knowledge-base/:id
   */
  static async updateKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const result = await AIKnowledgeBaseService.updateReport(id, req.body, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to update knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/v1/admin/knowledge-base/:id
   */
  static async deleteKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const result = await AIKnowledgeBaseService.deleteReport(id, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to delete knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/admin/knowledge-base/import
   */
  static async importKnowledgeBaseReport(req, res) {
    try {
      const { file_path, ...metadata } = req.body;
      const result = await AIKnowledgeBaseService.importFromFile(file_path, metadata, req.user);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to import knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/search
   */
  static async searchKnowledgeBase(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ success: false, error: 'Search term required' });
      }
      
      const result = await AIKnowledgeBaseService.searchReports(q, {}, req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to search knowledge base:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base/:id/export
   */
  static async exportKnowledgeBaseReport(req, res) {
    try {
      const { id } = req.params;
      const format = req.query.format || 'md';
      
      const result = await AIKnowledgeBaseService.exportReport(id, format, req.user);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (error) {
      logger.error('Failed to export knowledge base report:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/admin/knowledge-base-stats
   */
  static async getKnowledgeBaseStats(req, res) {
    try {
      const result = await AIKnowledgeBaseService.getStatistics(req.user);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get knowledge base stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = AdminController;
```

---

## 🛤️ BACKEND ROUTES (UPDATE)

### **File:** `src/modules/admin/admin.routes.js` (Add these routes)

```javascript
const express = require('express');
const AdminController = require('./admin.controller');
const { authenticateJwtOrApiKey } = require('../../middleware/auth');

const router = express.Router();

// ... existing routes ...

// ============================================================================
// KNOWLEDGE BASE ROUTES (Master Admin Only)
// ============================================================================

// Middleware to check master_admin role
const requireMasterAdmin = (req, res, next) => {
  if (req.user.role !== 'master_admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Bu endpoint sadece Master Admin içindir.'
    });
  }
  next();
};

// List reports
router.get('/knowledge-base', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseReports
);

// Search reports
router.get('/knowledge-base/search', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.searchKnowledgeBase
);

// Import from file
router.post('/knowledge-base/import', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.importKnowledgeBaseReport
);

// Get single report
router.get('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseReport
);

// Export report
router.get('/knowledge-base/:id/export', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.exportKnowledgeBaseReport
);

// Create report
router.post('/knowledge-base', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.createKnowledgeBaseReport
);

// Update report
router.put('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.updateKnowledgeBaseReport
);

// Delete report
router.delete('/knowledge-base/:id', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.deleteKnowledgeBaseReport
);

// Statistics
router.get('/knowledge-base-stats', 
  authenticateJwtOrApiKey, 
  requireMasterAdmin, 
  AdminController.getKnowledgeBaseStats
);

module.exports = router;
```

---

## 📊 DATA MIGRATION SCRIPT

### **File:** `src/scripts/migrate-reports-to-db.js`

```javascript
const fs = require('fs');
const path = require('path');
const pool = require('../core/database');
const logger = require('../core/logger');

const REPORTS_TO_MIGRATE = [
  {
    file: 'docs/roadmap/ANALIZ.md',
    report_type: 'analysis',
    report_category: 'roadmap',
    title: 'ANALIZ #1: ROADMAP vs KOD UYUMU',
    description: 'Roadmap dokümantasyonu ile gerçek kod implementasyonu arasındaki uyum analizi',
    summary: 'Roadmap özelliklerinin mevcut kod durumu, gap analizi ve P0 görevler',
    tags: ['roadmap', 'compliance', 'architecture', 'p0'],
    keywords: ['multi-tenant', 'rls', 'api-versioning', 'error-handler', 'rate-limiting'],
    topics: ['Security', 'Database', 'API', 'Architecture'],
    priority: 'P0',
    status: 'published'
  },
  {
    file: 'docs/roadmap/QUALITY_REPORT.txt',
    report_type: 'quality',
    report_category: 'technical',
    title: 'Quality Report - Code Quality Analysis',
    description: 'Kapsamlı kod kalitesi, mimari ve dokümantasyon analizi',
    summary: 'Backend ve frontend kod kalite skorları, best practices uyumu',
    tags: ['quality', 'code-review', 'best-practices'],
    keywords: ['eslint', 'prettier', 'testing', 'documentation', 'maintainability'],
    topics: ['Code Quality', 'Testing', 'Documentation'],
    priority: 'P1',
    status: 'published'
  },
  {
    file: 'docs/roadmap/BACKEND_PHASE_PLAN.md',
    report_type: 'phase_plan',
    report_category: 'roadmap',
    title: 'Backend Development Phase Plan',
    description: 'Backend geliştirme fazlarının detaylı planlaması ve takibi',
    summary: 'Phase 1-12 implementation plan, milestones, dependencies',
    tags: ['planning', 'backend', 'phases', 'roadmap'],
    keywords: ['authentication', 'database', 'api', 'deployment', 'testing'],
    topics: ['Backend', 'Planning', 'Roadmap'],
    priority: 'P1',
    status: 'published'
  },
  {
    file: 'docs/roadmap/SMART_ENDPOINT_STRATEGY_V2.md',
    report_type: 'endpoint_strategy',
    report_category: 'technical',
    title: 'Smart Endpoint Strategy V2',
    description: 'RESTful API endpoint tasarım stratejisi ve implementasyon rehberi',
    summary: 'Unified endpoint pattern, versioning, error handling',
    tags: ['api', 'endpoints', 'strategy', 'rest'],
    keywords: ['rest-api', 'versioning', 'error-handling', 'response-format'],
    topics: ['API Design', 'Backend', 'Best Practices'],
    priority: 'P1',
    status: 'published'
  }
];

async function migrateReports() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting reports migration to database...');
    
    // Set RLS context (master_admin)
    await client.query(`SET LOCAL app.current_user_id = '1'`);
    await client.query(`SET LOCAL app.current_user_role = 'master_admin'`);
    await client.query(`SET LOCAL app.current_tenant_id = '1'`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const reportMeta of REPORTS_TO_MIGRATE) {
      try {
        const filePath = path.join(process.cwd(), reportMeta.file);
        
        if (!fs.existsSync(filePath)) {
          logger.warn(`File not found: ${reportMeta.file}`);
          errorCount++;
          continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        
        // Check if already exists (by source_file + content_hash)
        const contentHash = require('crypto')
          .createHash('sha256')
          .update(content)
          .digest('hex');
        
        const existingResult = await client.query(
          `SELECT id FROM ops.ai_knowledge_base WHERE source_file = $1 AND content_hash = $2`,
          [reportMeta.file, contentHash]
        );
        
        if (existingResult.rows.length > 0) {
          logger.info(`Report already exists (identical): ${reportMeta.title}`);
          skippedCount++;
          continue;
        }
        
        // Insert
        const query = `
          INSERT INTO ops.ai_knowledge_base (
            report_type, report_category, title, description, summary, content,
            tags, keywords, topics, priority, status, source_file,
            source_file_size, source_file_modified_at, sync_status,
            metadata, created_by, updated_by, tenant_id, published_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, $18, NOW()
          )
          RETURNING id, title, slug
        `;
        
        const metadata = {
          imported_from: reportMeta.file,
          file_size: stats.size,
          import_date: new Date().toISOString(),
          source: 'migration_script'
        };
        
        const result = await client.query(query, [
          reportMeta.report_type,
          reportMeta.report_category,
          reportMeta.title,
          reportMeta.description,
          reportMeta.summary,
          content,
          reportMeta.tags,
          reportMeta.keywords,
          reportMeta.topics,
          reportMeta.priority,
          reportMeta.status,
          reportMeta.file,
          stats.size,
          stats.mtime,
          'synced',
          JSON.stringify(metadata),
          1, // master_admin user ID
          1  // tenant_id
        ]);
        
        logger.info(`✅ Migrated: ${reportMeta.title}`);
        logger.info(`   ID: ${result.rows[0].id}`);
        logger.info(`   Slug: ${result.rows[0].slug}`);
        successCount++;
        
      } catch (error) {
        logger.error(`Failed to migrate ${reportMeta.file}:`, error);
        errorCount++;
      }
    }
    
    logger.info(`\n📊 Migration completed:`);
    logger.info(`   ✅ Success: ${successCount}`);
    logger.info(`   ⏭️  Skipped: ${skippedCount} (already exists)`);
    logger.info(`   ❌ Errors: ${errorCount}`);
    logger.info(`   📁 Total: ${REPORTS_TO_MIGRATE.length}`);
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrateReports();
}

module.exports = { migrateReports };
```

**Run migration:**
```bash
node src/scripts/migrate-reports-to-db.js
```

---

## 🎨 FRONTEND COMPONENT (PRODUCTION-READY)

### **File:** `src/pages/master-admin/KnowledgeBasePage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Plus, Eye, Edit, Trash2, Download, 
  Filter, X, AlertCircle, CheckCircle
} from 'lucide-react';
import api from '../../services/api';

interface Report {
  id: string;
  report_type: string;
  report_category: string;
  title: string;
  description: string;
  summary: string;
  content?: string;
  tags: string[];
  keywords: string[];
  topics: string[];
  priority: string;
  status: string;
  word_count: number;
  view_count: number;
  estimated_read_time: number;
  created_at: string;
  updated_at: string;
  is_featured: boolean;
  is_pinned: boolean;
  slug: string;
}

const KnowledgeBasePage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success'|'error', message: string} | null>(null);

  useEffect(() => {
    fetchReports();
  }, [filterType, filterStatus]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType !== 'all') {
        params.report_type = filterType;
      }
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const response = await api.get('/admin/knowledge-base', { params });
      
      if (response.success) {
        setReports(response.reports);
      } else {
        showNotification('error', response.error || 'Failed to fetch reports');
      }
    } catch (error: any) {
      console.error('Failed to fetch reports:', error);
      showNotification('error', error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const viewReport = async (report: Report) => {
    try {
      const response = await api.get(`/admin/knowledge-base/${report.id}?view=true`);
      
      if (response.success) {
        setSelectedReport(response.report);
        setShowModal(true);
      } else {
        showNotification('error', response.error || 'Failed to load report');
      }
    } catch (error: any) {
      console.error('Failed to view report:', error);
      showNotification('error', error.message || 'Failed to load report');
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Bu raporu silmek istediğinizden emin misiniz?')) return;
    
    try {
      const response = await api.delete(`/admin/knowledge-base/${id}`);
      
      if (response.success) {
        showNotification('success', 'Report deleted successfully');
        fetchReports();
      } else {
        showNotification('error', response.error || 'Failed to delete report');
      }
    } catch (error: any) {
      console.error('Failed to delete report:', error);
      showNotification('error', error.message || 'Failed to delete report');
    }
  };

  const exportReport = async (id: string, slug: string) => {
    try {
      const response = await fetch(
        `/api/v1/admin/knowledge-base/${id}/export?format=md`,
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('success', 'Report exported successfully');
      } else {
        showNotification('error', 'Failed to export report');
      }
    } catch (error: any) {
      console.error('Failed to export report:', error);
      showNotification('error', error.message || 'Failed to export report');
    }
  };

  const showNotification = (type: 'success'|'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'P1': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'P2': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'draft': return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
      case 'review': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'archived': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'analysis': '📊 Analysis',
      'quality': '✅ Quality',
      'phase_plan': '📅 Phase Plan',
      'endpoint_strategy': '🔗 Endpoint Strategy',
      'architecture': '🏗️ Architecture',
      'compliance': '🔒 Compliance'
    };
    return labels[type] || type;
  };

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    report.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border backdrop-blur-sm flex items-center gap-3 animate-fade-in ${
            notification.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileText size={32} />
                AI Knowledge Base
              </h1>
              <p className="text-gray-400 mt-2">
                Private Master Admin Reports & Documentation
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search reports, tags, keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              <option value="analysis">Analysis</option>
              <option value="quality">Quality</option>
              <option value="phase_plan">Phase Plan</option>
              <option value="endpoint_strategy">Endpoint Strategy</option>
              <option value="architecture">Architecture</option>
              <option value="compliance">Compliance</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Reports Grid */}
        {loading ? (
          <div className="text-center text-white py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No reports found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {report.is_pinned && <span className="text-yellow-400" title="Pinned">📌</span>}
                      {report.is_featured && <span className="text-purple-400" title="Featured">⭐</span>}
                      <span className="text-xs text-gray-400">{getTypeLabel(report.report_type)}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                      {report.title}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{report.description}</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(report.priority)}`}>
                    {report.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                  {report.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/20">
                      #{tag}
                    </span>
                  ))}
                  {report.tags.length > 2 && (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs border border-gray-500/20">
                      +{report.tags.length - 2}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span>{report.word_count?.toLocaleString() || 0} words</span>
                  <span>•</span>
                  <span>{report.estimated_read_time || 0} min</span>
                  <span>•</span>
                  <span>{report.view_count || 0} views</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => viewReport(report)}
                    className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded flex items-center justify-center gap-2 transition-colors border border-purple-500/20"
                  >
                    <Eye size={16} />
                    <span className="text-sm">View</span>
                  </button>
                  <button
                    onClick={() => exportReport(report.id, report.slug)}
                    className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors border border-blue-500/20"
                    title="Export as Markdown"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors border border-red-500/20"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for viewing report */}
        {showModal && selectedReport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-400">{getTypeLabel(selectedReport.report_type)}</span>
                      {selectedReport.is_pinned && <span>📌</span>}
                      {selectedReport.is_featured && <span>⭐</span>}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedReport.title}</h2>
                    <p className="text-gray-400">{selectedReport.description}</p>
                    
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(selectedReport.priority)}`}>
                        {selectedReport.priority}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(selectedReport.status)}`}>
                        {selectedReport.status}
                      </span>
                      {selectedReport.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-white p-2"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-black/20 p-4 rounded border border-white/10">
                    {selectedReport.content || 'Loading content...'}
                  </pre>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 flex justify-between items-center flex-shrink-0">
                <div className="text-sm text-gray-400">
                  {selectedReport.word_count?.toLocaleString()} words • 
                  {selectedReport.estimated_read_time} min read • 
                  {selectedReport.view_count} views
                </div>
                <button
                  onClick={() => exportReport(selectedReport.id, selectedReport.slug)}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded flex items-center gap-2 transition-colors border border-purple-500/20"
                >
                  <Download size={16} />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
```

---

## ✅ IMPLEMENTATION CHECKLIST

### **Phase 1: Database Setup (30 dk)**
- [ ] Migration dosyası oluştur (`007_create_ai_knowledge_base.sql`)
- [ ] Extensions ekle (pgcrypto, unaccent, pg_trgm)
- [ ] ENUM types oluştur
- [ ] Main table oluştur
- [ ] Indexes oluştur (20+)
- [ ] RLS helper functions oluştur
- [ ] RLS policies oluştur (5 adet)
- [ ] Triggers oluştur (5 adet)
- [ ] Views oluştur (3 adet)
- [ ] Audit table oluştur
- [ ] Migration'ı Railway'de çalıştır
- [ ] Tabloyu verify et

### **Phase 2: Backend Development (60 dk)**
- [ ] `AIKnowledgeBaseService` oluştur
- [ ] RLS context helper implement et
- [ ] `AdminController` güncelle (9 yeni method)
- [ ] `admin.routes.js` güncelle (9 yeni route)
- [ ] Path security check implement et
- [ ] Audit logging implement et
- [ ] Lokal test yap

### **Phase 3: Data Migration (30 dk)**
- [ ] Migration script oluştur
- [ ] 4 dosyayı import et (ANALIZ.md, QUALITY_REPORT, vb.)
- [ ] Database'de verify et
- [ ] Duplicate check test et

### **Phase 4: Frontend Development (60 dk)**
- [ ] `KnowledgeBasePage.tsx` oluştur
- [ ] Master Admin route ekle
- [ ] Sidebar'a link ekle
- [ ] Test et (list, view, delete, export)
- [ ] Search test et (TR + EN)

### **Phase 5: Testing & Deployment (30 dk)**
- [ ] Lokal testler
- [ ] RLS testler (master_admin + tenant)
- [ ] FTS testler (TR + EN)
- [ ] Railway deployment
- [ ] Production test
- [ ] Documentation update

---

## ⏱️ TOPLAM SÜRE TAHMİNİ

```
Phase 1: Database Setup        → 30 dk
Phase 2: Backend Development   → 60 dk
Phase 3: Data Migration        → 30 dk
Phase 4: Frontend Development  → 60 dk
Phase 5: Testing & Deployment  → 30 dk
─────────────────────────────────────
TOPLAM:                        → 210 dk (~3.5 saat)
```

---

## 🧪 HIZLI TEST SENARYOLARI

### **1. RLS Test (master_admin)**
```sql
SET LOCAL app.current_user_role='master_admin';
SET LOCAL app.current_tenant_id='1';

SELECT * FROM ops.ai_knowledge_base; -- Should work
INSERT INTO ops.ai_knowledge_base (...) VALUES (...); -- Should work
```

### **2. RLS Test (normal user)**
```sql
SET LOCAL app.current_user_role='user';
SET LOCAL app.current_tenant_id='123';

SELECT * FROM ops.ai_knowledge_base; -- Only tenant_id=123
INSERT INTO ops.ai_knowledge_base (...) VALUES (...); -- Should fail
```

### **3. FTS Test (TR + EN)**
```sql
-- Turkish search
SELECT title FROM ops.ai_knowledge_base
WHERE search_vector @@ plainto_tsquery('turkish', unaccent('uygulama güvenliği'));

-- English search
SELECT title FROM ops.ai_knowledge_base
WHERE search_vector @@ plainto_tsquery('english', unaccent('endpoint strategy'));
```

### **4. Duplicate Prevention Test**
```bash
# Run migration script twice
node src/scripts/migrate-reports-to-db.js
# Second run should skip all (already exists)
```

### **5. Route Test**
```bash
curl http://localhost:8080/api/v1/admin/knowledge-base/search?q=roadmap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚨 RİSK YÖNETİMİ

### **Kritik Riskler:**

1. **RLS Context Not Set**
   - **Risk:** Service queries fail if RLS context not set
   - **Çözüm:** Always call `setRLSContext()` in service methods

2. **Migration Duplicate**
   - **Risk:** Aynı dosyayı tekrar import etme
   - **Çözüm:** `UNIQUE (source_file, content_hash)` constraint

3. **Large Content**
   - **Risk:** Very large files (>10MB)
   - **Çözüm:** PostgreSQL TEXT unlimited, but consider chunking for UI

4. **Frontend Response Handling**
   - **Risk:** `response.data` vs `response` confusion
   - **Çözüm:** Use `response.success` directly (api.ts returns JSON)

5. **Import Path Traversal**
   - **Risk:** `../../etc/passwd` gibi path injection
   - **Çözüm:** Path security check in `importFromFile()`

---

## 📊 BAŞARI KRİTERLERİ

```
✅ Tablo başarıyla oluşturuldu (ops.ai_knowledge_base)
✅ 5 triggers çalışıyor (timestamp, search, slug, content analysis, versioning)
✅ RLS policies çalışıyor (master_admin + tenant isolation)
✅ Backend API endpoints çalışıyor (9 endpoint)
✅ 4 rapor database'e import edildi
✅ Duplicate prevention çalışıyor
✅ Frontend tab çalışıyor (list, view, delete, export)
✅ Search çalışıyor (TR + EN hybrid)
✅ Audit logging çalışıyor
✅ Railway deployment başarılı
```

---

## 🎯 GELECEK ÖZELLİKLER (Future Enhancements)

### **Phase 2 (İleride):**
- [ ] Markdown preview renderer (react-markdown)
- [ ] PDF export support
- [ ] Version diff viewer
- [ ] AI query interface (natural language)
- [ ] Collaborative editing
- [ ] Comment system
- [ ] Approval workflow
- [ ] Scheduled sync (auto-import from files)
- [ ] Vector search (pgvector for AI embeddings)
- [ ] Advanced analytics dashboard
- [ ] Export to Notion/Confluence
- [ ] Webhook notifications

---

## 🎯 SONUÇ

**Bu production-ready plan ile:**
- ✅ Hassas raporlar güvenli database'de (RLS + tenant isolation)
- ✅ Master admin + tenant based access control
- ✅ Version control + Audit trail
- ✅ Full-text search (TR + EN hybrid)
- ✅ AI query ready
- ✅ Duplicate prevention
- ✅ Path security
- ✅ Export functionality
- ✅ Git'ten bağımsız

**Hazır mısın? Başlayalım mı?** 🚀
