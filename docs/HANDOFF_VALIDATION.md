# Kiểm chứng bản giao diện khách Courtly

Nguồn thiết kế: `courtly-handoff-2026-10-19.zip`. Ảnh và bố cục overview được chuyển sang React, sử dụng API thật, không chạy các thao tác giả lập của bản HTML. Logo gốc, header, VI/EN, sáu tiện ích, các khu sân và footer được giữ theo hướng thiết kế. Thông tin footer và trang liên hệ đọc cùng dữ liệu CLB. Asset/ghi công nằm trong `docs/handoff/`.

## Phạm vi thay đổi

- Luồng khách: overview, chọn sân/giờ/trọng tài, đơn, thanh toán, hội viên, giải đấu, tin tức, feedback, hồ sơ và đăng nhập.
- Admin giữ sidebar, topbar, trang và thao tác hiện có. Chỉ sửa cách hiển thị/chọn giờ và tính thời lượng trong các thành phần dùng chung để đọc được cả slot cũ 60 phút và slot mới 30 phút.
- Các đơn và chứng từ cũ giữ nguyên. V5 chỉ chia slot tương lai còn trống và chưa được tham chiếu; thêm email người chơi để chống đăng ký trùng trong giải. Thanh toán dùng transaction, advisory lock và tài liệu `transfer:*`/`bank-event:*` trong cơ chế lưu trữ hiện có.
- Mỗi thay đổi nghiệp vụ về sau cần xem lại schema, API, dữ liệu mẫu và migration; không sửa migration đã phát hành.

## Đã chạy và đạt

| Kiểm tra | Kết quả |
| --- | --- |
| Maven `verify` | 9 unit test, 0 lỗi, 0 bỏ qua; build Java thành công |
| Vite production build | Thành công; còn cảnh báo kích thước bundle, chưa tối ưu chia bundle |
| `handoff-api.mjs` | 33 kiểm tra: quyền sở hữu, chống đặt trùng, idempotency, 90 phút sân + 30 phút trọng tài, cọc chỉ tiền sân, ưu đãi VIP, thu thiếu/đủ/lặp/muộn, đăng ký giải, feedback riêng tư, kích hoạt hội viên và hạn mức đổi lịch |
| `handoff-admin-api.mjs` | 4 kiểm tra: tạo/sửa lịch nhân sự 30 phút, chặn giờ không đúng bước, sinh lịch sân |
| `handoff-webhook.mjs` | 12 kiểm tra HTTP nội bộ: VietQR/CRC, API key, tài khoản nhận, event ID, chống lặp, chặn sandbox trong LIVE, chuyển dư vào đối soát |
| `handoff-browser.mjs` | Đăng nhập khách, đặt 90 phút, VI/EN giữ lựa chọn, QR/sandbox, tải lại vẫn còn đơn, chọn sao, đọc tin, liên hệ/footer; không tràn ngang ở 1440/1024/736/390/320px |
| `handoff-admin-browser.mjs` | 17 trang menu admin mở được, không lỗi JavaScript; admin không bị bọc trong layout khách; lịch có nhãn 06:30 |
| SQL init | Nhập database trống rồi khởi động Spring: Flyway xác nhận đủ 5 migration, Hibernate validate thành công |
| SQL fixture | Nạp đủ dữ liệu, chạy lại không nhân đôi; các truy vấn trùng sân/trọng tài/email và lệch ledger trả 0 dòng |
| Nâng cấp V3 → V5 | Slot BOOKED và AVAILABLE đã có tham chiếu lịch sử giữ nguyên ID/giá/thời lượng; slot trống chưa dùng được chia đúng 30 phút/nửa giá |

Tất cả kiểm tra ghi dữ liệu chạy trên database riêng, không trên database vận hành. Các script đặt ngày tương đối, dùng giờ Việt Nam. Kịch bản API có đặt sân/đăng ký thật trong database test; dùng bộ fixture mới khi chạy lại để tránh trùng các slot cố định.

## Chạy lại

Dựng database theo `database/README.md`, khởi động backend ở cổng 8083, `PAYMENT_MODE=SANDBOX`, `SEED_DEMO=false`, `FRONTEND_ORIGIN=http://127.0.0.1:5175`. Frontend dev dùng `API_PROXY_TARGET=http://127.0.0.1:8083`, cổng 5175. Cài dependencies bằng `npm ci` trong frontend, cài Chromium hoặc đặt `CHROMIUM_PATH` tới trình duyệt tương thích.

```sh
COURTLY_TEST_WRITE=1 node tests/handoff-api.mjs
COURTLY_TEST_WRITE=1 node tests/handoff-browser.mjs
COURTLY_TEST_WRITE=1 node tests/handoff-admin-api.mjs
node tests/handoff-admin-browser.mjs
```

Trên PowerShell dùng `$env:COURTLY_TEST_WRITE="1"` rồi chạy từng lệnh `node`. Biến `COURTLY_API_URL`, `COURTLY_WEB_URL` đổi địa chỉ test. Ảnh chụp mặc định ở `/tmp/courtly-handoff-screens`; Windows đặt `COURTLY_SCREENSHOTS` thành một đường dẫn local.

Webhook: dùng backend test riêng cổng 8084 với `PAYMENT_MODE=LIVE`, BIN `970436`, tài khoản giả `999999999999`, tên `COURTLY LOCAL TEST` và một khóa test trong `SEPAY_WEBHOOK_KEY`. Truyền cùng khóa qua `COURTLY_TEST_WEBHOOK_KEY` cho script, rồi chạy `COURTLY_TEST_WRITE=1 node tests/handoff-webhook.mjs`. Script không gọi ngân hàng bên ngoài. Không dùng số tài khoản/khóa này để nhận tiền.

## Giới hạn đã biết

Chưa kiểm tra chuyển tiền thật hoặc cấp quyền SePay thực tế; xem `PAYMENTS.md`. Không tự gửi email/SMS, không tự chuyển khoản hoàn tiền. Ngày và thông tin liên hệ trong fixtures là dữ liệu giả lập. Giao diện khách phân trang lịch sử nhưng API overview/admin vẫn nạp tập dữ liệu theo thiết kế hiện có, chưa phải giải pháp tải lớn. Các công cụ admin/giải nâng cao ngoài phạm vi handoff giữ mức hỗ trợ cũ.

## Chỉnh UX chọn sân — 22/10/2026

- Khôi phục sơ đồ sân minh họa của handoff: hàng rào/đèn khu A, mái che khu B, khung vàng khu VIP; mỗi sân dùng tên, giá và trạng thái từ API. Trạng thái trống/bận trên sơ đồ xét theo khoảng giờ đã chọn.
- Cân lại chiều rộng nội dung, cỡ tiêu đề, hero và footer của luồng khách. Trang đặt sân tách sơ đồ sân, bảng giờ và phần tổng tiền; trên điện thoại các phần xếp dọc.
- Nhấn mốc đầu chọn giờ bắt đầu, nhấn mốc tiếp theo chọn đúng giờ kết thúc. Ví dụ 18:00 → 19:30 là 90 phút. Nhấn mốc khác sau khi hoàn tất sẽ bắt đầu chọn lại. Đổi sân/ngày xóa khoảng giờ cũ.
- Chặn khoảng đi qua giờ đã đặt hoặc lịch bị thiếu; cho phép kết thúc ngay đầu đơn khác và lúc đóng cửa 23:00. Dùng ranh giới thực tế từ API để đọc được cả slot cũ 60 phút.
- Trọng tài là lựa chọn mở rộng sau khi chọn đủ giờ; điều chỉnh giờ bắt đầu trọng tài luôn giữ giờ kết thúc hợp lệ.
- Không thay schema/API hay mã admin; không cần migration hoặc nạp lại SQL.

Kiểm tra đã đạt trên bản sửa này:

| Kiểm tra | Kết quả |
| --- | --- |
| `npm --prefix frontend run build` | Thành công; vẫn còn cảnh báo bundle lớn hơn 500 kB |
| `node --test tests/booking-time.test.mjs` | 7 bài kiểm thử ranh giới giờ, khoảng bị chặn và slot cũ đều đạt |
| `node tests/booking-ux-browser.mjs` | Bàn phím, hai lần nhấn, mốc 23:00, đổi sân/ngày, giờ trọng tài; booking 1440/1024/768/650/390/320 px và overview 1440/1024/768/390/320 px không tràn ngang; không tạo đơn |
| `COURTLY_TEST_WRITE=1 node tests/handoff-browser.mjs` | Đăng nhập, đặt 90 phút, chuyển VI/EN giữ lựa chọn, thanh toán sandbox, tải lại còn đơn, feedback/tin tức/liên hệ đạt trên database test |
| `node tests/handoff-admin-browser.mjs` | 17 trang admin, lịch nửa giờ và kiểm tra không có layout khách đều đạt |
| Rà ảnh giao diện | Đã xem overview và đặt sân ở 1440 px và 390 px |

Script UX dùng tài khoản demo và lịch mẫu tương lai từ `database/test_data.sql`; không gửi thanh toán hay tạo đơn. `COURTLY_WEB_URL`, `CHROMIUM_PATH`, `COURTLY_SCREENSHOTS` cấu hình địa chỉ, trình duyệt và thư mục ảnh giống các script trên.
