# Kịch bản demo 4 flow — theo slide "Green Modern Tennis Club Presentation"

Tên chặng trên slide ghi trong ngoặc vuông, ví dụ **[Prepare resources]**. Tên nút ghi đúng như trên màn hình; câu trong ngoặc kép là thông báo thật của hệ thống (đã chạy thử trên dữ liệu sau reset).

**Chuẩn bị:**
- Chạy `docker compose up -d` rồi `.\reset-demo.ps1`. Mật khẩu mọi tài khoản: `123456`.
- Kịch bản **không gắn với giờ demo cố định**: các mốc giờ chọn theo lúc bắt đầu demo (bước 1.5, 2.2, 2.10). Tổng thời lượng khoảng 23 phút.
- **Ba cửa sổ cố định**, đăng nhập sẵn một lần:
  - Chrome thường: Manager `admin@gmail.com`
  - Edge: Staff `staff@gmail.com`
  - Chrome ẩn danh: khách, chưa đăng nhập. Lần lượt dùng `demo.hoivien@gmail.com` (anh Nguyễn Minh Khoa, hạng Masters, 2.537 điểm) và `demo.khach@gmail.com` (chị Phạm Thu Trang, hạng Challenger, có voucher `BDAY-CHALLENGER-60K`).
  - Firefox (tùy chọn): chỉ dùng cho bước tranh slot.

---

## FLOW 1 — Court & Service Setup (~4 phút)

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Manager | **[Prepare resources] 1.1** *Chrome thường.* **KINH DOANH → Sân & bảng giá** → tab **Danh sách sân (10)**. | Chỉ Manager được sửa sân, giá, nhân sự. |
| Manager | **1.2** **Sân A03** → **Chỉnh sửa** → **Trạng thái: Bảo trì** → **Lưu thông tin**. Toast "Đã lưu thông tin", A03 có nhãn **Bảo trì**. | Chỉ khóa được sân **không còn đơn sắp tới** (đối chiếu ở 2.12). |
| Manager | **1.3** **Thêm sân** → **Tên sân** nhập `Sân A01` → **Lưu thông tin**. Hệ thống báo 'Tên sân "Sân A01" đã tồn tại. Vui lòng chọn tên khác.' → **Đóng**. | Tên sân là duy nhất. Để trống tên thì hệ thống tự đặt tên kế tiếp của khu, và sân mới tự nhận bảng giá khu. |
| Manager | **1.4** **QUẢN TRỊ → Nhân sự**: 10 trọng tài kèm đơn giá/giờ và 70 ca trực (06:00–14:00, 14:00–23:00, cả tuần). | Khách chỉ thuê được trọng tài **có ca trực trống** đúng giờ. Ca đã phân công không xóa được ("Không thể xóa slot đã được phân công hoặc đang có đơn đặt"). |
| Manager | **[Price & schedule] 1.5** Tab **Bảng giá theo khu** → **Khu A - Ngoài trời** → chọn khung giá **còn ở phía trước trong hôm nay**, đúng loại ngày demo (Thứ 2–6 hoặc Thứ 7–CN), tăng thêm 40.000₫/giờ (ví dụ khung 17:00–22:00 ngày thường: `260000` → `300000`), **Áp dụng từ** hôm nay → **Xem trước** → **Lưu bảng giá**. Toast "Đã cập nhật bảng giá khu OUTDOOR; đã cập nhật N slot còn trống…" | Giá tính theo **khu × khung giờ × ngày thường/cuối tuần**. Chỉ slot trống hoặc bảo trì nhận giá mới; slot đã có đơn **giữ giá đã chốt**. |
| System | **1.6** Tự sinh slot **30 phút** (06:00–23:00) cho mọi sân đang khai thác, giá mỗi slot lấy từ bảng giá khu. | Sân mới hoặc ngày mới có slot ngay khi được xem; sân ngừng khai thác không sinh slot. |
| Manager | **1.7** **VẬN HÀNH → Lịch sân** → lọc **Ngoài trời** → một ô trống cuối ngày, ví dụ **Sân A01 22:00** → **Bảo trì khung giờ**. | Bảo trì từng slot chỉ áp cho **khung giờ trống** ("Chỉ có thể đưa khung giờ trống vào bảo trì…"). |
| Staff | **[Configure benefits] 1.8** *Edge.* **Thành viên & điểm**: 4 hạng **Rookie → Challenger → Masters → Grand Slam**, kèm mức giảm và hệ số tích điểm. | Chính sách hạng do Manager chỉnh; Staff chỉ xem. |
| Staff | **1.9** **Khuyến mãi & voucher** → **Tạo voucher mới** `DEMO15`: giảm 15% (tối đa 50.000₫), đơn từ 200.000₫, 30 lượt, mỗi khách 1 lần, hạn 14 ngày. Voucher **kích hoạt ngay**. | Voucher có điều kiện: đơn tối thiểu, giảm tối đa, giới hạn lượt dùng (tổng và theo khách), thời hạn. |
| Staff | **1.10** Tạo `DEMO30` giảm 30% → voucher vào **Chờ duyệt**; Staff không có nút **Duyệt**. | Staff chỉ tự kích hoạt voucher trong hạn mức: giảm ≤ 20% (có mức tối đa) hoặc ≤ 100.000₫, ≤ 50 lượt, ≤ 30 ngày. |
| Manager | **1.11** *Chrome thường.* **Khuyến mãi & voucher** → lọc **Chờ duyệt** → `DEMO30` → **Duyệt**. | Voucher vượt hạn mức phải được **Manager duyệt** ("Chỉ Manager mới có quyền phê duyệt voucher"). |
| Customer (vãng lai) | **[View availability] 1.12** *Chrome ẩn danh.* `localhost:3000/dat-san`: A03 hiện **Bảo trì**, ô vừa bảo trì ở 1.7 hiện **Bảo trì**, Sân A02 ở khung vừa đổi giá hiện **giá mới** (ví dụ 2 giờ = 600.000₫). | Thay đổi của Manager có hiệu lực ngay. Giờ đã qua hiện **Không khả dụng**. |
| Customer → AI | **1.13** **Trợ lý AI Courtly** → hỏi "Hôm nay còn sân ngoài trời nào trống?" | AI trả lời từ giá và số sân thật, không thay bước đặt và thanh toán. |
| System | **[Ready to book] 1.14** Sân hoạt động, slot trống, giá hợp lệ: sẵn sàng nhận đặt. | Chỉ slot **AVAILABLE** của sân đang khai thác mới đặt được. |

---

## FLOW 2 — Booking & Payment (~8 phút)

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Customer (Khoa) | **[Choose a service] 2.1** *Chrome ẩn danh.* **Đăng nhập** `demo.hoivien@gmail.com`. Hệ thống chào Nguyễn Minh Khoa, hạng Masters. | Tài khoản nợ quá hạn bị chặn đặt sân. |
| Customer (Khoa) | **2.2** **Đặt sân** → hôm nay → **Sân A02** → chọn slot gần nhất cách lúc đặt **20–30 phút** (ví dụ đặt lúc 16:36 thì chọn 17:00), kéo thêm 1 giờ. Nếu hôm nay không còn slot như vậy, đặt slot sớm nhất ngày mai. Tùy chọn: tick **Thuê trọng tài**. | Giờ trên cùng sân phải liên tiếp. Chỉ hiện trọng tài có ca trống; mỗi slot một trọng tài. Chọn giờ cách 20–30 phút để bước 3.2 rơi đúng khung check-in. |
| Customer (Khoa) → System | **2.3** Chọn thêm giờ trên 3 sân khác. Khi thêm sân thứ 4, hệ thống báo "Tối đa 3 sân trong cùng một đơn đặt." → bỏ chọn, chỉ giữ **Sân A02**. | Tối đa **3 sân / đơn**. Làm trước khi giữ chỗ để không tốn thời gian giữ chỗ. |
| System | **[Calculate the quote] 2.4** Chọn voucher **VIP10**, dùng **500 điểm**. Ví dụ slot giá 300.000₫/giờ: tiền sân 300.000₫ → ưu đãi hạng Masters −15.000₫ → VIP10 −28.500₫ → điểm −50.000₫ → **Tổng 206.500₫**, cọc 50%. | Thứ tự giảm: **hạng → voucher → điểm**. 1 điểm = 100₫. VIP10 chỉ dành cho hội viên. Cọc = 50%. |
| System | **[Hold the court] 2.5** **Tiếp tục thanh toán** → **Đơn của tôi**: đơn **Đang giữ chỗ**, đồng hồ **5:00** → chọn **Chuyển khoản VietQR** ngay. | Slot bị **khóa 5 phút** cho khách này; quá hạn chưa trả thì đơn hết hạn và nhả slot. |
| Customer (Trang) | **2.6** *(Tùy chọn, Firefox.)* Chị Trang đã mở sẵn đúng slot A02 anh Khoa chọn và bấm **Tiếp tục thanh toán** ngay sau anh Khoa. Hệ thống báo "Sân A02 hh:mm–hh:mm vừa được khách khác giữ chỗ. Vui lòng chọn giờ khác." và gợi ý sân khác cùng khu. | Hai khách cùng slot: chỉ người giữ trước được (HTTP 409 `SLOT_TAKEN`). |
| Ngân hàng | **[Pay & verify] 2.7** *Chrome ẩn danh (Khoa).* Trong hộp QR → **⚡ Giả lập MB Bank chuyển đủ (…)** → "**KHOẢN CHUYỂN ĐÃ XÁC MINH**". | Webhook phải đúng chữ ký HMAC, tài khoản nhận, mã giao dịch và số tiền; giao dịch đã thu đủ không nhận lần hai. |
| Customer (Khoa) | **[Confirmed] 2.8** **Xem đơn hàng của tôi** → **Đã xác nhận** → **🎫 Xem Vé Điện Tử & Mã QR Check-in** → **ghi lại mã `CT-xxxxxxxx`** (dùng ở 3.2). | Vé chỉ "✓ SẴN SÀNG CHECK-IN" khi đã đóng cọc. |
| Customer (Trang) | **[Choose a service] 2.9** *Chrome ẩn danh:* **Đăng xuất** → **Đăng nhập** → **Chưa có tài khoản? Đăng ký** → giới thiệu form và màn nhập OTP 6 số → quay lại **Đăng nhập** `demo.khach@gmail.com`. | Số điện thoại đã có tài khoản không đăng ký lại được. Nhập sai OTP 5 lần phải xin mã mới. |
| Customer (Trang) | **2.10** **Đặt sân** → **2 ngày sau ngày demo**, **Sân B01**, 19:00–20:00 → nhập mã **WELCOME**, hệ thống báo "Mã chào mừng chung 'WELCOME' đã đóng…" → chọn **BDAY-CHALLENGER-60K** → **Tiếp tục thanh toán** → **Tiền mặt tại quầy**. | Mã chung đã đóng; khách dùng mã cá nhân trong ví. Đơn giữ chỗ 5 phút chờ thu cọc. Đặt cách hơn 24 giờ để dù demo lúc nào, 3.6–3.7 vẫn được tự đổi lịch và hoàn 100%. |
| Staff | **[Pay & verify] 2.11** *Edge.* **Đơn đặt sân** → đơn của Phạm Thu Trang → thu cọc tiền mặt 50% (ví dụ 134.900₫) → đơn **Đã xác nhận**. | Phải thu trước khi hết giờ giữ chỗ; không thu vượt số còn thiếu ("Thu vượt số tiền còn thiếu"). |
| Manager | **[Confirmed] 2.12** *Chrome thường.* **Lịch sân**: ô A02 giờ anh Khoa đặt mang tên anh Khoa. **Sân & bảng giá** → **Sân A02** → **Bảo trì** → **Lưu thông tin**. Hệ thống báo "Không thể chuyển sân sang trạng thái tạm ngưng: sân còn 1 đơn sắp tới (CT-xxxxxxxx · Nguyễn Minh Khoa · dd/mm)…" | Không bảo trì hoặc ngừng khai thác sân đã bán; phải đổi lịch hoặc hủy đơn trước. |

---

## FLOW 3 — Order Process & Feedback (~7 phút)

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Staff | **[Prepare service] 3.1** *Edge.* **Việc cần xử lý**: khách sắp đến (anh Khoa), đơn chưa thu đủ, trọng tài theo đơn. | Menu Staff không có Sân & bảng giá, Nhân sự, Tài khoản & phân quyền. |
| Customer (Khoa) → Staff | **[Check in] 3.2** Anh Khoa đọc mã đã ghi ở 2.8. **Quét QR Check-in** → **Nhập mã / Máy quét** → `CT-xxxxxxxx` → **Check-in** → "**CHECK-IN TỰ ĐỘNG THÀNH CÔNG!**". Nếu ngoài khung giờ, hệ thống báo "Chưa tới giờ check-in (từ hh:mm ngày dd/mm). Nhập lý do ngoại lệ để tiếp tục." | Check-in từ **30 phút trước đến 15 phút sau** giờ bắt đầu; ngoài khung phải nhập lý do (≥ 5 ký tự) và bị ghi nhật ký. Nếu ở 2.2 phải đặt sang ngày mai thì đi đường ngoại lệ này. |
| Staff | **[Play & check out] 3.3** Khách đang chơi → chi tiết đơn → **Gia hạn giờ chơi** → **+30 phút**. | Chỉ gia hạn khi slot liền sau còn trống; giá gia hạn vẫn áp ưu đãi hạng. |
| Staff | **3.4** *"Giả định anh Khoa đã chơi xong."* **Thu nốt tiền** → **Xác nhận đã nhận tiền mặt** → **Check-out** → "TRẠNG THÁI CÔNG NỢ: ĐÃ THANH TOÁN ĐỦ 100%" → **Xác nhận Check-out & Giải phóng sân**. Đơn chuyển **Hoàn tất**. | Không thu vượt số còn thiếu; phải thấy rõ công nợ trước khi giải phóng sân. |
| System | **3.5** Cộng chi tiêu và điểm: anh Khoa **lên hạng Grand Slam**. | Hạng và điểm chỉ cập nhật khi đơn hoàn tất. |
| Customer (Trang) | **[Handle requests] 3.6** *Chrome ẩn danh (Trang).* **Đơn của tôi** → đơn B01 đặt ở 2.10 → **Đổi lịch sân** → **Sân B02** 20:00–21:00 → xác nhận. | Khách tự đổi lịch **trước 24 giờ**; muộn hơn thì "Đã qua hạn đổi/hủy; liên hệ quầy". Số lần đổi miễn phí theo hạng. |
| Customer (Trang) → System | **3.7** **Hủy đơn** → "Hủy trước giờ chơi trên 24 tiếng: Hoàn lại 100% tiền cọc." → **Xác nhận hủy**. Đơn **Đã hủy**, **chờ hoàn** toàn bộ tiền cọc. | Mức hoàn: **> 24 giờ 100%**, **12–24 giờ 50%**, **< 12 giờ 0%**. |
| Staff | **3.8** *Edge.* **Thu tiền & hoàn tiền** → **Đơn cần hoàn tiền** → **#92929292** → **Hoàn tiền ngay** → nhập 240.000₫. Hệ thống chặn: "Staff chỉ hoàn tối đa 120.000₫ theo chính sách. Khoản vượt mức cần Manager duyệt." → **Hủy**. | Staff chỉ hoàn trong chính sách; vượt mức cần Manager duyệt. |
| Customer (Khoa) | **[Feedback] 3.9** *Chrome ẩn danh:* **Đăng xuất** → **Đăng nhập** `demo.hoivien@gmail.com` → `/feedback` → **3 sao**, nội dung "Đèn sân A02 hơi tối ở cuối sân, mong CLB kiểm tra." → chọn đơn vừa chơi → **Gửi đánh giá**. | Nội dung ≥ 10 ký tự; chỉ đánh giá được đơn đã hoàn tất của chính mình. Đánh giá **≤ 3 sao** vào hàng **Đánh giá thấp cần xử lý**, hạn xử lý 24 giờ. |
| Staff | **3.10** *Edge.* **Feedback & Đánh giá** → **⚠️ Đánh giá thấp cần xử lý** → mở đánh giá → **🎁 Tặng voucher** (Xin lỗi nhẹ 50.000₫) → phản hồi → **Hoàn tất & Đóng ca xử lý**. Toast "Đã tặng voucher SORRY-xxxx…" | Đánh giá thấp bắt buộc phải xử lý (bù voucher hoặc đóng không bù). Chỉ Manager/Staff được tặng voucher bồi thường. |
| Customer (Khoa) | **3.11** *Chrome ẩn danh.* Chuông **Thông báo** và **ví Ưu đãi** có `SORRY-xxxx`. | Khách nhận thông báo về đơn và voucher bù. |

---

## FLOW 4 — Dashboard & Reporting (~4 phút)

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Staff | **[Collect data] 4.1** *Edge.* `localhost:3000/quay-thu` → **Chốt ca thu ngân** → nhập tiền đầu ca và tiền thực đếm → chốt. Phiếu hiện tiền mặt đã thu trong ca và chênh lệch. | Chỉ thu ngân và Manager vào được quầy thu; tiền mặt tính theo người thu. |
| System | **4.2** Gom đơn, thanh toán tiền mặt và chuyển khoản, giao dịch hoàn tiền vào sổ. | Mỗi giao dịch ghi đúng nguồn và người thu. |
| Manager | **[Reconcile] 4.3** *Chrome thường.* **Thu tiền & hoàn tiền** → **Đối soát & Ngoại lệ**: tiền thu thừa / không khớp, đơn đã hủy còn giữ cọc (đơn chị Trang, #91919191, #92929292). | Khoản thừa và khoản chờ hoàn phải được xử lý, không để treo. |
| Manager | **4.4** **Đơn cần hoàn tiền** → đơn chị Trang → **Hoàn tiền ngay** (đề xuất 100% tiền cọc) → **Xác nhận đã chuyển khoản / hoàn tiền**. Làm tiếp **#92929292** (120.000₫). | Manager duyệt chi hoàn tiền; tổng hoàn không vượt số đã thu; mỗi lần hoàn có ghi nhật ký. |
| Manager | **[Select period] 4.5** Bộ chọn kỳ **Tháng này** → thử **Theo Ngày** / **Khoảng ngày**. Các ô **Tổng đã thu**, **Tổng đã hoàn**, **Thu phí hội viên**, **Thu ròng** gắn nhãn kỳ. | Mọi số tiền đều ghi rõ kỳ tính. |
| System | **[Calculate] 4.6** **TRA CỨU → Báo cáo**: **Tổng thực thu ròng** khớp **Thu ròng** ở 4.5; khung giờ cao điểm; công suất 10 sân; danh sách đơn trong kỳ; báo cáo thành viên. | Báo cáo và trang thu tiền dùng chung cách tính kỳ; số sân lấy từ dữ liệu thật. |
| Manager | **[Business insights] 4.7** Tìm đơn anh Khoa (**Hoàn tất**) và đơn chị Trang (**Đã hủy**, đã hoàn) → **Xuất báo cáo CSV** hoặc **In / Xuất PDF Báo Cáo**. | Tiền từ Flow 2 và Flow 3 truy vết được đến báo cáo. |
| Manager | **4.8** *(Tùy chọn.)* **Tài khoản & phân quyền** → `admin@gmail.com` → đổi quyền thành Staff → lưu. Hệ thống báo "Không được tự khóa/hạ quyền hoặc thay quyền chủ hệ thống". | Manager không tự khóa hoặc hạ quyền chính mình. |

---

**Sau khi demo:** chạy `.\reset-demo.ps1` (hoặc **Hệ thống & module** → **Đặt lại dữ liệu mẫu Hội đồng**).

## Phụ lục — Bảng theo dõi lỗi đã sửa

| Mức | Lỗi | Vị trí | Trạng thái | Commit |
|---|---|---|---|---|
| Cao (P1-a) | Check-in nhận cả đơn ngoài giờ, không chặn ngoài cửa sổ 30 phút | Quét QR Check-in / backend check-in | **ĐÃ SỬA** | `0306065` |
| Cao (P1-b) | Tài khoản demo bị nợ quá hạn chặn đặt sân | Seed demo accounts | **ĐÃ SỬA** | `42d67cf` |
| Trung bình (P2-a) | Nút "Đăng nhập để xem trọng tài" và "Đăng nhập ngay" mở nhầm form "Lưu mật khẩu" | `Portal.jsx`, `Booking.jsx`, `Content.jsx`, `Tournaments.jsx` | **ĐÃ SỬA** | `5abde04` |
| Trung bình (P2-b) | Thiếu ca trực trọng tài và khó tạo ca trên giao diện staff | Seed `staff_schedules` & `StaffPage.jsx` | **ĐÃ SỬA** | `b1cf692` |
| Trung bình (P2-c) | Tranh chấp đặt slot trả HTTP 400 chung chung, không gợi ý sân khác | `ScheduleService.java` & `Booking.jsx` | **ĐÃ SỬA** | `884cd13` |
| Trung bình (P2-d) | Ưu đãi hội viên và voucher cộng dồn sai thứ tự (cùng tính trên gross) | `OrderService.java`, `BookingSupportService.java`, `Booking.jsx` | **ĐÃ SỬA** | `f51a36c` |
| Trung bình (P2-e) | "Thu ròng" không ghi kỳ tính, lệch số với trang Báo cáo | `PaymentsPage.jsx`, `ReportsPage.jsx`, `period.mjs` | **ĐÃ SỬA** | `62e0dda` |
| Trung bình (P2-f) | Đổi khu / đổi giá gốc của sân không cập nhật giá slot; số sân ghi cứng ở trang khách, AI, báo cáo | `CatalogService.java`, `Overview.jsx`, `AiChatbox.jsx`, `ReportsPage.jsx` | **ĐÃ SỬA** | `47f6334` |
| Thấp (P3-1) | Giờ hiển thị dạng "18.5:00" | Frontend time formatting | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-2) | Danh sách nhân sự có bản ghi test "Non-billable test staff" | `baseline.json` | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-3) | Tick "Thuê trọng tài" khi chưa đăng nhập làm khóa nút đặt | `Booking.jsx` (`ready`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-4) | Đăng xuất/đăng nhập làm mất lựa chọn sân và giờ trên `/dat-san` | `Booking.jsx` (`sessionStorage`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-5) | "Bảng giá theo khu" vẫn đếm sân bảo trì vào số sân hoạt động | `CourtsPage.jsx` | **ĐÃ SỬA** | `618fd63` |
