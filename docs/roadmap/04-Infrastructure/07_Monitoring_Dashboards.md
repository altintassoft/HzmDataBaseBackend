# 📊 Monitoring & Observability

> **Grafana, Prometheus, Logs, Metrics, Alerts**

[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)

---

## Prometheus Metrics

```javascript
// src/middleware/metrics.js
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);

// Middleware
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.path, res.statusCode).inc();
  });
  
  next();
};

module.exports = { register, metricsMiddleware };
```

### Metrics Endpoint

```javascript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Grafana Dashboards

**Key Metrics:**
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Database connection pool
- Redis hit rate
- Queue length

**[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)**


