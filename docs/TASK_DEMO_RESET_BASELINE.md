# Giao việc: Reset demo khôi phục nguyên vẹn toàn bộ web

> Tài liệu giao cho AI agent (hoặc lập trình viên) triển khai. Đọc hết trước khi sửa code. Làm đúng phạm vi; không sửa những phần nằm ngoài mục "Phạm vi".

## 1. Mục tiêu

Sau khi Admin bấm **"Đặt lại dữ liệu mẫu Hội đồng"** (hoặc chạy `.\reset-demo.ps1`), **mọi thứ người xem thấy trên web phải giống hệt trạng thái chuẩn**, dù trong lúc demo đã tạo, sửa, ngừng hay xóa bất cứ thứ gì: sân, bảng giá, nhân sự/trọng tài, giải đấu, gói hội viên, voucher, bài viết, thông tin CLB, cài đặt CLB, tài khoản, đơn, thanh toán, feedback.

Câu nghiệm thu một dòng: *thay đổi bất kỳ dữ liệu nào qua giao diện Admin → reset → so sánh với ảnh chụp chuẩn → không có khác biệt (ngoài các trường thời gian được tính theo ngày reset).*

## 2. Bối cảnh dự án (đã kiểm chứng ngày 03/11/2026)

- Repo: nhánh `nam-dev`. Backend Spring Boot 3.5 / Java 17 / PostgreSQL 16 / Flyway V1–V13; frontend React 19 + Vite. Chạy bằng `docker compose up -d --build` (API `http://localhost:8081/api`, web `http://localhost:3000`, Postgres `localhost:5433`, user/db `courtly`).
- `.env` demo: `DEMO_MODE=true`, `SEED_DEMO=true`, `PAYMENT_MODE=DEMO`. Reset chỉ chạy khi `DEMO_MODE=true` (`DemoAccessPolicy.requireEnabled()`).
- Toàn bộ logic reset nằm trong `backend/src/main/java/com/courtly/service/DemoResetService.java`, method `resetShowcaseDataInternal()`, chạy trong **một transaction** (`@Transactional resetShowcaseData()`). Endpoint: `POST /api/catalog/demo-reset` (ADMIN). Script: `scripts/seed_showcase.py`, `reset-demo.ps1`, `reset-demo.bat`.
- Tài khoản admin sau reset: `admin@gmail.com` / `123456`.

### Reset hiện đã làm

| Nhóm dữ liệu | Hiện tại |
| --- | --- |
| Đơn, booking, slot, thanh toán, hoàn tiền, trận đấu, đăng ký giải | Xóa hết rồi tạo lại 17 đơn mẫu theo ngày reset; tiền tính lại trong `reconcileSeededOrders()` |
| Tài khoản | Xóa tài khoản ngoài danh sách 8 email chuẩn; upsert 8 tài khoản, mật khẩu `123456` |
| Sân | Mở lại 10 tên sân chuẩn, gán ảnh mặc định, đặt `base_price` theo khu; chép bảng giá cho sân thiếu |
| Lịch sân | Xóa và sinh lại `court_schedules` từ 2 ngày trước qua `ScheduleService.generate` |
| Cài đặt CLB | `hold_minutes=5`, `deposit_percent=50`, `cancel_refund_percent=100`, hạn hủy 60 phút, hạn đổi 1440 phút |
| Voucher | Upsert 5 mã (`seedVouchers()`), `used_count=0` |
| app_documents | Xóa và tạo lại `membership:*`, `membership-payment:*`, `request:membership:*`, `feedback:*` |

### Chưa được khôi phục (lỗi cần sửa)

| Nhóm dữ liệu | Hậu quả sau reset |
| --- | --- |
| `courts` tạo thêm (vd. "Sân A05") hoặc sân đã ngừng (`status='DELETED'`, hiện có A04 cũ, B05) | Sân thêm vẫn mở bán; tab "Đã ngừng khai thác" còn sân rác |
| Mô tả, tiện ích, địa chỉ, ảnh, khu của sân chuẩn bị sửa | Giữ nội dung đã sửa |
| `court_prices` (ma trận giá) bị sửa | Giữ giá đã sửa → tiền đơn mẫu cũng đổi theo |
| `staff`, `staff_schedules` (trọng tài, lễ tân) thêm/sửa | Giữ |
| `tournaments` tạo thêm/sửa (tên, ngày, lệ phí, trạng thái) | Giữ |
| `vouchers` tạo thêm; 2 mã ngoài `seedVouchers()` (`HE2026`, `WELCOME`) bị sửa | Giữ |
| `app_documents`: `club` (thông tin CLB), `article:*` (tin tức), `membership-plan:*` (gói hội viên) | Giữ nội dung đã sửa |
| `app_documents` tạm: `transfer:*`, `bank-event:*`, `request:*`, `email:*`, `otp:*`, `activation:*`, `reset:*`, `registration-details:*` | Tích lũy rác qua mỗi lần demo |
| Cột còn lại của `club_settings` | Giữ |

## 3. Thiết kế đề xuất: ảnh chụp chuẩn (baseline snapshot)

Không viết tay giá trị chuẩn cho từng bảng. Thay vào đó:

1. **Chụp baseline một lần** từ một database đã reset sạch, xuất các bảng/khóa "danh mục" ra file JSON đóng gói trong backend: `backend/src/main/resources/demo/baseline.json`.
2. **Khi reset**, trước bước tạo dữ liệu mẫu hiện có, khôi phục từng bảng danh mục về đúng baseline bằng SQL tổng quát dựa trên `json_populate_recordset` (không liệt kê cột thủ công):
   - Xóa bản ghi **không có** trong baseline.
   - Cập nhật bản ghi **có** trong baseline về đúng giá trị baseline (mọi cột trừ khóa chính).
   - Chèn bản ghi baseline đang **thiếu**.
3. Phần sinh dữ liệu động hiện có (17 đơn, membership, feedback, đăng ký giải, lịch sân, tính lại tiền) **giữ nguyên** và chạy sau bước khôi phục.

Bảng/khóa đưa vào baseline:

| Nguồn | Khóa định danh | Ghi chú |
| --- | --- | --- |
| `courts` | `id` | Chỉ 10 sân chuẩn đang `ACTIVE`; sân khác bị xóa hẳn |
| `court_prices` | `id` | Toàn bảng |
| `staff` | `id` | Toàn bảng |
| `staff_schedules` | `id` | Toàn bảng tại thời điểm chụp; reset hiện tự tạo thêm ca trọng tài 17:00–19:00 nếu thiếu |
| `tournaments` | `id` | Toàn bảng |
| `vouchers` | `id` (khớp thêm theo `code` nếu bị trùng unique) | Toàn bảng; `used_count` để 0 |
| `club_settings` | `id` | Toàn bảng |
| `app_documents` | `document_key` | Chỉ `club`, `article:*`, `membership-plan:*`, `fixture:*` |

Không đưa vào baseline (đã được reset tạo lại theo ngày, hoặc là dữ liệu giao dịch): `accounts`, `orders`, `bookings`, `booking_slots`, `booking_staff`, `payments`, `refunds`, `court_schedules`, `matches`, `match_*`, `team_members`, `tournament_registrations`, `voucher_redemptions`, `audit_logs`, `flyway_schema_history`, `drinks`, `rental_items`, `order_products`.

## 4. Các bước triển khai

### Bước 1 — Công cụ chụp baseline

Tạo `scripts/export_demo_baseline.py` (chỉ dùng thư viện chuẩn + `docker exec ... psql`, hoặc `psycopg` nếu có sẵn). Script:

- Chạy trên database demo **vừa reset sạch** (gọi reset trước qua API hoặc yêu cầu người chạy reset trước).
- Với mỗi bảng ở mục 3: `SELECT coalesce(json_agg(t ORDER BY <khóa>), '[]') FROM <bảng> t [WHERE ...]`.
- Với `courts`: chỉ lấy `status = 'ACTIVE'` và tên thuộc 10 sân chuẩn A01–A04, B01–B04, V01–V02.
- Với `app_documents`: chỉ lấy các khóa ở mục 3.
- Ghi file `backend/src/main/resources/demo/baseline.json` dạng `{ "version": 1, "capturedAt": "...", "tables": { "courts": [...], ... } }`, sắp xếp ổn định để diff git dễ đọc.

Commit file baseline vào repo. Từ nay "trạng thái chuẩn" = nội dung file này; muốn đổi chuẩn thì sửa trên web, reset, chạy lại script.

### Bước 2 — Khôi phục baseline trong reset

Tạo class mới `backend/src/main/java/com/courtly/service/DemoBaselineService.java` (giữ `DemoResetService` gọn), gọi từ `resetShowcaseDataInternal()` **ngay sau khối "1. Dọn dẹp dữ liệu phát sinh"** và **trước** các bước sửa sân / sinh lịch hiện có.

Thứ tự bắt buộc (vì khóa ngoại):

1. Dọn `app_documents` tạm: xóa khóa bắt đầu bằng `transfer:`, `bank-event:`, `request:`, `email:`, `otp:`, `activation:`, `reset:`, `registration-details:`.
2. `staff_schedules` của nhân sự không có trong baseline → xóa; rồi khôi phục `staff`, sau đó `staff_schedules`.
3. Sân không có trong baseline: xóa `court_schedules` và `court_prices` của chúng, rồi xóa sân (an toàn vì mọi `booking_slots`, `match_slots`, `booking_staff` đã bị xóa ở bước dọn dẹp).
4. Khôi phục `courts`, rồi `court_prices` (xóa toàn bộ giá rồi chèn lại từ baseline là đủ).
5. Khôi phục `tournaments`, `vouchers`, `club_settings`, rồi các khóa `app_documents` thuộc baseline (xóa các `article:*` không có trong baseline).
6. Gọi `courtSchedules.flush()` / không trộn JPA cache: chỉ dùng `JdbcTemplate` trong service này.

SQL mẫu cho một bảng có khóa `id` (Java dựng danh sách cột từ `information_schema.columns`, bỏ cột khóa):

```sql
-- :json là mảng JSON của bảng trong baseline.json, truyền dưới dạng tham số text
DELETE FROM courts WHERE id NOT IN (SELECT id FROM json_populate_recordset(NULL::courts, :json::json));

UPDATE courts t SET (name, type, status, base_price, ...) = (b.name, b.type, b.status, b.base_price, ...)
FROM json_populate_recordset(NULL::courts, :json::json) b WHERE t.id = b.id;

INSERT INTO courts SELECT * FROM json_populate_recordset(NULL::courts, :json::json) b
WHERE NOT EXISTS (SELECT 1 FROM courts t WHERE t.id = b.id);
```

Lưu ý triển khai:

- Viết **một** hàm Java tổng quát `restoreTable(String table, String keyColumn, String jsonArray, String extraDeleteFilter)`, không viết SQL riêng cho từng bảng. Danh sách cột lấy từ `information_schema.columns` theo `ordinal_position`.
- Bảng `vouchers` có `UNIQUE(code)`: trước khi UPDATE/INSERT, xóa voucher có `code` trùng baseline nhưng `id` khác.
- Cột `version` (optimistic lock) khôi phục đúng giá trị baseline là được.
- Sau khi khôi phục baseline, **bỏ các câu lệnh viết tay nay đã thừa** trong `DemoResetService`: mở lại 10 sân, gán ảnh mặc định, đặt `base_price`, chép bảng giá cho sân thiếu, `UPDATE club_settings ...`, `seedVouchers()`. Giữ nguyên phần tạo đơn, membership, feedback, đăng ký giải, lịch sân và `reconcileSeededOrders()`.
- Nếu thiếu file baseline (`getResource` trả null), reset phải báo lỗi rõ ràng `"Thiếu demo/baseline.json"` và rollback, không chạy nửa chừng.

### Bước 3 — Đồng bộ hai nguồn khởi tạo

`DemoDataInitializer` (khi `SEED_DEMO=true`, database trống) đang tạo 10 sân với giá 200k/300k/500k khác baseline. Không bắt buộc sửa; chỉ cần đảm bảo **lần reset đầu tiên** trên database mới đưa mọi thứ về baseline. Ghi chú điều này trong README.

## 5. Ràng buộc và trường hợp cần lưu ý

- **Không bao giờ chạy ngoài demo.** Giữ `demo.requireEnabled()` ở đầu reset; không thêm endpoint mới.
- **Toàn bộ trong một transaction**: lỗi ở bất kỳ bước nào → rollback, database giữ nguyên như trước khi bấm reset.
- Không đổi schema, không thêm migration Flyway.
- Không sửa dữ liệu `accounts` ngoài logic hiện có (8 tài khoản chuẩn, mật khẩu `123456`).
- Ảnh tải lên (nếu có) nằm trong `frontend/public` hoặc URL ngoài; không xử lý file, chỉ khôi phục trường `image_url`.
- Hiệu năng: reset hiện mất 1–2 giây; sau khi sửa không vượt quá 5 giây.
- Không để lại sân trùng tên: sau reset, `SELECT name, count(*) FROM courts GROUP BY name HAVING count(*) > 1` phải rỗng.
- Tab "Đã ngừng khai thác" sau reset phải trống.

## 6. Tiêu chí nghiệm thu và cách tự kiểm tra

Tạo `tests/demo-reset-baseline-api.mjs` theo cùng quy ước với `tests/demo-flows-api.mjs` (yêu cầu `COURTLY_TEST_WRITE=1`, `COURTLY_API_URL` mặc định `http://127.0.0.1:8081/api`, đăng nhập admin `123456`, thoát mã khác 0 khi có bước FAIL). Kịch bản:

1. Reset, lưu ảnh chụp A = `GET /overview?date=<ngày mai>` (ADMIN) + `GET /public/content`, chỉ giữ các phần: `courts`, `archivedCourts`, `prices`, `staff`, `tournaments`, `membershipPlans`, `settings`, `club`, danh sách bài viết, danh sách voucher (`GET /public/vouchers`).
2. Qua API Admin, thay đổi mỗi nhóm ít nhất một lần:
   - tạo "Sân A05"; sửa mô tả và giá sân A01; ngừng khai thác sân B03;
   - sửa một dòng `court_prices`;
   - thêm một trọng tài; sửa đơn giá một trọng tài;
   - tạo một giải đấu; sửa lệ phí giải Winter;
   - sửa giá gói Plus;
   - tạo voucher `TEST10`;
   - sửa thông tin CLB; sửa tiêu đề một bài viết; tạo một bài viết mới;
   - đổi cài đặt giữ chỗ sang 15 phút.
3. Reset, lấy ảnh chụp B cùng cách.
4. **A và B phải giống hệt** (so sánh JSON đã sắp xếp; bỏ qua các trường thời gian sinh theo ngày reset như `createdAt` của đơn).
5. Chạy thêm `tests/demo-flows-api.mjs` → phải đạt 26/26.
6. `cd backend && ./mvnw verify` đạt; thêm unit test cho hàm `restoreTable` (mock `JdbcTemplate`, kiểm tra thứ tự DELETE → UPDATE → INSERT và lỗi khi thiếu baseline).

Đầu ra cần bàn giao:

- `DemoBaselineService.java`, sửa `DemoResetService.java`.
- `backend/src/main/resources/demo/baseline.json` (chụp từ database demo sạch).
- `scripts/export_demo_baseline.py`.
- `tests/demo-reset-baseline-api.mjs` + unit test Java.
- Cập nhật README mục "Chạy demo bằng Docker": reset khôi phục toàn bộ web theo baseline; cách chụp lại baseline khi muốn đổi chuẩn.
- Một commit trên `nam-dev` mô tả thay đổi; không push nếu chưa được duyệt.

## 7. Lệnh hữu ích

```powershell
docker compose up -d --build
.\reset-demo.ps1
$env:COURTLY_TEST_WRITE="1"; node tests/demo-reset-baseline-api.mjs
$env:COURTLY_TEST_WRITE="1"; node tests/demo-flows-api.mjs
docker exec tennis-court-git-postgres-1 psql -U courtly -d courtly -c "select name, status from courts order by name;"
```
