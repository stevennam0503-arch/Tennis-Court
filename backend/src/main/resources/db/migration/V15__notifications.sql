-- V15__notifications.sql
-- Bảng hàng đợi thông báo (outbox) đa kênh và cấu hình nhận thông báo của khách hàng

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    campaign_id UUID,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(255),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dedupe_key VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_account_created ON notifications(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT TRUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN DEFAULT TRUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;
