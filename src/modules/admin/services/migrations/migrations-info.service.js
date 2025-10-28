const { pool } = require('../../../../core/config/database');
const logger = require('../../../../core/logger');
const fs = require('fs');
const path = require('path');
const MigrationParser = require('../../../../core/database/migrationParser');

const MIGRATIONS_DIR = path.join(__dirname, '../../../../migrations');

/**
 * Migrations Info Service
 * Get list of migration files with execution status
 */
class MigrationsInfoService {
  /**
   * Get migrations info
   * @param {Array} includes - Optional includes: ['tracking']
   * @returns {Object} { total, migrations }
   */
  static async getMigrationsInfo(includes = []) {
    try {
      // Get migration tracking data if requested
      let trackingData = {};
      
      if (includes.includes('tracking')) {
        const trackingResult = await pool.query(`
          SELECT migration_name, executed_at 
          FROM public.schema_migrations 
          ORDER BY id;
        `);
        
        for (const row of trackingResult.rows) {
          trackingData[row.migration_name] = {
            executed: true,
            executed_at: row.executed_at
          };
        }
      }

      // Read migration files
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      const migrations = [];

      for (const file of files) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const parsed = MigrationParser.parseMigrationFile(filePath);
        
        if (parsed) {
          const tracking = trackingData[file] || { executed: false, executed_at: null };
          
          migrations.push({
            filename: parsed.filename,
            description: parsed.description,
            author: parsed.author,
            date: parsed.date,
            executed: tracking.executed,
            executed_at: tracking.executed_at,
            summary: MigrationParser.getMigrationSummary(parsed)
          });
        }
      }

      return {
        total: migrations.length,
        migrations
      };
    } catch (error) {
      logger.error('Failed to get migrations info:', error);
      return {
        error: 'Failed to read migrations',
        message: error.message
      };
    }
  }
}

module.exports = MigrationsInfoService;

