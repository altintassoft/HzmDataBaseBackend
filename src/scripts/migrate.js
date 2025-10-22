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
      
      // Split SQL into statements and execute each separately
      // This allows DROP IF EXISTS to work properly
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      logger.info(`📝 Parsed ${statements.length} statements from ${file}`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        logger.info(`🔹 Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);
        
        try {
          const result = await pool.query(statement);
          logger.info(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          logger.error(`❌ Statement ${i + 1} failed: ${error.message} (code: ${error.code})`);
          // Log but continue for idempotent operations
          if (error.code === '42P07' || // relation already exists
              error.code === '42710' || // policy already exists  
              error.code === '42P16') { // trigger already exists
            logger.warn(`⚠️  Skipping statement (already exists)`);
          } else {
            throw error;
          }
        }
      }
      
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

