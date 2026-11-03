# Giao việc: Sửa trải nghiệm người dùng (khách, staff, admin) trước buổi demo 14/11

> Tài liệu giao cho AI agent (hoặc lập trình viên). Làm trên bản mới nhất của nhánh `nam-dev` (commit `83ce8ad` trở đi). Đọc hết trước khi sửa; chỉ sửa trong phạm vi mục 3. Ưu tiên P1 trước, P3 làm nếu còn thời gian.

## 1. Mục tiêu

Sau khi sửa:
- Khách đang chơi (đã cọc, còn phần thanh toán khi check-out) **không** bị báo nợ quá hạn và **không** bị chặn đặt sân mới.
- Trang khách không còn nhiều banner chồng nhau che nội dung.
- Staff không thấy nút thao tác mà backend sẽ từ chối.
- Khách chưa đăng nhập xem được sân và giờ trống; chỉ phải đăng nhập khi bấm giữ chỗ.

## 2. Bối cảnh (đã kiểm chứng trên Docker ngày 03/11/2026)

- Nhánh `nam-dev`. React 19 + Vite (frontend), Spring Boot 3.5 (backend). Chạy `docker compose up -d --build`; web `http://localhost:3000` (khách), `http://localhost:3000/app` (ADMIN/STAFF); reset dữ liệu `.\reset-demo.ps1`.
- Tài khoản sau reset (mật khẩu `123456`): `admin@gmail.com` (ADMIN), `staff@gmail.com` (STAFF), `hoangnam@gmail.com` (khách hội viên Plus, có đơn `#CT-11111111` đang chơi hôm nay, đã cọc 50%), `khachmoi@gmail.com`.
- Đã sửa ở `83ce8ad`, **không** làm lại: trang khách trắng màn hình do `courtMinRate` dùng `court` trước khi khai báo trong `guest/Booking.jsx`.
- Quy tắc nghiệp vụ liên quan (giữ nguyên):
  - Cọc 50% khi đặt; phần còn lại thu tại quầy, bắt buộc thu đủ trước check-out.
  - Khách còn nợ **quá hạn** bị chặn đặt đơn mới (`8e9438b`, "debt-control").
  - Chỉ ADMIN được hoàn tiền: `POST /api/payments/{id}/refunds` có `@PreAuthorize("hasRole('ADMIN')")` (`PaymentController.java`).

## 3. Việc cần làm

### P1-a. Cảnh báo nợ báo sai với khách đang chơi

**Tái hiện:** đăng nhập `hoangnam@gmail.com`, mở `/dat-san` → banner đỏ "CẢNH BÁO: ĐƠN QUÁ HẠN CHƯA THANH TOÁN ĐỦ TIỀN… tất toán nợ cũ để được mở quyền đặt sân mới" cho đơn `#CT-11111111` (đang chơi hôm nay, đã cọc đúng 50%); nút đặt sân bị khóa.

**Nguyên nhân:** cùng một điều kiện lặp ở 2 nơi:
- `frontend/src/guest/Portal.jsx`, `overdueDebtOrder` (khoảng dòng 235–243)
- `frontend/src/guest/Booking.jsx`, `overdueDebtOrders` (khoảng dòng 28–38)

```js
return oDate < dateToday() || ['COMPLETED', 'CHECKED_IN'].includes(o.status);
```
Mọi đơn `CHECKED_IN` còn thiếu tiền đều bị coi là nợ quá hạn, kể cả đơn đang chơi hôm nay.

**Sửa:**
1. Tạo **một** hàm dùng chung `isOverdueDebt(order, today)` trong `frontend/src/utils/order-timing.mjs` (file đã có, thuần JS, có test). Đơn là nợ quá hạn khi `total - paid > 0` **và** không ở trạng thái `CANCELLED`/`EXPIRED`/`HOLDING` **và** thỏa một trong hai:
   - `status === 'COMPLETED'` (đã hoàn tất mà còn thiếu tiền);
   - thời điểm kết thúc buổi chơi cuối cùng (theo `slots`: `date` + `end`, giờ Việt Nam) đã qua quá thời gian ân hạn 15 phút.
   Đơn `CHECKED_IN` hoặc `CONFIRMED` còn trong giờ chơi, hoặc chưa tới giờ, **không** phải nợ quá hạn.
2. Dùng hàm này ở cả `Portal.jsx` và `Booking.jsx`; xóa hai điều kiện cũ.
3. Kiểm tra backend có chặn đặt đơn theo cùng logic không (tìm "nợ quá hạn" / "debt" trong `backend/src/main/java/com/courtly/service/`). Nếu backend có điều kiện riêng, thống nhất cùng quy tắc trên để frontend và backend trả cùng một kết luận.
4. Thêm test vào `tests/order-timing.test.mjs` (tạo mới nếu chưa có): đơn đang chơi hôm nay còn thiếu → không nợ; đơn hôm qua đã kết thúc còn thiếu → nợ; đơn `COMPLETED` còn thiếu → nợ; đơn đã thu đủ → không nợ; đơn hủy → không nợ.

### P1-b. Banner chồng nhau che nội dung trang khách

**Tái hiện:** đăng nhập `hoangnam@gmail.com`, mở `/dat-san`: banner nợ, banner nhắc lịch thi đấu và banner giải đấu cùng hiện, dính đầu trang (`position: sticky`), chiếm khoảng 1/3 màn hình desktop và không trôi đi khi cuộn.

**Vị trí:** `frontend/src/guest/Portal.jsx`, các khối `<aside>` điều kiện: `overdueDebtOrder` (~303), `todayMatch` (~367), `pendingPaymentOrder` (~399), `welcomeBannerVisible` (~441), `membershipBannerVisible` (~542), `tournamentBannerVisible` (~585); nhiều khối có `position: 'sticky'` trong style.

**Sửa:**
1. Gom các thông báo vào **một** vùng thông báo duy nhất (component mới, ví dụ `guest/NoticeBar.jsx`), chỉ hiện **một** thông báo tại một thời điểm theo thứ tự ưu tiên: nợ quá hạn > đơn đang chờ thanh toán (giữ chỗ) > lịch chơi hôm nay > hội viên > voucher chào mừng > giải đấu. Có nút "+N thông báo khác" mở danh sách đầy đủ, và nút đóng từng thông báo (giữ cách lưu trạng thái đóng hiện có).
2. Vùng thông báo **không** sticky, cao tối đa một dòng trên desktop (khoảng 56px), nằm dưới header, cuộn theo trang. Header giữ sticky như hiện tại.
3. Giữ nguyên nội dung, nút hành động (Tất toán, Mở vé QR, Gia hạn, Đăng ký giải…) và điều kiện hiển thị của từng thông báo; chỉ đổi cách bố trí.
4. Thông báo nợ chỉ hiện khi `isOverdueDebt` (P1-a) đúng.

### P1-c. Staff thấy nút "Hoàn tiền" nhưng không được phép hoàn

**Tái hiện:** đăng nhập `staff@gmail.com`, mở `/app#payments`: mỗi dòng giao dịch có nút "Hoàn tiền"; tab "Đơn cần hoàn tiền" có nút "Hoàn tiền ngay". Backend chỉ cho ADMIN, nên staff bấm sẽ nhận lỗi 403.

**Vị trí:** `frontend/src/pages/PaymentsPage.jsx` (nút `show({ type: 'refund', id: p.id })` ~dòng 245–251 và `show({ type: 'refund', orderId: o.id })` ~dòng 340–346). Rà thêm các nút hoàn tiền trong `pages/OperationsPage.jsx`, `components/OrderTable.jsx`, `components/OrderDialogs.jsx`.

**Sửa:** lấy `isAdmin` từ `useCourtly()` (đã có trong context, xem `App.jsx`). Với STAFF: ẩn nút thực hiện hoàn tiền; ở các dòng đang chờ hoàn hiển thị nhãn "Chờ Admin duyệt hoàn" (không bấm được). ADMIN giữ nguyên. Không đổi backend.

### P2. Khách chưa đăng nhập bị bắt đăng nhập ngay khi vào trang đặt sân

**Tái hiện:** chưa đăng nhập, mở `/dat-san` → hộp "Đăng nhập để đặt sân" bật lên ngay trên nền trống; không xem được sân và giờ trống.

**Vị trí:** `frontend/src/guest/Portal.jsx`:
```js
useEffect(()=>{ if(route==='booking'&&!user){ login('login',{from:'booking'}); } },[route,user]);
```

**Sửa:**
1. Bỏ `useEffect` tự bật đăng nhập cho route `booking`.
2. Khách chưa đăng nhập xem được sơ đồ sân, giá, giờ trống và chọn giờ (dữ liệu từ `/api/public/overview` đã có `courts`, `prices`, `schedules`).
3. Chỉ bật đăng nhập khi bấm nút giữ chỗ — `Booking.jsx` hàm `submit` đã có `if (!user) { login('login', { from: 'booking' }); return; }`; sau khi đăng nhập xong, giữ nguyên giờ đã chọn để khách bấm tiếp.
4. Kiểm tra các lời gọi chỉ dành cho người đã đăng nhập trong `Booking.jsx` (vd. `/booking/options`, voucher) không chạy khi `!user`, không gây lỗi 401/403 trong console.

### P3. Admin (làm nếu còn thời gian)

1. **Chuông thông báo và chấm đỏ:** gom số đếm theo mức độ; chỉ chấm đỏ cho việc cần xử lý ngay (quá giờ trả sân, quá hạn chưa thu, chờ hoàn tiền); các mục khác dùng số màu trung tính.
2. **Lịch sân** (`pages/CalendarPage.jsx`): mỗi màn hình chỉ thấy khoảng 4/10 sân. Thêm bộ lọc theo khu (Tất cả / Ngoài trời / Trong nhà / VIP) và cố định cột giờ khi cuộn ngang.
3. **Bảng "Việc cần xử lý"** (`pages/OperationsPage.jsx`): mỗi ô chỉ 1–2 dòng; tách phần mô tả dài thành tooltip hoặc dòng phụ màu nhạt.

## 4. Ràng buộc

- Không đổi API, schema, quyền backend, chính sách cọc / hoàn / nợ.
- Không đổi nội dung chữ của thông báo ngoài những chỗ nêu trên; giữ song ngữ VI/EN qua `t()` và `guest/translations.json` (thêm khóa EN cho chuỗi mới).
- Không thêm thư viện UI mới.
- Không bỏ chức năng nào đang có: mọi nút trong các banner hiện tại vẫn truy cập được.

## 5. Nghiệm thu

Tự kiểm tra trên trình duyệt (desktop) sau khi `docker compose up -d --build` và reset:

| # | Tài khoản | Thao tác | Kết quả phải thấy |
| --- | --- | --- | --- |
| 1 | `hoangnam@gmail.com` | Mở `/dat-san` | Không có cảnh báo nợ cho `#CT-11111111`; nút đặt sân bấm được; chỉ một dòng thông báo (lịch chơi hôm nay) kèm "+N thông báo khác" |
| 2 | `hoangnam@gmail.com` | Cuộn xuống phần chọn giờ | Vùng thông báo trôi theo trang, không che lưới giờ |
| 3 | `thao.le@gmail.com` (chủ đơn `#CT-81818181`, chơi 2 ngày trước, còn thiếu 50%) | Mở `/dat-san` | Có cảnh báo nợ và bị chặn đặt mới, đúng như trước |
| 4 | `staff@gmail.com` | Mở `/app#payments` | Không có nút "Hoàn tiền" / "Hoàn tiền ngay"; dòng chờ hoàn ghi "Chờ Admin duyệt hoàn" |
| 5 | `admin@gmail.com` | Mở `/app#payments` | Nút hoàn tiền vẫn hoạt động như cũ |
| 6 | Chưa đăng nhập | Mở `/dat-san`, chọn sân và giờ | Xem được giờ trống, chọn được giờ; bấm giữ chỗ mới bật đăng nhập; đăng nhập xong vẫn giữ lựa chọn |
| 7 | Mọi trang trên | Mở DevTools Console | Không có lỗi JavaScript, không có lỗi 401/403 ngoài ý muốn |

Ngoài ra:
- `node --test tests/booking-time.test.mjs tests/order-visits.test.mjs tests/pricing.test.mjs tests/report-period.test.mjs tests/order-timing.test.mjs` đạt.
- `cd frontend && npm run build` không lỗi.
- `$env:COURTLY_TEST_WRITE="1"; node tests/demo-flows-api.mjs` vẫn đạt 26/26.

Bàn giao: code, test mới, ảnh chụp màn hình trước/sau cho mục 1, 4, 6. Một commit trên `nam-dev`; không push khi chưa được duyệt.
