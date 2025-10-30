# 🏗️ Hybrid Architecture - Modüler + Akıllı Endpoint Stratejisi

**Tarih:** 29 Ekim 2025  
**Versiyon:** v2.0 (Gelecek)  
**Durum:** 📋 Plan Aşamasında

---

## 🎯 Hybrid Yaklaşım

### **Konsept:**
```
"Her modül BAĞIMSIZ (Microservices)
 Her modül İÇİNDE generic pattern (DRY)"
```

**En iyisinin birleşimi:**
- ✅ **Modüler:** Microservices pattern (ölçeklenebilir)
- ✅ **Generic:** Her modül içinde DRY (maintainable)

---

## 📐 MİMARİ PRENSİPLER

### **1. Modül Bağımsızlığı**
```
/users/     → User service (bağımsız deploy)
/projects/  → Project service (bağımsız deploy)
/admin/     → Admin service (bağımsız deploy)

✅ Her modül kendi veritabanı şeması
✅ Her modül kendi auth logic'i
✅ Her modül bağımsız scale olur
```

### **2. İçinde Generic Pattern**
```
# Her modülde:
/:resource/:id/:action  ← Action-based generic
/:resource/:id/:subResource ← Sub-resource generic

Örnek:
POST /users/:id/:action
     (activate, deactivate, reset-password, send-email)
     
GET /projects/:id/:subResource
    (tables, fields, api-keys, team, audit)
```

### **3. CRUD Standardı**
```
Her modül için:
GET    /:resource/         (list)
POST   /:resource/         (create)
GET    /:resource/:id      (get)
PUT    /:resource/:id      (update)
DELETE /:resource/:id      (delete)

+ İsteğe göre:
GET  /:resource/:id/:subResource
POST /:resource/:id/:action
```

---

## 🔧 MODÜL PATTERN'LERİ

### **Pattern A: Specific Module (Değişmez)**
```
Kullanım: Auth, Admin, Health

Örnek: /auth/
- /login
- /register
- /logout
- /refresh
- /me

Özellik:
✅ Her endpoint özel logic
✅ Generic'e çevrilemez
✅ Olduğu gibi kalır
```

### **Pattern B: CRUD Module (Generic'e çevrilebilir)**
```
Kullanım: Users, Projects, API Keys

Örnek: /users/
Şu an:
- GET /users/
- GET /users/:id
- PUT /users/:id
- DELETE /users/:id
- POST /users/:id/activate
- POST /users/:id/deactivate

Generic:
- GET /users/:id
- PUT /users/:id
- DELETE /users/:id
- POST /users/:id/:action  ← activate, deactivate, etc

Kazanç: 6 → 4 endpoint
```

### **Pattern C: Fully Generic (En iyi!)**
```
Kullanım: Data module

Örnek: /data/
- GET /data/:resource
- POST /data/:resource
- GET /data/:resource/:id
- PUT /data/:resource/:id
- DELETE /data/:resource/:id
- POST /data/:resource/search
- GET /data/:resource/count

:resource = users, projects, tables, fields, etc

Özellik:
✅ Tek kod, tüm resource'lar
✅ En az endpoint
✅ En yüksek reusability
```

---

## 📊 HEDEF MİMARİ

### **Modül Dağılımı (v2.0):**

```
📁 Modüler Yapı (7 modül, 51 endpoint):

├─ /auth/ (6) - Pattern A ✅
│  └─ Specific endpoints (login, register, etc)
│
├─ /health/ (3) - Pattern A ✅
│  └─ Specific endpoints (healthcheck, ready, live)
│
├─ /admin/ (15) - Pattern A ✅
│  └─ Specific endpoints (reports, analytics, AI KB)
│
├─ /data/ (11) - Pattern C ✅
│  └─ Fully generic (:resource pattern)
│
├─ /users/ (4) - Pattern B 💡
│  ├─ CRUD (3)
│  └─ POST /:id/:action (1)
│
├─ /projects/ (6) - Pattern B 💡
│  ├─ CRUD (4)
│  └─ GET/POST /:id/:subResource (2)
│
└─ /api-keys/ (6) - Pattern B 💡
   ├─ Basic (2)
   └─ POST /:scope/:action (4)

TOPLAM: 51 endpoint (-30% from 73)
```

---

## 🚀 MIGRATION PLAN

### **Phase 0: Cleanup (1 hafta, Sıfır Risk)**
```
Hedef: 73 → 59 endpoint

Adımlar:
1. Pasif endpoint'leri sil (/projects/:id/*, 9 endpoint)
2. Duplicate'leri sil (/api-key/*, 5 endpoint)
3. Test et
4. Deploy et

Risk: Sıfır (zaten kullanılmıyor)
Test: Regression test (mevcut özellikler çalışmalı)
```

### **Phase 1: API Keys Generic (2 hafta, Düşük Risk)**
```
Hedef: 59 → 55 endpoint

Adımlar:
1. Yeni generic endpoint ekle: POST /api-keys/:scope/:action
2. Eski endpoint'leri yeni endpoint'e yönlendir (proxy)
3. Test et (compatibility layer)
4. Deprecate eski endpoint'leri
5. 6 ay sonra sil

Risk: Düşük (compatibility layer ile)
Test: API key generation/regeneration/revoke
```

### **Phase 2: Projects Sub-Resources (3 hafta, Orta Risk)**
```
Hedef: 55 → 51 endpoint

Adımlar:
1. Generic sub-resource handler ekle
2. GET/POST /projects/:id/:subResource
3. Migration guide (API kullanıcıları için)
4. Versiyonlama (v1 vs v2)

Risk: Orta (business logic)
Test: Project CRUD, nested resources
```

### **Phase 3: Users Actions (2 hafta, Orta Risk)**
```
Hedef: 51 → 51 (already optimal after Phase 2)

Adımlar:
1. POST /users/:id/:action pattern
2. Activate, deactivate, reset → action
3. Compatibility layer

Risk: Orta (user management kritik)
Test: User lifecycle, admin operations
```

---

## ⚖️ KARAR MATRİSİ

### **Şimdilik 73 Endpoint'i Korumak:**

**Artıları:**
- ✅ Çalışıyor (production-ready)
- ✅ Sıfır risk
- ✅ Takım biliniyor
- ✅ Test coverage mevcut
- ✅ Modüler (microservices)

**Eksileri:**
- ⚠️ Biraz fazla endpoint
- ⚠️ Bazı duplicate'ler var
- ⚠️ Generic pattern az

### **51 Endpoint'e Düşürmek:**

**Artıları:**
- ✅ Daha az maintenance
- ✅ Generic pattern (DRY)
- ✅ Strategy'ye uygun

**Eksileri:**
- ❌ 2-3 ay refactor
- ❌ Yüksek risk
- ❌ API breaking changes
- ❌ Tüm client'lar güncellemeli

---

## 💡 TAVSİYE

### **Şimdi (2025 Q4):**
```
✅ Mevcut 73 endpoint'i koru
✅ Sadece pasif/duplicate cleanup (14 endpoint)
→ 73 → 59 endpoint (kolay kazanç)
```

### **Gelecek (2026 Q1-Q2):**
```
💡 Generic pattern ekle (yeni özellikler için)
💡 Eski endpoint'ler kalsın (compatibility)
💡 Yavaş yavaş migrate et
→ 59 → 51 endpoint (dikkatli geçiş)
```

### **Uzun Vadede (2026+):**
```
🔮 Microservices separation
🔮 Her modül ayrı repo/deploy
🔮 gRPC/GraphQL (internal communication)
```

---

## 📋 CHECKLIST (Gelecek Implementation)

### **Before Starting:**
- [ ] Tüm endpoint'lerin test coverage'ı %80+
- [ ] API versiyonlama sistemi hazır (v1, v2)
- [ ] Deprecation policy tanımlı
- [ ] Migration guide hazır

### **During Migration:**
- [ ] Compatibility layer (eski → yeni proxy)
- [ ] Monitoring (error rate, latency)
- [ ] Rollback planı hazır
- [ ] Incremental deployment (canary)

### **After Migration:**
- [ ] Performance comparison
- [ ] Error rate monitoring
- [ ] Client migration tracking
- [ ] Eski endpoint'leri sil (6 ay sonra)

---

## 🎯 SONUÇ

**Hybrid Architecture = Best of Both Worlds**

1. ✅ Modüler (microservices pattern)
2. ✅ Generic (DRY, maintainable)
3. ✅ Kademeli geçiş (low risk)
4. ✅ Geri uyumlu (compatibility layer)

**73 → 51 endpoint migration: Mümkün, ama acil değil!**

**Öncelik:** Sistem stability > endpoint optimization

---

## 🔧 OPERASYONEL GEREKSINIMLER (Hızlı Kazançlar)

### **1. Endpoint Envanteri = Tek Kaynak**
```javascript
// scripts/generate-endpoint-inventory.js
// Nightly cron ile çalışır

OUTPUT: /docs/api/inventory.json
{
  "generated_at": "2025-10-29T16:00:00Z",
  "endpoints": [
    {
      "path": "/api/v1/admin/database",
      "method": "GET",
      "module": "admin",
      "auth": "JWT or API Key",
      "rls": true,
      "deprecated": false,
      "owner": "admin-team",
      "lastTouched": "2025-10-28"
    }
  ]
}

✅ Tek kaynak (kod + döküman)
✅ Otomatik güncelleme
✅ CI/CD entegrasyonu
```

### **2. Deprecation Policy (Hemen Uygula)**
```javascript
// Pasif/duplicate endpoint'ler için:
router.get('/api-key/*', deprecate({
  until: '2026-03-31',
  docUrl: 'https://.../migration-guide#api-keys',
  redirectTo: '/api-keys/*'  // 301 Moved Permanently
}));

// Response Headers:
Deprecation: true
Sunset: 2026-03-31
Link: <.../migration-guide#api-keys>; rel="deprecation"
```

### **3. Versiyon Etiketi**
```
Mevcut 73 endpoint → /v1/ (freeze)
Yeni generic pattern → /v1/ (backward compatible)
Breaking changes → /v2/ (gelecek)

URL Structure:
/api/v1/users/:id        ← Current
/api/v2/users/:id/:action ← Future
```

### **4. Tutarlı Hata Sözleşmesi**
```javascript
// Standart hata formatı:
{
  code: "USR_NOT_FOUND",
  message: "User not found",
  details: { userId: "123", tenant: "acme" },
  traceId: "uuid-trace-id"
}

// Hata katalogu:
const ERROR_CODES = {
  USR_NOT_FOUND: 404,
  APIKEY_REVOKED: 403,
  RLS_DENIED: 403,
  INVALID_ACTION: 400,
  IDEMPOTENCY_REQUIRED: 400,
  CONFLICT: 409
};
```

### **5. Idempotency + Rate Limit**
```javascript
// Kritik endpoint'ler için:
POST /api-keys/:scope/:action
POST /projects/:id/:subResource

// Headers:
Idempotency-Key: required
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765432
```

---

## 🧭 P1 CLEANUP (Net Kontrol Listesi)

### **1. Projects Pasif Endpoint'ler (9 adet):**
```
Adımlar:
1. 7 günlük access log taraması (Railway/Netlify logs)
2. 0 çağrı varsa → Kaldır
3. >0 çağrı varsa → Deprecation header ekle, 2 hafta bekle

Endpoint'ler:
❌ GET/POST/DELETE /projects/:id/api-keys
❌ GET/POST/GET /projects/:id/tables
❌ GET/POST/DELETE /projects/:id/team
```

### **2. API-Key Duplicate (5 adet):**
```
Problem:
/api-key/*  (5 endpoint, eski)
/api-keys/* (9 endpoint, yeni)

Çözüm:
1. /api-key/* → 301 redirect /api-keys/*
2. 2 hafta eşzamanlı açık tut
3. Log monitoring (0 çağrı olunca kaldır)
```

### **3. CI Route Drift Check:**
```bash
# .github/workflows/route-check.yml

- name: Route Drift Check
  run: |
    # Tanımlı ama test edilmeyen route varsa UYARI
    npm run test:routes
    npm run openapi-diff
```

---

## 🏗️ GENERIC PATTERN GÜVENLİK ŞABLONU

### **1. RBAC/RLS Matrix (Tablo):**
```sql
CREATE TABLE ops.endpoint_permissions (
  module VARCHAR(50),
  action VARCHAR(50),
  required_roles TEXT[],
  rls_check BOOLEAN,
  audit_event VARCHAR(100),
  
  PRIMARY KEY (module, action)
);

-- Example:
INSERT INTO ops.endpoint_permissions VALUES
('api-keys', 'generate', ARRAY['admin', 'owner'], true, 'APIKEY_CREATED'),
('users', 'activate', ARRAY['admin'], true, 'USER_ACTIVATED');
```

### **2. Action Router Koruması:**
```javascript
// Whitelist enforcement
const ACTIONS = ['activate', 'deactivate', 'reset-password', 'send-email'] as const;

app.post('/users/:id/:action', authz('users:mutate'), (req, res) => {
  if (!ACTIONS.includes(req.params.action)) {
    return res.status(400).json({ code: 'INVALID_ACTION' });
  }
  // Execute...
});
```

### **3. SubResource Sözleşmesi:**
```javascript
const VALID_SUBRESOURCES = {
  projects: ['api-keys', 'tables', 'team', 'audit'],
  users: ['api-keys', 'permissions', 'settings', 'logs']
};

// Validation + Schema
app.get('/projects/:id/:subResource', (req, res) => {
  assertAllowed(req.params.subResource, VALID_SUBRESOURCES.projects);
  // Fetch...
});
```

---

## 📐 TEST & GÖZLEMLENEBİLİRLİK

### **1. Sözleşme Testleri (Contract Tests):**
```javascript
// Auth matrix test (her route için)
describe('GET /users/:id', () => {
  it('anonymous → 401', async () => {
    await request(app).get('/users/123').expect(401);
  });
  
  it('user (own) → 200', async () => {
    await request(app).get('/users/123')
      .set('Authorization', 'Bearer user-123-token')
      .expect(200);
  });
  
  it('user (other tenant) → 403 RLS_DENIED', async () => {
    await request(app).get('/users/456')
      .set('Authorization', 'Bearer user-123-token')
      .expect(403);
  });
  
  it('admin (same tenant) → 200', async () => {
    await request(app).get('/users/456')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });
});
```

### **2. Audit & Trace:**
```sql
CREATE TABLE ops.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id INTEGER,
  tenant_id INTEGER,
  scope VARCHAR(50),           -- users, projects, api-keys
  action VARCHAR(50),          -- ACTIVATE, DEACTIVATE, CREATE
  target VARCHAR(255),
  ip INET,
  user_agent TEXT,
  trace_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON ops.audit_log (tenant_id, created_at);
CREATE INDEX ON ops.audit_log (trace_id);
```

### **3. SLO Hedefleri:**
```
p95 latency:
- Read operations: < 250ms
- Write operations: < 400ms

5xx error rate: < 0.3% / gün

Hata kataloğu dışı hata: 0 (CI'da yasak)
```

---

## 🧪 CI/CD GATE'LERİ

### **Definition of Done (Her Phase İçin):**
```
✅ route-inventory.json otomatik güncellendi
✅ OpenAPI spec üretildi (openapi-diff: no breaking changes)
✅ Contract test coverage ≥ 90% (anon/user/admin + RLS)
✅ p95 smoke tests geçti (pre-prod)
✅ Audit event'leri tüm mutasyonlarda var
✅ Idempotency-Key zorunlu (POST operations)
✅ Deprecation headers eklendi (pasif endpoint'ler)
✅ 7 günlük access log: 0 çağrı (silinecekler için)
```

---

## 📜 OPENAPI ÖRNEK (Generic Action)

```yaml
paths:
  /users/{id}/{action}:
    post:
      summary: Perform an action on a user
      tags: [Users]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
        - name: action
          in: path
          required: true
          schema:
            enum: [activate, deactivate, reset-password, send-email]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserActionPayload'
      responses:
        '200':
          $ref: '#/components/responses/Ok'
        '400':
          $ref: '#/components/responses/InvalidAction'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
```

---

## 🗺️ REFACTOR ROADMAP (UPDATED)

### **Phase 0: Cleanup (1 hafta, Sıfır Risk)**
```
✅ Pasif 9 + duplicate 5 = 14 endpoint kaldır
✅ Deprecation headers ekle
✅ 301 redirects ekle
✅ Envanter JSON + OpenAPI senkron CI
✅ Access log monitoring
```

### **Phase 1: API Keys Generic (2 hafta, Düşük Risk)**
```
✅ Idempotency-Key zorunlu
✅ Audit log zorunlu
✅ Feature flag: apiKeysGeneric=true/false
✅ Rollback planı hazır
✅ Contract tests
```

### **Phase 2: Projects SubResource (3 hafta, Orta Risk)**
```
✅ SubResource whitelist
✅ Schema validation (Zod/Yup)
✅ RBAC/RLS matrix tests
✅ Migration guide
✅ Client SDK update
```

### **Phase 3: Users Action (2 hafta, Orta Risk)**
```
✅ Action whitelist
✅ Deprecation headers (eski endpoint'ler)
✅ 2 hafta eşzamanlı açık
✅ Monitoring dashboard
```

---

## ⚠️ DİKKAT EDİLMESİ GEREKENLER

### **1. "Generic" ≠ "Kontrolsüz"**
```
❌ YANLIŞ:
POST /users/:id/:action  (action: ANY)

✅ DOĞRU:
const ALLOWED_ACTIONS = ['activate', 'deactivate'] as const;
if (!ALLOWED_ACTIONS.includes(action)) → 400 INVALID_ACTION
```

### **2. Geriye Dönük Uyum**
```
Minimum deprecation period: 2 hafta
301 redirect: Eski → Yeni
Client migration guide
Versiyonlama support
```

### **3. Güvenlik Yüzeyi**
```
API-Key operations:
- Rate limit: 100 req/hour
- Idempotency-Key: Required
- Audit log: Mandatory
- RLS: Always enabled
```

---

## 🎯 SONUÇ - NE YAPACAĞIZ?

### **ŞİMDİ (2025 Q4):**
```
✅ Mevcut 73 endpoint'i koru
✅ Bu planı hazırla (✅ YAPILDI!)
✅ Operasyonel iyileştirmeler ekle (✅ YAPILDI!)
```

### **YAKIN GELECEK (2026 Q1):**
```
1. Phase 0: Cleanup (14 endpoint sil)
2. Envanter JSON oluştur
3. OpenAPI automation
4. Deprecation policy uygula
```

### **ORTA VADE (2026 Q2+):**
```
5. Phase 1-3: Generic migration (ihtiyaç olursa)
6. Contract tests
7. Audit logging
8. SLO monitoring
```

---

**Bu döküman gelecek implementasyon için BLUEPRINT!**


