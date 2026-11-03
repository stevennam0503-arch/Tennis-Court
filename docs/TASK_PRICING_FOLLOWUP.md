# Giao việc: Hoàn thiện đổi giá theo khu và kịch bản demo đổi giá

> Tài liệu giao cho AI agent (hoặc lập trình viên). Làm tiếp sau commit `ca72b95` (bảng giá theo khu). Đọc hết trước khi sửa; chỉ sửa trong phạm vi mục 3.

## 1. Kết luận đã chốt

Có ghi chú đề xuất tránh lệch giá khi demo bằng cách (a) chỉ đổi giá trên sân mới tạo, hoặc (b) chọn ngày chưa sinh slot (+4, +5). **Không dùng cách nào trong hai cách này.** Lý do:

- Ghi chú dựa trên hành vi cũ. Từ `ca72b95`, `PUT /api/catalog/zones/{zone}/tariff` đã cập nhật giá mọi slot còn trống (`AVAILABLE`, `MAINTENANCE`) từ ngày áp dụng trở đi, kể cả các ngày reset đã sinh sẵn. Đã kiểm chứng trên Docker ngày 03/11: slot 18:00 A01 ngày mai đổi 130.000 → 150.000 ngay sau khi lưu; 806 slot được cập nhật; `tests/zone-tariff-api.mjs` 15/15.
- Slot giữ giá cũ chỉ còn ở 3 trường hợp, đều là hành vi **đúng** và nên trình bày cho Hội đồng: slot đã có người đặt hoặc đang giữ chỗ (`BOOKED`, `LOCKED`), ngày trong quá khứ, và ngày trước ngày áp dụng.
- Né tránh khi demo làm Hội đồng nghi ngờ hệ thống; demo thẳng trên sân đang bán, áp dụng từ hôm nay, mới thể hiện đúng nghiệp vụ.

Việc cần làm: sửa 3 lỗi còn lại để demo đổi giá an toàn trên **mọi sân, mọi ngày**, giảm kích thước baseline, và viết kịch bản demo đổi giá vào hướng dẫn.

## 2. Bối cảnh

- Nhánh `nam-dev`. Spring Boot 3.5 / Java 17 / PostgreSQL 16; React 19. `docker compose up -d --build`; API `http://localhost:8081/api`; web `http://localhost:3000`; admin `admin@gmail.com` / `123456` sau `.\reset-demo.ps1`.
- Code liên quan:
  - `backend/src/main/java/com/courtly/service/CatalogService.java`: `replaceZoneTariff`, `validateAndParseTariffRows`, `parseTime`, `copyZonePricesIfMissing`.
  - `backend/src/main/java/com/courtly/service/ScheduleService.java`: `generate(date)` sinh slot từ `court_prices`, bỏ qua sân `DELETED`, bỏ qua ngày đã có ≥ 34 slot.
  - `backend/src/main/java/com/courtly/controller/CatalogController.java`: `PUT /catalog/zones/{zone}/tariff`.
  - `frontend/src/pages/CourtsPage.jsx`: màn hình "Bảng giá theo khu" (`effectiveDate`, `handleSaveTariff`).
  - `backend/src/main/resources/demo/baseline.json`, `DemoBaselineService.java`, `scripts/export_demo_baseline.py`.
  - Test: `tests/zone-tariff-api.mjs`, `tests/demo-flows-api.mjs`, `backend/src/test/java/com/courtly/service/CatalogServiceTest.java`.

## 3. Việc cần làm

### 3.1 Ngày áp dụng ở tương lai bị "lấn" sang các ngày trước đó (lỗi trung bình)

Tái hiện: đặt `effectiveFrom = hôm nay + 30`, rồi mở lịch ngày `hôm nay + 27` (chưa sinh slot) → slot nhận giá mới, đúng ra phải giữ giá cũ. Nguyên nhân: `court_prices` bị thay ngay; ngày chưa sinh lịch sẽ lấy giá mới khi được sinh.

Sửa: trong `replaceZoneTariff`, **trước** khi xóa/chèn `court_prices`, nếu `effectiveFrom > hôm nay` thì gọi `scheduleService.generate(d)` cho mọi ngày `d` từ hôm nay đến `effectiveFrom - 1` (giới hạn tối đa 90 ngày, đúng khoảng ngày `PresentationService` cho phép xem; quá 90 ngày thì báo 400 "Ngày áp dụng tối đa sau 90 ngày"). Như vậy các ngày trước hiệu lực được chốt giá cũ. Gọi `flush` repository trước khi chạy câu SQL tiếp theo (cùng lý do như trong `DemoResetService`: dữ liệu JPA phải ghi xuống trước khi JDBC đọc). Không thêm bảng hay migration.

### 3.2 Sân đang Bảo trì / Tạm ngưng trong khu không nhận bảng giá mới (lỗi trung bình)

Tái hiện: chuyển A02 sang `MAINTENANCE`, lưu bảng giá khu OUTDOOR (17–22h = 300.000) → `court_prices` của A02 vẫn 260.000; mở lại A02 thì slot 18:00 = 130.000 trong khi sân khác cùng khu = 150.000. Nguyên nhân: `replaceZoneTariff` và câu UPDATE `court_schedules` chỉ lấy `c.status = 'ACTIVE'`.

Sửa: áp dụng cho mọi sân của khu **trừ** `DELETED` (gồm `ACTIVE`, `MAINTENANCE`, `INACTIVE`), ở cả bước xóa/chèn `court_prices` và câu UPDATE slot. Thông báo lỗi "Không tìm thấy sân…" giữ nguyên nhưng đếm theo điều kiện mới. Sân đã ngừng khai thác (`DELETED`) không đổi; khi được mở lại thì `copyZonePricesIfMissing` không đủ vì sân đó vẫn còn giá cũ → khi mở lại sân (`reopening` trong `CatalogService.court`), **thay** bảng giá của sân bằng bảng giá hiện hành của khu (xóa rồi chép), và cập nhật giá slot còn trống từ hôm nay của sân đó.

### 3.3 Giờ không hợp lệ làm server lỗi 500 (lỗi thấp)

Tái hiện: gửi `end: "25:00"` → HTTP 500. Nguyên nhân: `LocalTime.of(25, 0)` ném `DateTimeException`, `Integer.parseInt` có thể ném `NumberFormatException` chưa bắt.

Sửa: trong `parseTime`, bắt `DateTimeException` và `NumberFormatException`, ném `BusinessException("Định dạng giờ không hợp lệ: <giá trị>")` → HTTP 400.

### 3.4 Ngày áp dụng mặc định theo giờ Việt Nam

`CourtsPage.jsx` khởi tạo `effectiveDate` bằng `new Date().toLocaleDateString('en-CA')` (múi giờ của máy admin). Đổi sang hàm `today()` trong `frontend/src/utils/format.js` (đã cố định `Asia/Ho_Chi_Minh`). Ô chọn ngày đặt `min = today()` và `max = today() + 90`.

### 3.5 Giảm kích thước baseline

`baseline.json` hiện ~6 MB, trong đó 20.444/20.565 bản ghi là `staff_schedules`. Reset đã tự tạo ca trọng tài cần cho đơn mẫu (`bookCourtWithReferee`).

Sửa: bỏ `staff_schedules` khỏi baseline. Khi reset, xóa `staff_schedules` không còn được tham chiếu (mọi `booking_staff`, `match_staff` đã bị xóa ở bước dọn dẹp) rồi để logic hiện có tạo lại ca cần thiết. Cập nhật `scripts/export_demo_baseline.py` và `DemoBaselineService` tương ứng, chụp lại baseline từ database vừa reset. Kiểm tra `tests/demo-flows-api.mjs` (có bước thuê trọng tài) vẫn đạt; mục tiêu baseline < 200 KB.

### 3.6 Kịch bản demo đổi giá trong hướng dẫn

Thêm mục **"Demo đổi giá sân"** vào `docs/HUONG_DAN_DEMO_HOI_DONG.md` (giữ văn phong các mục hiện có), nội dung:

1. Đăng nhập khách `hoangnam@gmail.com`, mở lịch ngày mai, ghi lại giá slot 18:00 Sân A01. Mở trang Bảng giá, ghi lại giá khung 17:00–22:00 khu ngoài trời.
2. Đăng nhập admin → **Sân & bảng giá → Bảng giá theo khu → Ngoài trời**: sửa khung 17:00–22:00 ngày thường, "Áp dụng từ" = hôm nay → Xem trước → Lưu. Hệ thống báo số slot còn trống được cập nhật.
3. Tải lại trang Bảng giá và lịch đặt sân của khách: giá mới hiện ở cả hai nơi, kể cả các ngày đã có lịch.
4. Mở đơn mẫu đã đặt trước đó trên khu ngoài trời (ví dụ `#CT-26262626`, Sân A01 ngày mai): đơn giữ nguyên giá lúc đặt. Câu trả lời cho Hội đồng: "Giá chốt vào đơn tại thời điểm đặt; đổi bảng giá chỉ áp dụng cho slot còn trống."
5. (Tùy chọn) Lặp lại với "Áp dụng từ" = tuần sau: lịch tuần này giữ giá cũ, lịch từ tuần sau có giá mới.
6. Reset dữ liệu mẫu sau khi demo để bảng giá về chuẩn.

Ghi chú trong hướng dẫn: không cần chọn sân mới hay ngày chưa sinh lịch.

## 4. Ràng buộc

- Không đổi schema, không thêm migration.
- Không đổi `booking_slots.unit_price` hay tiền của đơn đã có; không đổi giá slot `BOOKED`/`LOCKED`.
- Không đổi cách tính cọc, ưu đãi hội viên, voucher, phí trọng tài.
- Mọi thao tác của `replaceZoneTariff` trong một transaction; lỗi ở bất kỳ bước nào thì không thay đổi gì.
- Chỉ ADMIN được gọi endpoint bảng giá.

## 5. Nghiệm thu

Bổ sung vào `tests/zone-tariff-api.mjs` (giữ các ca hiện có, vẫn tự reset trước và sau):

1. **Ngày áp dụng tương lai:** reset → `effectiveFrom = hôm nay + 30` → slot 18:00 A01 ngày `+27` (lần đầu mở) = giá cũ; ngày `+30` và `+40` = giá mới; slot đã sinh sẵn ngày mai = giá cũ.
2. **Sân bảo trì:** chuyển A02 sang `MAINTENANCE` → đổi giá khu → `court_prices` A02 = giá mới → mở lại A02 → slot 18:00 ngày mai của A02 bằng sân A01.
3. **Sân đã ngừng khai thác được mở lại:** ngừng B03 (sau reset B03 không có đơn sắp tới) → đổi giá khu INDOOR → mở lại B03 → bảng giá và slot còn trống của B03 bằng B01.
4. **Giờ sai:** `end: "25:00"`, `"ab:cd"`, `"6h"` → đều HTTP 400, không thay đổi dữ liệu.
5. **Ngày áp dụng > 90 ngày** → 400.
6. **Đơn đã đặt** giữ nguyên đơn giá và tổng tiền (ca hiện có).

Ngoài ra:

- Unit test Java cho `parseTime` (giờ sai → `BusinessException`) và cho việc lọc sân theo `status <> 'DELETED'`.
- `cd backend && ./mvnw verify` đạt; 4 test JS đơn vị đạt; `tests/demo-flows-api.mjs` 26/26; `tests/demo-reset-baseline-api.mjs` đạt với baseline mới.
- Đi thử kịch bản mục 3.6 trên trình duyệt từ đầu đến cuối.

Bàn giao: code, test, baseline chụp lại (< 200 KB), mục "Demo đổi giá sân" trong hướng dẫn. Một commit trên `nam-dev`; không push khi chưa được duyệt.
