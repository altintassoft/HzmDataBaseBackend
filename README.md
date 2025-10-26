# HZM Backend

Multi-tenant Database-as-a-Service (DBaaS) platform backend.

## Features

- ✅ Multi-tenancy with PostgreSQL RLS
- ✅ Generic Table Pattern (JSONB-based)
- ✅ Platform Agnostic (Railway, AWS, DigitalOcean, Self-hosted)
- ✅ No Mock Data (Real PostgreSQL from day 1)
- ✅ Docker Development Environment
- ✅ Redis Caching & Rate Limiting
- ✅ JWT Authentication
- ✅ RESTful API

## Quick Start

### 1. Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
vim .env
```

### 2. Start with Docker

```bash
# Start all services (PostgreSQL + Redis + Backend)
docker-compose up

# Or in background
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### 3. Run Migrations

```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Seed initial data (optional)
docker-compose exec backend npm run seed
```

### 4. Test API

```bash
# Health check
curl http://localhost:5000/health

# API endpoints
curl http://localhost:5000/api/v1/...
```

## Development

### Local Development (Docker)

```bash
# Start services
docker-compose up

# Backend: http://localhost:5000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Without Docker

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis locally
# ...

# Run migrations
npm run migrate

# Start server
npm run dev
```

## Documentation & Reports

### File Analysis Report

Otomatik dosya analiz sistemi ile kod kalitesini takip edin:

```bash
# Dosya analiz raporunu oluştur
npm run analyze

# Veya doğrudan
node scripts/analyze-files.js
```

Rapor konumu: `docs/roadmap/DOSYA_ANALIZI.md`

**Özellikler:**
- ✅ Frontend & Backend tüm dosyaları tarar (.tsx, .ts, .js, .sql)
- ✅ 5 seviye kategorizasyon (0-300, 301-450, 451-700, 701-900, 900+)
- ✅ Kritik dosyaları tespit eder
- ✅ Refactoring öncelik listesi oluşturur
- ✅ Detaylı istatistikler (toplam satır, ortalama boyut, vb.)

**GitHub Actions:**
- 🤖 Her `main` branch push'unda otomatik çalışır
- 📊 Raporu otomatik günceller
- 🔄 [skip ci] ile sonsuz döngü engellenir

**Eşik Değerleri:**
- ✅ 0-300 satır: İdeal
- ⚠️ 301-450 satır: Gözden geçir
- 🔴 451-700 satır: Bölünmeli
- 🔴🔴 701-900 satır: Acil
- 🔴🔴🔴 900+ satır: Kritik

## Project Structure

```
HzmVeriTabaniBackend/
├── src/
│   ├── server.js           # Express server
│   ├── config/             # Configuration (database, redis, etc.)
│   ├── middleware/         # Express middleware (auth, RLS, etc.)
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── adapters/           # Storage/Cache adapters
│   └── utils/              # Helper functions
├── migrations/             # Database migrations (SQL)
├── tests/                  # Test files
├── docker-compose.yml      # Docker setup
├── Dockerfile              # Production container
└── package.json
```

## Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Environment Variables (Railway)

```
NODE_ENV=production
DATABASE_URL=(auto-provided by Railway)
REDIS_URL=(auto-provided by Railway)
JWT_SECRET=your-production-secret
FRONTEND_URL=https://hzm.netlify.app
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project

### Generic Data (JSONB)
- `POST /api/v1/generic-data` - Create record
- `GET /api/v1/generic-data?table_id=:id` - List records
- `GET /api/v1/generic-data/:id` - Get record
- `PUT /api/v1/generic-data/:id` - Update record
- `DELETE /api/v1/generic-data/:id` - Delete record

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## License

MIT


