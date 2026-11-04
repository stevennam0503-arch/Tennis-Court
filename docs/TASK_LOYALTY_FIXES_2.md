# TASK: Sửa lỗi còn lại sau đợt `TASK_LOYALTY_FIXES`

> Brief cho AI agent. Đọc hết trước khi sửa. Spec gốc: `docs/TASK_PHONE_NOTIFY_PROMO.md` và `docs/TASK_LOYALTY_FIXES.md`. Khi lệch nhau, theo brief này.
>
> Kiểm tra trên build commit `92dbdb0` (nhánh `nam-dev`), sau `docker compose up -d --build` và `.\reset-demo.ps1`.
> Phạm vi: chỉ sửa các mục dưới đây. Không đổi những phần đã nghiệm thu đạt (danh sách ở cuối).
> Nguyên tắc: làm theo cách doanh nghiệp thật vận hành. Migration phải chạy được trên DB có dữ liệu bẩn. Reset demo phải lặp lại được nhiều lần cho ra cùng một kết quả. Sổ điểm và voucher phải đối soát được theo nguồn.

---

## P0-1 — Migration V19 lỗi khi có số điện thoại trùng

**Hiện trạng:** `backend/src/main/resources/db/migration/V19__normalize_phones.sql` dùng **một** lệnh `UPDATE … FROM ranked` để vừa chuẩn hoá số của bản giữ lại (`rn = 1`), vừa xoá trắng số của bản trùng (`rn > 1`). Chỉ mục unique `ux_accounts_phone` được kiểm tra từng dòng. Nếu Postgres cập nhật bản giữ lại trước bản trùng thì lỗi `duplicate key value violates unique constraint "ux_accounts_phone"` và backend không khởi động được.

Đã tái hiện được với 2 tài khoản `0911000002` và `+84911000002`.

**Sửa:**
1. Tách thành các bước tuần tự trong cùng file:
   - (a) tính bảng tạm `phone_norm(id, norm_phone, rn)`;
   - (b) ghi `audit_logs` cho các dòng `rn > 1`;
   - (c) `UPDATE accounts SET phone = '' WHERE id IN (… rn > 1)`;
   - (d) `UPDATE accounts SET phone = norm_phone WHERE id IN (… rn = 1)`.
   Dùng `CREATE TEMP TABLE … ON COMMIT DROP` để không phải tính lại.
2. `PARTITION BY` chỉ xét `role = 'CUSTOMER'`, khớp phạm vi của `ux_accounts_phone`. Số của ADMIN/STAFF vẫn chuẩn hoá nhưng không bị xoá trắng vì trùng với khách.
3. V19 đã được áp dụng trên máy dev, nên sửa file sẽ làm lệch checksum. Ghi chú trong mô tả commit: máy nào đã chạy V19 thì chạy `flyway repair` (hoặc `./mvnw flyway:repair`) một lần. Không tạo V21 thay thế, vì V19 lỗi chỉ làm hỏng DB có dữ liệu trùng.
4. Thêm test tích hợp (Testcontainers hoặc test SQL trên DB test): seed 2 khách cùng số, khác định dạng, cộng 1 staff cùng số. Sau migrate: một khách giữ số dạng `+84…`, khách còn lại có số rỗng và có `audit_logs`, staff giữ số.

**Nghiệm thu:** DB trống chạy V1→V20 không lỗi. DB có cặp số trùng như trên cũng chạy không lỗi.

Commit: `fix(migration): V19 xu ly so trung theo tung buoc`

---

## P0-2 — Reset demo qua API bị 409 và script báo thành công giả

**Hiện trạng:**
- `baseline.json` đã bỏ trường `member_only`, nhưng cột `vouchers.member_only` vẫn `NOT NULL`. `DemoBaselineService` khôi phục voucher bằng `json_populate_recordset`, nên cột này nhận `NULL` và lỗi `null value in column "member_only"`. `GlobalExceptionHandler` đổi lỗi thành 409 "Dữ liệu bị trùng hoặc vừa thay đổi" và **không log nguyên nhân**.
- `scripts/seed_showcase.py:94-95`: khi API lỗi thì chỉ in `Direct fallback...` rồi thoát. `reset-demo.ps1` vẫn in `[THANH CONG]`.
- `scripts/seed_showcase.py:14` và `:86` vẫn in "Gói hội viên (Nam VIP Plus, Thảo Club, Hà Pending duyệt)".

> Ghi chú: trên máy dev, cột `member_only` đã được nới tay bằng `ALTER TABLE vouchers ALTER COLUMN member_only DROP NOT NULL` để test. Migration mới dưới đây phải chạy được trong cả hai trạng thái.

**Sửa:**
1. Migration **V21** `vouchers_member_only_nullable`: `ALTER TABLE vouchers ALTER COLUMN member_only DROP NOT NULL; ALTER COLUMN member_only SET DEFAULT false; UPDATE vouchers SET member_only = false WHERE member_only IS NULL;`. Lệnh này chạy lại an toàn khi cột đã nullable.
2. Rà mọi cột `NOT NULL` không có trong `baseline.json`: viết một test so `information_schema.columns` (`is_nullable = 'NO'`, không có default) với key của từng bảng trong `baseline.json`, và fail nếu thiếu.
3. `GlobalExceptionHandler` (nhánh `DataIntegrityViolationException`): `log.warn` kèm `getMostSpecificCause().getMessage()`. Response cho người dùng giữ nguyên.
4. `scripts/seed_showcase.py`:
   - Bỏ nhánh "Direct fallback". API lỗi thì in rõ mã HTTP và message, rồi `sys.exit(1)`.
   - Phân biệt "backend chưa chạy" (connection refused: in "Backend chưa sẵn sàng tại http://localhost:8081, kiểm tra `docker compose ps` / log backend") với lỗi 4xx/5xx.
   - Thêm chờ sẵn sàng: thử `/api/csrf` tối đa 60 giây trước khi gọi reset.
5. `reset-demo.ps1`: chỉ in `[THANH CONG]` khi script Python trả exit code 0; ngược lại in `[THAT BAI]` và `exit 1`.
6. Viết lại phần tóm tắt in ra ở `seed_showcase.py` theo dữ liệu hiện tại: thay mục 8 bằng "Hạng thành viên: Kiệt Grand Slam, Khoa Masters (sắp lên hạng), Trang Challenger (sinh nhật tháng này), Phương Mai Rookie". Cập nhật docstring dòng 14.

**Nghiệm thu:**
- `.\reset-demo.ps1` chạy 3 lần liên tiếp đều thành công qua API.
- Tắt backend (`docker stop tennis-court-git-backend-1`) rồi chạy: script báo thất bại rõ ràng, exit code ≠ 0.

Commit: `fix(seed): reset demo bao loi that va bo member_only bat buoc`

---

## P1-1 — Không phát voucher chào mừng 50.000₫ khi đăng ký

**Hiện trạng:** `AuthService.issueWelcomeVoucherIfEligible` (≈ dòng 359–365) gọi `documents.lock(docKey)` rồi `if (existingDoc != null) return;`. Nhưng `DocumentService.lock()` trả `repository.lock(key).orElseGet(() -> new AppDocument(key))`, **không bao giờ `null`**, nên hàm luôn thoát sớm. Đăng ký số mới qua OTP thì `/api/vouchers/my` rỗng. Test hiện tại qua được vì mock.

**Sửa:**
1. Kiểm tra tồn tại bằng nội dung, ví dụ `documents.read(row)` rỗng, `row.getData() == null`, hoặc `repository.findById(key).isPresent()`. Vẫn giữ khoá dòng để hai request đăng ký song song không phát hai lần.
2. Sửa `PhoneAuthServiceTest`: dùng `DocumentService` thật (hoặc stub đúng hành vi `orElseGet`) để test bắt được lỗi này. Thêm test: đăng ký → có đúng 1 voucher `WELCOME-XXXX`; xoá tài khoản, đăng ký lại cùng số → không có voucher mới.

**Nghiệm thu:** đăng ký số mới → "Ưu đãi của tôi" có voucher 50.000₫, hạn 30 ngày, có thông báo in-app "Chào mừng bạn đến Courtly".

Commit: `fix(loyalty): sua dieu kien phat voucher chao mung`

---

## P1-2 — Voucher quà lên hạng và voucher sinh nhật bị ghi thành voucher bù phản hồi

**Hiện trạng:** `LoyaltyService` gọi `voucherService.createCompensationVoucher(...)` để:
- phát voucher 300.000₫ khi lên Grand Slam (≈ dòng 316);
- phát voucher sinh nhật (≈ dòng 714).

Hàm này (`VoucherService` ≈ dòng 558) luôn đặt mã `SORRY-XXXX` và `source = 'FEEDBACK_RECOVERY'`, lại lấy **khách** làm `actor`, nên dính luật hạn mức của staff. Đã tái hiện: `demo.hoivien` lên Grand Slam và nhận `SORRY-USMM`, 300.000₫, `FEEDBACK_RECOVERY`.

Hậu quả: báo cáo "bù đắp phản hồi" bị đếm sai, khách thấy mã "SORRY" khi được thưởng, và nếu luật hạn mức đổi thì quà có thể rơi vào trạng thái chờ duyệt.

**Sửa:**
1. Tách hàm dùng chung `VoucherService.issuePersonalVoucher(accountId, IssueSpec spec)`, trong đó `spec` gồm `prefix`, `source`, `type`, `value`, `maxDiscount`, `minOrder`, `startsAt`, `expiresAt`, `description`, `orderId`, `feedbackId`. Hàm này là phát hành **của hệ thống**: không áp hạn mức staff, luôn `ACTIVE`, `created_by = NULL`, ghi audit với actor `SYSTEM`.
2. Các nơi gọi:
   | Nơi gọi | Tiền tố mã | `source` | Hạn |
   |---|---|---|---|
   | Quà lên Grand Slam | `GS-` | `TIER_GIFT` | 60 ngày từ lúc lên hạng |
   | Sinh nhật | `BDAY-` | `BIRTHDAY` | cuối tháng sinh nhật |
   | Voucher chào mừng (P1-1) | `WELCOME-` | `TIER_GIFT` | 30 ngày |
   | Bù phản hồi | `SORRY-` | `FEEDBACK_RECOVERY` | giữ như hiện tại |
3. `createCompensationVoucher` chỉ còn dùng cho bù phản hồi và vẫn áp hạn mức theo vai trò của **nhân viên thao tác** (xem P2-1).
4. Idempotent:
   - quà lên hạng: một voucher cho mỗi lần lên Grand Slam, khoá theo `(account, tier, tier_since)`;
   - sinh nhật: một voucher mỗi năm, khoá theo `(account, năm)` (dedupe key `BIRTHDAY_VOUCHER:…` đã có, giữ lại).
5. Migration nhỏ hoặc bước trong reset: sửa các voucher đã phát sai nguồn trên DB dev. Trên DB demo, reset là đủ.

**Nghiệm thu:**
- Đưa `demo.hoivien` lên Grand Slam (kịch bản ở P1-4) → nhận voucher `GS-XXXX` 300.000₫, nguồn `TIER_GIFT`, hạn 60 ngày.
- Chạy job hằng ngày với `Clock` đặt ngày 1 tháng sinh nhật của `kietdlv` → nhận `BDAY-XXXX` 250.000₫, nguồn `BIRTHDAY`.
- Chạy job lần 2 → không có voucher mới.
- `select count(*) from vouchers where code like 'SORRY-%' and source <> 'FEEDBACK_RECOVERY'` = 0.

Commit: `fix(loyalty): tach phat voucher he thong khoi voucher bu phan hoi`

---

## P1-3 — Phản hồi mẫu bị nhân bản sau mỗi lần reset

**Hiện trạng:** `DemoResetService` (≈ dòng 670–700) tạo phản hồi mẫu bằng `UUID.randomUUID()` rồi `INSERT` vào `app_documents`, nhưng không xoá phản hồi cũ. Sau vài lần reset có **33 phản hồi** và **7 phản hồi 2 sao giống hệt nhau** ("Đèn sân B04 chập chờn…").

**Sửa:**
1. Trước khi seed: `DELETE FROM app_documents WHERE document_key LIKE 'feedback:%'`. Xoá luôn document phụ thuộc nếu có (ví dụ khoá idempotent của voucher bù).
2. Dùng **UUID cố định** cho từng phản hồi mẫu (hằng số giống `KIET_ID`), để link/ảnh chụp trong kịch bản demo không đổi giữa các lần reset.
3. Xoá các voucher `SORRY-%` khi reset (đã thuộc dữ liệu demo).
4. Kiểm tra tương tự cho mọi document có key ngẫu nhiên khác trong reset (`article:`, `notification:`…): reset 2 lần thì số lượng phải giữ nguyên.

**Nghiệm thu:** reset 3 lần liên tiếp → `select count(*) from app_documents where document_key like 'feedback:%'` luôn bằng đúng số phản hồi mẫu (4–5 theo seed), và chỉ có **1** phản hồi 2 sao.

Commit: `fix(seed): reset phan hoi mau khong nhan ban`

---

## P1-4 — Kịch bản demo lên hạng không chạy với giá thật

**Hiện trạng:** brief trước giả định 1 giờ A01 buổi tối là 300.000₫. Giá thật là **130.000₫/30 phút = 260.000₫/giờ**. Tính với chi tiêu mẫu 19.800.000₫ của `demo.hoivien`:

| Cách đặt | Thực thu | Chi tiêu sau đơn | Lên Grand Slam? |
|---|---|---|---|
| Không dùng điểm | 247.000₫ | 20.047.000₫ | Có |
| Dùng 500 điểm | 197.000₫ | 19.997.000₫ | **Không** |
| Dùng tối đa điểm (UI tự điền 1.230 điểm) | 124.000₫ | 19.924.000₫ | **Không** |

**Sửa:**
1. `DemoResetService` (khối `khoaSpends` ≈ dòng 595 và `UPDATE accounts` ≈ dòng 515): chi tiêu 12 tháng của `demo.hoivien` = **19.900.000₫** (thiếu 100.000₫). Ví dụ đổi đơn cuối từ 3.800.000₫ thành 3.900.000₫. Ledger `EARN` giữ tổng **1.500 điểm** và tổng `spend_amount` = 19.900.000₫.
2. Kiểm lại cả 3 cách đặt ở bảng trên: đều phải vượt 20.000.000₫ (124.000 + 19.900.000 = 20.024.000₫).
3. Cập nhật `docs/HUONG_DAN_CHECK_IN.html` và `docs/TASK_PHONE_NOTIFY_PROMO.md` §11 cho đúng số. Kịch bản chuẩn:
   - A01 tối 1 giờ: 260.000₫ → hạng Masters −5% = 247.000₫ → dùng 500 điểm = **197.000₫**, cọc **98.500₫**.
   - Thu đủ, check-in, check-out → lên Grand Slam.

**Nghiệm thu:** sau reset, chạy cả 3 cách đặt (mỗi lần reset lại). Cả 3 lần, `demo.hoivien` đều lên Grand Slam ngay khi check-out.

Commit: `fix(seed): chi tieu demo.hoivien khop gia san that`

---

## P2-1 — Mẫu voucher bù chỉ được kiểm tra ở giao diện

**Hiện trạng:** `ContentAdminPage.jsx` (≈ dòng 132–142) gửi thẳng `type`, `value`, `minOrder`, `maxDiscount` lên server. `ContentService.compensateFeedback` (≈ dòng 439–449) nhận luôn các giá trị này. Việc chặn staff dùng mẫu "1 giờ sân miễn phí" chỉ nằm ở giao diện. Đã thử: staff gửi `value: 5000000` → server tạo voucher, chỉ chuyển sang `PENDING_APPROVAL`.

**Sửa:**
1. Định nghĩa 3 mẫu ở backend (enum hoặc bảng cấu hình), API chỉ nhận `templateCode`:
   | Mã | Nội dung | Ai được dùng |
   |---|---|---|
   | `APOLOGY_50K` | Giảm 50.000₫, đơn từ 100.000₫ | ADMIN, STAFF |
   | `SERVICE_20` | Giảm 20%, tối đa 100.000₫ | ADMIN, STAFF |
   | `FREE_COURT_1H` | 1 giờ sân miễn phí | Chỉ ADMIN |
2. Request có `templateCode` không hợp lệ → 400. Staff dùng `FREE_COURT_1H` → 403 "Mẫu này cần quản trị viên". Mọi field `type`/`value` gửi kèm bị bỏ qua.
3. Mẫu tuỳ chỉnh (giá trị tự nhập) chỉ ADMIN được dùng, bắt buộc lý do ≥ 10 ký tự, có ghi audit.
4. `GET /api/content/feedback/compensation-templates` trả danh sách mẫu theo vai trò. Giao diện dựng nút từ API này, không hard-code.

**Nghiệm thu:** staff chỉ thấy 2 mẫu. Gọi API với `value: 5000000` → voucher vẫn là 50.000₫ (theo mẫu) hoặc bị 400. Admin dùng được cả 3 mẫu.

Commit: `fix(feedback): mau voucher bu dinh nghia o backend`

---

## P2-2 — Dọn nốt dấu vết "hội viên" và chống trừ điểm hai lần

1. **Tên khách mẫu** (`DemoResetService` ≈ dòng 110, 116, 211, 444, 573, 603, 626 và `baseline.json`):
   - `Trần Hoàng Nam [Hội viên Plus]` → `Trần Hoàng Nam`
   - `Nguyễn Minh Khoa (Demo hội viên)` → `Nguyễn Minh Khoa`
   - `Phạm Thu Trang (Demo khách)` → `Phạm Thu Trang`
   - `Khách demo Kiệt` → `Nguyễn Tuấn Kiệt` (tên hiển thị; email giữ nguyên)
   Sửa luôn `customer_name` trong các đơn mẫu cho khớp.
2. **`MembershipService`** (giờ là class rỗng kế thừa `TierPricingService`): xoá class, đổi mọi chỗ inject (`BookingSupportService:29`, `OrderService`, `VoucherService`) sang `TierPricingService`. Comment trong `DemoResetService` (≈ dòng 207, 835, 865) đổi "ưu đãi hội viên" → "giảm theo hạng".
3. **`LoyaltyService.reverseOrderPoints`** (≈ dòng 171): chưa chặn trừ hai lần. Thêm kiểm tra: đã có `REVERSAL` âm (`points < 0`) cho `order_id` thì return. Thêm test gọi 2 lần → chỉ 1 dòng `REVERSAL`.
4. **`orders.tier_discount`** đang luôn 0, số giảm theo hạng chỉ nằm trong `metadata.tierBenefit`. Ghi số tiền giảm theo hạng vào cột `tier_discount` lúc tạo/đổi lịch đơn, để báo cáo đọc được bằng SQL.

**Nghiệm thu:**
- `git grep -n -i "hội viên\|hoi vien\|MembershipService" -- backend/src frontend/src scripts` không còn kết quả (trừ migration cũ và đoạn đọc key `membershipBenefit` để tương thích ngược).
- Đơn mới của khách Masters có `tier_discount` = 5% tiền sân.

Commit: `refactor(loyalty): don ten mau, bo MembershipService, chong tru diem hai lan`

---

## Đã nghiệm thu đạt — không sửa

- Web không còn trắng trang; `npm run lint` chạy được.
- Mọi số điện thoại là `+84…`. Đăng ký trùng bị chặn với `0911000002`, `+84911000002`, `0911.000.002`, `0769 496 289`.
- Dữ liệu 4 tài khoản demo khớp brief: đã xác thực số, đồng ý nhận khuyến mãi, năm sinh thật, tổng ledger = số dư.
- Voucher cũ có `status` / `source`; VIP10 là `min_tier = CHALLENGER`.
- **Dùng điểm:** 260.000₫ → −5% → trần 50% (1.230 điểm, −123.000₫) → 124.000₫. Điểm được giữ ngay khi tạo đơn. Đơn giữ chỗ hết hạn → `REVERSAL +1230`.
- Ô "Dùng điểm thưởng" trên trang đặt sân tính đúng.
- **Lên hạng:** check-out → Grand Slam ngay, +1.000 điểm, thẻ VIP, thông báo `TIER_UP`.
- Đổi quà (`EXT30`, `GOLDEN1H`, `REF1H`): trừ điểm đúng, bấm 2 lần cùng lúc chỉ trừ 1 lần.
- Staff xem / nhận xử lý / tặng voucher bù được. Mỗi phản hồi chỉ 1 voucher, kể cả khi bấm 2 lần cùng lúc.
- Staff tạo voucher vượt hạn mức → `PENDING_APPROVAL`. Khách gọi API quản trị → 403.

---

## Thứ tự làm và kiểm tra cuối

1. P0-1 → P0-2. Sau bước này, build sạch và reset phải chạy được.
2. P1-3 → P1-4 (seed).
3. P1-1 → P1-2 (phát voucher).
4. P2-1 → P2-2.

Mỗi mục một commit, tên như ghi ở từng mục. Không push nếu chưa được yêu cầu.

**Kiểm tra cuối (ghi kết quả vào mô tả commit cuối):**
1. Xoá volume DB (`docker compose down -v`), rồi `docker compose up -d --build`. Flyway chạy V1→V21 không lỗi.
2. `.\reset-demo.ps1` chạy 3 lần liên tiếp, lần nào cũng thành công qua API. Sau mỗi lần, số phản hồi, voucher và đơn mẫu không đổi.
3. Chạy toàn bộ test backend.
4. Đi lại toàn bộ phần "Nghiệm thu" ở trên bằng trình duyệt với `kietdlv@gmail.com`, `demo.hoivien@gmail.com`, `demo.khach@gmail.com`, `phuongmaiphanqn3@gmail.com`, `admin@gmail.com`, `staff@gmail.com` (mật khẩu `123456`). Đăng ký thêm một số mới để kiểm tra voucher chào mừng.
