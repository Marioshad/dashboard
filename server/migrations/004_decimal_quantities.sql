-- Alter quantity column to allow decimal values
ALTER TABLE food_items ALTER COLUMN quantity TYPE DECIMAL(10, 3);