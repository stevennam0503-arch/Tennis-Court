-- V18__loyalty.sql
-- Hạng thành viên (Loyalty Tiers), điểm thưởng (Reward Points), sổ điểm và thẻ VIP Lounge

-- 1. Nâng cấp bảng accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'ROOKIE';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tier_since TIMESTAMPTZ DEFAULT now();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS points_balance INT DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS lifetime_spend NUMERIC(14,2) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_referral_code ON accounts(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_tier ON accounts(tier);

-- 2. Sổ điểm (Loyalty Ledger) - Append only
CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    points INT NOT NULL,
    spend_amount NUMERIC(14,2),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    registration_id UUID,
    voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    note TEXT,
    created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_account ON loyalty_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_type ON loyalty_ledger(type);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_order ON loyalty_ledger(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_ledger_earn_order ON loyalty_ledger(type, order_id) WHERE type = 'EARN' AND order_id IS NOT NULL;

-- 3. Thẻ VIP Lounge (Grand Slam)
CREATE TABLE IF NOT EXISTS vip_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX IF NOT EXISTS idx_vip_cards_account ON vip_cards(account_id);
CREATE INDEX IF NOT EXISTS idx_vip_cards_code ON vip_cards(code);

-- 4. Nhật ký quét vào phòng chờ (VIP Lounge Visits)
CREATE TABLE IF NOT EXISTS lounge_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES vip_cards(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    staff_id UUID REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lounge_visits_card ON lounge_visits(card_id);

-- 5. Bổ sung cột lưu chiết khấu hạng và điểm vào đơn
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tier_discount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_discount NUMERIC(14,2) DEFAULT 0;
