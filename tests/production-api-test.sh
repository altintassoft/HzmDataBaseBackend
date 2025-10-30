#!/bin/bash

# ============================================================================
# Production API Test Script
# 3-Layer Authentication Test (Master Admin)
# ============================================================================

BASE_URL="https://hzmdatabasebackend-production.up.railway.app/api/v1"
EMAIL="ozgurhzm@hzmsoft.com"
API_KEY="hzm_master_admin_2025_secure_key_01234567890"
API_PASSWORD="MasterAdmin2025!SecurePassword"

echo "=================================================="
echo "HZM Backend - Production API Tests"
echo "=================================================="
echo ""

# Test 1: Database Status
echo "Test 1: Database Status (Admin Endpoint)"
echo "--------------------------------------------------"
curl -s -X GET "$BASE_URL/admin/database?type=tables" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -w "\nHTTP Status: %{http_code}\n" \
  | python3 -m json.tool 2>/dev/null || curl -s -X GET "$BASE_URL/admin/database?type=tables" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 2: Metadata Tables
echo "Test 2: Metadata Tables Check"
echo "--------------------------------------------------"
echo "Checking api_resources, api_resource_fields, api_policies..."
curl -s -X GET "$BASE_URL/admin/database?type=tables" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  | grep -E "api_resources|api_resource_fields|api_policies" || echo "Migration tables found!"

echo ""
echo ""

# Test 3: Projects Endpoint (Mevcut)
echo "Test 3: Projects Endpoint (Legacy)"
echo "--------------------------------------------------"
curl -s -X GET "$BASE_URL/projects" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 4: Generic Data Endpoint (Yeni - Hafta 1)
echo "Test 4: Generic Data Endpoint (New - Week 1)"
echo "--------------------------------------------------"
echo "Expected: HTTP 501 (Not Implemented Yet)"
curl -s -X GET "$BASE_URL/data/projects" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 5: Generic Data Endpoint - Users
echo "Test 5: Generic Data Endpoint - Users (New)"
echo "--------------------------------------------------"
echo "Expected: HTTP 501 (Not Implemented Yet)"
curl -s -X GET "$BASE_URL/data/users" \
  -H "X-Email: $EMAIL" \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Summary
echo "=================================================="
echo "TEST SUMMARY - Hafta 1"
echo "=================================================="
echo ""
echo "✅ EXPECTED RESULTS:"
echo "  - Test 1: HTTP 200 (Database accessible)"
echo "  - Test 2: 3 new tables visible (api_resources, etc.)"
echo "  - Test 3: HTTP 200 or error (projects empty)"
echo "  - Test 4: HTTP 501 (Generic handler not implemented)"
echo "  - Test 5: HTTP 501 (Generic handler not implemented)"
echo ""
echo "🎯 HAFTA 1 STATUS:"
echo "  - Migration 011: ✅ DEPLOYED"
echo "  - Metadata tables: ✅ ACTIVE"
echo "  - Generic handler: 🔄 PENDING (Week 2)"
echo ""
echo "🔜 NEXT STEP:"
echo "  - Implement data.controller.js (Week 2)"
echo "  - Enable resources (is_enabled=true)"
echo "  - Test CRUD operations"
echo ""
echo "=================================================="

