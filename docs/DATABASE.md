# Thiết kế PostgreSQL

21 bảng nghiệp vụ ánh xạ từ ERD:

| Nhóm | Bảng |
| --- | --- |
| Tài khoản | accounts |
| Sân & lịch | courts, court_prices, court_schedules |
| Đơn & đặt sân | orders, bookings, booking_slots, booking_staff, order_products |
| Thanh toán | payments, refunds |
| Sản phẩm | drinks, rental_items |
| Nhân sự | staff, staff_schedules |
| Giải | tournaments, tournament_registrations, team_members, matches |
| Tài nguyên trận | match_slots, match_staff |

Bổ sung `audit_logs`, `club_settings` phục vụ nhật ký/chính sách. Không có `club_state` JSON. `docs/entities.json` liệt kê mapping Java → PostgreSQL.

Khóa chính UUID; khóa ngoại và index được tạo bởi Flyway. Entity `CustomerOrder` ánh xạ bảng `orders`, entity `TournamentMatch` ánh xạ `matches`. Tên cột snake_case. Tiền dùng `numeric(14,2)`/BigDecimal, không dùng float. Thời điểm dùng `timestamptz`/Instant, ngày lịch LocalDate và giờ LocalTime; nghiệp vụ dùng Asia/Ho_Chi_Minh.

## Ràng buộc và transaction

- Email không trùng (case-insensitive), số phiếu thu/mã giao dịch duy nhất.
- `btree_gist` và EXCLUDE chặn giá/slot sân và lịch nhân sự chồng khoảng thời gian.
- Partial unique index chặn hai liên kết chưa nhả cùng slot trong từng bảng. Trigger kiểm tra chéo BookingSlots/MatchSlots và BookingStaff/MatchStaff, khóa dòng slot chung.
- Các thao tác đặt và xếp trận kiểm tra, khóa và cập nhật trạng thái slot trong một transaction. Khóa theo UUID có thứ tự khi xử lý nhiều slot.
- Ghi nhận tiền khóa Order hoặc Registration; hoàn khóa đối tượng gốc rồi Payment. Số tiền có CHECK và giới hạn nghiệp vụ trong service.
- Stock đồ uống được cập nhật dưới khóa ghi; đồ thuê khóa RentalItem rồi tính tổng số lượng chồng khoảng thuê trước khi thêm.
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

Migration đã áp dụng cần giữ nguyên; thay đổi schema tiếp theo tạo V3__...sql, V4__...sql. Không dùng ddl-auto=update để thay Flyway.
