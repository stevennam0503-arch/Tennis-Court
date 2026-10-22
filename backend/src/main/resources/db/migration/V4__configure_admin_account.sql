-- For nam-dev 931496f (UUID accounts schema, after V3).
-- One-time credential setup; preserve profile and invalidate existing sessions.
INSERT INTO accounts (id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
VALUES (
    gen_random_uuid(), 'Quản trị viên', 'admin@gmail.com', '',
    '$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW',
    'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, 0
)
ON CONFLICT (lower(email)) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    auth_version = accounts.auth_version + 1;
