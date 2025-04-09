-- ==========================
-- ITEM_NORMALIZATION TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS item_normalization (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
