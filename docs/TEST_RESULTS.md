# Kết quả kiểm tra — 09/10/2026

Các kết quả dưới đây là kiểm tra đã thực sự chạy trên source trong ZIP.

| Hạng mục | Kết quả | Phạm vi |
| --- | --- | --- |
| Backend Maven `clean verify` | Đạt | Java 17, Spring Boot 3.5.16; biên dịch và đóng gói executable JAR. |
| Unit test | 9/9 đạt | 5 test thanh toán/hoàn tiền, 2 test điều kiện sân, 2 test tính tiền sản phẩm. Không bỏ qua test. |
| Frontend `npm run build` | Đạt | React 19.3, Vite 8.3.3; 1.751 module, bundle được tạo thành công. |
| Migration SQL V1 và V2 | Đạt | Thực thi SQL trực tiếp trên PostgreSQL engine của PGlite, gồm 23 bảng, extension btree_gist, FK, CHECK, index và trigger. |
| Spring Boot + JDBC + Hibernate | Đạt | Khởi động ứng dụng, `ddl-auto=validate`, khởi tạo dữ liệu mẫu và gọi REST API trên database thử nghiệm. |
| API nghiệp vụ | 45 lượt yêu cầu đạt | Kịch bản trong `tests/smoke-api.mjs`; kiểm tra cả phản hồi thành công và từ chối theo nghiệp vụ. |
| Render React với dữ liệu API | 11/11 trang đạt | Server-side render các trang lịch sân, đơn, tiền, sân, sản phẩm, nhân sự, khách, giải, báo cáo, hệ thống, thông báo. |

## Luồng API đã kiểm tra

- Tạo sân, sinh slot, đặt nhiều slot; từ chối đặt trùng sân.
- Thu cọc để xác nhận, từ chối thu dư; tính tổng tiền sân + đồ uống + thuê đồ + nhân sự.
- Trừ tồn đồ uống và từ chối vượt tồn; kiểm tra đồ thuê chồng giờ.
- Tạo lịch nhân sự, phân công; check-in và từ chối check-out khi còn thiếu tiền.
- Thu phần còn lại, check-out, cấp số phiếu thu; từ chối hoàn vượt khoản đã thu, hoàn một phần.
- Đổi lịch và nhả slot cũ; hủy đơn và nhả slot đang giữ.
- Tạo giải, hai đăng ký và phí giải; sinh nhánh, xếp sân/trọng tài, chặn trùng với khách đặt, nhập kết quả, hoàn tất giải.
- Xác nhận phí giải không bị gắn nhầm vào đơn sân.

Trong quá trình kiểm tra đã sửa lỗi khởi tạo `@Version`: các entity dùng `Long version` để giá trị ban đầu là `null`, cho phép Spring Data nhận diện entity mới. Hibernate tự gán version khi persist. Luồng tạo đơn/slot/lịch nhân sự/thiết bị đã chạy lại sau khi sửa.

## Giới hạn của lần kiểm tra này

- Môi trường không có Docker. Chưa chạy toàn bộ Compose hoặc PostgreSQL 16 native. Database kiểm tra là **PGlite (PostgreSQL 18.3 engine)**, kết nối JDBC qua PostgreSQL wire protocol với một connection trong pool.
- Do giới hạn đa kết nối của harness PGlite, SQL migration được áp dụng trực tiếp trước khi chạy Java; Flyway chỉ bị tắt bằng tham số của harness. **Source ứng dụng vẫn bật Flyway**. Chưa xác nhận vòng đời migration của Flyway khi chạy cùng PostgreSQL 16 native.
- Kịch bản API chạy tuần tự. Các ràng buộc và khóa đã được triển khai, nhưng chưa chạy bài kiểm tra tranh chấp đồng thời trên PostgreSQL native hoặc kiểm tra tải.
- Render React kiểm tra component và dữ liệu API. Chưa có kiểm tra tự động thao tác trình duyệt, ảnh chụp giao diện hay ma trận thiết bị.
- Đăng nhập/phân quyền, QR/callback ngân hàng và các phần được ghi trong mục “Phạm vi còn lại” của README chưa được triển khai; kết quả test không có nghĩa toàn bộ 50 module đã hoàn tất.

## Chạy lại trên máy bạn

1. Tại thư mục gốc: `docker compose up --build`.
2. Chờ API `http://localhost:8080/api/health` trả `UP`.
3. Chạy `node tests/smoke-api.mjs` từ thư mục gốc trên database thử nghiệm. Script tạo dữ liệu và không tự xóa; không dùng với dữ liệu đang vận hành.
4. Với môi trường phát triển riêng, chạy `./mvnw verify` trong `backend`, và `npm ci` rồi `npm run build` trong `frontend`.

