-- V21__vouchers_member_only_nullable.sql
-- Cho phép member_only nhận NULL và mặc định false để tương thích với baseline.json

ALTER TABLE vouchers ALTER COLUMN member_only DROP NOT NULL;
ALTER TABLE vouchers ALTER COLUMN member_only SET DEFAULT false;
UPDATE vouchers SET member_only = false WHERE member_only IS NULL;
