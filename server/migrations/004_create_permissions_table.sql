-- ==========================
-- PERMISSIONS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS permissions
(
    id          SERIAL PRIMARY KEY,
    name        TEXT                                NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at  TIMESTAMP
);