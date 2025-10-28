const { pool } = require('../config/database');
const logger = require('../logger');

/**
 * Inspect actual database schema from PostgreSQL
 */
class SchemaInspector {
  /**
   * Get all tables in specified schemas
   * @param {Array<string>} schemas - Schemas to inspect (default: ['public', 'core', 'app', 'cfg', 'ops'])
   * @returns {Promise<Array>} List of tables with columns
   */
  static async getAllTables(schemas = ['public', 'core', 'app', 'cfg', 'ops']) {
    try {
      const result = await pool.query(`
        SELECT 
          table_schema,
          table_name
        FROM information_schema.tables
        WHERE table_schema = ANY($1)
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `, [schemas]);

      return result.rows.map(row => ({
        schema: row.table_schema,
        table: row.table_name,
        fullName: `${row.table_schema}.${row.table_name}`
      }));
    } catch (error) {
      logger.error('Failed to get tables:', error);
      return [];
    }
  }

  /**
   * Get all columns for a specific table
   * @param {string} schema - Schema name
   * @param {string} table - Table name
   * @returns {Promise<Array>} List of columns with details
   */
  static async getTableColumns(schema, table) {
    try {
      const result = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
      `, [schema, table]);

      return result.rows.map(row => ({
        name: row.column_name,
        type: this.formatDataType(row.data_type, row.character_maximum_length, row.udt_name),
        nullable: row.is_nullable === 'YES',
        default: row.column_default
      }));
    } catch (error) {
      logger.error(`Failed to get columns for ${schema}.${table}:`, error);
      return [];
    }
  }

  /**
   * Get all columns for all tables in specified schemas
   * @param {Array<string>} schemas - Schemas to inspect
   * @returns {Promise<Object>} Object keyed by table full name
   */
  static async getAllColumns(schemas = ['public', 'core', 'app', 'cfg', 'ops']) {
    try {
      const result = await pool.query(`
        SELECT 
          table_schema,
          table_name,
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = ANY($1)
        ORDER BY table_schema, table_name, ordinal_position
      `, [schemas]);

      // Group by table
      const columnsByTable = {};
      
      for (const row of result.rows) {
        const fullName = `${row.table_schema}.${row.table_name}`;
        
        if (!columnsByTable[fullName]) {
          columnsByTable[fullName] = [];
        }

        columnsByTable[fullName].push({
          name: row.column_name,
          type: this.formatDataType(row.data_type, row.character_maximum_length, row.udt_name),
          nullable: row.is_nullable === 'YES',
          default: row.column_default
        });
      }

      return columnsByTable;
    } catch (error) {
      logger.error('Failed to get all columns:', error);
      return {};
    }
  }

  /**
   * Get all indexes for specified schemas
   * @param {Array<string>} schemas - Schemas to inspect
   * @returns {Promise<Object>} Object keyed by table full name
   */
  static async getAllIndexes(schemas = ['public', 'core', 'app', 'cfg', 'ops']) {
    try {
      const result = await pool.query(`
        SELECT
          schemaname AS schema,
          tablename AS table,
          indexname AS index_name,
          indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = ANY($1)
        ORDER BY schemaname, tablename, indexname
      `, [schemas]);

      // Group by table
      const indexesByTable = {};
      
      for (const row of result.rows) {
        const fullName = `${row.schema}.${row.table}`;
        
        if (!indexesByTable[fullName]) {
          indexesByTable[fullName] = [];
        }

        indexesByTable[fullName].push({
          name: row.index_name,
          definition: row.definition
        });
      }

      return indexesByTable;
    } catch (error) {
      logger.error('Failed to get indexes:', error);
      return {};
    }
  }

  /**
   * Get all foreign keys for specified schemas
   * @param {Array<string>} schemas - Schemas to inspect
   * @returns {Promise<Object>} Object keyed by table full name
   */
  static async getAllForeignKeys(schemas = ['public', 'core', 'app', 'cfg', 'ops']) {
    try {
      const result = await pool.query(`
        SELECT
          tc.table_schema AS schema,
          tc.table_name AS table,
          kcu.column_name AS column,
          ccu.table_schema AS foreign_schema,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = ANY($1)
        ORDER BY tc.table_schema, tc.table_name
      `, [schemas]);

      // Group by table
      const foreignKeysByTable = {};
      
      for (const row of result.rows) {
        const fullName = `${row.schema}.${row.table}`;
        
        if (!foreignKeysByTable[fullName]) {
          foreignKeysByTable[fullName] = [];
        }

        foreignKeysByTable[fullName].push({
          constraintName: row.constraint_name,
          column: row.column,
          refSchema: row.foreign_schema,
          refTable: row.foreign_table,
          refColumn: row.foreign_column,
          refTableFullName: `${row.foreign_schema}.${row.foreign_table}`
        });
      }

      return foreignKeysByTable;
    } catch (error) {
      logger.error('Failed to get foreign keys:', error);
      return {};
    }
  }

  /**
   * Get row count for a specific table
   * @param {string} schema - Schema name
   * @param {string} table - Table name
   * @returns {Promise<number>} Row count
   */
  static async getTableRowCount(schema, table) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM ${schema}.${table}
      `);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error(`Failed to get row count for ${schema}.${table}:`, error);
      return 0;
    }
  }

  /**
   * Get complete schema snapshot
   * @param {Array<string>} schemas - Schemas to inspect
   * @returns {Promise<Object>} Complete schema information
   */
  static async getCompleteSchema(schemas = ['public', 'core', 'app', 'cfg', 'ops']) {
    try {
      const [tables, columns, indexes, foreignKeys] = await Promise.all([
        this.getAllTables(schemas),
        this.getAllColumns(schemas),
        this.getAllIndexes(schemas),
        this.getAllForeignKeys(schemas)
      ]);

      // Combine all information
      const completeSchema = {};

      for (const table of tables) {
        const { schema, table: tableName, fullName } = table;
        
        completeSchema[fullName] = {
          schema,
          table: tableName,
          fullName,
          columns: columns[fullName] || [],
          indexes: indexes[fullName] || [],
          foreignKeys: foreignKeys[fullName] || []
        };
      }

      return completeSchema;
    } catch (error) {
      logger.error('Failed to get complete schema:', error);
      return {};
    }
  }

  /**
   * Format data type for display
   * @private
   */
  static formatDataType(dataType, maxLength, udtName) {
    if (dataType === 'character varying' && maxLength) {
      return `VARCHAR(${maxLength})`;
    } else if (dataType === 'character' && maxLength) {
      return `CHAR(${maxLength})`;
    } else if (dataType === 'ARRAY') {
      return `${udtName}[]`.toUpperCase();
    } else if (dataType === 'timestamp without time zone') {
      return 'TIMESTAMP';
    } else if (dataType === 'timestamp with time zone') {
      return 'TIMESTAMPTZ';
    } else if (dataType === 'USER-DEFINED') {
      return udtName.toUpperCase();
    }
    
    return dataType.toUpperCase();
  }
}

module.exports = SchemaInspector;

