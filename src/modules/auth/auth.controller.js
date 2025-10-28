const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../core/config/database');
const config = require('../../core/config');
const logger = require('../../core/logger');

/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */
class AuthController {
  /**
   * POST /api/v1/auth/register
   * User registration
   */
  static async register(req, res) {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id FROM core.users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create tenant first
      const tenant = await pool.query(
        `INSERT INTO core.tenants (name, slug, default_currency)
         VALUES ($1, $2, 'USD')
         RETURNING id`,
        [name || 'My Organization', email.split('@')[0]]
      );

      const tenantId = tenant.rows[0].id;

      // Create user
      const user = await pool.query(
        `INSERT INTO core.users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id, tenant_id, email, role, created_at`,
        [tenantId, email, passwordHash]
      );

      // Generate JWT
      const token = jwt.sign(
        {
          userId: user.rows[0].id,
          tenantId: user.rows[0].tenant_id,
          email: user.rows[0].email,
          role: user.rows[0].role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.status(201).json({
        message: 'User registered successfully',
        user: user.rows[0],
        token
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  /**
   * POST /api/v1/auth/login
   * User login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Get user
      const result = await pool.query(
        `SELECT id, tenant_id, email, password_hash, role, is_active
         FROM core.users
         WHERE email = $1 AND is_deleted = false`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({ error: 'User account is disabled' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          userId: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          role: user.role
        },
        token
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh JWT token
   */
  static async refresh(req, res) {
    try {
      const { token: oldToken } = req.body;

      if (!oldToken) {
        return res.status(400).json({ error: 'Token required' });
      }

      // Verify old token (allow expired tokens for refresh)
      let decoded;
      try {
        decoded = jwt.verify(oldToken, config.jwt.secret);
      } catch (error) {
        // If token is expired, try to decode without verification to get payload
        if (error.name === 'TokenExpiredError') {
          decoded = jwt.decode(oldToken);
        } else {
          return res.status(401).json({ error: 'Invalid token' });
        }
      }

      // Get user to ensure they still exist and are active
      const result = await pool.query(
        `SELECT id, tenant_id, email, role, is_active
         FROM core.users
         WHERE id = $1 AND is_deleted = false`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({ error: 'User account is disabled' });
      }

      // Generate new JWT
      const newToken = jwt.sign(
        {
          userId: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        message: 'Token refreshed successfully',
        token: newToken
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current user (from JWT middleware)
   */
  static async getCurrentUser(req, res) {
    try {
      // User ID is set by authenticateJWT middleware
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user
      const result = await pool.query(
        `SELECT id, tenant_id, email, role, created_at
         FROM core.users
         WHERE id = $1 AND is_deleted = false`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user information' });
    }
  }

  /**
   * POST /api/v1/auth/logout
   * User logout (client-side only, JWT is stateless)
   */
  static async logout(req, res) {
    try {
      // JWT is stateless, so logout is handled client-side by removing token
      // In future, we could add token blacklisting with Redis
      res.json({
        message: 'Logout successful',
        note: 'Please remove the token from client storage'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * POST /api/v1/auth/change-password
   * Change user password
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          error: 'Current password and new password required' 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          error: 'New password must be at least 6 characters' 
        });
      }

      // Get current user password
      const result = await pool.query(
        'SELECT password_hash FROM core.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(
        currentPassword, 
        result.rows[0].password_hash
      );

      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await pool.query(
        'UPDATE core.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Password change failed' });
    }
  }
}

module.exports = AuthController;
