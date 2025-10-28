const express = require('express');
const UserController = require('./user.controller');
const { authenticateJWT, requireAdmin } = require('../../shared/middleware/auth');

const router = express.Router();

/**
 * User Management Routes
 * Base: /api/v1/users
 */

// All routes require authentication
router.use(authenticateJWT);

// User routes
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.post('/profile/avatar', UserController.uploadAvatar);

// Admin routes
router.get('/', requireAdmin, UserController.listUsers);
router.get('/:id', requireAdmin, UserController.getUserById);
router.put('/:id', requireAdmin, UserController.updateUser);
router.delete('/:id', requireAdmin, UserController.deleteUser);
router.post('/:id/activate', requireAdmin, UserController.activateUser);
router.post('/:id/deactivate', requireAdmin, UserController.deactivateUser);

module.exports = router;


