const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
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
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
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
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Extract token from header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user
    const result = await pool.query(
      `SELECT id, tenant_id, email, role, created_at
       FROM core.users
       WHERE id = $1 AND is_deleted = false`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

