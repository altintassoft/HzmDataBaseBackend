# 🔴 Redis Architecture

> **Cache, Rate Limiting, Job Queue, Session - Enterprise-grade Redis design**

[◀️ Geri: Table Template](12_Table_Template.md) | [Ana Sayfa](README.md) | [İleri: Reports & Analytics ▶️](14_Reports_Analytics.md)

---

## 📋 İçindekiler

1. [Redis Neden Gerekli?](#redis-neden-gerekli)
2. [Key Design Strategy](#key-design-strategy)
3. [Cache Strategy](#cache-strategy)
4. [Rate Limiting](#rate-limiting)
5. [Session Storage](#session-storage)
6. [Job Queue (BullMQ)](#job-queue-bullmq)
7. [Widget State](#widget-state)
8. [Configuration & Best Practices](#configuration--best-practices)

---

## Redis Neden Gerekli?

### 40+ Tenant Senaryosu

| Sorun | PostgreSQL | Redis |
|-------|-----------|-------|
| **Ürün listesi (10K ürün)** | 50-200ms | 2-5ms ⚡ |
| **Rate limit check** | 10-20ms | <1ms ⚡ |
| **Session validation** | 15-30ms | <1ms ⚡ |
| **Dashboard widgets** | 100-500ms | 5-10ms ⚡ |
| **Job queue** | ❌ Complex | ✅ Native ⚡ |

**Sonuç:** 10x-100x performance boost + PostgreSQL yükünü azaltır

---

## Key Design Strategy

### Namespace Hierarchy

```
{app}:{env}:{tenant}:{feature}:{key}
```

**Örnekler:**
```
hzm:prod:10:products:list
hzm:prod:10:user:123:session
hzm:prod:10:widget:sales-chart:state
hzm:prod:rl:api:hzm_live_abc123:minute
```

### Key Pattern'ler

#### 1. Tenant Data Cache

```javascript
// Products cache
Key: hzm:{env}:tenant:{tenant_id}:products:list:{page}:{filters_hash}
TTL: 300s (5 minutes)
Type: STRING (JSON)

// Single product
Key: hzm:{env}:tenant:{tenant_id}:product:{product_id}
TTL: 600s (10 minutes)
Type: STRING (JSON)

// Categories cache
Key: hzm:{env}:tenant:{tenant_id}:categories:tree
TTL: 3600s (1 hour)
Type: STRING (JSON)
```

#### 2. Rate Limiting

```javascript
// Per API key
Key: hzm:{env}:rl:api:{api_key_prefix}:minute
TTL: 60s
Type: STRING (counter)

Key: hzm:{env}:rl:api:{api_key_prefix}:day
TTL: 86400s (24 hours)
Type: STRING (counter)

// Per tenant
Key: hzm:{env}:rl:tenant:{tenant_id}:minute
TTL: 60s
Type: STRING (counter)
```

#### 3. Session Storage

```javascript
// JWT sessions (optional, for revocation)
Key: hzm:{env}:session:{token_hash}
TTL: 604800s (7 days)
Type: HASH
Fields: {
  user_id: 123,
  tenant_id: 10,
  created_at: 1729512000,
  last_activity: 1729513000
}

// Active sessions per user
Key: hzm:{env}:user:{user_id}:sessions
TTL: 2592000s (30 days)
Type: SET
Members: [token_hash_1, token_hash_2, ...]
```

#### 4. Job Queue

```javascript
// BullMQ queues
Queue: hzm:{env}:queue:email
Queue: hzm:{env}:queue:webhook
Queue: hzm:{env}:queue:report
Queue: hzm:{env}:queue:ai

// Job data (BullMQ handles internally)
Key: bull:hzm:prod:queue:email:{job_id}
```

#### 5. Widget State

```javascript
// Dashboard widget state
Key: hzm:{env}:tenant:{tenant_id}:widget:{widget_id}:state
TTL: 86400s (24 hours)
Type: HASH
Fields: {
  config: {...},
  data: {...},
  last_refresh: 1729512000
}

// Widget cache
Key: hzm:{env}:tenant:{tenant_id}:widget:{widget_id}:data
TTL: 300s (5 minutes)
Type: STRING (JSON)
```

---

## Cache Strategy

### Read-Through Cache Pattern

```javascript
// services/cacheService.js
class CacheService {
  constructor(redis, pool) {
    this.redis = redis;
    this.pool = pool;
  }
  
  /**
   * Get with cache (read-through)
   */
  async get(tenantId, key, fetchFn, ttl = 300) {
    const cacheKey = `hzm:${process.env.NODE_ENV}:tenant:${tenantId}:${key}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Cache miss → fetch from DB
    const data = await fetchFn();
    
    // Store in cache
    await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    
    return data;
  }
  
  /**
   * Invalidate cache
   */
  async invalidate(tenantId, pattern) {
    const searchPattern = `hzm:${process.env.NODE_ENV}:tenant:${tenantId}:${pattern}`;
    
    // Scan and delete
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor, 'MATCH', searchPattern, 'COUNT', 100
      );
      cursor = newCursor;
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
```

### Usage Example

```javascript
// Get products with cache
const products = await cacheService.get(
  tenantId,
  'products:list:page:1',
  async () => {
    // DB query
    const result = await pool.query(
      'SELECT * FROM products WHERE tenant_id = $1 LIMIT 20',
      [tenantId]
    );
    return result.rows;
  },
  300  // 5 minutes TTL
);

// Invalidate on update
await pool.query('UPDATE products SET name = $1 WHERE id = $2', [name, id]);
await cacheService.invalidate(tenantId, 'products:*');
```

### Cache Warmup

```javascript
// Startup cache warmup for hot tenants
async function warmupCache(tenantIds) {
  for (const tenantId of tenantIds) {
    // Warm categories
    await cacheService.get(tenantId, 'categories:tree', async () => {
      return await fetchCategories(tenantId);
    });
    
    // Warm top products
    await cacheService.get(tenantId, 'products:top:20', async () => {
      return await fetchTopProducts(tenantId, 20);
    });
  }
}
```

---

## Rate Limiting

### Redis-Based Rate Limiter

```javascript
// services/rateLimiter.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

class RateLimiter {
  /**
   * Check rate limit (sliding window)
   */
  async check(identifier, limits = {}) {
    const { perMinute = 60, perHour = 1000, perDay = 10000 } = limits;
    const env = process.env.NODE_ENV;
    
    // Keys
    const minuteKey = `hzm:${env}:rl:${identifier}:minute`;
    const hourKey = `hzm:${env}:rl:${identifier}:hour`;
    const dayKey = `hzm:${env}:rl:${identifier}:day`;
    
    // Increment counters atomically
    const pipeline = redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600);
    pipeline.incr(dayKey);
    pipeline.expire(dayKey, 86400);
    
    const results = await pipeline.exec();
    
    const [minuteCount] = results[0][1];
    const [hourCount] = results[2][1];
    const [dayCount] = results[4][1];
    
    // Check limits
    if (minuteCount > perMinute) {
      return {
        allowed: false,
        reason: 'per_minute',
        limit: perMinute,
        current: minuteCount,
        retry_after: await redis.ttl(minuteKey)
      };
    }
    
    if (hourCount > perHour) {
      return {
        allowed: false,
        reason: 'per_hour',
        limit: perHour,
        current: hourCount,
        retry_after: await redis.ttl(hourKey)
      };
    }
    
    if (dayCount > perDay) {
      return {
        allowed: false,
        reason: 'per_day',
        limit: perDay,
        current: dayCount,
        retry_after: await redis.ttl(dayKey)
      };
    }
    
    return {
      allowed: true,
      remaining: {
        minute: perMinute - minuteCount,
        hour: perHour - hourCount,
        day: perDay - dayCount
      }
    };
  }
  
  /**
   * Reset rate limit (admin action)
   */
  async reset(identifier) {
    const env = process.env.NODE_ENV;
    const pattern = `hzm:${env}:rl:${identifier}:*`;
    
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

module.exports = new RateLimiter();
```

### Middleware Usage

```javascript
// middleware/rateLimit.js
async function rateLimit(req, res, next) {
  const identifier = req.api_key?.id || req.user?.id || req.ip;
  
  const limits = {
    perMinute: req.api_key?.rate_limit_per_minute || 60,
    perHour: 1000,
    perDay: req.api_key?.rate_limit_per_day || 10000
  };
  
  const result = await rateLimiter.check(`api:${identifier}`, limits);
  
  // Set response headers
  res.setHeader('X-RateLimit-Limit-Minute', limits.perMinute);
  res.setHeader('X-RateLimit-Limit-Day', limits.perDay);
  
  if (result.allowed) {
    res.setHeader('X-RateLimit-Remaining-Minute', result.remaining.minute);
    res.setHeader('X-RateLimit-Remaining-Day', result.remaining.day);
    next();
  } else {
    res.setHeader('Retry-After', result.retry_after);
    res.status(429).json({
      error: 'Rate limit exceeded',
      reason: result.reason,
      limit: result.limit,
      current: result.current,
      retry_after: result.retry_after
    });
  }
}
```

---

## Session Storage

### Redis Session Store

```javascript
// services/sessionService.js
class SessionService {
  constructor(redis) {
    this.redis = redis;
  }
  
  /**
   * Create session
   */
  async createSession(userId, tenantId, deviceInfo) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const sessionData = {
      user_id: userId,
      tenant_id: tenantId,
      device_id: deviceInfo.device_id,
      device_name: deviceInfo.device_name,
      ip_address: deviceInfo.ip,
      user_agent: deviceInfo.user_agent,
      created_at: Date.now(),
      last_activity: Date.now()
    };
    
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:session:${tokenHash}`;
    const userSessionsKey = `hzm:${env}:user:${userId}:sessions`;
    
    // Store session
    await this.redis.pipeline()
      .hmset(key, sessionData)
      .expire(key, 604800)  // 7 days
      .sadd(userSessionsKey, tokenHash)
      .expire(userSessionsKey, 2592000)  // 30 days
      .exec();
    
    return token;
  }
  
  /**
   * Validate session
   */
  async validateSession(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:session:${tokenHash}`;
    
    const sessionData = await this.redis.hgetall(key);
    
    if (!sessionData || Object.keys(sessionData).length === 0) {
      return null;
    }
    
    // Update last activity
    await this.redis.hset(key, 'last_activity', Date.now());
    
    return sessionData;
  }
  
  /**
   * Revoke session
   */
  async revokeSession(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:session:${tokenHash}`;
    
    const sessionData = await this.redis.hgetall(key);
    if (sessionData.user_id) {
      const userSessionsKey = `hzm:${env}:user:${sessionData.user_id}:sessions`;
      await this.redis.srem(userSessionsKey, tokenHash);
    }
    
    await this.redis.del(key);
  }
  
  /**
   * Get all user sessions
   */
  async getUserSessions(userId) {
    const env = process.env.NODE_ENV;
    const userSessionsKey = `hzm:${env}:user:${userId}:sessions`;
    
    const tokenHashes = await this.redis.smembers(userSessionsKey);
    
    const sessions = [];
    for (const tokenHash of tokenHashes) {
      const key = `hzm:${env}:session:${tokenHash}`;
      const sessionData = await this.redis.hgetall(key);
      if (Object.keys(sessionData).length > 0) {
        sessions.push({ token_hash: tokenHash, ...sessionData });
      }
    }
    
    return sessions;
  }
}
```

---

## Job Queue (BullMQ)

### Queue Setup

```javascript
// services/queueService.js
const { Queue, Worker, QueueScheduler } = require('bullmq');

// Queue configuration
const queueConfig = {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 1000,  // Keep last 1000 completed
    removeOnFail: 5000       // Keep last 5000 failed
  }
};

// Create queues
const emailQueue = new Queue('email', queueConfig);
const webhookQueue = new Queue('webhook', queueConfig);
const reportQueue = new Queue('report', queueConfig);
const aiQueue = new Queue('ai', queueConfig);

// Queue schedulers (for delayed/repeat jobs)
new QueueScheduler('email', queueConfig);
new QueueScheduler('webhook', queueConfig);
new QueueScheduler('report', queueConfig);
new QueueScheduler('ai', queueConfig);
```

### Job Producers

```javascript
// Add email job
async function sendEmail(tenantId, emailData) {
  await emailQueue.add('send-email', {
    tenant_id: tenantId,
    to: emailData.to,
    subject: emailData.subject,
    body: emailData.body,
    template: emailData.template
  }, {
    priority: emailData.priority || 5,
    delay: emailData.delay || 0,
    jobId: `email:${tenantId}:${Date.now()}`  // Idempotency
  });
}

// Add webhook job
async function triggerWebhook(tenantId, event, payload) {
  await webhookQueue.add('trigger-webhook', {
    tenant_id: tenantId,
    event,
    payload,
    attempt: 1
  }, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });
}

// Add report generation job
async function generateReport(tenantId, reportType, params) {
  await reportQueue.add('generate-report', {
    tenant_id: tenantId,
    report_type: reportType,
    params,
    requested_at: Date.now()
  }, {
    priority: 3,
    timeout: 300000  // 5 minutes
  });
}
```

### Job Workers

```javascript
// workers/emailWorker.js
new Worker('email', async (job) => {
  const { tenant_id, to, subject, body, template } = job.data;
  
  console.log(`Processing email job ${job.id} for tenant ${tenant_id}`);
  
  // Send email via SMTP
  await emailService.send({
    to,
    subject,
    html: template ? renderTemplate(template, body) : body
  });
  
  // Update job progress
  await job.updateProgress(100);
  
  return { sent: true, sent_at: Date.now() };
}, {
  connection: queueConfig.connection,
  concurrency: 5,  // Process 5 emails concurrently
  limiter: {
    max: 100,      // Max 100 jobs
    duration: 60000  // per minute
  }
});

// workers/webhookWorker.js
new Worker('webhook', async (job) => {
  const { tenant_id, event, payload, attempt } = job.data;
  
  // Get webhooks for this tenant & event
  const webhooks = await getWebhooksForEvent(tenant_id, event);
  
  for (const webhook of webhooks) {
    try {
      await axios.post(webhook.url, payload, {
        headers: {
          'X-Webhook-Signature': generateSignature(payload, webhook.secret),
          'X-Event-Type': event
        },
        timeout: webhook.timeout_seconds * 1000
      });
      
      // Log success
      await logWebhookDelivery(webhook.id, job.id, 'success');
    } catch (error) {
      // Log failure
      await logWebhookDelivery(webhook.id, job.id, 'failed', error.message);
      
      // Retry
      if (attempt < 5) {
        throw error;  // BullMQ will retry
      }
    }
  }
}, {
  connection: queueConfig.connection,
  concurrency: 10
});
```

### Job Monitoring

```javascript
// Get queue stats
async function getQueueStats(queueName) {
  const queue = new Queue(queueName, queueConfig);
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);
  
  return {
    queue: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed
  };
}

// Monitor all queues
async function monitorQueues() {
  const stats = await Promise.all([
    getQueueStats('email'),
    getQueueStats('webhook'),
    getQueueStats('report'),
    getQueueStats('ai')
  ]);
  
  return stats;
}
```

---

## Widget State

### Widget State Management

```javascript
// services/widgetStateService.js
class WidgetStateService {
  constructor(redis) {
    this.redis = redis;
  }
  
  /**
   * Save widget state
   */
  async saveState(tenantId, widgetId, state) {
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:tenant:${tenantId}:widget:${widgetId}:state`;
    
    await this.redis.hmset(key, {
      config: JSON.stringify(state.config),
      data: JSON.stringify(state.data),
      last_refresh: Date.now()
    });
    
    await this.redis.expire(key, 86400);  // 24 hours
  }
  
  /**
   * Get widget state
   */
  async getState(tenantId, widgetId) {
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:tenant:${tenantId}:widget:${widgetId}:state`;
    
    const state = await this.redis.hgetall(key);
    
    if (!state || Object.keys(state).length === 0) {
      return null;
    }
    
    return {
      config: JSON.parse(state.config),
      data: JSON.parse(state.data),
      last_refresh: parseInt(state.last_refresh)
    };
  }
  
  /**
   * Cache widget data
   */
  async cacheData(tenantId, widgetId, data, ttl = 300) {
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:tenant:${tenantId}:widget:${widgetId}:data`;
    
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }
  
  /**
   * Get cached widget data
   */
  async getCachedData(tenantId, widgetId) {
    const env = process.env.NODE_ENV;
    const key = `hzm:${env}:tenant:${tenantId}:widget:${widgetId}:data`;
    
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
}
```

---

## Configuration & Best Practices

### Redis Configuration

```conf
# redis.conf

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru  # LRU eviction for cache

# Persistence
appendonly yes
appendfsync everysec

# Performance
tcp-keepalive 300
timeout 0

# Security
requirepass your-strong-password
```

### Environment Variables

```bash
# .env
REDIS_URL=redis://:password@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-password
REDIS_DB=0

# Cluster (production)
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### Best Practices

#### ✅ DO

1. **Use namespaces** - `hzm:prod:tenant:10:products`
2. **Set TTL always** - Prevent memory leak
3. **Use pipelines** - Batch commands
4. **Monitor memory** - Set alerts at 80%
5. **Use Redis Cluster** - For production (3+ nodes)
6. **Implement circuit breaker** - Fallback to DB if Redis down
7. **Use connection pooling** - ioredis built-in
8. **Set maxmemory** - Prevent OOM

#### ❌ DON'T

1. **Don't use Redis as primary DB** - Cache only!
2. **Don't store large values** - Max 1MB per key
3. **Don't use KEYS command** - Use SCAN instead
4. **Don't forget TTL** - Memory leak risk
5. **Don't ignore eviction** - Configure maxmemory-policy
6. **Don't skip monitoring** - Use Redis CLI MONITOR sparingly

---

## Performance Metrics

### Target Metrics

| Operation | Target | Why |
|-----------|--------|-----|
| **GET** | < 1ms | Cache hit |
| **SET** | < 2ms | Write cache |
| **INCR** | < 1ms | Rate limit |
| **Pipeline (10 ops)** | < 5ms | Batch operations |
| **Queue add** | < 5ms | Job submission |

### Monitoring

```javascript
// Monitor Redis performance
setInterval(async () => {
  const info = await redis.info();
  const stats = parseRedisInfo(info);
  
  console.log({
    connected_clients: stats.connected_clients,
    used_memory_human: stats.used_memory_human,
    used_memory_peak_human: stats.used_memory_peak_human,
    hit_rate: stats.keyspace_hits / (stats.keyspace_hits + stats.keyspace_misses),
    ops_per_sec: stats.instantaneous_ops_per_sec
  });
}, 60000);  // Every minute
```

---

## 🔗 İlgili Dökümanlar

- [08_Security_Auth.md](08_Security_Auth.md) - Rate limiting
- [14_Reports_Analytics.md](14_Reports_Analytics.md) - Dashboard cache
- [16_Job_Queue_System.md](16_Job_Queue_System.md) - BullMQ jobs
- [11_Roadmap_TechStack.md](11_Roadmap_TechStack.md) - Infrastructure

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[◀️ Geri: Table Template](12_Table_Template.md) | [Ana Sayfa](README.md) | [İleri: Reports & Analytics ▶️](14_Reports_Analytics.md)**

