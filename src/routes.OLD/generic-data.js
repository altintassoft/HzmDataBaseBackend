const express = require('express');
const { pool } = require('../core/config/database');
const logger = require('../core/logger');
const { authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// GENERIC DATA CRUD - Supports dynamic resources
// ============================================================================

// GET /api/v1/data/:resource
// List resources with filtering, sorting, and pagination
router.get('/:resource', authenticateApiKey, async (req, res) => {
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
});

// POST /api/v1/data/:resource
// Create a new resource
router.post('/:resource', authenticateApiKey, async (req, res) => {
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
});

// GET /api/v1/data/:resource/:id
// Get a single resource by ID
router.get('/:resource/:id', authenticateApiKey, async (req, res) => {
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
});

// PUT /api/v1/data/:resource/:id
// Update a resource (full replacement)
router.put('/:resource/:id', authenticateApiKey, async (req, res) => {
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
});

// PATCH /api/v1/data/:resource/:id
// Partially update a resource
router.patch('/:resource/:id', authenticateApiKey, async (req, res) => {
  try {
    const { resource, id } = req.params;
    const data = req.body;
    const user = req.user;

    // Validate resource name
    if (!/^[a-zA-Z0-9_]+$/.test(resource)) {
      return res.status(400).json({ error: 'Invalid resource name' });
    }

    // Remove protected fields
    delete data.id;
    delete data.tenant_id;
    delete data.created_at;
    delete data.created_by;

    // Add updated_at
    data.updated_at = new Date();

    // Build UPDATE query
    const fields = Object.keys(data);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

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
    logger.error('Generic data patch error:', error);
    res.status(500).json({ error: 'Failed to patch resource' });
  }
});

// DELETE /api/v1/data/:resource/:id
// Soft delete a resource
router.delete('/:resource/:id', authenticateApiKey, async (req, res) => {
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
});

module.exports = router;
