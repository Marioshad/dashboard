-- ==========================
-- FOOD_ITEMS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS food_items
(
    id         SERIAL PRIMARY KEY,
    name       TEXT                                NOT NULL,
    quantity   DECIMAL(10, 3)                      NOT NULL,
    unit       TEXT                                NOT NULL,
    location_id INTEGER                            NOT NULL REFERENCES locations(id),
    store_id INTEGER                               NOT NULL REFERENCES stores(id),
    receipt_id INTEGER                             NOT NULL REFERENCES receipts(id),
    expiry_date DATE                               NOT NULL,
    price      TYPE DECIMAL(10, 2),
    purchased  TIMESTAMP                           NOT NULL,
    user_id    INTEGER                             NOT NULL REFERENCES users(id),
    price_per_unit DECIMAL(10, 2),
    is_weight_based BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    normalized_name VARCHAR(255),
    original_name VARCHAR(255),
    normalization_confidence DECIMAL(5, 4),
    category VARCHAR(100),
    line_numbers INTEGER[];
);

-- Create indexes for performance
CREATE INDEX "food_items_receiptId_idx" ON "food_items"("receipt_id");
CREATE INDEX "idx_food_items_normalized_name" ON food_items(normalized_name);
CREATE INDEX "idx_food_items_category" ON food_items(category);
