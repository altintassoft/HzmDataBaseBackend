# 🚀 Roadmap & Tech Stack

> **Development roadmap, technology choices, and project structure**

[◀️ Geri: Common Mistakes](10_Common_Mistakes.md) | [Ana Sayfa](README.md) | [İleri: Table Template ▶️](12_Table_Template.md)

---

## 📋 İçindekiler

1. [Development Roadmap](#development-roadmap)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Scale Strategy (40+ Tenant)](#scale-strategy-40-tenant)
5. [Success Metrics](#success-metrics)

---

## Development Roadmap

### Phase 1: Foundation (Week 1-2)

#### Week 1: Core Platform
- [x] PostgreSQL setup (extensions, schemas, functions)
- [x] Core tables (users, tenants, projects, table_metadata)
- [x] RLS policies
- [x] API key system
- [x] JWT authentication
- [x] Basic CRUD APIs

**Deliverables:**
- Database fully setup
- User registration/login works
- Project creation works
- Table creation works (manual)

#### Week 2: Dynamic System
- [ ] Dynamic table creation API
- [ ] Dynamic CRUD endpoints
- [ ] Field management API
- [ ] Data validation
- [ ] File upload
- [ ] Audit logging

**Deliverables:**
- Users can create tables via API
- Users can insert/update/delete records
- File uploads work (S3/R2)
- All actions logged

### Phase 2: Features (Week 3-4)

#### Week 3: Advanced Features
- [ ] Template system (6 templates)
- [ ] Business logic modules
- [ ] Webhooks
- [ ] Email notifications
- [ ] 2FA support
- [ ] Advanced search

**Deliverables:**
- E-commerce template installable
- Webhooks trigger on events
- Email notifications work
- 2FA for admin accounts

#### Week 4: i18n & Billing
- [ ] Multi-currency support
- [ ] Multi-language support
- [ ] Subscription management
- [ ] Usage tracking
- [ ] Payment integration (Stripe)
- [ ] Admin dashboard

**Deliverables:**
- Multiple currencies supported
- Multiple languages supported
- Subscription plans work
- Usage limits enforced
- Payments work

### Phase 3: Scale & Polish (Week 5-6)

#### Week 5: Performance & Scale
- [ ] Redis caching
- [ ] Database optimization
- [ ] Connection pooling
- [ ] Rate limiting (Redis)
- [ ] Background jobs (Bull)
- [ ] CDN integration

**Deliverables:**
- Response times < 100ms
- Handle 1000 req/s
- Background jobs processing
- CDN serving static assets

#### Week 6: Production Ready
- [ ] Monitoring (Sentry)
- [ ] Logging (Winston)
- [ ] Testing (Jest - 80%+ coverage)
- [ ] Documentation
- [ ] CI/CD (GitHub Actions)
- [ ] Production deployment

**Deliverables:**
- Tests passing (80%+ coverage)
- Monitoring active
- CI/CD pipeline working
- Deployed to production

---

## Tech Stack

### Backend

| Technology | Purpose | Why? |
|------------|---------|------|
| **Node.js 18+** | Runtime | Fast, async, huge ecosystem |
| **Express.js** | Web framework | Simple, flexible, widely used |
| **PostgreSQL 15+** | Database | RLS, JSONB, excellent performance |
| **Redis** | Caching & queues | Fast in-memory, pub/sub support |
| **Bull** | Background jobs | Reliable, Redis-based |
| **JWT** | Authentication | Stateless, standard |
| **bcrypt** | Password hashing | Industry standard, secure |
| **Joi** | Validation | Schema-based validation |
| **Winston** | Logging | Flexible, transports |
| **Sentry** | Error tracking | Real-time error monitoring |

### Frontend

| Technology | Purpose | Why? |
|------------|---------|------|
| **React 18** | UI framework | Component-based, huge ecosystem |
| **TypeScript** | Language | Type safety, better DX |
| **Vite** | Build tool | Fast, modern, HMR |
| **Tailwind CSS** | Styling | Utility-first, fast development |
| **React Query** | Data fetching | Caching, auto-refetch |
| **Zustand** | State management | Simple, lightweight |
| **React Router** | Routing | Standard React routing |
| **React Hook Form** | Forms | Performance, validation |
| **Recharts** | Charts | React-native, responsive |

### Infrastructure

| Technology | Purpose | Why? |
|------------|---------|------|
| **Railway** | Backend hosting | Easy deploy, PostgreSQL included |
| **Netlify** | Frontend hosting | CDN, auto deploy from Git |
| **Cloudflare R2** | File storage | S3-compatible, cheaper |
| **GitHub Actions** | CI/CD | Free, integrated with Git |
| **Sentry** | Monitoring | Error tracking, performance |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Husky** | Git hooks |
| **Jest** | Testing |
| **Supertest** | API testing |
| **Postman** | API documentation |

---

## Project Structure

### Backend Structure

```
HzmBackendVeriTabani/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   ├── redis.js              # Redis connection
│   │   └── environment.js        # Environment variables
│   ├── middleware/
│   │   ├── authenticate.js       # JWT auth
│   │   ├── apiKeyAuth.js         # API key auth
│   │   ├── tenantContext.js      # RLS context
│   │   ├── rateLimit.js          # Rate limiting
│   │   ├── errorHandler.js       # Error handling
│   │   └── auditLogger.js        # Audit logging
│   ├── routes/
│   │   ├── auth.js               # Authentication
│   │   ├── users.js              # User management
│   │   ├── projects.js           # Project management
│   │   ├── tables.js             # Table management
│   │   ├── records.js            # Record CRUD
│   │   ├── templates.js          # Template system
│   │   ├── webhooks.js           # Webhook management
│   │   └── admin.js              # Admin routes
│   ├── services/
│   │   ├── apiKeyService.js      # API key logic
│   │   ├── jwtService.js         # JWT logic
│   │   ├── currencyManager.js    # Currency conversion
│   │   ├── translationService.js # i18n
│   │   ├── rateLimiter.js        # Rate limiting
│   │   ├── emailService.js       # Email sending
│   │   └── webhookService.js     # Webhook triggers
│   ├── models/
│   │   ├── User.js
│   │   ├── Tenant.js
│   │   ├── Project.js
│   │   └── Table.js
│   ├── utils/
│   │   ├── validators.js         # Input validation
│   │   ├── helpers.js            # Helper functions
│   │   └── logger.js             # Winston logger
│   └── jobs/
│       ├── emailQueue.js         # Email jobs
│       ├── webhookQueue.js       # Webhook jobs
│       └── usageTracking.js      # Usage tracking
├── migrations/
│   ├── 001_initial_setup.sql
│   ├── 002_core_tables.sql
│   ├── 003_rls_policies.sql
│   └── ...
├── templates/
│   ├── ecommerce.json
│   ├── ridesharing.json
│   ├── mlm.json
│   └── ...
├── tests/
│   ├── auth.test.js
│   ├── projects.test.js
│   ├── tables.test.js
│   └── ...
├── docs/
│   └── API.md
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── package.json
├── Dockerfile
├── railway.toml
└── README.md
```

### Frontend Structure

```
HzmFrontendVeriTabani/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Table.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── TwoFactorAuth.tsx
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectSettings.tsx
│   │   └── tables/
│   │       ├── TableList.tsx
│   │       ├── TableBuilder.tsx
│   │       ├── TableView.tsx
│   │       └── RecordForm.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   ├── Tables.tsx
│   │   ├── Templates.tsx
│   │   ├── Settings.tsx
│   │   └── Admin.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   ├── useTables.ts
│   │   └── useRecords.ts
│   ├── services/
│   │   ├── api.ts                # Axios instance
│   │   ├── authService.ts
│   │   ├── projectService.ts
│   │   └── tableService.ts
│   ├── store/
│   │   ├── authStore.ts          # Zustand store
│   │   ├── projectStore.ts
│   │   └── tableStore.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── project.ts
│   │   └── table.ts
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
│   ├── favicon.ico
│   └── logo.png
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## Scale Strategy (40+ Tenant)

### Infrastructure Requirements

#### Database (PostgreSQL)

**PgBouncer (Connection Pooling)**
```conf
# pgbouncer.ini
[databases]
hzm_platform = host=localhost port=5432 dbname=hzm_platform

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

**Rationale:**
- 40 tenant × 10 concurrent users = 400 connections
- PostgreSQL max_connections = 100 (default)
- PgBouncer pools connections → 25 DB connections handle 1000 clients

**Database Partitioning**
```sql
-- Audit logs (monthly partitions)
CREATE TABLE ops.audit_logs (
  id BIGSERIAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE ops.audit_logs_2025_01 
  PARTITION OF ops.audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Auto-create next month partition
CREATE OR REPLACE FUNCTION ops.create_audit_log_partition(p_date DATE)
RETURNS void AS $$
DECLARE
  partition_name TEXT;
BEGIN
  partition_name := 'audit_logs_' || TO_CHAR(p_date, 'YYYY_MM');
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS ops.%I PARTITION OF ops.audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    DATE_TRUNC('month', p_date),
    DATE_TRUNC('month', p_date) + INTERVAL '1 month'
  );
END;
$$ LANGUAGE plpgsql;

-- Cron: Create next month partition
SELECT ops.create_audit_log_partition(CURRENT_DATE + INTERVAL '1 month');
```

**Large Tenant Isolation (Optional)**
```sql
-- For tenants with > 1M records, create dedicated partition
CREATE TABLE orders_tenant_10 
  PARTITION OF orders
  FOR VALUES IN (10);  -- Tenant ID = 10

-- Benefits:
-- - Faster queries (smaller indexes)
-- - Easier backup/restore
-- - Independent VACUUM
```

#### Redis Cluster

**Setup (3-node cluster)**
```bash
# Master-Replica setup
Redis 1: Master (6379)
Redis 2: Replica of 1 (6379)
Redis 3: Replica of 1 (6379)

# Sentinel for auto-failover
Sentinel 1: 26379
Sentinel 2: 26379
Sentinel 3: 26379
```

**Memory Allocation**
```
Per Tenant Cache: ~10MB
40 tenants: 400MB
Job Queue: 500MB
Session Store: 100MB
Rate Limit: 50MB
---
Total: ~1GB (allocate 2GB for growth)
```

**Redis Configuration**
```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec

# Clustering
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
```

#### Application Servers

**Horizontal Scaling**
```
Load Balancer (Nginx/CloudFlare)
      ↓
  ┌───┴────┬────────┬────────┐
  │        │        │        │
Node 1  Node 2  Node 3  Node 4
2 vCPU  2 vCPU  2 vCPU  2 vCPU
4GB RAM 4GB RAM 4GB RAM 4GB RAM
```

**Auto-scaling Rules**
```
Scale up: CPU > 70% for 5 min
Scale down: CPU < 30% for 10 min
Min instances: 2
Max instances: 10
```

#### Job Workers

**Worker Distribution**
```
Email Queue: 5 workers (concurrency: 5 each = 25 total)
Webhook Queue: 5 workers (concurrency: 10 each = 50 total)
Report Queue: 3 workers (concurrency: 2 each = 6 total)
AI Queue: 2 workers (concurrency: 1 each = 2 total)
```

**Per-Tenant Limits**
| Plan | Email/min | Webhooks/min | Reports/day | AI Prompts/day |
|------|-----------|--------------|-------------|----------------|
| Free | 10 | 20 | 5 | 10 |
| Starter | 50 | 100 | 20 | 50 |
| Pro | 200 | 500 | 100 | 200 |
| Enterprise | 1000 | 2000 | 500 | 1000 |

---

### Performance Optimization

#### Query Optimization

**Composite Indexes**
```sql
-- Multi-tenant queries always filter by tenant_id first
CREATE INDEX idx_orders_tenant_status_date 
  ON orders(tenant_id, status, created_at);

-- Covers common queries:
WHERE tenant_id = X AND status = 'pending' ORDER BY created_at DESC
```

**Covering Indexes**
```sql
-- Include frequently selected columns
CREATE INDEX idx_products_tenant_active_covering
  ON products(tenant_id, is_active, is_deleted)
  INCLUDE (name, sku, price);

-- Query can be satisfied from index alone (no table lookup)
```

**Materialized Views**
```sql
-- Pre-aggregate expensive queries
CREATE MATERIALIZED VIEW analytics.tenant_sales_daily AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS orders,
  SUM(total) AS revenue
FROM orders
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- Refresh every 15 minutes
```

#### Caching Strategy

**Read-Through Cache**
```javascript
// Hot data: 5-10 minute TTL
- Product catalog: 10 min
- Categories: 1 hour
- User sessions: 7 days

// Cold data: 1-5 minute TTL
- Order details: 5 min
- Customer info: 5 min

// Cache hit rate target: > 80%
```

**Cache Invalidation**
```javascript
// On data change → invalidate related cache
await pool.query('UPDATE products SET name = $1 WHERE id = $2');
await redis.del(`tenant:${tenantId}:products:*`);  // Wildcard delete
```

---

### Bottleneck Analysis

| Component | Bottleneck | Solution |
|-----------|------------|----------|
| **Database Connections** | Max 100 connections | PgBouncer (transaction pooling) |
| **Query Performance** | Full table scans | Composite indexes + MV |
| **Redis Memory** | OOM errors | Cluster + LRU eviction |
| **Job Queue** | Queue backup | More workers + priorities |
| **File Storage** | Bandwidth limits | CDN (CloudFlare) |
| **API Rate** | 1000 req/s limit | Horizontal scaling |

---

### Monitoring & Alerts

#### Key Metrics

**Database**
```
- Connection pool usage (> 80% → alert)
- Query duration (p95 > 100ms → alert)
- Deadlocks (> 5/hour → alert)
- Replication lag (> 1s → alert)
```

**Redis**
```
- Memory usage (> 80% → alert)
- Cache hit rate (< 70% → alert)
- Evicted keys (> 1000/min → alert)
```

**Application**
```
- API response time (p95 > 200ms → alert)
- Error rate (> 1% → alert)
- Queue length (> 10000 → alert)
- Worker failures (> 10/hour → alert)
```

**Business**
```
- Active tenants (track growth)
- API calls per tenant (identify heavy users)
- Storage per tenant (quota management)
```

#### Monitoring Stack

```
Prometheus: Metrics collection
Grafana: Dashboards
Sentry: Error tracking
DataDog: APM (optional)
```

---

### Cost Estimation (40 Tenants)

| Service | Spec | Monthly Cost |
|---------|------|--------------|
| **Database** | PostgreSQL (4 vCPU, 16GB) | $200 |
| **PgBouncer** | 1 vCPU, 1GB | $20 |
| **Redis Cluster** | 3 nodes (1GB each) | $60 |
| **App Servers** | 4× (2 vCPU, 4GB) | $160 |
| **Job Workers** | 2× (2 vCPU, 4GB) | $80 |
| **Load Balancer** | CloudFlare | $20 |
| **File Storage** | 500GB (R2) | $7.50 |
| **Bandwidth** | 1TB | $10 |
| **Monitoring** | Sentry + Grafana Cloud | $50 |
| **Total** | | **~$610/month** |

**Per Tenant Cost:** $15/month → Charge $29/month (95% margin)

---

## Success Metrics

### Performance Metrics

| Metric | Target | Why? |
|--------|--------|------|
| **API Response Time** | < 100ms (p95) | User experience |
| **Database Queries** | < 10ms (p95) | Performance |
| **Page Load Time** | < 2s | SEO, UX |
| **Uptime** | 99.9% | Reliability |
| **Error Rate** | < 0.1% | Quality |

### Business Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Active Tenants** | 100 | Month 1 |
| **Active Tenants** | 1,000 | Month 6 |
| **Active Tenants** | 10,000 | Year 1 |
| **API Calls/day** | 1M | Month 6 |
| **API Calls/day** | 10M | Year 1 |

### Technical Metrics

| Metric | Target | Why? |
|--------|--------|------|
| **Test Coverage** | 80%+ | Quality assurance |
| **TypeScript Coverage** | 100% (frontend) | Type safety |
| **Code Review** | 100% | Quality |
| **Documentation** | 100% (public APIs) | Developer experience |
| **Security Audits** | Quarterly | Security |

---

## Development Workflow

### Git Workflow

```bash
# Feature branch
git checkout -b feature/table-builder
git commit -m "feat: add table builder UI"
git push origin feature/table-builder

# Pull request
# - Code review required
# - Tests must pass
# - Linter must pass

# Merge to main
git checkout main
git merge feature/table-builder
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: railway up  # Auto deploy to Railway
```

### Release Process

1. **Version bump** - `npm version patch/minor/major`
2. **Changelog** - Update CHANGELOG.md
3. **Tag** - `git tag v1.0.0`
4. **Push** - `git push && git push --tags`
5. **Deploy** - Auto-deploy via Railway
6. **Announce** - Release notes on GitHub

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret

# API Keys
API_KEY_ENCRYPTION_KEY=your-encryption-key

# File Storage
CLOUDFLARE_R2_BUCKET=your-bucket
CLOUDFLARE_R2_ACCESS_KEY=your-key
CLOUDFLARE_R2_SECRET_KEY=your-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# Monitoring
SENTRY_DSN=your-sentry-dsn

# Environment
NODE_ENV=production
PORT=3000
```

### Frontend (.env)

```bash
# API
VITE_API_URL=https://api.hzm.com
VITE_WS_URL=wss://api.hzm.com

# Auth
VITE_JWT_EXPIRY=7d

# Analytics
VITE_GA_ID=UA-XXXXXXXXX-X
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Linter passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Environment variables set
- [ ] Database migrations ready
- [ ] Backup taken

### Deployment

- [ ] Deploy to staging
- [ ] Smoke test staging
- [ ] Run database migrations
- [ ] Deploy to production
- [ ] Smoke test production
- [ ] Monitor errors (Sentry)
- [ ] Monitor performance

### Post-Deployment

- [ ] Verify key features work
- [ ] Check error logs
- [ ] Check performance metrics
- [ ] Notify team
- [ ] Update status page

---

## 🔗 İlgili Dökümanlar

- [09_Implementation_Checklist.md](09_Implementation_Checklist.md) - Development priorities
- [10_Common_Mistakes.md](10_Common_Mistakes.md) - What to avoid
- [README.md](README.md) - Overview

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[◀️ Geri: Common Mistakes](10_Common_Mistakes.md) | [Ana Sayfa](README.md) | [İleri: Table Template ▶️](12_Table_Template.md)**

