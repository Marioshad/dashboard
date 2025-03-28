-- Convert price column in food_items table from INTEGER to DECIMAL for direct price representation
ALTER TABLE food_items 
ALTER COLUMN price TYPE DECIMAL(10, 2);