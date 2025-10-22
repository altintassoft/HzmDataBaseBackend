require('dotenv').config();

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hzm_db',
    ssl: process.env.DATABASE_SSL === 'true',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10)
  },

  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL || null, // Don't default to localhost in production
    keyPrefix: 'hzm:',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    enabled: process.env.REDIS_URL ? true : false
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // CORS
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',')
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = config;
