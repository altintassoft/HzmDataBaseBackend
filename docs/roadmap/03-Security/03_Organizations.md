# 🏢 Organizations - Multi-Organization System

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Database Schema](#database-schema)
3. [Organization Structure](#organization-structure)
4. [Member Management](#member-management)
5. [API Endpoints](#api-endpoints)
6. [Organization Roles](#organization-roles)
7. [Best Practices](#best-practices)
8. [Use Cases](#use-cases)

---

## 🎯 Genel Bakış

Organizations sistemi, HZM Platform'da multi-tenant yapıyı destekleyen temel bileşendir. Her organizasyon bağımsız bir çalışma alanıdır.

### Temel Özellikler
- ✅ **Multi-Organization Support:** Tek kullanıcı, birden fazla organizasyona üye olabilir
- ✅ **Independent Workspaces:** Her organizasyon izole çalışır
- ✅ **Member Management:** Üye davet, rol atama, yetkilendirme
- ✅ **Project Isolation:** Organizasyon projelerine erişim kontrolü
- ✅ **Custom Settings:** Organization-specific ayarlar
- ✅ **Billing Integration:** Organizasyon bazlı faturalandırma

### Mimari Yapı

```
User (Kullanıcı)
    ├── Organization A
    │   ├── Members (5 kişi)
    │   ├── Projects (10 proje)
    │   └── Settings
    │
    ├── Organization B
    │   ├── Members (15 kişi)
    │   ├── Projects (25 proje)
    │   └── Settings
    │
    └── Organization C (Owner)
        ├── Members (3 kişi)
        ├── Projects (5 proje)
        └── Settings
```

---

## 🗄️ Database Schema

### organizations Table

```sql
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
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
    trial_ends_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT valid_plan CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'))
);

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
```

### organization_members Table

```sql
CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Member role
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
    
    -- Invitation
    invited_by INTEGER REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invitation_token VARCHAR(255),
    invitation_expires_at TIMESTAMP,
    joined_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP,
    
    -- Permissions (optional overrides)
    custom_permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_org_member UNIQUE (organization_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- Indexes
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_active ON organization_members(is_active) WHERE is_active = true;
```

### organization_invitations Table

```sql
CREATE TABLE IF NOT EXISTS organization_invitations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    
    -- Invitation details
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by INTEGER REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, expired
    accepted_at TIMESTAMP,
    accepted_by INTEGER REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

-- Indexes
CREATE INDEX idx_org_invitations_org ON organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX idx_org_invitations_status ON organization_invitations(status);
```

---

## 🏗️ Organization Structure

### Organization Lifecycle

```
1. CREATE
   ↓
   User creates organization
   User becomes Owner automatically
   
2. SETUP
   ↓
   Configure settings
   Set limits
   Add billing info
   
3. INVITE MEMBERS
   ↓
   Send invitation emails
   Members accept invitations
   Members get roles assigned
   
4. CREATE PROJECTS
   ↓
   Organization members create projects
   Projects are isolated per organization
   
5. MANAGE
   ↓
   Add/remove members
   Update settings
   Monitor usage
   Upgrade/downgrade plan
```

### Organization Settings

```json
{
  "branding": {
    "logo_url": "https://cdn.example.com/logo.png",
    "primary_color": "#3B82F6",
    "secondary_color": "#10B981"
  },
  "notifications": {
    "email_notifications": true,
    "slack_webhook": "https://hooks.slack.com/...",
    "discord_webhook": null
  },
  "security": {
    "enforce_2fa": false,
    "allowed_email_domains": ["company.com"],
    "ip_whitelist": ["192.168.1.0/24"]
  },
  "defaults": {
    "default_role": "member",
    "auto_add_to_projects": false,
    "default_project_visibility": "private"
  }
}
```

### Organization Limits

```json
{
  "max_projects": 10,
  "max_members": 25,
  "max_tables_per_project": 50,
  "max_records_per_table": 100000,
  "max_api_requests_per_day": 10000,
  "max_storage_gb": 10,
  "max_file_size_mb": 100
}
```

---

## 👥 Member Management

### Member Roles

#### 1. Owner
```javascript
{
  role: 'owner',
  permissions: {
    organization: ['delete', 'transfer', 'billing'],
    members: ['invite', 'remove', 'changeRole'],
    projects: ['create', 'read', 'update', 'delete'],
    settings: ['update']
  }
}
```

#### 2. Admin
```javascript
{
  role: 'admin',
  permissions: {
    members: ['invite', 'remove'],
    projects: ['create', 'read', 'update', 'delete'],
    settings: ['read']
  }
}
```

#### 3. Member
```javascript
{
  role: 'member',
  permissions: {
    projects: ['create', 'read', 'update'],
    settings: ['read']
  }
}
```

#### 4. Viewer
```javascript
{
  role: 'viewer',
  permissions: {
    projects: ['read'],
    settings: ['read']
  }
}
```

### Member Invitation Flow

```
1. Owner/Admin sends invitation
   POST /api/organizations/:orgId/invitations
   ↓
2. System generates invitation token
   Sends email to invitee
   ↓
3. Invitee clicks invitation link
   GET /api/organizations/invitations/:token
   ↓
4. Invitee accepts invitation
   POST /api/organizations/invitations/:token/accept
   ↓
5. User added to organization_members
   Email notification to owner/admin
```

---

## 📡 API Endpoints

### Organization Management

```
GET    /api/organizations
       → Get user's organizations
       Response: [{ id, name, slug, role, member_count, project_count }]

POST   /api/organizations
       → Create new organization
       Body: { name, slug, description, settings }
       Response: { id, name, slug, created_at }

GET    /api/organizations/:orgId
       → Get organization details
       Response: { id, name, slug, description, settings, limits, stats }

PUT    /api/organizations/:orgId
       → Update organization
       Body: { name, description, settings }
       Requires: owner or admin role

DELETE /api/organizations/:orgId
       → Delete organization
       Requires: owner role
```

### Member Management

```
GET    /api/organizations/:orgId/members
       → List organization members
       Response: [{ user_id, name, email, role, joined_at, last_activity }]

GET    /api/organizations/:orgId/members/:userId
       → Get member details

PUT    /api/organizations/:orgId/members/:userId
       → Update member role
       Body: { role: 'admin' | 'member' | 'viewer' }
       Requires: owner or admin role

DELETE /api/organizations/:orgId/members/:userId
       → Remove member
       Requires: owner or admin role
```

### Invitation Management

```
POST   /api/organizations/:orgId/invitations
       → Send invitation
       Body: { email, role }
       Requires: owner or admin role

GET    /api/organizations/:orgId/invitations
       → List pending invitations
       Response: [{ id, email, role, invited_by, expires_at, status }]

GET    /api/organizations/invitations/:token
       → Get invitation details (public)
       Response: { organization_name, invited_by_name, role, expires_at }

POST   /api/organizations/invitations/:token/accept
       → Accept invitation
       Requires: authentication

DELETE /api/organizations/invitations/:invitationId
       → Cancel invitation
       Requires: owner or admin role
```

### Organization Stats

```
GET    /api/organizations/:orgId/stats
       → Get organization statistics
       Response: {
         member_count,
         project_count,
         table_count,
         total_records,
         storage_used_gb,
         api_requests_today,
         active_members_this_month
       }

GET    /api/organizations/:orgId/usage
       → Get usage details for billing
       Response: {
         current_period: { start, end },
         api_requests: 15234,
         storage_gb: 2.5,
         data_transfer_gb: 10.3,
         compute_hours: 45
       }
```

---

## 🔑 Organization Roles

### Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View organization | ✅ | ✅ | ✅ | ✅ |
| Update settings | ✅ | ✅ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ✅ | ❌ | ❌ |
| Create projects | ✅ | ✅ | ✅ | ❌ |
| Delete projects | ✅ | ✅ | ❌ | ❌ |
| View billing | ✅ | ❌ | ❌ | ❌ |
| Update billing | ✅ | ❌ | ❌ | ❌ |

---

## ✅ Best Practices

### 1. Slug Naming

```javascript
// ✅ Good slugs
organization-name
my-company
acme-corp-2024

// ❌ Bad slugs
Organization Name (spaces)
MyCompany (uppercase)
acme_corp (underscores)
```

### 2. Member Limits

```javascript
// Check limits before adding members
if (currentMembers >= organization.limits.max_members) {
  throw new Error('Member limit reached. Please upgrade your plan.');
}
```

### 3. Invitation Expiry

```javascript
// Set reasonable expiration (7 days)
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7);
```

### 4. Orphan Prevention

```javascript
// Don't allow removing last owner
const ownerCount = await getOwnerCount(orgId);
if (ownerCount <= 1 && memberToRemove.role === 'owner') {
  throw new Error('Cannot remove last owner');
}
```

### 5. Audit Logging

```javascript
// Log all organization changes
await logAudit({
  action: 'organization.member.added',
  organization_id: orgId,
  user_id: newMemberId,
  performed_by: currentUserId,
  metadata: { role: 'member' }
});
```

---

## 📊 Use Cases

### Use Case 1: Freelancer with Multiple Clients

```
Freelancer User
├── Client A Organization (admin)
│   ├── Project: Website
│   └── Project: Mobile App
├── Client B Organization (member)
│   └── Project: Dashboard
└── Personal Organization (owner)
    ├── Project: Portfolio
    └── Project: Blog
```

### Use Case 2: Enterprise Company

```
ACME Corp Organization (10,000 employees)
├── Engineering Team (100 members)
│   ├── Backend Project
│   ├── Frontend Project
│   └── Mobile Project
├── Marketing Team (20 members)
│   ├── Campaign Data
│   └── Analytics Project
└── Finance Team (10 members)
    ├── Accounting Project
    └── Reporting Project
```

### Use Case 3: Agency

```
Digital Agency Organization
├── Owner (1)
├── Admins (3)
├── Developers (10)
├── Designers (5)
└── Clients (as viewers) (15)
    ↓
Each client can view their projects only
```

---

## 🎯 Sonuç

Organizations sistemi, HZM Platform'un multi-tenant altyapısının temelidir.

**Avantajlar:**
- ✅ Complete workspace isolation
- ✅ Flexible member management
- ✅ Scalable to enterprise
- ✅ Per-organization billing
- ✅ Custom settings per org

**Integration Points:**
- 🔐 RBAC System
- 📊 Projects
- 🔑 API Keys
- 💳 Billing
- 📈 Analytics

---

**Dosya:** `03-Security/20_Organizations.md`  
**Versiyon:** 1.0.0  
**Son Güncelleme:** 2025-10-21  
**Durum:** ✅ Production Ready  
**İlişkili Dosyalar:**
- `19_RBAC_System.md` → Role management
- `02_Core_Database_Schema.md` → Core tables
- `08_Security_Auth.md` → Authentication

