# Thiết kế PostgreSQL

21 bảng nghiệp vụ ánh xạ từ ERD:

| Nhóm | Bảng |
| --- | --- |
| Tài khoản | accounts |
| Sân & lịch | courts, court_prices, court_schedules |
| Đơn & đặt sân | orders, bookings, booking_slots, booking_staff, order_products |
| Thanh toán | payments, refunds |
| Sản phẩm (lịch sử) | drinks, rental_items (đã ngừng kinh doanh từ V8; lưu đọc dữ liệu cũ) |
| Nhân sự | staff, staff_schedules |
| Giải | tournaments, tournament_registrations, team_members, matches |
| Tài nguyên trận | match_slots, match_staff |

Bổ sung `audit_logs`, `club_settings` phục vụ nhật ký/chính sách và `app_documents` cho phần mở rộng (tổng 24 bảng ứng dụng). Không có `club_state` JSON. `docs/entities.json` liệt kê mapping Java → PostgreSQL.

Khóa chính UUID; khóa ngoại và index được tạo bởi Flyway. Entity `CustomerOrder` ánh xạ bảng `orders`, entity `TournamentMatch` ánh xạ `matches`. Tên cột snake_case. Tiền dùng `numeric(14,2)`/BigDecimal, không dùng float. Thời điểm dùng `timestamptz`/Instant, ngày lịch LocalDate và giờ LocalTime; nghiệp vụ dùng Asia/Ho_Chi_Minh.

## Ràng buộc và transaction

- Email không trùng (case-insensitive), số phiếu thu/mã giao dịch duy nhất.
- `btree_gist` và EXCLUDE chặn giá/slot sân và lịch nhân sự chồng khoảng thời gian.
- Partial unique index chặn hai liên kết chưa nhả cùng slot trong từng bảng. Trigger kiểm tra chéo BookingSlots/MatchSlots và BookingStaff/MatchStaff, khóa dòng slot chung.
- Các thao tác đặt và xếp trận kiểm tra, khóa và cập nhật trạng thái slot trong một transaction. Khóa theo UUID có thứ tự khi xử lý nhiều slot.
- Ghi nhận tiền khóa Order hoặc Registration; hoàn khóa đối tượng gốc rồi Payment. Số tiền có CHECK và giới hạn nghiệp vụ trong service.
- Dịch vụ đồ uống và thuê thiết bị đã ngừng kinh doanh (từ V8); các bảng và bản ghi cũ được giữ nguyên trạng thái chỉ đọc phục vụ kiểm tra và đối soát doanh thu lịch sử.
- FK kép OrderProduct(booking,order) và các liên kết giải/đăng ký bảo vệ tính nhất quán của quan hệ.
- Scheduler kiểm tra giữ chỗ hết hạn mỗi 30 giây. Thời gian nhả thực tế có thể trễ tối đa một chu kỳ khi backend đang chạy.
- Các cột version trên Order, CourtSchedule, RentalItem, StaffSchedule dùng JPA @Version.

## Khác biệt có chủ đích so với ERD gốc

- Thêm `customer_name`, `customer_phone` để lưu thông tin khách lẻ và giữ snapshot khách trên đơn.
- Sân có giá cơ bản làm fallback khi không có CourtPrice.
- Order có CHECKED_IN ở view nghiệp vụ; Bookings vẫn lưu CheckInAt/CheckOutAt.
- OrderProduct có `returned_at` để theo dõi trả thiết bị; tổng tiền vẫn giữ giá trị thuê ban đầu.
- Trận có `bracket_index`; hai registration nullable cho các trận vòng sau chưa xác định người chơi.
- Không triển khai SQL Server trigger/cú pháp; migration là PostgreSQL.
- Giới hạn chống thu/hoàn vượt mức và số lượng thuê được đảm bảo qua transaction service. Nếu ghi SQL trực tiếp ngoài ứng dụng, phải tuân thủ các quy tắc service; không phải mọi tổng liên bảng đều có trigger.

Migration đã áp dụng cần giữ nguyên; thay đổi schema tiếp theo tạo V4__...sql, V5__...sql. Không dùng ddl-auto=update để thay Flyway.

## V3 và dữ liệu mở rộng

- `accounts.auth_version` thu hồi các phiên cũ khi đổi/reset mật khẩu. BCrypt lưu vào password_hash có sẵn.
- `orders.metadata`: lịch sử thay đổi, snapshot phiếu thu, quyền lợi membership và trạng thái đối soát; các số tiền/quan hệ chính vẫn nằm ở các cột/bảng nghiệp vụ.
- `booking_staff.court_schedule_id` gắn chính xác trọng tài vào slot sân.
- `order_products.item_condition`, `issued_at` phân biệt chưa giao, đang dùng, đã trả, hỏng/mất.
- `club_settings.policies` lưu chính sách tùy chọn.
- `app_documents`: tài liệu club/article/feedback, activation (chỉ hash token), request kết quả idempotency, membership-plan/subscription/receipt. Mỗi tài liệu có key và version; không dùng như một snapshot JSON chứa toàn hệ thống.

Các phần mở rộng nội dung/membership hiện lưu tài liệu có cấu trúc JSON trong app_documents. Khi cần reporting quan hệ phức tạp hoặc dữ liệu lớn, có thể tách chúng thành bảng riêng bằng migration mới; source không giả vờ rằng chúng đã có entity/bảng chuyên biệt.

Dữ liệu D1 trên website cũ chưa được tự nhập vào PostgreSQL. UUID và liên kết của dữ liệu mới do backend tạo. Nếu cần nhập dữ liệu cũ, phải thực hiện mapping ID, đối chiếu tổng tiền và luồng chuyển mật khẩu riêng trước vận hành.
