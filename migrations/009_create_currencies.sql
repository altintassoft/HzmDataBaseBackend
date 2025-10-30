-- ============================================================================
-- MIGRATION 009: Multi-Currency Support
-- Purpose: Enable multi-currency pricing and exchange rates
-- Date: 2025-10-29
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE CURRENCIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfg.currencies (
  -- Currency Info
  code VARCHAR(3) PRIMARY KEY,              -- ISO 4217: USD, EUR, TRY, GBP
  name VARCHAR(100) NOT NULL,               -- US Dollar, Euro, Turkish Lira
  symbol VARCHAR(10) NOT NULL,              -- $, €, ₺, £
  decimal_digits INTEGER DEFAULT 2,        -- 2 for most, 0 for JPY
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,         -- Default currency (TRY)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: CREATE EXCHANGE RATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfg.exchange_rates (
  -- Currency Pair
  from_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  to_currency VARCHAR(3) REFERENCES cfg.currencies(code),
  
  -- Rate Info
  rate NUMERIC(20, 6) NOT NULL,             -- 1 TRY = 0.036 USD
  rate_date DATE NOT NULL,                  -- Hangi gün için
  
  -- Source
  source VARCHAR(50) DEFAULT 'manual',      -- tcmb, ecb, manual
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Primary Key: Unique per currency pair per date
  PRIMARY KEY (from_currency, to_currency, rate_date),
  
  -- Constraint: Can't convert currency to itself
  CONSTRAINT chk_different_currencies CHECK (from_currency <> to_currency)
);

-- ============================================================================
-- STEP 3: INDEXES
-- ============================================================================

-- Active currencies only
CREATE INDEX idx_currencies_active ON cfg.currencies(is_active) WHERE is_active = TRUE;

-- Default currency quick lookup
CREATE INDEX idx_currencies_default ON cfg.currencies(is_default) WHERE is_default = TRUE;

-- Latest rate lookup (most common query)
CREATE INDEX idx_exchange_rates_latest ON cfg.exchange_rates(from_currency, to_currency, rate_date DESC);

-- Date range queries
CREATE INDEX idx_exchange_rates_date ON cfg.exchange_rates(rate_date DESC);

-- Source filtering
CREATE INDEX idx_exchange_rates_source ON cfg.exchange_rates(source);

-- ============================================================================
-- STEP 4: SEED DATA - INITIAL CURRENCIES
-- ============================================================================

-- Insert major currencies
INSERT INTO cfg.currencies (code, name, symbol, decimal_digits, is_active, is_default) VALUES
('TRY', 'Turkish Lira', '₺', 2, TRUE, TRUE),      -- Default
('USD', 'US Dollar', '$', 2, TRUE, FALSE),
('EUR', 'Euro', '€', 2, TRUE, FALSE),
('GBP', 'British Pound', '£', 2, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- STEP 5: SEED DATA - INITIAL EXCHANGE RATES (Approximate)
-- ============================================================================

-- Current rates (approximate, will be updated by cron)
INSERT INTO cfg.exchange_rates (from_currency, to_currency, rate, rate_date, source) VALUES
-- TRY to others
('TRY', 'USD', 0.036, CURRENT_DATE, 'manual'),
('TRY', 'EUR', 0.033, CURRENT_DATE, 'manual'),
('TRY', 'GBP', 0.028, CURRENT_DATE, 'manual'),

-- USD to others
('USD', 'TRY', 28.50, CURRENT_DATE, 'manual'),
('USD', 'EUR', 0.92, CURRENT_DATE, 'manual'),
('USD', 'GBP', 0.79, CURRENT_DATE, 'manual'),

-- EUR to others
('EUR', 'TRY', 31.00, CURRENT_DATE, 'manual'),
('EUR', 'USD', 1.09, CURRENT_DATE, 'manual'),
('EUR', 'GBP', 0.86, CURRENT_DATE, 'manual'),

-- GBP to others
('GBP', 'TRY', 36.00, CURRENT_DATE, 'manual'),
('GBP', 'USD', 1.27, CURRENT_DATE, 'manual'),
('GBP', 'EUR', 1.16, CURRENT_DATE, 'manual')
ON CONFLICT (from_currency, to_currency, rate_date) DO NOTHING;

-- ============================================================================
-- STEP 6: HELPER FUNCTIONS
-- ============================================================================

-- Function to get latest exchange rate
CREATE OR REPLACE FUNCTION cfg.get_latest_rate(
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3)
) RETURNS NUMERIC(20, 6) AS $$
DECLARE
  v_rate NUMERIC(20, 6);
BEGIN
  -- Same currency = 1.0
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get latest rate
  SELECT rate INTO v_rate
  FROM cfg.exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
  ORDER BY rate_date DESC
  LIMIT 1;
  
  -- If not found, return NULL
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to convert currency
CREATE OR REPLACE FUNCTION cfg.convert_currency(
  p_amount NUMERIC,
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3)
) RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC(20, 6);
BEGIN
  -- Same currency
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;
  
  -- Get rate
  v_rate := cfg.get_latest_rate(p_from_currency, p_to_currency);
  
  -- If no rate found, return NULL
  IF v_rate IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Convert
  RETURN ROUND(p_amount * v_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: ADD PRICING COLUMNS TO PROJECTS TABLE
-- ============================================================================

-- Add pricing-related columns to core.projects
ALTER TABLE core.projects
ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) REFERENCES cfg.currencies(code) DEFAULT 'TRY',
ADD COLUMN IF NOT EXISTS pricing_plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';

-- Add indexes for pricing queries
CREATE INDEX IF NOT EXISTS idx_projects_price ON core.projects(price);
CREATE INDEX IF NOT EXISTS idx_projects_currency ON core.projects(currency);
CREATE INDEX IF NOT EXISTS idx_projects_plan ON core.projects(pricing_plan);

-- Add constraints
ALTER TABLE core.projects
ADD CONSTRAINT chk_projects_billing_cycle 
  CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime'));

ALTER TABLE core.projects
ADD CONSTRAINT chk_projects_pricing_plan
  CHECK (pricing_plan IN ('free', 'basic', 'premium', 'enterprise', 'custom'));

-- Comments
COMMENT ON COLUMN core.projects.price IS 'Project monthly/yearly price';
COMMENT ON COLUMN core.projects.currency IS 'Price currency (TRY, USD, EUR, GBP)';
COMMENT ON COLUMN core.projects.pricing_plan IS 'Pricing tier: free, basic, premium, enterprise, custom';
COMMENT ON COLUMN core.projects.billing_cycle IS 'Billing frequency: monthly, yearly, lifetime';

-- ============================================================================
-- STEP 8: ADD DEFAULT_CURRENCY TO TENANTS TABLE
-- ============================================================================

-- Add default_currency column to core.tenants
ALTER TABLE core.tenants 
ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) 
  REFERENCES cfg.currencies(code) 
  DEFAULT 'TRY';

-- Update existing tenants to use TRY
UPDATE core.tenants 
SET default_currency = 'TRY' 
WHERE default_currency IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE core.tenants 
ALTER COLUMN default_currency SET NOT NULL;

-- Index for quick currency lookup
CREATE INDEX IF NOT EXISTS idx_tenants_currency 
ON core.tenants(default_currency);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 009: Multi-Currency Support completed!';
  RAISE NOTICE '💱 Currencies: 4 (TRY, USD, EUR, GBP)';
  RAISE NOTICE '📊 Exchange Rates: 12 pairs initialized';
  RAISE NOTICE '🔧 Functions: get_latest_rate(), convert_currency()';
  RAISE NOTICE '🏢 Tenants: default_currency column added (TRY default)';
  RAISE NOTICE '📦 Projects: price, currency, pricing_plan, billing_cycle columns added';
END $$;

