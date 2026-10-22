# Database và demo Courtly

PostgreSQL 16. Bộ SQL khớp với ứng dụng trên nhánh `nam-dev`, dùng UUID và Flyway V1–V6.

| File | Mục đích |
| --- | --- |
| `init.sql` | Khởi tạo **database trống**, gồm bảng, ràng buộc, index, admin và lịch sử Flyway tương ứng. |
| `query.sql` | Truy vấn chỉ đọc: lịch sân, đơn, tiền, trọng tài, hội viên, giải, feedback và kiểm tra dữ liệu. |
| `test_data.sql` | Dữ liệu giả lập có ngày tương đối theo giờ Việt Nam; cần bật cờ cho phép trong cùng phiên psql. |

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

## Tài khoản và dữ liệu mẫu

- Khách demo: `minh.anh@example.com` / `CourtlyDemo2026`.
- Admin: `admin@gmail.com` / `12345`, theo yêu cầu cấu hình local. Đổi mật khẩu trước khi vận hành công khai.
- `player2@courtly.example` đến `player29@courtly.example`: cùng mật khẩu demo; `player30` bị khóa để thử chặn đăng nhập.
- 30 khách, 10 sân A01–A04/B01–B04/V01–V02, 20.740 khung sân trong 61 ngày, bước 30 phút.
- 244 đơn: 180 quá khứ, 60 sắp tới, 4 đang check-in; 164 đơn thuộc khách demo. Có giữ chỗ, xác nhận, hoàn tất, hủy, hết hạn, thu thiếu/đủ và 15 phiếu hoàn tiền.
- 8 nhân sự, trong đó 3 trọng tài có mức 150.000/180.000/200.000đ mỗi giờ; lịch 38 ngày. Phí 30 phút được tính theo nửa giờ.
- 12 đồ uống, 6 thiết bị tại quầy, đơn đã giao/chưa trả và đã trả thiết bị để thử admin. Khách không có chức năng thuê thiết bị online.
- 7 giải, 28 đăng ký có thu phí, 9 trận đã có kết quả; giải mở đủ người để thử bốc thăm.
- Hội viên hoạt động/hết hạn/chờ/hủy, phiếu thu hội viên, 9 feedback riêng tư/chờ duyệt/công khai, 3 bài tin và thông tin CLB giả lập.

Khách demo bắt đầu ở gói Guest để thử mua hội viên. Player2 là Club để thử ưu đãi VIP 5%. Chiều/tối phần lớn còn trống cho thao tác đặt mới. Các đơn HOLDING hết hạn sau 15 phút tính từ lúc nạp dữ liệu. Bốn đơn check-in dùng kịch bản quầy check-in sớm, giờ sân 18:00–19:00 hôm nay.

File test_data chạy lại sẽ báo đã cài và không nhân đôi dữ liệu. Muốn bắt đầu đợt thử mới với ngày mới, tạo một database test tên khác, không xóa database đang dùng.

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
