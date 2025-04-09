-- ==========================
-- FOOD ITEMS - TAGS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS food_item_tags (
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (food_item_id, tag_id)
);