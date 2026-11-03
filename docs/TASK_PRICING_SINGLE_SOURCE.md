# Giao việc: Một nguồn giá duy nhất cho sân, slot và mọi màn hình hiển thị giá

> Tài liệu giao cho AI agent (hoặc lập trình viên). Đọc hết trước khi sửa. Chỉ sửa trong phạm vi mục 4; không đổi chính sách cọc, hoàn tiền, hội viên, voucher.

## 1. Mục tiêu

Admin sửa giá ở **một** màn hình; giá đó áp dụng ngay và giống nhau ở mọi nơi: trang Bảng giá của khách, sơ đồ sân, form đặt sân, lịch của quầy, hóa đơn, chatbot. Đơn đã đặt giữ nguyên đơn giá lúc đặt.

Câu nghiệm thu một dòng: *admin đổi giá một khung giờ của một khu, áp dụng từ hôm nay → trang Bảng giá, form đặt sân và slot còn trống của mọi ngày từ hôm nay trở đi hiện đúng giá mới; đơn đã đặt trước đó không đổi tiền.*

## 2. Bối cảnh (đã kiểm chứng trên Docker ngày 03/11/2026)

- Nhánh `nam-dev`. Spring Boot 3.5 / Java 17 / PostgreSQL 16 / Flyway V1–V13; React 19 + Vite. Chạy `docker compose up -d --build`; API `http://localhost:8081/api`; web `http://localhost:3000`; admin `admin@gmail.com` / `123456` sau khi reset (`.\reset-demo.ps1`). Reset khôi phục dữ liệu chuẩn từ `backend/src/main/resources/demo/baseline.json` (`DemoBaselineService`).
- Dữ liệu giá:
  - `courts.base_price`: giá gốc từng sân.
  - `court_prices` (`court_id`, `day_type` WEEKDAY|WEEKEND, `start_time`, `end_time`, `price_per_hour`): bảng giá thật. Hiện mỗi sân ngoài trời có 5 khung/loại ngày (06–10, 10–15, 15–17, 17–22, 22–23), sân trong nhà và VIP có 3 khung.
  - `court_schedules.price`: đơn giá của từng slot 30 phút = giá giờ của khung tương ứng / 2, ghi **một lần** khi sinh lịch (`ScheduleService.generate(date)`; bỏ qua ngày đã có ≥ 34 slot). Sân không có `court_prices` dùng `base_price`.
  - `booking_slots.unit_price`: giá chốt vào đơn lúc đặt. Đây là hành vi đúng, giữ nguyên.
- API: `POST/PUT /api/catalog/prices[/{id}]` (body `court`, `dayType`, `start`, `end` theo giờ thập phân, `price`) → `CatalogService.price()`. `PUT /api/catalog/courts/{id}` sửa sân (gồm `price` = base_price). Overview trả `prices: [{id, court, dayType, start, end, price}]` (start/end là số giờ, vd. 10, 15).

### Lỗi đã tái hiện

| # | Hiện tượng | Nguyên nhân (file) |
| --- | --- | --- |
| 1 | Trang Bảng giá của khách lệch giá thật bị tính. A01 ngày thường: 18–21h hiện 224.000đ/h nhưng thu 260.000đ/h; 21–23h hiện 160.000 nhưng 21–22h thu 260.000; 16–18h hiện 200.000 nhưng thu 180.000 | `frontend/src/guest/pricing.mjs`: `getSlotPrice()` / `getCourtMatrix()` tự tính base_price × hệ số cố định (−25% 09–16h, +25%, +40%, +50% cuối tuần), bỏ qua tham số `prices`. `guest/Pricing.jsx` dùng `getCourtMatrix` |
| 2 | Tab "Chính sách giá theo giờ" (admin) bấm Lưu nhưng không thay đổi gì ngoài máy đó | `frontend/src/pages/CourtsPage.jsx`: `handleSaveConfig` chỉ ghi `localStorage['courtly_hourly_pricing_config']` |
| 3 | Nút "Giá 3 phân khu": đổi A01 160.000 → 200.000 thì slot và `court_prices` không đổi, chỉ trang Bảng giá khách đổi (khung 09–13h thành 150.000) | `handleSaveCategoryRates` chỉ PUT `base_price`; base_price chỉ là giá dự phòng khi sân không có `court_prices` |
| 4 | Không có màn hình sửa `court_prices` | `EntityDialog.jsx` có form `collection === 'prices'` nhưng không chỗ nào mở |
| 5 | Sửa `court_prices` qua API: slot ngày mai (đã sinh) vẫn giá cũ; chỉ ngày chưa sinh lịch (vd. +40 ngày) nhận giá mới | `ScheduleService.generate` không cập nhật slot đã có; không có bước tính lại khi đổi giá |
| 6 | Sơ đồ sân và form đặt sân hiện "xxx / giờ" bằng `court.price` (base_price), không phải giá khung giờ | `guest/CourtMap.jsx` dòng ~34, ~50; `guest/Booking.jsx` dòng ~462 |
| 7 | Chatbot trả lời giá cố định ("Giá chuẩn: 160.000đ/…", trọng tài 150.000đ/giờ) | Chuỗi cứng trong `frontend/src/guest/AiChatbox.jsx` dòng ~23–48 |
| 8 | `tests/pricing.test.mjs` có 1 ca đang hỏng (giá thứ 7 lúc 10:00 kỳ vọng 140.000, công thức ra 175.000) | Test và công thức frontend lệch nhau, cả hai đều không dựa trên `court_prices` |

## 3. Thiết kế cần làm

**Nguồn giá duy nhất = `court_prices` theo khu.** Mọi sân cùng khu (`OUTDOOR`, `INDOOR`, `VIP`) dùng cùng một bảng giá (đúng nghiệp vụ hiện tại: giá đồng nhất theo khu). Vẫn lưu theo từng sân như schema hiện có; thao tác của admin là theo khu và backend ghi cho mọi sân `ACTIVE` của khu đó.

**Áp dụng giá mới cho slot còn trống.** Khi lưu bảng giá của một khu với ngày áp dụng `effectiveFrom` (mặc định hôm nay):
- cập nhật `court_schedules.price` của các slot **`AVAILABLE`** (hoặc `MAINTENANCE`) thuộc các sân của khu, `schedule_date >= effectiveFrom`, theo khung giờ và loại ngày mới;
- slot `BOOKED`/`LOCKED` và mọi `booking_slots.unit_price` **giữ nguyên**;
- toàn bộ trong một transaction; ghi `audit.log("CẬP NHẬT BẢNG GIÁ", "<khu> từ <ngày>: …")`.

**Base price** chỉ còn là giá dự phòng; không hiển thị cho khách như giá thật. Ở nơi cần "giá từ", hiển thị giá thấp nhất của bảng giá khu (`min price_per_hour`).

## 4. Các bước triển khai

### Backend

1. `CatalogService`: thêm method `replaceZoneTariff(String zone, List<TariffRow> rows, LocalDate effectiveFrom, Account actor)`; `auth.admin(actor)`.
   - Validate: `zone` ∈ OUTDOOR/INDOOR/VIP; mỗi `dayType` (WEEKDAY, WEEKEND) phải phủ kín 06:00–23:00, không chồng lấn, mốc chia hết 30 phút, `price > 0`; `effectiveFrom >= hôm nay`.
   - Xóa `court_prices` của các sân `ACTIVE` thuộc khu, chèn lại theo `rows` cho từng sân.
   - `UPDATE court_schedules cs SET price = <giá giờ khớp>/2 FROM courts c WHERE cs.court_id = c.id AND c.type = :zone AND c.status = 'ACTIVE' AND cs.schedule_date >= :effectiveFrom AND cs.status IN ('AVAILABLE','MAINTENANCE')` — giá khớp theo `day_type` (thứ 7, CN = WEEKEND theo `extract(isodow)`) và `start_time` nằm trong khung.
   - Trả về số slot đã cập nhật.
2. Endpoint mới trong `CatalogController`: `PUT /api/catalog/zones/{zone}/tariff`, `@PreAuthorize("hasRole('ADMIN')")`, body `{ "effectiveFrom": "YYYY-MM-DD", "rows": [{ "dayType": "WEEKDAY", "start": "06:00", "end": "10:00", "pricePerHour": 160000 }, …] }`, trả `{ "updatedSlots": n }`. Đi qua `RequestService.execute` như các mutation khác nếu có `requestId`.
3. Sân mới tạo hoặc mở lại (`CatalogService.court`): nếu chưa có `court_prices`, chép bảng giá của khu (đã có đoạn chép tương tự khi mở lại sân; gom thành một hàm dùng chung).
4. Không đổi `ScheduleService.generate` ngoài việc vẫn đọc `court_prices` như hiện tại.

### Frontend admin (`frontend/src/pages/CourtsPage.jsx`)

5. Thay tab "Chính sách giá theo giờ" bằng màn hình **"Bảng giá theo khu"**: chọn khu → lưới 2 cột (Ngày thường / Cuối tuần) × các khung giờ, sửa trực tiếp giá/giờ; thêm, tách, xóa khung; ô "Áp dụng từ ngày" (mặc định hôm nay); nút "Xem trước" hiển thị bảng cũ → mới; "Lưu" gọi endpoint mục 2 và báo "Đã cập nhật N slot còn trống từ ngày …".
6. Xóa toàn bộ logic `localStorage` `courtly_hourly_pricing_config`, `DEFAULT_CONFIG`, `calcRate` và các ô % liên quan. Nếu muốn giữ cách nhập nhanh theo %, chỉ dùng như công cụ điền sẵn lưới; giá lưu vẫn là số tiền tuyệt đối.
7. Bỏ nút "Giá 3 phân khu" (hoặc đổi thành lối tắt mở màn hình mục 5). Trong form sửa sân, trường giá đổi nhãn thành "Giá dự phòng (khi khu chưa có bảng giá)".

### Frontend khách

8. `frontend/src/guest/pricing.mjs`: `getCourtMatrix` / `getSlotPrice` phải lấy giá từ tham số `prices` (dùng lại `tariffRows`, đã đọc đúng `court_prices`). Bỏ hệ số cố định và `discountPercent`/"flash" trong `STANDARD_TIME_BLOCKS`; khung giờ hiển thị lấy theo mốc thật của bảng giá.
9. `guest/Pricing.jsx`: bảng giá và "giá từ" của từng khu đọc từ `data.prices` qua hàm ở bước 8.
10. `guest/CourtMap.jsx`, `guest/Booking.jsx`: thay `money(court.price)/giờ` bằng "Từ {giá thấp nhất}/giờ" của khu, hoặc giá của khung giờ đang chọn.
11. `guest/AiChatbox.jsx`: bỏ chuỗi giá cứng; dựng phần mô tả giá trong prompt từ `data.prices` và `refereeRates` lúc chạy.

### Dữ liệu demo

12. Sau khi xong, chụp lại baseline (`scripts/export_demo_baseline.py`) để `court_prices` chuẩn khớp màn hình mới; đảm bảo reset vẫn đưa giá về chuẩn. Kiểm tra lại kích thước `baseline.json` (hiện ~185.000 dòng, nghi chụp cả `staff_schedules`); nếu không cần thì loại bảng đó khỏi baseline.

## 5. Ràng buộc

- Không sửa `booking_slots.unit_price`, tổng tiền hay chứng từ của đơn đã có.
- Không đổi schema, không thêm migration (bảng `court_prices` hiện tại đủ dùng).
- Không đổi cách tính cọc, ưu đãi hội viên, voucher, phí trọng tài.
- Mọi số tiền khách thấy phải bằng số server sẽ tính; không còn công thức giá nào nằm ở frontend.
- Chỉ ADMIN được sửa bảng giá; STAFF/CUSTOMER bị 403.

## 6. Nghiệm thu và tự kiểm tra

Viết `tests/zone-tariff-api.mjs` theo quy ước của `tests/demo-flows-api.mjs` (yêu cầu `COURTLY_TEST_WRITE=1`, tự reset trước và sau, thoát mã khác 0 nếu có FAIL). Kịch bản:

1. Reset. Ghi lại giá slot 18:00 của A01 ngày mai (= X). Khách đặt một slot 10:00 của A02 ngày mai (đơn giá Y).
2. `PUT /api/catalog/zones/OUTDOOR/tariff` đổi khung ngày thường 17–22h thành 300.000đ/h, `effectiveFrom` = hôm nay.
3. Kiểm tra:
   - `court_prices` của cả 4 sân A01–A04 có khung mới; sân B, V không đổi.
   - Slot 18:00 còn trống của A01 ngày mai = 150.000 (≠ X); slot cùng giờ ngày +40 (sinh sau) = 150.000.
   - Đơn ở bước 1 vẫn đơn giá Y, tổng tiền không đổi.
   - Dữ liệu trang Bảng giá (`getCourtMatrix(court, prices)`) cho A01 khung 18h ngày thường = 300.000.
   - STAFF gọi endpoint → 403; bảng giá có khung chồng lấn hoặc không phủ kín 06–23h → 400 và không thay đổi gì.
4. Reset → bảng giá A01 về đúng baseline.
5. Sửa `tests/pricing.test.mjs` cho đúng hành vi mới (giá lấy từ `prices`); toàn bộ test JS đơn vị đạt.
6. `cd backend && ./mvnw verify` đạt, có unit test cho validate bảng giá và câu UPDATE slot (mock `JdbcTemplate`).
7. `tests/demo-flows-api.mjs` vẫn đạt 26/26.
8. Kiểm tra giao diện bằng trình duyệt: đổi giá ở màn hình admin → mở `http://localhost:3000/bang-gia` và trang đặt sân, giá hiển thị khớp.

Bàn giao: code backend + frontend, test mới, baseline chụp lại, cập nhật README (mục chức năng) và `TAI_LIEU_NGHIEP_VU_VA_YEU_CAU_HE_THONG_COURTLY.md` mục 4. Một commit trên `nam-dev`; không push khi chưa được duyệt.
