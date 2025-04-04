-- Migration for email verification system

-- Add email verification fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;

-- Add new permissions for email verification
INSERT INTO permissions (name, description)
VALUES 
  ('manage_account', 'Manage account and profile settings'),
  ('create_content', 'Create new items, locations, stores, and upload receipts')
ON CONFLICT (name) DO NOTHING;

-- Create a new role for unverified users
INSERT INTO roles (name, description)
VALUES ('unverified_user', 'Newly registered user with limited access until email is verified')
ON CONFLICT (name) DO NOTHING;

-- Assign appropriate permissions to unverified users (they can only manage their account)
-- First ensure the roles exist
INSERT INTO roles (name, description)
VALUES 
  ('user', 'Regular user with standard permissions'),
  ('unverified_user', 'Newly registered user with limited access until email is verified')
ON CONFLICT (name) DO NOTHING;

-- Now assign permissions with explicit checks to avoid nulls
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'unverified_user' AND p.name = 'manage_account'
ON CONFLICT DO NOTHING;

-- Add 'create_content' permission to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user' AND p.name = 'create_content'
ON CONFLICT DO NOTHING;

-- Upgrade existing users to have email_verified = TRUE
UPDATE users SET email_verified = TRUE;

-- Add a trigger to automatically verify admin users
CREATE OR REPLACE FUNCTION verify_admin_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id = (SELECT id FROM roles WHERE name = 'admin') THEN
    NEW.email_verified := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatically verifying admin users
DROP TRIGGER IF EXISTS verify_admin_on_update ON users;
CREATE TRIGGER verify_admin_on_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION verify_admin_users();