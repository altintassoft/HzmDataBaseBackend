/**
 * Database Tables Constants
 * Centralized table names for consistency and maintainability
 * 
 * USAGE:
 *   const { TABLES } = require('../shared/constants/tables');
 *   SELECT * FROM ${TABLES.USERS}
 * 
 * BENEFITS:
 *   ✅ No hard-coded table names
 *   ✅ Easy refactoring
 *   ✅ Auto-complete support
 *   ✅ Single source of truth
 */

const TABLES = {
  // Core Schema
  USERS: 'core.users',
  TENANTS: 'core.tenants',
  PROJECTS: 'core.projects',
  
  // Config Schema
  CURRENCIES: 'cfg.currencies',
  EXCHANGE_RATES: 'cfg.exchange_rates',
  
  // Public Schema
  SCHEMA_MIGRATIONS: 'public.schema_migrations',
  
  // App Schema (future use)
  APP_SETTINGS: 'app.settings',
  APP_LOGS: 'app.logs',
  
  // Ops Schema (future use)
  OPS_JOBS: 'ops.jobs',
  OPS_AUDIT_LOG: 'ops.audit_log'
};

// Schema names
const SCHEMAS = {
  CORE: 'core',
  CFG: 'cfg',
  PUBLIC: 'public',
  APP: 'app',
  OPS: 'ops'
};

// Column names (frequently used)
const COLUMNS = {
  ID: 'id',
  TENANT_ID: 'tenant_id',
  OWNER_ID: 'owner_id',
  EMAIL: 'email',
  ROLE: 'role',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  CREATED_BY: 'created_by',
  UPDATED_BY: 'updated_by'
};

module.exports = {
  TABLES,
  SCHEMAS,
  COLUMNS
};

