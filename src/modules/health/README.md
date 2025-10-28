# ❤️ Health Module

**Sistem Sağlık Kontrolü Modülü**

## 📋 Amaç

Uygulamanın sağlık durumunu, hazır olma durumunu ve canlılığını kontrol eder.

## 🌐 API Endpoints

### Public Endpoints (No auth required)

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/ready` - Readiness check (DB, services)
- `GET /api/v1/health/live` - Liveness check (ping)

## 🏗️ Mimari Katmanları

```
health.routes.js → health.controller.js
    (HTTP)              (Logic)
```

> **Not**: Health modülü servis/model katmanları gerektirmez (basit kontroller).

## 🚀 Kullanım Örneği

```bash
# Basic health
GET /api/v1/health

# Response
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}

# Readiness check
GET /api/v1/health/ready

# Response
{
  "success": true,
  "status": "ready",
  "checks": {
    "database": "ok",
    "memory": {...},
    "cpu": {...}
  }
}
```

## 🎯 Use Cases

1. **Load Balancer**: Health endpoint for traffic routing
2. **Kubernetes**: Liveness & readiness probes
3. **Monitoring**: Uptime tracking
4. **Railway**: Deployment health verification

## 🔐 Security

- ⚠️ **No authentication required** (public endpoints)
- ✅ Rate limiting recommended
- ✅ No sensitive data exposed

## 📊 Status Codes

- `200 OK` - System healthy/ready
- `500 Internal Server Error` - System unhealthy
- `503 Service Unavailable` - System not ready

## 🧪 Testing

```bash
npm test src/modules/health
```

## 🚀 Railway Configuration

```yaml
healthcheckPath: /api/v1/health
healthcheckTimeout: 30
```

## 🔄 Migration Status

- [ ] Add to server.js
- [ ] Configure Railway healthcheck
- [ ] Add monitoring alerts
- [ ] Add unit tests


