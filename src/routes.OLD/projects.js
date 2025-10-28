const express = require('express');
const { pool } = require('../core/config/database');
const logger = require('../core/logger');
const { authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// PROJECTS CRUD - Core Entity Management
// ============================================================================

// GET /api/v1/projects
// List all projects for current tenant
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const user = req.user;

    // Build query with optional status filter
    let query = `
      SELECT 
        id, tenant_id, name, description, status, 
        created_at, updated_at, created_by
      FROM core.projects
      WHERE tenant_id = $1 AND is_deleted = false
    `;
    const params = [user.tenant_id];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Count total
    let countQuery = 'SELECT COUNT(*) FROM core.projects WHERE tenant_id = $1 AND is_deleted = false';
    const countParams = [user.tenant_id];
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const [projectsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      success: true,
      data: projectsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + projectsResult.rows.length < parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    logger.error('Projects list error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /api/v1/projects
// Create a new project
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { name, description, status = 'active' } = req.body;
    const user = req.user;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check if project with same name exists for this tenant
    const existingProject = await pool.query(
      'SELECT id FROM core.projects WHERE tenant_id = $1 AND name = $2 AND is_deleted = false',
      [user.tenant_id, name]
    );

    if (existingProject.rows.length > 0) {
      return res.status(400).json({ error: 'Project with this name already exists' });
    }

    // Create project
    const result = await pool.query(`
      INSERT INTO core.projects (tenant_id, name, description, status, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, name, description, status, created_at, created_by
    `, [user.tenant_id, name, description, status, user.user_id]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Project create error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/v1/projects/:id
// Get a single project by ID
router.get('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const result = await pool.query(`
      SELECT 
        id, tenant_id, name, description, status,
        created_at, updated_at, created_by
      FROM core.projects
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    `, [id, user.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Project get error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// PUT /api/v1/projects/:id
// Update a project (full replacement)
router.put('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const user = req.user;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check if project exists and belongs to tenant
    const existingProject = await pool.query(
      'SELECT id FROM core.projects WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
      [id, user.tenant_id]
    );

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update project
    const result = await pool.query(`
      UPDATE core.projects
      SET name = $1, description = $2, status = $3, updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5
      RETURNING id, tenant_id, name, description, status, created_at, updated_at, created_by
    `, [name, description, status, id, user.tenant_id]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Project update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// PATCH /api/v1/projects/:id
// Partially update a project
router.patch('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    // Check if project exists and belongs to tenant
    const existingProject = await pool.query(
      'SELECT id FROM core.projects WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
      [id, user.tenant_id]
    );

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build dynamic UPDATE query
    const allowedFields = ['name', 'description', 'status'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map((field, i) => `${field} = $${i + 3}`).join(', ');
    const values = fields.map(field => updates[field]);

    const result = await pool.query(`
      UPDATE core.projects
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, name, description, status, created_at, updated_at, created_by
    `, [id, user.tenant_id, ...values]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Project patch error:', error);
    res.status(500).json({ error: 'Failed to patch project' });
  }
});

// DELETE /api/v1/projects/:id
// Soft delete a project
router.delete('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if project exists and belongs to tenant
    const existingProject = await pool.query(
      'SELECT id FROM core.projects WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
      [id, user.tenant_id]
    );

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Soft delete
    await pool.query(`
      UPDATE core.projects
      SET is_deleted = true, deleted_at = NOW(), deleted_by = $3
      WHERE id = $1 AND tenant_id = $2
    `, [id, user.tenant_id, user.user_id]);

    res.json({
      success: true,
      message: 'Project deleted successfully',
      id
    });
  } catch (error) {
    logger.error('Project delete error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
