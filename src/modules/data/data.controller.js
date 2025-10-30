const RegistryService = require('./services/registry.service');
const QueryBuilder = require('./utils/query-builder');
const pool = require('../../core/database/pool');
const logger = require('../../core/logger');

/**
 * Data Controller - Generic CRUD Operations
 * 
 * @description
 * HAFTA 2 - Generic Handler Implementation
 * 
 * Güvenlik:
 * - is_enabled=false kontrolü (RegistryService otomatik throw eder)
 * - Sadece metadata'da tanımlı kolonlar okunabilir/yazılabilir
 * - RLS tenant_id filtresi otomatik uygulanır
 * - SQL injection korumalı (parameterized queries)
 * 
 * Durum:
 * - Migration 011: DEPLOYED (api_resources, api_resource_fields, api_policies)
 * - is_enabled=false: Tüm resources PASIF (hiçbir data dönmez - 403 hatası)
 * - HAFTA 3'te manuel aktifleştirme yapılacak
 */
class DataController {
  /**
   * LIST - GET /data/:resource
   * @example GET /data/projects?eq.status=active&order=created_at.desc&limit=20
   */
  static async list(req, res) {
    try {
      const { resource } = req.params;
      
      // Metadata kontrolü (is_enabled=false ise hata fırlatır)
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({
          success: false,
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource '${resource}' not found in registry`
        });
      }

      // Query builder (Supabase-style filters)
      const queryParts = QueryBuilder.build(req.query, meta);
      
      // RLS: tenant_id filtresi (varsa)
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const rlsParams = [];
      
      if (tenantId) {
        // Check if table has tenant_id column
        const hasTenantId = meta.readableColumns.includes('tenant_id');
        if (hasTenantId) {
          rlsSql = ` AND tenant_id = $${queryParts.where.params.length + 1}`;
          rlsParams.push(tenantId);
        }
      }

      // SQL oluştur
      const sql = `
        SELECT ${queryParts.select}
        FROM ${meta.schema}.${meta.table}
        WHERE 1=1 ${queryParts.where.sql} ${rlsSql}
        ${queryParts.order}
        LIMIT ${queryParts.pagination.limit}
        OFFSET ${queryParts.pagination.offset}
      `;

      const params = [...queryParts.where.params, ...rlsParams];
      const result = await pool.query(sql, params);

      // Count query (pagination için)
      const countSql = `
        SELECT COUNT(*) as count
        FROM ${meta.schema}.${meta.table}
        WHERE 1=1 ${queryParts.where.sql} ${rlsSql}
      `;
      const countResult = await pool.query(countSql, params);
      const totalCount = parseInt(countResult.rows[0].count);

      return res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: queryParts.pagination.page,
          limit: queryParts.pagination.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / queryParts.pagination.limit)
        }
      });

    } catch (error) {
      // is_enabled=false hatası
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({
          success: false,
          code: 'RESOURCE_DISABLED',
          message: error.message
        });
      }
      
      logger.error('List data error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET BY ID - GET /data/:resource/:id
   * @example GET /data/projects/123
   */
  static async getById(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const params = [id];
      
      if (tenantId && meta.readableColumns.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $2`;
        params.push(tenantId);
      }

      const sql = `
        SELECT ${meta.readableSelect}
        FROM ${meta.schema}.${meta.table}
        WHERE id = $1 ${rlsSql}
      `;

      const result = await pool.query(sql, params);

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: `${resource} with id ${id} not found`
        });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({ success: false, code: 'RESOURCE_DISABLED', message: error.message });
      }
      
      logger.error('Get by ID error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * CREATE - POST /data/:resource
   * @example POST /data/projects { "name": "New Project", "status": "active" }
   */
  static async create(req, res) {
    try {
      const { resource } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      // Readonly check
      if (meta.isReadonly) {
        return res.status(403).json({
          success: false,
          code: 'RESOURCE_READONLY',
          message: `Resource '${resource}' is read-only`
        });
      }

      // Sadece writable alanları al
      const writableSet = new Set(meta.writableColumns);
      const data = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (writableSet.has(key)) {
          data[key] = value;
        }
      }

      // tenant_id inject et (varsa)
      if (req.user?.tenant_id && meta.writableColumns.includes('tenant_id')) {
        data.tenant_id = req.user.tenant_id;
      }

      // Boş data kontrolü
      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'EMPTY_DATA',
          message: 'No valid writable fields provided'
        });
      }

      // SQL oluştur
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const sql = `
        INSERT INTO ${meta.schema}.${meta.table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING ${meta.readableSelect}
      `;

      const result = await pool.query(sql, values);

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({ success: false, code: 'RESOURCE_DISABLED', message: error.message });
      }
      
      // Duplicate key error
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_KEY',
          message: 'Resource already exists'
        });
      }
      
      logger.error('Create data error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * UPDATE - PUT /data/:resource/:id
   * @example PUT /data/projects/123 { "status": "completed" }
   */
  static async update(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      if (meta.isReadonly) {
        return res.status(403).json({ success: false, code: 'RESOURCE_READONLY' });
      }

      // Sadece writable alanları al
      const writableSet = new Set(meta.writableColumns);
      const updates = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (writableSet.has(key) && key !== 'id') {  // id değiştirilemez
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'EMPTY_UPDATE',
          message: 'No valid fields to update'
        });
      }

      // SQL oluştur
      const entries = Object.entries(updates);
      const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
      const values = entries.map(([, value]) => value);

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      
      if (tenantId && meta.readableColumns.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $${values.length + 2}`;
        values.push(tenantId);
      }

      const sql = `
        UPDATE ${meta.schema}.${meta.table}
        SET ${setClauses}
        WHERE id = $${values.length + 1} ${rlsSql}
        RETURNING ${meta.readableSelect}
      `;
      
      values.push(id);

      const result = await pool.query(sql, values);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({ success: false, code: 'RESOURCE_DISABLED', message: error.message });
      }
      
      logger.error('Update data error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE - DELETE /data/:resource/:id
   * @example DELETE /data/projects/123
   */
  static async delete(req, res) {
    try {
      const { resource, id } = req.params;
      
      const meta = await RegistryService.getResourceMeta(resource);
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      if (meta.isReadonly) {
        return res.status(403).json({ success: false, code: 'RESOURCE_READONLY' });
      }

      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const params = [id];
      
      if (tenantId && meta.readableColumns.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $2`;
        params.push(tenantId);
      }

      const sql = `
        DELETE FROM ${meta.schema}.${meta.table}
        WHERE id = $1 ${rlsSql}
      `;

      const result = await pool.query(sql, params);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      }

      return res.status(204).send();

    } catch (error) {
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({ success: false, code: 'RESOURCE_DISABLED', message: error.message });
      }
      
      logger.error('Delete data error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * SEARCH - POST /data/:resource/search
   * (list() ile aynı mantık, farklı response format için)
   */
  static async search(req, res) {
    return DataController.list(req, res);
  }

  /**
   * COUNT - GET /data/:resource/count
   * @example GET /data/projects/count?eq.status=active
   */
  static async count(req, res) {
    try {
      const { resource } = req.params;
      const meta = await RegistryService.getResourceMeta(resource);
      
      if (!meta) {
        return res.status(404).json({ success: false, code: 'RESOURCE_NOT_FOUND' });
      }

      const where = QueryBuilder.buildWhere(req.query, meta);
      
      // RLS
      const tenantId = req.user?.tenant_id;
      let rlsSql = '';
      const rlsParams = [];
      
      if (tenantId && meta.readableColumns.includes('tenant_id')) {
        rlsSql = ` AND tenant_id = $${where.params.length + 1}`;
        rlsParams.push(tenantId);
      }
      
      const sql = `
        SELECT COUNT(*) as count 
        FROM ${meta.schema}.${meta.table} 
        WHERE 1=1 ${where.sql} ${rlsSql}
      `;
      
      const params = [...where.params, ...rlsParams];
      const result = await pool.query(sql, params);

      return res.json({
        success: true,
        count: parseInt(result.rows[0].count)
      });
    } catch (error) {
      if (error.message.includes('is not enabled')) {
        return res.status(403).json({ success: false, code: 'RESOURCE_DISABLED', message: error.message });
      }
      
      logger.error('Count error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * BATCH OPERATIONS (Hafta 3-4'te implement edilecek)
   */
  static async batchCreate(req, res) {
    res.status(501).json({ 
      success: false, 
      message: 'Batch create not implemented yet (Week 3-4)' 
    });
  }

  static async batchUpdate(req, res) {
    res.status(501).json({ 
      success: false, 
      message: 'Batch update not implemented yet (Week 3-4)' 
    });
  }

  static async batchDelete(req, res) {
    res.status(501).json({ 
      success: false, 
      message: 'Batch delete not implemented yet (Week 3-4)' 
    });
  }
}

module.exports = DataController;



