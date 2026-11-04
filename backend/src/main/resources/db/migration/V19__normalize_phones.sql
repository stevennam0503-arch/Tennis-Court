-- V19__normalize_phones.sql
-- Chuẩn hoá số điện thoại accounts.phone về chuẩn E.164 (+84xxxxxxxxx).
-- Xử lý trùng lặp an toàn theo từng bước tuần tự (tránh lỗi unique constraint khi cập nhật hàng loạt).

CREATE TEMP TABLE phone_norm ON COMMIT DROP AS
WITH cleaned AS (
    SELECT
        id,
        role,
        phone,
        created_at,
        CASE
            WHEN phone IS NULL OR TRIM(phone) = '' THEN ''
            WHEN REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g') ~ '^\+84[0-9]{9}$'
                THEN REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g')
            WHEN REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g') ~ '^84[0-9]{9}$'
                THEN '+' || REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g')
            WHEN REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g') ~ '^0[0-9]{9}$'
                THEN '+84' || SUBSTRING(REGEXP_REPLACE(phone, '[\s\-\.\(\)]+', '', 'g') FROM 2)
            ELSE ''
        END AS norm_phone,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_account_id = a.id) AS order_count
    FROM accounts a
),
ranked_customers AS (
    SELECT
        id,
        role,
        phone AS old_phone,
        norm_phone,
        ROW_NUMBER() OVER (
            PARTITION BY norm_phone
            ORDER BY order_count DESC, created_at ASC, id ASC
        ) AS rn
    FROM cleaned
    WHERE role = 'CUSTOMER' AND norm_phone <> ''
)
SELECT
    c.id,
    c.role,
    c.phone AS old_phone,
    c.norm_phone,
    COALESCE(r.rn, 1) AS rn
FROM cleaned c
LEFT JOIN ranked_customers r ON c.id = r.id;

-- (b) Ghi audit_logs cho các tài khoản khách bị trùng số
INSERT INTO audit_logs (id, actor, action, detail, created_at)
SELECT
    gen_random_uuid(),
    'SYSTEM_MIGRATION_V19',
    'PHONE_DUPLICATE_RESOLVED',
    'Số điện thoại ' || old_phone || ' sau chuẩn hoá ' || norm_phone || ' bị trùng với tài khoản khách hàng ưu tiên khác. Chuyển thành rỗng.',
    NOW()
FROM phone_norm
WHERE rn > 1;

-- (c) Xoá trắng số của các tài khoản trùng trước để giải phóng index unique
UPDATE accounts
SET phone = ''
WHERE id IN (SELECT id FROM phone_norm WHERE rn > 1);

-- (d) Cập nhật số chuẩn hoá cho các tài khoản giữ lại và tài khoản nhân viên
UPDATE accounts a
SET phone = p.norm_phone
FROM phone_norm p
WHERE a.id = p.id AND p.rn = 1;
