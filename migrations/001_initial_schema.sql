-- HZM Platform Initial Schema
-- Version: 1.0.0
-- Description: Core tables for multi-tenant DBaaS platform

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS cfg;
CREATE SCHEMA IF NOT EXISTS ops;

-- Helper Functions
CREATE OR REPLACE FUNCTION app.set_context(p_tenant_id INTEGER, p_user_id INTEGER)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, FALSE);
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_tenant_id', TRUE)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', TRUE)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql;

-- Touch row trigger (updated_at)
CREATE OR REPLACE FUNCTION app.touch_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Core Tables

-- Tenants
CREATE TABLE core.tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255) UNIQUE,
  default_language VARCHAR(10) DEFAULT 'en',
  default_currency VARCHAR(3) DEFAULT 'USD',
  plan VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_slug ON core.tenants(slug);
CREATE INDEX idx_tenants_active ON core.tenants(is_active) WHERE is_deleted = FALSE;

-- Users
CREATE TABLE core.users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES core.tenants(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_active ON core.users(is_active) WHERE is_deleted = FALSE;

-- RLS Policies for Users
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON core.users
  USING (tenant_id = app.current_tenant());

-- Triggers
CREATE TRIGGER trg_tenants_touch
  BEFORE UPDATE ON core.tenants
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();

CREATE TRIGGER trg_users_touch
  BEFORE UPDATE ON core.users
  FOR EACH ROW EXECUTE FUNCTION app.touch_row();

-- Grant permissions
GRANT USAGE ON SCHEMA app, core, cfg, ops TO PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA core TO PUBLIC;
GRANT ALL ON ALL SEQUENCES IN SCHEMA core TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO PUBLIC;

