# Kiểm tra bản mới nhất — 27/10/2026

Phiên bản: `becdf1b` trên `origin/nam-dev` (đã fetch trước khi kiểm tra). Kết luận: các luồng cơ bản hoạt động, nhưng còn lỗi nghiêm trọng ở đặt định kỳ và ranh giới giữa môi trường demo/vận hành. Chưa nên coi bản này là sẵn sàng dùng cho dữ liệu và thanh toán thật.

Kiểm tra trên PostgreSQL 16 riêng (`courtly-review-20261027`), không dùng database của người dùng. Backend chạy `DEMO_MODE=false`, `SEED_DEMO=false`, `PAYMENT_MODE=MANUAL`, không cấu hình SMTP. Không chuyển tiền thật, không gửi email, không thay mật khẩu người dùng và không thực hiện reset demo.

## Phát hiện ưu tiên cao

### P1 — Check-out một buổi làm mất các tuần còn lại của đơn định kỳ

- `backend/src/main/java/com/courtly/service/OrderService.java:92`: mọi slot của chuỗi định kỳ được gắn vào cùng một booking.
- `OrderService.java:224`: check-out chuyển cả đơn/booking sang COMPLETED và gọi `release(b)` cho toàn bộ slot.
- **Đã tái hiện API:** tạo đơn 4 tuần, mỗi tuần 13:00–14:00, gồm 8 slot và tổng 800.000đ; thu đủ rồi check-in/check-out buổi đầu. Lịch tuần tiếp theo đổi từ BOOKED sang AVAILABLE, đơn thành COMPLETED dù còn ba buổi chưa sử dụng.
- Hậu quả: người khác có thể đặt vào các buổi đã được khách trả tiền; khách không check-in tiếp được như một đơn CONFIRMED.
- Cần tách từng buổi và trạng thái từng buổi khỏi hợp đồng/nhóm định kỳ. Check-out chỉ giải phóng buổi đang chơi.

### P1 — Trả OTP quên mật khẩu khi tắt demo nhưng thiếu SMTP

- `backend/src/main/java/com/courtly/service/AuthService.java:359`: điều kiện `demoMode || !emails.isConfigured()` đưa `code` và `devCode` vào phản hồi API chưa đăng nhập.
- **Đã tái hiện:** request quên mật khẩu tài khoản admin trên database test nhận cả hai trường dù `DEMO_MODE=false`. Không thực hiện đổi mật khẩu.
- Người gọi không cần truy cập hộp thư để lấy mã xác minh trong cấu hình này. Đăng ký/kích hoạt cũng dùng điều kiện tương tự.
- Cần chỉ cung cấp OTP trực tiếp trong môi trường demo được cho phép rõ ràng; ở môi trường khác, thiếu SMTP phải trả lỗi cấu hình hoặc không cho khởi chạy. `ProductionSecurityValidator` mới kiểm tra SMTP host, trong khi `EmailService.isConfigured()` còn yêu cầu password.

### P1 — Reset demo chưa bị giới hạn vào môi trường demo

- `backend/src/main/java/com/courtly/controller/CatalogController.java:77` chỉ kiểm tra quyền ADMIN, không kiểm tra DEMO_MODE hoặc profile.
- `backend/src/main/java/com/courtly/service/DemoResetService.java:50` chạy DELETE toàn bộ đơn, biên lai, hoàn tiền, phân công và các tài khoản ngoài danh sách cố định; cập nhật mọi slot thành AVAILABLE.
- `frontend/src/pages/SystemPage.jsx` luôn hiển thị nút reset. Hộp xác nhận UI không thay thế kiểm tra môi trường ở server.
- **Xác nhận qua đọc code; không gọi thao tác này.** Nếu dùng chung ứng dụng cho dữ liệu thật, công cụ không phân biệt dữ liệu thật với dữ liệu demo.
- Cần khóa endpoint ở server ngoài demo, ẩn UI tương ứng và chỉ dùng database demo riêng.

## Các lỗi cần sửa tiếp

### P2 — Không có migration đổi loại sân cũ

- `CatalogService.java:188` chỉ nhận VIP/INDOOR/OUTDOOR, nhưng V6 và SQL mẫu vẫn chứa HARD/CLAY/GRASS; V9–V10 không chuyển loại.
- **Đã tái hiện:** gửi lại sân có `type=HARD` từ dữ liệu mẫu vào API cập nhật sân nhận HTTP 400.
- Bộ lọc sân admin dựa vào loại mới nên phân loại sai hoặc không thấy sân trong nhà/VIP từ dữ liệu cũ.
- Cần migration phân loại có căn cứ (không coi loại mặt sân là loại khu sân), đồng bộ init/seed/generator và kiểm tra nâng cấp database đang có dữ liệu.

### P2 — Báo cáo theo kỳ chưa xử lý ngày của từng buổi định kỳ

- `frontend/src/pages/ReportsPage.jsx:76` lọc theo một `o.date`, sau đó cộng toàn bộ `o.slots` ở phần giá trị/công suất.
- Đơn bắt đầu ngày 29/10 nhưng có ba buổi tháng 11 sẽ bị dồn vào ngày/tháng đầu khi tính sử dụng sân; kỳ tháng 11 không chọn được đơn đó.
- Đây là phát hiện qua code, cùng cấu trúc đơn nhiều ngày đã xác nhận bằng API. Cần lọc theo `slot.date` đối với sử dụng sân; tiền thực thu vẫn lọc theo thời điểm chứng từ.

### P2 — Chính sách production vẫn cho lọt SANDBOX

- `ProductionSecurityValidator.java:81` chỉ từ chối PAYMENT_MODE=DEMO, không từ chối SANDBOX.
- `TransferService.sandbox()` cho khách mô phỏng thu tiền của chính họ ở cả DEMO và SANDBOX, không kiểm tra profile production.
- Cần chỉ chấp nhận chế độ thanh toán production được hỗ trợ, chặn endpoint mô phỏng ngoài môi trường test. Thông báo cấu hình đang khuyên dùng SEPAY nhưng code tạo chuyển khoản chỉ nhận LIVE/DEMO/SANDBOX; nên thống nhất tên chế độ.
- Phát hiện qua đọc code, chưa chạy profile production hoặc webhook ngân hàng thật.

## Các phần đã kiểm tra đạt

- Frontend production build đạt; còn cảnh báo bundle lớn khoảng 777 kB trước gzip.
- 47 kiểm thử Java đạt.
- Hai bộ kiểm thử JavaScript về chọn giờ và định giá đạt.
- 10 kiểm thử API trọng tài đạt: đặt 90 phút, tính phí, chặn dịch vụ cũ, đổi/bỏ phân công, từ chối chức danh khác và rollback, thu tiền, check-in/out, xuất phiếu thu, hoàn tiền.
- Chromium: 4 trang khách và 16 trang admin mở được, không ghi nhận lỗi JavaScript. Đây là kiểm tra hiển thị/điều hướng, không phải mọi thao tác trên từng trang.
- Nạp init/test_data thành công; backend xác minh 10 migration và tự nâng từ V8 lên V10.
- Các sửa chữa trước đây đã có trong code: tổng thu/bản in/báo cáo cộng membershipPayments; công suất dùng số giờ thực tế cho slot nửa giờ; validator chấp nhận ảnh `/guest/`; chặn bảo trì bỏ qua ngày quá khứ.

Các kiểm thử mới trong repository về phân quyền, nhiều sân và xóa tài khoản vẫn giả định đăng ký đăng nhập ngay, trong khi ứng dụng hiện yêu cầu OTP. Không dùng các script chưa cập nhật đó làm bằng chứng đã đạt toàn bộ nghiệp vụ. Luồng gửi email thật, webhook ngân hàng thật và triển khai production chưa được kiểm chứng trong đợt này.

Các phát hiện trên mô tả bản `becdf1b` tại thời điểm rà soát. Bản sửa và kết quả kiểm chứng tiếp theo được ghi tại [ADMIN_FIXES_2026-10-28.md](ADMIN_FIXES_2026-10-28.md).
