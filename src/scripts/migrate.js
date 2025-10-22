const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function runMigrations() {
  try {
    logger.info('🔄 Starting database migrations...');

    // Create migrations tracking table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`Found ${files.length} migration files`);

    for (const file of files) {
      // Check if migration already executed
      const result = await pool.query(
        'SELECT id FROM public.schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (result.rows.length > 0) {
        logger.info(`⏭️  Skipping (already executed): ${file}`);
        continue;
      }

      logger.info(`Running migration: ${file}`);
      
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await pool.query(sql);
      
      // Record migration as executed
      await pool.query(
        'INSERT INTO public.schema_migrations (migration_name) VALUES ($1)',
        [file]
      );
      
      logger.info(`✅ Completed: ${file}`);
    }

    logger.info('✅ All migrations completed successfully!');
    return true;
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
}

// Only exit if run directly (not imported)
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  module.exports = runMigrations;
}

