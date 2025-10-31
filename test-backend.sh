#!/bin/bash

# HZM Backend Test Script - Week 4
# Tests backend endpoints and displays results

API_URL="https://hzmdatabasebackend-production.up.railway.app"
EMAIL="ozgurhzm@hzmsoft.com"
API_KEY="hzm_master_admin_2025_secure_key_01234567890"
API_PASSWORD="MasterAdmin2025!SecurePassword"

echo "========================================="
echo "HZM Backend Test Script - Phase 3"
echo "Week 4 + Phase 3 (Organizations + RBAC)"
echo "========================================="
echo ""

# Test 1: Health Check
echo "1. Health Check..."
curl -s --max-time 10 "$API_URL/health" | python3 -m json.tool
echo ""

# Test 2: Generic Handler Health
echo "2. Generic Handler Health..."
curl -s --max-time 10 "$API_URL/api/v1/data/_health" | python3 -m json.tool
echo ""

# Test 3: Generic Handler Metrics
echo "3. Generic Handler Metrics..."
curl -s --max-time 10 "$API_URL/api/v1/data/_metrics" | python3 -m json.tool
echo ""

# Test 4: Database Tables
echo "4. Database Tables (Core)..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database?type=tables" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Total Tables: {data['summary']['total_tables']}\")
print(\"\nCore Tables:\")
for table in data['tables']:
    if table['schema_name'] == 'core':
        print(f\"  - {table['full_name']}: {table['row_count']} rows\")
"
echo ""

# Test 5: API Resources (Migration 011 + 014 + 015)
echo "5. API Resources Status..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT resource, schema_name, table_name, is_enabled, description FROM api_resources ORDER BY resource"}' | \
  python3 -m json.tool
echo ""

# Test 6: Projects GET
echo "6. Generic Handler - Projects GET..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/projects" | python3 -m json.tool
echo ""

# Test 7: Projects COUNT
echo "7. Generic Handler - Projects COUNT..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/projects/count" | python3 -m json.tool
echo ""

# Test 8: Users GET (Week 4)
echo "8. Generic Handler - Users GET..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/users" | python3 -m json.tool
echo ""

# Test 9: Users COUNT (Week 4)
echo "9. Generic Handler - Users COUNT..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/users/count" | python3 -m json.tool
echo ""

# Test 10: Tenants GET (Week 4)
echo "10. Generic Handler - Tenants GET..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/tenants" | python3 -m json.tool
echo ""

# Test 11: Tenants COUNT (Week 4)
echo "11. Generic Handler - Tenants COUNT..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/tenants/count" | python3 -m json.tool
echo ""

# Test 12: Organizations GET (Phase 3)
echo "12. Generic Handler - Organizations GET..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/organizations" | python3 -m json.tool
echo ""

# Test 13: Organizations COUNT (Phase 3)
echo "13. Generic Handler - Organizations COUNT..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/organizations/count" | python3 -m json.tool
echo ""

# Test 14: Roles Check (Phase 3)
echo "14. RBAC - Roles Table Check..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT name, slug, scope, is_system_role, color FROM core.roles WHERE is_system_role = TRUE ORDER BY CASE slug WHEN '\''platform-admin'\'' THEN 1 WHEN '\''tenant-owner'\'' THEN 2 WHEN '\''admin'\'' THEN 3 WHEN '\''member'\'' THEN 4 WHEN '\''viewer'\'' THEN 5 END"}' | \
  python3 -m json.tool
echo ""

# Test 15: Permissions Count (Phase 3)
echo "15. RBAC - Permissions Count..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT category, COUNT(*) as permission_count FROM core.permissions GROUP BY category ORDER BY category"}' | \
  python3 -m json.tool
echo ""

# Test 16: Role-Permission Mappings (Phase 3)
echo "16. RBAC - Role-Permission Mappings..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT r.name as role_name, COUNT(rp.id) as permission_count FROM core.roles r LEFT JOIN core.role_permissions rp ON r.id = rp.role_id WHERE r.is_system_role = TRUE GROUP BY r.id, r.name ORDER BY permission_count DESC"}' | \
  python3 -m json.tool
echo ""

# Test 17: OpenAPI Spec (Week 4)
echo "17. OpenAPI Specification (JSON)..."
curl -s --max-time 15 "$API_URL/api/v1/admin/docs/openapi.json" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"OpenAPI Version: {data.get('openapi', 'N/A')}\")
print(f\"API Title: {data.get('info', {}).get('title', 'N/A')}\")
print(f\"API Version: {data.get('info', {}).get('version', 'N/A')}\")
print(f\"Total Paths: {len(data.get('paths', {}))}\")
print(\"\nAvailable Resources:\")
for path in data.get('paths', {}).keys():
    if '/data/' in path and not path.endswith('/count'):
        resource = path.split('/data/')[1].split('/')[0].split('?')[0]
        if resource and resource not in ['_metrics', '_health']:
            print(f\"  - {resource}\")
"
echo ""

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Tests: 17"
echo ""
echo "Expected Results:"
echo "- Health checks: OK"
echo "- Week 4 Resources: projects, users, tenants (Active)"
echo "- Phase 3 Resources: organizations (Active)"
echo "- RBAC: 5 system roles (platform-admin, tenant-owner, admin, member, viewer)"
echo "- Permissions: 35+ permissions across 10+ categories"
echo "- Role-Permission Mappings: Platform Admin = All permissions"
echo "- OpenAPI: Auto-generated docs available"
echo "- Metrics: Request tracking active"
echo ""
echo "Swagger UI: $API_URL/api/v1/admin/docs"
echo "========================================="

