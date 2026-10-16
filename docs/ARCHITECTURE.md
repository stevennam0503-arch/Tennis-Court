# Kiến trúc MVC của Courtly

## Ranh giới trách nhiệm

| Tầng | Các lớp tiêu biểu | Quy tắc |
| --- | --- | --- |
| View | React pages/components | Render dữ liệu, trạng thái tải/lỗi; không quyết định quyền, giá cuối cùng hoặc xác nhận thanh toán |
| Controller | AuthController, OrderController, CatalogController, PaymentController, TournamentController, MembershipController, ContentController, OverviewController | HTTP/JSON, DTO và chuyển lời gọi tới service |
| Application/domain service | OrderApplicationService, OrderService, BookingSupportService, PaymentService, MembershipService | Kiểm tra điều kiện, tính tiền và điều phối transaction |
| Presentation service | PresentationService, OverviewService | View model có chọn trường, lọc dữ liệu theo tài khoản, finance và lịch sử |
| Repository | Spring Data JPA interfaces | Truy vấn và khóa ghi; không đưa Entity trực tiếp cho frontend |
| Entity | Account, Court, CustomerOrder, Booking, Payment, Tournament... | Model quan hệ của PostgreSQL |
| Cross-cutting | SecurityConfig, ApiAccessInterceptor, RequestService, GlobalExceptionHandler | Session/CSRF, quyền truy cập, retry và lỗi thống nhất |

## Chống ghi lặp và xung đột

`RequestService` dùng khóa advisory trong transaction PostgreSQL cho các thay đổi của ứng dụng nhỏ và lưu kết quả theo tài khoản + requestId. Cùng mã/cùng payload trả kết quả đã ghi; cùng mã/khác payload bị từ chối. Các tài nguyên sân/nhân sự/đơn còn có row lock, unique/exclusion constraints và trigger kiểm tra chéo đặt sân/giải đấu.

Các lần thu tiền dùng mã phiếu thu/giao dịch riêng. Hoàn tiền cần requestId và được giới hạn theo khoản thu còn lại. Tất cả thay đổi nằm trong transaction; lỗi phân công hoặc xung đột làm rollback toàn bộ, không để lịch cũ bị nhả một phần.

Khóa advisory này ưu tiên tính rõ ràng cho quy mô CLB; chưa phải thiết kế tối ưu cho tải lớn. Khi mở rộng cần partition phạm vi khóa, truy vấn/phân trang và kiểm thử trên PostgreSQL native nhiều connection.

## Bảo mật

- Spring Security bảo vệ `/api/**`; chỉ public overview/content, session/auth và CSRF khởi tạo được truy cập trước đăng nhập.
- BCrypt và cookie session HttpOnly/SameSite; React lấy CSRF token và gửi trong header cho POST/PUT/PATCH.
- Role/khóa tài khoản được đọc lại từ database; phiên có authVersion để thu hồi sau đổi/reset mật khẩu.
- Khách chỉ xem và sửa đơn/tài khoản của mình; dữ liệu vận hành và danh bạ không được trả trong customer overview.
- Mã kích hoạt random, lưu SHA-256, hết hạn và chỉ dùng một lần. Mã mới vô hiệu các mã cũ cùng tài khoản.
- Nội dung tin tức là text; feedback riêng chỉ xuất bản khi có consent và quản trị duyệt.

## Thiết kế giao diện

`styles.css` giữ layout admin. `customer.css` chỉ đặt style cho phần public/customer và các component membership mới. Logo dùng nguyên asset gốc. Các trang thông tin công khai và luồng tài khoản dùng chung header/footer; menu avatar chứa hồ sơ, đơn, lịch sử và membership.
