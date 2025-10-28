const { pool } = require('../../core/config/database');
const logger = require('../../core/logger');

/**
 * Data Controller
 * Handles generic data operations for any resource
 * Migrated from routes.OLD/generic-data.js
 */
class DataController {
  /**
   * GET /api/v1/data/:resource
   * List resources with filtering, sorting, and pagination
   */
  static async list(req, res) {
    try {
      const { resource } = req.params;
      const { limit = 50, offset = 0, sort = '-created_at' } = req.query;
      const user = req.user;

      // Validate resource name (alphanumeric + underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
        return res.status(400).json({ error: 'Invalid resource name' });
      }

      // Check if table exists in app schema
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'app' AND table_name = $1
        )
      `, [resource]);

      if (!tableCheck.rows[0].exists) {
        return res.status(404).json({ 
          error: 'Resource not found',
          resource,
          suggestion: 'Create this resource first via admin panel'
        });
      }

      // Build query with RLS context
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.user_id]);

        // Count total
        const countResult = await client.query(`SELECT COUNT(*) FROM app.${resource}`);
        const total = parseInt(countResult.rows[0].count);

        // Get data with sorting
        const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
        const sortDir = sort.startsWith('-') ? 'DESC' : 'ASC';
        
        const dataResult = await client.query(`
          SELECT * FROM app.${resource}
          ORDER BY ${sortField} ${sortDir}
          LIMIT $1 OFFSET $2
        `, [limit, offset]);

        await client.query('COMMIT');

        res.json({
          success: true,
          resource,
          data: dataResult.rows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + dataResult.rows.length < total
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Generic data list error:', error);
      res.status(500).json({ error: 'Failed to list resources' });
    }
  }

  /**
   * POST /api/v1/data/:resource
   * Create a new resource
   */
  static async create(req, res) {
    try {
      const { resource } = req.params;
      const data = req.body;
      const user = req.user;

      // Validate resource name
      if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
        return res.status(400).json({ error: 'Invalid resource name' });
      }

      // Auto-inject tenant_id and created_by
      data.tenant_id = user.tenant_id;
      data.created_by = user.user_id;

      // Build INSERT query
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.user_id]);

        const result = await client.query(`
          INSERT INTO app.${resource} (${fields.join(', ')})
          VALUES (${placeholders})
          RETURNING *
        `, values);

        await client.query('COMMIT');

        res.status(201).json({
          success: true,
          resource,
          data: result.rows[0]
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Generic data create error:', error);
      res.status(500).json({ error: 'Failed to create resource' });
    }
  }

  /**
   * GET /api/v1/data/:resource/:id
   * Get a single resource by ID
   */
  static async getById(req, res) {
    try {
      const { resource, id } = req.params;
      const user = req.user;

      // Validate resource name
      if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
        return res.status(400).json({ error: 'Invalid resource name' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.user_id]);

        const result = await client.query(`
          SELECT * FROM app.${resource}
          WHERE id = $1
        `, [id]);

        await client.query('COMMIT');

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        res.json({
          success: true,
          resource,
          data: result.rows[0]
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Generic data get error:', error);
      res.status(500).json({ error: 'Failed to get resource' });
    }
  }

  /**
   * PUT /api/v1/data/:resource/:id
   * Update a resource (full replacement)
   */
  static async update(req, res) {
    try {
      const { resource, id } = req.params;
      const data = req.body;
      const user = req.user;

      // Validate resource name
      if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
        return res.status(400).json({ error: 'Invalid resource name' });
      }

      // Remove id, tenant_id, created_at, created_by from update data
      delete data.id;
      delete data.tenant_id;
      delete data.created_at;
      delete data.created_by;

      // Add updated_at
      data.updated_at = new Date();

      // Build UPDATE query
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.user_id]);

        const result = await client.query(`
          UPDATE app.${resource}
          SET ${setClause}
          WHERE id = $1
          RETURNING *
        `, [id, ...values]);

        await client.query('COMMIT');

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        res.json({
          success: true,
          resource,
          data: result.rows[0]
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Generic data update error:', error);
      res.status(500).json({ error: 'Failed to update resource' });
    }
  }

  /**
   * DELETE /api/v1/data/:resource/:id
   * Soft delete a resource
   */
  static async delete(req, res) {
    try {
      const { resource, id } = req.params;
      const user = req.user;

      // Validate resource name
      if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
        return res.status(400).json({ error: 'Invalid resource name' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_context($1, $2)', [user.tenant_id, user.user_id]);

        // Soft delete (set is_deleted = true if column exists)
        const result = await client.query(`
          UPDATE app.${resource}
          SET is_deleted = true, deleted_at = NOW(), deleted_by = $2
          WHERE id = $1
          RETURNING id
        `, [id, user.user_id]);

        await client.query('COMMIT');

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        res.json({
          success: true,
          message: 'Resource deleted successfully',
          resource,
          id
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Generic data delete error:', error);
      res.status(500).json({ error: 'Failed to delete resource' });
    }
  }

  /**
   * Batch operations - Not implemented yet
   * These are placeholders for future expansion
   */
  static async batchCreate(req, res) {
    try {
      const { resource } = req.params;
      res.status(501).json({ success: false, message: 'Not implemented yet', resource });
    } catch (error) {
      logger.error('Batch create error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async batchUpdate(req, res) {
    try {
      const { resource } = req.params;
      res.status(501).json({ success: false, message: 'Not implemented yet', resource });
    } catch (error) {
      logger.error('Batch update error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async batchDelete(req, res) {
    try {
      const { resource } = req.params;
      res.status(501).json({ success: false, message: 'Not implemented yet', resource });
    } catch (error) {
      logger.error('Batch delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async search(req, res) {
    try {
      const { resource } = req.params;
      res.status(501).json({ success: false, message: 'Not implemented yet', resource });
    } catch (error) {
      logger.error('Search error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async count(req, res) {
    try {
      const { resource } = req.params;
      res.status(501).json({ success: false, message: 'Not implemented yet', resource });
    } catch (error) {
      logger.error('Count error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = DataController;


