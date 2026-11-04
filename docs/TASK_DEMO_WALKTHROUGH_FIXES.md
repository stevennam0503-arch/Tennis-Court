# Giao việc: Sửa lỗi phát hiện khi chạy thử kịch bản demo 4 luồng

> Tài liệu giao cho AI agent (hoặc lập trình viên). Làm trên bản mới nhất của nhánh `nam-dev` (commit `b4058df` trở đi). Đọc hết trước khi sửa; chỉ sửa trong phạm vi mục 4. Làm theo thứ tự P1 → P2 → P3; **tất cả các mục đều phải xong** trước buổi demo.
>
> **Nguyên tắc chung:** mỗi chỗ sửa phải theo cách doanh nghiệp vận hành sân thể thao / đặt chỗ thật đang làm, đã ghi ở phần "Sửa" của từng mục. Không đổi quy tắc nghiệp vụ ngoài những gì mục đó yêu cầu.

## 1. Mục tiêu

Sau khi sửa:
- Có **2 tài khoản demo sạch** (không đơn, không nợ) để đặt sân ở Luồng 2 và 3. Hai tài khoản này đặt được sân bất kể reset lúc mấy giờ.
- `hoangnam@gmail.com` và `khachmoi@gmail.com` giữ nguyên vai trò: chủ của các đơn mẫu, để admin xem đủ trạng thái đơn.
- Staff không check-in được ngoài cửa sổ giờ nếu không tự nhập lý do ngoại lệ.
- Sau reset có nhiều trọng tài rảnh để khách thuê. Hộp thoại "Tạo lịch" tạo, hiển thị và báo lỗi ca trực như phần mềm xếp ca thật.
- Hai khách cùng đặt một slot thì người thua thấy thông báo rõ ràng, và màn hình tự cập nhật.
- Ưu đãi hội viên và voucher tính theo thứ tự chuẩn.
- Số "Thu ròng" ở mọi trang luôn ghi rõ kỳ tính.

## 2. Bối cảnh

- React 19 + Vite (frontend), Spring Boot 3.5 / Java 17 (backend), PostgreSQL 16, Flyway V1–V13.
- Chạy: `docker compose up -d --build`.
- Địa chỉ: web khách `http://localhost:3000`, ADMIN/STAFF `http://localhost:3000/app`.
- Reset dữ liệu: `.\reset-demo.ps1`, chạy `scripts/seed_showcase.py`, gọi `DemoResetService`.
- Tài khoản hiện có (mật khẩu `123456`):
  - Quản trị và nhân viên: `admin@gmail.com`, `staff@gmail.com`.
  - Khách mẫu, đều đã có 2–4 đơn: `hoangnam`, `khachmoi`, `thao.le`, `minhduc`, `phuong.vu`, `hoanglong` (`@gmail.com`).
  - Danh sách giữ lại khi reset: `DemoResetService.java:92`.
- Kịch bản demo để tái hiện: `docs/KICH_BAN_DEMO_4_LUONG.md`.
- Quy tắc nghiệp vụ giữ nguyên:
  - Giữ chỗ 5 phút.
  - Cọc 50%.
  - Hạn hủy 60 phút, hạn đổi 1440 phút.
  - Check-in sớm 30 phút.
  - Giờ mở cửa 06:00–23:00.
  - Nợ quá hạn: còn thiếu tiền quá 15 phút sau khi buổi chơi kết thúc thì bị chặn đặt đơn mới.
  - Chỉ ADMIN được hoàn tiền.

## 3. Kết quả chạy thử ngày 04/11/2026 (07:15–07:45, ngay sau reset)

| Hạng mục | Kết quả | Mục sửa |
|---|---|---|
| Hộp thoại "Tạo lịch" trọng tài | Lưu được. Nhập 6–23h tạo ra **34 dòng** lịch 30 phút; danh sách tăng từ 2 lên 36 dòng. Cho tạo khung giờ đã qua (06:00–07:00 khi lúc đó là 07:20). Tạo ca trùng thì bị chặn, nhưng báo chung chung: "Dữ liệu bị trùng hoặc vừa thay đổi. Tải lại và thử lại." Giờ nhập bằng ô số nguyên. Danh sách chọn nhân sự có "Non-billable test staff". | P2-b |
| Hai khách cùng đặt một slot | **Dữ liệu an toàn:** gửi 2 yêu cầu đồng thời thì chỉ 1 đơn được tạo. **Giao diện chưa tốt:** người thua thấy "Khung giờ vừa được đặt hoặc đang thi đấu" (HTTP 400). Lựa chọn vẫn giữ nguyên, nút "Tiếp tục thanh toán" vẫn bấm được, lưới giờ không đánh dấu slot đã mất. | P2-c |
| Dòng "Ưu đãi hội viên" | Hiện đúng. Hội viên Plus, B01 09:00–10:00 giá 240.000₫ → "Ưu đãi hội viên −36.000₫" (15%), backend tính khớp. **Khi thêm voucher VIP10:** voucher tính 10% trên **giá gốc** (−24.000₫) rồi cộng dồn → giảm 25%, còn 180.000₫. | P2-d |
| "Thu ròng" lệch giữa hai trang | Không phải lỗi tính toán; hai trang **tính trên hai kỳ khác nhau**. Trang Thu tiền (`PaymentsPage.jsx:59–60, 141`) cộng toàn bộ giao dịch từ trước tới nay. Báo cáo (`ReportsPage.jsx:86–134`) chỉ lấy giao dịch trong kỳ đang chọn. Đối chiếu DB sau reset: Thu tiền 8.034.000₫, Báo cáo tháng 11 7.684.000₫. Phần lệch 350.000₫ đúng bằng 1 giao dịch ngày tháng 10. Con số chênh trước đó (8.348.000₫ và 7.368.000₫) cùng nguyên nhân, chỉ khác vì dữ liệu mẫu đặt theo ngày reset. | P2-e |

**Trả lời hội đồng nếu được hỏi:** "Thu ròng ở trang Thu tiền là lũy kế từ khi mở sổ. Báo cáo là theo kỳ, ở đây là tháng 11. Phần chênh lệch là giao dịch các tháng trước." Sau khi sửa P2-e, trang Thu tiền sẽ ghi rõ kỳ tính.

## 4. Việc cần làm

### P1-a. Quét QR check-in bỏ qua cửa sổ giờ check-in

**Tái hiện:**
1. Khách đặt một slot **ngày mai** và trả cọc.
2. Đăng nhập staff → Quét QR Check-in → Nhập mã → Check-in.
3. Kết quả: check-in thành công dù còn khoảng 20 giờ nữa mới tới giờ chơi.
4. Check-out ngay sau đó: các slot ngày mai bị giải phóng.

**Nguyên nhân:**
- Backend làm đúng. `OrderApplicationService.java` (case `"check-in"`, khoảng dòng 258–275) chỉ cho check-in ngoài cửa sổ giờ khi body có `reason`.
- Frontend tự điền lý do: `frontend/src/components/AutoQRCheckInModal.jsx`, khoảng dòng 108, luôn gửi `reason: 'Quét mã QR tự động tại quầy'`.
- Lỗi check-out giải phóng slot ngày mai là hệ quả của lỗi này. Không sửa `OrderService.checkOut`.

**Sửa** (cách các hệ thống check-in thật làm: quét mã ngoài giờ thì từ chối, quản lý ca mới được ghi đè, và phải ghi lý do):
1. `AutoQRCheckInModal.jsx`: gọi `/orders/{id}/check-in` **không** kèm `reason`.
2. Bị từ chối vì ngoài cửa sổ giờ thì hiện cảnh báo, gồm:
   - tên khách, sân, giờ bắt đầu;
   - dòng "Chỉ check-in từ HH:mm ngày dd/MM";
   - ô nhập lý do và nút "Check-in ngoại lệ". Nút này gửi lại kèm `reason` người dùng nhập; lý do bắt buộc, ít nhất 5 ký tự.
3. `frontend/src/pages/OrdersPage.jsx`, `handleQuickCheckIn` (khoảng dòng 54–63): khi lỗi cần lý do, mở hộp thoại check-in có sẵn (`DialogHost.jsx`, case `'check-in'`) thay vì chỉ hiện toast.
4. Backend: thông báo lỗi ghi mốc giờ được phép check-in, ví dụ "Chưa tới giờ check-in (từ 08:30 ngày 05/11). Nhập lý do ngoại lệ để tiếp tục." Giữ nguyên logic cho qua khi có `reason`. Ghi `reason` và người thao tác vào audit.

**Kiểm tra:**
- Đơn ngày mai: quét → bị từ chối, có hướng dẫn. Nhập lý do → check-in được, audit có lý do.
- Đơn hôm nay, bắt đầu sau 20 phút: quét → check-in ngay.
- Đơn hôm nay, bắt đầu sau 2 giờ: bị từ chối.

### P1-b. Tài khoản demo sạch cho Luồng 2–3

**Hiện trạng:**
- Kịch bản dùng `hoangnam` / `khachmoi` để đặt sân, nhưng hai tài khoản này sở hữu đơn mẫu có nợ.
- Đơn "đang chơi" của `hoangnam` được đặt theo giờ reset (`DemoResetService.java` khoảng dòng 160–175). Ngoài 07:00–20:30, hoặc khoảng 1,5 giờ sau reset, đơn này thành nợ quá hạn và tài khoản bị chặn đặt sân.

**Quyết định của chủ dự án:**
- Tài khoản dùng để demo đặt sân phải **sạch, không có đơn nào**.
- `hoangnam` và `khachmoi` **chỉ** để admin xem các trạng thái đơn. **Không** sửa đơn mẫu của hai tài khoản này.

**Sửa** (cách doanh nghiệp thật làm: tách tài khoản trình diễn khỏi dữ liệu mẫu, tài khoản trình diễn luôn được đưa về trạng thái mới tinh):
1. Thêm 2 tài khoản `CUSTOMER` vào seed, cùng chỗ với `hoangnam` / `khachmoi` (`DemoResetService.java` khoảng dòng 100–110), mật khẩu `123456`:
   - `demo.hoivien@gmail.com`, tên "Nguyễn Minh Khoa (Demo hội viên)":
     - có membership **Plus** đang hiệu lực, kèm 1 bản ghi `membership-payment:` đã thanh toán, để có dòng "Ưu đãi hội viên";
     - tạo theo cách đang tạo `membership:` cho `NAM_ID` (khoảng dòng 477–511), `startsAt` = 30 ngày trước ngày reset, `endsAt` = 335 ngày sau.
   - `demo.khach@gmail.com`, tên "Phạm Thu Trang (Demo khách)": không membership, chưa từng có đơn, nên dùng được voucher `WELCOME`.
2. Hai tài khoản này **không có đơn, thanh toán, hoàn tiền, feedback hay đăng ký giải** nào sau reset.
   - Thêm hai email vào danh sách giữ lại ở dòng 92.
   - Mọi dữ liệu phát sinh khi demo phải bị xóa ở lần reset sau, kể cả voucher đã dùng (`voucher_redemptions`) và trạng thái "đã dùng WELCOME".
   - Phía trình duyệt, cờ `courtly_welcome_used_<id>` trong `localStorage` dùng **id tài khoản**. Giữ id cố định trong seed để reset xong vẫn trùng id. Kiểm tra thêm: backend phải là nơi quyết định WELCOME còn dùng được hay không, không dựa vào `localStorage`.
3. Thêm test (JUnit hoặc test seed hiện có): sau reset, hai tài khoản có 0 đơn. `demo.hoivien` có membership `ACTIVE`; `demo.khach` không có.
4. Cập nhật `docs/KICH_BAN_DEMO_4_LUONG.md`:
   - Mục 0, bảng tài khoản: `demo.hoivien` thay `hoangnam` ở Luồng 2; `demo.khach` thay khách thứ hai.
   - Ghi chú `hoangnam` / `khachmoi` là "tài khoản minh họa trạng thái đơn cho admin, không dùng để đặt".
   - Bỏ cảnh báo "reset không quá 30 phút trước Luồng 2".

**Kiểm tra:** reset lúc bất kỳ giờ nào (thử 07:30 và 22:30). Đăng nhập lần lượt hai tài khoản demo, đặt và cọc được ngay. Không có banner nợ.

### P2-a. Nút "Đăng nhập…" mở nhầm form "Lưu mật khẩu & tiếp tục"

**Nguyên nhân:**
- `login` trong `frontend/src/guest/Portal.jsx:164` có chữ ký `login(mode = 'login', ctx = null)`.
- Viết `onClick={login}` làm `mode` nhận click event.
- Các vị trí:
  - `guest/Booking.jsx:575`
  - `guest/Content.jsx:1467`
  - `guest/Tournaments.jsx:9` ("Đăng nhập để đăng ký")

**Sửa:**
1. Đổi thành `onClick={() => login('login', { from: '<trang>' })}`, theo `Booking.jsx:273`.
2. Trong `Portal.jsx`, `login` chỉ nhận `mode` là một trong các chuỗi hợp lệ; giá trị khác thì về `'login'`.
3. `grep -rn "onClick={login}" frontend/src` phải không còn kết quả.

### P2-b. Trọng tài: dữ liệu ca trực và hộp thoại "Tạo lịch"

**Hiện trạng:**
- Seed chỉ có 1 trọng tài với 2 ca đã `BOOKED` (`DemoResetService.java` khoảng dòng 765–790, đơn #17), nên khách luôn thấy "Không có trọng tài rảnh toàn khoảng này".
- Hộp thoại "Tạo lịch": xem kết quả ở mục 3.
- Code tạo ca: `CatalogService.java`, `times()` (khoảng dòng 415) và `staffSchedule()` (khoảng dòng 425–460).

**Sửa dữ liệu mẫu** (để chủ dự án test được việc thuê trọng tài):
1. Sau mỗi lần reset, ít nhất **4 trọng tài** có ca trực **còn trống** trong **hôm nay và 6 ngày tới**, tính theo ngày reset, không dùng ngày cố định. Chia ca như sân thật:
   - ca sáng 06:00–14:00 cho 2 trọng tài;
   - ca chiều tối 14:00–23:00 cho 2 trọng tài.
   Cách này đảm bảo mọi khung giờ mở cửa đều có ít nhất 2 trọng tài rảnh.
2. Lưu theo đúng cấu trúc `staff_schedules` hiện có (mỗi dòng 30 phút, `status = 'AVAILABLE'`). Giữ nguyên các ca `BOOKED` của đơn #17.
3. Đơn giá theo giờ lấy từ hồ sơ từng trọng tài, không hard-code.

**Sửa hộp thoại "Tạo lịch"** (cách phần mềm xếp ca thật làm):
1. **Giờ bắt đầu / kết thúc dùng ô chọn giờ** theo bước 30 phút (06:00, 06:30 … 23:00), không dùng ô số nguyên. Mặc định là ca đầy đủ gần nhất chưa qua, ví dụ 14:00–23:00 khi đang buổi trưa.
2. **Không cho tạo ca trong quá khứ:** ngày đã qua, hoặc giờ bắt đầu đã qua trong hôm nay. Ô ngày chặn ngày cũ (`min` = hôm nay), backend cũng kiểm tra lại. Thông báo: "Không tạo được ca đã qua (hiện là HH:mm)".
3. **Hiển thị ca theo khối:** danh sách "Lịch làm việc" gộp các dòng 30 phút **liền nhau, cùng nhân sự, cùng ngày, cùng trạng thái** thành một dòng. Ví dụ "TT Trần Đức Thịnh · 04/11 · 06:00–23:00 · Còn trống 30/34 slot".
   - Bấm vào dòng thì xổ ra chi tiết từng slot, kèm đơn đang dùng slot đó.
   - Đếm trên tab ("Lịch làm việc (n)") là số ca, không phải số slot.
4. **Báo trùng ca cụ thể:** trước khi lưu, backend kiểm tra chồng lấn với ca đã có của cùng nhân sự. Báo đúng khoảng trùng, ví dụ "TT Trần Đức Thịnh đã có ca 06:00–23:00 ngày 04/11, trùng 08:00–10:00". Không trả lỗi ràng buộc chung chung.
   - Tùy chọn kèm theo: nút "Chỉ tạo phần chưa trùng".
5. **Sửa / xóa theo ca:**
   - "Sửa" trên một ca gộp cho đổi giờ bắt đầu / kết thúc của cả ca.
   - Thu hẹp ca bị chặn nếu phần bị cắt có slot `BOOKED`; khi đó báo slot nào đang có đơn.
   - Thêm "Xóa ca": chỉ xóa phần `AVAILABLE`, giữ phần `BOOKED`, và báo lại phần được giữ.
6. Ẩn nhân sự không hoạt động hoặc là bản ghi test khỏi danh sách chọn (xem P3-2).

**Kiểm tra:**
- Ngay sau reset, khách thuê được trọng tài cho:
  - một slot hôm nay sau giờ hiện tại;
  - một slot ngày mai buổi sáng;
  - một slot ngày mai buổi tối.
- Admin tạo ca 14:00–18:00 → danh sách hiện **1 dòng**. Tạo lại 15:00–16:00 cùng người → báo trùng cụ thể. Tạo ca hôm qua → bị chặn.

### P2-c. Hai khách cùng đặt một slot

**Hiện trạng:**
- Backend chặn đúng: 2 yêu cầu đồng thời thì chỉ 1 đơn được tạo.
- Người thua nhận HTTP 400 "Khung giờ vừa được đặt hoặc đang thi đấu". Trong `guest/Booking.jsx`, nhánh `catch` của `submit` (khoảng dòng 325–328) chỉ hiện lỗi; lựa chọn và lưới giờ giữ nguyên.

**Sửa** (cách các hệ thống đặt chỗ thật làm: slot mất thì báo đúng slot nào, bỏ khỏi giỏ, gợi ý chỗ khác):
1. Backend trả **HTTP 409**, body có mã lỗi `SLOT_TAKEN` và danh sách slot bị trùng (`scheduleId`, sân, ngày, giờ). Giữ nguyên cơ chế khóa hiện tại.
2. Frontend khi nhận `SLOT_TAKEN`:
   - tải lại tình trạng sân của ngày đang xem;
   - bỏ các slot bị trùng khỏi lựa chọn, giữ phần còn lại;
   - hiện thông báo cụ thể ngay trên khối tiền, ví dụ "Sân B01 09:00–10:00 vừa được khách khác giữ chỗ. Vui lòng chọn giờ khác.", và đổi "đang thi đấu" thành câu phù hợp;
   - gợi ý tối đa 3 sân **cùng khu, cùng khung giờ** còn trống (dữ liệu đã có trên lưới), bấm vào là chọn luôn.
3. Lưới giờ tự làm mới khi tab được focus lại và mỗi 30 giây khi đang mở `/dat-san`. Slot vừa bị người khác giữ phải hiện "Không khả dụng" mà không cần F5.

**Kiểm tra:**
1. Khách A chọn B01 09:00–10:00 ngày mai nhưng chưa bấm.
2. Khách B giữ đúng slot đó: dùng tab ẩn danh, hoặc `POST /api/orders` bằng tài khoản khác.
3. A bấm "Tiếp tục thanh toán". Kết quả mong đợi:
   - thông báo nêu đúng sân và giờ;
   - B01 09:00–10:00 bị bỏ khỏi lựa chọn và hiện "Không khả dụng";
   - có gợi ý B02/B03/B04 cùng giờ.

### P2-d. Ưu đãi hội viên và voucher cộng dồn sai thứ tự

**Hiện trạng:**
- Ưu đãi hội viên tính trên giá gốc (`MembershipService.java` khoảng dòng 218–247).
- Voucher **cũng** tính trên giá gốc: `OrderService.applyVoucher` truyền `courtTotal` là tổng giá slot (khoảng dòng 130–140).
- Hai khoản giảm cộng dồn: Plus 15% + VIP10 10% = giảm 25% giá gốc.

**Sửa** (cách bán lẻ và dịch vụ thật làm: giảm giá áp lần lượt, giá hội viên trước, voucher sau trên số đã giảm):
1. Thứ tự tính một đơn:
   - giá gốc slot;
   - trừ ưu đãi hội viên (theo % của từng sân, như hiện tại);
   - ra **giá sau ưu đãi**;
   - voucher % tính trên giá sau ưu đãi, voucher số tiền cố định trừ thẳng vào đó;
   - kết quả không âm;
   - cọc 50% tính trên số cuối.
   - Ví dụ: 240.000 − 36.000 = 204.000 → VIP10 −20.400 → **183.600₫**, cọc 91.800₫.
2. Sửa ở **một chỗ** dùng chung cho cả preview (`/booking/options`, `/public/vouchers/evaluate`) và tạo đơn, để số trên màn hình và số trong đơn luôn khớp. Frontend chỉ hiển thị số backend trả về, không tự tính lại.
3. Khối tiền hiển thị theo đúng thứ tự: Tiền sân → Ưu đãi hội viên → Voucher → Trọng tài → Tổng.
4. Phí trọng tài không được giảm bởi ưu đãi hội viên hay voucher. Giữ như hiện tại, chỉ kiểm tra lại.
5. Test backend: hội viên + voucher %; hội viên + voucher cố định; khách thường + voucher; voucher lớn hơn giá trị đơn → tổng bằng 0.

### P2-e. "Thu ròng" không ghi kỳ tính

**Hiện trạng:** xem mục 3. Hai trang đều tính đúng nhưng khác kỳ; trang Thu tiền không ghi kỳ nên trông như sai số.

**Sửa** (cách phần mềm kế toán thật làm: mọi chỉ số tiền đều gắn với một kỳ ghi rõ, mặc định là kỳ hiện tại):
1. `frontend/src/pages/PaymentsPage.jsx`: thêm bộ chọn kỳ giống Báo cáo (Ngày / Tháng / Quý / Năm / Khoảng ngày / Toàn bộ), **mặc định "Tháng này"**.
   - Các ô "Tổng đã thu", "Tổng đã hoàn", "Thu phí hội viên", "Thu ròng" và danh sách giao dịch / hoàn tiền đều lọc theo kỳ này.
   - Ghi chú dưới mỗi ô nêu kỳ, ví dụ "Tháng 11/2026".
2. Tách logic chọn kỳ và lọc theo ngày ra một chỗ dùng chung, ví dụ `frontend/src/utils/period.mjs`, rồi dùng cho cả `ReportsPage.jsx` và `PaymentsPage.jsx`. Hai trang cùng kỳ phải ra cùng số.
3. Giữ nguyên cách ghi nhận theo dòng tiền: thu tính theo ngày thu (`paid_at`), hoàn tính theo ngày hoàn (`refunded_at`).

**Kiểm tra:** chọn "Tháng 11/2026" ở cả hai trang thì "Thu ròng" bằng nhau. Chọn "Toàn bộ" ở trang Thu tiền thì ra đúng số lũy kế.

### P3. Lỗi nhỏ (sửa hết)

1. **Giờ hiển thị "18.5:00"** ở hộp thoại / kết quả check-in của staff.
   - Nguyên nhân: giờ là số thập phân, rồi ghép thêm `":00"`.
   - Sửa: tìm trong `AutoQRCheckInModal.jsx`, `OrderDialogs.jsx`, `OrdersPage.jsx`, `CatalogService` (`clock`), rồi dùng một hàm format `HH:mm` dùng chung trong `frontend/src/utils/`.
2. **Bản ghi "Non-billable test staff"** (Huấn luyện viên).
   - Ở đâu: `backend/src/main/resources/demo/baseline.json:832`.
   - Sửa: xóa khỏi baseline sau khi xác nhận không có lịch hoặc đơn mẫu nào tham chiếu.
3. **Tick "Thuê trọng tài" khi chưa đăng nhập làm khóa nút đặt.**
   - Ở đâu: `Booking.jsx:264`, điều kiện `ready` có `(!wantReferee || !!referee)`.
   - Sửa: khi `!user` thì bỏ điều kiện trọng tài. Bấm đặt sẽ mở đăng nhập (dòng 273); sau khi đăng nhập, trọng tài được kiểm tra bình thường.
4. **Đăng xuất / đăng nhập làm mất lựa chọn sân và giờ** trên `/dat-san`.
   - Sửa: giữ lựa chọn trong `sessionStorage` cho cùng tab. Bỏ những slot không còn trống khi tải lại, và báo cho khách biết.
5. **"Bảng giá theo khu" vẫn đếm A03 khi A03 đang Bảo trì.**
   - Sửa: chỉ đếm sân `ACTIVE`, kèm "(1 sân bảo trì)".

## 5. Ngoài phạm vi

- Không đổi các chính sách liệt kê ở mục 2, giá, quy tắc hoàn tiền hay quy tắc nợ quá hạn.
- Không thêm migration Flyway. Nếu P2-c hoặc P2-d thật sự cần đổi schema, dừng lại và báo trước khi làm.
- Không sửa đơn mẫu của `hoangnam`, `khachmoi` và các khách mẫu khác.

## 6. Bàn giao

- Mỗi mục P1/P2 một commit; gom P3 vào một commit. Message theo kiểu `fix(checkin): …`, như lịch sử nhánh.
- Chạy `.\reset-demo.ps1`, rồi đi lại cả 4 luồng của `docs/KICH_BAN_DEMO_4_LUONG.md` bằng hai tài khoản demo mới. Báo kết quả từng bước "Kiểm tra" ở mục 4.
- Cập nhật `docs/KICH_BAN_DEMO_4_LUONG.md`:
  - tài khoản mới (P1-b);
  - bước thuê trọng tài ở Luồng 2 (P2-b);
  - con số khối tiền khi hội viên dùng voucher (P2-d);
  - bảng lỗi cuối file: đánh dấu mục đã sửa, kèm commit.
