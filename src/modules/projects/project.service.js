const ProjectModel = require('./project.model');
const logger = require('../../utils/logger');

/**
 * Project Service - Business Logic Layer
 * Handles business rules, validation, and orchestration
 */
class ProjectService {
  /**
   * Get all projects for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {string} role - User role
   * @returns {Promise<Array>} List of projects
   */
  static async getProjects(userId, tenantId, role) {
    try {
      let projects;

      // Admin/Master Admin can see all tenant projects
      if (role === 'admin' || role === 'master_admin') {
        projects = await ProjectModel.findByTenantId(tenantId);
      } else {
        // Regular users see only their own projects
        projects = await ProjectModel.findByUserId(userId, tenantId);
      }

      // Transform projects (add computed fields, format dates, etc.)
      return projects.map(project => this.transformProject(project));
    } catch (error) {
      logger.error('Service error getting projects:', error);
      throw new Error('Failed to retrieve projects');
    }
  }

  /**
   * Get single project by ID
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID (for authorization)
   * @param {string} tenantId - Tenant ID
   * @param {string} role - User role
   * @returns {Promise<Object>} Project details
   */
  static async getProjectById(projectId, userId, tenantId, role) {
    try {
      const project = await ProjectModel.findById(projectId, tenantId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Authorization: Users can only see their own projects (unless admin)
      if (role !== 'admin' && role !== 'master_admin' && project.owner_id !== userId) {
        throw new Error('Access denied');
      }

      return this.transformProject(project);
    } catch (error) {
      logger.error('Service error getting project:', error);
      throw error;
    }
  }

  /**
   * Create new project
   * @param {Object} projectData - Project data
   * @param {Object} user - User object (id, tenantId, email)
   * @returns {Promise<Object>} Created project
   */
  static async createProject(projectData, user) {
    try {
      const { name, description, status, settings } = projectData;

      // Business rule: Check if name already exists for this user
      const nameExists = await ProjectModel.nameExists(name, user.id, user.tenantId);
      if (nameExists) {
        throw new Error('A project with this name already exists');
      }

      // Business rule: Validate project name
      if (!this.isValidProjectName(name)) {
        throw new Error('Invalid project name. Only alphanumeric characters, spaces, and dashes allowed');
      }

      // Create project
      const project = await ProjectModel.create({
        tenantId: user.tenantId,
        ownerId: user.id,
        name: name.trim(),
        description: description?.trim(),
        status: status || 'active',
        settings: settings || {},
        createdBy: user.id
      });

      logger.info(`Project created: ${project.id} by user ${user.id}`);

      return this.transformProject(project);
    } catch (error) {
      logger.error('Service error creating project:', error);
      throw error;
    }
  }

  /**
   * Update project
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User object
   * @returns {Promise<Object>} Updated project
   */
  static async updateProject(projectId, updateData, user) {
    try {
      // Check if project exists and user has access
      const existingProject = await this.getProjectById(projectId, user.id, user.tenantId, user.role);

      // Authorization: Only owner or admin can update
      if (user.role !== 'admin' && user.role !== 'master_admin' && existingProject.owner_id !== user.id) {
        throw new Error('Access denied');
      }

      // If name is being changed, check for duplicates
      if (updateData.name && updateData.name !== existingProject.name) {
        const nameExists = await ProjectModel.nameExists(
          updateData.name,
          user.id,
          user.tenantId,
          projectId
        );
        if (nameExists) {
          throw new Error('A project with this name already exists');
        }

        // Validate new name
        if (!this.isValidProjectName(updateData.name)) {
          throw new Error('Invalid project name');
        }
      }

      // Update project
      const updatedProject = await ProjectModel.update(projectId, {
        ...updateData,
        updatedBy: user.id
      });

      logger.info(`Project updated: ${projectId} by user ${user.id}`);

      return this.transformProject(updatedProject);
    } catch (error) {
      logger.error('Service error updating project:', error);
      throw error;
    }
  }

  /**
   * Delete project
   * @param {string} projectId - Project ID
   * @param {Object} user - User object
   * @returns {Promise<Object>} Delete confirmation
   */
  static async deleteProject(projectId, user) {
    try {
      // Check if project exists and user has access
      const existingProject = await this.getProjectById(projectId, user.id, user.tenantId, user.role);

      // Authorization: Only owner or admin can delete
      if (user.role !== 'admin' && user.role !== 'master_admin' && existingProject.owner_id !== user.id) {
        throw new Error('Access denied');
      }

      // Soft delete
      const deleted = await ProjectModel.delete(projectId, user.id);

      if (!deleted) {
        throw new Error('Failed to delete project');
      }

      logger.info(`Project deleted: ${projectId} by user ${user.id}`);

      return {
        success: true,
        message: 'Project deleted successfully',
        projectId
      };
    } catch (error) {
      logger.error('Service error deleting project:', error);
      throw error;
    }
  }

  /**
   * Get project statistics
   * @param {string} projectId - Project ID
   * @param {Object} user - User object
   * @returns {Promise<Object>} Project statistics
   */
  static async getProjectStatistics(projectId, user) {
    try {
      // Check access
      await this.getProjectById(projectId, user.id, user.tenantId, user.role);

      // Get statistics
      const stats = await ProjectModel.getStatistics(projectId);

      return stats;
    } catch (error) {
      logger.error('Service error getting project statistics:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Transform project object (add computed fields, format dates)
   * @private
   */
  static transformProject(project) {
    return {
      ...project,
      // Add computed fields
      isActive: project.status === 'active',
      // Format dates
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      // Remove internal fields
      created_at: undefined,
      updated_at: undefined
    };
  }

  /**
   * Validate project name
   * @private
   */
  static isValidProjectName(name) {
    // Only alphanumeric, spaces, dashes, underscores
    // Length: 3-50 characters
    const regex = /^[a-zA-Z0-9\s\-_]{3,50}$/;
    return regex.test(name);
  }
}

module.exports = ProjectService;

