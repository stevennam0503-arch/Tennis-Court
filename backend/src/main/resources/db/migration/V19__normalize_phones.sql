-- V19__normalize_phones.sql
-- Chuẩn hoá số điện thoại accounts.phone về chuẩn E.164 (+84xxxxxxxxx).
-- Xử lý trùng lặp an toàn (giữ tài khoản có đơn/tạo sớm nhất, bản trùng chuyển thành rỗng và ghi audit_logs).

WITH cleaned AS (
    SELECT
        id,
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
ranked AS (
    SELECT
        id,
        phone AS old_phone,
        norm_phone,
        ROW_NUMBER() OVER (
            PARTITION BY norm_phone
            ORDER BY order_count DESC, created_at ASC, id ASC
        ) as rn
    FROM cleaned
    WHERE norm_phone <> ''
)
INSERT INTO audit_logs (id, actor, action, detail, created_at)
SELECT
    gen_random_uuid(),
    'SYSTEM_MIGRATION_V19',
    'PHONE_DUPLICATE_RESOLVED',
    'Số điện thoại ' || old_phone || ' sau chuẩn hoá ' || norm_phone || ' bị trùng với tài khoản ưu tiên khác. Chuyển thành rỗng.',
    NOW()
FROM ranked
WHERE rn > 1;

WITH cleaned AS (
    SELECT
        id,
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
ranked AS (
    SELECT
        id,
        norm_phone,
        ROW_NUMBER() OVER (
            PARTITION BY norm_phone
            ORDER BY order_count DESC, created_at ASC, id ASC
        ) as rn
    FROM cleaned
    WHERE norm_phone <> ''
)
UPDATE accounts a
SET phone = CASE
    WHEN r.rn = 1 THEN r.norm_phone
    ELSE ''
END
FROM ranked r
WHERE a.id = r.id;
