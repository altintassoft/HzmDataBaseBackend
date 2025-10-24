# 🔗 Webhook System

> **Webhook delivery with retry mechanism and HMAC signatures**

[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)

---

## Webhook Registration

```javascript
// src/routes/webhooks.js
router.post('/webhooks', authenticate, async (req, res) => {
  const { url, events, secret } = req.body;
  const tenantId = req.user.tenant_id;

  const result = await pool.query(`
    INSERT INTO comms.webhooks (tenant_id, url, secret, events, retry_policy)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    tenantId,
    url,
    secret || crypto.randomBytes(32).toString('hex'),
    events,
    JSON.stringify({ max_attempts: 3, backoff: 'exponential' })
  ]);

  res.json(result.rows[0]);
});
```

## Webhook Delivery

```javascript
// src/services/webhook.service.js
const axios = require('axios');
const crypto = require('crypto');

const deliverWebhook = async (webhookId, eventType, payload) => {
  const webhook = await pool.query(
    'SELECT * FROM comms.webhooks WHERE id = $1 AND is_active = TRUE',
    [webhookId]
  );

  if (webhook.rows.length === 0) return;

  const wh = webhook.rows[0];
  const signature = createSignature(payload, wh.secret);

  try {
    const response = await axios.post(wh.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType
      },
      timeout: wh.timeout_seconds * 1000
    });

    // Log successful delivery
    await pool.query(`
      INSERT INTO comms.webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, delivered_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [webhookId, eventType, payload, response.status, response.data]);

    // Update stats
    await pool.query(`
      UPDATE comms.webhooks 
      SET last_triggered_at = NOW(), total_deliveries = total_deliveries + 1
      WHERE id = $1
    `, [webhookId]);

  } catch (error) {
    // Log failed delivery
    await pool.query(`
      INSERT INTO comms.webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, attempt_number, next_retry_at)
      VALUES ($1, $2, $3, $4, $5, 1, NOW() + INTERVAL '5 minutes')
    `, [webhookId, eventType, payload, error.response?.status, error.message]);

    // Update failed count
    await pool.query(`
      UPDATE comms.webhooks 
      SET failed_deliveries = failed_deliveries + 1
      WHERE id = $1
    `, [webhookId]);
  }
};

const createSignature = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

module.exports = { deliverWebhook };
```

## Trigger Webhook

```javascript
// When record created
const { deliverWebhook } = require('../services/webhook.service');

// Get all webhooks for this tenant listening to 'record.created'
const webhooks = await pool.query(`
  SELECT id FROM comms.webhooks
  WHERE tenant_id = $1 AND 'record.created' = ANY(events) AND is_active = TRUE
`, [tenantId]);

for (const wh of webhooks.rows) {
  await deliverWebhook(wh.id, 'record.created', {
    tenant_id: tenantId,
    table_id: 123,
    record_id: 456,
    data: { ... },
    timestamp: new Date().toISOString()
  });
}
```

## Verify Signature (Receiving Side)

```javascript
// Webhook receiver endpoint
app.post('/webhook-receiver', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = 'your-webhook-secret';
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  console.log('Webhook received:', req.body);
  res.json({ success: true });
});
```

## Retry Mechanism (Background Worker)

```javascript
// Retry failed deliveries
setInterval(async () => {
  const failedDeliveries = await pool.query(`
    SELECT * FROM comms.webhook_deliveries
    WHERE delivered_at IS NULL
      AND next_retry_at <= NOW()
      AND attempt_number < 3
  `);

  for (const delivery of failedDeliveries.rows) {
    // Retry with exponential backoff
    const nextRetry = Math.pow(2, delivery.attempt_number) * 5; // 5min, 10min, 20min
    
    try {
      const webhook = await pool.query('SELECT * FROM comms.webhooks WHERE id = $1', [delivery.webhook_id]);
      const wh = webhook.rows[0];
      
      const response = await axios.post(wh.url, delivery.payload, {
        headers: {
          'X-Webhook-Signature': createSignature(delivery.payload, wh.secret),
          'X-Webhook-Event': delivery.event_type
        }
      });

      // Success - mark as delivered
      await pool.query(`
        UPDATE comms.webhook_deliveries 
        SET delivered_at = NOW(), response_status = $1, response_body = $2
        WHERE id = $3
      `, [response.status, response.data, delivery.id]);

    } catch (error) {
      // Failed again - schedule next retry
      await pool.query(`
        UPDATE comms.webhook_deliveries 
        SET attempt_number = attempt_number + 1, 
            next_retry_at = NOW() + INTERVAL '${nextRetry} minutes',
            response_status = $1,
            response_body = $2
        WHERE id = $3
      `, [error.response?.status, error.message, delivery.id]);
    }
  }
}, 60000); // Run every minute
```

**[Ana Sayfa](../README.md) | [Infrastructure](01_Roadmap_TechStack.md)**


