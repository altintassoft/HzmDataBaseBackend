# 🔐 RBAC System - Role-Based Access Control

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Database Schema](#database-schema)
3. [3-Level Scope System](#3-level-scope-system)
4. [Default Roles](#default-roles)
5. [Default Permissions](#default-permissions)
6. [Middleware Usage](#middleware-usage)
7. [RBAC Service](#rbac-service)
8. [Permission Check Flow](#permission-check-flow)
9. [API Endpoints](#api-endpoints)
10. [Best Practices](#best-practices)
11. [Security Considerations](#security-considerations)

---

## 🎯 Genel Bakış

HZM Platform'da RBAC (Role-Based Access Control) sistemi, kullanıcı yetkilerini roller ve izinler bazında yöneten kapsamlı bir güvenlik sistemidir.

### Temel Özellikler
- ✅ **3-Level Scope:** System → Organization → Project
- ✅ **Granular Permissions:** 25+ izin kategorisi
- ✅ **Custom Roles:** Organization-specific özel roller
- ✅ **Role Inheritance:** Üst seviye izinler alt seviyelerde geçerli
- ✅ **Expiring Roles:** Geçici rol atama desteği
- ✅ **Audit Trail:** Tüm rol atamaları loglanır
- ✅ **Middleware Integration:** Express middleware desteği

### Mimari Prensipler
```
📊 4 Tablo Modeli:
- roles           → Rol tanımları
- permissions     → İzin tanımları
- role_permissions → Rol-İzin ilişkisi
- user_roles      → Kullanıcı-Rol atamaları

🎯 3 Scope Seviyesi:
- system         → Platform geneli
- organization   → Kuruluş bazlı
- project        → Proje bazlı

🔒 Permission Check Hierarchy:
System Permissions → Organization Permissions → Project Permissions
```

---

## 🗄️ Database Schema

### 1. roles Table
```sql
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Role scope
    scope VARCHAR(50) DEFAULT 'organization', -- system, organization, project
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Role settings
    is_system_role BOOLEAN DEFAULT FALSE, -- System-wide roles (admin, user)
    is_default BOOLEAN DEFAULT FALSE,     -- Default role for new members
    color VARCHAR(7) DEFAULT '#6B7280',   -- UI color for role
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_scope CHECK (scope IN ('system', 'organization', 'project')),
    CONSTRAINT system_role_no_org CHECK (
        (is_system_role = TRUE AND organization_id IS NULL) OR 
        (is_system_role = FALSE)
    )
);

-- Indexes
CREATE INDEX idx_roles_slug ON roles(slug);
CREATE INDEX idx_roles_organization ON roles(organization_id);
CREATE INDEX idx_roles_scope ON roles(scope);
CREATE INDEX idx_roles_system ON roles(is_system_role);
```

### 2. permissions Table
```sql
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Permission categorization
    category VARCHAR(50) NOT NULL, -- users, projects, tables, data, admin, etc.
    action VARCHAR(50) NOT NULL,   -- create, read, update, delete, manage
    resource VARCHAR(50),          -- specific resource if needed
    
    -- Permission scope
    scope VARCHAR(50) DEFAULT 'organization', -- system, organization, project
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_permission_scope CHECK (scope IN ('system', 'organization', 'project')),
    CONSTRAINT unique_permission UNIQUE (category, action, resource, scope)
);

-- Indexes
CREATE INDEX idx_permissions_slug ON permissions(slug);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_scope ON permissions(scope);
```

### 3. role_permissions Table (Many-to-Many)
```sql
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    -- Permission constraints (optional)
    constraints JSONB DEFAULT '{}', -- Additional constraints for this permission
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    
    -- Unique constraint
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

### 4. user_roles Table (Many-to-Many)
```sql
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Role scope context
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Role settings
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP, -- Optional expiration
    
    -- Unique constraint per scope
    CONSTRAINT unique_user_role_org UNIQUE (user_id, role_id, organization_id),
    CONSTRAINT unique_user_role_project UNIQUE (user_id, role_id, project_id),
    
    -- Scope validation
    CONSTRAINT valid_role_scope CHECK (
        (organization_id IS NOT NULL AND project_id IS NULL) OR
        (organization_id IS NULL AND project_id IS NOT NULL) OR
        (organization_id IS NULL AND project_id IS NULL) -- System roles
    )
);

-- Indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX idx_user_roles_project ON user_roles(project_id);
```

---

## 🎯 3-Level Scope System

### Scope Hierarchy

```
┌─────────────────────────────────────────┐
│         SYSTEM SCOPE                    │
│  • Super Admin                          │
│  • System Admin                         │
│  • Platform-wide access                 │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │ ORGANIZATION    │
        │ SCOPE           │
        │  • Org Owner    │
        │  • Org Admin    │
        │  • Org Member   │
        │  • Org Viewer   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ PROJECT SCOPE   │
        │  • Project Owner│
        │  • Project Admin│
        │  • Project Editor│
        │  • Project Viewer│
        └─────────────────┘
```

### Scope Özellikleri

#### System Scope
```javascript
// Sistem genelinde geçerli
{
  scope: 'system',
  organization_id: null,
  project_id: null
}

// Use Cases:
- Platform yönetimi
- Tüm organizasyonlara erişim
- System-wide raporlar
- Global ayarlar
```

#### Organization Scope
```javascript
// Belirli bir organizasyonda geçerli
{
  scope: 'organization',
  organization_id: 123,
  project_id: null
}

// Use Cases:
- Organizasyon yönetimi
- Üye yönetimi
- Organizasyon projelerine erişim
- Organization-level billing
```

#### Project Scope
```javascript
// Belirli bir projede geçerli
{
  scope: 'project',
  organization_id: null,
  project_id: 456
}

// Use Cases:
- Proje veri yönetimi
- Table CRUD operations
- Project API keys
- Project-specific analytics
```

---

## 👥 Default Roles

### System Roles

#### 1. Super Admin
```sql
{
  slug: 'super-admin',
  scope: 'system',
  is_system_role: true,
  color: '#DC2626'
}

Permissions: ALL
- Full platform access
- All system, organization, and project permissions
```

#### 2. System Admin
```sql
{
  slug: 'system-admin',
  scope: 'system',
  is_system_role: true,
  color: '#EA580C'
}

Permissions:
- manage-system
- view-system-stats
- System-level operations
```

#### 3. User
```sql
{
  slug: 'user',
  scope: 'system',
  is_system_role: true,
  is_default: false,
  color: '#059669'
}

Permissions: Basic user access
```

### Organization Roles

#### 1. Organization Owner
```sql
{
  slug: 'org-owner',
  scope: 'organization',
  color: '#7C3AED'
}

Permissions: ALL organization + project permissions
- Full organization control
- Manage members
- Manage projects
- Billing & subscription
```

#### 2. Organization Admin
```sql
{
  slug: 'org-admin',
  scope: 'organization',
  color: '#2563EB'
}

Permissions:
- view-organization
- manage-users, invite-users
- manage-projects, create-projects
- view-tables, view-data, view-reports
```

#### 3. Organization Member
```sql
{
  slug: 'org-member',
  scope: 'organization',
  is_default: true,
  color: '#059669'
}

Permissions:
- view-organization
- view-projects, create-projects
- create-tables, view-tables
- create-data, update-data, view-data
```

#### 4. Organization Viewer
```sql
{
  slug: 'org-viewer',
  scope: 'organization',
  color: '#6B7280'
}

Permissions: Read-only
- All 'read' permissions
- No create/update/delete
```

### Project Roles

#### 1. Project Owner
```sql
{
  slug: 'project-owner',
  scope: 'project',
  color: '#7C3AED'
}

Permissions: Full project access
```

#### 2. Project Admin
```sql
{
  slug: 'project-admin',
  scope: 'project',
  color: '#2563EB'
}

Permissions: Project management
```

#### 3. Project Editor
```sql
{
  slug: 'project-editor',
  scope: 'project',
  color: '#059669'
}

Permissions: Edit data
```

#### 4. Project Viewer
```sql
{
  slug: 'project-viewer',
  scope: 'project',
  color: '#6B7280'
}

Permissions: Read-only
```

---

## 🔑 Default Permissions

### Permission Categories

```javascript
{
  system: [
    'manage-system',
    'view-system-stats'
  ],
  
  users: [
    'manage-users',      // CRUD users
    'view-users',        // List users
    'invite-users'       // Invite new users
  ],
  
  organization: [
    'manage-organization',  // Full control
    'update-organization',  // Update settings
    'view-organization'     // View details
  ],
  
  projects: [
    'manage-projects',   // Full project control
    'create-projects',   // Create new projects
    'update-projects',   // Update project settings
    'view-projects',     // View project list
    'delete-projects'    // Delete projects
  ],
  
  tables: [
    'manage-tables',     // Full table management
    'create-tables',     // Create new tables
    'update-tables',     // Update table structure
    'view-tables',       // View table list
    'delete-tables'      // Delete tables
  ],
  
  data: [
    'manage-data',       // Full data management
    'create-data',       // Insert new data
    'update-data',       // Update existing data
    'view-data',         // View table data
    'delete-data'        // Delete data records
  ],
  
  api: [
    'manage-api-keys',   // CRUD API keys
    'view-api-keys'      // View API keys
  ],
  
  reports: [
    'view-reports',      // View analytics
    'create-reports'     // Create custom reports
  ]
}
```

### Permission Structure
```javascript
{
  slug: 'create-tables',
  name: 'Create Tables',
  description: 'Create new tables',
  category: 'tables',
  action: 'create',
  resource: null,
  scope: 'project'
}
```

---

## 🛡️ Middleware Usage

### 1. requirePermission Middleware

```javascript
import { requirePermission } from '../middleware/rbac.js';

// Require specific permission
router.post('/api/projects', 
  authenticate, 
  requirePermission('create-projects', 'organization'),
  async (req, res) => {
    // Only users with 'create-projects' permission can access
  }
);
```

### 2. requireRole Middleware

```javascript
import { requireRole } from '../middleware/rbac.js';

// Require specific role
router.delete('/api/organizations/:orgId', 
  authenticate, 
  requireRole('org-owner', 'organization'),
  async (req, res) => {
    // Only organization owners can access
  }
);
```

### 3. requireOrganizationMember Middleware

```javascript
import { requireOrganizationMember } from '../middleware/rbac.js';

// Require organization membership
router.get('/api/organizations/:orgId/projects', 
  authenticate, 
  requireOrganizationMember,
  async (req, res) => {
    // Only organization members can access
    // req.organizationRole will be available
  }
);
```

### Permission Check Examples

```javascript
// Check organization permission
router.get('/api/organizations/:orgId/users', 
  authenticate,
  requirePermission('view-users', 'organization'),
  async (req, res) => {
    const { orgId } = req.params;
    // User has permission to view users in this organization
  }
);

// Check project permission
router.post('/api/projects/:projectId/tables', 
  authenticate,
  requirePermission('create-tables', 'project'),
  async (req, res) => {
    const { projectId } = req.params;
    // User has permission to create tables in this project
  }
);

// Check system permission
router.get('/api/admin/stats', 
  authenticate,
  requirePermission('view-system-stats', 'system'),
  async (req, res) => {
    // User has system-level permission
  }
);
```

---

## 🔧 RBAC Service

### Get User Permissions

```javascript
import RBACService from '../services/rbacService.js';

// Get all permissions for user in organization
const result = await RBACService.getUserPermissions(userId, orgId);

// Output:
{
  success: true,
  data: [
    {
      slug: 'create-projects',
      name: 'Create Projects',
      category: 'projects',
      action: 'create',
      scope: 'organization',
      role_slug: 'org-member',
      role_name: 'Organization Member'
    },
    // ... more permissions
  ]
}
```

### Check User Permission

```javascript
// Check if user has specific permission
const hasPermission = await RBACService.checkUserPermission(
  userId, 
  orgId, 
  'manage-users'
);

if (hasPermission) {
  // User can manage users
}
```

### Get User Roles

```javascript
// Get user's roles in organization
const result = await RBACService.getUserRoles(userId, orgId);

// Output:
{
  success: true,
  data: [
    {
      id: 5,
      name: 'Organization Admin',
      slug: 'org-admin',
      scope: 'organization',
      assigned_at: '2025-10-15T10:00:00Z',
      assigned_by_name: 'John Doe'
    }
  ]
}
```

### Create Custom Role

```javascript
// Create organization-specific role
const result = await RBACService.createOrganizationRole(
  orgId,
  {
    name: 'Content Manager',
    slug: 'content-manager',
    description: 'Manages content and media',
    color: '#10B981',
    permissions: [15, 16, 17, 20] // Permission IDs
  },
  creatorUserId
);
```

### Assign Role to User

```javascript
// Assign role to user in organization
const result = await RBACService.assignUserRole(
  userId,
  roleId,
  orgId,
  assignedBy
);

// Output:
{
  success: true,
  data: {
    id: 123,
    user_id: 456,
    role_id: 5,
    organization_id: 789,
    assigned_at: '2025-10-21T12:00:00Z'
  }
}
```

### Remove Role from User

```javascript
const result = await RBACService.removeUserRole(
  userId,
  roleId,
  orgId,
  removedBy
);
```

### Get Available Permissions

```javascript
// Get all permissions for a scope
const result = await RBACService.getAvailablePermissions('organization');

// Output:
{
  success: true,
  data: [
    {
      id: 10,
      slug: 'create-projects',
      name: 'Create Projects',
      category: 'projects',
      action: 'create',
      scope: 'organization'
    },
    // ... more permissions
  ]
}
```

### Update Role Permissions

```javascript
// Update which permissions a role has
const result = await RBACService.updateRolePermissions(
  roleId,
  [10, 11, 12, 15], // New permission IDs
  updatedBy
);
```

---

## 🔍 Permission Check Flow

### 1. System-Level Check
```
User Request
     ↓
Authenticate (JWT)
     ↓
Check System Permissions
     ↓
user_roles → roles → role_permissions → permissions
     ↓
WHERE scope = 'system'
```

### 2. Organization-Level Check
```
User Request (orgId in params)
     ↓
Authenticate (JWT)
     ↓
Check Organization Membership
     ↓
Check Organization Permissions
     ↓
user_roles → roles → role_permissions → permissions
     ↓
WHERE organization_id = orgId OR scope = 'system'
```

### 3. Project-Level Check
```
User Request (projectId in params)
     ↓
Authenticate (JWT)
     ↓
Check Project Access
     ↓
Check Project Permissions
     ↓
user_roles → roles → role_permissions → permissions
     ↓
WHERE project_id = projectId 
   OR organization_id = (project's org)
   OR scope = 'system'
```

### SQL Permission Check Example

```sql
-- Check if user has permission in organization
SELECT 1
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = $1                     -- User ID
  AND ur.organization_id = $2              -- Organization ID
  AND p.slug = $3                          -- Permission slug
  AND ur.is_active = true 
  AND r.is_active = true 
  AND rp.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
LIMIT 1;
```

---

## 📡 API Endpoints

### Role Management

```
GET    /api/rbac/organizations/:orgId/roles
       → List all roles in organization

POST   /api/rbac/organizations/:orgId/roles
       → Create custom role
       Body: { name, slug, description, color, permissions }

GET    /api/rbac/roles/:roleId
       → Get role details

PUT    /api/rbac/roles/:roleId
       → Update role

DELETE /api/rbac/roles/:roleId
       → Delete role

GET    /api/rbac/roles/:roleId/permissions
       → Get role's permissions

PUT    /api/rbac/roles/:roleId/permissions
       → Update role's permissions
       Body: { permissionIds: [...] }
```

### User Role Management

```
GET    /api/rbac/users/:userId/roles
       → Get user's roles

POST   /api/rbac/users/:userId/roles
       → Assign role to user
       Body: { roleId, orgId, projectId, expiresAt }

DELETE /api/rbac/users/:userId/roles/:roleId
       → Remove role from user

GET    /api/rbac/users/:userId/permissions
       → Get user's effective permissions
       Query: ?orgId=123&projectId=456
```

### Permission Management

```
GET    /api/rbac/permissions
       → List all available permissions
       Query: ?scope=organization

GET    /api/rbac/permissions/categories
       → Get permission categories
```

---

## ✅ Best Practices

### 1. Use Permissions, Not Roles

**❌ Bad:**
```javascript
if (user.role === 'admin') {
  // Allow access
}
```

**✅ Good:**
```javascript
if (await hasPermission(user.id, 'manage-users')) {
  // Allow access
}
```

### 2. Always Specify Scope

```javascript
// Be explicit about scope
requirePermission('create-projects', 'organization')

// Not just
requirePermission('create-projects')
```

### 3. Check Context

```javascript
// Extract orgId/projectId from request
const { orgId } = req.params;

// Check permission in that context
await checkOrganizationPermission(userId, orgId, 'manage-users');
```

### 4. Handle Expired Roles

```sql
-- Always check expiration
WHERE (expires_at IS NULL OR expires_at > NOW())
```

### 5. Audit Trail

```javascript
// Always log who assigned/removed roles
{
  assigned_by: currentUserId,
  assigned_at: new Date()
}
```

### 6. Default Roles

```javascript
// Auto-assign default role to new members
const defaultRole = await getDefaultRole('organization');
await assignUserRole(newUserId, defaultRole.id, orgId);
```

### 7. Custom Roles Per Organization

```javascript
// Allow orgs to create their own roles
const customRole = await createOrganizationRole(orgId, {
  name: 'Custom Manager',
  slug: 'custom-manager',
  permissions: [...]
});
```

---

## 🔒 Security Considerations

### 1. Privilege Escalation Prevention

```javascript
// ❌ Don't allow users to assign roles they don't have
async function assignRole(assignerId, targetUserId, roleId) {
  // Check if assigner has permission
  const hasPermission = await checkPermission(assignerId, 'manage-users');
  
  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }
  
  // Prevent privilege escalation
  const assignerRoles = await getUserRoles(assignerId);
  const targetRole = await getRole(roleId);
  
  if (targetRole.scope === 'system' && !isSystemAdmin(assignerId)) {
    throw new Error('Cannot assign system roles');
  }
}
```

### 2. Role Expiration

```javascript
// Use temporary roles for contractors
await assignUserRole(userId, roleId, orgId, assignedBy, {
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});
```

### 3. Permission Constraints

```javascript
// Add constraints to permissions
{
  role_id: 5,
  permission_id: 10,
  constraints: {
    max_projects: 5,
    allowed_environments: ['development', 'staging'],
    ip_whitelist: ['192.168.1.0/24']
  }
}
```

### 4. Audit Logging

```sql
-- Create audit log for role changes
CREATE TABLE role_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  role_id INTEGER,
  organization_id INTEGER,
  action VARCHAR(50), -- 'assigned', 'removed', 'expired'
  performed_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Rate Limiting

```javascript
// Limit permission checks per user
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100 // 100 permission checks per minute
});

app.use('/api', rateLimiter);
```

---

## 📊 Usage Examples

### Example 1: Multi-Organization User

```javascript
// User is member of multiple organizations
User ID: 123
├── Organization A (ID: 1)
│   ├── Role: Organization Admin
│   └── Permissions: manage-users, create-projects, view-data
│
└── Organization B (ID: 2)
    ├── Role: Organization Member
    └── Permissions: view-projects, create-data

// Checking permissions
await checkPermission(123, 1, 'manage-users')  // ✅ true
await checkPermission(123, 2, 'manage-users')  // ❌ false
await checkPermission(123, 2, 'create-data')   // ✅ true
```

### Example 2: Project-Specific Access

```javascript
// User with project-specific role
User ID: 456
└── Project X (ID: 100)
    ├── Role: Project Editor
    └── Permissions: create-data, update-data, view-data

// Can edit data in Project X
await checkProjectPermission(456, 100, 'update-data')  // ✅ true

// Cannot edit data in Project Y
await checkProjectPermission(456, 200, 'update-data')  // ❌ false
```

### Example 3: Custom Role Creation

```javascript
// Organization creates custom role for designers
const designerRole = await RBACService.createOrganizationRole(
  orgId,
  {
    name: 'Designer',
    slug: 'designer',
    description: 'UI/UX design access',
    color: '#EC4899',
    permissions: [
      'view-projects',
      'view-tables',
      'view-data',
      'create-data',  // Can add design assets
      'update-data'   // Can update designs
    ]
  },
  creatorUserId
);

// Assign to designer users
await RBACService.assignUserRole(designerUserId, designerRole.id, orgId);
```

---

## 🎯 Sonuç

RBAC sistemi, HZM Platform'un güvenlik mimarisinin temelidir. 3-level scope sistemi ile granular yetkilendirme sağlar.

**Avantajlar:**
- ✅ Fine-grained access control
- ✅ Flexible role management
- ✅ Scalable permission system
- ✅ Audit trail
- ✅ Multi-organization support
- ✅ Project-level isolation

**Use Cases:**
- 👥 Multi-tenant SaaS platforms
- 🏢 Enterprise applications
- 🔐 Compliance requirements
- 📊 Data governance
- 🌍 Multi-organization platforms

---

**Dosya:** `03-Security/19_RBAC_System.md`  
**Versiyon:** 1.0.0  
**Son Güncelleme:** 2025-10-21  
**Durum:** ✅ Production Ready  
**İlişkili Dosyalar:**
- `02-Core_Database_Schema.md` → users, organizations, projects
- `08_Security_Auth.md` → Authentication
- `20_Organizations.md` → Organization management

