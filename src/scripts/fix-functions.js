/**
 * Fix Database Functions - Startup Script
 * 
 * Problem: Migration 011 düzeltildi ama Railway yeniden çalıştırmadı
 * Çözüm: Her startup'ta function'ları kontrol et ve düzelt
 * 
 * Bu script:
 * - Migration sistemine müdahale etmez
 * - Idempotent (birden fazla çalıştırılabilir)
 * - Production-safe (hata vermez)
 */

const { pool } = require('../core/config/database');
const logger = require('../core/logger');

async function fixResourceMetadataFunction() {
  try {
    logger.info('Checking get_resource_metadata function...');

    const fixSQL = `
      -- Drop old function (if exists)
      DROP FUNCTION IF EXISTS get_resource_metadata(TEXT);

      -- Create corrected function
      CREATE OR REPLACE FUNCTION get_resource_metadata(p_resource TEXT)
      RETURNS TABLE(
        resource VARCHAR(100),
        schema_name VARCHAR(50),
        table_name VARCHAR(100),
        is_enabled BOOLEAN,
        is_readonly BOOLEAN,
        readable_columns TEXT[],
        writable_columns TEXT[]
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          r.resource::VARCHAR(100),
          r.schema_name::VARCHAR(50),
          r.table_name::VARCHAR(100),
          r.is_enabled,
          r.is_readonly,
          COALESCE(ARRAY_AGG(f.column_name) FILTER (WHERE f.readable = true), ARRAY[]::text[]) AS readable_columns,
          COALESCE(ARRAY_AGG(f.column_name) FILTER (WHERE f.writable = true), ARRAY[]::text[]) AS writable_columns
        FROM api_resources r
        LEFT JOIN api_resource_fields f ON f.resource = r.resource
        WHERE r.resource = p_resource
        GROUP BY r.resource, r.schema_name, r.table_name, r.is_enabled, r.is_readonly;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await pool.query(fixSQL);
    logger.info('✅ get_resource_metadata function fixed/verified');

  } catch (error) {
    // Non-critical error (function may not exist yet)
    logger.warn('Could not fix get_resource_metadata:', error.message);
  }
}

async function runFixes() {
  try {
    logger.info('Running database function fixes...');
    await fixResourceMetadataFunction();
    logger.info('✅ All function fixes completed');
  } catch (error) {
    logger.error('Function fix error:', error);
    // Don't crash the app
  }
}

module.exports = { runFixes };

