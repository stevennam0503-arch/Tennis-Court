# Kịch bản demo 4 flow — theo slide "Green Modern Tennis Club Presentation"

Cập nhật trên nhánh `nam-dev` (05/11/2026). Kịch bản bám đúng 4 flow và các chặng trên slide; tên chặng trên slide ghi trong ngoặc vuông, ví dụ **[Prepare resources]**. Tên nút ghi **đúng như trên màn hình**.

Các bước đã chạy thử qua API trên dữ liệu sau reset ngày 05/11/2026; câu trong ngoặc kép là thông báo thật của hệ thống. Cột **Ràng buộc** ghi luật nghiệp vụ mà bước đó chứng minh.

**Một câu chuyện, một buổi chiều, chạy liên tục:**
Manager chuẩn bị sân, giá, ca trọng tài; Staff cấu hình voucher → khách thấy ngay (Flow 1) → anh Khoa (hội viên) đặt Sân A02 chiều nay, dùng ưu đãi hạng, voucher và điểm, chuyển khoản; chị Trang đặt B01 tối mai, trả cọc tại quầy (Flow 2) → lễ tân check-in, gia hạn, check-out anh Khoa; chị Trang đổi lịch rồi hủy; anh Khoa chấm 3 sao và được bù voucher (Flow 3) → lễ tân chốt ca; Manager đối soát, duyệt hoàn cọc cho chị Trang và xem báo cáo (Flow 4).

---

## 0. Chuẩn bị (trước giờ demo 30 phút)

### Khung giờ được phép demo

Chỉ demo **ngày thường (Thứ 2 – Thứ 6), bắt đầu trong khoảng 16:30 – 20:30**. Lý do: giá mới ở bước 1.5 áp cho khung 17:00–22:00 ngày thường, slot bảo trì ở 1.7 là 22:00, và đơn của anh Khoa phải bắt đầu trong khung giá mới và trong khung check-in.

### Ba cửa sổ cố định, đăng nhập một lần

Mỗi vai đăng nhập **một lần** ở cửa sổ riêng và giữ nguyên đến hết buổi. Xếp 3 cửa sổ cạnh nhau (hoặc 3 màn hình/tab trình chiếu) để chuyển qua lại không cần đăng nhập lại.

| Cửa sổ | Vai | Đăng nhập | Đổi tài khoản trong buổi |
|---|---|---|---|
| **Chrome thường** | **Manager** | `admin@gmail.com` | Không |
| **Edge** (hoặc một profile Chrome khác) | **Staff** (lễ tân / thu ngân) | `staff@gmail.com` | Không |
| **Chrome ẩn danh** (Ctrl+Shift+N) | **Khách** | Lần lượt: vãng lai → Khoa → Trang → Khoa | 3 lần |
| **Firefox** *(tùy chọn)* | Khách thứ hai tranh slot | `demo.khach@gmail.com` | Không — chỉ dùng ở 2.6 |

| # | Việc | Ghi chú |
|---|---|---|
| 0.1 | Mở Docker Desktop, chạy `docker compose up -d` | Web: `http://localhost:3000`, Admin/Staff: `http://localhost:3000/app` |
| 0.2 | Chạy `.\reset-demo.ps1` | Đưa dữ liệu mẫu và tài khoản demo về chuẩn |
| 0.3 | Đăng nhập sẵn Manager (Chrome thường) và Staff (Edge) | Chrome ẩn danh mở `localhost:3000`, **chưa đăng nhập** |
| 0.4 | Chuẩn bị một chỗ ghi mã vé (giấy / notepad) | Mã vé anh Khoa ở 2.7 dùng lại ở 3.2 mà không phải đổi tài khoản |

### Actor

Mật khẩu đều là `123456` sau reset. Slide gọi Manager là ADMIN ở Flow 4; trong app đây là cùng một vai trò.

| Actor trên slide | Người / hệ thống trong demo | Tài khoản |
|---|---|---|
| **MANAGER** (Admin) | Quản lý CLB | `admin@gmail.com` |
| **STAFF** | Lễ tân / thu ngân | `staff@gmail.com` |
| **CUSTOMER** | Khách vãng lai (chưa đăng nhập) | — |
| **CUSTOMER** | Anh **Nguyễn Minh Khoa** — hạng **Masters** (giảm 5%), 2.537 điểm, sắp lên hạng | `demo.hoivien@gmail.com` |
| **CUSTOMER** | Chị **Phạm Thu Trang** — hạng **Challenger**, sinh nhật tháng này, có voucher `BDAY-CHALLENGER-60K` | `demo.khach@gmail.com` |
| **SYSTEM** | Courtly (sinh slot, tính giá, khóa slot, đối soát) | — |
| Dịch vụ ngoài | Ngân hàng (webhook MB Bank giả lập), Email (Gmail), AI (Google Gemini) | — |

### Mốc thời gian (ví dụ bắt đầu 16:30)

| Mốc | Flow | Ghi chú |
|---|---|---|
| 16:30 – 16:34 | Flow 1 | |
| 16:34 – 16:42 | Flow 2 | Khoa đặt khoảng **16:36** cho slot **17:00** |
| 16:42 – 16:49 | Flow 3 | Check-in lúc khoảng **16:43**, tức 17 phút trước giờ chơi → trong khung check-in |
| 16:49 – 16:53 | Flow 4 | |

---

## FLOW 1 — Court & Service Setup (~4 phút)

*Chuẩn bị sân, giá, hạng thành viên và voucher trước khi khách đặt.* **Actor:** Manager, System, Staff, Customer.

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Manager | **[Prepare resources] 1.1** *Chrome thường.* **KINH DOANH → Sân & bảng giá** → tab **Danh sách sân (10)**. | Chỉ Manager được sửa sân, giá, nhân sự. |
| Manager | **1.2** Thẻ **Sân A03** → **Chỉnh sửa** → **Trạng thái**: **Bảo trì** → **Lưu thông tin**. Toast "Đã lưu thông tin", A03 có nhãn **Bảo trì**. | Chỉ khóa được sân **không còn đơn sắp tới** (đối chiếu ở 2.12). |
| Manager | **1.3** **Thêm sân** → **Tên sân** nhập `Sân A01` → **Lưu thông tin**. Báo 'Tên sân "Sân A01" đã tồn tại. Vui lòng chọn tên khác.' → **Đóng**. | Tên sân là duy nhất. Để trống tên thì hệ thống tự đặt tên kế tiếp của khu (Sân A05) và sân mới tự nhận bảng giá khu. |
| Manager | **1.4** **QUẢN TRỊ → Nhân sự** → danh sách trọng tài kèm đơn giá/giờ và **ca trực** 06:00–14:00, 14:00–23:00 cả tuần (10 trọng tài, 70 ca). | Khách chỉ thuê được trọng tài **có ca trực trống** đúng giờ; ca đã được phân công thì không xóa được ("Không thể xóa slot đã được phân công hoặc đang có đơn đặt"). |
| Manager | **[Price & schedule] 1.5** **Sân & bảng giá** → tab **Bảng giá theo khu** → **Khu A - Ngoài trời** ("3 sân hoạt động (1 sân bảo trì) (Sân A01, Sân A02, Sân A04)"). Khung **17:00 – 22:00** Thứ 2–6: `260000` → `300000`, **Áp dụng từ** hôm nay → **Xem trước** → **Lưu bảng giá**. Toast "Đã cập nhật bảng giá khu OUTDOOR; đã cập nhật N slot còn trống…" | Giá theo **khu × khung giờ × ngày thường/cuối tuần**. Chỉ slot trống/bảo trì nhận giá mới; slot đã có đơn **giữ giá đã chốt**. |
| System | **1.6** Tự sinh slot **30 phút** (06:00–23:00) cho mọi sân đang khai thác, giá mỗi slot lấy từ bảng giá khu. | Sân mới hoặc ngày mới đều có slot ngay khi được xem; sân ngừng khai thác không sinh slot. |
| Manager | **1.7** **VẬN HÀNH → Lịch sân** → lọc **Ngoài trời** → bấm ô **Sân A01 22:00** → **Bảo trì khung giờ**. Ô chuyển **Bảo trì**. | Bảo trì **từng slot** chỉ áp cho **khung giờ trống** ("Chỉ có thể đưa khung giờ trống vào bảo trì…"). |
| Staff | **[Configure benefits] 1.8** *Chuyển sang Edge (Staff).* **Thành viên & điểm**: 4 hạng **Rookie → Challenger → Masters → Grand Slam**, mức giảm và hệ số tích điểm. | Chính sách hạng do Manager chỉnh (hệ số điểm ×1,0–×5,0; đổi lịch miễn phí 0–10 lần; voucher sinh nhật tối đa 1.000.000₫). Staff chỉ xem. |
| Staff | **1.9** **Khuyến mãi & voucher** → **Tạo voucher mới**: `DEMO15`, giảm **15%** (tối đa 50.000₫), đơn từ 200.000₫, 30 lượt, mỗi khách 1 lần, 14 ngày → lưu. Voucher **kích hoạt ngay**. | Điều kiện voucher: đơn tối thiểu, giảm tối đa, **giới hạn lượt dùng** tổng và theo khách, thời hạn. |
| Staff | **1.10** Tạo tiếp `DEMO30` giảm **30%** → voucher vào **Chờ duyệt**; Staff không có nút **Duyệt**. | Staff chỉ tự kích hoạt voucher trong hạn mức: giảm ≤ 20% (có giảm tối đa) hoặc ≤ 100.000₫, ≤ 50 lượt, ≤ 30 ngày. |
| Manager | **1.11** *Chuyển sang Chrome thường (Manager).* **Khuyến mãi & voucher** → lọc **Chờ duyệt** → `DEMO30` → **Duyệt**. | Vượt hạn mức cần **Manager duyệt** ("Chỉ Manager mới có quyền phê duyệt voucher"). |
| Customer (vãng lai) | **[View availability] 1.12** *Chuyển sang Chrome ẩn danh (chưa đăng nhập).* `localhost:3000/dat-san`: A03 hiện **Bảo trì**, không bấm được; Sân A01 22:00 **Bảo trì**; Sân A02 18:00–20:00 = **600.000₫** (300.000₫/giờ). | Thay đổi của Manager có hiệu lực **ngay**. Giờ đã qua hiện **Không khả dụng**. |
| Customer → AI | **1.13** **Trợ lý AI Courtly** → hỏi "Chiều nay còn sân ngoài trời nào trống?" | AI trả lời từ giá và số sân thật, **không** thay bước đặt và thanh toán. |

**[Ready to book]** Sân hoạt động · slot trống · giá hợp lệ. *Điểm khác biệt: giá theo khung giờ và bảo trì từng slot.*

---

## FLOW 2 — Booking & Payment (~8 phút)

*Khách hội viên và khách mới đi cùng một luồng đặt sân được bảo vệ.* **Actor:** Customer, System, Ngân hàng, Staff, Manager.

Làm **hết phần của anh Khoa** (2.1–2.7) rồi mới đến **chị Trang** (2.8–2.10). Từ lúc bấm **Tiếp tục thanh toán** (2.5) đến lúc ngân hàng xác nhận (2.6) **không chen bước nào khác**.

### Anh Khoa — hội viên, chuyển khoản

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Customer (Khoa) | **[Choose a service] 2.1** *Chrome ẩn danh.* **Đăng nhập** `demo.hoivien@gmail.com`. Toast chào mừng Nguyễn Minh Khoa, hạng Masters. | Tài khoản không nợ quá hạn (khách nợ quá hạn bị chặn đặt sân). |
| Customer (Khoa) | **2.2** **Đặt sân** → hôm nay → **Sân A02** → chọn **slot 30 phút gần nhất cách hiện tại 20–30 phút** (ví dụ đặt lúc 16:36 thì chọn **17:00**), giờ kết thúc +1 giờ. Có thể tick **Thuê trọng tài** và chọn trọng tài còn trống. | Giờ trên cùng sân phải **liên tiếp**. Chỉ hiện trọng tài có ca trực trống; mỗi slot một trọng tài. Chọn giờ như vậy để bước 3.2 rơi đúng khung check-in. |
| Customer → System | **2.3** Thử chọn thêm giờ trên 3 sân khác → khi thêm **sân thứ 4**: "Tối đa 3 sân trong cùng một đơn đặt." → bỏ chọn các sân thử, giữ lại **Sân A02**. | Tối đa **3 sân / đơn**. Làm bước này **trước** khi bấm thanh toán để không ăn vào thời gian giữ chỗ. |
| System | **[Calculate the quote] 2.4** Chọn voucher **VIP10**, nhập **500 điểm**. Khối tiền (17:00–18:00, không trọng tài): **Tiền sân** 300.000₫ → **Ưu đãi hạng Masters** −15.000₫ → **VIP10** −28.500₫ (10% trên 285.000₫) → **Điểm thưởng** −50.000₫ → **Tổng** 206.500₫; **Cọc 50%**. | Thứ tự cộng dồn: **hạng → voucher → điểm**. 1 điểm = 100₫. VIP10 chỉ cho hội viên ("Đăng nhập để dùng voucher theo hạng"). Cọc = 50%. |
| System | **[Hold the court] 2.5** **Tiếp tục thanh toán** → **Đơn của tôi**: đơn **Đang giữ chỗ**, đồng hồ **5:00** → chọn **Chuyển khoản VietQR** ngay. | Kiểm tra lại slot lúc tạo đơn, **khóa** slot cho khách này **5 phút**; hết giờ chưa trả thì đơn tự hết hạn, slot được nhả. |
| Customer (Trang) | *(Tùy chọn — Firefox)* Trang đã mở sẵn đúng slot A02 17:00 từ trước 2.5; ngay sau khi Khoa bấm, Trang bấm **Tiếp tục thanh toán** → "Sân A02 17:00–17:30 vừa được khách khác giữ chỗ. Vui lòng chọn giờ khác." Lưới tự cập nhật, gợi ý sân khác cùng khu. | Hai khách cùng slot: chỉ người khóa trước giữ được (HTTP 409 `SLOT_TAKEN`). |
| Ngân hàng | **[Pay & verify] 2.6** *Chrome ẩn danh (Khoa).* Trong hộp QR → **⚡ Công cụ Demo Hội đồng: Giả lập Ngân hàng gửi Webhook** → **⚡ Giả lập MB Bank chuyển đủ (…)** → "**KHOẢN CHUYỂN ĐÃ XÁC MINH**". | Webhook phải đúng **chữ ký HMAC**, tài khoản nhận, mã giao dịch, số tiền nguyên dương; giao dịch đã thu đủ không nhận lần hai. Phải trả **trước khi hết giờ giữ chỗ**. |
| Customer (Khoa) | **[Confirmed] 2.7** **Xem đơn hàng của tôi** → **Đã xác nhận**, "✓ Đã đóng" cọc → **🎫 Xem Vé Điện Tử & Mã QR Check-in** → **ghi lại mã `CT-xxxxxxxx`** (dùng ở 3.2). **Lịch sử thanh toán** có dòng chuyển khoản. | Vé chỉ "✓ SẴN SÀNG CHECK-IN" khi đã đóng cọc. |

### Chị Trang — khách mới, trả cọc tại quầy

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Customer (Trang) | **[Choose a service] 2.8** *Chrome ẩn danh:* Khoa **Đăng xuất** → **Đăng nhập** → **Chưa có tài khoản? Đăng ký**: giới thiệu form (họ tên, số điện thoại, email, mật khẩu) và màn **Kích hoạt tài khoản** với mã OTP 6 số. Để tiết kiệm thời gian, quay lại **Đăng nhập** `demo.khach@gmail.com`. | Số điện thoại đã có tài khoản thì không đăng ký lại. Mã sai báo số lần thử còn lại; sai 5 lần phải xin mã mới. **Lưu ý:** slide ghi "Phone OTP", app hiện gửi OTP qua **email**. |
| Customer (Trang) | **2.9** **Đặt sân** → **ngày mai**, **Sân B01**, 19:00–20:00 → gõ mã **WELCOME** → "Mã chào mừng chung 'WELCOME' đã đóng. Vui lòng sử dụng mã voucher cá nhân (WELCOME-XXXX)…" → chọn **BDAY-CHALLENGER-60K** trong ví → **Tiếp tục thanh toán** → **Tiền mặt tại quầy**. Đồng hồ giữ chỗ 5:00 bắt đầu. | Mã WELCOME chung đã đóng; khách dùng mã cá nhân trong ví. Đơn giữ chỗ 5 phút chờ thu cọc. |
| Staff | **[Pay & verify] 2.10** *Chuyển ngay sang Edge (Staff, đang đăng nhập sẵn).* **Đơn đặt sân** → đơn của Phạm Thu Trang → thu cọc tiền mặt (lần chạy thử: 134.900₫) → đơn **Đã xác nhận**. | Staff xác nhận **trước khi hết giờ giữ chỗ**; không thu vượt số còn thiếu ("Thu vượt số tiền còn thiếu"). |
| Manager | **[Confirmed] 2.11** *Chuyển sang Chrome thường (Manager).* **VẬN HÀNH → Lịch sân**: ô A02 17:00 hiện tên anh Khoa; bấm vào mở chi tiết đơn, không chọn để bảo trì được. | Không bảo trì slot đã có khách. |
| Manager | **2.12** **Sân & bảng giá** → **Sân A02** → **Chỉnh sửa** → **Bảo trì** → **Lưu thông tin** → "Không thể chuyển sân sang trạng thái tạm ngưng: sân còn 1 đơn sắp tới (CT-xxxxxxxx · Nguyễn Minh Khoa · dd/mm). Đổi lịch sang sân khác hoặc hủy và hoàn tiền trước." → **Đóng**. Thử **Ngừng khai thác** → **Xác nhận ngừng** → "Không thể ngừng khai thác Sân A02: …" | Sân đã bán cho khách thì không khóa, không ngừng khai thác; phải đổi lịch hoặc hủy đơn trước. |

**[Confirmed]** Mã đơn & QR · cọc đã xác minh · lịch sử thanh toán. *Điểm khác biệt: giảm theo hạng, điểm thưởng, giữ slot 5 phút và cọc được xác minh.*

---

## FLOW 3 — Order Process & Feedback (~7 phút)

*Lễ tân phục vụ đơn đã đặt, xử lý thay đổi và thu nhận phản hồi.* **Actor:** Staff, Customer, System.

Thứ tự cửa sổ: **Edge (Staff)** phục vụ anh Khoa → **Chrome ẩn danh (vẫn là Trang)** đổi lịch, hủy → **Edge** → **Chrome ẩn danh** đổi sang Khoa để đánh giá → **Edge** xử lý đánh giá.

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Staff | **[Prepare service] 3.1** *Edge (Staff).* **Việc cần xử lý**: khách sắp đến (anh Khoa 17:00), đơn chưa thu đủ, trọng tài theo đơn. | Menu Staff không có Sân & bảng giá, Nhân sự, Tài khoản & phân quyền, Hệ thống & module. |
| Customer (Khoa) → Staff | **[Check in] 3.2** Anh Khoa đến quầy, đưa mã vé đã ghi ở 2.7. **Quét QR Check-in** → **Nhập mã / Máy quét** → `CT-xxxxxxxx` → **Check-in** → "**CHECK-IN TỰ ĐỘNG THÀNH CÔNG!**". Nếu lỡ ngoài khung: "Chưa tới giờ check-in (từ hh:mm ngày dd/mm). Nhập lý do ngoại lệ để tiếp tục." → nhập lý do. | Check-in từ **30 phút trước đến 15 phút sau** giờ bắt đầu; ngoài khung phải nhập lý do (≥ 5 ký tự), được ghi nhật ký. Đơn chưa đủ cọc cũng cần lý do. Đã qua giờ chơi thì không check-in. |
| Staff | **3.3** Chi tiết đơn → **Gia hạn giờ chơi** → **+30 phút** (giá đã trừ ưu đãi hạng Masters). | Chỉ gia hạn khi slot liền sau **còn trống**; giá gia hạn vẫn áp ưu đãi hạng. |
| Staff | **[Play & check out] 3.4** *Người trình bày nói: "Giả định anh Khoa đã chơi xong, ra quầy trả sân."* **Thu nốt tiền (…)** → **Xác nhận đã nhận tiền mặt** → **Đơn đặt sân** → **Check-out** → "TRẠNG THÁI CÔNG NỢ: ĐÃ THANH TOÁN ĐỦ 100%" → **🏁 Đã thanh toán đủ • Xác nhận Check-out & Giải phóng sân**. Đơn **Hoàn tất**. | Không thu vượt số còn thiếu; check-out hiện rõ công nợ trước khi giải phóng sân. |
| System | **3.5** Cộng chi tiêu và điểm cho anh Khoa: **lên hạng Grand Slam** (đã thấy trong lần chạy thử). | Hạng và điểm chỉ cập nhật khi đơn **hoàn tất**. |
| Customer (Trang) | **[Handle requests] 3.6** *Chrome ẩn danh (vẫn đăng nhập Trang từ 2.8).* **Đơn của tôi** → đơn B01 ngày mai → **Đổi lịch sân** → **Sân B02** 20:00–21:00 → xác nhận. | Khách tự đổi lịch **trước 24 giờ**; muộn hơn: "Đã qua hạn đổi/hủy; liên hệ quầy". Số lần đổi miễn phí theo hạng. Đã check-in thì không đổi. |
| Customer (Trang) → System | **3.7** **Hủy đơn** → hệ thống hiện mức hoàn: "Hủy trước giờ chơi trên 24 tiếng: Hoàn lại 100% tiền cọc." → **Xác nhận hủy đơn đặt sân**. Đơn **Đã hủy**, khoản **chờ hoàn** 134.900₫ (Manager duyệt chi ở 4.4). | Mức hoàn theo giờ hủy: **> 24 giờ 100%**, **12–24 giờ 50%**, **< 12 giờ 0%**. |
| Staff | **3.8** *Edge (Staff).* **Thu tiền & hoàn tiền** → **Đơn cần hoàn tiền** → **#92929292** (đã cọc 240.000₫, hủy 23,5 giờ trước) → **Hoàn tiền ngay** → ô ghi "tối đa 120.000₫ theo chính sách"; thử 240.000₫ bị chặn ("Staff chỉ hoàn tối đa 120.000₫ theo chính sách. Khoản vượt mức cần Manager duyệt.") → **Hủy**. | Staff chỉ hoàn **trong chính sách**; vượt mức hoặc hoàn phí giải đấu cần Manager. Đơn hủy muộn (#93939393): "Đơn không có khoản chờ hoàn theo chính sách…". |
| Customer (Khoa) | **[Feedback] 3.9** *Chrome ẩn danh:* Trang **Đăng xuất** → **Đăng nhập** `demo.hoivien@gmail.com` → `localhost:3000/feedback` → **3 sao** → "Đèn sân A02 hơi tối ở cuối sân, mong CLB kiểm tra." → chọn đơn vừa chơi → **Gửi đánh giá**. | Nội dung ≥ 10 ký tự ("Nội dung cần ít nhất 10 ký tự"); chỉ chọn được đơn **đã hoàn tất** của chính mình. Đánh giá **≤ 3 sao** tự vào hàng **Đánh giá thấp cần xử lý**, hạn xử lý 24 giờ. |
| Staff | **3.10** *Edge (Staff).* **Feedback & Đánh giá** → lọc **⚠️ Đánh giá thấp cần xử lý** → mở đánh giá của anh Khoa → nhận xử lý → **🎁 Tặng voucher** (mẫu **Xin lỗi nhẹ 50.000₫**) → nhập phản hồi → **Hoàn tất & Đóng ca xử lý**. Toast "Đã tặng voucher SORRY-xxxx cho khách hàng…" | **Service recovery**: đánh giá thấp phải được xử lý (bù voucher hoặc "Đóng ca (Không bù)"). Chỉ Manager/Staff được tặng voucher bồi thường. |
| Customer (Khoa) | **3.11** *Chrome ẩn danh (Khoa).* Chuông **Thông báo** và **ví Ưu đãi** có voucher `SORRY-xxxx`. | Khách nhận thông báo trạng thái đơn và voucher bù. |

*Điểm khác biệt: check-in ngoại lệ phải có lý do; đánh giá thấp kích hoạt khôi phục dịch vụ.*

---

## FLOW 4 — Dashboard & Reporting (~4 phút)

*Đối chiếu tiền đã thu và đo hiệu quả khai thác sân.* **Actor:** Staff, System, Manager (Admin).

| Actor | Quy trình / bước thực hiện | Ràng buộc |
|---|---|---|
| Staff | **[Collect data] 4.1** *Edge (Staff, đang đăng nhập).* Mở `localhost:3000/quay-thu` → **Chốt ca thu ngân** → nhập tiền đầu ca và tiền thực đếm → chốt. Phiếu chốt ca hiện tiền mặt đã thu trong ca (cọc của chị Trang, tiền thu nốt và gia hạn của anh Khoa) và chênh lệch. | Chỉ thu ngân và Manager vào được quầy thu; tiền mặt tính theo **người thu** trong ngày. |
| System | **4.2** Gom đơn, thanh toán tiền mặt và chuyển khoản, giao dịch hoàn tiền vào sổ. | Mỗi giao dịch ghi đúng nguồn (chuyển khoản qua QR / tiền mặt tại quầy) và người thu. |
| Manager | **[Reconcile] 4.3** *Chrome thường (Manager).* **VẬN HÀNH → Thu tiền & hoàn tiền** → **Đối soát & Ngoại lệ**: **tiền thu thừa / không khớp** và **đơn đã hủy còn giữ cọc** (đơn của chị Trang 134.900₫, #91919191, #92929292). | Khoản thừa và khoản chờ hoàn đều phải được xử lý, không để treo. |
| Manager | **4.4** **Đơn cần hoàn tiền** → đơn của chị Trang → **Hoàn tiền ngay** (đề xuất 100% = 134.900₫) → **Xác nhận đã chuyển khoản / hoàn tiền**. Làm tiếp **#92929292** (120.000₫, 50% — đơn Staff bị chặn hoàn vượt ở 3.8). | **Admin duyệt chi hoàn tiền**; tổng hoàn không vượt số đã thu còn lại; mỗi lần hoàn ghi nhật ký người duyệt. |
| Manager | **[Select period] 4.5** Bộ chọn kỳ (mặc định **Tháng này**) → thử **Theo Ngày** / **Khoảng ngày** → áp dụng. 4 ô **Tổng đã thu**, **Tổng đã hoàn**, **Thu phí hội viên**, **Thu ròng** gắn nhãn kỳ. | Mọi số tiền gắn rõ kỳ tính. |
| System | **[Calculate] 4.6** **TRA CỨU → Báo cáo**: **Tổng thực thu ròng** (sau hoàn) khớp từng đồng với **Thu ròng** ở 4.5; **Phân bố Khung giờ Cao điểm**; **Biểu đồ Công suất Khai thác 10 Sân**; **Danh sách đơn hàng trong kỳ** và báo cáo thành viên. | Báo cáo và trang thu tiền dùng chung cách tính kỳ (`period.mjs`); số sân đếm theo dữ liệu thật. |
| Manager | **[Business insights] 4.7** Tìm đơn của anh Khoa (**Hoàn tất**, đã thu đủ) và đơn của chị Trang (**Đã hủy**, đã hoàn) trong danh sách → **Xuất báo cáo CSV** hoặc **In / Xuất PDF Báo Cáo**. | Tiền từ Flow 2 và Flow 3 truy vết được tới báo cáo. |
| Manager | **4.8** *(Tùy chọn)* **Tài khoản & phân quyền** → `admin@gmail.com` → đổi quyền thành Staff → lưu → "Không được tự khóa/hạ quyền hoặc thay quyền chủ hệ thống". | Manager không tự khóa/hạ quyền chính mình. |

*Điểm khác biệt: tiền từ Flow 02 và Flow 03 được truy vết và đối chiếu trong báo cáo.*

---

## Sau khi demo / tập dượt

Chạy `.\reset-demo.ps1`, hoặc Manager vào **Hệ thống & module** → **Đặt lại dữ liệu mẫu Hội đồng**. Reset trả lại giá khu A, trạng thái Sân A03, slot bảo trì, xóa đơn, voucher và tài khoản tự tạo.

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
| Trung bình (P2-f) | Đổi khu / đổi giá gốc của sân không cập nhật giá slot; số sân ghi cứng ở trang khách, AI, báo cáo | `CatalogService.java`, `Overview.jsx`, `AiChatbox.jsx`, `ReportsPage.jsx` | **ĐÃ SỬA** | `47f6334` |
| Thấp (P3-1) | Giờ hiển thị dạng "18.5:00" | Frontend time formatting | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-2) | Danh sách nhân sự có bản ghi test "Non-billable test staff" | `baseline.json` | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-3) | Tick "Thuê trọng tài" khi chưa đăng nhập làm khóa nút đặt | `Booking.jsx` (`ready`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-4) | Đăng xuất/đăng nhập làm mất lựa chọn sân và giờ trên `/dat-san` | `Booking.jsx` (`sessionStorage`) | **ĐÃ SỬA** | `618fd63` |
| Thấp (P3-5) | "Bảng giá theo khu" vẫn đếm sân bảo trì vào số sân hoạt động | `CourtsPage.jsx` | **ĐÃ SỬA** | `618fd63` |
