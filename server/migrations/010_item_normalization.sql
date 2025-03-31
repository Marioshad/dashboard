-- Migration to add normalized product names, categories, and improve weight-based item handling

-- Add normalizedName, originalName, and category fields to food_items
ALTER TABLE food_items 
ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS normalization_confidence DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS line_numbers INTEGER[];

-- Create a products reference table for normalization
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  canonical_name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES tags(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product aliases table for name variations
CREATE TABLE IF NOT EXISTS product_aliases (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL,
  language VARCHAR(50) DEFAULT 'en',
  store_id INTEGER REFERENCES stores(id),
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, alias, language, store_id)
);

-- Temporarily removing store-specific parser configuration until issue is fixed
-- ALTER TABLE stores
-- ADD COLUMN IF NOT EXISTS parser_type VARCHAR(100),
-- ADD COLUMN IF NOT EXISTS parser_config JSONB;

-- Update existing food items with null normalized names to use the name field
UPDATE food_items 
SET normalized_name = name
WHERE normalized_name IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_items_normalized_name ON food_items(normalized_name);
CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items(category);
CREATE INDEX IF NOT EXISTS idx_products_canonical_name ON products(canonical_name);
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON product_aliases(alias);

-- Create basic indexes for product names and aliases instead of gin indexes
-- which require the pg_trgm extension that might not be available
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias_text ON product_aliases(alias);

-- Add common food categories (fruit, vegetable, etc) if they don't exist in tags
DO $$
DECLARE
  categories TEXT[] := ARRAY['Fruits', 'Vegetables', 'Dairy', 'Meat', 'Bakery', 'Snacks', 
                            'Beverages', 'Cleaning', 'Personal Care', 'Canned Food', 'Frozen Food', 
                            'Condiments', 'Breakfast', 'Grains', 'Pet Supplies', 'Organic'];
  category TEXT;
BEGIN
  FOREACH category IN ARRAY categories
  LOOP
    -- Check if is_system column exists before using it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'is_system') THEN
      -- If is_system exists, use it in the query
      IF NOT EXISTS (SELECT 1 FROM tags WHERE name = category AND is_system = TRUE) THEN
        -- Check if userid column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'userid') THEN
          INSERT INTO tags (name, color, is_system, userid)
          VALUES (category, 
                  CASE 
                    WHEN category = 'Fruits' THEN '#10B981'
                    WHEN category = 'Vegetables' THEN '#84CC16'
                    WHEN category = 'Dairy' THEN '#3B82F6'
                    WHEN category = 'Meat' THEN '#EF4444'
                    WHEN category = 'Bakery' THEN '#8B5CF6'
                    WHEN category = 'Snacks' THEN '#F59E0B'
                    WHEN category = 'Beverages' THEN '#06B6D4'
                    WHEN category = 'Cleaning' THEN '#6B7280'
                    WHEN category = 'Personal Care' THEN '#EC4899'
                    WHEN category = 'Canned Food' THEN '#6366F1'
                    WHEN category = 'Frozen Food' THEN '#2563EB'
                    WHEN category = 'Condiments' THEN '#D97706'
                    WHEN category = 'Breakfast' THEN '#0369A1'
                    WHEN category = 'Grains' THEN '#65A30D'
                    WHEN category = 'Pet Supplies' THEN '#4B5563'
                    WHEN category = 'Organic' THEN '#059669'
                    ELSE '#6B7280'
                  END, 
                  TRUE, 
                  NULL);
        ELSE
          -- Fallback to user_id if that column exists
          INSERT INTO tags (name, color, is_system, user_id)
          VALUES (category, 
                  CASE 
                    WHEN category = 'Fruits' THEN '#10B981'
                    WHEN category = 'Vegetables' THEN '#84CC16'
                    WHEN category = 'Dairy' THEN '#3B82F6'
                    WHEN category = 'Meat' THEN '#EF4444'
                    WHEN category = 'Bakery' THEN '#8B5CF6'
                    WHEN category = 'Snacks' THEN '#F59E0B'
                    WHEN category = 'Beverages' THEN '#06B6D4'
                    WHEN category = 'Cleaning' THEN '#6B7280'
                    WHEN category = 'Personal Care' THEN '#EC4899'
                    WHEN category = 'Canned Food' THEN '#6366F1'
                    WHEN category = 'Frozen Food' THEN '#2563EB'
                    WHEN category = 'Condiments' THEN '#D97706'
                    WHEN category = 'Breakfast' THEN '#0369A1'
                    WHEN category = 'Grains' THEN '#65A30D'
                    WHEN category = 'Pet Supplies' THEN '#4B5563'
                    WHEN category = 'Organic' THEN '#059669'
                    ELSE '#6B7280'
                  END, 
                  TRUE, 
                  NULL);
        END IF;
      END IF;
    ELSE
      -- If is_system doesn't exist, check based on name only
      IF NOT EXISTS (SELECT 1 FROM tags WHERE name = category) THEN
        -- Handle the case where is_system column doesn't exist
        -- Adjust the INSERT statement to match the actual columns in the tags table
        -- Check if userid column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'userid') THEN
          INSERT INTO tags (name, color, userid)
          VALUES (category, 
                  CASE 
                    WHEN category = 'Fruits' THEN '#10B981'
                    WHEN category = 'Vegetables' THEN '#84CC16'
                    WHEN category = 'Dairy' THEN '#3B82F6'
                    WHEN category = 'Meat' THEN '#EF4444'
                    WHEN category = 'Bakery' THEN '#8B5CF6'
                    WHEN category = 'Snacks' THEN '#F59E0B'
                    WHEN category = 'Beverages' THEN '#06B6D4'
                    WHEN category = 'Cleaning' THEN '#6B7280'
                    WHEN category = 'Personal Care' THEN '#EC4899'
                    WHEN category = 'Canned Food' THEN '#6366F1'
                    WHEN category = 'Frozen Food' THEN '#2563EB'
                    WHEN category = 'Condiments' THEN '#D97706'
                    WHEN category = 'Breakfast' THEN '#0369A1'
                    WHEN category = 'Grains' THEN '#65A30D'
                    WHEN category = 'Pet Supplies' THEN '#4B5563'
                    WHEN category = 'Organic' THEN '#059669'
                    ELSE '#6B7280'
                  END,
                  NULL);
        ELSE
          -- Fallback to user_id if that column exists
          INSERT INTO tags (name, color, user_id)
          VALUES (category, 
                  CASE 
                    WHEN category = 'Fruits' THEN '#10B981'
                    WHEN category = 'Vegetables' THEN '#84CC16'
                    WHEN category = 'Dairy' THEN '#3B82F6'
                    WHEN category = 'Meat' THEN '#EF4444'
                    WHEN category = 'Bakery' THEN '#8B5CF6'
                    WHEN category = 'Snacks' THEN '#F59E0B'
                    WHEN category = 'Beverages' THEN '#06B6D4'
                    WHEN category = 'Cleaning' THEN '#6B7280'
                    WHEN category = 'Personal Care' THEN '#EC4899'
                    WHEN category = 'Canned Food' THEN '#6366F1'
                    WHEN category = 'Frozen Food' THEN '#2563EB'
                    WHEN category = 'Condiments' THEN '#D97706'
                    WHEN category = 'Breakfast' THEN '#0369A1'
                    WHEN category = 'Grains' THEN '#65A30D'
                    WHEN category = 'Pet Supplies' THEN '#4B5563'
                    WHEN category = 'Organic' THEN '#059669'
                    ELSE '#6B7280'
                  END,
                  NULL);
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Add Greek character support for product names and aliases
-- Make sure database has proper support for Greek characters
DO $$
BEGIN
  -- Check if the pg_trgm extension exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    -- Create the extension if it doesn't exist
    -- This requires superuser privileges; use only if you have permission
    -- CREATE EXTENSION pg_trgm;
    RAISE NOTICE 'The pg_trgm extension is recommended for better text search with Greek characters. Please ask your database administrator to install it.';
  END IF;
END $$;