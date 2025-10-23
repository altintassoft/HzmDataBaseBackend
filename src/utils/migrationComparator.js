const logger = require('./logger');

/**
 * Compare expected migration schema with actual database schema
 */
class MigrationComparator {
  /**
   * Compare a single table's expected vs actual schema
   * @param {Object} expected - Expected table schema from migration
   * @param {Object} actual - Actual table schema from database
   * @returns {Object} Comparison result
   */
  static compareTable(expected, actual) {
    if (!expected && !actual) {
      return { status: 'error', message: 'Both schemas are null' };
    }

    if (!actual) {
      return {
        status: 'missing',
        message: 'Table exists in migration but not in database',
        expected: expected.fullName,
        actual: null
      };
    }

    if (!expected) {
      return {
        status: 'extra',
        message: 'Table exists in database but not in migration',
        expected: null,
        actual: actual.fullName
      };
    }

    // Compare columns
    const columnComparison = this.compareColumns(expected.columns, actual.columns);

    // Determine overall status
    let status = 'success';
    if (columnComparison.missing.length > 0 || columnComparison.extra.length > 0) {
      status = 'warning';
    }
    if (columnComparison.typeMismatch.length > 0) {
      status = 'error';
    }

    return {
      status,
      message: this.getTableStatusMessage(columnComparison),
      table: expected.fullName || actual.fullName,
      expectedColumns: expected.columns?.length || 0,
      actualColumns: actual.columns?.length || 0,
      columnComparison
    };
  }

  /**
   * Compare column lists
   * @param {Array} expectedColumns - Expected columns from migration
   * @param {Array} actualColumns - Actual columns from database
   * @returns {Object} Column comparison result
   */
  static compareColumns(expectedColumns = [], actualColumns = []) {
    const missing = [];
    const extra = [];
    const typeMismatch = [];
    const matching = [];

    // Build maps for quick lookup
    const expectedMap = new Map();
    const actualMap = new Map();

    for (const col of expectedColumns) {
      expectedMap.set(col.name.toLowerCase(), col);
    }

    for (const col of actualColumns) {
      actualMap.set(col.name.toLowerCase(), col);
    }

    // Find missing columns (in expected but not in actual)
    for (const [name, expectedCol] of expectedMap) {
      const actualCol = actualMap.get(name);
      
      if (!actualCol) {
        missing.push({
          name: expectedCol.name,
          type: expectedCol.type,
          source: 'Expected in migration'
        });
      } else {
        // Column exists, check type
        const expectedType = this.normalizeType(expectedCol.type);
        const actualType = this.normalizeType(actualCol.type);

        if (expectedType !== actualType) {
          typeMismatch.push({
            name: expectedCol.name,
            expectedType: expectedCol.type,
            actualType: actualCol.type
          });
        } else {
          matching.push({
            name: expectedCol.name,
            type: actualCol.type
          });
        }
      }
    }

    // Find extra columns (in actual but not in expected)
    for (const [name, actualCol] of actualMap) {
      if (!expectedMap.has(name)) {
        extra.push({
          name: actualCol.name,
          type: actualCol.type,
          source: 'Extra in database'
        });
      }
    }

    return {
      missing,
      extra,
      typeMismatch,
      matching,
      totalExpected: expectedColumns.length,
      totalActual: actualColumns.length
    };
  }

  /**
   * Compare INSERT statements with actual data
   * @param {Array} expectedInserts - Expected INSERT statements from migration
   * @param {Object} actualData - Actual data from database (keyed by table)
   * @returns {Object} Data comparison result
   */
  static compareData(expectedInserts, actualData) {
    const results = [];

    for (const insert of expectedInserts) {
      const { fullName, columns, values } = insert;
      const tableData = actualData[fullName] || [];

      // Check if this insert exists in actual data
      const found = this.findMatchingRow(columns, values, tableData);

      results.push({
        table: fullName,
        columns,
        values,
        found,
        status: found ? 'success' : 'missing'
      });
    }

    return results;
  }

  /**
   * Find a matching row in actual data
   * @private
   */
  static findMatchingRow(columns, values, tableData) {
    // Simple matching: check if any row has matching email or id
    // (This is a simplified version; real implementation would be more sophisticated)
    
    const emailIndex = columns.findIndex(col => col.trim().toLowerCase() === 'email');
    if (emailIndex !== -1 && values[emailIndex]) {
      // Clean the email value: remove quotes, whitespace, and newlines
      const expectedEmail = values[emailIndex]
        .replace(/'/g, '')
        .replace(/"/g, '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
      
      return tableData.some(row => {
        const actualEmail = (row.email || '').toLowerCase().trim();
        return actualEmail === expectedEmail;
      });
    }

    return false;
  }

  /**
   * Generate comparison report for all migrations
   * @param {Array} parsedMigrations - Parsed migration files
   * @param {Object} actualSchema - Actual database schema
   * @param {Object} actualData - Actual database data (keyed by table)
   * @returns {Object} Complete comparison report
   */
  static generateReport(parsedMigrations, actualSchema, actualData = {}) {
    const report = {
      summary: {
        totalMigrations: parsedMigrations.length,
        successCount: 0,
        warningCount: 0,
        errorCount: 0
      },
      migrations: [],
      tables: {}
    };

    // Build expected schema from all migrations
    const expectedSchema = this.buildExpectedSchema(parsedMigrations);

    // Compare each table
    for (const [tableName, expectedTable] of Object.entries(expectedSchema)) {
      const actualTable = actualSchema[tableName];
      const comparison = this.compareTable(expectedTable, actualTable);

      report.tables[tableName] = comparison;

      // Update summary
      if (comparison.status === 'success') {
        report.summary.successCount++;
      } else if (comparison.status === 'warning') {
        report.summary.warningCount++;
      } else {
        report.summary.errorCount++;
      }
    }

    // Check for extra tables in database
    for (const [tableName, actualTable] of Object.entries(actualSchema)) {
      if (!expectedSchema[tableName]) {
        const comparison = this.compareTable(null, actualTable);
        report.tables[tableName] = comparison;
        report.summary.warningCount++;
      }
    }

    // Generate per-migration report
    for (const parsed of parsedMigrations) {
      const migrationReport = {
        filename: parsed.filename,
        description: parsed.description,
        tables: [],
        columns: [],
        inserts: [],
        status: 'success'
      };

      // Check tables created by this migration
      for (const table of parsed.tables) {
        const comparison = report.tables[table.fullName];
        if (comparison) {
          migrationReport.tables.push({
            table: table.fullName,
            status: comparison.status,
            expectedColumns: comparison.expectedColumns,
            actualColumns: comparison.actualColumns
          });

          if (comparison.status !== 'success') {
            migrationReport.status = comparison.status;
          }
        }
      }

      // Check columns added by this migration
      for (const column of parsed.columns) {
        const tableComparison = report.tables[column.fullName];
        if (tableComparison) {
          const columnFound = tableComparison.columnComparison.matching.some(
            c => c.name.toLowerCase() === column.column.toLowerCase()
          );
          
          migrationReport.columns.push({
            table: column.fullName,
            column: column.column,
            found: columnFound
          });

          if (!columnFound) {
            migrationReport.status = 'error';
          }
        }
      }

      // Check data inserts
      if (parsed.inserts.length > 0) {
        const dataComparison = this.compareData(parsed.inserts, actualData);
        migrationReport.inserts = dataComparison;

        if (dataComparison.some(d => d.status === 'missing')) {
          migrationReport.status = 'warning';
        }
      }

      report.migrations.push(migrationReport);
    }

    return report;
  }

  /**
   * Build expected schema from all migrations
   * @private
   */
  static buildExpectedSchema(parsedMigrations) {
    const schema = {};

    // Process migrations in order
    for (const parsed of parsedMigrations) {
      // Add tables from CREATE TABLE
      for (const table of parsed.tables) {
        if (!schema[table.fullName]) {
          schema[table.fullName] = {
            schema: table.schema,
            table: table.table,
            fullName: table.fullName,
            columns: [...table.columns]
          };
        }
      }

      // Add columns from ALTER TABLE ADD COLUMN
      for (const column of parsed.columns) {
        if (!schema[column.fullName]) {
          schema[column.fullName] = {
            schema: column.schema,
            table: column.table,
            fullName: column.fullName,
            columns: []
          };
        }

        // Add column if not already present
        if (!schema[column.fullName].columns.some(c => c.name === column.column)) {
          schema[column.fullName].columns.push({
            name: column.column,
            type: column.type,
            constraints: column.constraints
          });
        }
      }
    }

    return schema;
  }

  /**
   * Normalize type for comparison
   * @private
   */
  static normalizeType(type) {
    if (!type) return '';
    
    // Remove whitespace and convert to uppercase
    let normalized = type.trim().toUpperCase();

    // Normalize common type variations
    const typeMap = {
      'INT': 'INTEGER',
      'INT4': 'INTEGER',
      'INT8': 'BIGINT',
      'BOOL': 'BOOLEAN',
      'SERIAL': 'INTEGER',
      'BIGSERIAL': 'BIGINT'
    };

    for (const [from, to] of Object.entries(typeMap)) {
      if (normalized.startsWith(from)) {
        normalized = normalized.replace(from, to);
      }
    }

    return normalized;
  }

  /**
   * Get human-readable status message for table comparison
   * @private
   */
  static getTableStatusMessage(columnComparison) {
    const { missing, extra, typeMismatch } = columnComparison;

    if (missing.length === 0 && extra.length === 0 && typeMismatch.length === 0) {
      return 'Backend ile %100 uyumlu';
    }

    const messages = [];

    if (missing.length > 0) {
      messages.push(`${missing.length} kolon eksik`);
    }

    if (extra.length > 0) {
      messages.push(`${extra.length} fazla kolon`);
    }

    if (typeMismatch.length > 0) {
      messages.push(`${typeMismatch.length} tip uyuşmazlığı`);
    }

    return messages.join(', ');
  }
}

module.exports = MigrationComparator;

