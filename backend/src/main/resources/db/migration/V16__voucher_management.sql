-- V16__voucher_management.sql
-- Nâng cấp quản lý voucher, phân quyền Admin & Staff, mã cá nhân và điều kiện nâng cao

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS zone VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS valid_from_time TIME;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS valid_to_time TIME;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS valid_weekdays VARCHAR(50);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS assigned_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'GENERAL';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS feedback_id VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS min_tier VARCHAR(50);

-- Đồng bộ status theo enabled hiện tại
UPDATE vouchers 
SET status = CASE WHEN enabled = true THEN 'ACTIVE' ELSE 'PAUSED' END
WHERE status IS NULL OR status = 'ACTIVE';
