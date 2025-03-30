-- Migration: 009_tags
-- Create tags and food_item_tags tables for managing food item categorization

-- Check if tables exists first
DO $$ 
BEGIN
    -- Create tags table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        CREATE TABLE tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(20) NOT NULL,
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create food_item_tags (many-to-many) linking table
        CREATE TABLE food_item_tags (
            food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (food_item_id, tag_id)
        );
        
        -- Insert default system tags
        INSERT INTO tags (name, color, is_system) VALUES
            ('Vegetables', '#4CAF50', TRUE),
            ('Fruits', '#FF9800', TRUE),
            ('Dairy', '#2196F3', TRUE),
            ('Meat', '#F44336', TRUE),
            ('Seafood', '#03A9F4', TRUE),
            ('Bakery', '#FFC107', TRUE),
            ('Canned Goods', '#607D8B', TRUE),
            ('Frozen Foods', '#9C27B0', TRUE),
            ('Beverages', '#795548', TRUE),
            ('Snacks', '#E91E63', TRUE),
            ('Cleaning', '#009688', TRUE),
            ('Personal Care', '#673AB7', TRUE),
            ('Organic', '#8BC34A', TRUE),
            ('Gluten-Free', '#CDDC39', TRUE);
    ELSE
        -- If the tables already exist but the is_system column is missing, add it
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'tags' AND column_name = 'is_system'
        ) THEN
            ALTER TABLE tags ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;
            
            -- Insert default system tags only if none exist yet
            IF NOT EXISTS (SELECT 1 FROM tags WHERE is_system = TRUE) THEN
                INSERT INTO tags (name, color, is_system) VALUES
                    ('Vegetables', '#4CAF50', TRUE),
                    ('Fruits', '#FF9800', TRUE),
                    ('Dairy', '#2196F3', TRUE),
                    ('Meat', '#F44336', TRUE),
                    ('Seafood', '#03A9F4', TRUE),
                    ('Bakery', '#FFC107', TRUE),
                    ('Canned Goods', '#607D8B', TRUE),
                    ('Frozen Foods', '#9C27B0', TRUE),
                    ('Beverages', '#795548', TRUE),
                    ('Snacks', '#E91E63', TRUE),
                    ('Cleaning', '#009688', TRUE),
                    ('Personal Care', '#673AB7', TRUE),
                    ('Organic', '#8BC34A', TRUE),
                    ('Gluten-Free', '#CDDC39', TRUE);
            END IF;
        END IF;
    END IF;
END $$;