const ProjectService = require('./project.service');
const logger = require('../../core/logger');

/**
 * Project Controller - HTTP Request/Response Layer
 * Handles incoming requests and formats responses
 */
class ProjectController {
  /**
   * GET /api/v1/projects
   * List all projects for authenticated user
   */
  static async list(req, res) {
    try {
      const { id: userId, tenant_id: tenantId, role } = req.user;

      const projects = await ProjectService.getProjects(userId, tenantId, role);

      res.json({
        success: true,
        count: projects.length,
        data: projects
      });
    } catch (error) {
      logger.error('Controller error listing projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve projects',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v1/projects/:id
   * Get single project by ID
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { id: userId, tenant_id: tenantId, role } = req.user;

      const project = await ProjectService.getProjectById(id, userId, tenantId, role);

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      logger.error('Controller error getting project:', error);
      
      const statusCode = error.message === 'Project not found' ? 404 
        : error.message === 'Access denied' ? 403 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/projects
   * Create new project
   */
  static async create(req, res) {
    try {
      const { name, description, status, settings } = req.body;
      const user = req.user;

      // Basic validation
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Project name is required'
        });
      }

      const project = await ProjectService.createProject(
        { name, description, status, settings },
        user
      );

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      logger.error('Controller error creating project:', error);
      
      const statusCode = error.message.includes('already exists') ? 409 
        : error.message.includes('Invalid') ? 400 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PUT /api/v1/projects/:id
   * Update project
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, status, settings } = req.body;
      const user = req.user;

      // Build update data (only include provided fields)
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (settings !== undefined) updateData.settings = settings;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      const project = await ProjectService.updateProject(id, updateData, user);

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });
    } catch (error) {
      logger.error('Controller error updating project:', error);
      
      const statusCode = error.message === 'Project not found' ? 404 
        : error.message === 'Access denied' ? 403 
        : error.message.includes('already exists') ? 409 
        : error.message.includes('Invalid') ? 400 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/v1/projects/:id
   * Delete project (soft delete)
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await ProjectService.deleteProject(id, user);

      res.json(result);
    } catch (error) {
      logger.error('Controller error deleting project:', error);
      
      const statusCode = error.message === 'Project not found' ? 404 
        : error.message === 'Access denied' ? 403 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/projects/:id/statistics
   * Get project statistics
   */
  static async getStatistics(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const stats = await ProjectService.getProjectStatistics(id, user);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Controller error getting project statistics:', error);
      
      const statusCode = error.message === 'Project not found' ? 404 
        : error.message === 'Access denied' ? 403 
        : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ProjectController;

