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

**[Ana Sayfa](../README.md)**


