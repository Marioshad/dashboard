-- Migration: 011_ensure_system_tags
-- This migration ensures that all required system tags exist
-- It's designed to be idempotent (can be run multiple times safely)

DO $$
DECLARE
    is_system_column_exists BOOLEAN;
    current_column_name TEXT;
BEGIN
    -- First, check if the tags table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        RAISE NOTICE 'Tags table does not exist yet, skipping system tags creation';
        RETURN;
    END IF;

    -- Check which version of the system tag column exists (is_system or issystem)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tags' AND column_name = 'is_system'
    ) INTO is_system_column_exists;

    IF is_system_column_exists THEN
        current_column_name := 'is_system';
    ELSE
        current_column_name := 'issystem';
    END IF;

    -- Log which column we're using
    RAISE NOTICE 'Using % as the system tag column for migration', current_column_name;

    -- Insert system tags using explicit IF NOT EXISTS checks, which is compatible
    -- with all PostgreSQL versions
    IF current_column_name = 'is_system' THEN
        -- Vegetables
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Vegetables' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Vegetables', '#10B981', TRUE);
        END IF;
        
        -- Fruits
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Fruits' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Fruits', '#F59E0B', TRUE);
        END IF;
        
        -- Dairy
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Dairy' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Dairy', '#3B82F6', TRUE);
        END IF;
        
        -- Meat
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Meat' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Meat', '#EF4444', TRUE);
        END IF;
        
        -- Fish
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Fish' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Fish', '#06B6D4', TRUE);
        END IF;
        
        -- Bakery
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Bakery' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Bakery', '#8B5CF6', TRUE);
        END IF;
        
        -- Canned Food
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Canned Food' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Canned Food', '#6366F1', TRUE);
        END IF;
        
        -- Frozen Food
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen Food' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Frozen Food', '#1E40AF', TRUE);
        END IF;
        
        -- Drinks
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Drinks' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Drinks', '#7C3AED', TRUE);
        END IF;
        
        -- Snacks
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Snacks' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Snacks', '#F97316', TRUE);
        END IF;
        
        -- Cleaning
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Cleaning' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Cleaning', '#6B7280', TRUE);
        END IF;
        
        -- Personal Care
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Personal Care' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Personal Care', '#EC4899', TRUE);
        END IF;
        
        -- Pet Supplies
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Pet Supplies' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Pet Supplies', '#9333EA', TRUE);
        END IF;
        
        -- Condiments
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Condiments' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Condiments', '#D97706', TRUE);
        END IF;
        
        -- Breakfast
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Breakfast' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Breakfast', '#0369A1', TRUE);
        END IF;
        
        -- Organic
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Organic' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Organic', '#059669', TRUE);
        END IF;
        
        -- Additional categories
        -- Grains
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Grains' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Grains', '#F59E0B', TRUE);
        END IF;
        
        -- Frozen
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Frozen', '#3B82F6', TRUE);
        END IF;
        
        -- Beverages
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Beverages' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Beverages', '#84CC16', TRUE);
        END IF;
        
        -- Seafood
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Seafood' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Seafood', '#06B6D4', TRUE);
        END IF;
        
        -- Canned Goods
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Canned Goods' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Canned Goods', '#607D8B', TRUE);
        END IF;
        
        -- Frozen Foods
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen Foods' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Frozen Foods', '#9C27B0', TRUE);
        END IF;
        
        -- Gluten-Free
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Gluten-Free' AND is_system = TRUE) THEN
            INSERT INTO tags (name, color, is_system) VALUES ('Gluten-Free', '#CDDC39', TRUE);
        END IF;
    ELSE
        -- Using the issystem column
        -- Vegetables
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Vegetables' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Vegetables', '#10B981', TRUE);
        END IF;
        
        -- Fruits
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Fruits' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Fruits', '#F59E0B', TRUE);
        END IF;
        
        -- Dairy
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Dairy' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Dairy', '#3B82F6', TRUE);
        END IF;
        
        -- Meat
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Meat' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Meat', '#EF4444', TRUE);
        END IF;
        
        -- Fish
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Fish' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Fish', '#06B6D4', TRUE);
        END IF;
        
        -- Bakery
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Bakery' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Bakery', '#8B5CF6', TRUE);
        END IF;
        
        -- Canned Food
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Canned Food' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Canned Food', '#6366F1', TRUE);
        END IF;
        
        -- Frozen Food
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen Food' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Frozen Food', '#1E40AF', TRUE);
        END IF;
        
        -- Drinks
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Drinks' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Drinks', '#7C3AED', TRUE);
        END IF;
        
        -- Snacks
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Snacks' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Snacks', '#F97316', TRUE);
        END IF;
        
        -- Cleaning
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Cleaning' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Cleaning', '#6B7280', TRUE);
        END IF;
        
        -- Personal Care
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Personal Care' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Personal Care', '#EC4899', TRUE);
        END IF;
        
        -- Pet Supplies
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Pet Supplies' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Pet Supplies', '#9333EA', TRUE);
        END IF;
        
        -- Condiments
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Condiments' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Condiments', '#D97706', TRUE);
        END IF;
        
        -- Breakfast
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Breakfast' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Breakfast', '#0369A1', TRUE);
        END IF;
        
        -- Organic
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Organic' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Organic', '#059669', TRUE);
        END IF;
        
        -- Additional categories
        -- Grains
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Grains' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Grains', '#F59E0B', TRUE);
        END IF;
        
        -- Frozen
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Frozen', '#3B82F6', TRUE);
        END IF;
        
        -- Beverages
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Beverages' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Beverages', '#84CC16', TRUE);
        END IF;
        
        -- Seafood
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Seafood' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Seafood', '#06B6D4', TRUE);
        END IF;
        
        -- Canned Goods
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Canned Goods' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Canned Goods', '#607D8B', TRUE);
        END IF;
        
        -- Frozen Foods
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Frozen Foods' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Frozen Foods', '#9C27B0', TRUE);
        END IF;
        
        -- Gluten-Free
        IF NOT EXISTS (SELECT 1 FROM tags WHERE name ILIKE 'Gluten-Free' AND issystem = TRUE) THEN
            INSERT INTO tags (name, color, issystem) VALUES ('Gluten-Free', '#CDDC39', TRUE);
        END IF;
    END IF;

    RAISE NOTICE 'System tags initialization completed';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during system tags initialization: %', SQLERRM;
END $$;