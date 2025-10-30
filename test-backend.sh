#!/bin/bash

# HZM Backend Test Script - Week 4
# Tests backend endpoints and displays results

API_URL="https://hzmdatabasebackend-production.up.railway.app"
EMAIL="ozgurhzm@hzmsoft.com"
API_KEY="hzm_master_admin_2025_secure_key_01234567890"
API_PASSWORD="MasterAdmin2025!SecurePassword"

echo "========================================="
echo "HZM Backend Test Script - Week 4"
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

# Test 12: OpenAPI Spec (Week 4)
echo "12. OpenAPI Specification (JSON)..."
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
echo "Total Tests: 12"
echo ""
echo "Expected Results:"
echo "- Health checks: OK"
echo "- Projects: is_enabled=true (Active)"
echo "- Users: is_enabled=true (Active - Week 4)"
echo "- Tenants: is_enabled=true (Active - Week 4)"
echo "- OpenAPI: Auto-generated docs available"
echo "- Metrics: Request tracking active"
echo ""
echo "Swagger UI: $API_URL/api/v1/admin/docs"
echo "========================================="

