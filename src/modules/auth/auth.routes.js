const express = require('express');
const AuthController = require('./auth.controller');
const { authenticateJWT } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * Authentication Routes
 * Base: /api/v1/auth
 */

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Protected routes
router.get('/me', authenticateJWT, AuthController.getCurrentUser);
router.post('/logout', authenticateJWT, AuthController.logout);
router.post('/change-password', authenticateJWT, AuthController.changePassword);

module.exports = router;


