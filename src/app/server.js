const express = require('express');
const cors = require('cors');
const config = require('../core/config');
const logger = require('../core/logger');
const { initDatabase } = require('../core/config/database');
const { initRedis } = require('../core/config/redis');
const runMigrations = require('../scripts/migrate');
const { runFixes } = require('../scripts/fix-functions');

// Import modular routes (NEW - Clean Architecture)
const healthRoutes = require('../modules/health/health.routes');
const authRoutes = require('../modules/auth/auth.routes');
const projectModuleRoutes = require('../modules/projects/project.routes');
const adminRoutes = require('../modules/admin/admin.routes'); // ✅ MIGRATED!
const apiKeysRoutes = require('../modules/api-keys/api-keys.routes'); // ✅ MIGRATED!
const dataRoutes = require('../modules/data/data.routes'); // ✅ MIGRATED!

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);

// Modular routes (Clean Architecture) ✅
app.use('/api/v1/projects', projectModuleRoutes);
app.use('/api/v1/data', dataRoutes); // ✅ MIGRATED from routes.OLD/generic-data.js
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/api-keys', apiKeysRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'HZM Platform API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      projects: '/api/v1/projects',
      genericData: '/api/v1/generic-data',
      admin: '/api/v1/admin/database',
      apiKeys: '/api/v1/api-keys'
    },
    authentication: {
      web: 'JWT Token (Authorization: Bearer <token>)',
      api: 'API Key + Password (X-API-Key & X-API-Password headers)'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.isDevelopment ? err.message : undefined
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    // Run migrations first (before database init)
    logger.info('🔄 Running database migrations...');
    try {
      await runMigrations();
      logger.info('✅ Migrations completed successfully!');
    } catch (migrationError) {
      logger.error('❌ Migration failed:', migrationError);
      // Continue anyway - migrations might already be applied
      logger.warn('⚠️  Continuing despite migration error...');
    }

    // Initialize database
    logger.info('Initializing database...');
    await initDatabase();

    // Fix database functions (if needed)
    logger.info('Running database function fixes...');
    await runFixes();

    // Initialize Redis
    logger.info('Initializing Redis...');
    await initRedis();

    // Start server
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`🚀 HZM Platform API running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 Frontend URL: ${config.frontendUrl}`);
      logger.info(`✅ Architecture: core + modules + shared + middleware`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();
// GitHub Actions Test - Sun Oct 26 13:02:24 PDT 2025
