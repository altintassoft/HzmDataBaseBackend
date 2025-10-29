-- FORCE-RERUN
-- Migration 008: Add new report types for live reports
-- Purpose: Enable AI to read all report types from database
-- Date: 2025-10-29

-- Add new report types to ENUM (with schema prefix: ops.ai_kb_report_type)
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'backend_tables';
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'migration_schema';
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'backend_config';
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'frontend_config';
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'backend_structure';
ALTER TYPE ops.ai_kb_report_type ADD VALUE IF NOT EXISTS 'frontend_structure';

-- Create index for faster report_type queries
CREATE INDEX IF NOT EXISTS idx_ai_kb_report_type_latest 
  ON ops.ai_knowledge_base(report_type, is_latest_version) 
  WHERE is_latest_version = true;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 008: New report types added successfully!';
  RAISE NOTICE '   - backend_tables, migration_schema';
  RAISE NOTICE '   - backend_config, frontend_config';
  RAISE NOTICE '   - backend_structure, frontend_structure';
END $$;

