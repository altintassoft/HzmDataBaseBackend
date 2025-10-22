const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function runMigrations() {
  try {
    logger.info('🔄 Starting database migrations...');

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`Found ${files.length} migration files`);

    for (const file of files) {
      logger.info(`Running migration: ${file}`);
      
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await pool.query(sql);
      
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

