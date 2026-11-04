# TASK: Sửa lỗi sau đợt triển khai OTP / thông báo / voucher / hạng thành viên

> Brief cho AI agent. Đọc hết trước khi sửa. Spec gốc: `docs/TASK_PHONE_NOTIFY_PROMO.md` (gọi tắt là **brief gốc**). Khi brief này và brief gốc lệch nhau, theo brief này.
>
> Phạm vi: chỉ sửa các lỗi dưới đây, không refactor ngoài phạm vi, không đổi chính sách giá/hoàn tiền/check-in đang chạy đúng.
> Nguyên tắc chung: làm theo cách doanh nghiệp thật vận hành chương trình khách hàng thân thiết (sổ điểm có đối soát, không cộng/trừ điểm hai lần, không lộ quyền admin cho khách, số điện thoại là định danh duy nhất).

Kiểm tra trên build commit `b345250` (nhánh `nam-dev`), DB sau `.\reset-demo.ps1`.

---

## P0 — Toàn bộ web trắng trang (làm trước tiên, commit riêng)

**Hiện trạng:** `frontend/src/App.jsx:68` và `:70` (mảng `adminMenu`, `staffMenu`) dùng icon `Megaphone` và `Award`, nhưng dòng import lucide ở `App.jsx:5` không có hai icon này. Mảng được khai báo ở cấp module nên bundle ném `ReferenceError: Megaphone is not defined` ngay khi tải → trang khách, admin, staff đều trắng.

**Sửa:** thêm `Megaphone, Award` vào import `lucide-react` ở `App.jsx:5`.

**Phòng tái phát:** thêm ESLint tối thiểu cho frontend với rule `no-undef` và `react/jsx-no-undef` (hoặc `eslint-plugin-react`), script `npm run lint`; chạy lint toàn bộ `src/` và sửa mọi lỗi `no-undef` tìm được.

**Nghiệm thu:** `npm run build` và `npm run lint` không lỗi; mở `http://localhost:3000/`, `/thanh-vien`, `/dat-san`, đăng nhập admin và staff — không có lỗi đỏ trong console.

Commit: `fix(ui): bo sung import icon Megaphone, Award va them lint no-undef`

---

## P1-1 — Chưa dùng được điểm (đổi điểm trừ tiền sân + đổi dịch vụ)

**Hiện trạng:** `LoyaltyService.computePointsDiscount(...)` (≈ dòng 324) và `deductPointsForOrder(...)` (≈ dòng 338) tồn tại nhưng **không nơi nào gọi**. `OrderService` không nhận số điểm khách muốn dùng; `Booking.jsx` không có ô dùng điểm; chưa có danh mục đổi dịch vụ. Kịch bản demo `demo.hoivien` dùng 500 điểm để lên Grand Slam (brief gốc §11) không chạy được.

**Yêu cầu (theo brief gốc §3 và P2-c):**

1. **API tạo đơn** (`POST /api/orders` và luồng tạo đơn tại quầy) nhận thêm `pointsToUse` (int, mặc định 0).
2. **Thứ tự tính giá** (giữ nguyên phần đã có, chèn bước điểm):
   giá sân → giảm theo hạng (`MembershipService.quote`) → voucher → **điểm** → không âm.
   - Phí trọng tài không bị giảm bởi hạng/voucher/điểm.
   - Điểm: 1 điểm = 100₫, tối thiểu 100 điểm, bội số 10, tối đa **50% tiền sân còn lại sau hạng + voucher**, không vượt số dư.
   - Tiền cọc = 50% tổng sau mọi giảm trừ (giữ quy tắc hiện tại).
   - Lưu vào `orders.points_redeemed` và `orders.points_discount` (cột đã có).
3. **Giữ điểm khi tạo đơn**: trừ `points_balance` và ghi `loyalty_ledger` type `REDEEM_ORDER` (âm) trong cùng transaction tạo đơn, khoá dòng account (`SELECT … FOR UPDATE` / `@Lock`) để hai đơn song song không tiêu trùng điểm.
4. **Hoàn điểm**: đơn hết hạn giữ chỗ (5 phút), bị huỷ hoặc hoàn tiền → ghi `REVERSAL` (+) trả lại đúng số điểm đã dùng, idempotent theo `(type, order_id)`. Huỷ có phí theo bậc 100/50/0 vẫn trả lại **toàn bộ** điểm (điểm không bị phạt).
5. **Tích điểm** (`earnOrderPoints`, đã gọi ở `OrderService` ≈ dòng 620): giữ nguyên quy tắc không tính phần trả bằng điểm.
6. **Đơn tại quầy**: khách muốn dùng điểm phải xác thực OTP tới số điện thoại của tài khoản (dùng lại `/api/auth/phone/send-otp` với `purpose: "POINTS"`); không có OTP hợp lệ → từ chối `pointsToUse > 0`.
7. **Danh mục đổi dịch vụ** (`GET /api/loyalty/rewards`, `POST /api/loyalty/rewards/{code}/redeem`): đổi điểm lấy voucher cá nhân (`assigned_account_id` = khách, `source = 'POINTS_REWARD'`, hạn 60 ngày, `usage_limit = 1`):
   | Mã | Quà | Điểm |
   |---|---|---|
   | `EXT30` | Gia hạn 30 phút | 800 |
   | `GOLDEN1H` | 1 giờ sân giờ vàng (10:00–15:00) | 1.200 |
   | `REF1H` | 1 giờ trọng tài | 2.000 |
   Ghi ledger `REDEEM_REWARD`. Hiển thị ở trang "Hạng & điểm của tôi" (`frontend/src/pages/MyLoyalty.jsx`).
8. **UI `Booking.jsx`** (khối tóm tắt giá ≈ dòng 1230): thêm dòng "Dùng điểm" — công tắc + ô số điểm, hiển thị số dư, mức tối đa được dùng, số tiền trừ; tổng và cọc cập nhật ngay. Đổi nhãn "Ưu đãi hội viên" thành "Ưu đãi hạng {Tên hạng} (−x%)".
9. **Popup đơn** (`components/OrderDialogs.jsx`): hiển thị "Giảm theo hạng", "Voucher", "Dùng điểm (n điểm)" thành các dòng riêng.

**Nghiệm thu (sau reset):**
- `demo.hoivien` (Masters, 1.500 điểm) đặt 1 giờ sân A01 buổi tối: giá 300.000₫ → hạng −5% = 285.000₫ → dùng 500 điểm −50.000₫ = **235.000₫**, cọc **117.500₫**; số dư còn 1.000 điểm.
- Thu đủ + check-out → chi tiêu 12 tháng ≥ 20.000.000₫ → lên **Grand Slam ngay**, nhận 1.000 điểm + voucher 300.000₫ + thẻ VIP.
- Cố dùng 2.000 điểm cho đơn 235.000₫ → bị giới hạn ở 50% tiền sân còn lại.
- Đơn giữ chỗ hết 5 phút → điểm được trả lại, ledger có `REVERSAL`.

Commit: `feat(loyalty): dung diem tru tien san va doi diem lay dich vu`

---

## P1-2 — Đăng ký trùng số điện thoại với tài khoản cũ

**Hiện trạng:** tài khoản tạo mới lưu `+84…` (E.164), nhưng tài khoản seed/cũ lưu `09…` (vd `demo.khach` = `0911000002`, `hoangnam` = `0912345678`, xem `backend/src/main/resources/demo/baseline.json`). `send-otp`/`register` so theo E.164 nên không thấy trùng. Đã tái hiện: đăng ký thành công tài khoản mới bằng số `0911000002` của `demo.khach`.

**Sửa:**
1. Migration **V19** `normalize_phones`: chuyển mọi `accounts.phone` về E.164 (`0xxxxxxxxx` → `+84xxxxxxxxx`, bỏ khoảng trắng/dấu chấm). Trước khi đổi, phát hiện trùng sau chuẩn hoá: nếu có, giữ tài khoản có đơn/được tạo sớm nhất, các bản trùng chuyển `phone` thành `NULL`/rỗng và ghi `audit_logs` — migration không được fail.
2. Mọi chỗ ghi số điện thoại (tạo tài khoản admin/staff, hồ sơ khách, đơn tại quầy, seed `baseline.json`, `DemoResetService`, `scripts/seed_showcase.py`) đều đi qua `PhoneUtils.normalizeE164`.
3. Mọi chỗ tìm khách theo số điện thoại (đăng nhập bằng SĐT, quầy thu tìm khách, tạo đơn tại quầy) chuẩn hoá input trước khi so.
4. Hiển thị vẫn dạng `0911 000 002` (đã có formatter).

**Nghiệm thu:** sau reset, `select phone from accounts where phone !~ '^\+84\d{9}$' and phone <> ''` trả 0 dòng; `send-otp` với `0911000002`, `+84911000002`, `0911.000.002` đều báo "Số điện thoại đã có tài khoản".

Commit: `fix(auth): chuan hoa so dien thoai E.164 va chan dang ky trung`

---

## P1-3 — Staff bị 403 ở mục phản hồi

**Hiện trạng:** `backend/src/main/java/com/courtly/config/SecurityConfig.java:57` đặt `/api/content/**` vào nhóm chỉ ADMIN, nên staff gọi `GET /api/content`, `POST /api/content/feedback/{id}/assign|resolve|compensate` đều 403 dù `ContentService` cho phép STAFF và menu staff có "Feedback & Đánh giá".

**Sửa:** trước matcher ADMIN, thêm:
- `GET /api/content` → `hasAnyRole("ADMIN","STAFF")`
- `POST /api/content/feedback/*/assign`, `/resolve`, `/compensate` → `hasAnyRole("ADMIN","STAFF")`
Các route sửa nội dung CLB/bài viết/xoá/ẩn phản hồi (`/api/content/club`, `/api/content/articles/**`, `PUT/PATCH /api/content/feedback/{id}`) giữ **chỉ ADMIN**. Phân quyền chi tiết theo mẫu voucher (staff chỉ được 2 mẫu đầu, mẫu "1 giờ sân miễn phí" chỉ admin) vẫn kiểm trong `ContentService`.

**Nghiệm thu:** đăng nhập `staff@gmail.com` → mở "Feedback & Đánh giá", thấy phản hồi 2 sao, nhận xử lý, tặng mẫu "Xin lỗi nhẹ 50k" thành công; thử mẫu admin-only → bị từ chối với thông báo rõ ràng; khách gọi các route trên → 403.

Commit: `fix(security): cho staff xu ly feedback`

---

## P1-4 — Tặng voucher bù cho phản hồi: lặp và sai nguồn

**Hiện trạng** (`ContentService.compensateFeedback` ≈ dòng 411–444):
- Dòng 418 chỉ chặn tặng lần 2 với non-admin → admin tặng 2 lần cho cùng phản hồi ra 2 mã (`SORRY-3LPK`, `SORRY-6T5J`).
- Voucher tạo ra có `source = 'GENERAL'`, `feedback_id = NULL`, nên thống kê bù đắp và báo cáo không đếm được.

**Sửa:**
1. Mỗi phản hồi chỉ có **một** voucher bù đang hiệu lực. Áp dụng cho mọi vai trò. Muốn đổi mức bù: admin phải **thu hồi** voucher cũ (chỉ khi chưa dùng → `status = 'REVOKED'`) kèm lý do ≥ 5 ký tự, rồi mới tặng lại. Ghi audit cả hai thao tác.
2. Voucher bù: `source = 'FEEDBACK_RECOVERY'`, `feedback_id = <id phản hồi>`, `order_id` = đơn gắn với phản hồi (nếu có), `assigned_account_id` = khách.
3. Kiểm tra đồng thời: khoá document phản hồi (dùng `version` của `app_documents`) để hai cú bấm liên tiếp không tạo hai mã.
4. UI: sau khi tặng, nút "🎁 Tặng voucher" đổi thành nhãn "Đã tặng SORRY-XXXX"; admin thấy thêm nút "Thu hồi".

**Nghiệm thu:** bấm tặng 2 lần liên tiếp (kể cả admin) → chỉ 1 voucher; lần 2 báo "Phản hồi này đã được tặng voucher SORRY-XXXX"; `select source, feedback_id from vouchers where code like 'SORRY-%'` ra `FEEDBACK_RECOVERY` và có id.

Commit: `fix(feedback): mot voucher bu cho moi phan hoi va gan nguon`

---

## P1-5 — Tài khoản mới không nhận voucher chào mừng 50.000₫

**Hiện trạng:** đăng ký mới qua OTP (`AuthService` luồng `phoneToken` ≈ dòng 470) tạo tài khoản ROOKIE nhưng `/api/vouchers/my` rỗng.

**Sửa:** sau khi tạo tài khoản đã xác thực SĐT, phát voucher cá nhân `WELCOME-XXXX`: giảm 50.000₫, hạn 30 ngày, `usage_limit = 1`, `source = 'TIER_GIFT'`, `assigned_account_id` = khách; idempotent (một tài khoản/một số điện thoại chỉ nhận một lần, kể cả xoá tài khoản rồi đăng ký lại cùng số). Thông báo in-app "Chào mừng bạn đến Courtly – tặng voucher 50.000₫". Không gửi SMS/email marketing nếu `marketing_consent = false`.

**Nghiệm thu:** đăng ký số mới → trang "Ưu đãi của tôi" có voucher 50.000₫; áp vào đơn đầu tiên được.

Commit: `fix(loyalty): phat voucher chao mung khi dang ky`

---

## P1-6 — Xét hạng theo chi tiêu 12 tháng, không phải trọn đời

**Hiện trạng:** `LoyaltyService.earnOrderPoints` (≈ dòng 164) gọi `checkTierUpgrade(account, newSpend)` với `lifetime_spend` (cộng dồn trọn đời). Brief gốc yêu cầu chi tiêu **12 tháng gần nhất**.

**Sửa:**
1. Thêm `LoyaltyService.rolling12MonthSpend(accountId)` = tổng `loyalty_ledger.spend_amount` của các dòng `EARN` trong 365 ngày (theo `Clock`) trừ phần `REVERSAL` tương ứng.
2. `checkTierUpgrade` và job 02:00 hằng ngày (giữ hạng 12 tháng, hạ tối đa một bậc, cảnh báo trước 30 ngày) dùng giá trị này.
3. `lifetime_spend` giữ làm thống kê, không dùng để xét hạng.
4. API `/api/loyalty/my` trả thêm `spend12m`; `neededSpendToUpgrade` tính từ `spend12m`. UI "Hạng & điểm của tôi" hiển thị "Chi tiêu 12 tháng" và thanh tiến độ theo giá trị này.
5. Seed phải đồng bộ: ledger `EARN` của mỗi tài khoản demo cộng lại đúng bằng chi tiêu ghi trong §P1-7.

**Nghiệm thu:** test đơn vị với `Clock` cố định: đơn chi tiêu cách 13 tháng không được tính; khách có 19,8 triệu trong 12 tháng + đơn 235.000₫ → lên Grand Slam.

Commit: `fix(loyalty): xet hang theo chi tieu 12 thang`

---

## P1-7 — Dữ liệu demo lệch brief

Sửa trong `DemoResetService` (khối loyalty ≈ dòng 495–530, voucher ≈ dòng 620–650) và seed liên quan.

| Tài khoản | Cần sửa |
|---|---|
| `kietdlv@gmail.com` | `phone_verified_at` và `email_verified_at` có giá trị; `marketing_consent = true`; `birth_date` năm thật (vd `1998-<tháng sau>-15`, giữ ý "sinh nhật tháng sau"); ledger thêm dòng `TIER_GIFT +1000` ngày lên hạng (45 ngày trước) — tổng `EARN` + `TIER_GIFT` phải bằng 2.400 nên giảm các dòng `EARN` cho khớp; voucher `TIER-GS-300K` hạn **60 ngày tính từ ngày lên hạng** (còn ~15 ngày), không phải `NOW() + 60 ngày`. |
| `phuongmaiphanqn3@gmail.com` | `phone_verified_at`, `email_verified_at` có giá trị; `marketing_consent = true`; có voucher chào mừng 50.000₫ (đã có `WELCOME-50K`, giữ). |
| `demo.hoivien@gmail.com` | `marketing_consent = true`; ledger `EARN` khớp 19.800.000₫ trong 12 tháng và 1.500 điểm. |
| `demo.khach@gmail.com` | `marketing_consent = true`; `birth_date` năm thật (vd `1996-<tháng hiện tại>-10`); ledger khớp 3.400.000₫ / 420 điểm. |

Ngày sinh không được nằm ở năm hiện tại hay tương lai. Tất cả SĐT dạng E.164 (xem P1-2). Reset không được gửi bất kỳ SMS/email thật nào (giữ `NOTIFY_ALLOWLIST`).

**Nghiệm thu:**
```sql
select email, phone, tier, points_balance, lifetime_spend, birth_date,
       phone_verified_at is not null pv, marketing_consent
from accounts where email in ('kietdlv@gmail.com','phuongmaiphanqn3@gmail.com',
  'demo.hoivien@gmail.com','demo.khach@gmail.com');
```
→ cả 4 dòng `pv = t`, `marketing_consent = t`, năm sinh < năm hiện tại; với mỗi tài khoản `sum(points) from loyalty_ledger` = `points_balance`.

Commit: `fix(seed): dong bo du lieu demo hang thanh vien`

---

## P1-8 — Voucher cũ chưa chuyển sang mô hình mới

**Hiện trạng:** 7 voucher cũ (`VIP10`, `FLASH25`, `HE2026`, `COURTLY50K`, `WELCOME`, `HETHAN2025`, `CHAOBANMOI`) có `status = NULL`, `source = NULL`; `VIP10` vẫn `member_only = true`, `min_tier = NULL`. Code `VoucherService` (≈ dòng 112–120 và 316–321) vẫn đọc `member_only` và gọi `memberships.hasActiveMembership`.

**Sửa:**
1. Migration **V20** `backfill_vouchers`:
   - `status`: `enabled = false` → `PAUSED`; `expires_at < now()` → `ENDED`; còn lại `ACTIVE`.
   - `source` NULL → `GENERAL`.
   - `member_only = true` → `min_tier = 'CHALLENGER'`, rồi `member_only = false`.
   - Đặt `status`, `source` `NOT NULL` với default.
2. Cập nhật `baseline.json` cho khớp (bỏ `member_only`, thêm `min_tier`, `status`, `source`).
3. `VoucherService`: bỏ mọi nhánh `memberOnly` / `hasActiveMembership`; điều kiện duy nhất là `min_tier`. Thông báo: "Chỉ áp dụng từ hạng Challenger trở lên". Khách chưa đăng nhập → "Đăng nhập để dùng voucher theo hạng".
4. Giữ cột `member_only` trong DB tới đợt dọn sau (không đọc/ghi nữa); xoá field khỏi entity `Voucher` và DTO trả về.
5. `Booking.jsx:1075` đổi nhãn `Hội viên` → `🔒 từ hạng {Tên}`.

**Nghiệm thu:** `select count(*) from vouchers where status is null or source is null` = 0; `demo.khach` (Challenger) áp được `VIP10`; `phuongmai` (Rookie) thấy `VIP10` mờ với nhãn "🔒 từ hạng Challenger".

Commit: `fix(promo): chuyen voucher cu sang trang thai va hang toi thieu`

---

## P1-9 — Gỡ nốt gói hội viên trả phí

Brief gốc yêu cầu bỏ hoàn toàn. Còn sót:

| Vị trí | Việc cần làm |
|---|---|
| `frontend/src/pages/MembershipPage.jsx`, `MembershipAdminPage.jsx`, `MyMembership.jsx`, `components/MembershipPlans.jsx` | Xoá file; xoá import `MembershipPage` ở `App.jsx:23` và mọi route/menu trỏ tới. `/membership` redirect 301 (phía client: `replace`) sang `/thanh-vien`. |
| `frontend/src/guest/Account.jsx` (component `Membership` dùng cho route `membership` trong `Portal.jsx:591`) | Thay bằng trang giới thiệu hạng (đọc `/api/public/loyalty/tiers`) + khối "Hạng & điểm của tôi" khi đã đăng nhập. Không còn nút mua gói. `Account.jsx:829` đổi chữ "ưu đãi hội viên" → "ưu đãi hạng thành viên". |
| `frontend/src/guest/AiChatbox.jsx` (≈ dòng 82, 192, 211, 365, 416–460, 595) | Viết lại kiến thức chatbot: 4 hạng, ngưỡng chi tiêu 12 tháng, % giảm, tích/đổi điểm, quà lên hạng, voucher sinh nhật. Xoá "Hội viên Club 10%", "Member Plus 15%", câu gợi ý "Quyền lợi các gói Hội viên Club?" → "Quyền lợi các hạng thành viên?". |
| `frontend/src/components/OrderDialogs.jsx` (≈ dòng 79, 516, 615, 924) | "Ưu đãi hội viên (planName)" → "Giảm theo hạng {Tên} (−x%)"; dòng 79 "thẻ hội viên" → "mã QR đặt sân". |
| `frontend/src/components/DialogHost.jsx:48` | Bỏ nhánh `MEMBERSHIP_FEE` / `planName`. |
| `frontend/src/components/AutoQRCheckInModal.jsx:382` | "Hội viên:" → "Hạng:" (hiện tên hạng; Grand Slam có badge VIP). |
| `frontend/src/guest/translations.json` | Xoá/cập nhật các chuỗi về gói hội viên và câu "Tích lũy 10 điểm cho mỗi 100.000 đ…" (sai quy tắc) → "1 điểm cho mỗi 10.000₫ thực thu". |
| Backend `MembershipService` | Giữ class (đang dùng cho `quote` theo hạng) nhưng đổi tên thành `TierPricingService`, key metadata `membershipBenefit` → `tierBenefit` (đọc được cả key cũ cho đơn đã có). Xoá mọi endpoint/loại thanh toán `MEMBERSHIP_FEE` còn sót. |

**Nghiệm thu:** `git grep -n -i "membership\|hội viên\|hoi vien\|Member Plus" -- frontend/src backend/src/main/java` chỉ còn: tên migration cũ, đoạn đọc key `membershipBenefit` để tương thích ngược. Chatbot trả lời "có những hạng thành viên nào" đúng 4 hạng.

Commit: `refactor(loyalty): go bo tan du goi hoi vien tra phi`

---

## Thứ tự làm và bàn giao

1. P0 (trắng trang) → build, mở web kiểm tra.
2. P1-2 (SĐT) và P1-8 (voucher) — có migration V19, V20, làm trước để dữ liệu sạch.
3. P1-6 (xét hạng 12 tháng) → P1-1 (dùng điểm) → P1-5 (voucher chào mừng).
4. P1-3, P1-4 (feedback).
5. P1-7 (seed) → P1-9 (dọn gói hội viên).

Mỗi mục một commit, tên như ghi ở từng mục. Không gộp, không push nếu chưa được yêu cầu.

**Kiểm tra cuối (bắt buộc, ghi kết quả vào mô tả commit cuối):**
1. `docker compose up -d --build` → `.\reset-demo.ps1` → backend khởi động không lỗi, Flyway tới V20.
2. Chạy toàn bộ test backend; thêm test đơn vị cho: tính giá có điểm (giới hạn 50%, bội số 10, tối thiểu 100), trả điểm khi huỷ/hết hạn, xét hạng 12 tháng với `Clock` cố định, chống tặng voucher bù lần 2, chuẩn hoá SĐT.
3. Chạy lại toàn bộ "Nghiệm thu" của từng mục trên trình duyệt với 4 tài khoản demo + `admin@gmail.com` + `staff@gmail.com` (mật khẩu `123456`).
4. Cập nhật `docs/HUONG_DAN_CHECK_IN.html` (kịch bản demo): thêm bước dùng 500 điểm ở `demo.hoivien`, bước đổi quà điểm, bước staff tặng voucher bù.
