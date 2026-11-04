# TASK: Sửa lỗi phát hiện khi tập kịch bản demo (05/11/2026) và rút ngắn vòng build/nghiệm thu

> Brief cho AI agent. Đọc hết trước khi làm. Kịch bản demo chuẩn: `docs/HUONG_DAN_CHECK_IN.html` (mục "Tránh khi demo" liệt kê đúng các lỗi dưới đây).
> Build kiểm tra: commit `c0865a0` (nhánh `nam-dev`) + 2 file đang sửa dở trong working tree (xem Bước 0).
> Nguyên tắc: sửa đúng chỗ, không refactor ngoài phạm vi, làm theo cách doanh nghiệp thật vận hành (tiền và ưu đãi kiểm ở backend, giao diện chỉ hiển thị).

---

## Phần A — Làm nhanh hơn (làm TRƯỚC khi sửa lỗi)

Lần trước mất nhiều thời gian vì: (1) mỗi lần build Docker backend tải lại toàn bộ thư viện Maven; (2) chạy `down -v` + build lại nhiều lần; (3) nghiệm thu thủ công lặp lại. Lần này làm như sau.

### A1. Cache thư viện khi build Docker

`backend/Dockerfile` — tách bước tải thư viện ra lớp riêng và dùng cache của BuildKit:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -o package -DskipTests
FROM eclipse-temurin:17-jre-jammy
# (phần còn lại giữ nguyên)
```

`frontend/Dockerfile` — tương tự cho npm:

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci
```

Kết quả mong đợi: lần build thứ hai trở đi chỉ biên dịch lại, không tải thư viện (dưới 30 giây nếu `pom.xml` không đổi). Nếu `-o` (offline) lỗi do plugin thiếu, bỏ `-o` nhưng giữ cache mount.

Commit: `build(docker): cache maven va npm khi build image`

### A2. Vòng làm việc khi sửa code

| Việc | Làm thế nào | Không làm |
|---|---|---|
| Kiểm tra backend | `cd backend && mvn -q test` trên máy (máy đã có Maven 3.9 và JDK 21, dùng chung `~/.m2`) | Không build Docker chỉ để chạy test |
| Kiểm tra frontend | `cd frontend && npm run lint && npm run build` trên máy | |
| Chạy thử trên giao diện | Chỉ build service vừa đổi: `docker compose up -d --build frontend` **hoặc** `backend` | Không build cả hai khi chỉ đổi một bên |
| Reset dữ liệu | Chạy `.\reset-demo.ps1` **1 lần** sau mỗi thay đổi ở seed | Không chạy 3 lần mỗi vòng |
| DB trắng (`down -v`) | **Chỉ 1 lần** ở bước kiểm tra cuối (Phần C) | Không xoá volume giữa chừng |

### A3. Script kiểm tra nhanh thay cho bấm tay

Tạo `scripts/smoke_demo.py` (chỉ dùng thư viện chuẩn Python, gọi API `http://localhost:8081`). Script chạy lại đúng các bước có tiền trong kịch bản demo và in `PASS/FAIL` từng dòng, tổng thời gian dưới 60 giây:

1. Lấy CSRF (`GET /api/csrf`, header `X-CSRF-TOKEN`), đăng nhập bằng `POST /api/auth/login`.
2. Khách mới: `send-otp` → `verify` (dùng `devCode`) → `register` số `0909123456` → kiểm `GET /api/vouchers/my` có đúng 1 voucher `WELCOME-…` 50.000₫.
3. Khách mới đặt A01 18:00–19:00 ngày mai (giá 260.000₫ hoặc giá hiện hành) với voucher chào mừng cá nhân → kiểm tổng và cọc.
4. Lễ tân thu cọc (`POST /api/payments`, `CASH`, `transactionCode` bắt buộc) → trạng thái `CONFIRMED`.
5. `demo.hoivien`: đặt A02 18:00–19:00 + `pointsToUse: 500` + trọng tài → kiểm tổng, cọc, số dư điểm giảm 500.
6. Admin thu đủ, `check-in` (kèm `reason`), `check-out` → kiểm tài khoản lên `GRAND_SLAM`, có voucher `GS-…`, có thẻ `VIP-…`.
7. Lễ tân quét thẻ: `POST /api/loyalty/vip-lounge/scan` → 200.
8. Admin tạo chiến dịch chỉ kênh `BANNER` → 200.
9. Voucher có khung giờ (P1-3 bên dưới): áp cho khung ngoài giờ → bị từ chối.

Script tự dọn bằng cách gọi reset ở đầu (`--reset`, mặc định bật). Commit cùng commit cuối của Phần B.

---

## Bước 0 — Commit phần đã sửa sẵn

Working tree đang có sửa lỗi trắng trang "Đơn đặt sân" và "Lịch sử đặt sân" (sắp xếp theo `date` bị `undefined` với 12 đơn quá khứ không có slot): `frontend/src/pages/OrdersPage.jsx`, `frontend/src/pages/CustomerHistory.jsx`. Giữ nguyên, commit trước:

Commit: `fix(ui): chong trang trang khi don khong co ngay choi`

`docs/HUONG_DAN_CHECK_IN.html` và `docs/TASK_LOYALTY_FIXES_2.md` cũng đang chưa commit: commit riêng `docs: kich ban demo moi va brief sua loi dot 2`.

---

## Phần B — Sửa lỗi

### P0-1. Các request không gửi CSRF token (403)

**Hiện trạng:** những file sau gọi `fetch('/api/…')` trực tiếp thay vì hàm `api()` trong `frontend/src/services/api.js`, nên request POST thiếu header CSRF và bị 403:

| File | Hậu quả thấy được |
|---|---|
| `pages/CampaignsPage.jsx` (dòng 50, 79, 112, 126, 140, 157, 174) | Không tạo / gửi duyệt / duyệt / tạm dừng / kết thúc chiến dịch được |
| `components/AutoQRCheckInModal.jsx:98` | Quét thẻ VIP Lounge báo "THẺ VIP KHÔNG HỢP LỆ" |
| `pages/LoyaltyAdminPage.jsx:79` | "Điều chỉnh điểm" không lưu được |
| `pages/MyLoyalty.jsx:64` | Đổi quà bằng điểm không được |
| `pages/LoyaltyAdminPage.jsx`, `MyLoyalty.jsx`, `ReportsPage.jsx:236` (GET) | Chạy được nhưng không thống nhất xử lý lỗi/phiên |

**Sửa:** thay toàn bộ bằng `api(path, method, body)`. Lỗi hiển thị bằng `notify`/khối lỗi của trang, không dùng `alert()`. `Portal.jsx:57,66` (route `/api/public/...`) cũng chuyển sang `api()` cho đồng bộ.

**Chống tái phát:** thêm rule ESLint `no-restricted-syntax` chặn `fetch('/api` và `` fetch(`/api `` trong `src/` (trừ `services/api.js`).

Commit: `fix(ui): dung api() co CSRF cho chien dich, the VIP, doi diem`

### P0-2. Khách không vào được "Hạng & điểm của tôi" và "Ưu đãi của tôi"

**Hiện trạng:** `MyLoyalty` và `MyVouchers` chỉ được gắn trong `pages/ProfilePage.jsx` (khu `/app`), mà khu `/app` chuyển khách về trang chủ. Ở trang khách (`guest/Portal.jsx`), menu tài khoản có "Thành viên & Điểm" nhưng mở `/thanh-vien` (trang giới thiệu); nút "Xem hạng & điểm của bạn" (`guest/Account.jsx:2216`) mở trang Hồ sơ. Khách không xem được điểm, lịch sử điểm, voucher của mình và không đổi quà được.

**Sửa:**
1. Thêm 2 route ở Portal: `/tai-khoan/hang-diem` (render `MyLoyalty`) và `/tai-khoan/uu-dai` (render `MyVouchers`), thêm vào `paths`, `protectedRoute` và menu tài khoản: "Hạng & điểm của tôi", "Ưu đãi của tôi".
2. Nút "Xem hạng & điểm của bạn" ở `/thanh-vien` mở `/tai-khoan/hang-diem`.
3. Thông báo in-app có voucher (chào mừng, SORRY, quà lên hạng, sinh nhật) bấm vào thì mở `/tai-khoan/uu-dai`.
4. Đảm bảo 2 component dùng được trong Portal (context, style).

**Nghiệm thu:** `demo.hoivien` mở "Hạng & điểm của tôi" thấy hạng Masters, 1.500 điểm, thanh tiến độ tới Grand Slam, danh mục đổi quà; bấm "Đổi quà" 800 điểm → nhận `RWD-EXT30-…`, mã hiện trong "Ưu đãi của tôi".

Commit: `feat(portal): trang hang diem va uu dai cho khach`

### P1-1. Điều kiện khung giờ, khu sân, ngày trong tuần của voucher không được kiểm

**Hiện trạng:** `VoucherService` chỉ lưu `valid_from_time`, `valid_to_time`, `zone`, `valid_weekdays` (≈ dòng 422–426) nhưng không kiểm khi đánh giá (`evaluate`), kiểm tra (`validate`) và trừ tiền (`redeem`). Voucher `GIOVANG20` (chỉ 10:00–15:00, khu ngoài trời) hiện là áp dụng được cho khung 18:00, tức là mất tiền thật.

**Sửa:** một hàm kiểm điều kiện dùng chung cho cả 3 đường:
- Mọi slot trong đơn phải nằm trọn trong `[valid_from_time, valid_to_time)` nếu có.
- Mọi slot phải thuộc `zone` (khu của sân) nếu có.
- Ngày chơi phải thuộc `valid_weekdays` (định dạng đang lưu, ví dụ `MON,TUE`) nếu có.
- Lý do từ chối rõ ràng: "Chỉ áp dụng khung 10:00–15:00", "Chỉ áp dụng sân ngoài trời", "Chỉ áp dụng Thứ 2–Thứ 6".
- Đơn định kỳ và gia hạn cũng kiểm như vậy.

Thêm test đơn vị cho 3 điều kiện, mỗi điều kiện một ca đạt và một ca bị từ chối.

**Nghiệm thu:** trang đặt sân, khung 18:00 thấy `🔒 GIOVANG20 · chỉ 10:00–15:00`; khung 11:00 sân ngoài trời áp được −20%.

Commit: `fix(promo): kiem khung gio, khu san, ngay ap dung cua voucher`

### P1-2. Khách mới được giảm 50.000₫ hai lần

**Hiện trạng:** khách mới vừa có voucher cá nhân `WELCOME-XXXX`, vừa được banner tự áp voucher công khai `WELCOME`. Hai mã đều dùng được, nên khách được giảm 50.000₫ hai lần qua 2 đơn.

**Sửa:**
- Chuyển voucher công khai `WELCOME` sang `ENDED` (sửa trong `baseline.json` và migration nhỏ cho DB đang có), vì voucher cá nhân đã thay nó.
- Banner chào mừng và trang đặt sân tự áp voucher cá nhân `WELCOME-XXXX` của khách (lấy từ `/api/vouchers/my`), banner ghi đúng mã.
- `CHAOBANMOI` (cũng dành cho khách mới) giữ nguyên nhưng không cộng dồn với `WELCOME-…` (một đơn một voucher đã có sẵn).

Commit: `fix(promo): khach moi chi dung voucher chao mung ca nhan`

### P1-3. Ô thu cọc tại quầy điền sẵn cả tiền đơn

**Hiện trạng:** `components/OrderDialogs.jsx` (≈ dòng 295, hộp "Ghi nhận thu tiền mặt tại quầy"): mở từ nút "Thu cọc tại quầy (125.000 ₫)" nhưng ô "Số tiền mặt" điền sẵn 250.000₫. Lễ tân dễ thu nhầm cả đơn.

**Sửa:** mở từ nút "Thu cọc" thì điền sẵn số cọc còn thiếu; mở từ "Thu nốt tiền" thì điền số còn phải thu. Hiện 2 nút chọn nhanh "Cọc 50%: 125.000 ₫" / "Cả đơn: 250.000 ₫" phía trên ô.

Commit: `fix(payments): dien san dung so tien coc khi thu tai quay`

### P1-4. Bảng kê check-out cộng không ra tổng

**Hiện trạng:** `components/OrderDialogs.jsx` (≈ dòng 900–960). Đơn thật khi tập: sân 300.000 − hạng 15.000 − điểm 50.000 + trọng tài 220.000 + gia hạn 142.500 = **597.500 ₫** (tổng đúng). Nhưng bảng kê ghi "Tiền sân ban đầu 447.500 ₫", "Phí gia hạn +150.000 ₫" (đúng là 142.500 ₫ sau giảm hạng), "Ưu đãi hạng −22.500 ₫", không có dòng trọng tài. Cộng các dòng không ra 597.500.

**Sửa:** dựng bảng kê từ cùng nguồn số với backend (các trường `tierBenefit`, `voucherBenefit`, `pointsBenefit`, phí trọng tài, phí gia hạn trong đơn), theo thứ tự:

```
Tiền sân (giờ đặt)            300.000
Gia hạn +30 phút              150.000
Giảm theo hạng Masters (−5%)  −22.500   (gồm cả phần gia hạn)
Voucher                              0
Dùng điểm (500 điểm)          −50.000
Trọng tài                      220.000
─────────────────────────────────────
Tổng giá trị đơn               597.500
Đã thanh toán                 −117.500
CÒN THIẾU                      480.000
```

Thêm test (Vitest hoặc test thuần JS) cho hàm dựng bảng kê: tổng các dòng = tổng đơn.

Commit: `fix(checkout): bang ke cong khop tong don`

### P1-5. Đơn quá khứ hiện "Sân Tennis · ⏰ – · 0₫"

**Hiện trạng:** 12 đơn quá khứ (seed để có chi tiêu 12 tháng cho Kiệt, Khoa, Trang) không có slot sân. Trong "Đơn của tôi" của khách, chúng hiện "Sân Tennis · ⏰ – · Ngày · 0₫". Trước khi vá ở Bước 0, chúng còn làm trắng trang quản trị.

**Sửa (đúng dữ liệu thật):** trong `DemoResetService`, mỗi đơn quá khứ có slot thật: tạo `court_schedules` ở ngày quá khứ đó (sân, giờ, giá theo bảng giá), gắn vào booking, trạng thái `COMPLETED`. Tổng tiền đơn = tổng giá slot (+ trọng tài nếu cần cho đủ số chi tiêu), giữ đúng chi tiêu 12 tháng đã chốt: Kiệt 21.500.000₫, Khoa 19.900.000₫, Trang 3.400.000₫. Không sinh slot trống ở quá khứ.

**Phòng thủ giao diện:** mọi danh sách đơn bỏ qua hoặc hiển thị "Không có lịch sân" cho đơn thiếu slot, không hiện "0₫".

Commit: `fix(seed): don qua khu co lich san that`

### P2-1. Dọn dấu vết gói hội viên trả phí còn sót

| Vị trí | Sửa |
|---|---|
| `pages/PaymentsPage.jsx:464` ô "Thu phí thành viên", `:550` lọc "Phí thành viên" | Bỏ |
| `pages/ReportsPage.jsx:225` "Gói thành viên", `:676`, `:912` "HV: …" | Bỏ dòng hội viên; ô "Thu giải & Thành viên" đổi thành "Thu giải đấu" |
| `pages/CustomerHistory.jsx:493` "Phí thành viên" | Bỏ |
| `guest/Layout.jsx:465` link chân trang "Gói thành viên (Membership)" | Đổi thành "Hạng thành viên" → `/thanh-vien` |
| Trang chủ: khối "COURTLY MEMBERSHIP… Khám phá membership" (nguồn `guest/overview.json`, `translations.json`) | Viết lại: "COURTLY MEMBER · Chơi càng nhiều, ưu đãi càng lớn", nút "Xem 4 hạng thành viên" |
| `guest/Pricing.jsx:263` "tiền cọc 30%", `:266` "Giảm thêm từ 10% – 20%" | "xem tiền cọc 50%", "Thành viên giảm 3% – 8% theo hạng" |
| `guest/AiChatbox.jsx:71` "cọc 30% - 50% trong vòng 15 phút" | "cọc 50% trong 5 phút" |
| `/thanh-vien` quà Grand Slam ghi "1.000đ + Voucher 300k" | "1.000 điểm + Voucher 300.000₫ + Thẻ VIP Lounge" |

**Nghiệm thu:** `git grep -n -i "membership\|hội viên\|phí thành viên\|cọc 30" -- frontend/src` chỉ còn tên biến/route kỹ thuật cần cho tương thích ngược (`membershipBenefit`, route `membership` → `/thanh-vien`).

Commit: `refactor(ui): bo tan du goi hoi vien va sua thong tin coc`

### P2-2. Lỗi hiển thị nhỏ

1. **Banner nhắc lịch** (`guest/Portal.jsx` ≈ dòng 380–410): "18:00 – 19.5:00" → định dạng giờ kết thúc bằng hàm `clock()` có sẵn, ra "18:00 – 19:30".
2. **Check-in ngoại lệ** (`components/AutoQRCheckInModal.jsx:428`): khi có lý do thì tiêu đề là "ĐÃ CHECK-IN NGOẠI LỆ", hiện lý do và người duyệt; chỉ ca đúng giờ mới ghi "CHECK-IN TỰ ĐỘNG THÀNH CÔNG!".
3. **Thành viên & điểm** (`LoyaltyController` `/admin/loyalty/members` và báo cáo hạng): chỉ lấy tài khoản `role = CUSTOMER`; số Rookie trong báo cáo không đếm admin/staff.
4. **Trọng tài lặp tên** ("TT Nguyễn Hoàng Long, TT Nguyễn Hoàng Long") ở Việc cần xử lý / Dịch vụ trọng tài / Đơn của tôi: gộp theo trọng tài, hiện "TT Nguyễn Hoàng Long · 1 giờ".
5. **Đơn mẫu #44444444** lặp mỗi khung giờ 4 lần: sửa seed (đơn định kỳ 4 tuần phải là 4 ngày khác nhau, mỗi ngày 4 slot), danh sách chỉ hiện slot của ngày đang xem.
6. **Form tạo voucher**: "Hiệu lực từ / Đến ngày" mặc định theo giờ Việt Nam (đang lấy UTC, hiện ngày hôm trước lúc rạng sáng).
7. **So sánh bảng giá** (Sân & bảng giá → Xem trước): thêm cột giá hiện tại và cột chênh lệch.
8. **Đối soát & Ngoại lệ**: số trên tiêu đề ("(8)") phải bằng tổng 3 nhóm; nhóm "Đơn đã hủy còn tiền cọc chờ đối soát" phải liệt kê các đơn đang ở tab "Đơn cần hoàn tiền".
9. **Đánh giá**: chủ đề khách chọn ("Trọng tài & HLV") phải được lưu và hiện đúng trong hộp xử lý (đang hiện "SERVICE").
10. **Chiến dịch**: thêm 2 nhóm khách theo brief gốc: "Sắp lên hạng" (`NEAR_NEXT_TIER`, thiếu ≤ 20% chi tiêu tới hạng kế) và "Danh sách tự chọn" (`CUSTOM_LIST`, dán số điện thoại/email). Thêm ô chọn voucher gắn chiến dịch.
11. **Seed có thời điểm ở tương lai** (feedback 16:00/17:00 cùng ngày reset, giao dịch `PAY-CANC-013` 07:35): mọi bản ghi "đã xảy ra" phải trước thời điểm reset.

Mỗi mục một commit nhỏ hoặc gộp 2–3 mục cùng file, tên `fix(ui): …` / `fix(seed): …`.

---

## Phần C — Kiểm tra cuối (một lần duy nhất)

1. `docker compose down -v` → `docker compose up -d --build` (có cache từ A1 nên nhanh) → backend lên, Flyway chạy hết.
2. `.\reset-demo.ps1` **2 lần** (lần 2 để chắc reset lặp lại được) → cả hai `[THANH CONG]`.
3. `cd backend && mvn -q test`; `cd frontend && npm run lint && npm run build`.
4. `python scripts/smoke_demo.py` → tất cả `PASS`.
5. Mở giao diện, đi nhanh các bước có ô "Tránh khi demo" trong `docs/HUONG_DAN_CHECK_IN.html`: chiến dịch, quét thẻ VIP, Hạng & điểm của tôi, đổi quà, thu cọc tại quầy, bảng kê check-out, Đơn của tôi, banner nhắc lịch, trang Bảng giá. Mỗi mục ghi đạt/không đạt vào mô tả commit cuối.
6. `.\reset-demo.ps1` một lần nữa để để lại dữ liệu sạch cho buổi demo.

Không push nếu chưa được yêu cầu.
