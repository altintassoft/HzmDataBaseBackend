/**
 * Query Builder - Supabase-style Query DSL
 * 
 * @description
 * URL query parameters'dan SQL WHERE, ORDER BY, LIMIT/OFFSET clause'ları oluşturur.
 * Güvenlik: SQL injection korumalı, sadece metadata'da tanımlı kolonlar kullanılabilir.
 * 
 * @example
 * // URL: /data/projects?eq.status=active&order=created_at.desc&limit=20
 * const where = QueryBuilder.buildWhere(req.query, meta);
 * // → { sql: ' AND status = $1', params: ['active'] }
 */
class QueryBuilder {
  /**
   * WHERE clause oluştur (Supabase tarzı filter)
   * 
   * Desteklenen operatörler:
   * - eq: equal (=)
   * - neq: not equal (!=)
   * - gt: greater than (>)
   * - gte: greater than or equal (>=)
   * - lt: less than (<)
   * - lte: less than or equal (<=)
   * - like: SQL LIKE (case-sensitive)
   * - ilike: SQL ILIKE (case-insensitive)
   * - in: IN clause (comma-separated values)
   * 
   * @param {Object} query - req.query objesi
   * @param {Object} meta - Resource metadata (RegistryService'den)
   * @returns {Object} { sql: string, params: array }
   * 
   * @example
   * // ?eq.status=active&gt.id=100
   * buildWhere(query, meta)
   * // → { sql: ' AND status = $1 AND id > $2', params: ['active', '100'] }
   */
  static buildWhere(query, meta) {
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    // Readable column'larla filter et (güvenlik)
    const readableSet = new Set(meta.readableColumns);

    for (const [key, value] of Object.entries(query)) {
      // Filter operators: eq, neq, gt, gte, lt, lte, like, ilike, in
      const match = key.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|in)\.(.+)$/);
      
      if (!match) continue;  // Geçerli operator değil
      
      const [, operator, column] = match;
      
      // Güvenlik: Sadece readable column'ları filtrele
      if (!readableSet.has(column)) continue;
      
      switch (operator) {
        case 'eq':
          whereClauses.push(`${column} = $${paramIndex++}`);
          params.push(value);
          break;
        case 'neq':
          whereClauses.push(`${column} != $${paramIndex++}`);
          params.push(value);
          break;
        case 'gt':
          whereClauses.push(`${column} > $${paramIndex++}`);
          params.push(value);
          break;
        case 'gte':
          whereClauses.push(`${column} >= $${paramIndex++}`);
          params.push(value);
          break;
        case 'lt':
          whereClauses.push(`${column} < $${paramIndex++}`);
          params.push(value);
          break;
        case 'lte':
          whereClauses.push(`${column} <= $${paramIndex++}`);
          params.push(value);
          break;
        case 'like':
          whereClauses.push(`${column} LIKE $${paramIndex++}`);
          params.push(value);
          break;
        case 'ilike':
          whereClauses.push(`${column} ILIKE $${paramIndex++}`);
          params.push(value);
          break;
        case 'in':
          const values = value.split(',');
          whereClauses.push(`${column} = ANY($${paramIndex++})`);
          params.push(values);
          break;
        default:
          // Bilinmeyen operator (güvenlik)
          continue;
      }
    }

    return {
      sql: whereClauses.length ? ' AND ' + whereClauses.join(' AND ') : '',
      params
    };
  }

  /**
   * ORDER BY clause oluştur
   * 
   * @param {string} orderStr - order query parametresi
   * @param {Object} meta - Resource metadata
   * @returns {string} ORDER BY SQL clause
   * 
   * @example
   * // ?order=created_at.desc,name.asc
   * buildOrder('created_at.desc,name.asc', meta)
   * // → 'ORDER BY created_at DESC, name ASC'
   */
  static buildOrder(orderStr, meta) {
    if (!orderStr) return 'ORDER BY id DESC';  // Default

    const readableSet = new Set(meta.readableColumns);
    const orders = [];

    for (const item of orderStr.split(',')) {
      const [column, direction = 'asc'] = item.split('.');
      
      // Güvenlik: Sadece readable column
      if (!readableSet.has(column)) continue;
      
      // SQL injection önleme
      const validDirections = ['asc', 'desc'];
      if (!validDirections.includes(direction.toLowerCase())) continue;
      
      orders.push(`${column} ${direction.toUpperCase()}`);
    }

    return orders.length ? 'ORDER BY ' + orders.join(', ') : 'ORDER BY id DESC';
  }

  /**
   * Pagination (offset-based, basit)
   * Gelecekte cursor-based yapılabilir
   * 
   * @param {Object} query - req.query objesi
   * @returns {Object} { limit, offset, page }
   * 
   * @example
   * // ?page=2&limit=25
   * buildPagination(query)
   * // → { limit: 25, offset: 25, page: 2 }
   */
  static buildPagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    return { limit, offset, page };
  }

  /**
   * SELECT clause oluştur
   * 
   * @param {string} selectStr - select query parametresi
   * @param {Object} meta - Resource metadata
   * @returns {string} SELECT column listesi
   * 
   * @example
   * // ?select=id,name,email
   * buildSelect('id,name,email', meta)
   * // → 'id, name, email'
   */
  static buildSelect(selectStr, meta) {
    if (!selectStr) return meta.readableSelect;  // Default: tüm readable

    const readableSet = new Set(meta.readableColumns);
    const columns = selectStr.split(',')
      .map(c => c.trim())
      .filter(c => readableSet.has(c));

    return columns.length ? columns.join(', ') : meta.readableSelect;
  }

  /**
   * Full query builder (hepsini birleştir)
   * 
   * @param {Object} query - req.query objesi
   * @param {Object} meta - Resource metadata
   * @returns {Object} { select, where, order, pagination }
   * 
   * @example
   * const queryParts = QueryBuilder.build(req.query, meta);
   * const sql = `SELECT ${queryParts.select} FROM ${meta.table} WHERE 1=1 ${queryParts.where.sql} ${queryParts.order}`;
   */
  static build(query, meta) {
    return {
      select: this.buildSelect(query.select, meta),
      where: this.buildWhere(query, meta),
      order: this.buildOrder(query.order, meta),
      pagination: this.buildPagination(query)
    };
  }
}

module.exports = QueryBuilder;
