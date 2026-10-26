CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    min_order NUMERIC(12, 2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(12, 2),
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    usage_limit INT,
    used_count INT NOT NULL DEFAULT 0,
    per_user_limit INT DEFAULT 1,
    member_only BOOLEAN NOT NULL DEFAULT FALSE,
    new_user_only BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    discount_amount NUMERIC(12, 2) NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_voucher_redemptions_account ON voucher_redemptions(account_id);
CREATE INDEX idx_voucher_redemptions_voucher ON voucher_redemptions(voucher_id);

INSERT INTO vouchers (code, type, value, min_order, max_discount, usage_limit, per_user_limit, new_user_only, member_only, description)
VALUES
  ('WELCOME', 'FIXED', 50000, 100000, 50000, 500, 1, TRUE, FALSE, 'Giảm 50.000 đ cho khách hàng đặt sân lần đầu'),
  ('HE2026', 'FIXED', 50000, 150000, 50000, 1000, 2, FALSE, FALSE, 'Giảm 50.000 đ mùa hè sôi động 2026'),
  ('COURTLY50K', 'FIXED', 50000, 100000, 50000, 300, 1, FALSE, FALSE, 'Voucher tri ân 50.000 đ'),
  ('VIP10', 'PERCENT', 10, 200000, 100000, 1000, 5, FALSE, TRUE, 'Giảm 10% (tối đa 100k) dành riêng cho hội viên'),
  ('FLASH25', 'PERCENT', 25, 100000, 150000, 200, 1, FALSE, FALSE, 'Ưu đãi Giờ Vàng giảm 25%');
