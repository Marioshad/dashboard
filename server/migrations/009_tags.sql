-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT '#3B82F6',
  userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
  isSystem BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name, userId)
);

-- Create food_items_tags join table for many-to-many relationship
CREATE TABLE IF NOT EXISTS food_items_tags (
  foodItemId INTEGER REFERENCES food_items(id) ON DELETE CASCADE,
  tagId INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (foodItemId, tagId)
);

-- Insert default system tags
INSERT INTO tags (name, color, isSystem) VALUES 
('Vegetables', '#10B981', TRUE),
('Fruits', '#F59E0B', TRUE),
('Dairy', '#3B82F6', TRUE),
('Meat', '#EF4444', TRUE),
('Fish', '#06B6D4', TRUE),
('Bakery', '#8B5CF6', TRUE),
('Canned Food', '#6366F1', TRUE),
('Frozen Food', '#1E40AF', TRUE),
('Drinks', '#7C3AED', TRUE),
('Snacks', '#F97316', TRUE),
('Cleaning', '#6B7280', TRUE),
('Personal Care', '#EC4899', TRUE),
('Pet Supplies', '#9333EA', TRUE),
('Condiments', '#D97706', TRUE),
('Breakfast', '#0369A1', TRUE),
('Organic', '#059669', TRUE);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_food_items_tags_foodItemId ON food_items_tags(foodItemId);
CREATE INDEX IF NOT EXISTS idx_food_items_tags_tagId ON food_items_tags(tagId);