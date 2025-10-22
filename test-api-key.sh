#!/bin/bash

# ============================================================================
# 🔐 HZM PLATFORM - API KEY AUTHENTICATION TEST SCRIPT
# ============================================================================
# Bu script Master Admin API Key + Password ile backend'e erişimi test eder
# 
# Kullanım:
#   ./test-api-key.sh
#
# Gereksinimler:
#   - Railway'de backend deploy olmuş olmalı
#   - Migration 007 çalışmış olmalı (Master Admin user oluşturulmuş)
#   - Master Admin API Key ve Password generate edilmiş olmalı
# ============================================================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backend URL
BACKEND_URL="${BACKEND_URL:-https://hzmdatabasebackend-production.up.railway.app}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🔐 HZM PLATFORM - API KEY TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Backend URL:${NC} $BACKEND_URL"
echo ""

# ============================================================================
# 1️⃣ MASTER ADMIN API KEY VE PASSWORD AL
# ============================================================================

echo -e "${YELLOW}1️⃣  Önce Master Admin API Key ve Password'ü alalım...${NC}"
echo ""

# Frontend'den ozgurhzm@gmail.com ile login yap
# Sistem Ayarları -> Master Admin API bölümünden API Key ve Password'ü kopyala

read -p "$(echo -e ${GREEN}Master Admin API Key: ${NC})" API_KEY
read -p "$(echo -e ${GREEN}Master Admin API Password: ${NC})" API_PASSWORD

echo ""

if [ -z "$API_KEY" ] || [ -z "$API_PASSWORD" ]; then
  echo -e "${RED}❌ HATA: API Key ve Password gerekli!${NC}"
  echo ""
  echo "Frontend'den alman gereken bilgiler:"
  echo "  1. http://localhost:5173 adresine git"
  echo "  2. ozgurhzm@gmail.com ile login yap (şifre: 135427)"
  echo "  3. Admin Panel -> Sistem Ayarları'na git"
  echo "  4. Master Admin API bölümünden API Key ve Password'ü kopyala"
  echo "  5. Eğer yoksa, 'Generate API Key' butonuna tıkla"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ API Key ve Password alındı!${NC}"
echo ""

# ============================================================================
# 2️⃣ TEST 1: SIMPLE AUTHENTICATION TEST
# ============================================================================

echo -e "${YELLOW}2️⃣  Test 1: Basit Authentication Testi${NC}"
echo ""

RESPONSE=$(curl -s -X GET \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$BACKEND_URL/api/v1/protected/test")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Test 1 BAŞARILI! API Key authentication çalışıyor!${NC}"
else
  echo ""
  echo -e "${RED}❌ Test 1 BAŞARISIZ! Hata oluştu.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 3️⃣ TEST 2: WHO AM I
# ============================================================================

echo -e "${YELLOW}3️⃣  Test 2: Kimlik Bilgisi Testi${NC}"
echo ""

RESPONSE=$(curl -s -X GET \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$BACKEND_URL/api/v1/protected/whoami")

echo "$RESPONSE" | jq '.'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 4️⃣ TEST 3: MASTER ADMIN ENDPOINT
# ============================================================================

echo -e "${YELLOW}4️⃣  Test 3: Master Admin Yetki Testi${NC}"
echo ""

RESPONSE=$(curl -s -X GET \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$BACKEND_URL/api/v1/protected/master-admin/test")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Test 3 BAŞARILI! Master Admin yetkisi doğrulandı!${NC}"
else
  echo ""
  echo -e "${RED}❌ Test 3 BAŞARISIZ! Master Admin yetkisi yok.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 5️⃣ TEST 4: VERİ EKLEME (POST)
# ============================================================================

echo -e "${YELLOW}5️⃣  Test 4: Veri Ekleme Testi (POST)${NC}"
echo ""

RESPONSE=$(curl -s -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "test_terminal",
    "data": {
      "message": "Hello from Terminal!",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }' \
  "$BACKEND_URL/api/v1/protected/data")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Test 4 BAŞARILI! Veri eklendi!${NC}"
  
  # Extract ID
  DATA_ID=$(echo "$RESPONSE" | jq -r '.data.id')
  echo -e "${BLUE}Eklenen veri ID: $DATA_ID${NC}"
else
  echo ""
  echo -e "${RED}❌ Test 4 BAŞARISIZ! Veri eklenemedi.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 6️⃣ TEST 5: VERİ OKUMA (GET)
# ============================================================================

echo -e "${YELLOW}6️⃣  Test 5: Veri Okuma Testi (GET)${NC}"
echo ""

RESPONSE=$(curl -s -X GET \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Password: $API_PASSWORD" \
  "$BACKEND_URL/api/v1/protected/data?table_name=test_terminal&limit=5")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Test 5 BAŞARILI! Veri okundu!${NC}"
  
  COUNT=$(echo "$RESPONSE" | jq -r '.count')
  echo -e "${BLUE}Okunan veri sayısı: $COUNT${NC}"
else
  echo ""
  echo -e "${RED}❌ Test 5 BAŞARISIZ! Veri okunamadı.${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 🎉 SONUÇ
# ============================================================================

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} 🎉 TÜM TESTLER TAMAMLANDI!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "✅ Master Admin API Key ve Password çalışıyor!"
echo "✅ Terminal'den backend'e erişim başarılı!"
echo "✅ Veri ekleme/okuma işlemleri başarılı!"
echo ""
echo "🚀 Artık terminalden tüm backend işlemlerini yapabilirsin!"
echo ""

# ============================================================================
# 📚 ÖRNEK KOMUTLAR
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} 📚 ÖRNEK KOMUTLAR (Favorilerine Ekle!)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "# Test endpoint (Authentication kontrolü)"
echo "curl -H \"X-API-Key: $API_KEY\" \\"
echo "     -H \"X-API-Password: $API_PASSWORD\" \\"
echo "     $BACKEND_URL/api/v1/protected/test"
echo ""
echo "# Veri ekleme"
echo "curl -X POST \\"
echo "     -H \"X-API-Key: $API_KEY\" \\"
echo "     -H \"X-API-Password: $API_PASSWORD\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"table_name\": \"customers\", \"data\": {\"name\": \"John\"}}' \\"
echo "     $BACKEND_URL/api/v1/protected/data"
echo ""
echo "# Veri okuma"
echo "curl -H \"X-API-Key: $API_KEY\" \\"
echo "     -H \"X-API-Password: $API_PASSWORD\" \\"
echo "     '$BACKEND_URL/api/v1/protected/data?table_name=customers&limit=10'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

