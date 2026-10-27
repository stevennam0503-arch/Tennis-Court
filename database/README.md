# Database và demo Courtly

PostgreSQL 16. Bộ SQL khớp với ứng dụng trên nhánh `nam-dev`, dùng UUID và Flyway V1–V12.

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
DEMO_MODE=true
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
| **Quản trị viên (Chủ sân)** | `admin@gmail.com` | `12345` | **ADMIN**: Quản trị toàn quyền: dashboard, tài chính, báo cáo, phân quyền, cấu hình hệ thống. |
| **Nhân viên Staff (Quầy)** | `staff@gmail.com` | `12345` | **STAFF**: Vận hành quầy: quét QR check-in/out, thu tiền mặt, xem lịch sân. |
| **Lễ tân ca sáng** | `letan.huong@courtly.vn` | `12345` | **STAFF**: Vận hành quầy lễ tân: check-in, check-out, phân công trọng tài, thu tiền mặt/QR. |
| **Lễ tân ca chiều** | `letan.duc@courtly.vn` | `12345` | **STAFF**: Ca chiều tối: xếp lịch sân, phân công trọng tài, xác nhận đơn cọc. |
| **Quản lý sân bãi** | `quanly.tuan@courtly.vn` | `12345` | **STAFF**: Điều hành lịch sân, giám sát vận hành nhân sự & giải đấu. |
| **Khách hàng VIP (Demo chính)** | `minh.anh@example.com` | `CourtlyDemo2026` | Nguyễn Minh Anh: Hội viên Club/Plus, có đơn đang chơi hôm nay (có dịch vụ trọng tài), lịch sử đơn dày dặn. |
| **Khách hàng thường (60 khách)** | `quocbao.kts@gmail.com`, `hoangnam.tennis@gmail.com`, ... | `CourtlyDemo2026` | 60 khách hàng thật với họ tên, số điện thoại Việt Nam chuẩn để thử nghiệm danh sách và lịch sử. |
| **Tài khoản bị khóa** | `quangthang.locked@example.com` | `CourtlyDemo2026` | Kiểm tra tính năng chặn đăng nhập đối với tài khoản vi phạm. |

### Phạm vi dữ liệu hiện tại

- 10 sân: 4 ngoài trời, 4 trong nhà, 2 VIP; khung giờ 30 phút.
- Khoảng 1.050 đơn trải trên 60 ngày, đủ trạng thái giữ chỗ, xác nhận, đang chơi, hoàn tất, hủy và hết hạn.
- 10 trọng tài, lịch làm việc và phân công theo từng slot 30 phút; đơn 1 giờ có 2 dòng phân công.
- Thanh toán, hoàn tiền, 6 giải đấu, 20 hội viên và feedback để thử các luồng chính.
- Không tạo đồ uống, thiết bị thuê hoặc dòng hàng hóa. Tổng đơn mẫu chỉ gồm tiền sân và trọng tài.

### Ngừng dịch vụ phụ (V8)

Backend tự chạy migration V8 trên database cũ: vô hiệu hóa danh mục đồ uống/thiết bị và chặn thêm dòng hàng hóa mới tại database. API bán hàng, thuê/trả thiết bị và quản lý các danh mục này đã được gỡ bỏ.

Các bảng `drinks`, `rental_items`, `order_products` còn lại để đọc khoản thu lịch sử và giữ liên kết phiếu thu/đơn. Migration không xóa dòng cũ, không thay tổng tiền, khoản đã thu hoặc đã hoàn. Chi tiết đơn/phiếu thu cũ vẫn thể hiện khoản lịch sử; đơn mới không có phần này. Không nhập lại dữ liệu mẫu trên database vận hành.

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

## Đơn định kỳ sau V12

Check-out kết thúc từng ngày chơi. Các buổi còn lại vẫn giữ sân và chi phí các buổi đã chơi được giữ trong đơn. Migration đánh dấu đơn cũ nghi bị nhả lịch tương lai bằng `RECURRING_VISITS_REVIEW`, không tự đặt lại sân. Xem [bản sửa vận hành](../docs/ADMIN_FIXES_2026-10-28.md) và các truy vấn cuối `query.sql` để đối chiếu.
