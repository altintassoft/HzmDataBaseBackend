-- Migration: 007_create_projects_table.sql
-- Description: Create core.projects table for project management
-- Phase: 1 (Core Infrastructure)

-- ============================================================================
-- TABLE: core.projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'completed')),
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES core.users(id),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES core.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON core.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON core.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON core.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON core.projects(is_deleted);

-- Unique constraint: project name must be unique per tenant (excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_name_unique 
  ON core.projects(tenant_id, name) 
  WHERE is_deleted = false;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see projects from their own tenant
CREATE POLICY projects_tenant_isolation ON core.projects
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE core.projects IS 'Core entity: Projects table for managing business projects';
COMMENT ON COLUMN core.projects.id IS 'Unique project identifier (UUID)';
COMMENT ON COLUMN core.projects.tenant_id IS 'Organization/Tenant ID (tenant isolation)';
COMMENT ON COLUMN core.projects.name IS 'Project name (unique per tenant)';
COMMENT ON COLUMN core.projects.description IS 'Project description';
COMMENT ON COLUMN core.projects.status IS 'Project status: active, inactive, archived, completed';
COMMENT ON COLUMN core.projects.created_at IS 'Project creation timestamp';
COMMENT ON COLUMN core.projects.created_by IS 'User who created the project';
COMMENT ON COLUMN core.projects.is_deleted IS 'Soft delete flag';

