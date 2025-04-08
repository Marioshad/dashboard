-- ==========================
-- PRODUCT_ALIASES TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS product_aliases
(
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    store_id INTEGER REFERENCES stores(id),
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id), -- who created the alias
    UNIQUE (product_id, alias, language, store_id)
    );

-- Create indexes for performance
CREATE INDEX idx_product_aliases_alias ON product_aliases(alias);

-- Add Greek character support for product names and aliases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    -- This requires superuser privileges; only use if permitted
    -- CREATE EXTENSION pg_trgm;
    RAISE NOTICE 'The pg_trgm extension is recommended for better text search with Greek characters. Please ask your database administrator to install it.';
END IF;
END $$ LANGUAGE plpgsql;
