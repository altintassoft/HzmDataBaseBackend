const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../core/config/database');
const logger = require('../core/logger');

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
 * Remove block comments from SQL while preserving them inside dollar-quoted strings
 */
function removeBlockComments(sql) {
  let result = '';
  let inDollarQuote = false;
  let inBlockComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    
    // Check for $$ (dollar quote start/end)
    if (char === '$' && next === '$' && !inBlockComment) {
      inDollarQuote = !inDollarQuote;
      result += '$$';
      i++; // skip next $
      continue;
    }
    
    // Don't process comments inside dollar-quoted strings
    if (inDollarQuote) {
      result += char;
      continue;
    }
    
    // Check for block comment start /*
    if (char === '/' && next === '*' && !inBlockComment) {
      inBlockComment = true;
      i++; // skip *
      continue;
    }
    
    // Check for block comment end */
    if (char === '*' && next === '/' && inBlockComment) {
      inBlockComment = false;
      i++; // skip /
      continue;
    }
    
    // Skip characters inside block comments
    if (inBlockComment) {
      continue;
    }
    
    result += char;
  }
  
  return result;
}

/**
 * Execute a single migration file
 */
async function executeMigration(file, sql, reason = 'new') {
  logger.info(`Running migration: ${file} (${reason})`);
  
  // Split SQL into statements and execute each separately
  // Remove comments first, then split by semicolon
  // BUT: Respect $$ (dollar-quoted strings) - don't split inside them!
  
  // Step 1: Remove block comments (/* ... */)
  let cleanSql = removeBlockComments(sql);
  
  // Step 2: Remove single-line comments (--)
  cleanSql = cleanSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  // Smart split: respect $$ delimiters
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  
  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    const next = cleanSql[i + 1];
    
    // Check for $$ (dollar quote start/end)
    if (char === '$' && next === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++; // skip next $
      continue;
    }
    
    // Split on ; only if NOT inside $$...$$
    if (char === ';' && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Add last statement if exists
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }
  
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
          error.code === '42P16' || // trigger already exists
          error.code === '23505') { // duplicate key - for FORCE-RERUN scenarios
        logger.warn(`⚠️  Skipping statement (already exists or duplicate key)`);
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

  try {
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
  } catch (error) {
    // Checksum/executed_by columns might not exist yet (before 007 migration)
    if (error.code === '42703') { // column does not exist
      logger.warn(`⚠️  Checksum/executed_by columns not found, using basic tracking`);
      if (existing.rows.length > 0) {
        // Update without checksum/executed_by
        await pool.query(
          'UPDATE public.schema_migrations SET executed_at = CURRENT_TIMESTAMP WHERE migration_name = $1',
          [file]
        );
        logger.info(`📝 Updated tracking (basic): ${file}`);
      } else {
        // Insert without checksum/executed_by
        await pool.query(
          'INSERT INTO public.schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        logger.info(`📝 Recorded tracking (basic): ${file}`);
      }
    } else {
      throw error;
    }
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
      // Try to read checksum, but fall back to just id if column doesn't exist yet
      let result;
      let storedChecksum = null;
      
      try {
        result = await pool.query(
          'SELECT id, checksum FROM public.schema_migrations WHERE migration_name = $1',
          [file]
        );
        
        if (result.rows.length > 0) {
          storedChecksum = result.rows[0].checksum;
        }
      } catch (error) {
        // Checksum column might not exist yet (before 007 migration runs)
        if (error.code === '42703') { // column does not exist
          logger.warn(`⚠️  Checksum column not found (will be added by 007 migration)`);
          result = await pool.query(
            'SELECT id FROM public.schema_migrations WHERE migration_name = $1',
            [file]
          );
        } else {
          throw error;
        }
      }

      if (result.rows.length === 0) {
        // New migration - execute it
        await executeMigration(file, sql, 'new');
        await recordMigration(file, currentChecksum, 'system');
        continue;
      }

      // Migration exists - check if it changed
      
      if (!storedChecksum) {
        // Old migration without checksum - skip but update checksum if possible
        logger.info(`⏭️  Skipping (already executed): ${file}`);
        try {
          await pool.query(
            'UPDATE public.schema_migrations SET checksum = $1 WHERE migration_name = $2',
            [currentChecksum, file]
          );
          logger.info(`📝 Updated checksum for: ${file}`);
        } catch (error) {
          if (error.code === '42703') { // column does not exist
            logger.warn(`⚠️  Checksum column not available yet, skipping checksum update`);
          } else {
            throw error;
          }
        }
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

// Export for use in server.js
module.exports = runMigrations;

// Only run directly if this is the main module
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}
