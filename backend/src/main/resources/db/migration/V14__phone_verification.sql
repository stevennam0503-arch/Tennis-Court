-- V14__phone_verification.sql
-- Chuẩn hóa số điện thoại, hỗ trợ đăng ký bằng SĐT và xác thực OTP qua SMS

-- 1. Chuẩn hóa số điện thoại hiện có trong accounts: chuyển định dạng 09... sang +849...
UPDATE accounts
SET phone = '+84' || substring(phone from 2)
WHERE phone ~ '^0[0-9]{9}$';

-- 2. Email trở thành tùy chọn, bổ sung mốc thời gian xác thực SĐT và Email
ALTER TABLE accounts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 3. Đánh dấu đã xác thực cho các tài khoản hiện có sẵn số điện thoại / email
UPDATE accounts 
SET phone_verified_at = NOW() 
WHERE phone IS NOT NULL AND phone <> '';

UPDATE accounts 
SET email_verified_at = NOW() 
WHERE email IS NOT NULL AND email <> '';

-- 4. Unique index cho số điện thoại của khách hàng (loại trừ chuỗi rỗng)
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_phone 
ON accounts(phone) 
WHERE phone IS NOT NULL AND phone <> '' AND role = 'CUSTOMER';
