-- ==========================
-- ROLE_PERMISSIONS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS role_permissions
(
    role_id       INTEGER NOT NULL REFERENCES roles (id),
    permission_id INTEGER NOT NULL REFERENCES permissions (id)
);