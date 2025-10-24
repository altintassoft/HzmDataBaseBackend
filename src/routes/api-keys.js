const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================================================
// 🔑 API KEY MANAGEMENT
// ============================================================================

// Generate a secure random API key
const generateApiKey = () => {
  // Format: hzm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (52 chars total)
  const randomBytes = crypto.randomBytes(24).toString('hex'); // 24 bytes = 48 hex chars
  return `hzm_${randomBytes}`; // hzm_ (4) + 48 = 52 chars (fits in VARCHAR(64))
};

// Generate a secure random API password
const generateApiPassword = () => {
  // 24 character random password with mixed case, numbers, and symbols
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
};

// ============================================================================
// GET /api/v1/api-keys/me
// Get current user's API key info (WITH password - plain text for now)
// ============================================================================
router.get('/me', async (req, res) => {
  try {
    // TODO: Get user_id from JWT token (req.user.id)
    // For now, using email from query or default test user
    const userEmail = req.query.email || 'ozgurhzm@gmail.com';

    const result = await pool.query(`
      SELECT 
        id,
        email,
        api_key,
        api_password,
        api_key_created_at,
        api_key_last_used_at
      FROM core.users
      WHERE email = $1;
    `, [userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        email: user.email,
        apiKey: user.api_key || null,
        apiPassword: user.api_password || null,
        hasApiKey: !!user.api_key,
        createdAt: user.api_key_created_at,
        lastUsedAt: user.api_key_last_used_at
      }
    });

  } catch (error) {
    logger.error('Get API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/generate
// Generate new API key and password for current user
// ============================================================================
router.post('/generate', async (req, res) => {
  try {
    // TODO: Get user_id from JWT token (req.user.id)
    const userEmail = req.query.email || 'ozgurhzm@gmail.com';

    // Generate new API key and password
    const apiKey = generateApiKey();
    const apiPassword = generateApiPassword();
    const apiKeyHash = await bcrypt.hash(apiPassword, 10);

    // Update user with new API credentials (storing password as plain text for now)
    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = $1,
        api_password = $2,
        api_key_hash = $3,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $4
      RETURNING id, email, api_key, api_password, api_key_created_at;
    `, [apiKey, apiPassword, apiKeyHash, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info(`API key generated for user: ${userEmail}`);

    res.json({
      success: true,
      message: 'API credentials generated successfully',
      data: {
        apiKey,
        apiPassword, // ⚠️ Only shown once! User must save it
        createdAt: result.rows[0].api_key_created_at
      },
      warning: '⚠️ API Password will only be shown once! Please save it securely.'
    });

  } catch (error) {
    logger.error('Generate API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/regenerate
// Regenerate API key (keeps same password, changes key)
// ============================================================================
router.post('/regenerate', async (req, res) => {
  try {
    const userEmail = req.query.email || 'ozgurhzm@gmail.com';

    // Generate new API key (password stays the same)
    const apiKey = generateApiKey();

    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = $1,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $2 AND api_key_hash IS NOT NULL
      RETURNING id, email, api_key, api_key_created_at;
    `, [apiKey, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found or no API credentials exist'
      });
    }

    logger.info(`API key regenerated for user: ${userEmail}`);

    res.json({
      success: true,
      message: 'API key regenerated successfully',
      data: {
        apiKey,
        createdAt: result.rows[0].api_key_created_at
      }
    });

  } catch (error) {
    logger.error('Regenerate API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/regenerate-password
// Regenerate API password (keeps same key, changes password)
// ============================================================================
router.post('/regenerate-password', async (req, res) => {
  try {
    const userEmail = req.query.email || 'ozgurhzm@gmail.com';

    // Generate new API password
    const apiPassword = generateApiPassword();
    const apiKeyHash = await bcrypt.hash(apiPassword, 10);

    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_password = $1,
        api_key_hash = $2,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $3 AND api_key IS NOT NULL
      RETURNING id, email, api_key, api_password, api_key_created_at;
    `, [apiPassword, apiKeyHash, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found or no API key exists'
      });
    }

    logger.info(`API password regenerated for user: ${userEmail}`);

    res.json({
      success: true,
      message: 'API password regenerated successfully',
      data: {
        apiPassword, // ⚠️ Only shown once!
        createdAt: result.rows[0].api_key_created_at
      },
      warning: '⚠️ New API Password will only be shown once! Please save it securely.'
    });

  } catch (error) {
    logger.error('Regenerate API password error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// DELETE /api/v1/api-keys/revoke
// Revoke (delete) API credentials
// ============================================================================
router.delete('/revoke', async (req, res) => {
  try {
    const userEmail = req.query.email || 'ozgurhzm@gmail.com';

    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = NULL,
        api_password = NULL,
        api_key_hash = NULL,
        api_key_created_at = NULL,
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $1
      RETURNING id, email;
    `, [userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info(`API credentials revoked for user: ${userEmail}`);

    res.json({
      success: true,
      message: 'API credentials revoked successfully'
    });

  } catch (error) {
    logger.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/v1/api-keys/master-admin
// Get Master Admin API credentials (only for admin users)
// ============================================================================
router.get('/master-admin', async (req, res) => {
  try {
    // TODO: Check if current user is admin (req.user.role === 'admin')
    // For now, allow access for testing
    
    const result = await pool.query(`
      SELECT 
        id,
        email,
        role,
        api_key,
        api_password,
        api_key_created_at,
        api_key_last_used_at
      FROM core.users
      WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin';
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Master Admin user not found'
      });
    }

    const masterAdmin = result.rows[0];

    res.json({
      success: true,
      data: {
        email: masterAdmin.email,
        role: masterAdmin.role,
        apiKey: masterAdmin.api_key || null,
        apiPassword: masterAdmin.api_password || null,
        hasApiKey: !!masterAdmin.api_key,
        createdAt: masterAdmin.api_key_created_at,
        lastUsedAt: masterAdmin.api_key_last_used_at
      }
    });

  } catch (error) {
    logger.error('Get Master Admin API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/master-admin/generate
// Generate API credentials for Master Admin
// ============================================================================
router.post('/master-admin/generate', async (req, res) => {
  try {
    // TODO: Check if current user is admin
    
    // Generate new API key and password
    const apiKey = generateApiKey();
    const apiPassword = generateApiPassword();
    const apiKeyHash = await bcrypt.hash(apiPassword, 10);

    // Update Master Admin with new API credentials
    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = $1,
        api_password = $2,
        api_key_hash = $3,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin'
      RETURNING id, email, role, api_key, api_password, api_key_created_at;
    `, [apiKey, apiPassword, apiKeyHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Master Admin user not found'
      });
    }

    logger.info('Master Admin API key generated');

    res.json({
      success: true,
      message: 'Master Admin API credentials generated successfully',
      data: {
        apiKey,
        apiPassword,
        createdAt: result.rows[0].api_key_created_at
      }
    });

  } catch (error) {
    logger.error('Generate Master Admin API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/master-admin/regenerate
// Regenerate Master Admin API key (keeps password)
// ============================================================================
router.post('/master-admin/regenerate', async (req, res) => {
  try {
    // TODO: Check if current user is admin
    
    const apiKey = generateApiKey();

    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = $1,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin' AND api_password IS NOT NULL
      RETURNING id, email, role, api_key, api_key_created_at;
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Master Admin user not found or no API credentials exist'
      });
    }

    logger.info('Master Admin API key regenerated');

    res.json({
      success: true,
      message: 'Master Admin API key regenerated successfully',
      data: {
        apiKey,
        createdAt: result.rows[0].api_key_created_at
      }
    });

  } catch (error) {
    logger.error('Regenerate Master Admin API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/v1/api-keys/master-admin/regenerate-password
// Regenerate Master Admin API password (keeps key)
// ============================================================================
router.post('/master-admin/regenerate-password', async (req, res) => {
  try {
    // TODO: Check if current user is admin
    
    const apiPassword = generateApiPassword();
    const apiKeyHash = await bcrypt.hash(apiPassword, 10);

    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_password = $1,
        api_key_hash = $2,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = 'ozgurhzm@hzmsoft.com' AND role = 'master_admin' AND api_key IS NOT NULL
      RETURNING id, email, role, api_key, api_password, api_key_created_at;
    `, [apiPassword, apiKeyHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Master Admin user not found or no API key exists'
      });
    }

    logger.info('Master Admin API password regenerated');

    res.json({
      success: true,
      message: 'Master Admin API password regenerated successfully',
      data: {
        apiPassword,
        createdAt: result.rows[0].api_key_created_at
      }
    });

  } catch (error) {
    logger.error('Regenerate Master Admin API password error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

