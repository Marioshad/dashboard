-- ==========================
-- APP_SETTINGS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS app_settings
(
    id          SERIAL PRIMARY KEY,
    require_2fa BOOLEAN   DEFAULT FALSE             NOT NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by  INTEGER REFERENCES users (id)
);

-- ✅ Insert default app settings (can stay here)
INSERT INTO app_settings (require_2fa)
SELECT FALSE
    WHERE NOT EXISTS (SELECT 1 FROM app_settings);