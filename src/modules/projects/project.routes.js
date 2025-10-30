const express = require('express');
const ProjectController = require('./project.controller');
const { authenticateApiKey } = require('../../middleware/auth');

const router = express.Router();

/**
 * Projects API Routes
 * Base path: /api/v1/projects
 * 
 * All routes require API Key authentication (3-layer: Email + API Key + API Password)
 */

// ============================================================================
// PUBLIC ROUTES (Authenticated users)
// ============================================================================

/**
 * @route   GET /api/v1/projects
 * @desc    List all projects for authenticated user
 * @access  Private (API Key)
 * @returns {Array} List of projects
 */
router.get('/', authenticateApiKey, ProjectController.list);

/**
 * @route   POST /api/v1/projects
 * @desc    Create new project
 * @access  Private (API Key)
 * @body    {name, description, status, settings}
 * @returns {Object} Created project
 */
router.post('/', authenticateApiKey, ProjectController.create);

/**
 * @route   GET /api/v1/projects/:id
 * @desc    Get single project by ID
 * @access  Private (API Key + Owner or Admin)
 * @returns {Object} Project details
 */
router.get('/:id', authenticateApiKey, ProjectController.getById);

/**
 * @route   PUT /api/v1/projects/:id
 * @desc    Update project
 * @access  Private (API Key + Owner or Admin)
 * @body    {name, description, status, settings}
 * @returns {Object} Updated project
 */
router.put('/:id', authenticateApiKey, ProjectController.update);

/**
 * @route   DELETE /api/v1/projects/:id
 * @desc    Delete project (soft delete)
 * @access  Private (API Key + Owner or Admin)
 * @returns {Object} Success confirmation
 */
router.delete('/:id', authenticateApiKey, ProjectController.delete);

/**
 * @route   GET /api/v1/projects/:id/statistics
 * @desc    Get project statistics
 * @access  Private (API Key + Owner or Admin)
 * @returns {Object} Project statistics
 */
router.get('/:id/statistics', authenticateApiKey, ProjectController.getStatistics);

module.exports = router;


