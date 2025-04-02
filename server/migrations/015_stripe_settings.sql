-- Add Stripe settings fields to app_settings table
ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS stripe_smart_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_pro_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_smart_monthly_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_smart_yearly_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_pro_monthly_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_pro_yearly_price_id TEXT;

-- Ensure we have at least one app_settings record
INSERT INTO app_settings (id, require_2fa, updated_at)
SELECT 1, false, NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);