-- Migration 017: Clean up roles, keeping only the ones specified
-- Keep only: "Super Admin", "Admin", "User", "Smart Pantry User" and "Family Pro User"

-- First, we need to determine if we need to update any users with roles that will be deleted
-- and move them to the default User role
DO $$ 
DECLARE
  user_role_id INTEGER;
BEGIN
  -- Get the user role ID (id 3 is the standard User role from initial migration)
  SELECT id INTO user_role_id FROM roles WHERE id = 3;
  
  IF user_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find the standard User role with ID 3';
  END IF;

  -- Update any users with roles that will be deleted
  UPDATE users
  SET role_id = user_role_id
  WHERE role_id NOT IN (
    1, -- Superadmin
    2, -- Admin
    3, -- User
    265, -- smart_pantry_tier (Smart Pantry User)
    266  -- family_pro_tier (Family Pro User)
  );
END $$;

-- Delete role_permissions for the roles we're removing
DELETE FROM role_permissions 
WHERE role_id NOT IN (
  1, -- Superadmin
  2, -- Admin
  3, -- User
  265, -- smart_pantry_tier (Smart Pantry User)
  266  -- family_pro_tier (Family Pro User)
);

-- Now delete the unwanted roles
DELETE FROM roles 
WHERE id NOT IN (
  1, -- Superadmin
  2, -- Admin
  3, -- User
  265, -- smart_pantry_tier (Smart Pantry User)
  266  -- family_pro_tier (Family Pro User)
);

-- Standardize role names
UPDATE roles SET name = 'Smart Pantry User', description = 'Smart Pantry tier with enhanced features' WHERE id = 265;
UPDATE roles SET name = 'Family Pro User', description = 'Family Pantry Pro tier with all features' WHERE id = 266;

-- Recycle the role migration for future use
-- Modify the migration to only include the roles we want to keep
DO $$ BEGIN
  -- Create a log entry
  RAISE NOTICE 'Roles have been cleaned. Database now only contains Superadmin, Admin, User, Smart Pantry User, and Family Pro User roles.';
END $$;