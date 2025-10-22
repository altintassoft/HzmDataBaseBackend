const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

// Initialize database connection
const initDatabase = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('Database connected at:', result.rows[0].now);
    client.release();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Set RLS context for multi-tenancy
const setContext = async (client, tenantId, userId) => {
  try {
    await client.query('SELECT app.set_context($1, $2)', [tenantId, userId]);
  } catch (error) {
    logger.error('Failed to set RLS context:', error);
    throw error;
  }
};

// Execute query with RLS context
const queryWithContext = async (sql, params, tenantId, userId) => {
  const client = await pool.connect();
  try {
    // Set context for RLS
    await setContext(client, tenantId, userId);
    
    // Execute query
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initDatabase,
  setContext,
  queryWithContext
};

