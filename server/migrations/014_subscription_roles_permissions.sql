-- Migration 014: Update roles and permissions for subscription tiers

-- Add basic permissions if they don't exist
DO $$ BEGIN
  -- Check if basic_access permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'basic_access') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('basic_access', 'Basic access to application features', NOW());
  END IF;

  -- Check if food_tracking permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'food_tracking') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('food_tracking', 'Access to food tracking features', NOW());
  END IF;
END $$;

-- Add new tier-specific permissions
DO $$ BEGIN
  -- Check if smart_pantry_features permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'smart_pantry_features') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('smart_pantry_features', 'Access Smart Pantry tier features', NOW());
  END IF;

  -- Check if family_pantry_pro_features permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'family_pantry_pro_features') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('family_pantry_pro_features', 'Access Family Pantry Pro tier features', NOW());
  END IF;

  -- Check if share_pantry permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'share_pantry') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('share_pantry', 'Ability to share pantry with other users', NOW());
  END IF;

  -- Check if unlimited_items permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'unlimited_items') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('unlimited_items', 'No limit on number of tracked food items', NOW());
  END IF;

  -- Check if unlimited_receipt_scans permission exists
  IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'unlimited_receipt_scans') THEN
    INSERT INTO permissions (name, description, created_at)
    VALUES ('unlimited_receipt_scans', 'No limit on receipt scans per month', NOW());
  END IF;
END $$;

-- Create roles for tier-based access
DO $$ BEGIN
  -- Check if free_tier role exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'free_tier') THEN
    INSERT INTO roles (name, description, created_at, updated_at)
    VALUES ('free_tier', 'Free tier user with basic access', NOW(), NOW());
  END IF;

  -- Check if smart_pantry_tier role exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'smart_pantry_tier') THEN
    INSERT INTO roles (name, description, created_at, updated_at)
    VALUES ('smart_pantry_tier', 'Smart Pantry tier with enhanced features', NOW(), NOW());
  END IF;

  -- Check if family_pro_tier role exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'family_pro_tier') THEN
    INSERT INTO roles (name, description, created_at, updated_at)
    VALUES ('family_pro_tier', 'Family Pantry Pro tier with all features', NOW(), NOW());
  END IF;
END $$;

-- Assign permissions to roles with explicit error handling
DO $$ 
DECLARE
  free_role_id INTEGER;
  smart_role_id INTEGER;
  pro_role_id INTEGER;
  basic_access_id INTEGER;
  food_tracking_id INTEGER;
  smart_features_id INTEGER;
  pro_features_id INTEGER;
  share_pantry_id INTEGER;
  unlimited_items_id INTEGER;
  unlimited_scans_id INTEGER;
BEGIN
  -- Get role IDs
  SELECT id INTO free_role_id FROM roles WHERE name = 'free_tier';
  IF free_role_id IS NULL THEN
    RAISE EXCEPTION 'free_tier role not found';
  END IF;
  
  SELECT id INTO smart_role_id FROM roles WHERE name = 'smart_pantry_tier';
  IF smart_role_id IS NULL THEN
    RAISE EXCEPTION 'smart_pantry_tier role not found';
  END IF;
  
  SELECT id INTO pro_role_id FROM roles WHERE name = 'family_pro_tier';
  IF pro_role_id IS NULL THEN
    RAISE EXCEPTION 'family_pro_tier role not found';
  END IF;

  -- Get permission IDs
  SELECT id INTO basic_access_id FROM permissions WHERE name = 'basic_access';
  IF basic_access_id IS NULL THEN
    RAISE EXCEPTION 'basic_access permission not found';
  END IF;
  
  SELECT id INTO food_tracking_id FROM permissions WHERE name = 'food_tracking';
  IF food_tracking_id IS NULL THEN
    RAISE EXCEPTION 'food_tracking permission not found';
  END IF;
  
  SELECT id INTO smart_features_id FROM permissions WHERE name = 'smart_pantry_features';
  IF smart_features_id IS NULL THEN
    RAISE EXCEPTION 'smart_pantry_features permission not found';
  END IF;
  
  SELECT id INTO pro_features_id FROM permissions WHERE name = 'family_pantry_pro_features';
  IF pro_features_id IS NULL THEN
    RAISE EXCEPTION 'family_pantry_pro_features permission not found';
  END IF;
  
  SELECT id INTO share_pantry_id FROM permissions WHERE name = 'share_pantry';
  IF share_pantry_id IS NULL THEN
    RAISE EXCEPTION 'share_pantry permission not found';
  END IF;
  
  SELECT id INTO unlimited_items_id FROM permissions WHERE name = 'unlimited_items';
  IF unlimited_items_id IS NULL THEN
    RAISE EXCEPTION 'unlimited_items permission not found';
  END IF;
  
  SELECT id INTO unlimited_scans_id FROM permissions WHERE name = 'unlimited_receipt_scans';
  IF unlimited_scans_id IS NULL THEN
    RAISE EXCEPTION 'unlimited_receipt_scans permission not found';
  END IF;

  -- Delete existing role permissions for clean assignment
  DELETE FROM role_permissions WHERE role_id IN (free_role_id, smart_role_id, pro_role_id);

  -- Free tier gets basic access and food tracking
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES 
    (free_role_id, basic_access_id),
    (free_role_id, food_tracking_id);

  -- Smart tier gets everything from free plus smart features and unlimited items
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES 
    (smart_role_id, basic_access_id),
    (smart_role_id, food_tracking_id),
    (smart_role_id, smart_features_id),
    (smart_role_id, unlimited_items_id);

  -- Pro tier gets all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES 
    (pro_role_id, basic_access_id),
    (pro_role_id, food_tracking_id),
    (pro_role_id, smart_features_id),
    (pro_role_id, pro_features_id),
    (pro_role_id, share_pantry_id),
    (pro_role_id, unlimited_items_id),
    (pro_role_id, unlimited_scans_id);
END $$;