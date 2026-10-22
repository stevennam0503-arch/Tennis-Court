# Database và demo Courtly

PostgreSQL 16. Bộ SQL khớp với ứng dụng trên nhánh `nam-dev`, dùng UUID và Flyway V1–V6.

| File | Mục đích |
| --- | --- |
| `init.sql` | Khởi tạo **database trống**, gồm bảng, ràng buộc, index, admin và lịch sử Flyway tương ứng. |
| `query.sql` | Truy vấn chỉ đọc: lịch sân, đơn, tiền, trọng tài, hội viên, giải, feedback và kiểm tra dữ liệu. |
| `test_data.sql` | Dữ liệu giả lập doanh nghiệp thực tế 2 tháng; nạp vào bằng cờ `courtly.allow_test_data='on'`. |
| `generate_seed_data.py` | Script Python sinh dữ liệu demo doanh nghiệp hoàn chỉnh 2 tháng (1.050+ đơn, 65 tài khoản, 10 nhân sự). |

Database đã chạy ứng dụng: **không nhập lại init.sql**. Backend tự áp dụng migration mới, giữ các đơn và lịch cũ. Không xóa volume hoặc sửa checksum Flyway để cập nhật.

## Dựng demo riêng trên Windows PowerShell

Chạy trong thư mục repository. Sao chép `.env.example` thành `.env` nếu chưa có; nếu đã có thì chỉ sửa các dòng sau:

```dotenv
POSTGRES_DB=courtly_demo
SEED_DEMO=false
PAYMENT_MODE=SANDBOX
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=
```

`courtly_demo` phải là database mới. Các lệnh dưới đây giả định user PostgreSQL là `courtly`; thay tương ứng nếu bạn đã cấu hình khác.

```powershell
docker compose up -d postgres
docker compose exec -T postgres pg_isready -U courtly
docker compose exec -T postgres psql -U courtly -d postgres -c "SELECT datname FROM pg_database WHERE datname='courtly_demo';"
```

Chờ `pg_isready` báo nhận kết nối. Nếu truy vấn trả 0 dòng, tạo database:

```powershell
docker compose exec -T postgres createdb -U courtly courtly_demo
```

Nếu container mới đã tạo `courtly_demo` từ `POSTGRES_DB`, bỏ qua lệnh `createdb`. Chỉ nhập init vào database trống:

```powershell
docker compose cp ./database/init.sql postgres:/tmp/courtly-init.sql
docker compose cp ./database/test_data.sql postgres:/tmp/courtly-test-data.sql
docker compose cp ./database/query.sql postgres:/tmp/courtly-query.sql
docker compose exec -T postgres psql -U courtly -d courtly_demo -v ON_ERROR_STOP=1 -f /tmp/courtly-init.sql
docker compose exec -T postgres psql -U courtly -d courtly_demo -v ON_ERROR_STOP=1 -c "SET courtly.allow_test_data='on'" -f /tmp/courtly-test-data.sql
docker compose up -d --build
```

SQL dùng UTF-8. `docker compose cp` tránh lỗi mã hóa khi pipe file qua Windows PowerShell cũ. Không cần nhập init nếu backend đã tạo schema bằng Flyway; có thể nạp test_data vào database test đã migrate nhưng chưa có dữ liệu demo cũ.

Kiểm tra dữ liệu:

```powershell
docker compose exec -T postgres psql -U courtly -d courtly_demo -v ON_ERROR_STOP=1 -f /tmp/courtly-query.sql
```

## Tài khoản và dữ liệu mẫu doanh nghiệp thật (2 tháng)

Bộ dữ liệu demo được thiết kế tương đương một câu lạc bộ tennis thực tế đang vận hành trong 2 tháng (45 ngày quá khứ, ngày hôm nay và 14 ngày tới):

### Danh sách tài khoản đăng nhập demo

| Vai trò | Email đăng nhập | Mật khẩu | Mục đích demo |
| --- | --- | --- | --- |
| **Quản trị viên (Chủ sân)** | `admin@gmail.com` | `12345` hoặc `CourtlyDemo2026` | Quản trị toàn quyền: dashboard, tài chính, báo cáo, phân quyền, cấu hình hệ thống. |
| **Lễ tân ca sáng** | `letan.huong@courtly.vn` | `CourtlyDemo2026` | Vận hành quầy lễ tân: check-in, check-out, nhận trả đồ thuê, bán nước, thu tiền mặt/QR. |
| **Lễ tân ca chiều** | `letan.duc@courtly.vn` | `CourtlyDemo2026` | Ca chiều tối: xếp lịch sân, phân công trọng tài, xác nhận đơn cọc. |
| **Quản lý sân bãi** | `quanly.tuan@courtly.vn` | `CourtlyDemo2026` | Điều hành lịch sân, bảo trì, giám sát nhân sự & giải đấu. |
| **Khách hàng VIP (Demo chính)** | `minh.anh@example.com` | `CourtlyDemo2026` | Nguyễn Minh Anh: Hội viên Club/Plus, có đơn đang chơi hôm nay (thuê vợt chưa trả), lịch sử đơn dày dặn. |
| **Khách hàng thường (60 khách)** | `quocbao.kts@gmail.com`, `hoangnam.tennis@gmail.com`, ... | `CourtlyDemo2026` | 60 khách hàng thật với họ tên, số điện thoại Việt Nam chuẩn để thử nghiệm danh sách và lịch sử. |
| **Tài khoản bị khóa** | `quangthang.locked@example.com` | `CourtlyDemo2026` | Kiểm tra tính năng chặn đăng nhập đối với tài khoản vi phạm. |

### Thống kê khối lượng dữ liệu (Doanh nghiệp 2 tháng)

- **10 Sân tiêu chuẩn**: A01–A04 (ngoài trời - 200k/h), B01–B04 (trong nhà mái che - 300k/h), V01–V02 (VIP Lounge - 500k/h).
- **20.400 Khung giờ sân**: 60 ngày (-45 ngày đến +14 ngày), bước 30 phút từ 06:00 đến 23:00.
- **1.057 Đơn đặt sân**:
  + 742 đơn `COMPLETED` (đã chơi xong, thanh toán 100%, ghi nhận doanh thu).
  + 224 đơn `CONFIRMED` (171 đơn đã cọc 50%, 53 đơn thanh toán đủ).
  + 5 đơn `CHECKED_IN` hôm nay (khách đang chơi trên sân, có thuê vợt và order nước tại quầy chờ thanh toán khi check-out).
  + 27 đơn `CANCELLED` (trong đó 13 đơn có phiếu `refunds` hoàn lại cọc hợp lệ).
  + 19 đơn `EXPIRED` (hết hạn giữ chỗ 15 phút).
  + 40 đơn `HOLDING` (đang giữ chỗ, có đồng hồ đếm ngược).
- **10 Nhân sự chuyên môn**:
  + 4 Huấn luyện viên (ITF Level 2, cựu VĐV quốc gia, giá 200k–250k/h).
  + 4 Trọng tài (VTF Level 1, trọng tài giải vô địch, giá 140k–180k/h).
  + 2 Nhân viên nhặt bóng (80k/h).
  + 20.400 ca trực, tổng hợp công trên đơn hoàn tất (tab Payroll) hiển thị chính xác số giờ và tiền công từng người.
- **Doanh thu ròng**: Đạt **~418.000.000 VNĐ** (Tiền sân + Dịch vụ nước + Đồ thuê + HLV + Giải đấu).
- **Dịch vụ quầy**: 12 loại đồ uống (Lavie, Pocari, Revive, Red Bull, Cocoxim, Monster...), 6 loại vợt và bóng (Wilson, Babolat, Head, Yonex).
- **6 Giải đấu**: 4 giải kết thúc có bảng điểm bán kết/chung kết, 2 giải mở đăng ký đang nhận VĐV nộp lệ phí.
- **20 Hội viên**: Gói Club & Plus với biên lai thu phí hội viên và quyền lợi giảm 10%–15%.
- **15 Đánh giá / Feedback**: Phản hồi thực tế 5 sao từ người chơi.

## Nâng cấp lần sau

```powershell
git pull --ff-only origin nam-dev
docker compose up -d --build
```

Docker không tự lấy code GitHub. Lệnh trên build lại image và cập nhật container cần thiết, giữ volume dữ liệu. Khi yêu cầu nghiệp vụ thay đổi, cập nhật bằng migration mới trong `backend/src/main/resources/db/migration`, rồi đồng bộ init/query/fixtures và kiểm tra trên database riêng. Không chỉnh migration đã phát hành.

## Bổ sung sân trong nhà và VIP cho bản Docker cũ

V6 thêm các sân còn thiếu B01–B04 (300.000đ/giờ), V01–V02 (500.000đ/giờ) vào database đã có sân. Sân cũ, giá đã chỉnh, trạng thái bảo trì và đơn cũ được giữ nguyên. Các mức giá mới là giá mặc định theo bộ demo; có thể chỉnh trong trang quản lý sân. Backend tạo lịch 30 phút theo ngày khi mở trang đặt sân. Không cần nhập `test_data.sql` để có sáu sân này.

Cài mới với `SEED_DEMO=true` tạo đủ A01–A04/B01–B04/V01–V02. Với `SEED_DEMO=false` và database trống, dùng bộ SQL demo hoặc tạo sân qua admin như trước.

Để áp dụng V6 vào database cũ, cần build và khởi động lại **cả backend và frontend**:

```powershell
git pull --ff-only origin nam-dev
docker compose up -d --build --force-recreate backend frontend
```

Không xóa volume PostgreSQL. Chỉ build frontend sẽ chưa bổ sung sân.
