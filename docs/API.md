# REST API Courtly

Base local: `http://localhost:8080/api`. JSON; ID nghiệp vụ là UUID. React đi qua Vite/Nginx proxy cùng origin.

Lấy `GET /csrf` trước mutation; gửi token qua header được trả trong `headerName`, đồng thời giữ cookie phiên. `401`: chưa đăng nhập/phiên đã thu hồi; `403`: không có quyền/CSRF; `400`: validation hoặc nghiệp vụ; `409`: xung đột ràng buộc.

| Method | Endpoint | Quyền / mục đích |
| --- | --- | --- |
| GET | `/csrf` | Công khai, khởi tạo token CSRF |
| GET | `/auth/session` | Trạng thái đăng nhập; không trả mật khẩu |
| POST | `/auth/register`, `/auth/login` | Tạo/đăng nhập tài khoản |
| POST | `/auth/logout`, `/auth/password` | Đăng xuất / đổi mật khẩu của phiên hiện tại |
| POST | `/auth/ticket` | Admin cấp mã 24h cho accountId |
| POST | `/auth/activate` | Mã một lần và mật khẩu mới |
| GET | `/public/overview?date=YYYY-MM-DD` | Sân/giá/lịch/giải/gói đang công bố, không dữ liệu riêng |
| GET | `/public/content` | Giới thiệu, liên hệ, tin công khai, feedback đã đồng ý và duyệt |
| GET | `/overview?date=YYYY-MM-DD` | View có lọc quyền; admin có vận hành, khách chỉ dữ liệu của mình |
| GET | `/health` | Trạng thái backend, cần đăng nhập |
| PATCH | `/profile` | Khách/admin sửa tên và điện thoại của mình |
| POST | `/schedules/generate` | Sinh slot còn thiếu 06:00–23:00 |
| POST | `/booking/options` | scheduleIds, accountId tùy chọn của admin, excludeId của đơn thuộc quyền; giá và lịch trọng tài |
| POST | `/orders` | requestId, scheduleIds, assignments và khách; customer không được đặt hộ tài khoản khác |
| POST | `/orders/{id}/preview` | Xem lịch mới, phân công và chênh lệch, chưa ghi |
| PATCH | `/orders/{id}/schedule` | requestId, scheduleIds, assignments, reason của admin |
| POST | `/orders/{id}/cancel` | Hủy toàn đơn theo quyền/điều kiện, admin có lý do |
| POST | `/orders/{id}/check-in`, `/check-out` | Admin vận hành tại quầy |
| POST | `/orders/{id}/invoice` | Admin tạo phiếu thu có snapshot |
| GET, POST | `/orders/{id}/services` | Admin xem khả dụng / thêm đồ thuê tại quầy |
| POST | `/orders/{id}/products` | Admin thêm sản phẩm |
| POST | `/orders/{id}/products/{lineId}/return` | Admin ghi GOOD/DAMAGED/MISSING/READY |
| POST | `/orders/{id}/staff` | Admin gắn assignments theo slot cụ thể |
| POST | `/orders/{id}/review`, `/refund-request` | Admin lưu đối soát / khoản cần hoàn, không tự chuyển tiền |
| POST | `/orders/{id}/restore` | Admin khôi phục sau đối soát, kiểm tra lại tài nguyên |
| POST | `/payments` | Admin xác minh đã nhận tiền; đúng một orderId/registrationId, amount, method, transactionCode |
| POST | `/payments/{id}/refunds` | Admin ghi nhận hoàn thực tế; requestId, amount, reason |
| POST, PUT | `/catalog/{collection}[/{id}]` | Admin danh mục sân, giá, tài khoản, đồ uống/đồ thuê, nhân sự, lịch nhân sự, giải |
| POST | `/tournaments/{id}/registrations` | Đăng ký giải; customer chỉ đăng ký tài khoản của mình |
| POST | `/tournaments/{id}/draw` | Admin bốc thăm 2/4/8/16... đăng ký xác nhận |
| PUT | `/matches/{id}/schedule` | Admin xếp sân và trọng tài |
| POST | `/matches/{id}/result` | Admin ghi winnerId và score, đẩy người thắng sang trận kế |
| PUT | `/settings` | Admin chính sách giữ/cọc/hoàn và policies |
| GET | `/content`, `/feedback/mine` | Nội dung admin / phản hồi của người đang đăng nhập |
| PUT | `/content/club` | Admin sửa thông tin CLB |
| POST, PUT | `/content/articles[/{id}]` | Admin biên tập, nháp/xuất bản |
| POST | `/feedback` | Khách gửi feedback có requestId và publishConsent |
| PATCH | `/content/feedback/{id}` | Admin duyệt/trả lời, không tự vượt consent |
| PUT | `/membership/plans` | Admin sửa/tạm dừng gói; không đổi điều kiện của đăng ký đã tạo |
| POST | `/membership/requests` | Khách gửi requestId + planId, chờ xác nhận |
| POST | `/membership/requests/{id}/cancel` | Chủ đăng ký/admin hủy yêu cầu chưa kích hoạt |
| POST | `/membership/requests/{id}/activate` | Admin, requestId, amount, method, transactionCode, collected=true; chỉ sau xác minh đủ phí |

`assignments` có dạng `[{"scheduleId":"uuid-slot","staffId":"uuid-referee"}]`. Không chấp nhận giá/rate do client tự quyết định.

Các request tạo/đổi/thu/hoàn quan trọng cần giữ nguyên requestId hoặc mã giao dịch khi retry. Thay lựa chọn phải tạo requestId mới. Chưa tích hợp callback ngân hàng; nút ở quầy ghi nhận tiền đã xác minh.
