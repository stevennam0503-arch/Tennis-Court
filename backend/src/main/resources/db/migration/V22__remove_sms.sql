-- Bỏ hẳn kênh SMS: thông báo chỉ còn Email, trong ứng dụng (IN_APP) và banner.
DELETE FROM notifications WHERE channel = 'SMS';

UPDATE campaigns
SET channels = NULLIF(regexp_replace(regexp_replace(channels, 'SMS', '', 'g'), ',+', ',', 'g'), '')
WHERE channels LIKE '%SMS%';
UPDATE campaigns SET channels = trim(both ',' from channels) WHERE channels IS NOT NULL;
UPDATE campaigns SET channels = 'BANNER' WHERE channels IS NULL OR channels = '';

ALTER TABLE campaigns ALTER COLUMN channels SET DEFAULT 'EMAIL,BANNER';
ALTER TABLE accounts DROP COLUMN IF EXISTS notify_sms;

-- Mã OTP gửi qua SMS (đăng ký / đăng nhập / quên mật khẩu bằng SĐT) không còn dùng
DELETE FROM app_documents WHERE document_key LIKE 'otp:phone:REGISTER:%'
   OR document_key LIKE 'otp:phone:LOGIN:%'
   OR document_key LIKE 'otp:phone:RESET_PASSWORD:%';
