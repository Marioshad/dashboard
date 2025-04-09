-- ==========================
-- PRODUCTS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS products
(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES tags(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX "idx_products_canonical_name" ON products(canonical_name);