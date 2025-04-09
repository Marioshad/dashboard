-- ==========================
-- MIGRATION 013: SUBSCRIPTION TIERS
-- ==========================

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    max_items INTEGER NOT NULL,
    receipt_scans_per_month INTEGER NOT NULL,
    description TEXT NOT NULL,
    features JSONB NOT NULL,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);