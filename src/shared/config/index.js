/**
 * Configuration Index
 * Centralized configuration export
 */

require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,

  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },

  // Redis (for future use)
  redis: {
    url: process.env.REDIS_URL,
    enabled: !!process.env.REDIS_URL
  },

  // CORS
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per windowMs
  },

  // Master Admin
  masterAdmin: {
    email: process.env.MASTER_ADMIN_EMAIL || 'ozgurhzm@hzmsoft.com',
    apiKey: process.env.MASTER_ADMIN_API_KEY,
    apiPassword: process.env.MASTER_ADMIN_API_PASSWORD
  }
};

module.exports = config;


