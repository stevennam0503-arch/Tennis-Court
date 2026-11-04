# Kịch bản demo 4 luồng — bấm từng nút

Kịch bản này được cập nhật và kiểm chứng trên nhánh `nam-dev` (04/11/2026). Tên nút ghi **đúng như trên màn hình**. Cột "Nói" là câu gợi ý để thuyết trình song song.

Cả 4 luồng dùng **một câu chuyện liền mạch**: Admin đổi giá và khóa một sân → khách đặt đúng sân đó với giá mới (hoặc thuê trọng tài, dùng ưu đãi hội viên và voucher) → lễ tân check-in/check-out đúng đơn đó → Admin thấy đúng giao dịch đó trong đối soát và báo cáo (đồng bộ kỳ tính).

---

## 0. Chuẩn bị (trước giờ demo 30 phút)

| # | Việc | Ghi chú |
|---|---|---|
| 0.1 | Mở Docker Desktop, chạy `docker compose up -d` | Web: `http://localhost:3000`, Admin/Staff: `http://localhost:3000/app` |
| 0.2 | Chạy `.\reset-demo.ps1` khi cần làm mới dữ liệu | Dữ liệu mẫu và 2 tài khoản demo sạch được đưa về chuẩn |
| 0.3 | Mở **Chrome thường**: dùng cho Admin/Staff | |
| 0.4 | Mở **Chrome ẩn danh** (Ctrl+Shift+N): dùng cho khách hàng | Hai cửa sổ không dùng chung đăng nhập |
| 0.5 | Tài khoản demo sạch đã có sẵn trong seed | `demo.hoivien@gmail.com` và `demo.khach@gmail.com` |

**Tài khoản** (mật khẩu đều là `123456` sau reset):

| Vai trò | Email | Dùng ở |
|---|---|---|
| Admin | `admin@gmail.com` | Luồng 1, cuối Luồng 3, Luồng 4 |
| Staff (lễ tân) | `staff@gmail.com` | Luồng 3 |
| Khách hội viên Plus (sạch, 0 đơn) | `demo.hoivien@gmail.com` (Nguyễn Minh Khoa) | Luồng 2, trường hợp A (đặt sân hưởng ưu đãi hội viên + voucher VIP10) |
| Khách mới (sạch, 0 đơn) | `demo.khach@gmail.com` (Phạm Thu Trang) | Luồng 2, trường hợp B (đặt sân hưởng voucher WELCOME) |
| Khách thật chủ dự án (Grand Slam, sạch) | `kietdlv@gmail.com` (0769496289 - Khách demo Kiệt) | Demo nhận thông báo Email/SMS thật, phòng chờ VIP |
| Khách thật chủ dự án (Rookie, sạch) | `phuongmaiphanqn3@gmail.com` (0377035664 - Khách demo Phương Mai) | Demo nhận thông báo Email/SMS thật, đặt sân mới |
| Tài khoản minh họa đơn mẫu | `hoangnam@gmail.com`, `khachmoi@gmail.com` | Minh họa trạng thái đơn cho admin, không dùng để đặt |

---

## Luồng 1 — Quản lý và mở bán dịch vụ (Admin, ~4 phút)

Cửa sổ: Chrome thường.

| # | Màn hình | Bấm / nhập | Kết quả thấy được | Nói |
|---|---|---|---|---|
| 1.1 | `localhost:3000` | **Đăng nhập** → nhập `admin@gmail.com` / `123456` → **Đăng nhập** | Vào trang **Việc cần xử lý** | "Admin quản lý toàn bộ tài nguyên bán được." |
| 1.2 | Menu trái | **KINH DOANH → Sân & bảng giá** | Tab **Danh sách sân (10)**, lọc theo khu | "CLB có 10 sân, chia 3 khu: ngoài trời, trong nhà, VIP." |
| 1.3 | Thẻ **Sân A03** | **Chỉnh sửa** → ô **Trạng thái** chọn **Bảo trì** → **Lưu thông tin** | Toast "Đã lưu thông tin", thẻ A03 có nhãn **Bảo trì** | "Sân bảo trì sẽ không bán được, nhưng lịch sử vẫn giữ." |
| 1.4 | Cùng trang | Tab **Bảng giá theo khu** → chọn **Khu A - Ngoài trời** | Hiện: "2 sân hoạt động (1 sân bảo trì) (Sân A01, Sân A02)". Bảng giá Thứ 2–Thứ 6 và Thứ 7–CN, mỗi bên 5 khung giờ | "Giá cấu hình một lần cho cả khu, sân bảo trì được ghi chú rõ ràng." |
| 1.5 | Khung **17:00 – 22:00** (Thứ 2 – Thứ 6) | Sửa **Đơn giá / giờ** từ `260000` thành `300000`; **Áp dụng từ** để hôm nay → **Xem trước** | Bảng so sánh "Hiện tại → Dự kiến áp dụng" | |
| 1.6 | | **Lưu bảng giá** | Toast "Đã cập nhật bảng giá khu OUTDOOR; đã cập nhật N slot còn trống…" | "Chỉ slot còn trống nhận giá mới, đơn đã đặt giữ giá cũ." |
| 1.7 | Menu trái | **KINH DOANH → Membership & hội viên** | 2 gói **Club** (249.000₫, giảm 10%) và **Plus** (499.000₫, giảm 15%) | "Quyền lợi hội viên sẽ tự áp vào giá ở Luồng 2." |
| 1.8 | Menu trái | **QUẢN TRỊ → Nhân sự** | Danh sách trọng tài kèm đơn giá/giờ. Các ca trực (06:00–14:00 và 14:00–23:00) đã được seed sẵn cho 4 trọng tài trong suốt tuần | "Trọng tài là dịch vụ bán kèm sẵn sàng phục vụ khách đặt sân." |
| 1.9 | Chrome ẩn danh | Mở `localhost:3000/dat-san` (chưa cần đăng nhập) | Sân A03 hiện **Bảo trì**; chọn ngày làm việc, Sân A02, khung 18:00–20:00 thì **Tiền sân 600.000₫** (300.000₫/giờ) | **Demo nổi bật**: "Admin vừa đổi, khách thấy ngay." |

---

## Luồng 2 — Tư vấn, đặt sân và thanh toán (Khách, ~6 phút)

Cửa sổ: Chrome ẩn danh. Đề bài yêu cầu demo 2 trường hợp.

### A. Khách đã có tài khoản hội viên

| # | Màn hình | Bấm / nhập | Kết quả thấy được | Nói |
|---|---|---|---|---|
| 2.1 | Góc phải dưới | **Trợ lý AI Courtly** → hỏi "Tối nay còn sân ngoài trời nào trống?" | Chatbot trả lời gợi ý sân/giờ | "AI chỉ tư vấn, không thay bước thanh toán." |
| 2.2 | Header | **Đăng nhập** → `demo.hoivien@gmail.com` / `123456` → **Đăng nhập** | Toast "Chào mừng trở lại, Nguyễn Minh Khoa [Hội viên Plus]!" | Tài khoản demo sạch 0 nợ, gói Plus còn 335 ngày |
| 2.3 | **Đặt sân** (`/dat-san`) | **Ngày chơi**: hôm nay → bấm thẻ **Sân A02** | Lưới giờ 30 phút, giờ đã qua là **Không khả dụng** | |
| 2.4 | Mục **02 Chọn giờ chơi** | Bấm giờ bắt đầu (ví dụ 1 tiếng nữa) → bấm giờ kết thúc (+1 giờ). Có thể tick **Thuê trọng tài** và chọn TT có sẵn (ví dụ TT Phạm Quốc Huy) | Khối **Buổi chơi của bạn** hiện tiền sân và phí trọng tài | "Dịch vụ trọng tài hiển thị rõ ca trực khả dụng." |
| 2.5 | Mục **Mã ưu đãi / Voucher** | Bấm voucher **VIP10** *(chỉ hội viên)* | Khối tiền hiển thị đúng thứ tự cộng dồn chuẩn: **Tiền sân** (ví dụ 240.000₫) → **Ưu đãi hội viên** (−36.000₫) → **Voucher VIP10** (−20.400₫ tính trên 204.000₫ sau ưu đãi) → **Trọng tài** (nếu có) → **Tổng tiền** (183.600₫ + trọng tài), **Cọc 50% tiền sân**: 91.800₫ | **Demo nổi bật**: "Hệ thống tính giảm giá lần lượt chuẩn thương mại: hội viên trước, voucher sau trên số đã giảm." |
| 2.6 | | **Tiếp tục thanh toán** | Chuyển sang **Đơn của tôi**: đơn **Đang giữ chỗ**, đồng hồ **5:00** đếm ngược; hộp **Chọn phương thức thanh toán** | "Slot đã bị khóa cho khách này trong 5 phút." |
| 2.7 | Hộp chọn phương thức | **Chuyển khoản VietQR** | Mã QR, số tiền cọc 50%, nội dung chuyển khoản, "Đang lắng nghe biến động số dư…" | |
| 2.8 | Cuối hộp QR | Mở **⚡ Công cụ Demo Hội đồng: Giả lập Ngân hàng gửi Webhook** → **⚡ Giả lập MB Bank chuyển đủ (…)** | "**KHOẢN CHUYỂN ĐÃ XÁC MINH**" | "Ngân hàng gọi webhook, có chữ ký HMAC; hệ thống tự đối soát." |
| 2.9 | | **Xem đơn hàng của tôi** | Đơn **Đã xác nhận**, "✓ Đã đóng" tiền cọc | |
| 2.10 | Thẻ đơn | **🎫 Xem Vé Điện Tử & Mã QR Check-in** | Vé có mã `CT-xxxxxxxx`, "✓ SẴN SÀNG CHECK-IN" | **Ghi lại mã vé**, Luồng 3 sẽ dùng → **Đóng vé** |

### B. Khách mới đăng ký + xử lý tranh chấp khi đặt trùng giờ

Đăng xuất khách hội viên: bấm tên ở header → **Đăng xuất**. Lựa chọn trên `/dat-san` được bảo lưu tự động qua `sessionStorage` trong cùng tab.

| # | Màn hình | Bấm / nhập | Kết quả thấy được | Nói |
|---|---|---|---|---|
| 2.11 | Header | **Đăng nhập** → **Chưa có tài khoản? Đăng ký** | Form **Tạo tài khoản mới**, có quà voucher WELCOME | |
| 2.12 | | Nhập **Họ và tên**, **Số điện thoại** (10 số), **Email**, **Mật khẩu**, **Nhập lại mật khẩu** → **Tạo tài khoản** | Màn **Kích hoạt tài khoản**, khung "Thử nghiệm / Demo: Mã OTP: ……" (mã đã điền sẵn) | "Bản thật gửi OTP qua Gmail; bản demo hiện mã ngay trên màn hình." |
| 2.13 | | **Xác nhận kích hoạt** (hoặc dùng tài khoản `demo.khach@gmail.com` / `123456`) | Đăng nhập thành công; voucher WELCOME sẵn sàng sử dụng | |
| 2.14 | **Đặt sân** | Chọn **cùng ngày, Sân A02, cùng giờ** khách hội viên vừa đặt | Các mốc giờ đó hiện **Không khả dụng**, không chọn được | **Demo nổi bật**: "Slot đã thuộc khách khác, hệ thống không cho đặt trùng." |
| 2.15 | Tranh chấp cùng lúc (2 khách bấm cùng 1 slot) | Khách B chọn đúng slot khách A vừa giữ chỗ rồi bấm **Tiếp tục thanh toán** | Backend trả về HTTP 409 `SLOT_TAKEN`. Frontend tự động cập nhật lưới, bỏ slot bị tranh chấp khỏi lựa chọn, hiển thị thông báo chi tiết và gợi ý tối đa 3 sân cùng khu cùng giờ còn trống | **Demo nổi bật**: "Tranh chấp được xử lý mượt mà như các ứng dụng đặt chỗ hàng đầu." |
| 2.16 | | Chọn khung giờ khác còn trống → bấm voucher **WELCOME** → **Tiếp tục thanh toán** → **Tiền mặt tại quầy** | Đơn giữ chỗ 5 phút, chờ trả tiền tại quầy | "Khách không chuyển khoản thì thu ở quầy." |

---

## Luồng 3 — Vận hành dịch vụ và chăm sóc khách hàng (Staff + Khách + Admin, ~5 phút)

| # | Cửa sổ / màn hình | Bấm / nhập | Kết quả thấy được | Nói |
|---|---|---|---|---|
| 3.1 | Chrome thường | Đăng xuất Admin (biểu tượng ⇥ góc phải) → **Đăng nhập** `staff@gmail.com` / `123456` | Vào **Việc cần xử lý**: các ô Đang dùng sân, Đơn chưa thu tiền, Khách sắp đến… | "Lễ tân nhìn một bảng là biết việc trong ca." |
| 3.2 | Header | **Quét QR Check-in** → tab **Nhập mã / Máy quét** | Ô "Mã vé E-Ticket, UUID đơn hàng hoặc Số điện thoại" | "Có camera thì quét; demo thì nhập mã như máy quét cầm tay." |
| 3.3 | | Nhập mã vé từ bước 2.10 → **Check-in** | Nếu trong khung giờ check-in (trước giờ chơi ≤ 30 phút và sau bắt đầu ≤ 15 phút): "**CHECK-IN TỰ ĐỘNG THÀNH CÔNG!**". Nếu đến quá sớm/muộn: hệ thống yêu cầu xác nhận lý do ngoại lệ (≥ 5 ký tự) và ghi nhật ký kiểm toán với mốc giờ cho phép chính xác | **Demo nổi bật**: "Kiểm soát cửa chặt chẽ, ngăn check-in khống ngoài giờ." |
| 3.4 | | **Xem chi tiết đơn** | Thanh tiến trình: Giữ chỗ ✓ → Đã cọc ✓ → **Check-in** → Hoàn tất | |
| 3.5 | Chi tiết đơn | **Thu nốt tiền (…)** → kiểm tra số tiền → **Xác nhận đã nhận tiền mặt** | Toast "Đã ghi nhận thu tiền mặt thành công" | "Phần còn lại thu tại quầy khi khách đến." |
| 3.6 | Menu trái | **Đơn đặt sân** → dòng đơn vừa check-in → **Check-out** | Hộp **Thủ tục Check-out & Trả sân**, "TRẠNG THÁI CÔNG NỢ: ĐÃ THANH TOÁN ĐỦ 100%" | |
| 3.7 | | **🏁 Đã thanh toán đủ • Xác nhận Check-out & Giải phóng sân** | Toast "Đã Check-out & hoàn tất buổi chơi…", đơn chuyển **Hoàn tất** | |
| 3.8 | Chrome ẩn danh (khách hội viên) | Mở `localhost:3000/feedback` → chọn **5 sao** → nhập cảm nhận (≥ 10 ký tự) → chọn chủ đề **Cơ sở & Mặt sân** → **Gửi đánh giá** | "Cảm ơn bạn! Đánh giá đã được gửi thành công…" | "Phản hồi gắn với khách đã thật sự sử dụng dịch vụ." |
| 3.9 | Chrome thường | Đăng xuất Staff → đăng nhập Admin → **QUẢN TRỊ → Nội dung & feedback** → tab **Feedback & Đánh giá** | Feedback mới ở trạng thái **Đang chờ xử lý** | **Demo nổi bật** |
| 3.10 | | **Xem & trả lời** → **Chế độ hiển thị**: **Công khai trên trang Đánh giá** → nhập **Phản hồi của câu lạc bộ** → **Lưu phản hồi** | Feedback chuyển Công khai, có phản hồi BQL | |

---

## Luồng 4 — Đối soát giao dịch và báo cáo kinh doanh (Admin, ~4 phút)

Cửa sổ: Chrome thường, đang đăng nhập Admin.

| # | Màn hình | Bấm / nhập | Kết quả thấy được | Nói |
|---|---|---|---|---|
| 4.1 | Menu trái | **VẬN HÀNH → Thu tiền & hoàn tiền** | Bộ chọn kỳ tính (mặc định **Tháng này - Tháng 11/2026**). 4 ô: **Tổng đã thu**, **Tổng đã hoàn**, **Thu phí hội viên**, **Thu ròng** (đều gắn nhãn "Tháng 11/2026") | "Trang thu tiền đồng bộ kỳ tính rõ ràng theo chuẩn kế toán." |
| 4.2 | Tab **Giao dịch** | Tìm mã đơn của Luồng 2 trong **Lịch sử giao dịch** | 2 dòng của cùng đơn: **Tiền cọc / Chuyển khoản** (thu ngân "Hệ thống / QR") và **Thanh toán / Tiền mặt** (thu ngân "Lễ tân Courtly (Staff)") | **Demo nổi bật**: "Giao dịch ở Luồng 2 và 3 đã ghi nhận đúng nguồn, đúng người thu." |
| 4.3 | Tab **Đơn cần hoàn tiền** | Đơn **#91919191** (Vũ Mai Phương, hủy trước 24 giờ) → **Hoàn tiền ngay** | Hộp **Ghi nhận hoàn tiền**, số tiền đề xuất 100% cọc, lý do điền sẵn | "Hoàn tiền theo chính sách, Admin duyệt chi." |
| 4.4 | | **Xác nhận đã chuyển khoản / hoàn tiền** | **Tổng đã hoàn** tăng, **Thu ròng** giảm đúng số tiền; tab **Lịch sử hoàn tiền** thêm 1 dòng | |
| 4.5 | | So sánh với **#92929292** (hủy 23,5 giờ trước, hoàn 50%) và **#93939393** (hủy dưới 12 giờ, không hoàn) | Ba mốc chính sách trên dữ liệu thật | |
| 4.6 | Menu trái | **TRA CỨU → Báo cáo** | Mặc định kỳ **Theo Tháng (Tháng 11/2026)**. Ô **Tổng thực thu ròng** khớp chính xác từng đồng với **Thu ròng** ở trang Thu tiền | **Demo nổi bật**: "Hai màn hình dùng chung module period.mjs tính dòng tiền, số liệu khớp hoàn toàn." |
| 4.7 | Thanh **Kỳ báo cáo** | Thử **Theo Ngày** / **Theo Tháng** / **Khoảng ngày** | Biểu đồ xu hướng doanh thu, cơ cấu doanh thu (tiền sân, trọng tài, giải, hội viên, trừ hoàn) | "Admin chọn kỳ cần xem." |
| 4.8 | Cuộn xuống | **Phân bố Khung giờ Cao điểm**, **Công suất Khai thác 10 Sân** | Tỷ lệ giờ chơi theo khung giờ, theo từng sân | "Biết sân nào, giờ nào hiệu quả." |
| 4.9 | Bảng **Danh sách đơn hàng trong kỳ** | Tìm mã đơn Luồng 2 | Đơn trạng thái **Hoàn tất**, "Đã thu cả đơn" bằng tổng tiền | Khép vòng câu chuyện |
| 4.10 | Góc trên | **Xuất báo cáo CSV** hoặc **In / Xuất PDF Báo Cáo** | File báo cáo | |

---

## Sau khi demo / tập dượt

Chạy `.\reset-demo.ps1`, hoặc trong Admin vào **Hệ thống & module** → **Đặt lại dữ liệu mẫu Hội đồng**. Reset trả lại giá khu A, trạng thái sân A03, xóa tài khoản và đơn tự tạo.

## Bảng theo dõi lỗi & tiến độ sửa chữa

| Mức | Lỗi | Vị trí | Trạng thái | Commit |
|---|---|---|---|---|
| Cao (P1-a) | Check-in nhận cả đơn ngoài giờ, không chặn ngoài cửa sổ 30 phút | Quét QR Check-in / backend check-in | **ĐÃ SỬA** | `0306065` |
| Cao (P1-b) | Tài khoản demo bị nợ quá hạn chặn đặt sân | Seed demo accounts | **ĐÃ SỬA** | `42d67cf` |
| Trung bình (P2-a) | Nút "Đăng nhập để xem trọng tài" và "Đăng nhập ngay" mở nhầm form "Lưu mật khẩu" | `Portal.jsx`, `Booking.jsx`, `Content.jsx`, `Tournaments.jsx` | **ĐÃ SỬA** | `5abde04` |
| Trung bình (P2-b) | Thiếu ca trực trọng tài và khó tạo ca trên giao diện staff | Seed `staff_schedules` & `StaffPage.jsx` | **ĐÃ SỬA** | `b1cf692` |
| Trung bình (P2-c) | Tranh chấp đặt slot trả HTTP 400 chung chung, không gợi ý sân khác | `ScheduleService.java` & `Booking.jsx` | **ĐÃ SỬA** | `884cd13` |
| Trung bình (P2-d) | Ưu đãi hội viên và voucher cộng dồn sai thứ tự (cùng tính trên gross) | `OrderService.java`, `BookingSupportService.java`, `Booking.jsx` | **ĐÃ SỬA** | `f51a36c` |
| Trung bình (P2-e) | "Thu ròng" không ghi kỳ tính, lệch số với trang Báo cáo | `PaymentsPage.jsx`, `ReportsPage.jsx`, `period.mjs` | **ĐÃ SỬA** | `62e0dda` |
| Thấp (P3-1) | Giờ hiển thị dạng "18.5:00" | Frontend time formatting | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-2) | Danh sách nhân sự có bản ghi test "Non-billable test staff" | `baseline.json` | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-3) | Tick "Thuê trọng tài" khi chưa đăng nhập làm khóa nút đặt | `Booking.jsx` (`ready`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-4) | Đăng xuất/đăng nhập làm mất lựa chọn sân và giờ trên `/dat-san` | `Booking.jsx` (`sessionStorage`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-5) | "Bảng giá theo khu" vẫn đếm sân bảo trì vào số sân hoạt động | `CourtsPage.jsx` | **ĐÃ SỬA** | `618fd63` |
