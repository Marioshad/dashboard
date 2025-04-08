-- ==========================
-- USERS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS users
(
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    bio TEXT,
    avatar_url TEXT,
    role_id INTEGER,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    email_notifications BOOLEAN DEFAULT TRUE,
    web_notifications BOOLEAN DEFAULT TRUE,
    mention_notifications BOOLEAN DEFAULT TRUE,
    follow_notifications BOOLEAN DEFAULT TRUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',

    subscription_tier TEXT DEFAULT '''free''',
    receipt_scans_used INTEGER DEFAULT 0,
    receipt_scans_limit INTEGER DEFAULT 3,
    max_items INTEGER DEFAULT 50,
    current_billing_period_start TIMESTAMP WITH TIME ZONE,
    current_billing_period_end TIMESTAMP WITH TIME ZONE,

    currency TEXT DEFAULT 'EUR',
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

-- ================================
-- AUTO-VERIFY ADMIN USERS TRIGGER
-- ================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION verify_admin_users()
    RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role_id IS NOT NULL AND
       NEW.role_id = (SELECT id FROM roles WHERE name = 'admin' LIMIT 1) THEN
        NEW.email_verified := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Drop any existing trigger to avoid duplicates
DROP TRIGGER IF EXISTS verify_admin_on_update ON users;

-- Step 3: Create the new trigger
CREATE TRIGGER verify_admin_on_update
    BEFORE UPDATE ON users
    FOR EACH ROW
EXECUTE FUNCTION verify_admin_users();
