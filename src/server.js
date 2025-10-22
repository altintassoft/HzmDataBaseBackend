const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');
const runMigrations = require('./scripts/migrate');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const genericDataRoutes = require('./routes/generic-data');
const debugRoutes = require('./routes/debug');
const adminRoutes = require('./routes/admin');
const apiKeysRoutes = require('./routes/api-keys');
const protectedRoutes = require('./routes/protected');

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
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/generic-data', genericDataRoutes);
app.use('/api/v1/debug', debugRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/api-keys', apiKeysRoutes);
app.use('/api/v1/protected', protectedRoutes);

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
      debug: '/api/v1/debug',
      protected: '/api/v1/protected (requires API Key + Password)',
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
    // Initialize database
    logger.info('Initializing database...');
    await initDatabase();

    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();

    // Initialize Redis
    logger.info('Initializing Redis...');
    await initRedis();

    // Start server
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`🚀 HZM Platform API running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 Frontend URL: ${config.frontendUrl}`);
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
