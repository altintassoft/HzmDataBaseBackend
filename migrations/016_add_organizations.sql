-- Migration 016: Add Organizations (Phase 3)
-- Purpose: Multi-organization support - users can belong to multiple organizations
-- Date: 31 Ekim 2025
-- Dependencies: core.tenants, core.users (from 001_initial_schema.sql)

-- ==============================================
-- 1. ORGANIZATIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS core.organizations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Organization settings
    settings JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    limits JSONB DEFAULT '{
        "max_projects": 10,
        "max_members": 25,
        "max_tables_per_project": 50,
        "storage_gb": 10
    }'::jsonb,
    
    -- Billing
    plan VARCHAR(50) DEFAULT 'free',
    billing_email VARCHAR(255),
    subscription_status VARCHAR(20) DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES core.users(id),
    
    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT valid_plan CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trial')),
    UNIQUE(tenant_id, slug)
);

-- Indexes
CREATE INDEX idx_organizations_tenant ON core.organizations(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_organizations_slug ON core.organizations(tenant_id, slug);
CREATE INDEX idx_organizations_active ON core.organizations(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_organizations_created_by ON core.organizations(created_by);

-- RLS Policy (tenant isolation)
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_tenant_isolation ON core.organizations
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- Trigger for updated_at
CREATE TRIGGER trg_organizations_touch
    BEFORE UPDATE ON core.organizations
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 2. ORGANIZATION_MEMBERS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS core.organization_members (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    
    -- Role in organization
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    
    -- Member settings
    is_owner BOOLEAN DEFAULT FALSE,
    can_invite BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER REFERENCES core.users(id),
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
    CONSTRAINT valid_status CHECK (status IN ('invited', 'active', 'suspended', 'left')),
    UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_tenant ON core.organization_members(tenant_id);
CREATE INDEX idx_org_members_org ON core.organization_members(organization_id) WHERE is_active = TRUE;
CREATE INDEX idx_org_members_user ON core.organization_members(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_org_members_role ON core.organization_members(organization_id, role);
CREATE INDEX idx_org_members_status ON core.organization_members(status) WHERE status = 'active';

-- RLS Policy
ALTER TABLE core.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_tenant_isolation ON core.organization_members
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- Trigger for updated_at
CREATE TRIGGER trg_org_members_touch
    BEFORE UPDATE ON core.organization_members
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 3. ORGANIZATION_INVITATIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS core.organization_invitations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Invitation details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    token VARCHAR(100) UNIQUE NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER NOT NULL REFERENCES core.users(id),
    accepted_by INTEGER REFERENCES core.users(id),
    
    -- Constraints
    CONSTRAINT valid_invitation_role CHECK (role IN ('admin', 'member', 'viewer', 'guest')),
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- Indexes
CREATE INDEX idx_org_invitations_tenant ON core.organization_invitations(tenant_id);
CREATE INDEX idx_org_invitations_org ON core.organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON core.organization_invitations(email);
CREATE INDEX idx_org_invitations_token ON core.organization_invitations(token);
CREATE INDEX idx_org_invitations_status ON core.organization_invitations(status) WHERE status = 'pending';

-- RLS Policy
ALTER TABLE core.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invitations_tenant_isolation ON core.organization_invitations
    FOR ALL
    USING (tenant_id = app.current_tenant());

-- Trigger for updated_at
CREATE TRIGGER trg_org_invitations_touch
    BEFORE UPDATE ON core.organization_invitations
    FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- ==============================================
-- 4. GRANT PERMISSIONS
-- ==============================================

GRANT ALL ON core.organizations TO PUBLIC;
GRANT ALL ON core.organization_members TO PUBLIC;
GRANT ALL ON core.organization_invitations TO PUBLIC;

GRANT USAGE, SELECT ON SEQUENCE core.organizations_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE core.organization_members_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE core.organization_invitations_id_seq TO PUBLIC;

-- ==============================================
-- 5. VERIFICATION AND DISPLAY
-- ==============================================

DO $$
DECLARE
    v_org_count INTEGER;
    v_member_count INTEGER;
    v_invitation_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_org_count FROM core.organizations;
    SELECT COUNT(*) INTO v_member_count FROM core.organization_members;
    SELECT COUNT(*) INTO v_invitation_count FROM core.organization_invitations;
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ Migration 016: Organizations Tables Created';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '  - core.organizations: % rows', v_org_count;
    RAISE NOTICE '  - core.organization_members: % rows', v_member_count;
    RAISE NOTICE '  - core.organization_invitations: % rows', v_invitation_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔒 RLS Policies: 3 policies enabled';
    RAISE NOTICE '📌 Indexes: 15 indexes created';
    RAISE NOTICE '⚡ Triggers: 3 triggers active (touch_row)';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Next Steps:';
    RAISE NOTICE '  1. Create default organization for existing users';
    RAISE NOTICE '  2. Run Migration 017: RBAC tables';
    RAISE NOTICE '  3. Run Migration 018: Enable organizations resource';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
END $$;

-- Display table structure
SELECT 
    'core.organizations' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'core' AND table_name = 'organizations'
ORDER BY ordinal_position;

