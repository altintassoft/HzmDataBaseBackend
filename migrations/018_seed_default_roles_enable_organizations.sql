-- Migration 018: Seed Default Roles + Enable Organizations Resource (Phase 3)
-- Purpose: Create system-wide default roles and enable organizations in Generic Handler
-- Date: 31 Ekim 2025
-- Dependencies: core.roles, core.permissions, core.role_permissions (from 017_add_rbac.sql)

-- ==============================================
-- 1. SEED DEFAULT SYSTEM ROLES
-- ==============================================

-- Get tenant_id = 1 (assumed master tenant for system roles)
DO $$
DECLARE
    v_master_tenant_id INTEGER := 1;
    v_platform_admin_role_id INTEGER;
    v_tenant_owner_role_id INTEGER;
    v_admin_role_id INTEGER;
    v_member_role_id INTEGER;
    v_viewer_role_id INTEGER;
BEGIN
    -- 1.1 Platform Admin Role (System-wide super admin)
    INSERT INTO core.roles (tenant_id, name, slug, description, scope, is_system_role, is_default, color)
    VALUES (
        v_master_tenant_id,
        'Platform Admin',
        'platform-admin',
        'Full platform access - all permissions across all tenants',
        'system',
        TRUE,
        FALSE,
        '#DC2626'
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_platform_admin_role_id;

    -- 1.2 Tenant Owner Role (Tenant-level owner)
    INSERT INTO core.roles (tenant_id, name, slug, description, scope, is_system_role, is_default, color)
    VALUES (
        v_master_tenant_id,
        'Tenant Owner',
        'tenant-owner',
        'Tenant owner - full access to tenant organizations and projects',
        'system',
        TRUE,
        FALSE,
        '#EA580C'
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_tenant_owner_role_id;

    -- 1.3 Admin Role (Organization admin)
    INSERT INTO core.roles (tenant_id, name, slug, description, scope, is_system_role, is_default, color)
    VALUES (
        v_master_tenant_id,
        'Admin',
        'admin',
        'Organization admin - manage projects, members, and settings',
        'organization',
        TRUE,
        FALSE,
        '#F59E0B'
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_admin_role_id;

    -- 1.4 Member Role (Default user role)
    INSERT INTO core.roles (tenant_id, name, slug, description, scope, is_system_role, is_default, color)
    VALUES (
        v_master_tenant_id,
        'Member',
        'member',
        'Standard member - create and manage own projects',
        'organization',
        TRUE,
        TRUE,
        '#10B981'
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_member_role_id;

    -- 1.5 Viewer Role (Read-only)
    INSERT INTO core.roles (tenant_id, name, slug, description, scope, is_system_role, is_default, color)
    VALUES (
        v_master_tenant_id,
        'Viewer',
        'viewer',
        'Read-only access - view projects and data',
        'organization',
        TRUE,
        FALSE,
        '#6B7280'
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    RETURNING id INTO v_viewer_role_id;

    RAISE NOTICE '✅ Created 5 default system roles';
    RAISE NOTICE '  - Platform Admin (ID: %)', v_platform_admin_role_id;
    RAISE NOTICE '  - Tenant Owner (ID: %)', v_tenant_owner_role_id;
    RAISE NOTICE '  - Admin (ID: %)', v_admin_role_id;
    RAISE NOTICE '  - Member (ID: %)', v_member_role_id;
    RAISE NOTICE '  - Viewer (ID: %)', v_viewer_role_id;

    -- ==============================================
    -- 2. ASSIGN PERMISSIONS TO ROLES
    -- ==============================================

    -- 2.1 Platform Admin: ALL permissions
    INSERT INTO core.role_permissions (tenant_id, role_id, permission_id)
    SELECT v_master_tenant_id, v_platform_admin_role_id, id
    FROM core.permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- 2.2 Tenant Owner: All except system config
    INSERT INTO core.role_permissions (tenant_id, role_id, permission_id)
    SELECT v_master_tenant_id, v_tenant_owner_role_id, id
    FROM core.permissions
    WHERE slug NOT IN ('admin:config')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- 2.3 Admin: Organization management + projects + users
    INSERT INTO core.role_permissions (tenant_id, role_id, permission_id)
    SELECT v_master_tenant_id, v_admin_role_id, id
    FROM core.permissions
    WHERE category IN ('projects', 'tables', 'data', 'organizations', 'users', 'roles')
        AND action IN ('create', 'read', 'update', 'delete', 'manage', 'invite')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- 2.4 Member: Projects + data (own projects only)
    INSERT INTO core.role_permissions (tenant_id, role_id, permission_id)
    SELECT v_master_tenant_id, v_member_role_id, id
    FROM core.permissions
    WHERE category IN ('projects', 'tables', 'data')
        AND action IN ('create', 'read', 'update', 'delete', 'export', 'import')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- 2.5 Viewer: Read-only
    INSERT INTO core.role_permissions (tenant_id, role_id, permission_id)
    SELECT v_master_tenant_id, v_viewer_role_id, id
    FROM core.permissions
    WHERE action IN ('read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    RAISE NOTICE '✅ Assigned permissions to all roles';

END $$;

-- ==============================================
-- 3. ENABLE ORGANIZATIONS RESOURCE IN GENERIC HANDLER
-- ==============================================

-- Insert organizations resource
INSERT INTO api_resources (resource, schema_name, table_name, description, is_enabled) VALUES
('organizations', 'core', 'organizations', 'Organization management - multi-org CRUD operations', true)
ON CONFLICT (resource) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Insert organizations resource fields
INSERT INTO api_resource_fields (resource, column_name, readable, writable, required, data_type, description) VALUES
('organizations', 'id', true, false, false, 'integer', 'Organization ID (auto-generated)'),
('organizations', 'tenant_id', true, false, false, 'integer', 'Tenant ID (auto-set)'),
('organizations', 'name', true, true, true, 'text', 'Organization name'),
('organizations', 'slug', true, true, true, 'text', 'URL-friendly identifier (unique per tenant)'),
('organizations', 'description', true, true, false, 'text', 'Organization description'),
('organizations', 'settings', true, true, false, 'jsonb', 'Organization settings (JSON)'),
('organizations', 'features', true, true, false, 'jsonb', 'Enabled features (JSON)'),
('organizations', 'limits', true, true, false, 'jsonb', 'Usage limits (JSON)'),
('organizations', 'plan', true, true, false, 'text', 'Subscription plan (free, starter, pro, enterprise)'),
('organizations', 'billing_email', true, true, false, 'text', 'Billing email address'),
('organizations', 'subscription_status', true, false, false, 'text', 'Subscription status'),
('organizations', 'trial_ends_at', true, false, false, 'timestamp', 'Trial end date'),
('organizations', 'subscription_ends_at', true, false, false, 'timestamp', 'Subscription end date'),
('organizations', 'is_active', true, true, false, 'boolean', 'Organization active status'),
('organizations', 'is_deleted', true, false, false, 'boolean', 'Soft delete flag'),
('organizations', 'deleted_at', true, false, false, 'timestamp', 'Deletion timestamp'),
('organizations', 'version', true, false, false, 'integer', 'Optimistic locking version'),
('organizations', 'created_at', true, false, false, 'timestamp', 'Creation timestamp'),
('organizations', 'updated_at', true, false, false, 'timestamp', 'Last update timestamp'),
('organizations', 'created_by', true, false, false, 'integer', 'Creator user ID')
ON CONFLICT (resource, column_name) DO UPDATE SET
    readable = EXCLUDED.readable,
    writable = EXCLUDED.writable,
    required = EXCLUDED.required,
    description = EXCLUDED.description;

-- Insert RLS policy for organizations
INSERT INTO api_policies (resource, policy_name, predicate_sql, applies_to_roles, applies_to_operations) VALUES
('organizations', 'tenant_isolation', 'tenant_id = $tenant_id', ARRAY['user', 'admin', 'tenant_owner', 'platform_admin'], ARRAY['SELECT', 'UPDATE', 'DELETE']),
('organizations', 'created_by_access', 'created_by = $user_id', ARRAY['user'], ARRAY['UPDATE', 'DELETE'])
ON CONFLICT (resource, policy_name) DO UPDATE SET
    predicate_sql = EXCLUDED.predicate_sql,
    applies_to_roles = EXCLUDED.applies_to_roles,
    applies_to_operations = EXCLUDED.applies_to_operations;

-- ==============================================
-- 4. VERIFICATION AND DISPLAY
-- ==============================================

DO $$
DECLARE
    v_roles_count INTEGER;
    v_role_permissions_count INTEGER;
    v_resource_enabled BOOLEAN;
    v_field_count INTEGER;
    v_policy_count INTEGER;
BEGIN
    -- Count roles and permissions
    SELECT COUNT(*) INTO v_roles_count FROM core.roles WHERE is_system_role = TRUE;
    SELECT COUNT(*) INTO v_role_permissions_count FROM core.role_permissions;
    
    -- Check organizations resource
    SELECT is_enabled INTO v_resource_enabled FROM api_resources WHERE resource = 'organizations';
    SELECT COUNT(*) INTO v_field_count FROM api_resource_fields WHERE resource = 'organizations';
    SELECT COUNT(*) INTO v_policy_count FROM api_policies WHERE resource = 'organizations';
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ Migration 018: Default Roles + Organizations Resource';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 System Roles Created: %', v_roles_count;
    RAISE NOTICE '  - Platform Admin (system scope)';
    RAISE NOTICE '  - Tenant Owner (system scope)';
    RAISE NOTICE '  - Admin (organization scope)';
    RAISE NOTICE '  - Member (organization scope, default)';
    RAISE NOTICE '  - Viewer (organization scope)';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Role-Permission Mappings: %', v_role_permissions_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Generic Handler: Organizations Resource';
    RAISE NOTICE '  - Resource enabled: %', v_resource_enabled;
    RAISE NOTICE '  - Fields defined: %', v_field_count;
    RAISE NOTICE '  - RLS policies: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 API Endpoints Available:';
    RAISE NOTICE '  - GET    /api/v1/data/organizations';
    RAISE NOTICE '  - GET    /api/v1/data/organizations/count';
    RAISE NOTICE '  - GET    /api/v1/data/organizations/:id';
    RAISE NOTICE '  - POST   /api/v1/data/organizations';
    RAISE NOTICE '  - PUT    /api/v1/data/organizations/:id';
    RAISE NOTICE '  - DELETE /api/v1/data/organizations/:id';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Next Steps:';
    RAISE NOTICE '  1. Test organizations CRUD: GET /api/v1/data/organizations';
    RAISE NOTICE '  2. Assign roles to users: INSERT INTO core.user_roles';
    RAISE NOTICE '  3. Implement RBAC middleware in backend';
    RAISE NOTICE '  4. Check OpenAPI docs: /api/v1/admin/docs';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
END $$;

-- Display roles with permission counts
SELECT 
    r.name,
    r.slug,
    r.scope,
    r.is_default,
    r.color,
    COUNT(rp.id) as permission_count
FROM core.roles r
LEFT JOIN core.role_permissions rp ON r.id = rp.role_id
WHERE r.is_system_role = TRUE
GROUP BY r.id, r.name, r.slug, r.scope, r.is_default, r.color
ORDER BY 
    CASE r.slug
        WHEN 'platform-admin' THEN 1
        WHEN 'tenant-owner' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
    END;

-- Display organizations resource info
SELECT 
    resource,
    schema_name,
    table_name,
    is_enabled,
    (SELECT COUNT(*) FROM api_resource_fields WHERE resource = 'organizations') as field_count,
    (SELECT COUNT(*) FROM api_policies WHERE resource = 'organizations') as policy_count,
    created_at,
    updated_at
FROM api_resources 
WHERE resource = 'organizations';

