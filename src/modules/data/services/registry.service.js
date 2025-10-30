const pool = require('../../../core/database/pool');
const logger = require('../../../core/logger');

/**
 * API Registry Service
 * Metadata katmanından resource bilgilerini okur
 * 
 * @description
 * Generic handler için resource metadata'sını yönetir.
 * api_resources, api_resource_fields ve api_policies tablolarını okur.
 * 
 * @example
 * const meta = await RegistryService.getResourceMeta('projects');
 * console.log(meta.readableColumns); // ['id', 'name', 'description', ...]
 */
class RegistryService {
  /**
   * Resource metadata'sını getir
   * @param {string} resource - Resource adı (örn: 'users', 'projects')
   * @returns {Object|null} Resource metadata veya null
   * @throws {Error} Resource disabled ise hata fırlatır
   */
  static async getResourceMeta(resource) {
    try {
      const result = await pool.query(
        `SELECT * FROM get_resource_metadata($1)`,
        [resource]
      );

      if (!result.rows.length) {
        return null;
      }

      const meta = result.rows[0];

      // is_enabled kontrolü
      if (!meta.is_enabled) {
        throw new Error(`Resource '${resource}' is not enabled`);
      }

      return {
        resource: meta.resource,
        schema: meta.schema_name,
        table: meta.table_name,
        isReadonly: meta.is_readonly,
        readableColumns: meta.readable_columns || [],
        writableColumns: meta.writable_columns || [],
        
        // Helper methods
        readableSelect: (meta.readable_columns || []).join(', ') || '*',
        canRead: (column) => meta.readable_columns?.includes(column) || false,
        canWrite: (column) => meta.writable_columns?.includes(column) || false
      };
    } catch (error) {
      logger.error('Registry error:', { resource, error: error.message });
      throw error;
    }
  }

  /**
   * Resource policies'ini getir
   * @param {string} resource
   * @param {string} role - User role ('user', 'admin', 'master_admin')
   * @returns {Array} Active policies
   */
  static async getPolicies(resource, role) {
    try {
      const result = await pool.query(
        `SELECT policy_name, predicate_sql, applies_to_operations
         FROM api_policies
         WHERE resource = $1 
           AND is_enabled = true
           AND $2 = ANY(applies_to_roles)`,
        [resource, role]
      );
      return result.rows;
    } catch (error) {
      logger.error('Get policies error:', { resource, role, error: error.message });
      return [];
    }
  }

  /**
   * Tüm enabled resource'ları listele
   * @returns {Array} Resource listesi
   */
  static async listResources() {
    try {
      const result = await pool.query(
        `SELECT resource, description, is_readonly
         FROM api_resources
         WHERE is_enabled = true
         ORDER BY resource`
      );
      return result.rows;
    } catch (error) {
      logger.error('List resources error:', error);
      return [];
    }
  }

  /**
   * Resource enabled mi kontrol et (hafif kontrol)
   * @param {string} resource
   * @returns {boolean}
   */
  static async isEnabled(resource) {
    try {
      const result = await pool.query(
        `SELECT is_enabled FROM api_resources WHERE resource = $1`,
        [resource]
      );
      return result.rows.length > 0 && result.rows[0].is_enabled;
    } catch (error) {
      logger.error('Check enabled error:', { resource, error: error.message });
      return false;
    }
  }
}

module.exports = RegistryService;

