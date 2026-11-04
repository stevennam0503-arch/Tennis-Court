# TASK_DEMO_FIXES_4: các lỗi còn lại sau đợt 3

Brief cho AI agent. Đọc hết trước khi sửa. Làm theo thứ tự.

## 0. Quy tắc làm việc (bắt buộc, đợt 3 vi phạm)

- **Không sửa song song với người khác trong cùng thư mục.** Đợt 3 có người đang test trong thư mục này trong lúc agent commit và build lại backend: backend tự khởi động lại giữa chừng và các bản sửa ghi đè lẫn nhau. Hãy làm trên worktree hoặc nhánh riêng, xong mới merge vào `nam-dev`.
- **Mỗi commit đụng tới seed hoặc reset đều phải chạy `.\reset-demo.ps1` trước khi commit và thấy `THANH CONG`.** Đợt 3 có 2 commit (`912408c`, `5fd6978`) làm hỏng reset vì chưa chạy lại lần nào.
- **Chỉ ghi PASS khi đã thật sự chạy và thấy kết quả.** `smoke_demo.py` của đợt 3 chưa chạy được lần nào mà vẫn được nộp.
- Vòng lặp nhanh, theo Phần A của brief 3:
  - `mvn -q test` và `npm run lint && npm run build` chạy trên máy, không cần Docker.
  - Mỗi lần chỉ build service vừa sửa.

## 1. Đã sửa sẵn trong thư mục làm việc (chưa commit). Commit trước tiên

Các thay đổi dưới đây đã được kiểm tra: reset chạy được, 129 test backend đạt, lint đạt, đã thử trên giao diện. Giữ nguyên, chỉ cần commit.

| File | Sửa gì | Vì sao |
|---|---|---|
| `frontend/src/guest/Portal.jsx` | Chuyển `const user=…` lên trước `useEffect` gọi `/vouchers/my` | Commit `56b8cee` dùng `user` trước khi khai báo, nên **toàn bộ trang khách bị trắng** (`Cannot access 'V' before initialization`) |
| `backend/.../entity/Campaign.java` | `@ColumnTransformer(read = "audience_filter #>> '{}'", write = "to_jsonb(?::text)")` | Cột `audience_filter` có kiểu jsonb, entity ghi vào dạng chuỗi, nên mọi lần tạo chiến dịch đều lỗi 500 |
| `backend/.../service/CampaignService.java` | `startsAt` / `endsAt` để trống thì bỏ qua; nhận được cả giờ địa phương (`datetime-local`) | Form gửi `startsAt: ''`, backend gọi `Instant.parse('')` và báo lỗi 500 khi bấm "Lưu bản nháp" |
| `backend/.../service/DemoResetService.java` | Thêm `insertPastPayment()`: mỗi đơn quá khứ (Kiệt, demo.hoivien, demo.khach) có một phiếu thu BALANCE | `reconcileSeededOrders()` tính số đã thu từ bảng `payments`. Đơn quá khứ không có phiếu thu nên bị ghi về 0₫ UNPAID: demo.hoivien hiện băng đỏ "Đơn quá hạn chưa thanh toán", công nợ 2,9 triệu, và hệ thống tạo thông báo công nợ |
| `backend/.../service/DemoResetService.java` | Thêm `DELETE FROM campaigns` khi reset | Chiến dịch tạo lúc tập demo vẫn còn sau khi reset |

`scripts/smoke_demo.py` cũng đang có thay đổi chưa commit. Đó là thay đổi của agent, hãy xử lý theo mục 2.

## 2. P0: viết lại `scripts/smoke_demo.py` cho chạy thật

Hiện tại script đạt 2/10 bước. Script được viết theo phỏng đoán:

- Gọi `/api/demo/reset`, endpoint này không tồn tại. Endpoint đúng là `POST /api/catalog/demo-reset` (xem `scripts/seed_showcase.py`). Cách tốt hơn là gọi thẳng `.\reset-demo.ps1` hoặc dùng cờ `--no-reset`.
- Đăng nhập gửi `username` thay vì `email` và đoán nhiều mật khẩu. Đúng là `POST /api/auth/login {"email","password":"123456"}`, kiểm tra `res["user"]["role"]`.
- Gọi `/api/referees`, endpoint này không tồn tại. Trọng tài lấy từ lịch `staff_schedules`; tìm endpoint thật trong `controller/` hoặc bỏ phần trọng tài khỏi smoke.
- Thu cọc gửi `amount` rỗng. Phải gửi đúng `depositRequired` của đơn, kèm `transactionCode` khi chuyển khoản.
- Thẻ VIP: lấy mã thật bằng `SELECT code FROM vip_cards`, hoặc từ phản hồi lúc lên hạng. Mã seed của Kiệt là `VIP-KS9876`. Endpoint: `POST /api/loyalty/vip-lounge/scan {"code"}`.
- Voucher: `startsAt` / `expiresAt` phải là ISO có `Z`. Script đang gửi `datetime.now().isoformat()`, thiếu múi giờ.
- Lấy lịch sân trống bằng SQL qua `docker exec … psql` hoặc bằng API catalog thật. Không đoán ID.

Mẫu đã chạy được (dùng để tham khảo cách gọi), đã kiểm tra tay đợt này:

```
login admin, staff, demo.khach, demo.hoivien   -> 200
POST /api/admin/vouchers {code:GIOVANG20,type:PERCENT,value:20,validFromTime:"10:00",validToTime:"15:00",validWeekdays:"1,2,3,4,5"} -> ACTIVE
POST /api/public/vouchers/validate {code,amount,slots:[{date,startTime,endTime,zone}]}  @18:00 -> 400 "Chỉ áp dụng khung 10:00–15:00"; @11:00 -> 200 giảm 60.000
POST /api/orders {scheduleIds:[slot 18:00],voucherCode:GIOVANG20} -> 400 (server chặn đúng)
POST /api/orders demo.hoivien 2 slot A01 18:00–19:00 + pointsToUse 500 -> total 197.000 (260.000 − 13.000 hạng − 50.000 điểm), cọc 98.500
POST /api/admin/campaigns {name,channels:"BANNER",audience:"ALL",bannerText} -> DRAFT; submit -> approve -> RUNNING
POST /api/loyalty/vip-lounge/scan {code:"VIP-KS9876"} -> valid:true, GRAND_SLAM
```

**Nghiệm thu:** reset xong chạy `python scripts/smoke_demo.py --no-reset` ra 10/10 PASS, sau đó chạy lại lần 2 vẫn 10/10. Script phải tự dọn dữ liệu nó tạo ra hoặc dùng mã ngẫu nhiên, để chạy lại không bị báo trùng.

## 3. P1: chiến dịch

1. **Chiến dịch "Theo hạng thành viên" không có ô chọn hạng.** Khi đó `audienceFilter` để trống, và `CampaignService` (case `TIER`) không khớp khách nào. Cần thêm ô chọn nhiều hạng (ROOKIE / CHALLENGER / MASTERS / GRAND_SLAM) khi `audience = TIER`, lưu thành chuỗi như `"GRAND_SLAM,MASTERS"`. Với "Danh sách tự chọn" thì thêm ô textarea nhập SĐT/email. Hiện tại chọn `CUSTOM_LIST` cũng không có ô nhập.
2. **`toDto` không trả `audienceFilter`.** Cần thêm vào để form sửa và trang chi tiết hiển thị được.
3. **Ô "Voucher đính kèm" đang liệt kê cả voucher cá nhân và voucher đã hết lượt** (TIER-GS-300K, BDAY-…, WELCOME-…, "Còn 0 lượt"). Chỉ được liệt kê voucher công khai (`assigned_account_id IS NULL`), đang ACTIVE, còn lượt và chưa hết hạn.
4. Sau khi bấm "Lưu bản nháp" thành công, hộp thoại không tự đóng. Cần đóng hộp thoại và hiện thông báo đã lưu.

## 4. P1: dữ liệu seed còn sót gói hội viên trả phí

- Các đơn mẫu của Trần Hoàng Nam (`11111111`, `14141414`, `44444444`) có `metadata.membershipBenefit` với `discountPercent: 15` và tên gói "Plus". Bảng kê check-out hiện "Giảm theo hạng (Plus): −84.000 ₫". Hệ thống hạng mới giảm tối đa 8%. Cần đổi sang hạng thật của khách (Grand Slam −8%, Masters −5%, Challenger −3%, Rookie 0%), dùng tên hiển thị của hạng, và tính lại bằng `reconcileSeededOrders()`. Sửa trong `baseline.json` và/hoặc `DemoResetService`.
- Dọn các key dịch không còn dùng trong `frontend/src/guest/translations.json`: "COURTLY MEMBERSHIP / ĐỀ XUẤT QUYỀN LỢI", "Gói Club", "Gói Plus", "Chọn Plus", "Phí thành viên"… Trước khi xoá, chạy `git grep` để chắc không còn component nào dùng.

## 5. P2: lỗi nhỏ trên giao diện

1. `/tai-khoan/hang-diem`: chi tiêu 19.900.000 / 20.000.000 nhưng ghi "**Đã đạt 100%**". Phải làm tròn xuống (99%) hoặc hiện một số lẻ (99,5%). Chỉ hiện 100% khi đã thật sự đủ điều kiện lên hạng.
2. Điểm hiển thị không thống nhất: "1500 pts" ở thẻ điểm, "1,200 pts" và "2,000 pts" ở danh mục đổi quà. Dùng chung `formatNumber` kiểu Việt Nam (1.500, 1.200).
3. `/tai-khoan/uu-dai`: ô nhập mã có placeholder "VD: WELCOME, SORRY-...", trong khi mã WELCOME chung đã ngưng. Đổi thành ví dụ đang dùng được, như "VD: HE2026".
4. `POST /api/admin/vouchers` gửi giờ không có `Z` thì báo lỗi 500. Làm giống `CampaignService.parseInstant`: nhận cả giờ địa phương, còn chuỗi sai định dạng thì trả 400 với thông báo tiếng Việt.

## 6. Kiểm tra cuối (một lần, sau khi làm xong mục 1–5)

1. `docker compose down -v`, rồi `docker compose up -d --build`.
2. `.\reset-demo.ps1` hai lần, cả hai lần đều `THANH CONG`.
3. `mvn -q test` (từ 129 test trở lên, đều đạt) và `npm run lint && npm run build`.
4. `python scripts/smoke_demo.py --no-reset` hai lần, đều 10/10.
5. Mở giao diện kiểm tra:
   - trang chủ và `/tai-khoan/hang-diem` khi đăng nhập demo.hoivien: không trắng trang, không có băng đỏ công nợ;
   - tạo chiến dịch theo hạng trên giao diện và thấy đúng số khách nhận.
6. `.\reset-demo.ps1` thêm một lần để để lại dữ liệu sạch.
7. Commit theo từng mục, ghi rõ trong message đã chạy reset và smoke.
