const { pool } = require('../../../core/config/database');
const logger = require('../../../core/logger');
const fs = require('fs');
const path = require('path');

class AIKnowledgeBaseService {
  /**
   * Set RLS context for current request
   */
  static async setRLSContext(client, user) {
    await client.query(`SET LOCAL app.current_user_id = '${user.id}'`);
    await client.query(`SET LOCAL app.current_user_role = '${user.role}'`);
    await client.query(`SET LOCAL app.current_tenant_id = '${user.tenant_id || 1}'`);
  }

  /**
   * Get all reports (with filters)
   */
  static async getAllReports(filters = {}, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const { report_type, category, tags, status, search, limit = 50, offset = 0 } = filters;
      
      const whereParts = ['is_active = TRUE', 'is_deleted = FALSE'];
      const params = [];
      let paramCount = 1;
      
      if (report_type) {
        whereParts.push(`report_type = $${paramCount++}`);
        params.push(report_type);
      }
      
      if (category) {
        whereParts.push(`report_category = $${paramCount++}`);
        params.push(category);
      }
      
      if (status) {
        whereParts.push(`status = $${paramCount++}`);
        params.push(status);
      }
      
      if (tags && tags.length > 0) {
        whereParts.push(`tags && $${paramCount++}::text[]`);
        params.push(tags);
      }
      
      if (search) {
        whereParts.push(`(
          search_vector @@ to_tsquery('turkish', unaccent($${paramCount}))
          OR search_vector @@ plainto_tsquery('turkish', unaccent($${paramCount}))
          OR search_vector @@ plainto_tsquery('english', unaccent($${paramCount}))
        )`);
        params.push(search);
        paramCount++;
      }
      
      const whereClause = whereParts.join(' AND ');
      
      // Main query
      const query = `
        SELECT 
          id, report_type, report_category, title, slug, description, summary,
          version, version_label, is_latest_version, tags, keywords, topics,
          priority, status, word_count, estimated_read_time, view_count,
          created_at, updated_at, published_at, is_featured, is_pinned
        FROM ops.ai_knowledge_base
        WHERE ${whereClause}
        ORDER BY is_pinned DESC, is_featured DESC, updated_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;
      
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      
      // Count query (with same filters)
      const countQuery = `SELECT COUNT(*) FROM ops.ai_knowledge_base WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params.slice(0, -2)); // Remove limit/offset
      
      return {
        success: true,
        reports: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to get reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get single report by ID or slug
   */
  static async getReport(identifier, incrementView = false, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      const query = `
        SELECT * FROM ops.ai_knowledge_base
        WHERE ${isUUID ? 'id' : 'slug'} = $1
        AND is_active = TRUE AND is_deleted = FALSE
      `;
      
      const result = await client.query(query, [identifier]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Report not found' };
      }
      
      const report = result.rows[0];
      
      // Increment view count
      if (incrementView) {
        await client.query(
          `UPDATE ops.ai_knowledge_base 
           SET view_count = view_count + 1, last_viewed_at = NOW(), last_viewed_by = $1
           WHERE id = $2`,
          [user.id, report.id]
        );
        report.view_count += 1;
        
        // Audit log
        await this.logAudit(client, report.id, 'VIEW', null, user);
      }
      
      return { success: true, report };
    } catch (error) {
      logger.error('Failed to get report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create new report
   */
  static async createReport(data, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      const {
        report_type, report_category, title, description, summary, content,
        tags = [], keywords = [], topics = [], priority = 'P2', status = 'draft',
        metadata = {}, source_file = null
      } = data;
      
      // Validate tenant_id
      const tenant_id = user.tenant_id || 1;
      
      const query = `
        INSERT INTO ops.ai_knowledge_base (
          report_type, report_category, title, description, summary, content,
          tags, keywords, topics, priority, status, metadata, source_file,
          created_by, updated_by, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $15)
        RETURNING *
      `;
      
      const result = await client.query(query, [
        report_type, report_category, title, description, summary, content,
        tags, keywords, topics, priority, status, JSON.stringify(metadata),
        source_file, user.id, tenant_id
      ]);
      
      // Audit log
      await this.logAudit(client, result.rows[0].id, 'INSERT', { data }, user);
      
      await client.query('COMMIT');
      logger.info(`Report created: ${result.rows[0].id} by user ${user.id}`);
      
      return { success: true, report: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update report
   */
  static async updateReport(id, data, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      // Get old data for audit
      const oldData = await client.query('SELECT * FROM ops.ai_knowledge_base WHERE id = $1', [id]);
      if (oldData.rows.length === 0) {
        return { success: false, error: 'Report not found' };
      }
      
      const updates = [];
      const params = [];
      let paramCount = 1;
      
      const allowedFields = [
        'report_category', 'title', 'description', 'summary', 'content',
        'tags', 'keywords', 'topics', 'priority', 'status', 'metadata',
        'is_featured', 'is_pinned'
      ];
      
      const changedFields = {};
      
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          const value = field === 'metadata' ? JSON.stringify(data[field]) : data[field];
          params.push(value);
          changedFields[field] = { old: oldData.rows[0][field], new: value };
        }
      }
      
      if (updates.length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      
      updates.push(`updated_by = $${paramCount++}`);
      params.push(user.id);
      
      params.push(id);
      
      const query = `
        UPDATE ops.ai_knowledge_base
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND is_active = TRUE
        RETURNING *
      `;
      
      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Report not found or update failed' };
      }
      
      // Audit log
      await this.logAudit(client, id, 'UPDATE', { changed_fields: changedFields }, user);
      
      await client.query('COMMIT');
      logger.info(`Report updated: ${id} by user ${user.id}`);
      
      return { success: true, report: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete report (soft delete)
   */
  static async deleteReport(id, user) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.setRLSContext(client, user);
      
      const query = `
        UPDATE ops.ai_knowledge_base
        SET is_deleted = TRUE, is_active = FALSE, updated_by = $1, archived_at = NOW()
        WHERE id = $2
        RETURNING id, title
      `;
      
      const result = await client.query(query, [user.id, id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Report not found' };
      }
      
      // Audit log
      await this.logAudit(client, id, 'DELETE', null, user);
      
      await client.query('COMMIT');
      logger.info(`Report deleted: ${id} by user ${user.id}`);
      
      return { success: true, message: 'Report deleted successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Import from file (with path security)
   */
  static async importFromFile(filePath, metadata, user) {
    try {
      // Security: Only allow docs/roadmap/ directory
      const allowedPath = path.join(process.cwd(), 'docs', 'roadmap');
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fullPath.startsWith(allowedPath)) {
        return { 
          success: false, 
          error: 'Invalid path. Only files in docs/roadmap/ are allowed.' 
        };
      }
      
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'File not found' };
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);
      
      const data = {
        ...metadata,
        content,
        source_file: filePath,
        metadata: {
          ...metadata.metadata,
          imported_from: filePath,
          file_size: stats.size,
          import_date: new Date().toISOString()
        }
      };
      
      return await this.createReport(data, user);
    } catch (error) {
      logger.error('Failed to import from file:', error);
      throw error;
    }
  }

  /**
   * Search reports (TR + EN hybrid)
   */
  static async searchReports(searchTerm, filters = {}, user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const query = `
        SELECT 
          id, report_type, report_category, title, description, summary,
          tags, keywords, priority, status, word_count, view_count,
          ts_rank(search_vector, to_tsquery('turkish', unaccent($1))) +
          ts_rank(search_vector, plainto_tsquery('turkish', unaccent($1))) +
          ts_rank(search_vector, plainto_tsquery('english', unaccent($1))) AS rank
        FROM ops.ai_knowledge_base
        WHERE (
          search_vector @@ to_tsquery('turkish', unaccent($1))
          OR search_vector @@ plainto_tsquery('turkish', unaccent($1))
          OR search_vector @@ plainto_tsquery('english', unaccent($1))
        )
        AND is_active = TRUE AND is_deleted = FALSE
        ORDER BY rank DESC, view_count DESC
        LIMIT 20
      `;
      
      const result = await client.query(query, [searchTerm]);
      
      return { success: true, results: result.rows };
    } catch (error) {
      logger.error('Failed to search reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Export report
   */
  static async exportReport(id, format = 'md', user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const result = await this.getReport(id, false, user);
      
      if (!result.success) {
        return result;
      }
      
      // Increment export count
      await client.query(
        'UPDATE ops.ai_knowledge_base SET export_count = export_count + 1 WHERE id = $1',
        [id]
      );
      
      // Audit log
      await this.logAudit(client, id, 'EXPORT', { format }, user);
      
      return {
        success: true,
        content: result.report.content,
        filename: `${result.report.slug}.${format}`,
        format
      };
    } catch (error) {
      logger.error('Failed to export report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics
   */
  static async getStatistics(user) {
    const client = await pool.connect();
    try {
      await this.setRLSContext(client, user);
      
      const query = `SELECT * FROM ops.ai_knowledge_base_stats`;
      const result = await client.query(query);
      
      return { success: true, statistics: result.rows };
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Audit log helper
   */
  static async logAudit(client, kb_id, action, changed_fields, user) {
    try {
      const query = `
        INSERT INTO ops.ai_knowledge_base_audit (
          kb_id, action, changed_fields, user_id, user_role, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
        kb_id,
        action,
        changed_fields ? JSON.stringify(changed_fields) : null,
        user.id,
        user.role,
        user.tenant_id || 1
      ]);
    } catch (error) {
      // Non-blocking: log but don't fail the main operation
      logger.warn('Failed to create audit log:', error);
    }
  }
}

module.exports = AIKnowledgeBaseService;

