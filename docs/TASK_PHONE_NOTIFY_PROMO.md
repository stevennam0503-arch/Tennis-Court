# Giao việc: Xác thực số điện thoại, thông báo nhắc lịch / nhắc thanh toán, voucher & chiến dịch khuyến mãi, xử lý feedback đánh giá thấp, hạng thành viên & tích điểm (thay gói hội viên trả phí)

> Tài liệu giao cho AI agent (hoặc lập trình viên). Làm trên bản mới nhất của nhánh `nam-dev` (commit `97bc43b` trở đi). Đọc hết trước khi code; chỉ làm trong phạm vi mục 4. Làm theo thứ tự P1 → P2 → P3; mỗi mục là một commit riêng.
>
> **Nguyên tắc chung:** làm theo cách doanh nghiệp thật đang vận hành (ghi ở phần "Cách làm" của từng mục). Mọi kênh gửi ra ngoài (SMS, email) phải chạy được ở 2 chế độ:
> - **thật**: gửi qua Gmail SMTP hoặc nhà cung cấp SMS;
> - **demo**: không gửi ra ngoài, chỉ ghi log và hiện trong màn hình quản trị.
>
> Chế độ do biến môi trường quyết định. Không hard-code khóa bí mật.

## 1. Mục tiêu

1. **Đăng ký bằng số điện thoại có xác thực OTP qua SMS.** Đăng nhập được bằng số điện thoại hoặc email. Email trở thành tùy chọn và được xác thực sau.
2. **Thông báo tự động cho khách** qua email (Gmail thật) và/hoặc SMS:
   - **Nhắc lịch:** 24 giờ và 2 giờ trước giờ chơi.
   - **Nhắc thanh toán:** khi đơn giữ chỗ sắp hết hạn, khi đơn còn nợ sau giờ chơi, và khi phát sinh tiền phải thu thêm sau đổi lịch hoặc gia hạn.
3. **Admin và staff tạo được voucher và chiến dịch khuyến mãi.**
   - Staff bị giới hạn quyền; vượt hạn mức thì phải chờ admin duyệt.
   - Chiến dịch có thể gửi tới nhóm khách đã đồng ý nhận quảng cáo.
4. **Feedback gắn với đơn.** Đánh giá thấp (≤ 3 sao) thành việc cần xử lý. Khi xử lý, admin hoặc staff có nút **"Tặng voucher"** để bù cho khách: mã cá nhân, gửi tới khách qua email/SMS và hiện trong tài khoản của khách.
5. **Tài khoản demo:** giữ 2 tài khoản sạch hiện có và thêm 2 tài khoản khách thật của chủ dự án (xem P0), để nhận được email và SMS thật khi demo.
6. **Bỏ hoàn toàn gói hội viên trả phí (Club / Plus).** Thay bằng **hạng thành viên miễn phí theo chi tiêu** (Rookie → Challenger → Masters → Grand Slam) và **điểm thưởng**. Điểm dùng để trừ tiền sân hoặc đổi dịch vụ miễn phí (xem P2-c). Dữ liệu demo cho phần này tạo mới hoàn toàn, không chuyển đổi từ dữ liệu membership cũ.

## 2. Bối cảnh (đã kiểm chứng trong code ngày 04/11/2026)

- **Stack:** Spring Boot 3.5 / Java 17, PostgreSQL 16, Flyway V1–V13 (migration mới bắt đầu từ `V14__`), React 19 + Vite. Chạy bằng `docker compose up -d --build` (`compose.yaml`).
- **Tài khoản (`accounts`):** cột `phone varchar NOT NULL` đã có, nhưng không unique và không được xác thực.
  - Đăng ký nằm ở `AuthService.java`, `action == "register"` (khoảng dòng 233–290): bắt buộc email; phone chỉ kiểm định dạng `^0[0-9]{9}$`.
- **OTP hiện tại** (`AuthService.java`):
  - Chỉ gửi qua email: `EmailService.sendActivationEmail`.
  - Lưu dạng HMAC (`hashOtp`) trong `app_documents`, khóa `otp:activation:<email>`, sống 15 phút, đếm số lần nhập sai.
  - Khi `DEMO_MODE=true`, API trả kèm `devCode` để giao diện hiện sẵn mã OTP.
- **Email:** `MailConfig.java` và `EmailService.java` đã gửi được SMTP. Cấu hình trong `application.yml` → `courtly.mail.*`, lấy từ `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`. Hiện `.env.example` **chưa** liệt kê các biến này.
- **Chưa có SMS** dưới bất kỳ hình thức nào.
- **Thông báo hiện tại** chỉ là chuông trong web, tính ở frontend từ danh sách đơn:
  - `frontend/src/pages/NotificationsPage.jsx`
  - `frontend/src/guest/Layout.jsx`, khoảng dòng 40–140
  - Không có gì gửi ra ngoài web.
- **Job định kỳ đã có:** `OrderService` có `@Scheduled(fixedDelayString = "${courtly.expiry-interval-ms:30000}")` để nhả đơn hết hạn giữ chỗ; `EmailService` có job dọn log lúc 3 giờ sáng.
- **Voucher:**
  - Bảng `vouchers` (V9) đã đủ trường: `type` PERCENT/FIXED, `value`, `min_order`, `max_discount`, `starts_at`, `expires_at`, `usage_limit`, `used_count`, `per_user_limit`, `member_only`, `new_user_only`, `enabled`, `description`.
  - Bảng `voucher_redemptions` ghi mỗi lần dùng, mỗi đơn tối đa một voucher (`order_id` unique).
  - `VoucherService.java` đã tính, áp và hoàn voucher.
  - Từ commit `f51a36c`, voucher được tính **sau** ưu đãi hội viên.
  - **Chưa có API hay màn hình nào để tạo, sửa voucher**; 5 voucher hiện có đều được seed bằng SQL.
- **Phân quyền:** dùng `@PreAuthorize("hasRole('ADMIN')")` (xem `CatalogController.java`). Có 3 vai trò: ADMIN, STAFF, CUSTOMER. **Không** thêm vai trò mới.
- **Dữ liệu demo:** reset bằng `.\reset-demo.ps1` → `DemoResetService`.
  - Tài khoản demo sạch: `demo.hoivien@gmail.com`, `demo.khach@gmail.com`, mật khẩu `123456`.
  - Danh sách tài khoản được giữ lại khi reset: `DemoResetService.java:92`.
  - Tài khoản mẫu được chèn quanh dòng 100–110.
  - Membership mẫu nằm quanh dòng 477–520.
- **Gói hội viên trả phí hiện tại** (sẽ bỏ ở P2-c):
  - Backend `MembershipService.java`:
    - gói Club / Plus trong `membership-plan:`;
    - membership của khách trong `membership:<accountId>`;
    - phiếu thu trong `membership-payment:`;
    - tính giảm giá: `discountPercent` cho sân thường, `vipDiscountPercent` cho sân VIP (khoảng dòng 210–250);
    - `advanceDays`, lượt đổi lịch miễn phí (`consumeChange`), `checkWindow`.
  - Controller `MembershipController.java`.
  - Frontend:
    - admin: `pages/MembershipAdminPage.jsx`;
    - khách: `pages/MembershipPage.jsx`, `pages/MyMembership.jsx`, route `/membership`;
    - banner hội viên trong `guest/Portal.jsx`;
    - dòng "Ưu đãi hội viên" trong khối tiền ở `guest/Booking.jsx`.
  - Báo cáo: ô "Thu phí hội viên" trong `PaymentsPage.jsx` và `ReportsPage.jsx`.
  - Voucher: cột `member_only`, ví dụ mã `VIP10`.
  - Phòng chờ: hiện chỉ là mô tả tiện ích "VIP Lounge" trong gói Plus, chưa có kiểm soát ra vào.
- **Feedback:**
  - Lưu trong `app_documents`, khóa `feedback:<id>`, gồm `accountId`, `displayName`, `rating`, `message`, `topic`, `publishConsent`, `reply`, `repliedAt`, trạng thái hiển thị.
  - Xử lý ở `ContentService.java` (khoảng dòng 100–290).
  - Khách gửi ở `/feedback` (`frontend/src/guest/Content.jsx`, khoảng dòng 1150–1210).
  - Admin trả lời ở menu "Nội dung & feedback" → "Xem & trả lời" (`frontend/src/pages/ContentAdminPage.jsx`).
  - **Feedback hiện không gắn với đơn nào.** STAFF không thấy menu này.

## 3. Quy tắc nghiệp vụ giữ nguyên

- Giữ chỗ 5 phút; cọc 50% tính trên tiền sân sau ưu đãi; hoàn tiền 100% / 50% / 0% theo các mốc ≥ 24h / 12–24h / < 12h; chỉ ADMIN được hoàn tiền.
- Thứ tự tính giá (cập nhật theo P2-c): giá sân → **giảm theo hạng thành viên** → voucher (một voucher mỗi đơn) → **trừ điểm thưởng** (tối đa 50% tiền sân còn lại) → không âm. Phí trọng tài không được giảm. Cọc 50% tính trên tiền sân sau tất cả các khoản giảm.
- Check-in sớm tối đa 30 phút; ngoài khung giờ thì phải có lý do ngoại lệ.

## 4. Việc cần làm

### P0. Tài khoản demo (làm trước, các mục sau dùng để kiểm tra)

**Giữ** `demo.hoivien@gmail.com` và `demo.khach@gmail.com`. **Thêm** 2 tài khoản khách hàng vào seed của `DemoResetService`. Hạng, điểm, ngày sinh và lịch sử chi tiêu của cả 4 tài khoản được tạo mới theo bảng ở P2-c, mục 11.

| Email | Mật khẩu | Số điện thoại | Ghi chú |
|---|---|---|---|
| `kietdlv@gmail.com` | `123456` | `0769496289` (lưu `+84769496289`) | Khách thật của chủ dự án |
| `phuongmaiphanqn3@gmail.com` | `123456` | `0377035664` (lưu `+84377035664`) | Khách thật của chủ dự án |

**Yêu cầu:**

1. Đây là **email và số điện thoại thật của chủ dự án**, nên sau reset hai tài khoản này:
   - **không** có đơn đang mở, đơn sắp tới, nợ, feedback hay thông báo nào;
   - chỉ có các đơn **đã hoàn tất và đã thu đủ trong quá khứ** do P2-c tạo để có lịch sử chi tiêu, cùng voucher do chương trình hạng phát (quà lên hạng, sinh nhật);
   - có `phone_verified_at`, `email_verified_at`, `marketing_consent = true` (các cột tạo ở P1-a và P1-b);
   - dùng UUID cố định trong seed, giống cách đặt `NAM_ID`.
2. Họ tên: tạm đặt "Khách demo Kiệt" và "Khách demo Phương Mai"; chủ dự án sẽ tự sửa nếu cần. **Không** tự suy ra họ tên đầy đủ.
3. Thêm hai email vào danh sách giữ lại ở `DemoResetService.java:92`. Reset phải xóa mọi dữ liệu phát sinh của 2 tài khoản này, kể cả `notifications`, voucher cá nhân và feedback.
4. **Chống gửi nhầm:**
   - Reset và job seed **không** được tạo thông báo hay gửi email/SMS tới bất kỳ tài khoản nào.
   - Chỉ gửi khi có thao tác thật trong lúc demo.
   - Khi `NOTIFY_MODE=LIVE`, chỉ cho phép gửi ra ngoài tới danh sách `NOTIFY_ALLOWLIST` (biến môi trường, mặc định là 2 email và 2 số trên). Số hoặc email khác ghi `SKIPPED (not allowlisted)`, để dữ liệu mẫu không bao giờ gửi tới người lạ.
   - Khi vận hành thật thì để trống allowlist, nghĩa là gửi cho mọi người.
5. Cập nhật bảng tài khoản trong `docs/KICH_BAN_DEMO_4_LUONG.md` và trang hướng dẫn demo.

**Kiểm tra:** sau reset, đăng nhập được bằng cả email và số điện thoại của 2 tài khoản mới. Cả hai không có đơn đang mở và không có nợ. Hạng và điểm đúng như bảng ở P2-c.

### P1-a. Đăng ký và đăng nhập bằng số điện thoại, xác thực OTP qua SMS

**Cách làm theo doanh nghiệp thật** (giống app đặt sân, ví điện tử, gọi xe ở Việt Nam):
- Số điện thoại là định danh chính và phải được xác minh bằng OTP SMS trước khi tạo tài khoản.
- Email là tùy chọn, xác minh sau, dùng cho hóa đơn và thông báo.
- OTP có giới hạn gửi lại và số lần nhập để chống spam và tốn phí SMS.

**Yêu cầu:**

1. **Tầng gửi SMS** (`service/sms/`):
   - Interface `SmsGateway { SendResult send(String e164Phone, String message, String purpose); }`
   - Hai bản cài đặt:
     - `LogSmsGateway`: chế độ demo, chỉ ghi log và lưu vào lịch sử gửi (xem P1-b).
     - Một nhà cung cấp thật, chọn bằng biến `SMS_PROVIDER`:
       - `TWILIO`: dùng Twilio Verify, dễ xin tài khoản dùng thử để demo.
       - `ESMS`: eSMS.vn, có brandname, phù hợp vận hành thật tại Việt Nam.
     - Làm sẵn ít nhất một nhà cung cấp; nhà còn lại để TODO, có interface rõ ràng.
   - Biến môi trường mới, bổ sung cả vào `.env.example` kèm chú thích:
     `SMS_PROVIDER=LOG|TWILIO|ESMS`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER` (brandname hoặc số gửi), `TWILIO_VERIFY_SID`.
   - **Không** commit khóa thật.
2. **Chuẩn hóa số điện thoại:**
   - Nhận các dạng `09xxxxxxxx`, `+849xxxxxxxx`, `849xxxxxxxx`.
   - Lưu theo E.164 (`+849xxxxxxxx`) và hiển thị dạng `09xx xxx xxx`.
   - Viết một hàm dùng chung cho cả backend và frontend.
3. **Luồng đăng ký mới** (`AuthService`):
   - Bước 1: `POST /api/auth/phone/send-otp { phone, purpose: "REGISTER" }`. Kiểm tra số chưa có tài khoản, rồi gửi OTP 6 số.
   - Bước 2: `POST /api/auth/phone/verify { phone, code }`. Trả về `phoneToken`, sống 10 phút, ký HMAC.
   - Bước 3: `POST /api/auth/register { phoneToken, name, password, email? }`. Tạo tài khoản `ACTIVE` với `phone_verified_at = now()`.
     - Nếu có email: gửi link hoặc OTP xác minh email (dùng lại `EmailService`), lưu `email_verified_at` khi xác minh xong.
   - Giữ luồng đăng ký bằng email cũ cho khách tại quầy, do staff tạo.
4. **Đăng nhập:** ô "Email hoặc số điện thoại". Có thêm lựa chọn "Đăng nhập bằng mã OTP" (purpose `LOGIN`). Quên mật khẩu: gửi OTP qua SMS nếu số đã xác thực, còn lại gửi qua email.
5. **Chống lạm dụng:**
   - OTP sống 5 phút, tối đa 5 lần nhập sai.
   - Gửi lại sau 60 giây.
   - Tối đa 5 OTP / số / giờ và 10 OTP / IP / giờ.
   - Lưu hash, không lưu mã gốc. Dùng lại kiểu lưu `app_documents` với khóa `otp:phone:<purpose>:<e164>`.
   - Thông báo lỗi chung chung để không lộ số nào đã có tài khoản; riêng đăng ký được báo "Số đã có tài khoản, hãy đăng nhập".
6. **Migration `V14__phone_verification.sql`:**
   - Thêm `phone_verified_at timestamptz`, `email_verified_at timestamptz` vào `accounts`. Cho phép `email` NULL nếu hiện đang NOT NULL; kiểm tra lại các truy vấn đang dùng email.
   - Thêm unique index một phần: `CREATE UNIQUE INDEX ux_accounts_phone ON accounts(phone) WHERE phone <> '' AND role = 'CUSTOMER';`
   - Trước đó viết câu chuẩn hóa số điện thoại hiện có về E.164 và kiểm tra trùng.
7. **Chế độ demo:**
   - `DEMO_MODE=true` và `SMS_PROVIDER=LOG` thì vẫn trả `devCode` như hiện tại, giao diện hiện khung "Thử nghiệm / Demo".
   - Khi có nhà cung cấp thật thì **không** trả `devCode`, kể cả lúc `DEMO_MODE=true`.
8. **Frontend** (`guest/Portal.jsx` cùng các component đăng nhập và đăng ký):
   - Đăng ký 3 bước: số điện thoại → OTP (có đếm ngược và nút "Gửi lại mã") → họ tên, mật khẩu, email tùy chọn.
   - Ô số điện thoại có placeholder `0912 345 678`.
9. **Seed:** cập nhật các tài khoản demo thành số đã xác thực, dạng E.164, và không trùng nhau.

**Kiểm tra:**
- Đăng ký bằng số mới → nhận OTP (demo: thấy trong log và trong lịch sử gửi) → tạo tài khoản → đăng nhập bằng số và bằng email (nếu có).
- Nhập sai 5 lần thì khóa mã. Gửi lại trước 60 giây bị từ chối.
- Đăng ký trùng số thì bị từ chối.
- Test JUnit cho chuẩn hóa số, giới hạn tần suất, OTP hết hạn.

### P1-b. Hệ thống thông báo: nhắc lịch và nhắc thanh toán

**Cách làm theo doanh nghiệp thật:**
- Dùng **hàng đợi thông báo (outbox)**: sự kiện nghiệp vụ tạo bản ghi thông báo, một job gửi đi, ghi trạng thái và tự thử lại.
- Mỗi thông báo có **khóa chống trùng**, để khách không nhận 2 lần.
- Tin giao dịch (nhắc lịch, nhắc thanh toán) được gửi không cần đồng ý quảng cáo. Tin quảng cáo thì cần (xem P3).
- SMS không gửi vào giờ nghỉ, 21:00–07:00.

**Yêu cầu:**

1. **Migration `V15__notifications.sql`:**
   - Bảng `notifications`, gồm:
     - `id`, `account_id`, `order_id` (nullable), `campaign_id` (nullable)
     - `type`: `BOOKING_REMINDER_24H`, `BOOKING_REMINDER_2H`, `HOLD_EXPIRING`, `BALANCE_DUE`, `OVERDUE_DEBT`, `EXTRA_CHARGE_DUE`, `BOOKING_CONFIRMED`, `REFUND_DONE`, `PROMOTION`
     - `channel`: `EMAIL` / `SMS` / `IN_APP`
     - `recipient`, `subject`, `body`
     - `status`: `QUEUED` / `SENT` / `FAILED` / `SKIPPED`
     - `attempts`, `last_error`, `scheduled_at`, `sent_at`, `created_at`
     - `dedupe_key` UNIQUE, ví dụ `BOOKING_REMINDER_24H:<orderId>:<visitDate>:EMAIL`.
   - Thêm cột `notify_email boolean default true`, `notify_sms boolean default true`, `marketing_consent boolean default false`, `marketing_consent_at timestamptz` vào `accounts`.
2. **`NotificationService`:**
   - Hàm `enqueue(...)` dùng chung.
   - Job `@Scheduled` chạy mỗi phút:
     - Quét đơn `CONFIRMED` có buổi chơi bắt đầu trong 24 giờ tới hoặc 2 giờ tới, chưa có bản ghi nhắc, thì tạo thông báo.
     - Quét đơn `HOLDING` còn dưới 2 phút giữ chỗ → `HOLD_EXPIRING`. Chỉ gửi in-app và email, không SMS, vì chu kỳ quá ngắn.
     - Quét đơn đã check-out mà còn thiếu tiền, hoặc quá 15 phút sau giờ chơi mà còn thiếu → `OVERDUE_DEBT`. Dùng chung quy tắc nợ quá hạn đang có, không viết lại.
     - Sự kiện tức thời, gọi ngay từ chỗ phát sinh:
       - xác nhận cọc (`BOOKING_CONFIRMED`, kèm mã vé và link QR);
       - tiền phải thu thêm sau đổi lịch hoặc gia hạn (`EXTRA_CHARGE_DUE`);
       - hoàn tiền xong (`REFUND_DONE`).
   - Job gửi: lấy `QUEUED` có `scheduled_at <= now`, gửi qua `EmailService` hoặc `SmsGateway`.
     - Thử lại tối đa 3 lần, giãn cách 1, 5, 15 phút.
     - SMS rơi vào 21:00–07:00 thì dời sang 07:00, trừ `HOLD_EXPIRING` (vốn không gửi SMS).
3. **Nội dung mẫu** (Tiếng Việt, ngắn, có mã đơn):
   - SMS dưới 160 ký tự, không dấu nếu nhà cung cấp tính phí theo ký tự có dấu.
   - Ví dụ nhắc lịch: `Courtly: Nhac lich San A02 18:00-19:00 ngay 05/11. Ma ve CT-B18E6703. Den som 10p de check-in.`
   - Ví dụ nhắc thanh toán: `Courtly: Don CT-... con thieu 334.750d. Vui long thanh toan tai quay hoac VietQR: <link>.`
   - Email dạng HTML theo mẫu `EmailService` đang có, kèm nút "Xem vé QR" và "Thanh toán".
4. **Khách tự chọn kênh:** trang "Hồ sơ của tôi" có 3 công tắc: Nhận email, Nhận SMS, Nhận tin khuyến mãi (đồng ý quảng cáo). Không có kênh nào khả dụng thì ghi `SKIPPED`.
5. **Màn quản trị:**
   - Menu mới **"Thông báo đã gửi"**, cho ADMIN và STAFF xem:
     - lọc theo loại, kênh, trạng thái, ngày;
     - xem nội dung;
     - nút "Gửi lại" cho bản `FAILED`.
   - Trong chi tiết đơn: mục "Lịch sử thông báo" và nút **"Gửi nhắc ngay"** (email/SMS) để lễ tân chủ động nhắc. Nút này cũng dùng để demo cho hội đồng.
6. **Cấu hình Gmail thật:**
   - Bổ sung vào `.env.example`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USERNAME=<gmail>`, `SMTP_PASSWORD=<App Password 16 ký tự>`, `SMTP_FROM`, `SMTP_FROM_NAME`, kèm chú thích "bật xác minh 2 bước rồi tạo App Password".
   - Thêm `NOTIFY_MODE=LIVE|LOG`. Ở chế độ `LOG` thì không gửi ra ngoài nhưng vẫn ghi `SENT (log)`, để demo an toàn.
7. **Chuông in-app:** giữ chuông hiện tại, nhưng đọc thêm `notifications` loại `IN_APP` từ API. Không tính lại ở frontend những gì backend đã tạo.

**Kiểm tra:**
- Đặt đơn bắt đầu sau 2 giờ 5 phút → sau khoảng 5 phút có `BOOKING_REMINDER_2H`; email thật đến hộp thư khi `NOTIFY_MODE=LIVE`.
- Chạy job 2 lần không tạo thông báo trùng (nhờ `dedupe_key`).
- Tắt "Nhận SMS" thì chỉ còn email.
- Lỗi SMTP → `FAILED`, thử lại, rồi hiện trong màn quản trị.
- Test JUnit cho bộ quét thời gian, dùng `Clock` có thể giả lập; **không** dùng `Instant.now()` trực tiếp trong code mới.

### P2. Quản lý voucher (ADMIN và STAFF)

**Cách làm theo doanh nghiệp thật:**
- Phân hạn mức theo vai trò: nhân viên tạo được mã nhỏ để chăm sóc khách tại quầy; mã lớn hoặc mã đại trà phải chờ quản lý duyệt.
- Mã đã có người dùng thì **không sửa giá trị**, chỉ được tạm dừng hoặc kết thúc sớm, để giữ đúng sổ sách.
- Mọi thao tác đều có nhật ký.

**Yêu cầu:**

1. **Migration `V16__voucher_management.sql`:** thêm vào `vouchers` các cột:
   - `status` (`DRAFT` / `PENDING_APPROVAL` / `ACTIVE` / `PAUSED` / `ENDED`); thay dần `enabled`, giữ `enabled` đồng bộ để code cũ chạy.
   - `created_by`, `approved_by`, `approved_at`, `campaign_id` (nullable).
   - `zone` (nullable: OUTDOOR / INDOOR / VIP).
   - `valid_from_time`, `valid_to_time` (nullable; mã giờ vàng, ví dụ 10:00–15:00).
   - `valid_weekdays` (nullable, ví dụ `1,2,3,4,5`).
   - `assigned_account_id` (nullable; mã cá nhân).
   - Cập nhật `VoucherService.calculate` để kiểm các điều kiện mới, dựa trên các slot của đơn.
2. **API** `/api/admin/vouchers` gồm: danh sách, tạo, sửa, tạm dừng, kết thúc, duyệt, sinh mã hàng loạt.
   - **ADMIN:** làm được tất cả.
   - **STAFF:** tạo và sửa bản `DRAFT` của chính mình. Gửi đi thì:
     - nếu trong hạn mức (giảm ≤ 20% hoặc ≤ 100.000₫, `usage_limit` ≤ 50, hiệu lực ≤ 30 ngày, có `max_discount` khi giảm theo %) → tự `ACTIVE`;
     - vượt hạn mức → `PENDING_APPROVAL`, chờ ADMIN duyệt.
   - Hạn mức để trong `club_settings.policies` để admin chỉnh được.
3. **Ràng buộc:**
   - Mã viết hoa, 4–20 ký tự `[A-Z0-9]`, không trùng.
   - `expires_at > starts_at`; PERCENT trong khoảng 1–100; FIXED > 0.
   - Khi `used_count > 0` thì khóa các trường `type`, `value`, `min_order`, `max_discount`, `min_tier`, `new_user_only`; chỉ cho đổi `expires_at` sớm hơn hoặc trạng thái.
   - Cột `member_only` được thay bằng `min_tier` (nullable: ROOKIE / CHALLENGER / MASTERS / GRAND_SLAM; thêm cột ở P2-c). Code mới không đọc `member_only` nữa.
   - Không xóa cứng voucher đã có lượt dùng.
4. **Sinh mã cá nhân hàng loạt:** nhập số lượng, tiền tố (ví dụ `TRIAN`) → tạo N mã ngẫu nhiên `TRIAN-7K3Q`, mỗi mã dùng 1 lần, có thể gán cho từng khách.
5. **Màn hình** (menu mới **"Khuyến mãi & voucher"** cho ADMIN và STAFF):
   - Bảng voucher gồm: mã, mô tả, giá trị, điều kiện, hiệu lực, đã dùng / giới hạn, trạng thái, người tạo.
   - Bộ lọc theo trạng thái; nút "Tạo voucher".
   - Form có xem trước câu mô tả tự sinh, ví dụ "Giảm 20% tối đa 80.000₫ cho đơn từ 200.000₫, khung 10:00–15:00 thứ 2–6, sân ngoài trời".
   - Chi tiết voucher có danh sách lượt dùng (đơn, khách, số tiền giảm, ngày).
   - Hàng chờ duyệt cho ADMIN.
6. **Trang khách:** danh sách voucher ở trang đặt sân chỉ hiện mã `ACTIVE`, còn hạn và khách đủ điều kiện. Mã cá nhân chỉ hiện với người được gán. Mã chưa đủ điều kiện hiện "🔒 khách mới" hoặc "🔒 từ hạng Masters".
7. **Nhật ký:** ghi mọi thao tác tạo, sửa, duyệt, tạm dừng vào `AuditService`.

**Kiểm tra:**
- STAFF tạo mã 10% / 50 lượt → `ACTIVE` ngay. Tạo mã 30% → `PENDING_APPROVAL`; ADMIN duyệt → `ACTIVE`.
- Mã giờ vàng 10:00–15:00: đặt 18:00 bị báo "Mã chỉ áp dụng 10:00–15:00".
- Sửa giá trị mã đã có người dùng bị từ chối.
- Thứ tự tính giá đúng mục 3: giảm theo hạng → voucher → điểm.

### P2-b. Feedback gắn với đơn và xử lý đánh giá thấp bằng voucher bù

**Cách làm theo doanh nghiệp thật** (quy trình "service recovery" của khách sạn, chuỗi F&B, sân thể thao):
- Đánh giá luôn gắn với một lần sử dụng dịch vụ cụ thể.
- Đánh giá thấp thành một **ca cần xử lý**, có người phụ trách và hạn phản hồi (thường trong 24 giờ).
- Người xử lý xin lỗi riêng, ghi nguyên nhân, và có thể **bù bằng voucher** với hạn mức theo vai trò.
- Mỗi ca chỉ bù một lần. Voucher bù là mã cá nhân, dùng một lần.
- **Không** bắt khách sửa hay gỡ đánh giá để nhận bù.
- Đo được: tỷ lệ phản hồi đúng hạn, chi phí bù, và tỷ lệ khách quay lại dùng mã.

**Yêu cầu:**

1. **Gắn feedback với đơn:**
   - Thêm `orderId`, `visitDate`, `courtNames` vào tài liệu `feedback:<id>`.
   - Ở `/feedback`, khách đã đăng nhập chọn **buổi chơi** cần đánh giá từ danh sách buổi đã check-out trong 14 ngày gần nhất mà chưa đánh giá. Mỗi buổi chơi chỉ được 1 đánh giá; khách có thể bỏ trống buổi chơi để góp ý chung.
   - Sau check-out (P1-b), gửi thông báo `FEEDBACK_REQUEST` kèm link mở thẳng form, chọn sẵn buổi chơi đó.
   - Trong chi tiết đơn (admin, staff) hiện đánh giá của đơn nếu có.
2. **Phân loại và trạng thái xử lý:**
   - Feedback có `rating <= 3` tự gắn cờ `LOW_RATING` và vào trạng thái xử lý `NEW`.
   - Luồng trạng thái: `NEW` → `IN_PROGRESS` (có `assignedTo`) → `RESOLVED`, hoặc `NO_ACTION` (kèm lý do).
   - Thêm các trường: `handlingStatus`, `assignedTo`, `dueAt` (= `createdAt` + 24h), `resolution` (ghi chú nội bộ), `resolvedBy`, `resolvedAt`, `compensationVoucherId`.
   - Feedback 4–5 sao giữ luồng cũ: duyệt hiển thị và trả lời.
   - Tạo thông báo `IN_APP` cho ADMIN và STAFF khi có feedback thấp.
   - Thêm thẻ **"Đánh giá thấp cần xử lý"** vào trang "Việc cần xử lý"; quá hạn 24h thì chuyển màu đỏ.
3. **Quyền:** mở menu **"Feedback & Đánh giá"** cho cả STAFF.
   - STAFF xem, nhận xử lý, trả lời, tặng voucher trong hạn mức.
   - Chỉ ADMIN đổi chế độ hiển thị công khai và duyệt voucher vượt hạn mức.
4. **Hộp "Xem & xử lý" cho feedback thấp:**
   - **Bối cảnh:** khách, số sao, nội dung, chủ đề; đơn liên quan (mã đơn, sân, giờ, số tiền, trọng tài, có check-in ngoại lệ hay gia hạn không, link "Xem đơn"); số đơn và số feedback trước đó của khách.
   - **Thao tác:**
     - `Nhận xử lý` (gán cho mình).
     - Ô `Phản hồi gửi khách` (hiện cho khách, gửi email/SMS qua outbox, loại `FEEDBACK_REPLY`).
     - Ô `Ghi chú nội bộ / nguyên nhân`, kèm danh mục nguyên nhân: Mặt sân, Đèn, Trọng tài, Lễ tân, Thanh toán, Website, Khác.
     - Nút **`🎁 Tặng voucher`**.
     - `Đánh dấu đã xử lý`.
5. **Nút "Tặng voucher"** mở form nhỏ:
   - **Mẫu bù có sẵn**, cấu hình trong `club_settings.policies.compensationTemplates`, admin sửa được:
     - "Xin lỗi nhẹ": giảm 50.000₫, đơn từ 100.000₫, hạn 30 ngày.
     - "Bù dịch vụ": giảm 20% tối đa 100.000₫, hạn 30 ngày.
     - "Bù nghiêm trọng": giảm 100% một giờ sân, tối đa bằng tiền sân của đơn bị đánh giá, hạn 60 ngày. **Chỉ ADMIN**, hoặc STAFF gửi thì phải chờ duyệt.
   - Có thể chỉnh giá trị và hạn trong hạn mức của vai trò (dùng chung hạn mức STAFF ở P2). Vượt hạn mức thì voucher ở `PENDING_APPROVAL` và báo ADMIN.
   - **Khi tạo**, dùng chung bảng `vouchers` của P2, không tạo bảng riêng:
     - Sinh mã cá nhân `SORRY-XXXX`, dùng 1 lần, `per_user_limit = 1`, `usage_limit = 1`.
     - `assigned_account_id` = khách, `source = 'FEEDBACK_RECOVERY'`, `feedback_id`, `order_id` gốc. Thêm 3 cột này vào migration của P2.
     - Lưu `compensationVoucherId` vào feedback. Mỗi feedback chỉ bù 1 lần: nút ẩn khi đã có voucher; muốn bù lại phải hủy voucher cũ trước, và chỉ ADMIN làm được.
     - Gửi khách qua outbox (P1-b), loại `COMPENSATION_VOUCHER`, theo kênh khách đã bật. Đây là tin chăm sóc dịch vụ, không phải quảng cáo, nên không cần `marketing_consent`.
     - Nội dung email/SMS mẫu: `Courtly xin loi vi trai nghiem chua tot tai San A02 ngay 05/11. Tang ban ma SORRY-7K3Q giam 20% (toi da 100.000d), han 05/12.`
     - Ghi `AuditService`: ai tặng, mã, giá trị, feedback nào.
6. **Phía khách:**
   - Trang tài khoản thêm mục **"Ưu đãi của tôi"**: danh sách mã cá nhân còn hạn, giá trị, hạn, lý do ("Quà xin lỗi cho buổi chơi 05/11"), nút "Dùng ngay" mở trang đặt sân với mã áp sẵn.
   - Ở trang đặt sân, mã cá nhân hiện đầu danh sách voucher.
   - Phản hồi của CLB hiện dưới đánh giá của khách trong lịch sử đặt sân.
7. **Đo hiệu quả** (thêm vào Báo cáo, theo bộ chọn kỳ chung):
   - Số feedback thấp; % xử lý trong 24h; thời gian phản hồi trung bình.
   - Số voucher bù đã tặng, đã dùng, tổng tiền giảm.
   - % khách đánh giá thấp quay lại đặt trong 30 ngày.
   - Top nguyên nhân.
8. **Seed demo:** thêm 1 feedback 2 sao của một khách mẫu (không phải 4 tài khoản demo), gắn với một đơn mẫu đã hoàn tất, trạng thái `NEW`, nội dung ví dụ: "Đèn sân B04 chập chờn, trọng tài đến trễ 10 phút". Mục đích là demo nút "Tặng voucher" ngay sau reset.

**Kiểm tra:**
- `phuongmai` đặt, check-in, check-out → nhận yêu cầu đánh giá → chọn buổi vừa chơi, 2 sao → feedback hiện ở "Việc cần xử lý", có hạn 24h.
- STAFF nhận xử lý → trả lời → bấm "Tặng voucher", mẫu "Bù dịch vụ" → khách nhận email (`NOTIFY_MODE=LIVE`, email nằm trong allowlist) → thấy mã ở "Ưu đãi của tôi" → dùng mã khi đặt đơn mới → mã chuyển "đã dùng", báo cáo tăng 1.
- STAFF chọn mẫu "Bù nghiêm trọng" → `PENDING_APPROVAL` → ADMIN duyệt mới gửi khách.
- Bấm tặng lần hai cho cùng feedback bị từ chối.
- Khách khác không thấy và không dùng được mã `SORRY-…` của người khác.

### P2-c. Bỏ gói hội viên trả phí, thay bằng hạng thành viên và điểm thưởng

**Cách làm theo doanh nghiệp thật** (chương trình khách hàng thân thiết của hãng bay, rạp phim, chuỗi bán lẻ):
- **Hai loại số liệu tách riêng:**
  - **Chi tiêu tích lũy** để xét hạng: không tiêu được.
  - **Điểm thưởng** để đổi quà: tiêu được.
  Khách tiêu điểm không bị tụt hạng.
- Hạng **miễn phí**, xét theo chi tiêu thực tế trong 12 tháng trượt. Xuống hạng từ từ (mỗi lần 1 bậc) và có báo trước.
- Mọi biến động điểm ghi vào **sổ điểm (ledger)** chỉ thêm, không sửa: có nguồn, có đơn liên quan, hoàn tác được khi hoàn tiền.
- Quà đổi từ điểm phát dưới dạng **voucher cá nhân**, dùng chung hệ thống voucher ở P2. Không tạo cơ chế giảm giá thứ hai.

**1. Hạng và đãi ngộ** (mọi con số để trong `club_settings.policies.loyalty` để ADMIN chỉnh, không hard-code):

| | **Rookie** | **Challenger** | **Masters** | **Grand Slam** |
|---|---|---|---|---|
| Điều kiện (chi tiêu thực thu 12 tháng) | Đăng ký và xác thực SĐT | ≥ 3.000.000₫ | ≥ 8.000.000₫ | ≥ 20.000.000₫ |
| Giảm tiền sân (mọi khu) | 0% | 3% | 5% | 8% |
| Hệ số điểm thưởng | ×1 | ×1,2 | ×1,5 | ×2 |
| Đặt trước tối đa | 7 ngày | 10 ngày | 14 ngày | 21 ngày |
| Đổi lịch miễn phí mỗi tháng (vẫn phải trước hạn 24h) | 0 | 1 | 2 | 4 |
| Quà khi lên hạng | Voucher chào mừng 50.000₫ (thay mã WELCOME) | 200 điểm | 500 điểm | 1.000 điểm + **voucher 300.000₫** (hạn 60 ngày) + **thẻ VIP Lounge** |
| Voucher sinh nhật (phát ngày 1 của tháng sinh nhật, hạn hết tháng) | 30.000₫ | 60.000₫ | 120.000₫ | 250.000₫ |
| Khác | | | Đăng ký giải đấu sớm 3 ngày | Vào phòng chờ VIP bằng thẻ; hủy trong 12–24h vẫn hoàn 100% cọc |

- Voucher quà và sinh nhật: chỉ trừ tiền sân, không áp cho phí trọng tài; dùng 1 lần; không cộng dồn với voucher khác (vẫn một voucher mỗi đơn).
- Đặt trước, đổi lịch, hủy linh hoạt: thay các chỗ đang đọc từ membership (`checkWindow`, `consumeChange`, chính sách hủy) sang đọc từ hạng.

**2. Thẻ VIP Lounge (Grand Slam):**
- Thẻ điện tử trong tài khoản khách ("Thẻ VIP của tôi"): tên, hạng, mã thẻ `VIP-XXXXXX`, mã QR, ngày hết hiệu lực (bằng ngày hết hạn giữ hạng).
- Lễ tân quét bằng hộp "Quét QR Check-in" sẵn có. Nhận diện mã `VIP-` thì hiện "✅ Thẻ VIP hợp lệ – mời vào phòng chờ" hoặc "Thẻ hết hiệu lực", và ghi lượt vào phòng chờ (giờ vào, lễ tân).
- Rớt khỏi Grand Slam thì thẻ tự hết hiệu lực.
- Bỏ mô tả "VIP Lounge" gắn với gói Plus cũ.

**3. Tích điểm:**
- **1 điểm cho mỗi 10.000₫ thực thu**, nhân hệ số hạng, làm tròn xuống.
- Tính trên tiền sân, trọng tài, gia hạn, phí giải; sau mọi khoản giảm; **không tính phần trả bằng điểm**.
- Cộng khi đơn **hoàn tất check-out và đã thu đủ**, không cộng lúc mới cọc. Phí giải đấu cộng khi đăng ký giải được xác nhận thu đủ.
- Đơn tại quầy chỉ cộng nếu gắn tài khoản. Lễ tân tìm khách theo số điện thoại.
- **Thưởng thêm:**
  - nhân đôi điểm cho slot giờ vàng 10:00–15:00 (khung giờ đọc từ cấu hình);
  - +10 điểm khi đánh giá một buổi chơi (P2-b), mỗi buổi một lần, không phụ thuộc số sao;
  - +200 điểm cho người giới thiệu khi bạn được giới thiệu hoàn tất buổi đầu (mã giới thiệu trong tài khoản, chống tự giới thiệu bằng SĐT đã xác thực).
- **Hoàn tác:** hủy hoặc hoàn tiền thì ghi một dòng trừ điểm tương ứng trong sổ điểm, kể cả khi số dư bị âm; số âm được trừ dần vào lần tích sau.

**4. Đổi điểm** (1 điểm = 100₫ khi đổi):
- **Trừ thẳng tiền sân** ở bước thanh toán:
  - ô "Dùng điểm" với tối thiểu 100 điểm, bội số 10;
  - **tối đa 50% tiền sân còn lại sau giảm hạng và voucher**;
  - điểm bị giữ lại khi tạo đơn và trả lại nếu đơn hết hạn giữ chỗ hoặc bị hủy.
- **Đổi dịch vụ miễn phí** (catalogue cấu hình được; mỗi món phát ra một voucher cá nhân `source = 'POINTS_REDEMPTION'`):
  - 30 phút gia hạn sân, giờ thường: 800 điểm;
  - 1 giờ sân giờ vàng 10:00–15:00, khu ngoài trời: 1.200 điểm;
  - 1 giờ trọng tài: 2.000 điểm;
  - phí tham gia một giải đấu: theo giá giải × 10 điểm/1.000₫.
- Điểm không chuyển nhượng, không đổi ra tiền mặt.

**5. Xét hạng, giữ hạng, hết hạn điểm** (job `@Scheduled` hằng ngày lúc 02:00, dùng `Clock` để test):
- **Lên hạng ngay** khi chi tiêu 12 tháng trượt đạt mức, xét cả khi check-out. Ghi `tier_since` và `tier_expires_at` = +12 tháng. Phát quà và gửi thông báo `TIER_UP`.
- **Giữ hạng 12 tháng.** Đến `tier_expires_at`:
  - đủ mức thì gia hạn thêm 12 tháng;
  - không đủ thì **hạ 1 bậc** và giữ bậc mới 12 tháng.
  - Báo trước 30 ngày (`TIER_DOWN_WARNING`) kèm số tiền còn thiếu.
- **Điểm hết hạn 12 tháng** kể từ ngày nhận, dùng điểm cũ trước. Báo trước 30 ngày (`POINTS_EXPIRING`).
- **Sinh nhật:**
  - ngày 1 hằng tháng phát voucher sinh nhật cho khách có tháng sinh trùng, theo hạng hiện tại, mỗi năm một lần;
  - gửi thông báo `BIRTHDAY_VOUCHER`;
  - thêm `birth_date` vào tài khoản: nhập khi đăng ký hoặc trong hồ sơ, sau đó chỉ được sửa 1 lần, ADMIN sửa được có ghi nhật ký.
- Thêm các loại thông báo trên vào outbox ở P1-b. Đây là tin chăm sóc khách, không phải quảng cáo.

**6. Migration `V18__loyalty.sql`:**
- `accounts`:
  - `tier` (ROOKIE / CHALLENGER / MASTERS / GRAND_SLAM, mặc định ROOKIE), `tier_since`, `tier_expires_at`;
  - `points_balance` (cache, luôn bằng tổng ledger), `lifetime_spend`, `birth_date`;
  - `referral_code` unique, `referred_by`.
- Bảng `loyalty_ledger`: `id`, `account_id`, `type`, `points`, `spend_amount`, `order_id`, `registration_id`, `voucher_id`, `expires_at`, `note`, `created_by`, `created_at`.
  - `type` gồm: EARN / EARN_BONUS / REDEEM_ORDER / REDEEM_REWARD / REVERSAL / EXPIRE / ADJUST / TIER_GIFT.
  - Unique `(type, order_id)` cho EARN để không cộng 2 lần.
- Bảng `vip_cards` (`code` unique, `account_id`, `issued_at`, `expires_at`, `status`) và `lounge_visits` (`card_id`, `checked_in_at`, `staff_id`).
- Bảng `vouchers` (P2): thêm `min_tier`; `source` có thêm `TIER_GIFT`, `BIRTHDAY`, `POINTS_REDEMPTION`.

**7. Gỡ gói hội viên trả phí** (gỡ hẳn, không để code chết):
- Xóa luồng mua gói và thu phí gói: API trong `MembershipController`, `MembershipService` (phần plan / thu phí / kích hoạt), `pages/MembershipAdminPage.jsx`, `pages/MembershipPage.jsx`, `pages/MyMembership.jsx`, route `/membership`, banner hội viên, menu "Membership & hội viên", nút "Đăng ký hội viên".
- Thay bằng:
  - **Khách:** trang `/thanh-vien` giới thiệu 4 hạng và đãi ngộ (thay `/membership`). Mục **"Hạng & điểm của tôi"** trong tài khoản gồm: hạng hiện tại, thanh tiến độ "Còn X₫ để lên Masters", hạn giữ hạng, số điểm, điểm sắp hết hạn, lịch sử điểm, danh mục đổi quà, thẻ VIP (nếu có), mã giới thiệu.
  - **Admin/Staff:** menu **"Thành viên & điểm"**: danh sách khách theo hạng, tìm theo SĐT, xem sổ điểm, cấu hình hạng và catalogue (chỉ ADMIN), điều chỉnh điểm thủ công (chỉ ADMIN, bắt buộc lý do), lượt vào phòng chờ VIP.
- Dòng giảm giá trong khối tiền đổi từ "Ưu đãi hội viên" thành "Ưu đãi hạng Masters (−5%)". Thêm dòng "Dùng điểm (−X₫)".
- Báo cáo:
  - bỏ "Thu phí hội viên";
  - thêm mục **"Thành viên"**: số khách theo hạng, điểm phát ra / đã dùng / hết hạn, giá trị quy đổi, chi phí giảm giá theo hạng, doanh thu theo hạng, tỷ lệ khách giữ hạng;
  - dùng chung bộ chọn kỳ.
- Voucher `VIP10` thay bằng `min_tier = 'MASTERS'`. Chatbot (`AiChatbox.jsx`) và các trang tĩnh nhắc gói Club/Plus phải sửa theo hạng mới.
- Không giữ bất kỳ tham chiếu nào tới `membership-plan:`, `membership:`, `membership-payment:` trong code chạy. Reset xóa các tài liệu này khỏi `app_documents`.

**8. Ràng buộc tính giá:**
- Thứ tự đúng mục 3: giá sân → giảm hạng → voucher → điểm.
- Tính ở **một chỗ** trong backend, dùng chung cho xem trước (`/booking/options`, `/public/vouchers/evaluate`), tạo đơn, đổi lịch và gia hạn. Frontend chỉ hiển thị số backend trả về.
- Gia hạn tại sân vẫn được giảm theo hạng.

**9. Đơn tại quầy:** khi lễ tân tạo đơn hoặc thu tiền, ô "SĐT khách" tra ra tài khoản và hiện hạng và số điểm. Khách muốn dùng điểm thì lễ tân nhập số điểm. Thao tác này cần OTP SMS gửi tới khách (P1-a) để xác nhận, chống lạm dụng.

**10. Phân quyền:**
- Xem: ADMIN, STAFF.
- Sửa cấu hình hạng, catalogue, điều chỉnh điểm, thu hồi thẻ VIP: chỉ ADMIN.
- Mọi điều chỉnh ghi `AuditService`.

**11. Dữ liệu demo tạo mới hoàn toàn** (`DemoResetService`; không chuyển đổi gì từ membership cũ):

| Tài khoản | Hạng | Chi tiêu 12 tháng | Điểm | Ngày sinh | Mục đích demo |
|---|---|---|---|---|---|
| `kietdlv@gmail.com` | **Grand Slam** (đạt 45 ngày trước) | 21.500.000₫ | 2.400 (có 300 điểm hết hạn trong 20 ngày) | ngày 15 của tháng sau | Thẻ VIP Lounge, voucher 300.000₫ chưa dùng, đổi điểm trừ tiền sân |
| `demo.hoivien@gmail.com` | **Masters** | 19.900.000₫ | 1.500 | tháng 3 | **Lên hạng trực tiếp khi demo:** thiếu 100.000₫. Đặt 1 giờ sân tối khu A (260.000₫ − 5% = 247.000₫; kể cả dùng 500 điểm vẫn thực thu 197.000₫) rồi check-out là thành Grand Slam |
| `demo.khach@gmail.com` | **Challenger** | 3.400.000₫ | 420 | **tháng hiện tại** | Đã có voucher sinh nhật 60.000₫ chưa dùng |
| `phuongmaiphanqn3@gmail.com` | **Rookie** | 0₫ | 0 | không nhập | Khách mới: voucher chào mừng 50.000₫, tích điểm đơn đầu tiên |

- Chi tiêu của 3 tài khoản đầu đến từ **các đơn đã hoàn tất, đã thu đủ**, rải đều từ 2 đến 11 tháng trước ngày reset. Mỗi đơn có `loyalty_ledger` EARN tương ứng, sao cho tổng khớp đúng bảng trên.
- Không có đơn trong tháng hiện tại, để báo cáo tháng demo không bị lệch.
- Các khách mẫu cũ (`hoangnam`, `khachmoi`, `thao.le`, `minhduc`, `phuongvu`, `hoanglong`) được gán hạng phân bố hợp lý (2 Rookie, 2 Challenger, 1 Masters, 1 Grand Slam), có sổ điểm khớp với đơn mẫu. Họ vẫn chỉ dùng để admin xem trạng thái.
- Mọi ngày tháng tính tương đối theo ngày reset.

**Kiểm tra:**
- `demo.hoivien`:
  - đặt A01 1 giờ tối ngày thường (260.000₫) → khối tiền hiện "Ưu đãi hạng Masters (−5%) −13.000₫";
  - dùng 500 điểm (−50.000₫) → tổng 197.000₫, cọc 50% là 98.500₫;
  - check-out thu đủ → điểm cộng theo hệ số ×1,5 trên số thực thu;
  - lên **Grand Slam** ngay → nhận 1.000 điểm, voucher 300.000₫, thẻ VIP;
  - nhận email `TIER_UP` (nếu email trong allowlist).
- Lễ tân quét mã thẻ VIP của `kietdlv` → hiện "Thẻ VIP hợp lệ" → có lượt vào phòng chờ.
- `demo.khach` thấy voucher sinh nhật 60.000₫ trong "Ưu đãi của tôi" và dùng được khi đặt sân.
- Hủy một đơn đã cộng điểm và được hoàn tiền → sổ điểm có dòng REVERSAL, số dư giảm tương ứng.
- Chạy job hằng ngày với `Clock` giả lập 12 tháng sau → khách không đủ chi tiêu bị hạ đúng 1 bậc; điểm quá 12 tháng chuyển EXPIRE.
- Tìm toàn bộ mã nguồn không còn `membership-plan`, `MembershipAdminPage`, "Thu phí hội viên".
- Test JUnit: tính điểm, hệ số, trần 50%, hoàn tác, lên/xuống hạng, hết hạn điểm, voucher sinh nhật mỗi năm một lần.

### P3. Chiến dịch khuyến mãi

**Cách làm theo doanh nghiệp thật:**
- Chiến dịch gồm: mục tiêu, thời gian, nhóm khách, ưu đãi (một hoặc nhiều voucher), kênh truyền thông, và đo hiệu quả.
- Tin quảng cáo **chỉ gửi cho khách đã đồng ý** và luôn có cách từ chối nhận, theo tinh thần Nghị định 13/2023 về bảo vệ dữ liệu cá nhân và quy định chống tin rác (Nghị định 91/2020).
- Không gửi quảng cáo 21:00–07:00.

**Yêu cầu:**

1. **Migration `V17__campaigns.sql`:** bảng `campaigns` gồm:
   - `id`, `name`, `description`
   - `status`: `DRAFT` / `SCHEDULED` / `RUNNING` / `ENDED` / `CANCELLED`
   - `starts_at`, `ends_at`
   - `audience`: `ALL` / `TIER` (danh sách hạng trong `audience_filter`) / `NEW_CUSTOMERS` / `INACTIVE_30D` / `NEAR_NEXT_TIER` (còn thiếu dưới 20% để lên hạng kế tiếp) / `CUSTOM_LIST`
   - `audience_filter jsonb`
   - `channels`: chuỗi `EMAIL,SMS,BANNER`
   - `message_title`, `message_body`, `banner_text`
   - `created_by`, `approved_by`
   - `budget_limit` (tổng tiền giảm tối đa, nullable)
2. **Quyền:**
   - **ADMIN:** tạo, duyệt, chạy, dừng.
   - **STAFF:** tạo bản nháp; gửi đi thì sang `PENDING_APPROVAL`. Staff không tự gửi SMS hay email hàng loạt.
3. **Chạy chiến dịch:**
   - Khi `RUNNING`, tạo thông báo `PROMOTION` qua outbox P1-b cho nhóm khách. Chỉ chọn khách có `marketing_consent = true` và bật kênh tương ứng.
   - Mỗi tin có link "Hủy nhận tin" (`/huy-nhan-tin?token=...`): bấm vào là tắt `marketing_consent`, không cần đăng nhập.
   - Banner hiện trên trang khách qua vùng thông báo gộp đã có. Thứ tự ưu tiên thấp hơn nhắc lịch và nợ.
4. **Ngân sách:** khi tổng tiền giảm của các voucher thuộc chiến dịch chạm `budget_limit`, tự chuyển voucher sang `ENDED` và báo cho ADMIN.
5. **Đo hiệu quả** (trong trang chiến dịch và mục mới trong Báo cáo):
   - Số tin đã gửi / thành công.
   - Số lượt dùng mã, tổng tiền giảm.
   - Doanh thu thực thu từ các đơn dùng mã của chiến dịch.
   - Số khách mới có được.
   - Lọc theo kỳ, dùng chung bộ chọn kỳ `utils/period.mjs`.
6. **Ghi nhận đồng ý:** trang đăng ký có ô **không tick sẵn** "Tôi muốn nhận ưu đãi qua SMS/email"; lưu `marketing_consent_at`.

**Kiểm tra:**
- ADMIN tạo chiến dịch "Giờ vàng tháng 11" cho nhóm `INACTIVE_30D`, kênh EMAIL, có voucher giờ vàng → chạy → chỉ khách đã đồng ý nhận email (`NOTIFY_MODE=LOG` thì kiểm trong "Thông báo đã gửi").
- Bấm link hủy nhận tin → lần chạy sau không còn khách đó.
- Chạm ngân sách → voucher tự dừng.

## 5. Ngoài phạm vi

- Không đổi giá, chính sách cọc, hoàn tiền, check-in.
- Không thêm vai trò mới (MANAGER…).
- Không tích hợp Zalo ZNS hay push notification di động. Để interface `SmsGateway` / `NotificationChannel` mở rộng được về sau.
- Không sửa migration V1–V13.

## 6. Bàn giao

- Thứ tự làm: P0 → P1-a → P1-b → P2 → P2-b → P2-c → P3. P2-b và P2-c dùng bảng voucher của P2 và outbox của P1-b.
- Mỗi mục một commit: `chore(seed): them tai khoan demo kietdlv va phuongmai`, `feat(auth): xac thuc so dien thoai OTP SMS`, `feat(notify): outbox nhac lich va thanh toan`, `feat(promo): quan ly voucher`, `feat(feedback): gan don va tang voucher cho danh gia thap`, `feat(loyalty): hang thanh vien va diem thuong thay goi hoi vien`, `feat(promo): chien dich khuyen mai`.
- P2-c có thể tách 2 commit: (1) thêm hạng, điểm, thẻ VIP; (2) gỡ gói hội viên trả phí.
- Cập nhật `.env.example`, `docs/API.md`, `docs/DATABASE.md`.
- Cập nhật `DemoResetService`:
  - reset dọn bảng `notifications` và `campaigns` (giữ 1 chiến dịch mẫu `DRAFT`);
  - các voucher seed có `status = ACTIVE`;
  - 4 tài khoản demo (2 cũ và 2 mới ở P0) có số điện thoại đã xác thực, `marketing_consent = true`, hạng và điểm đúng bảng P2-c mục 11;
  - không còn tài liệu `membership-plan:`, `membership:`, `membership-payment:`;
  - có feedback 2 sao mẫu ở trạng thái `NEW` (P2-b).
- Chạy `.\reset-demo.ps1` rồi báo kết quả từng mục "Kiểm tra". Ghi rõ đã test với Gmail và nhà cung cấp SMS thật hay chỉ ở chế độ LOG.
- Thêm vào kịch bản demo các bước:
  - Flow 02: đăng ký bằng số điện thoại.
  - Flow 03: nút "Gửi nhắc ngay" và email nhắc lịch đến hộp thư thật.
  - Flow 01: tạo voucher giờ vàng; mục "Configure benefits" đổi từ sửa gói Plus sang cấu hình 4 hạng thành viên.
  - Flow 02: khách Masters đặt sân thấy giảm theo hạng và dùng điểm.
  - Flow 03: check-out xong khách lên Grand Slam ngay; lễ tân quét thẻ VIP Lounge.
  - Cuối Flow 03: xử lý feedback 2 sao và bấm "Tặng voucher"; khách thấy mã trong "Ưu đãi của tôi" và trong email.
