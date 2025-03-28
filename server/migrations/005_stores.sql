-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  fax TEXT,
  vat_number TEXT,
  tax_id TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create unique index on store name, location and user_id
CREATE UNIQUE INDEX IF NOT EXISTS store_name_location_user_idx ON stores (name, location, user_id);

-- Add store_id to food_items table
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Note: No data migration needed since this is a new column