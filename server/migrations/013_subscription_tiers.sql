-- Migration 013: Add subscription tier functionality

-- First, check if subscription_tiers table exists and create it if not
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscription_tiers') THEN
    CREATE TABLE subscription_tiers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL, -- free, smart, pro
      price_monthly DECIMAL(10,2) NOT NULL,
      price_yearly DECIMAL(10,2) NOT NULL,
      max_items INTEGER NOT NULL,
      receipt_scans_per_month INTEGER NOT NULL,
      max_shared_users INTEGER NOT NULL,
      description TEXT NOT NULL,
      features JSONB NOT NULL,
      stripe_price_id_monthly TEXT,
      stripe_price_id_yearly TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    
    -- Insert default subscription tiers
    INSERT INTO subscription_tiers 
      (tier, name, price_monthly, price_yearly, max_items, receipt_scans_per_month, max_shared_users, description, features)
    VALUES
      ('free', 'Basic Pantry', 0, 0, 50, 3, 1, 'Free plan for casual users and small households', 
       '[
          "Track up to 50 items",
          "Receipt scanning up to 3 times per month",
          "Expiration reminders (email or in-app)",
          "Manual grocery input",
          "Simple shopping list",
          "Basic analytics: estimated savings / waste",
          "1 shared user/device",
          "Limited categories"
        ]'::jsonb
      ),
      ('smart', 'Smart Pantry', 4.99, 49, -1, 20, 3, 'For organized households looking to save money', 
       '[
          "Unlimited items",
          "Receipt scanning up to 20 times per month",
          "Smart reminders (customizable thresholds)",
          "Auto-sorting food categories",
          "AI-powered suggestions: \"Use These Soon\" recipes",
          "Smart shopping list based on inventory + history",
          "Household sharing (up to 3 users)",
          "Export pantry data (PDF/CSV)",
          "Gamification: track waste reduction over time"
        ]'::jsonb
      ),
      ('pro', 'Family Pantry Pro', 9.99, 99, -1, -1, 6, 'For families, meal planners, and power users', 
       '[
          "Everything in Smart Pantry",
          "Share with up to 6 users/devices",
          "Meal planning calendar",
          "Barcode scanner or voice entry",
          "Pantry sync & cloud backup",
          "Pantry zones (fridge, freezer, garage, etc.)",
          "Advanced analytics (food waste %, savings by category)",
          "Priority email/chat support"
        ]'::jsonb
      );
  END IF;
END $$;

-- Add subscription-related fields to users table if they don't exist
DO $$ 
DECLARE
   col_exists BOOLEAN;
BEGIN
   -- Check if subscription_tier column exists in users table
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscription_tier'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
   END IF;

   -- Check if receipt_scans_used column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'receipt_scans_used'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN receipt_scans_used INTEGER DEFAULT 0;
   END IF;

   -- Check if receipt_scans_limit column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'receipt_scans_limit'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN receipt_scans_limit INTEGER DEFAULT 3;
   END IF;

   -- Check if max_items column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'max_items'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN max_items INTEGER DEFAULT 50;
   END IF;

   -- Check if max_shared_users column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'max_shared_users'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN max_shared_users INTEGER DEFAULT 1;
   END IF;

   -- Check if current_billing_period_start column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'current_billing_period_start'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN current_billing_period_start TIMESTAMP WITH TIME ZONE;
   END IF;

   -- Check if current_billing_period_end column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'current_billing_period_end'
   ) INTO col_exists;
   
   IF NOT col_exists THEN
      ALTER TABLE users ADD COLUMN current_billing_period_end TIMESTAMP WITH TIME ZONE;
   END IF;
END $$;

-- Create shared pantry users table for premium users sharing their pantry
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'shared_pantry_users') THEN
    CREATE TABLE shared_pantry_users (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      shared_with_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT owner_shared_idx UNIQUE (owner_id, shared_with_id)
    );
  END IF;
END $$;