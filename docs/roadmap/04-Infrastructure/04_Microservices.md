# 🚀 Microservices Architecture

## 📋 Genel Bakış

HZM Platform'da 4 bağımsız microservice çalışır. Her biri spesifik bir domain'e odaklanmıştır ve ayrı portlarda çalışır.

### Microservices

```
📦 Main Backend (Port 8080)
   ├── Core API
   ├── Authentication
   └── Database operations

📧 Communication Service (Port 8081)
   ├── Email sending
   ├── SMS notifications
   └── Push notifications

🔍 SEO Service (Port 8082)
   ├── Meta tag generation
   ├── Sitemap creation
   └── SEO analysis

📍 Address Service (Port 8083)
   ├── Geocoding
   ├── Address validation
   └── Map integration

💳 Accounting Service (Port 8084)
   ├── Invoice generation
   ├── Payment processing
   └── Financial reports
```

## 🏗️ Architecture

### Service Communication

```
Client Request
     ↓
Main Backend (8080)
     ├─→ Communication Service (8081)
     ├─→ SEO Service (8082)
     ├─→ Address Service (8083)
     └─→ Accounting Service (8084)
```

### Service Registry

```javascript
const MICROSERVICES = {
  communication: 'http://localhost:8081',
  seo: 'http://localhost:8082',
  address: 'http://localhost:8083',
  accounting: 'http://localhost:8084'
};
```

## 📧 Communication Service (8081)

### Endpoints

```bash
POST /api/v1/communication/email/send
     → Send email
     Body: { to, subject, body, template }

POST /api/v1/communication/sms/send
     → Send SMS
     Body: { to, message }

POST /api/v1/communication/push/send
     → Send push notification
     Body: { user_id, title, message }

GET  /api/v1/communication/templates
     → List email templates

GET  /api/v1/communication/logs
     → Communication logs
```

### Features
- ✅ Email templates (HTML/Text)
- ✅ SMS via Twilio/Vonage
- ✅ Push notifications (FCM)
- ✅ Queue system for bulk sending
- ✅ Delivery status tracking
- ✅ Retry mechanism

## 🔍 SEO Service (8082)

### Endpoints

```bash
POST /api/v1/seo/meta/generate
     → Generate meta tags
     Body: { title, description, keywords, og_image }

POST /api/v1/seo/sitemap/generate
     → Generate sitemap
     Body: { urls: [...] }

POST /api/v1/seo/analyze
     → SEO analysis
     Body: { url }

GET  /api/v1/seo/keywords/suggest
     → Keyword suggestions
     Query: ?text=...
```

### Features
- ✅ Auto meta tag generation
- ✅ Dynamic sitemap creation
- ✅ SEO score calculation
- ✅ Keyword density analysis
- ✅ Open Graph tags
- ✅ Schema.org markup

## 📍 Address Service (8083)

### Endpoints

```bash
POST /api/v1/address/geocode
     → Address to coordinates
     Body: { address }

POST /api/v1/address/reverse-geocode
     → Coordinates to address
     Body: { lat, lng }

POST /api/v1/address/validate
     → Validate address
     Body: { address }

GET  /api/v1/address/autocomplete
     → Address suggestions
     Query: ?query=...

POST /api/v1/address/distance
     → Calculate distance
     Body: { origin, destination }
```

### Features
- ✅ Google Maps integration
- ✅ Address validation
- ✅ Autocomplete suggestions
- ✅ Distance calculation
- ✅ Route optimization
- ✅ Geocoding cache

## 💳 Accounting Service (8084)

### Endpoints

```bash
POST /api/v1/accounting/invoice/create
     → Create invoice
     Body: { customer, items, tax }

POST /api/v1/accounting/payment/process
     → Process payment
     Body: { invoice_id, amount, method }

GET  /api/v1/accounting/reports/monthly
     → Monthly financial report

POST /api/v1/accounting/expense/create
     → Record expense
     Body: { category, amount, description }

GET  /api/v1/accounting/balance
     → Get current balance
```

### Features
- ✅ Invoice generation (PDF)
- ✅ Payment tracking
- ✅ Expense management
- ✅ Financial reports
- ✅ Tax calculations
- ✅ Multi-currency support

## 🔗 Service Communication

### HTTP Client

```javascript
// services/microserviceClient.js
class MicroserviceClient {
  static async call(service, endpoint, data) {
    const baseUrl = MICROSERVICES[service];
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': process.env.SERVICE_TOKEN
      },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }
}

// Usage
const result = await MicroserviceClient.call(
  'communication',
  '/api/v1/communication/email/send',
  { to: 'user@example.com', subject: 'Hello' }
);
```

### Event Bus Integration

```javascript
// Publish event
eventBus.publish({
  type: 'order.created',
  data: { order_id: 123, total: 99.99 }
});

// Communication service subscribes
eventBus.subscribe('order.created', async (event) => {
  await sendOrderConfirmationEmail(event.data);
});
```

## ⚡ Health Checks

### Main Backend

```bash
GET /api/v1/microservices/status

Response:
{
  "communication": { "status": "healthy", "latency": 45 },
  "seo": { "status": "healthy", "latency": 32 },
  "address": { "status": "healthy", "latency": 78 },
  "accounting": { "status": "healthy", "latency": 55 }
}
```

### Individual Services

```bash
GET http://localhost:8081/health  → Communication
GET http://localhost:8082/health  → SEO
GET http://localhost:8083/health  → Address
GET http://localhost:8084/health  → Accounting
```

## 🔒 Security

### Service Authentication

```javascript
// Each service validates service token
const validateServiceToken = (req, res, next) => {
  const token = req.headers['x-service-token'];
  
  if (token !== process.env.SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};
```

### Rate Limiting

```javascript
// Per-service rate limits
{
  communication: '100 req/min',
  seo: '50 req/min',
  address: '200 req/min',
  accounting: '50 req/min'
}
```

## 🎯 Best Practices

1. **Circuit Breaker:** Fallback when service down
2. **Retry Logic:** Automatic retry with exponential backoff
3. **Timeout:** Set reasonable timeouts (5-10s)
4. **Logging:** Centralized logging for all services
5. **Monitoring:** Health checks every 30s
6. **Caching:** Cache frequent requests

## 📊 Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  main:
    build: ./
    ports:
      - "8080:8080"
  
  communication:
    build: ./microservices/communication
    ports:
      - "8081:8081"
  
  seo:
    build: ./microservices/seo
    ports:
      - "8082:8082"
  
  address:
    build: ./microservices/address
    ports:
      - "8083:8083"
  
  accounting:
    build: ./microservices/accounting
    ports:
      - "8084:8084"
```

---

**Dosya:** `04-Infrastructure/22_Microservices.md`  
**Versiyon:** 1.0.0  
**Son Güncelleme:** 2025-10-21  
**Durum:** ✅ Production Ready

