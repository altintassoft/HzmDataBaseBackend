# 📖 API Documentation

> **OpenAPI 3.0 specification & Swagger UI setup**

[Ana Sayfa](../README.md)

---

## OpenAPI Spec

Tüm API endpoint'leri OpenAPI 3.0 spec ile dokümante edilmeli. Swagger UI ile otomatik dokümantasyon üretilir.

### Setup

```bash
npm install swagger-jsdoc swagger-ui-express
```

### Implementation

```javascript
// src/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HZM Platform API',
      version: '1.0.0',
      description: 'Multi-tenant Database-as-a-Service Platform'
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' },
      { url: 'https://api.yourdomain.com', description: 'Production' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/**/*.js']
};

module.exports = swaggerJsdoc(options);

// server.js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### Example Route Documentation

```javascript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);
```

---

## Admin Endpoints

### 🔄 Auto File Analysis

**Endpoint:** `POST /api/v1/admin/analyze-files`

**Description:** Triggers backend script to analyze frontend/backend file structure and updates `DOSYA_ANALIZI.md` report.

**Auth:** Admin or Master Admin only (JWT or API Key)

**Implementation:**

```javascript
// Backend: src/routes/admin.js
router.post('/analyze-files', authenticateJwtOrApiKey, async (req, res) => {
  // 🔒 ADMIN ONLY
  if (!['admin', 'master_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Run script in background
  exec(`node scripts/analyze-files.js`, (error, stdout, stderr) => {
    if (error) {
      logger.error('❌ File analysis failed:', error);
      return;
    }
    logger.info('✅ File analysis completed:', stdout);
  });
  
  res.json({
    success: true,
    message: 'Dosya analizi başlatıldı. DOSYA_ANALIZI.md birkaç saniye içinde güncellenecek.',
    note: 'Script arka planda çalışıyor.'
  });
});
```

**Frontend Usage:**

```typescript
// src/pages/admin/reports/tabs/ProjectStructureReportTab.tsx
const runAnalysis = async () => {
  setLoading(true);
  
  try {
    const data = await api.post('/admin/analyze-files');
    
    if (data.success) {
      // Wait 3 seconds for script to complete, then fetch updated report
      setTimeout(async () => {
        await fetchReport();
      }, 3000);
    }
  } catch (err) {
    setError('Analiz çalıştırılamadı');
  }
};
```

**Benefits:**
- ✅ Automatic file structure analysis
- ✅ No manual script execution needed
- ✅ Frontend reports always up-to-date
- ✅ Works on Railway (production)

---

**[Ana Sayfa](../README.md)**


