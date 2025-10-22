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
// Get current user's API key info (without password)
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

    // Update user with new API credentials
    const result = await pool.query(`
      UPDATE core.users
      SET 
        api_key = $1,
        api_key_hash = $2,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $3
      RETURNING id, email, api_key, api_key_created_at;
    `, [apiKey, apiKeyHash, userEmail]);

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
        api_key_hash = $1,
        api_key_created_at = NOW(),
        api_key_last_used_at = NULL,
        updated_at = NOW()
      WHERE email = $2 AND api_key IS NOT NULL
      RETURNING id, email, api_key, api_key_created_at;
    `, [apiKeyHash, userEmail]);

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
// POST /api/v1/api-keys/test
// Test API key authentication
// ============================================================================
router.post('/test', async (req, res) => {
  try {
    const { apiKey, apiPassword } = req.body;

    if (!apiKey || !apiPassword) {
      return res.status(400).json({
        success: false,
        error: 'API Key and API Password are required'
      });
    }

    // Find user by API key
    const result = await pool.query(`
      SELECT 
        id,
        email,
        api_key,
        api_key_hash,
        role,
        is_active
      FROM core.users
      WHERE api_key = $1;
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Key'
      });
    }

    const user = result.rows[0];

    // Verify API password
    const passwordMatch = await bcrypt.compare(apiPassword, user.api_key_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Password'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'User account is disabled'
      });
    }

    // Update last used timestamp
    await pool.query(`
      UPDATE core.users
      SET api_key_last_used_at = NOW()
      WHERE id = $1;
    `, [user.id]);

    logger.info(`API key authentication successful for user: ${user.email}`);

    res.json({
      success: true,
      message: 'API authentication successful',
      data: {
        userId: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Test API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

