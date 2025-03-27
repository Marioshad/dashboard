-- Add currency field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';