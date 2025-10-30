#!/bin/bash

# HZM Backend Test Script
# Tests backend endpoints and displays results

API_URL="https://hzmdatabasebackend-production.up.railway.app"
EMAIL="ozgurhzm@hzmsoft.com"
API_KEY="hzm_master_admin_2025_secure_key_01234567890"
API_PASSWORD="MasterAdmin2025!SecurePassword"

echo "========================================="
echo "HZM Backend Test Script"
echo "========================================="
echo ""

# Test 1: Health Check
echo "1. Health Check..."
curl -s --max-time 10 "$API_URL/health" | python3 -m json.tool
echo ""

# Test 2: Database Tables
echo "2. Database Tables (Core)..."
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

# Test 3: API Resources (Migration 011)
echo "3. API Resources (Migration 011)..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT resource, schema_name, table_name, is_enabled FROM api_resources ORDER BY resource"}' | \
  python3 -m json.tool
echo ""

# Test 4: Projects Resource Fields
echo "4. Projects Resource Fields..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/admin/database/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name, data_type FROM api_resource_fields WHERE resource='\''projects'\'' ORDER BY column_name"}' | \
  python3 -m json.tool
echo ""

# Test 5: Generic Handler - Projects GET
echo "5. Generic Handler - Projects GET..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/projects" | python3 -m json.tool
echo ""

# Test 6: Generic Handler - Projects COUNT
echo "6. Generic Handler - Projects COUNT..."
curl -s --max-time 15 \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$API_URL/api/v1/data/projects/count" | python3 -m json.tool
echo ""

echo "========================================="
echo "Test Complete!"
echo "========================================="

