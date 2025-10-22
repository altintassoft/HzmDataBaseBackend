const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateApiKey, requireMasterAdmin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// 🔐 PROTECTED ENDPOINTS (API Key Required)
// ============================================================================

/**
 * GET /api/v1/protected/test
 * Simple test endpoint to verify API Key authentication
 * 
 * Usage:
 *   curl -H "X-API-Key: hzm_xxx" -H "X-API-Password: xxx" \
 *        http://localhost:8080/api/v1/protected/test
 */
router.get('/test', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    message: 'API Key authentication successful!',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      full_name: req.user.full_name,
      authenticated_via: req.user.authenticated_via
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/protected/whoami
 * Returns current authenticated user info
 */
router.get('/whoami', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/protected/admin/test
 * Admin-only test endpoint
 * Requires role='admin' or 'master_admin'
 */
router.get('/admin/test', authenticateApiKey, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Admin authentication successful!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/protected/master-admin/test
 * Master Admin only test endpoint
 * Requires role='master_admin'
 */
router.get('/master-admin/test', authenticateApiKey, requireMasterAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Master Admin authentication successful!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/protected/data
 * Create new generic data (example)
 * Demonstrates how to add data via API Key
 */
router.post('/data', authenticateApiKey, async (req, res) => {
  try {
    const { table_name, data } = req.body;

    if (!table_name || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['table_name', 'data']
      });
    }

    // Insert into app.generic_data
    const result = await pool.query(`
      INSERT INTO app.generic_data (
        tenant_id,
        project_id,
        table_name,
        data,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $5, NOW(), NOW())
      RETURNING id, table_name, data, created_at
    `, [
      req.user.tenant_id,
      null, // project_id (optional)
      table_name,
      JSON.stringify(data),
      req.user.id
    ]);

    logger.info(`Data created via API Key by ${req.user.email}:`, {
      table_name,
      id: result.rows[0].id
    });

    res.json({
      success: true,
      message: 'Data created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Create data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/protected/data
 * Get generic data (filtered by tenant)
 */
router.get('/data', authenticateApiKey, async (req, res) => {
  try {
    const { table_name, limit = 10, offset = 0 } = req.query;

    let query = `
      SELECT 
        id,
        table_name,
        data,
        created_at,
        updated_at
      FROM app.generic_data
      WHERE tenant_id = $1
    `;

    const params = [req.user.tenant_id];

    if (table_name) {
      query += ` AND table_name = $${params.length + 1}`;
      params.push(table_name);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Get data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

