# Kết quả kiểm tra — 15/10/2026

Kết quả áp dụng cho source trong gói ZIP này.

| Hạng mục | Kết quả | Phạm vi |
| --- | --- | --- |
| Maven `clean verify` | Đạt | Java 17, Spring Boot 3.5.16; compile và đóng gói executable JAR |
| JUnit | 9/9 đạt | Thanh toán/hoàn tiền, điều kiện lịch sân, tiền sản phẩm; không bỏ qua test |
| React/Vite build | Đạt | React 19.3, Vite 8.3.3; bundle production tạo thành công |
| Migration SQL V1–V3 | Đạt | Áp dụng trực tiếp PostgreSQL engine của PGlite: 24 bảng, btree_gist, FK, CHECK, index và trigger |
| Spring Boot/JDBC/Hibernate | Đạt | Khởi động JAR, `ddl-auto=validate`, khởi tạo database và tài khoản quản trị local |
| HTTP tích hợp | 80 yêu cầu đạt | Kịch bản `tests/smoke-api.mjs`; gồm cả thành công và các từ chối mong đợi |
| Render React | 20 màn + 2 shell đạt | SSR với fixture tổng hợp lấy từ API thử nghiệm; kiểm tra shell admin/customer riêng |
| Logo và CSS admin | Giữ nguyên | Favicon và styles.css được đối chiếu byte với source Courtly trước chuyển đổi; CSS khách tách file |

## Các luồng HTTP đã kiểm tra

- Public overview không lộ danh bạ/đơn; khách chưa đăng nhập không được gọi private overview.
- Đăng ký, đăng nhập, session cookie, CSRF; tài khoản khách không được sửa danh mục hoặc dữ liệu của khách khác.
- Chọn hai slot liên tiếp, trọng tài chỉ một slot; server tự tính giá, lịch trùng bị từ chối.
- Gửi lại cùng requestId trả cùng kết quả, kể cả thứ tự khóa JSON thay đổi; thay payload với mã cũ bị từ chối.
- Thu đủ tiền, xác nhận đơn; đổi lịch rẻ hơn có đối soát, snapshot phiếu thu và tiền thực thu được giữ nguyên; hoàn lặp không tạo thêm giao dịch.
- Check-in ngoại lệ có lý do; khách không hủy sau check-in. Check-out và ghi nhận trả thiết bị là các thao tác riêng.
- Thuê thiết bị chỉ tại quầy; nhận trả thiết bị được lưu đúng dòng đơn.
- Feedback riêng không xuất bản khi thiếu consent; feedback được đồng ý và duyệt mới công khai; tin nháp chuyển xuất bản có publishedAt.
- Profile chỉ nhận các trường được phép; mã đặt lại dùng một lần và thu hồi phiên cũ.
- Membership chờ xác nhận; khách không tự kích hoạt; admin phải xác minh đủ phí; receipt không ghi lặp; người khác không nhìn thấy gói riêng; giảm tiền sân do server tính.
- Đăng ký giải đúng tài khoản, bốc thăm, xếp sân/trọng tài, nhập kết quả và hoàn tất giải.
- Hai yêu cầu đặt cùng slot đồng thời chỉ có một yêu cầu được chấp nhận.

## Giới hạn kiểm tra

Môi trường không chạy Docker/PostgreSQL 16 native. Harness dùng **PGlite PostgreSQL 18.3 engine**, kết nối JDBC qua PostgreSQL wire protocol, một connection. Migration được thực thi trực tiếp trước khi khởi động Java, và Flyway chỉ tắt trong harness. Source bàn giao vẫn bật Flyway. Chưa chạy thử Compose hoặc vòng đời Flyway đầy đủ trên PostgreSQL 16 native, kiểm tra tải/đa connection hoặc thao tác bằng trình duyệt.

SSR kiểm tra cấu trúc component và dữ liệu API, không chứng nhận responsive hoặc accessibility bằng trình duyệt. Chưa kiểm tra toàn bộ ma trận thiết bị, thao tác bàn phím và zoom 200%.

Các tích hợp ngân hàng/email/SMS và module còn ghi rõ trong README chưa được kết nối. Kết quả trên không có nghĩa mọi module đã đạt production.

## Tái chạy

- `backend/`: `./mvnw verify`
- `frontend/`: `npm ci` rồi `npm run build`
- Sau khi backend và database thử nghiệm chạy: `node tests/smoke-api.mjs`
- Sau khi cài frontend dependencies: `node tests/render-pages.mjs`

Smoke test tạo dữ liệu; dùng database thử riêng. Fixture SSR là dữ liệu tổng hợp của bài kiểm tra, không phải dữ liệu người dùng trên website cũ.
