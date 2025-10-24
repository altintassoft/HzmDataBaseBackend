# 🚀 Deployment Guide

> **Production deployment: Railway, AWS, Docker, Environment setup**

[Ana Sayfa](../README.md)

---

## 📋 İçindekiler

1. [Railway Deployment](#railway-deployment)
2. [AWS Deployment](#aws-deployment)
3. [Docker Setup](#docker-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Migration](#database-migration)
6. [SSL & Domain Setup](#ssl--domain-setup)
7. [Health Checks](#health-checks)

---

## Railway Deployment

### Step 1: Railway CLI Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link
```

### Step 2: railway.toml

```toml
# railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "./Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[[services]]
name = "backend"
source = "."

[[services.env]]
name = "NODE_ENV"
value = "production"

[[services.env]]
name = "PORT"
value = "5000"
```

### Step 3: Environment Variables

Railway Dashboard'da ekle:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://default:password@host:6379

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# S3 (File Upload)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=hzm-uploads
AWS_REGION=us-east-1

# Frontend URL (CORS)
FRONTEND_URL=https://yourdomain.com

# Node
NODE_ENV=production
PORT=5000
```

### Step 4: Deploy

```bash
# Deploy to Railway
railway up

# Check logs
railway logs

# Open dashboard
railway open
```

### Step 5: Custom Domain

```bash
# Railway Dashboard > Settings > Domains
# Add custom domain: api.yourdomain.com

# DNS Settings (Cloudflare/Namecheap)
# Type: CNAME
# Name: api
# Value: your-app.railway.app
```

---

## AWS Deployment

### Architecture

```
             ┌─────────────┐
             │   Route 53  │  (DNS)
             └──────┬──────┘
                    │
             ┌──────▼──────┐
             │ CloudFront  │  (CDN)
             └──────┬──────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼───────┐       ┌───────▼───────┐
│  S3 (Frontend)│       │   ALB (API)   │
└───────────────┘       └───────┬───────┘
                                │
                        ┌───────┴───────┐
                        │               │
                ┌───────▼──────┐ ┌──────▼──────┐
                │  ECS Fargate │ │  ECS Fargate│
                │  (Backend 1) │ │  (Backend 2)│
                └───────┬──────┘ └──────┬──────┘
                        └───────┬───────┘
                                │
                        ┌───────▼───────┐
                        │      RDS      │
                        │  (PostgreSQL) │
                        └───────────────┘
```

### Step 1: RDS (PostgreSQL)

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier hzm-db-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 14.6 \
  --master-username hzm_admin \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false
```

### Step 2: ElastiCache (Redis)

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id hzm-redis-prod \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxx
```

### Step 3: ECS (Container)

**task-definition.json:**
```json
{
  "family": "hzm-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-ecr-repo/hzm-backend:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "5000"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/hzm-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster hzm-cluster \
  --service-name hzm-backend \
  --task-definition hzm-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-zzz],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=5000"
```

### Step 4: S3 (Frontend Static Files)

```bash
# Create S3 bucket
aws s3 mb s3://hzm-frontend-prod

# Build frontend
cd HzmFrontendVeriTabani
npm run build

# Upload to S3
aws s3 sync dist/ s3://hzm-frontend-prod --delete

# Set bucket policy (public read)
aws s3api put-bucket-policy \
  --bucket hzm-frontend-prod \
  --policy file://bucket-policy.json
```

**bucket-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hzm-frontend-prod/*"
    }
  ]
}
```

### Step 5: CloudFront (CDN)

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name hzm-frontend-prod.s3.amazonaws.com \
  --default-root-object index.html
```

---

## Docker Setup

### Dockerfile (Backend)

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build (if TypeScript)
# RUN npm run build

# ---

FROM node:18-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations

# Health check
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000

CMD ["node", "server.js"]
```

### docker-compose.yml (Local Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: hzm_postgres
    environment:
      POSTGRES_DB: hzm_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hzm_redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  backend:
    build: .
    container_name: hzm_backend
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/hzm_db
      REDIS_URL: redis://redis:6379
      PORT: 5000
    ports:
      - "5000:5000"
    volumes:
      - ./src:/app/src
      - ./migrations:/app/migrations
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

### Kullanım

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# Logs
docker-compose logs -f backend

# Stop
docker-compose down

# Cleanup
docker-compose down -v
```

---

## Environment Configuration

### `.env.example`

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hzm_db

# JWT
JWT_SECRET=your-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_TTL=3600

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@hzm.com

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=hzm-uploads
AWS_REGION=us-east-1
AWS_S3_ENDPOINT=  # Optional: for S3-compatible services (Cloudflare R2, MinIO)

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Webhook
WEBHOOK_SECRET=your-webhook-secret-key

# Feature Flags
ENABLE_2FA=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_WEBHOOKS=true

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Environment Validation

```javascript
// src/config/env.js
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform(Number),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url()
});

try {
  envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error.errors);
  process.exit(1);
}

module.exports = envSchema.parse(process.env);
```

---

## Database Migration

### Production Migration Script

```bash
#!/bin/bash
# deploy-migrations.sh

set -e

echo "🔄 Starting database migration..."

# Backup before migration
echo "📦 Creating backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
echo "🚀 Running migrations..."
node run-migrations.js

# Verify
echo "✅ Verifying migration..."
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"

echo "✅ Migration completed successfully!"
```

### Rollback Script

```bash
#!/bin/bash
# rollback-migration.sh

set -e

MIGRATION_VERSION=$1

if [ -z "$MIGRATION_VERSION" ]; then
  echo "Usage: ./rollback-migration.sh <version>"
  exit 1
fi

echo "⚠️  Rolling back to version: $MIGRATION_VERSION"

# Restore from backup
echo "📦 Restoring from backup..."
BACKUP_FILE="backup_${MIGRATION_VERSION}.sql"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

psql $DATABASE_URL < $BACKUP_FILE

echo "✅ Rollback completed!"
```

---

## SSL & Domain Setup

### Cloudflare (Önerilen)

**Avantajları:**
- ✅ Free SSL
- ✅ CDN
- ✅ DDoS protection
- ✅ Easy DNS management

**Setup:**
1. Cloudflare'e domain ekle
2. Nameserver'ları güncelle
3. SSL/TLS: Full (strict)
4. DNS: Add CNAME record

```
Type: CNAME
Name: api
Target: your-app.railway.app
Proxy: Enabled (🟠)
```

### Let's Encrypt (Self-hosted)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renew (cron)
0 0 * * * certbot renew --quiet
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/hzm-api
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Health Checks

### Health Endpoint

```javascript
// src/routes/health.js
const express = require('express');
const { pool } = require('../config/database');
const redis = require('../config/redis');

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    checks: {}
  };

  try {
    // Database check
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart
    };

    // Redis check
    const redisStart = Date.now();
    await redis.ping();
    health.checks.redis = {
      status: 'ok',
      responseTime: Date.now() - redisStart
    };

    res.status(200).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;
```

### Monitoring (UptimeRobot)

```bash
# Create monitor
URL: https://api.yourdomain.com/health
Type: HTTP(s)
Interval: 5 minutes
Alert Contacts: your-email@example.com
```

---

## 🔗 İlgili Dökümanlar

- [15-Database-Migrations/README.md](../15-Database-Migrations/README.md) - Migration strategy
- [04-Infrastructure/06_Backup_Recovery.md](../04-Infrastructure/06_Backup_Recovery.md) - Backup guide
- [11-Testing/README.md](../11-Testing/README.md) - Testing & CI/CD

---

**[Ana Sayfa](../README.md)**


