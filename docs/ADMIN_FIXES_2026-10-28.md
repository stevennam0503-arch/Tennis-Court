# Sửa vận hành sau rà soát `becdf1b`

## Hành vi đã sửa

- **Đơn định kỳ:** check-in/check-out theo ngày chơi. Check-out chỉ nhả sân và trọng tài của ngày đang chơi; đơn còn buổi khác trở về CONFIRMED. Sau buổi cuối mới COMPLETED. API trả `visits` và cờ `completed` cho từng dòng sân/trọng tài; chi tiết đơn hiển thị lịch từng buổi.
- **Đổi lịch/gia hạn:** áp dụng cho buổi đang chơi hoặc buổi còn lại sớm nhất, giữ các buổi khác và chi phí đã sử dụng. Phân công trọng tài trên giao diện giữ phân công của các ngày khác. Hủy phần còn lại tính tiền có thể hoàn sau khi trừ tiền sân/trọng tài đã dùng; ưu đãi sân được phân bổ theo tỷ trọng tiền sân. Khôi phục giữ lịch sử đã chơi và tính lại khoản chờ hoàn theo chênh lệch hiện tại.
- **OTP:** thiếu SMTP ngoài demo trả 503; không tự trả mã OTP trong API. Bỏ ghi nội dung email/OTP vào log. Chỉ bật mã thử khi `DEMO_MODE=true` và không có profile `prod`/`production`.
- **Reset demo:** API và giao diện bị khóa ngoài demo, kể cả admin. Reset vẫn cần quyền admin. Production luôn vô hiệu hóa demo.
- **Phân khu sân:** V11 chuyển danh mục cũ sang OUTDOOR/INDOOR/VIP, giữ mặt sân cũ ở `surface_type`. Bộ sân chuẩn có 4 ngoài trời, 4 trong nhà, 2 VIP. Tên sân tùy biến chưa xác định được khu được đánh dấu `zone_needs_review` để admin kiểm tra.
- **Báo cáo:** lọc từng dòng sân và trọng tài theo ngày chơi trong kỳ, không gộp mọi tuần vào ngày đầu của đơn. Tiền thực thu vẫn theo ngày giao dịch. Chi tiết/CSV ghi rõ số tiền toàn đơn; giá trị dịch vụ theo kỳ là trước giảm giá. Phần đã chơi vẫn được tính khi các buổi còn lại bị hủy.
- **Thanh toán:** mặc định MANUAL. Sandbox cần chủ động bật demo; production chỉ nhận LIVE/SEPAY/MANUAL. SEPAY là alias của LIVE. Khách demo chỉ mô phỏng giao dịch của chính mình; ADMIN/STAFF có thể thao tác trong môi trường demo. Ngoài demo, endpoint sandbox trả 403.

## Database và cập nhật

V12 thêm `completed_at` vào `booking_slots` và `booking_staff`. Migration không thay số tiền, xóa đơn hay tự đặt lại sân đã giải phóng. Các đơn định kỳ cũ có lịch sau thời điểm check-out được đánh dấu `RECURRING_VISITS_REVIEW`: quầy phải đối chiếu lịch còn lại và sân trống trước khi xử lý. Cảnh báo xuất hiện ở phần đối chiếu của đơn.

`database/init.sql` đồng bộ Flyway V1–V12; `test_data.sql` và generator ghi trạng thái các buổi đã chơi; `query.sql` bổ sung truy vấn lịch từng buổi và các dòng cần rà soát. Init/seed chỉ dành cho database trống/demo riêng.

Với bản đang chạy, tại thư mục repository:

```powershell
git pull --ff-only origin nam-dev
docker compose up -d --build
```

Backend tự chạy migration. Không nhập lại init/test_data và không xóa volume khi cập nhật dữ liệu đang dùng. Nếu cần kiểm thử OTP hoặc thanh toán giả, dùng database demo riêng với `DEMO_MODE=true`, `PAYMENT_MODE=SANDBOX`; không dùng cấu hình này cho vận hành thật.

## Kiểm chứng

- Maven verify: 53 kiểm thử Java, gồm chính sách demo, cấu hình production và alias SEPAY.
- Frontend production build; 3 bộ kiểm thử JavaScript (chọn giờ, định giá, phân kỳ báo cáo).
- `tests/recurring-operations-api.mjs`: 18 kiểm tra trên PostgreSQL riêng, bao gồm đơn 4 tuần có trọng tài, nhả đúng buổi, giữ phí đã dùng, đổi giờ, gia hạn, hoàn tất cả chuỗi, hủy/khôi phục một phần và chặn các chức năng demo ngoài demo.
- `tests/referee-only-api.mjs`: 10 kiểm tra đặt sân, phân công trọng tài, chặn dịch vụ cũ, thu tiền, check-in/out, phiếu thu và hoàn tiền.
- `tests/demo-payment-policy-api.mjs`: 4 kiểm tra chế độ demo chủ động, OTP, cấu hình sandbox và ghi nhận tiền mô phỏng cho đơn của khách.
- Database có dữ liệu cũ nâng từ V10 lên V12; database trống nạp init/seed/query và backend xác minh đủ 12 migration.
- Chromium mở 4 trang khách và 16 trang admin, không có lỗi JavaScript/API 5xx; đây là kiểm tra hiển thị/điều hướng, không thay thế kiểm thử mọi thao tác trên từng trang.

Lệnh API test cần `COURTLY_TEST_WRITE=1`; trỏ `COURTLY_API_URL` tới server dùng database bỏ đi. Luồng recurring yêu cầu demo tắt, SMTP trống; test demo yêu cầu demo bật, PAYMENT_MODE=SANDBOX. Thay `COURTLY_TEST_DAY_OFFSET` bằng ngày trống khi chạy lặp test recurring/referee.

Chưa kiểm tra gửi SMTP thật, giao dịch ngân hàng thật hoặc triển khai production. Frontend vẫn có cảnh báo bundle JavaScript lớn; bản này tập trung sửa nghiệp vụ và các lỗi bảo mật đã xác định.
