-- ==========================
-- NOTIFICATIONS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS notifications
(
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER                             NOT NULL REFERENCES users (id),
    type       TEXT                                NOT NULL,
    message    TEXT                                NOT NULL,
    read       BOOLEAN   DEFAULT FALSE             NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actor_id   INTEGER REFERENCES users (id)
);