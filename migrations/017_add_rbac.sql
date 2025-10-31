-- Migration 017: Add RBAC (Phase 3)
-- Purpose: Role-Based Access Control - granular permissions system
-- Date: 31 Ekim 2025
-- Dependencies: core.tenants, core.users, core.organizations (from 016_add_organizations.sql)

-- ==============================================
-- 1. ROLES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS core.roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Role scope
    scope VARCHAR(50) DEFAULT 'organization',
    organization_id INTEGER REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Role settings
    is_system_role BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#6B7280',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_scope CHECK (scope IN ('system', 'organization', 'project')),
    CONSTRAINT system_role_no_org CHECK (
        (is_system_role = TRUE AND organization_id IS NULL) OR 
        (is_system_role = FALSE)
    ),
    UNIQUE(tenant_id, slug)
);

-- Indexes
CREATE INDEX idx_roles_tenant ON core.roles(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_roles_slug ON core.roles(tenant_id, slug);
CREATE INDEX idx_roles_organization ON core.roles(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_roles_scope ON core.roles(scope);
CREATE INDEX idx_roles_system ON core.roles(is_system_role) WHERE is_system_role = TRUE;

-- RLS Policy
ALTER TABLE core.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_tenant_isolation ON core.roles
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- Trigger for updated_at
CREATE TRIGGER trg_roles_touch
    BEFORE UPDATE ON core.roles
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 2. PERMISSIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS core.permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Permission categorization
    category VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50),
    
    -- Metadata
    is_system_permission BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_category CHECK (category IN (
        'users', 'projects', 'tables', 'data', 'organizations', 
        'roles', 'permissions', 'files', 'api_keys', 'webhooks', 
        'reports', 'admin', 'billing', 'system'
    )),
    CONSTRAINT valid_action CHECK (action IN (
        'create', 'read', 'update', 'delete', 'manage', 'invite', 
        'export', 'import', 'publish', 'execute'
    ))
);

-- Indexes
CREATE INDEX idx_permissions_slug ON core.permissions(slug);
CREATE INDEX idx_permissions_category ON core.permissions(category);
CREATE INDEX idx_permissions_action ON core.permissions(action);
CREATE INDEX idx_permissions_system ON core.permissions(is_system_permission) WHERE is_system_permission = TRUE;

-- Trigger for updated_at
CREATE TRIGGER trg_permissions_touch
    BEFORE UPDATE ON core.permissions
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 3. ROLE_PERMISSIONS TABLE (Many-to-Many)
-- ==============================================

CREATE TABLE IF NOT EXISTS core.role_permissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES core.permissions(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES core.users(id),
    
    -- Constraints
    UNIQUE(role_id, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_tenant ON core.role_permissions(tenant_id);
CREATE INDEX idx_role_permissions_role ON core.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON core.role_permissions(permission_id);

-- RLS Policy
ALTER TABLE core.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_tenant_isolation ON core.role_permissions
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- ==============================================
-- 4. USER_ROLES TABLE (Many-to-Many)
-- ==============================================

CREATE TABLE IF NOT EXISTS core.user_roles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    
    -- Scope context
    scope VARCHAR(50) DEFAULT 'organization',
    organization_id INTEGER REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES core.projects(id) ON DELETE CASCADE,
    
    -- Expiring roles
    expires_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by INTEGER REFERENCES core.users(id),
    
    -- Constraints
    CONSTRAINT valid_user_role_scope CHECK (scope IN ('system', 'organization', 'project')),
    CONSTRAINT organization_scope_requires_org CHECK (
        (scope = 'organization' AND organization_id IS NOT NULL) OR
        (scope != 'organization')
    ),
    CONSTRAINT project_scope_requires_project CHECK (
        (scope = 'project' AND project_id IS NOT NULL) OR
        (scope != 'project')
    ),
    UNIQUE(user_id, role_id, organization_id, project_id)
);

-- Indexes
CREATE INDEX idx_user_roles_tenant ON core.user_roles(tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_user ON core.user_roles(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_role ON core.user_roles(role_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_org ON core.user_roles(organization_id) WHERE is_active = TRUE AND organization_id IS NOT NULL;
CREATE INDEX idx_user_roles_project ON core.user_roles(project_id) WHERE is_active = TRUE AND project_id IS NOT NULL;
CREATE INDEX idx_user_roles_scope ON core.user_roles(scope);
CREATE INDEX idx_user_roles_expires ON core.user_roles(expires_at) WHERE expires_at IS NOT NULL AND is_active = TRUE;

-- RLS Policy
ALTER TABLE core.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_tenant_isolation ON core.user_roles
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- Trigger for updated_at
CREATE TRIGGER trg_user_roles_touch
    BEFORE UPDATE ON core.user_roles
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 5. GRANT PERMISSIONS
-- ==============================================

GRANT ALL ON core.roles TO PUBLIC;
GRANT ALL ON core.permissions TO PUBLIC;
GRANT ALL ON core.role_permissions TO PUBLIC;
GRANT ALL ON core.user_roles TO PUBLIC;

GRANT USAGE, SELECT ON SEQUENCE core.roles_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE core.permissions_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE core.role_permissions_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE core.user_roles_id_seq TO PUBLIC;

-- ==============================================
-- 6. SEED DEFAULT PERMISSIONS (System-wide)
-- ==============================================

INSERT INTO core.permissions (name, slug, description, category, action, resource, is_system_permission) VALUES
-- Users
('Create Users', 'users:create', 'Create new users', 'users', 'create', 'users', TRUE),
('Read Users', 'users:read', 'View user details', 'users', 'read', 'users', TRUE),
('Update Users', 'users:update', 'Edit user details', 'users', 'update', 'users', TRUE),
('Delete Users', 'users:delete', 'Delete users', 'users', 'delete', 'users', TRUE),
('Manage Users', 'users:manage', 'Full user management', 'users', 'manage', 'users', TRUE),

-- Projects
('Create Projects', 'projects:create', 'Create new projects', 'projects', 'create', 'projects', TRUE),
('Read Projects', 'projects:read', 'View project details', 'projects', 'read', 'projects', TRUE),
('Update Projects', 'projects:update', 'Edit project details', 'projects', 'update', 'projects', TRUE),
('Delete Projects', 'projects:delete', 'Delete projects', 'projects', 'delete', 'projects', TRUE),
('Manage Projects', 'projects:manage', 'Full project management', 'projects', 'manage', 'projects', TRUE),

-- Tables
('Create Tables', 'tables:create', 'Create new tables', 'tables', 'create', 'tables', TRUE),
('Read Tables', 'tables:read', 'View table structure', 'tables', 'read', 'tables', TRUE),
('Update Tables', 'tables:update', 'Edit table structure', 'tables', 'update', 'tables', TRUE),
('Delete Tables', 'tables:delete', 'Delete tables', 'tables', 'delete', 'tables', TRUE),
('Manage Tables', 'tables:manage', 'Full table management', 'tables', 'manage', 'tables', TRUE),

-- Data
('Create Data', 'data:create', 'Insert new records', 'data', 'create', 'records', TRUE),
('Read Data', 'data:read', 'View records', 'data', 'read', 'records', TRUE),
('Update Data', 'data:update', 'Edit records', 'data', 'update', 'records', TRUE),
('Delete Data', 'data:delete', 'Delete records', 'data', 'delete', 'records', TRUE),
('Export Data', 'data:export', 'Export data', 'data', 'export', 'records', TRUE),
('Import Data', 'data:import', 'Import data', 'data', 'import', 'records', TRUE),

-- Organizations
('Create Organizations', 'organizations:create', 'Create new organizations', 'organizations', 'create', 'organizations', TRUE),
('Read Organizations', 'organizations:read', 'View organization details', 'organizations', 'read', 'organizations', TRUE),
('Update Organizations', 'organizations:update', 'Edit organization details', 'organizations', 'update', 'organizations', TRUE),
('Delete Organizations', 'organizations:delete', 'Delete organizations', 'organizations', 'delete', 'organizations', TRUE),
('Manage Organizations', 'organizations:manage', 'Full organization management', 'organizations', 'manage', 'organizations', TRUE),
('Invite to Organizations', 'organizations:invite', 'Invite members to organization', 'organizations', 'invite', 'organizations', TRUE),

-- Roles & Permissions
('Create Roles', 'roles:create', 'Create custom roles', 'roles', 'create', 'roles', TRUE),
('Read Roles', 'roles:read', 'View roles', 'roles', 'read', 'roles', TRUE),
('Update Roles', 'roles:update', 'Edit roles', 'roles', 'update', 'roles', TRUE),
('Delete Roles', 'roles:delete', 'Delete roles', 'roles', 'delete', 'roles', TRUE),
('Manage Permissions', 'permissions:manage', 'Assign permissions to roles', 'permissions', 'manage', 'permissions', TRUE),

-- Admin
('Admin Panel Access', 'admin:access', 'Access admin panel', 'admin', 'read', 'admin', TRUE),
('View Audit Logs', 'admin:audit', 'View audit logs', 'admin', 'read', 'audit', TRUE),
('System Configuration', 'admin:config', 'Modify system configuration', 'admin', 'update', 'config', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================
-- 7. VERIFICATION AND DISPLAY
-- ==============================================

DO $$
DECLARE
    v_roles_count INTEGER;
    v_permissions_count INTEGER;
    v_role_permissions_count INTEGER;
    v_user_roles_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_roles_count FROM core.roles;
    SELECT COUNT(*) INTO v_permissions_count FROM core.permissions;
    SELECT COUNT(*) INTO v_role_permissions_count FROM core.role_permissions;
    SELECT COUNT(*) INTO v_user_roles_count FROM core.user_roles;
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ Migration 017: RBAC Tables Created';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '  - core.roles: % rows', v_roles_count;
    RAISE NOTICE '  - core.permissions: % rows', v_permissions_count;
    RAISE NOTICE '  - core.role_permissions: % rows', v_role_permissions_count;
    RAISE NOTICE '  - core.user_roles: % rows', v_user_roles_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔒 RLS Policies: 3 policies enabled';
    RAISE NOTICE '📌 Indexes: 20 indexes created';
    RAISE NOTICE '⚡ Triggers: 3 triggers active (touch_row)';
    RAISE NOTICE '🎯 Permissions seeded: % system permissions', v_permissions_count;
    RAISE NOTICE '';
    RAISE NOTICE '📚 Next Steps:';
    RAISE NOTICE '  1. Create default system roles (via API or Migration 018)';
    RAISE NOTICE '  2. Assign roles to existing users';
    RAISE NOTICE '  3. Implement RBAC middleware in backend';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
END $$;

-- Display permissions by category
SELECT 
    category,
    COUNT(*) as permission_count,
    STRING_AGG(slug, ', ' ORDER BY slug) as permissions
FROM core.permissions
GROUP BY category
ORDER BY category;

