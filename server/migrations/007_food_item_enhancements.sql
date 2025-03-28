-- Add weight-based item support and price per unit to food_items table
ALTER TABLE food_items 
ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS is_weight_based BOOLEAN DEFAULT FALSE;

-- Add receipt language column to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS language TEXT;