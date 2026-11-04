-- V20__backfill_vouchers.sql
-- Chuyển voucher cũ sang trạng thái, nguồn và hạng tối thiểu

-- 1. status: enabled = false -> PAUSED; expires_at < now() -> ENDED; còn lại ACTIVE
UPDATE vouchers
SET status = CASE
    WHEN enabled = false THEN 'PAUSED'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'ENDED'
    ELSE 'ACTIVE'
END
WHERE status IS NULL;

-- 2. source NULL -> GENERAL
UPDATE vouchers
SET source = 'GENERAL'
WHERE source IS NULL;

-- 3. member_only = true -> min_tier = 'CHALLENGER', rồi member_only = false
UPDATE vouchers
SET min_tier = 'CHALLENGER',
    member_only = false
WHERE member_only = true;

-- 4. Đặt status, source NOT NULL với default
ALTER TABLE vouchers
    ALTER COLUMN status SET DEFAULT 'ACTIVE',
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN source SET DEFAULT 'GENERAL',
    ALTER COLUMN source SET NOT NULL;
