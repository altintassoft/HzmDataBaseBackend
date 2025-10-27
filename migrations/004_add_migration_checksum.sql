-- Migration: 007_add_migration_checksum.sql
-- Description: Add checksum column to track migration file changes
-- Author: HZM Platform
-- Date: 2025-10-23

-- Add checksum column to schema_migrations
ALTER TABLE public.schema_migrations 
ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

-- Add executed_by column for audit trail
ALTER TABLE public.schema_migrations 
ADD COLUMN IF NOT EXISTS executed_by VARCHAR(100) DEFAULT 'system';

-- Create index for faster checksum lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_checksum 
ON public.schema_migrations(checksum);

-- Add comment for documentation
COMMENT ON COLUMN public.schema_migrations.checksum IS 
'SHA-256 hash of migration file content. If hash changes, migration will re-run.';

COMMENT ON COLUMN public.schema_migrations.executed_by IS 
'Indicates who/what executed the migration (system, manual, force-flag).';

