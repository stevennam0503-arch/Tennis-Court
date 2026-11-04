-- V17__campaigns.sql
-- Bảng quản lý chiến dịch khuyến mãi (Promotional Campaigns)

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    audience VARCHAR(50) DEFAULT 'ALL',
    audience_filter JSONB,
    channels VARCHAR(100) DEFAULT 'EMAIL,SMS,BANNER',
    message_title VARCHAR(255),
    message_body TEXT,
    banner_text TEXT,
    created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
    budget_limit NUMERIC(14,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(starts_at, ends_at);
