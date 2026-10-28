-- Repair discounts already granted by older versions; never reprice existing orders.
-- Cancelled/expired orders without played visits returned their voucher legitimately.
INSERT INTO voucher_redemptions (voucher_id, order_id, account_id, discount_amount, redeemed_at)
SELECT v.id, o.id, o.customer_account_id,
       (o.metadata::jsonb->'voucherBenefit'->>'discount')::numeric, o.created_at
FROM orders o JOIN vouchers v ON upper(v.code)=upper(o.metadata::jsonb->'voucherBenefit'->>'code')
WHERE (o.metadata::jsonb->'voucherBenefit'->>'discount') ~ '^[0-9]+([.][0-9]+)?$'
  AND (o.status NOT IN ('CANCELLED','EXPIRED') OR EXISTS (
    SELECT 1 FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id
    WHERE b.order_id=o.id AND bs.completed_at IS NOT NULL))
ON CONFLICT (order_id) DO NOTHING;

-- The ledger is the source of truth for limits, including played cancelled orders.
UPDATE vouchers v SET used_count=(SELECT count(*) FROM voucher_redemptions r WHERE r.voucher_id=v.id);

-- A missing voucher definition cannot be reconstructed safely. Flag it for the desk.
UPDATE orders o SET metadata=(o.metadata::jsonb || jsonb_build_object('financialReview',
  coalesce(nullif(o.metadata::jsonb->>'financialReview',''), 'VOUCHER_LEDGER_REVIEW')))::text
WHERE o.metadata::jsonb->'voucherBenefit'->>'code' IS NOT NULL
  AND (o.status NOT IN ('CANCELLED','EXPIRED') OR EXISTS (
    SELECT 1 FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id
    WHERE b.order_id=o.id AND bs.completed_at IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM voucher_redemptions r WHERE r.order_id=o.id);
