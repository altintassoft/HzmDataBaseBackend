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

**Bu plan ihtiyaç olduğunda implemente edilebilir.**

