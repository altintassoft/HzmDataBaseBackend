# ✈️ Pre-Flight Checklist

> **5-10 dakikada her şeyin yeşil olduğunu doğrula!**

[Ana Sayfa](README.md)

---

## 📋 Hızlı Kontrol Listesi

### ✅ P0 - Kritik (Mutlaka!)

- [ ] PostgreSQL RLS policies aktif
- [ ] Tenant izolasyonu çalışıyor
- [ ] Redis bağlantısı OK
- [ ] Job queue çalışıyor
- [ ] Audit logs yazılıyor
- [ ] Soft delete çalışıyor

### ✅ P1 - Önemli

- [ ] Materialized views oluşturuldu
- [ ] Indexes tamamlandı
- [ ] Rate limiting aktif
- [ ] Session management OK
- [ ] Email queue çalışıyor
- [ ] Webhook delivery OK

### ✅ P2 - Nice to Have

- [ ] Widget system test edildi
- [ ] Dashboard render oluyor
- [ ] Reports export çalışıyor
- [ ] MLM hierarchy doğru

---

## 🧪 Test Komutları

### 1. RLS & Tenant İzolasyonu

```sql
-- Context set et
SELECT app.set_context(1, 1);

-- Başka tenant verisini görebiliyor mu? (GÖRMEMELİ)
SET LOCAL ROLE NONE;
SELECT COUNT(*) FROM core.users WHERE tenant_id <> app.current_tenant();
-- Beklenen: 0 (veya hata)

-- Policy ihlali dene (BAŞARISIZ OLMALI)
BEGIN;
  SET CONSTRAINTS ALL IMMEDIATE;
  INSERT INTO core.users(tenant_id, email, password_hash) 
  VALUES (999, 'hack@test.com', 'hash');
  -- Beklenen: ERROR: new row violates row-level security policy
ROLLBACK;
```

**✅ Başarı Kriteri:** RLS policy ihlali hatası almalısın!

---

### 2. Soft Delete & Audit

```sql
-- Context set et
SELECT app.set_context(1, 42); -- user_id=42

-- Test tenant oluştur
INSERT INTO core.tenants(name, slug) 
VALUES ('Test Tenant', 'test-slug') 
RETURNING id;

-- Sil (soft delete)
DELETE FROM core.tenants WHERE slug='test-slug';

-- Fiziksel silinmemeli, is_deleted=true olmalı
SELECT id, name, is_deleted, deleted_by 
FROM core.tenants 
WHERE slug='test-slug';
-- Beklenen: is_deleted=true, deleted_by=42

-- Audit kaydı düştü mü?
SELECT action, entity_type, entity_id, user_id
FROM ops.audit_logs 
ORDER BY created_at DESC 
LIMIT 5;
-- Beklenen: DELETE action görünmeli
```

**✅ Başarı Kriteri:** Soft delete çalışmalı, audit log yazılmalı!

---

### 3. Zorunlu İndexler

```sql
-- En kritik indexler var mı?
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('users', 'user_sessions', 'api_keys', 'tenants', 'projects')
  AND indexname LIKE '%tenant%'
ORDER BY tablename, indexname;

-- Beklenen: Her tabloda tenant_id index'i olmalı
```

**✅ Başarı Kriteri:** Minimum 5 tenant_id index'i görmelisin!

---

### 4. Redis Bağlantısı & TTL

```bash
# Redis bağlantı testi
redis-cli PING
# Beklenen: PONG

# Key oluştur ve TTL test et
redis-cli SETEX hzm:test:health 60 ok

# TTL kontrol
redis-cli TTL hzm:test:health
# Beklenen: ~60 (azalıyor olmalı)

# Key'i oku
redis-cli GET hzm:test:health
# Beklenen: "ok"

# Temizle
redis-cli DEL hzm:test:health
```

**✅ Başarı Kriteri:** Redis yanıt vermeli, TTL çalışmalı!

---

### 5. Job Queue (BullMQ)

```javascript
// Node REPL'de test et
const { Queue } = require('bullmq');

const testQueue = new Queue('test', {
  connection: { 
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// Test job ekle
await testQueue.add('ping', { 
  timestamp: Date.now(),
  test: true 
}, {
  removeOnComplete: true
});

// Queue stats
const waiting = await testQueue.getWaitingCount();
const active = await testQueue.getActiveCount();
console.log({ waiting, active });

// Beklenen: Job eklenmeli, count'lar dönmeli
```

**✅ Başarı Kriteri:** Job queue'ya job eklenebilmeli!

---

### 6. Email Queue Dry-Run

```sql
-- Test email ekle
INSERT INTO comms.email_queue (
  tenant_id, 
  to_email, 
  from_email, 
  subject, 
  body_text
)
VALUES (
  1, 
  'dev@hzm.local', 
  'noreply@hzm.local', 
  'Test Email', 
  'This is a test.'
);

-- Status kontrol
SELECT id, status, created_at, sent_at
FROM comms.email_queue
ORDER BY created_at DESC
LIMIT 5;

-- Beklenen: status='pending' veya 'sent' (worker çalışıyorsa)
```

**✅ Başarı Kriteri:** Email queue'ya eklenmeli!

---

### 7. Materialized View Refresh

```sql
-- MV var mı kontrol
SELECT matviewname, schemaname
FROM pg_matviews
WHERE schemaname = 'analytics';

-- MV refresh test (varsa)
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.tenant_sales_daily;

-- Beklenen: Hatasız tamamlanmalı
```

**✅ Başarı Kriteri:** MV refresh hatasız çalışmalı!

---

### 8. Widget Data Fetch

```javascript
// Widget data service test
const widgetService = require('./services/widgetDataService');

const testWidget = {
  id: 'test-widget-1',
  tenant_id: 1,
  widget_type: 'revenue-metric',
  config: { period: 'month' }
};

const data = await widgetService.executeWidgetQuery(
  1,  // tenantId
  1,  // userId
  testWidget
);

console.log('Widget data:', data);
// Beklenen: { value: ..., trend: ... }
```

**✅ Başarı Kriteri:** Widget data dönmeli!

---

### 9. Rate Limit Test

```bash
# 10 paralel request gönder
for i in {1..10}; do
  curl -X GET "http://localhost:3000/api/v1/projects" \
    -H "Authorization: Bearer YOUR_TOKEN" &
done

# Rate limit header'larını kontrol et
curl -I "http://localhost:3000/api/v1/projects" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Beklenen:
# X-RateLimit-Limit-Minute: 60
# X-RateLimit-Remaining-Minute: 59
```

**✅ Başarı Kriteri:** Rate limit header'ları dönmeli!

---

### 10. Backup & WAL Arşiv

```sql
-- WAL arşiv açık mı?
SHOW archive_mode;
-- Beklenen: on

SHOW archive_command;
-- Beklenen: cp %p /path/to/archive/%f (veya pgBackRest komutu)

-- PITR test (opsiyonel, dikkatli!)
-- pg_basebackup -D /tmp/backup -Fp -Xs -P
```

**✅ Başarı Kriteri:** archive_mode = on olmalı!

---

## 🏋️ Yük Testi (Opsiyonel)

### Test Data Seed

```sql
-- 1 tenant + 10 proje + 1000 user
WITH new_tenant AS (
  INSERT INTO core.tenants(name, slug) 
  VALUES ('Load Test', 'load-test') 
  RETURNING id
)
INSERT INTO core.users(tenant_id, email, password_hash)
SELECT 
  (SELECT id FROM new_tenant), 
  'user' || g || '@load.local', 
  'hash'
FROM generate_series(1, 1000) g;

-- User count kontrol
SELECT COUNT(*) FROM core.users WHERE tenant_id = (
  SELECT id FROM core.tenants WHERE slug='load-test'
);
-- Beklenen: 1000
```

### Performance Test

```bash
# Apache Bench ile 1000 request
ab -n 1000 -c 10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/projects

# Beklenen:
# - Requests per second > 100
# - Mean time per request < 100ms
# - Failed requests: 0
```

**✅ Başarı Kriteri:** RPS > 100, fail = 0

---

## 🧱 Health Endpoints

### Backend Health Check

```bash
# Health endpoint
curl http://localhost:3000/health

# Beklenen response:
{
  "status": "ok",
  "timestamp": "2025-10-21T...",
  "services": {
    "database": "ok",
    "redis": "ok",
    "queues": {
      "email": "ok",
      "webhook": "ok",
      "report": "ok"
    }
  },
  "uptime": 12345
}
```

**✅ Başarı Kriteri:** Tüm servisler "ok" dönmeli!

---

## 📊 Quick Stats

```sql
-- Platform stats
SELECT 
  (SELECT COUNT(*) FROM core.tenants WHERE is_active = TRUE) AS active_tenants,
  (SELECT COUNT(*) FROM core.users WHERE is_deleted = FALSE) AS total_users,
  (SELECT COUNT(*) FROM core.projects) AS total_projects,
  (SELECT COUNT(*) FROM table_metadata) AS dynamic_tables,
  (SELECT COUNT(*) FROM ops.audit_logs WHERE created_at > CURRENT_DATE) AS today_audit_logs;
```

---

## 🎯 CI/CD Smoke Test

```bash
# Lint
npm run lint

# Type check
npm run typecheck

# Unit tests
npm run test

# Integration tests
npm run test:integration

# Smoke tests
npm run test:smoke

# Beklenen: Tümü başarılı (exit code 0)
```

---

## ✅ Final Checklist

Aşağıdaki tüm kutuları işaretle:

- [ ] 🗄️ Database RLS policies aktif
- [ ] 🔴 Redis bağlantısı OK, TTL çalışıyor
- [ ] 🔄 Job queue (BullMQ) çalışıyor
- [ ] 📧 Email queue test OK
- [ ] 🔐 Rate limiting aktif
- [ ] 📝 Audit logs yazılıyor
- [ ] 🗑️ Soft delete çalışıyor
- [ ] 📊 Materialized views refresh OK
- [ ] 🎛️ Widget data fetch OK
- [ ] 🏥 Health endpoint yanıt veriyor
- [ ] 🧪 Smoke tests başarılı
- [ ] 📦 Backup & WAL arşiv yapılandırıldı

---

## 🚨 Sorun Çözüm Rehberi

### RLS Policy Hatası

```
ERROR: new row violates row-level security policy
```

**Çözüm:**
```sql
-- Context set edilmiş mi?
SELECT app.current_tenant(); -- NULL dönmemeli!

-- Policy var mı?
SELECT * FROM pg_policies WHERE tablename = 'users';
```

---

### Redis Bağlantı Hatası

```
Error: Redis connection failed
```

**Çözüm:**
```bash
# Redis çalışıyor mu?
redis-cli PING

# .env doğru mu?
echo $REDIS_URL
# Beklenen: redis://localhost:6379 (veya remote)
```

---

### BullMQ Queue Hatası

```
Error: Missing lock for job
```

**Çözüm:**
```javascript
// Redis bağlantı konfigürasyonu kontrol et
const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  maxRetriesPerRequest: null  // BullMQ için gerekli!
};
```

---

## 🎉 Tüm Testler Başarılı!

Hepsi yeşil mi? Tebrikler! 🎉

**Sonraki Adımlar:**
1. ✅ Production deployment
2. ✅ Monitoring kurulumu (Grafana, Sentry)
3. ✅ Backup planı aktifleştir
4. ✅ İlk tenant'ı onboard et

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[Ana Sayfa](README.md)**

