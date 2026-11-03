# Courtly — Java Spring Boot MVC + ReactJS

Hệ thống quản lý CLB tennis 10 sân: mở bán sân và bảng giá, đặt sân và thanh toán cọc VietQR, check-in/check-out tại quầy, hội viên, voucher, giải đấu, trọng tài, đối soát và báo cáo doanh thu. Chạy bằng **Java 17, Spring Boot 3.5.16, React 19.3, Vite 8.3 và PostgreSQL 16**; Node.js chỉ dùng để build React.

Tài liệu nên đọc trước:

- [Kịch bản demo Hội đồng](docs/HUONG_DAN_DEMO_HOI_DONG.md) — tài khoản, 17 đơn mẫu, cách reset dữ liệu.
- [Tài liệu nghiệp vụ và yêu cầu hệ thống](TAI_LIEU_NGHIEP_VU_VA_YEU_CAU_HE_THONG_COURTLY.md).
- [Kiến trúc](docs/ARCHITECTURE.md), [API](docs/API.md), [Database](docs/DATABASE.md), [Thanh toán](docs/PAYMENTS.md), [dữ liệu demo 2 tháng](database/README.md).

## Chạy demo bằng Docker

Yêu cầu Docker Desktop đang chạy (Windows: mở Docker Desktop, chờ "Engine running").

1. Sao chép `.env.example` thành `.env`, rồi đặt cho môi trường demo:

   ```dotenv
   SEED_DEMO=true
   DEMO_MODE=true
   PAYMENT_MODE=DEMO
   ```

   Điền `SMTP_PASSWORD` (mật khẩu ứng dụng Gmail) nếu muốn gửi email OTP thật; với `DEMO_MODE=true` mã OTP thử được trả trong phản hồi API. Muốn chatbot dùng Gemini, điền `VITE_GEMINI_API_KEY` trong `frontend/.env` trước khi build; không có key thì chatbot dùng bộ trả lời cục bộ.

2. Build và chạy:

   ```sh
   docker compose up -d --build
   ```

3. Mở **http://localhost:3000**. API ở `http://localhost:8081/api`, PostgreSQL ở `localhost:5433`.

4. Đăng nhập `admin@gmail.com` / `12345` (mật khẩu khởi tạo của database mới), vào **Hệ thống & module → Đặt lại dữ liệu mẫu Hội đồng**. Sau khi reset, các tài khoản mẫu đều dùng mật khẩu `123456`:

   | Vai trò | Email |
   | --- | --- |
   | ADMIN | `admin@gmail.com` |
   | STAFF (lễ tân, thu ngân) | `staff@gmail.com` |
   | Khách hội viên Plus | `hoangnam@gmail.com` |
   | Khách thường | `khachmoi@gmail.com` |

Reset khôi phục toàn bộ giao diện và dữ liệu danh mục về nguyên vẹn theo ảnh chụp chuẩn (baseline snapshot tại `backend/src/main/resources/demo/baseline.json`): 10 sân chuẩn (`Sân A01`–`A04`, `Sân B01`–`B04`, `Sân V01`–`V02`), bảng giá theo giờ, nhân sự và trọng tài, giải đấu, gói hội viên, 7 mã voucher, bài viết tin tức, thông tin CLB và cài đặt hệ thống (giữ chỗ 5 phút, cọc 50%). Toàn bộ sân tạo thêm hoặc sân đã ngừng bị dọn dẹp sạch; tab "Đã ngừng khai thác" trống; tài khoản và 17 đơn mẫu được tạo mới bám theo ngày hiện tại với mật khẩu `123456`. Reset chỉ hoạt động khi `DEMO_MODE=true`; có thể chạy từ terminal tại thư mục gốc bằng `.\reset-demo.ps1` (PowerShell), `reset-demo.bat` (nhấp đúp) hoặc `python scripts/seed_showcase.py`.

Khi muốn thay đổi trạng thái chuẩn (đổi giá, mô tả sân, thêm giải đấu chuẩn...): chỉnh sửa qua giao diện Admin hoặc SQL, sau đó chạy `python scripts/export_demo_baseline.py` để chụp lại snapshot và build lại backend.

Cập nhật bản đang chạy: `git pull`, rồi `docker compose up -d --build`. Backend tự chạy migration Flyway; không nhập lại SQL và không xóa volume `postgres_data` (`docker compose down -v` sẽ xóa database).

## Chạy riêng bằng IDE

Yêu cầu JDK 17+, Node.js 22.12+, PostgreSQL 16 (có thể dùng `docker compose up -d postgres`).

```powershell
cd backend
$env:DB_URL="jdbc:postgresql://localhost:5433/courtly"; $env:SERVER_PORT="8081"; $env:SEED_DEMO="true"; $env:DEMO_MODE="true"
.\mvnw.cmd spring-boot:run
```

```sh
cd frontend
npm ci
npm run dev
```

Mở **http://localhost:5173**; Vite proxy `/api` tới `http://localhost:8081` (đổi bằng `API_PROXY_TARGET`).

| Biến | Ý nghĩa |
| --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Kết nối PostgreSQL |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Email chủ sân; `ADMIN_PASSWORD` để trống thì database mới dùng `12345` (chỉ ngoài production) |
| `SEED_DEMO` | `true` để tạo 10 sân, nhân sự, trọng tài và giải mẫu khi database chưa có sân |
| `DEMO_MODE` | `true` để bật reset dữ liệu mẫu, mã OTP thử và thanh toán mô phỏng; production luôn tắt |
| `PAYMENT_MODE` | `DEMO`/`SANDBOX` (mô phỏng), `MANUAL`, `LIVE`/`SEPAY` (webhook ngân hàng thật) |
| `SMTP_*` | Gmail SMTP gửi OTP đăng ký và quên mật khẩu |
| `COOKIE_SECURE` | `true` khi chạy qua HTTPS |

## Tổ chức mã nguồn

React là View; Spring MVC cung cấp REST Controller; nghiệp vụ nằm ở Service; Entity và Repository là tầng Model. Mọi số tiền, quyền và xác nhận thanh toán do server quyết định.

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `backend/.../controller/` | REST API theo nhóm: tài khoản, đơn, thanh toán, chuyển khoản, danh mục, giải, nội dung, membership |
| `backend/.../service/` | Nghiệp vụ, phân quyền dữ liệu, transaction, tính tiền, reset demo |
| `backend/.../repository/`, `entity/` | Spring Data JPA, khóa dòng chống đặt trùng |
| `backend/.../config/` | Spring Security, CSRF, phân quyền API, khởi tạo dữ liệu, kiểm tra cấu hình production |
| `backend/src/main/resources/db/migration/` | Flyway V1–V13 |
| `frontend/src/guest/` | Giao diện khách VI/EN: tổng quan, bảng giá, đặt sân, QR, giải đấu, chatbot AI |
| `frontend/src/pages/`, `components/` | Màn hình ADMIN/STAFF và khu tài khoản khách |
| `database/` | `init.sql`, truy vấn mẫu và bộ dữ liệu demo 2 tháng |
| `docs/` | Tài liệu kỹ thuật, kịch bản demo, báo cáo rà soát |
| `tests/` | Kiểm thử đơn vị JS, API và trình duyệt |

## Chức năng chính

- **Vai trò:** ADMIN (chủ sân), STAFF (lễ tân, thu ngân), CUSTOMER; khách vãng lai xem sân, giá, giải đấu.
- **Mở bán & Bảng giá:** 10 sân chia 3 khu (ngoài trời, trong nhà, VIP); nguồn giá duy nhất (Single Source of Truth) quản lý theo phân khu (ngày thường / cuối tuần, các khung giờ phủ kín 06:00–23:00). Admin đổi bảng giá khu kèm ngày hiệu lực, hệ thống tự động cập nhật đồng bộ cho mọi sân trong khu và cập nhật tức thì đơn giá các slot còn trống (`AVAILABLE`/`MAINTENANCE`) từ ngày áp dụng; đơn đã đặt giữ nguyên đơn giá lịch sử. Toàn bộ giao diện khách (bảng giá, sơ đồ sân, form đặt sân, AI chatbot) đồng bộ trực tiếp từ server, không dùng công thức tính giá cục bộ. Bảo trì linh hoạt theo từng khung giờ.
- **Vòng đời sân:** Hoạt động → Bảo trì (tạm đóng) → Ngừng khai thác (ẩn khỏi trang đặt sân, giữ lịch sử và bảng giá, có thể Mở lại). Sân chưa từng có đơn mới bị xóa hẳn. Không ngừng hoặc bảo trì được sân còn đơn sắp tới; không tạo sân mới trùng tên sân đã ngừng.
- **Đặt sân:** đặt lẻ hoặc định kỳ 4/8/12 tuần, nhiều sân một đơn, thuê trọng tài; giữ chỗ 5 phút; chống đặt trùng bằng khóa dòng và ràng buộc database; cọc 50% qua VietQR hoặc tại quầy.
- **Ưu đãi:** hội viên Club giảm 10% sân thường / 5% VIP, Plus 15% / 10%; voucher có giới hạn lượt.
- **Vận hành:** check-in bằng QR, gia hạn giờ, thu tiền mặt, check-out khi đã thu đủ, phiếu thu K80/A4, đổi lịch có xem trước chênh lệch.
- **Hủy và hoàn:** hủy từ 24 giờ trở lên trước giờ chơi hoàn 100% cọc, 12 đến dưới 24 giờ hoàn 50%, dưới 12 giờ không hoàn; khoản hoàn chờ Admin duyệt chi.
- **Chăm sóc và báo cáo:** feedback 1–5 sao do Admin duyệt; đối soát ngoại lệ thanh toán; báo cáo doanh thu theo ngày/tháng/quý/năm, CSV và PDF.

## Build và kiểm thử

```sh
cd backend
./mvnw verify
```

```sh
cd frontend
npm ci
npm run build
```

```sh
node --test tests/booking-time.test.mjs tests/order-visits.test.mjs tests/pricing.test.mjs tests/report-period.test.mjs
```

Các file `*.test.mjs` còn lại gọi backend thật và sửa dữ liệu (kể cả mật khẩu admin), chỉ chạy trên database riêng.

Kiểm thử 4 luồng demo trên database demo đang chạy (script tự reset dữ liệu trước và sau khi chạy):

```powershell
$env:COURTLY_TEST_WRITE="1"; node tests/demo-flows-api.mjs
```

Các script API khác trong `tests/` tạo dữ liệu thử; chỉ chạy trên database riêng, xem ghi chú đầu mỗi file.

## Giới hạn hiện tại

- Chưa thử chuyển tiền ngân hàng thật và triển khai production; demo dùng thanh toán mô phỏng.
- Feedback chưa gắn với một đơn đã sử dụng; chỉ ADMIN duyệt và xem feedback.
- Bundle JavaScript khoảng 1,2 MB (chưa chia nhỏ), chỉ ảnh hưởng lần tải đầu.
