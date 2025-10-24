# 🔄 Job Queue System

> **BullMQ-based background processing - Reliable, scalable, monitored**

[◀️ Geri: Widget System](15_Widget_System.md) | [Ana Sayfa](README.md) | [İleri: MLM System ▶️](17_MLM_System.md)

---

## 📋 İçindekiler

1. [Why Job Queue?](#why-job-queue)
2. [Queue Architecture](#queue-architecture)
3. [Job Types](#job-types)
4. [Retry Strategy](#retry-strategy)
5. [Idempotency](#idempotency)
6. [Monitoring & Dead Letter Queue](#monitoring--dead-letter-queue)
7. [Per-Tenant Limits](#per-tenant-limits)

---

## Why Job Queue?

### Problems Without Queue

| Task | Sync (Bad) | Async (Good) |
|------|-----------|--------------|
| **Send email** | User waits 2s | ✅ Instant response |
| **Generate report** | Timeout 30s | ✅ Background job |
| **Webhook call** | User blocked | ✅ Fire & forget |
| **Image resize** | User waits 5s | ✅ Process later |
| **AI prompt** | Timeout 60s | ✅ Queue job |

### Benefits

- ✅ **Fast API response** - Offload heavy work
- ✅ **Retry mechanism** - Automatic retry with backoff
- ✅ **Rate limiting** - Control concurrency
- ✅ **Failure handling** - Dead letter queue
- ✅ **Monitoring** - Job status tracking
- ✅ **Prioritization** - High priority first
- ✅ **Scheduled jobs** - Cron-like scheduling

---

## Queue Architecture

### Queue Types

```
┌──────────────────────────────────────────┐
│  High Priority Queues (Concurrency: 10) │
│  - email                                 │
│  - notification                          │
│  - webhook                               │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│  Medium Priority (Concurrency: 5)        │
│  - report                                │
│  - export                                │
│  - image-processing                      │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│  Low Priority (Concurrency: 2)           │
│  - ai                                    │
│  - analytics                             │
│  - cleanup                               │
└──────────────────────────────────────────┘
```

### Setup

```javascript
// config/queues.js
const { Queue, Worker, QueueScheduler } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
};

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // Start with 2s, then 4s, 8s
  },
  removeOnComplete: 1000,    // Keep last 1000 completed
  removeOnFail: 5000         // Keep last 5000 failed
};

// Create queues
const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 1  // Highest priority
  }
});

const webhookQueue = new Queue('webhook', {
  connection,
  defaultJobOptions
});

const reportQueue = new Queue('report', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    timeout: 300000  // 5 minutes
  }
});

const aiQueue = new Queue('ai', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    timeout: 600000  // 10 minutes
  }
});

// Queue schedulers (for delayed/repeat jobs)
new QueueScheduler('email', { connection });
new QueueScheduler('webhook', { connection });
new QueueScheduler('report', { connection });
new QueueScheduler('ai', { connection });

module.exports = {
  emailQueue,
  webhookQueue,
  reportQueue,
  aiQueue
};
```

---

## Job Types

### 1. Email Jobs

```javascript
// jobs/emailJobs.js
const { emailQueue } = require('../config/queues');

/**
 * Send email
 */
async function sendEmail(tenantId, emailData) {
  const jobId = `email:${tenantId}:${Date.now()}:${crypto.randomUUID()}`;
  
  await emailQueue.add('send-email', {
    tenant_id: tenantId,
    to: emailData.to,
    subject: emailData.subject,
    body: emailData.body,
    template: emailData.template,
    template_data: emailData.template_data,
    attachments: emailData.attachments
  }, {
    jobId,  // Idempotency
    priority: emailData.priority || 5,
    delay: emailData.delay || 0
  });
  
  return { job_id: jobId };
}

/**
 * Send bulk emails
 */
async function sendBulkEmails(tenantId, recipients, emailData) {
  const jobs = recipients.map((to, index) => ({
    name: 'send-email',
    data: {
      tenant_id: tenantId,
      to,
      ...emailData
    },
    opts: {
      jobId: `email:${tenantId}:bulk:${Date.now()}:${index}`,
      delay: index * 100  // Stagger sends (100ms apart)
    }
  }));
  
  await emailQueue.addBulk(jobs);
  
  return { count: recipients.length };
}

module.exports = { sendEmail, sendBulkEmails };
```

### 2. Webhook Jobs

```javascript
// jobs/webhookJobs.js
const { webhookQueue } = require('../config/queues');

/**
 * Trigger webhook
 */
async function triggerWebhook(tenantId, event, payload) {
  const jobId = `webhook:${tenantId}:${event}:${Date.now()}`;
  
  await webhookQueue.add('trigger-webhook', {
    tenant_id: tenantId,
    event,
    payload,
    timestamp: Date.now()
  }, {
    jobId,
    attempts: 5,  // Retry 5 times
    backoff: {
      type: 'exponential',
      delay: 5000  // 5s, 10s, 20s, 40s, 80s
    }
  });
  
  return { job_id: jobId };
}

/**
 * Trigger multiple webhooks (for event)
 */
async function triggerWebhooksForEvent(tenantId, event, payload) {
  // Get active webhooks for this event
  const webhooks = await getWebhooksForEvent(tenantId, event);
  
  const jobs = webhooks.map(webhook => ({
    name: 'trigger-webhook',
    data: {
      tenant_id: tenantId,
      webhook_id: webhook.id,
      webhook_url: webhook.url,
      webhook_secret: webhook.secret,
      event,
      payload
    },
    opts: {
      jobId: `webhook:${tenantId}:${webhook.id}:${Date.now()}`
    }
  }));
  
  await webhookQueue.addBulk(jobs);
  
  return { webhooks: webhooks.length };
}

module.exports = { triggerWebhook, triggerWebhooksForEvent };
```

### 3. Report Jobs

```javascript
// jobs/reportJobs.js
const { reportQueue } = require('../config/queues');

/**
 * Generate report
 */
async function generateReport(tenantId, reportType, params) {
  const jobId = `report:${tenantId}:${reportType}:${Date.now()}`;
  
  await reportQueue.add('generate-report', {
    tenant_id: tenantId,
    report_type: reportType,
    params,
    format: params.format || 'csv',
    requested_by: params.user_id
  }, {
    jobId,
    priority: params.priority || 5,
    timeout: 300000  // 5 minutes
  });
  
  return { job_id: jobId };
}

/**
 * Schedule report (cron)
 */
async function scheduleReport(tenantId, reportConfig) {
  const jobId = `report:scheduled:${tenantId}:${reportConfig.id}`;
  
  await reportQueue.add('scheduled-report', {
    tenant_id: tenantId,
    report_config: reportConfig
  }, {
    jobId,
    repeat: {
      pattern: reportConfig.cron,  // '0 9 * * 1' (Mon 9am)
      tz: reportConfig.timezone || 'UTC'
    }
  });
  
  return { job_id: jobId };
}

module.exports = { generateReport, scheduleReport };
```

### 4. AI Jobs

```javascript
// jobs/aiJobs.js
const { aiQueue } = require('../config/queues');

/**
 * Process AI prompt
 */
async function processAIPrompt(tenantId, promptData) {
  const jobId = `ai:${tenantId}:${Date.now()}:${crypto.randomUUID()}`;
  
  await aiQueue.add('ai-prompt', {
    tenant_id: tenantId,
    prompt: promptData.prompt,
    model: promptData.model || 'gpt-4',
    max_tokens: promptData.max_tokens || 1000,
    temperature: promptData.temperature || 0.7,
    user_id: promptData.user_id
  }, {
    jobId,
    timeout: 600000  // 10 minutes
  });
  
  return { job_id: jobId };
}

module.exports = { processAIPrompt };
```

---

## Retry Strategy

### Exponential Backoff

```javascript
// Retry delays
Attempt 1: Immediate
Attempt 2: 2s delay
Attempt 3: 4s delay
Attempt 4: 8s delay
Attempt 5: 16s delay

// Total time: ~30s across 5 attempts
```

### Custom Retry Logic

```javascript
// workers/webhookWorker.js
new Worker('webhook', async (job) => {
  const { webhook_url, payload, webhook_secret } = job.data;
  
  try {
    const signature = generateSignature(payload, webhook_secret);
    
    const response = await axios.post(webhook_url, payload, {
      headers: {
        'X-Webhook-Signature': signature,
        'X-Event-Type': job.data.event,
        'X-Attempt': job.attemptsMade + 1
      },
      timeout: 30000  // 30s timeout
    });
    
    // Log success
    await logWebhookDelivery(job.data.webhook_id, job.id, 'success', {
      status: response.status,
      response_time: response.duration
    });
    
    return { success: true, status: response.status };
  } catch (error) {
    // Log failure
    await logWebhookDelivery(job.data.webhook_id, job.id, 'failed', {
      error: error.message,
      status: error.response?.status,
      attempt: job.attemptsMade + 1
    });
    
    // Retry?
    if (job.attemptsMade < job.opts.attempts - 1) {
      // Will retry automatically
      throw error;
    } else {
      // Final failure → Dead letter queue
      throw new Error(`Webhook failed after ${job.opts.attempts} attempts: ${error.message}`);
    }
  }
}, {
  connection,
  concurrency: 10,
  limiter: {
    max: 100,       // Max 100 webhooks
    duration: 1000  // per second
  }
});
```

---

## Idempotency

### Why Idempotency?

```javascript
// Without idempotency
await sendEmail(tenantId, emailData);  // Sent
await sendEmail(tenantId, emailData);  // Sent again! (Duplicate!)

// With idempotency
await sendEmail(tenantId, emailData, { jobId: 'email:123' });  // Sent
await sendEmail(tenantId, emailData, { jobId: 'email:123' });  // Skipped (already exists)
```

### Implementation

```javascript
// Idempotency key generation
function generateJobId(type, tenantId, data) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ type, tenantId, data }))
    .digest('hex');
  
  return `${type}:${tenantId}:${hash}`;
}

// Usage
const jobId = generateJobId('email', tenantId, {
  to: 'user@example.com',
  subject: 'Welcome!'
});

await emailQueue.add('send-email', emailData, { jobId });
```

### Idempotent Worker

```javascript
// workers/emailWorker.js
new Worker('email', async (job) => {
  const { tenant_id, to, subject, body } = job.data;
  
  // Check if already sent (DB check)
  const existing = await pool.query(`
    SELECT id FROM sent_emails 
    WHERE job_id = $1
  `, [job.id]);
  
  if (existing.rows.length > 0) {
    console.log(`Email already sent: ${job.id}`);
    return { skipped: true, reason: 'already_sent' };
  }
  
  // Send email
  await emailService.send({ to, subject, body });
  
  // Mark as sent
  await pool.query(`
    INSERT INTO sent_emails (job_id, tenant_id, recipient, sent_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  `, [job.id, tenant_id, to]);
  
  return { sent: true };
});
```

---

## Monitoring & Dead Letter Queue

### Job Status Tracking

```sql
CREATE TABLE job_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER,
  
  -- Job info
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  queue VARCHAR(50) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL,  -- 'pending', 'active', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  
  -- Data
  payload JSONB,
  result JSONB,
  error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX idx_job_logs_tenant ON job_logs(tenant_id);
CREATE INDEX idx_job_logs_status ON job_logs(status);
CREATE INDEX idx_job_logs_created ON job_logs(created_at);
```

### Log Job Progress

```javascript
// Log job start
async function logJobStart(job) {
  await pool.query(`
    INSERT INTO job_logs (job_id, tenant_id, job_type, queue, status, payload, started_at)
    VALUES ($1, $2, $3, $4, 'active', $5, CURRENT_TIMESTAMP)
    ON CONFLICT (job_id) DO UPDATE SET
      status = 'active',
      started_at = CURRENT_TIMESTAMP,
      attempts = job_logs.attempts + 1
  `, [job.id, job.data.tenant_id, job.name, job.queueName, job.data]);
}

// Log job completion
async function logJobComplete(job, result) {
  await pool.query(`
    UPDATE job_logs
    SET status = 'completed',
        result = $2,
        completed_at = CURRENT_TIMESTAMP
    WHERE job_id = $1
  `, [job.id, result]);
}

// Log job failure
async function logJobFailed(job, error) {
  await pool.query(`
    UPDATE job_logs
    SET status = 'failed',
        error = $2,
        failed_at = CURRENT_TIMESTAMP
    WHERE job_id = $1
  `, [job.id, error.message]);
}
```

### Dead Letter Queue

```javascript
// Dead letter queue for failed jobs
const deadLetterQueue = new Queue('dead-letter', { connection });

// Worker event listeners
worker.on('failed', async (job, error) => {
  // Final failure → move to DLQ
  if (job.attemptsMade >= job.opts.attempts) {
    await deadLetterQueue.add('dead-job', {
      original_queue: job.queueName,
      original_job_id: job.id,
      tenant_id: job.data.tenant_id,
      job_data: job.data,
      error: error.message,
      attempts: job.attemptsMade
    });
    
    // Alert admin
    await sendAlert({
      type: 'job_failed',
      queue: job.queueName,
      job_id: job.id,
      tenant_id: job.data.tenant_id,
      error: error.message
    });
  }
});
```

### Monitoring Dashboard

```javascript
// Get queue stats
async function getQueueStats() {
  const queues = ['email', 'webhook', 'report', 'ai'];
  
  const stats = await Promise.all(
    queues.map(async (queueName) => {
      const queue = new Queue(queueName, { connection });
      
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
    })
  );
  
  return stats;
}

// API endpoint
router.get('/admin/queues/stats', authenticate, isAdmin, async (req, res) => {
  const stats = await getQueueStats();
  res.json({ success: true, data: stats });
});
```

---

## Per-Tenant Limits

### Rate Limiting Per Tenant

```javascript
// Tenant-specific concurrency
const tenantLimits = {
  free: { concurrency: 2, max_jobs_per_minute: 10 },
  starter: { concurrency: 5, max_jobs_per_minute: 50 },
  pro: { concurrency: 10, max_jobs_per_minute: 200 },
  enterprise: { concurrency: 20, max_jobs_per_minute: 1000 }
};

// Check tenant limits before adding job
async function addJobWithLimits(tenantId, queue, jobName, jobData) {
  const tenant = await getTenant(tenantId);
  const limits = tenantLimits[tenant.plan] || tenantLimits.free;
  
  // Check rate limit
  const recentJobs = await pool.query(`
    SELECT COUNT(*) 
    FROM job_logs
    WHERE tenant_id = $1 
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
  `, [tenantId]);
  
  if (recentJobs.rows[0].count >= limits.max_jobs_per_minute) {
    throw new Error(`Rate limit exceeded: ${limits.max_jobs_per_minute} jobs/minute`);
  }
  
  // Add job
  return await queue.add(jobName, jobData);
}
```

---

## Best Practices

### ✅ DO

1. **Use idempotency keys** - Prevent duplicates
2. **Set timeout** - Prevent stuck jobs
3. **Log everything** - Job start, progress, complete, fail
4. **Retry with backoff** - Exponential backoff
5. **Monitor DLQ** - Alert on failures
6. **Limit concurrency** - Prevent overload
7. **Set TTL on completed** - removeOnComplete: 1000
8. **Stagger bulk jobs** - Add delay between jobs

### ❌ DON'T

1. **Don't block worker** - Use async/await
2. **Don't retry forever** - Max 5 attempts
3. **Don't ignore failures** - Log & alert
4. **Don't forget timeout** - Jobs can hang
5. **Don't overload queue** - Check limits first
6. **Don't lose job data** - Log to DB

---

## 🔗 İlgili Dökümanlar

- [13_Redis_Architecture.md](13_Redis_Architecture.md) - BullMQ uses Redis
- [14_Reports_Analytics.md](14_Reports_Analytics.md) - Report generation jobs
- [08_Security_Auth.md](08_Security_Auth.md) - Per-tenant rate limits

---

**Versiyon:** 1.0.0  
**Tarih:** Ekim 2025  
**Yazar:** HZM Development Team

---

**[◀️ Geri: Widget System](15_Widget_System.md) | [Ana Sayfa](README.md) | [İleri: MLM System ▶️](17_MLM_System.md)**

