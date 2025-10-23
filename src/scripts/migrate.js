const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/**
 * Calculate SHA-256 checksum of file content
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Check if migration has FORCE-RERUN flag
 */
function hasForceRerunFlag(content) {
  return content.includes('-- FORCE-RERUN: true') || 
         content.includes('-- FORCE-RERUN:true') ||
         content.includes('--FORCE-RERUN: true');
}

/**
 * Execute a single migration file
 */
async function executeMigration(file, sql, reason = 'new') {
  logger.info(`Running migration: ${file} (${reason})`);
  
  // Split SQL into statements and execute each separately
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  logger.info(`📝 Parsed ${statements.length} statements from ${file}`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    logger.info(`🔹 Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);
    
    try {
      await pool.query(statement);
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
  
  logger.info(`✅ Completed: ${file}`);
}

/**
 * Record or update migration in tracking table
 */
async function recordMigration(file, checksum, executedBy = 'system') {
  const checksumValue = checksum || null;
  
  // Check if migration already exists
  const existing = await pool.query(
    'SELECT id FROM public.schema_migrations WHERE migration_name = $1',
    [file]
  );

  if (existing.rows.length > 0) {
    // Update existing record
    await pool.query(
      'UPDATE public.schema_migrations SET checksum = $1, executed_at = CURRENT_TIMESTAMP, executed_by = $2 WHERE migration_name = $3',
      [checksumValue, executedBy, file]
    );
    logger.info(`📝 Updated tracking: ${file} (checksum: ${checksumValue?.substring(0, 8)}...)`);
  } else {
    // Insert new record
    await pool.query(
      'INSERT INTO public.schema_migrations (migration_name, checksum, executed_by) VALUES ($1, $2, $3)',
      [file, checksumValue, executedBy]
    );
    logger.info(`📝 Recorded tracking: ${file} (checksum: ${checksumValue?.substring(0, 8)}...)`);
  }
}

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
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Calculate checksum
      const currentChecksum = calculateChecksum(sql);
      
      // Check FORCE-RERUN flag
      const forceRerun = hasForceRerunFlag(sql);
      
      if (forceRerun) {
        logger.info(`🔄 FORCE-RERUN detected: ${file}`);
        await executeMigration(file, sql, 'force-rerun');
        await recordMigration(file, currentChecksum, 'force-flag');
        continue;
      }

      // Check if migration already executed
      const result = await pool.query(
        'SELECT id, checksum FROM public.schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (result.rows.length === 0) {
        // New migration - execute it
        await executeMigration(file, sql, 'new');
        await recordMigration(file, currentChecksum, 'system');
        continue;
      }

      // Migration exists - check if it changed
      const storedChecksum = result.rows[0].checksum;
      
      if (!storedChecksum) {
        // Old migration without checksum - skip but update checksum
        logger.info(`⏭️  Skipping (already executed): ${file}`);
        await pool.query(
          'UPDATE public.schema_migrations SET checksum = $1 WHERE migration_name = $2',
          [currentChecksum, file]
        );
        logger.info(`📝 Updated checksum for: ${file}`);
        continue;
      }

      if (storedChecksum !== currentChecksum) {
        // Migration changed - re-run it!
        logger.info(`🔄 Migration changed (checksum mismatch): ${file}`);
        logger.info(`   Old: ${storedChecksum.substring(0, 16)}...`);
        logger.info(`   New: ${currentChecksum.substring(0, 16)}...`);
        await executeMigration(file, sql, 'checksum-changed');
        await recordMigration(file, currentChecksum, 'checksum-rerun');
        continue;
      }

      // Unchanged - skip
      logger.info(`⏭️  Skipping (unchanged): ${file}`);
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
