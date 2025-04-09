-- ==========================
-- LOCATIONS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS locations
(
    id         SERIAL PRIMARY KEY,
    name       TEXT                                NOT NULL,
    type       TEXT                                NOT NULL,
    user_id    INTEGER                             NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==========================
-- DEFAULT LOCATION SEEDING
-- ==========================
-- ✅ Insert default location "Home" for each user if they don't have one
INSERT INTO locations (name, type, user_id)
SELECT 'Home', 'home', u.id
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM locations l WHERE l.user_id = u.id
);