const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Parse migration SQL file to extract schema information
 */
class MigrationParser {
  /**
   * Parse a single migration file
   * @param {string} filePath - Full path to migration file
   * @returns {Object} Parsed migration data
   */
  static parseMigrationFile(filePath) {
    try {
      const filename = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract metadata from comments
      const description = this.extractDescription(content);
      const author = this.extractAuthor(content);
      const date = this.extractDate(content);

      // Parse SQL content
      const tables = this.extractTables(content);
      const columns = this.extractColumns(content);
      const indexes = this.extractIndexes(content);
      const foreignKeys = this.extractForeignKeys(content);
      const inserts = this.extractInserts(content);

      return {
        filename,
        description,
        author,
        date,
        tables,
        columns,
        indexes,
        foreignKeys,
        inserts
      };
    } catch (error) {
      logger.error(`Failed to parse migration file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract description from migration file header
   */
  static extractDescription(content) {
    const match = content.match(/--\s*Description:\s*(.+)/i);
    return match ? match[1].trim() : 'No description';
  }

  /**
   * Extract author from migration file header
   */
  static extractAuthor(content) {
    const match = content.match(/--\s*Author:\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * Extract date from migration file header
   */
  static extractDate(content) {
    const match = content.match(/--\s*Date:\s*(.+)/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract CREATE TABLE statements
   */
  static extractTables(content) {
    const tables = [];
    
    // Match CREATE TABLE statements (including IF NOT EXISTS)
    const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullName = match[1];
      const [schema, tableName] = fullName.split('.');
      const definition = match[2];

      // Parse column definitions from table definition
      const tableColumns = this.parseTableColumns(definition);

      tables.push({
        schema,
        table: tableName,
        fullName,
        columns: tableColumns
      });
    }

    return tables;
  }

  /**
   * Parse columns from CREATE TABLE definition
   */
  static parseTableColumns(definition) {
    const columns = [];
    const lines = definition.split(',').map(l => l.trim());

    for (const line of lines) {
      // Skip constraints (PRIMARY KEY, FOREIGN KEY, etc.)
      if (line.match(/^\s*(PRIMARY KEY|FOREIGN KEY|CONSTRAINT|UNIQUE|CHECK)/i)) {
        continue;
      }

      // Parse column: name type [constraints]
      const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([A-Z0-9()]+(?:\[\])?)(.*)?/i);
      if (colMatch) {
        const [, name, type, constraints] = colMatch;
        columns.push({
          name,
          type: type.toUpperCase(),
          constraints: constraints ? constraints.trim() : ''
        });
      }
    }

    return columns;
  }

  /**
   * Extract ALTER TABLE ADD COLUMN statements
   */
  static extractColumns(content) {
    const columns = [];
    
    // Match ALTER TABLE ADD COLUMN statements
    const regex = /ALTER\s+TABLE\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+([A-Z0-9()]+(?:\[\])?)(.*?);/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullName = match[1];
      const [schema, table] = fullName.split('.');
      const columnName = match[2];
      const columnType = match[3];
      const constraints = match[4] ? match[4].trim() : '';

      columns.push({
        schema,
        table,
        fullName,
        column: columnName,
        type: columnType.toUpperCase(),
        constraints
      });
    }

    return columns;
  }

  /**
   * Extract CREATE INDEX statements
   */
  static extractIndexes(content) {
    const indexes = [];
    
    // Match CREATE INDEX statements
    const regex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\((.*?)\)/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const indexName = match[1];
      const fullName = match[2];
      const [schema, table] = fullName.split('.');
      const columnsStr = match[3];

      indexes.push({
        schema,
        table,
        fullName,
        indexName,
        columns: columnsStr.split(',').map(c => c.trim())
      });
    }

    return indexes;
  }

  /**
   * Extract FOREIGN KEY constraints
   */
  static extractForeignKeys(content) {
    const foreignKeys = [];
    
    // Match ADD CONSTRAINT ... FOREIGN KEY statements
    const regex = /ALTER\s+TABLE\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullName = match[1];
      const [schema, table] = fullName.split('.');
      const constraintName = match[2];
      const column = match[3].trim();
      const refTableFullName = match[4];
      const [refSchema, refTable] = refTableFullName.split('.');
      const refColumn = match[5].trim();

      foreignKeys.push({
        schema,
        table,
        fullName,
        constraintName,
        column,
        refSchema,
        refTable,
        refColumn,
        refTableFullName
      });
    }

    return foreignKeys;
  }

  /**
   * Extract INSERT INTO statements
   */
  static extractInserts(content) {
    const inserts = [];
    
    // Match INSERT INTO statements (including multi-line)
    // Use [\s\S] instead of . to match newlines
    const regex = /INSERT\s+INTO\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullName = match[1];
      const [schema, table] = fullName.split('.');
      const columnsStr = match[2];
      const valuesStr = match[3];

      const columns = columnsStr.split(',').map(c => c.trim());
      const values = this.parseValues(valuesStr);

      inserts.push({
        schema,
        table,
        fullName,
        columns,
        values
      });
    }

    return inserts;
  }

  /**
   * Parse VALUES clause to extract individual values
   */
  static parseValues(valuesStr) {
    // Simple parser for VALUES (handles strings with quotes, numbers, NOW(), etc.)
    const values = [];
    let current = '';
    let inQuote = false;
    let quoteChar = null;

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];

      if ((char === "'" || char === '"') && (i === 0 || valuesStr[i - 1] !== '\\')) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
          quoteChar = null;
        }
        current += char;
      } else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      values.push(current.trim());
    }

    return values;
  }

  /**
   * Get summary statistics from parsed migration
   */
  static getMigrationSummary(parsed) {
    if (!parsed) return null;

    return {
      filename: parsed.filename,
      description: parsed.description,
      tablesCreated: parsed.tables.length,
      columnsAdded: parsed.columns.length,
      indexesCreated: parsed.indexes.length,
      foreignKeysAdded: parsed.foreignKeys.length,
      rowsInserted: parsed.inserts.length
    };
  }
}

module.exports = MigrationParser;

