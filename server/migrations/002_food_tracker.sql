-- Create locations table if not exists
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create food_items table if not exists
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    expiry_date DATE NOT NULL,
    price INTEGER,
    purchased TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create a default location for each user if none exists
INSERT INTO locations (name, type, user_id)
SELECT 'Home', 'home', u.id
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM locations l WHERE l.user_id = u.id
);