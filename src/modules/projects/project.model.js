const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Project Model - Database Access Layer
 * Handles all direct database interactions for projects
 */
class ProjectModel {
  /**
   * Find all projects by user ID
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID (for RLS)
   * @returns {Promise<Array>} List of projects
   */
  static async findByUserId(userId, tenantId) {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          tenant_id,
          owner_id,
          name,
          description,
          status,
          settings,
          created_at,
          updated_at,
          created_by,
          updated_by
        FROM core.projects
        WHERE owner_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
      `, [userId, tenantId]);

      return result.rows;
    } catch (error) {
      logger.error('Error finding projects by user:', error);
      throw error;
    }
  }

  /**
   * Find all projects by tenant ID (for admins)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} List of projects
   */
  static async findByTenantId(tenantId) {
    try {
      const result = await pool.query(`
        SELECT 
          p.*,
          u.email as owner_email,
          u.name as owner_name
        FROM core.projects p
        LEFT JOIN core.users u ON p.owner_id = u.id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
      `, [tenantId]);

      return result.rows;
    } catch (error) {
      logger.error('Error finding projects by tenant:', error);
      throw error;
    }
  }

  /**
   * Find project by ID
   * @param {string} projectId - Project ID
   * @param {string} tenantId - Tenant ID (for RLS)
   * @returns {Promise<Object|null>} Project or null
   */
  static async findById(projectId, tenantId) {
    try {
      const result = await pool.query(`
        SELECT 
          p.*,
          u.email as owner_email,
          u.name as owner_name
        FROM core.projects p
        LEFT JOIN core.users u ON p.owner_id = u.id
        WHERE p.id = $1 AND p.tenant_id = $2
      `, [projectId, tenantId]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding project by ID:', error);
      throw error;
    }
  }

  /**
   * Create new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  static async create(projectData) {
    const { tenantId, ownerId, name, description, status, settings, createdBy } = projectData;

    try {
      const result = await pool.query(`
        INSERT INTO core.projects (
          tenant_id,
          owner_id,
          name,
          description,
          status,
          settings,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING *
      `, [
        tenantId,
        ownerId,
        name,
        description || null,
        status || 'active',
        settings || {},
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Update project
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated project
   */
  static async update(projectId, updateData) {
    const { name, description, status, settings, updatedBy } = updateData;

    try {
      const result = await pool.query(`
        UPDATE core.projects
        SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          status = COALESCE($4, status),
          settings = COALESCE($5, settings),
          updated_by = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [projectId, name, description, status, settings, updatedBy]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating project:', error);
      throw error;
    }
  }

  /**
   * Delete project (soft delete by setting status)
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID (for audit)
   * @returns {Promise<boolean>} Success status
   */
  static async delete(projectId, userId) {
    try {
      const result = await pool.query(`
        UPDATE core.projects
        SET 
          status = 'deleted',
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [projectId, userId]);

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting project:', error);
      throw error;
    }
  }

  /**
   * Check if project name exists for user
   * @param {string} name - Project name
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} excludeId - Project ID to exclude (for updates)
   * @returns {Promise<boolean>} True if exists
   */
  static async nameExists(name, userId, tenantId, excludeId = null) {
    try {
      const query = excludeId
        ? `SELECT id FROM core.projects 
           WHERE LOWER(name) = LOWER($1) 
           AND owner_id = $2 
           AND tenant_id = $3 
           AND id != $4
           AND status != 'deleted'`
        : `SELECT id FROM core.projects 
           WHERE LOWER(name) = LOWER($1) 
           AND owner_id = $2 
           AND tenant_id = $3
           AND status != 'deleted'`;

      const params = excludeId 
        ? [name, userId, tenantId, excludeId]
        : [name, userId, tenantId];

      const result = await pool.query(query, params);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking project name:', error);
      throw error;
    }
  }

  /**
   * Get project statistics
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project statistics
   */
  static async getStatistics(projectId) {
    try {
      // This is a placeholder - implement based on your schema
      // Could include: table count, record count, API call count, etc.
      return {
        projectId,
        tableCount: 0,
        recordCount: 0,
        lastActivity: new Date()
      };
    } catch (error) {
      logger.error('Error getting project statistics:', error);
      throw error;
    }
  }
}

module.exports = ProjectModel;

