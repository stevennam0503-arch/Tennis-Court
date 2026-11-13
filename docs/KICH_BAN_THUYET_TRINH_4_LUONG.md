# Kịch bản thuyết trình demo Courtly — 4 luồng

Mỗi bước gồm 3 phần:
- 🖱️ **Làm**: thao tác trên màn hình. Tên nút ghi đúng như trong giao diện.
- 🎤 **Nói**: lời thuyết trình, nói tự nhiên, không cần đọc nguyên văn.
- 📌 **Điểm nhấn**: ràng buộc nghiệp vụ cần chỉ cho hội đồng thấy.

Câu trong ngoặc kép « … » là thông báo thật của hệ thống. Toàn bộ kịch bản đã chạy thử trên dữ liệu sau reset ngày 12/11/2026.

| Luồng | Nội dung | Thời lượng |
|---|---|---|
| Mở đầu | Giới thiệu bài toán và vai trò | ~1 phút |
| 1 | Quản lý sân: thêm, xóa, cập nhật tình trạng | ~4 phút |
| 2 | Đặt sân, thanh toán cọc, hủy sân, hoàn tiền | ~7 phút |
| 3 | Check-in, thêm trọng tài, gia hạn, check-out, feedback, tặng voucher, mã giảm giá | ~8 phút |
| 4 | Dashboard: tiền vào và tiền hoàn bị trừ | ~4 phút |
| Kết | Tổng kết | ~1 phút |

---

## 0. Chuẩn bị (trước giờ thuyết trình 15 phút)

1. Chạy `docker compose up -d` rồi `.\reset-demo.ps1`. Mật khẩu mọi tài khoản là `123456`.
2. Mở sẵn 3 cửa sổ, đăng nhập một lần:
   - **Chrome thường**: Manager `admin@gmail.com`.
   - **Edge**: Staff `staff@gmail.com`.
   - **Chrome ẩn danh**: trang khách `localhost:3000`, chưa đăng nhập.
3. Hai khách demo:
   - **Anh Nguyễn Minh Khoa** (`demo.hoivien@gmail.com`): hạng Masters, khoảng 2.537 điểm.
   - **Chị Phạm Thu Trang** (`demo.khach@gmail.com`): hạng Challenger, có voucher sinh nhật `BDAY-CHALLENGER-60K`.
4. **Chụp lại số liệu gốc cho Luồng 4.** Ở Edge, mở **Thu tiền & hoàn tiền**, chọn kỳ **Theo Ngày** = hôm nay, rồi ghi lại 3 ô **Tổng đã thu**, **Tổng đã hoàn**, **Thu ròng**. Sau reset, Tổng đã hoàn trong ngày bằng 0₫.
5. Chọn giờ chơi cho anh Khoa trước: lấy **slot trống gần nhất cách lúc đặt 20–30 phút** trên **Sân A02**. Ví dụ đặt lúc 11:40 thì chọn 12:00. Chọn như vậy để khi sang Luồng 3, đơn rơi đúng khung check-in (30 phút trước giờ chơi). Nếu hôm nay không còn slot phù hợp, xem phương án dự phòng ở cuối tài liệu.

---

## Mở đầu (~1 phút)

🎤 **Nói:**
> "Kính chào thầy cô và các bạn. Nhóm em xin trình bày **Courtly**, hệ thống quản lý câu lạc bộ tennis. Hệ thống phục vụ ba vai trò: **Manager** quản lý sân, giá và chính sách; **Staff** vận hành quầy, gồm thu tiền, check-in và xử lý phản hồi; **Khách hàng** tự đặt sân và thanh toán online.
> Phần demo đi theo đúng vòng đời một lượt chơi qua 4 luồng: chuẩn bị sân, khách đặt và thanh toán, khách đến chơi rồi phản hồi, và cuối cùng là toàn bộ dòng tiền hiện lên dashboard. Dữ liệu được nối liền giữa các luồng, nên tiền phát sinh ở Luồng 2 và 3 sẽ được đối chiếu ở Luồng 4."

---

## LUỒNG 1 — Quản lý sân: thêm, xóa, cập nhật tình trạng (~4 phút)

### 1.1 Mở danh sách sân
🖱️ **Làm:** *Chrome thường (Manager).* Vào **KINH DOANH → Sân & bảng giá**, tab **Danh sách sân (10)**.

🎤 **Nói:**
> "Em đăng nhập bằng tài khoản Manager. CLB có 10 sân chia theo khu: khu A ngoài trời và khu B trong nhà. Mỗi sân có trạng thái hoạt động, còn giá lấy theo bảng giá của khu."

📌 Chỉ Manager được sửa sân, giá và nhân sự. Menu của Staff không có mục này.

### 1.2 Thêm sân mới
🖱️ **Làm:** Bấm **Thêm sân**, chọn **Loại sân: Sân ngoài trời (Khu A)**. Ô **Tên sân** tự gợi ý tên kế tiếp, ví dụ `Sân A06`. Giữ nguyên rồi bấm **Lưu thông tin**.

🎤 **Nói:**
> "Khi thêm sân, hệ thống tự đặt tên theo số thứ tự kế tiếp của khu và tự nhận bảng giá của khu đó, nên Manager không phải nhập giá cho từng sân. Ngay sau khi lưu, sân mới có lịch 30 phút một slot từ 6 giờ sáng đến 23 giờ."

🖱️ **Làm (chứng minh ràng buộc):** Bấm **Thêm sân** lần nữa, nhập tên `Sân A01`, bấm **Lưu thông tin**. Hệ thống báo « Tên sân "Sân A01" đã tồn tại. Vui lòng chọn tên khác. ». Bấm **Đóng**.

📌 Tên sân là duy nhất.

### 1.3 Cập nhật tình trạng sân
🖱️ **Làm:** Ở **Sân A03**, bấm **Chỉnh sửa**, chọn **Trạng thái: Bảo trì**, bấm **Lưu thông tin**. Sân A03 hiện nhãn **Bảo trì**.

🎤 **Nói:**
> "Giả sử sân A03 cần sửa lưới. Manager chuyển sân sang Bảo trì và trang đặt sân của khách cập nhật ngay, khách không đặt được sân này nữa."

🖱️ **Làm (bảo trì theo từng khung giờ):** Vào **VẬN HÀNH → Lịch sân**, lọc **Ngoài trời**, bấm một ô trống cuối ngày, ví dụ **Sân A01 22:00**, chọn **Bảo trì khung giờ**.

🎤 **Nói:**
> "Nếu chỉ cần bảo trì một khung giờ, ví dụ thay bóng đèn buổi tối, Manager khóa đúng ô đó, các giờ khác của sân vẫn bán bình thường."

📌 Chỉ khóa được **sân không còn đơn sắp tới** và **khung giờ đang trống**. Khung giờ đã có khách đặt thì không khóa được.

### 1.4 Xóa sân
🖱️ **Làm:** Quay lại **Sân & bảng giá**. Ở dòng **Sân A06** vừa tạo, bấm **Ngừng khai thác**, rồi **Xác nhận ngừng**. Toast « Đã xóa hẳn Sân A06 (sân chưa từng có đơn). »

🎤 **Nói:**
> "Thao tác xóa sân có hai mức. Sân chưa từng có đơn, như A06 vừa tạo, được xóa hẳn. Còn sân đã có lịch sử đặt thì hệ thống chỉ **ngừng khai thác**: ẩn khỏi trang đặt sân nhưng giữ nguyên lịch sử đơn và doanh thu để đối soát, khi cần thì **Mở lại** được."

📌 Sân còn đơn đang chơi hoặc sắp tới thì **không** ngừng khai thác được. Ràng buộc này sẽ được chứng minh ở bước 2.4, sau khi anh Khoa đặt Sân A02.

### 1.5 Khách thấy thay đổi ngay
🖱️ **Làm:** *Chrome ẩn danh.* Mở `localhost:3000/dat-san`. Sân A03 hiện **Bảo trì**, ô A01 22:00 hiện **Bảo trì**, Sân A06 không còn trong danh sách.

🎤 **Nói:**
> "Phía khách, mọi thay đổi của Manager có hiệu lực ngay, không cần tải lại dữ liệu hay chờ đồng bộ. Khách chỉ đặt được slot đang trống của sân đang hoạt động."

---

## LUỒNG 2 — Đặt sân, thanh toán cọc, hủy sân, hoàn tiền (~7 phút)

### 2.1 Khách hội viên đăng nhập và chọn giờ
🖱️ **Làm:** *Chrome ẩn danh.* Bấm **Đăng nhập** bằng `demo.hoivien@gmail.com`. Vào **Đặt sân**, chọn hôm nay, **Sân A02**, slot đã chọn ở bước chuẩn bị (ví dụ 12:00), kéo thêm cho đủ **1 giờ**. **Không** tick Thuê trọng tài, vì trọng tài sẽ được thêm lúc check-in ở Luồng 3.

🎤 **Nói:**
> "Đây là anh Khoa, hội viên hạng Masters. Anh chọn sân A02 lúc 12 giờ, chơi một tiếng. Các ô giờ trên cùng một sân phải liền nhau, và một đơn được đặt tối đa 3 sân."

### 2.2 Báo giá
🖱️ **Làm:** Chỉ vào khung tóm tắt: **Tiền sân**, **Ưu đãi hạng Masters (−5%)**, rồi **Tổng tiền** và **Cọc 50%**.

🎤 **Nói:**
> "Hệ thống tự áp ưu đãi theo hạng thành viên. Nếu khách có voucher hoặc muốn dùng điểm, thứ tự trừ luôn là **hạng → voucher → điểm**. Điểm quy đổi 100 điểm = 10.000₫, tối thiểu 100 điểm, và chỉ được trừ tối đa 50% tiền sân. Khách chỉ cần trả trước 50% tiền cọc."

### 2.3 Giữ chỗ và thanh toán cọc online
🖱️ **Làm:** Bấm **Tiếp tục thanh toán**. Đơn chuyển sang **Đang giữ chỗ** với đồng hồ **5:00**. Chọn **Chuyển khoản VietQR**, rồi trong hộp QR bấm **⚡ Giả lập MB Bank chuyển đủ (…)**. Màn hình hiện « KHOẢN CHUYỂN ĐÃ XÁC MINH ». Bấm **Xem đơn hàng của tôi**: đơn **Đã xác nhận**. Mở **🎫 Xem Vé Điện Tử & Mã QR Check-in** và **ghi lại mã `CT-xxxxxxxx`** để dùng ở Luồng 3.

🎤 **Nói:**
> "Khi bấm thanh toán, slot bị khóa 5 phút cho riêng khách này, nên khách khác không đặt chồng được. Nếu quá 5 phút chưa trả, đơn tự hết hạn và nhả sân.
> Ở đây em giả lập ngân hàng gửi webhook. Backend kiểm tra chữ ký HMAC, tài khoản nhận, mã giao dịch và số tiền rồi mới xác nhận. Cùng một giao dịch gửi lại lần hai cũng không bị ghi nhận hai lần. Đơn chuyển sang Đã xác nhận, khách nhận vé điện tử có mã QR để check-in."

📌 *(Tùy chọn, nếu còn thời gian.)* Cửa sổ thứ hai mở đúng slot này và bấm thanh toán, hệ thống báo « Sân A02 … vừa được khách khác giữ chỗ. Vui lòng chọn giờ khác. »

### 2.4 Chứng minh ràng buộc "không xóa hay bảo trì sân đã bán"
🖱️ **Làm:** *Chrome thường (Manager).* Vào **Sân & bảng giá**, mở **Sân A02**, chọn **Bảo trì**, bấm **Lưu thông tin**. Hệ thống báo « Không thể chuyển sân sang trạng thái tạm ngưng: sân còn 1 đơn sắp tới (CT-xxxxxxxx · Nguyễn Minh Khoa · …) ». Bấm **Ngừng khai thác** ở A02 cũng bị chặn tương tự.

🎤 **Nói:**
> "Đây là ràng buộc em đã nhắc ở Luồng 1: sân đã bán cho khách thì Manager không khóa hay xóa được. Muốn làm thì phải đổi lịch hoặc hủy đơn của khách trước, để không bao giờ có khách đến mà không có sân."

### 2.5 Khách thứ hai đặt sân và trả cọc tại quầy
🖱️ **Làm:** *Chrome ẩn danh.* Bấm **Đăng xuất**, rồi **Đăng nhập** bằng `demo.khach@gmail.com`. Vào **Đặt sân**, chọn **2 ngày sau hôm nay**, **Sân B01**, 19:00–20:00.
- Nhập mã `WELCOME`. Hệ thống báo « Mã chào mừng chung 'WELCOME' đã đóng. Vui lòng sử dụng mã voucher cá nhân (WELCOME-XXXX) được tặng trong ví Ưu đãi của bạn. »
- Chọn **BDAY-CHALLENGER-60K**. Tổng tiền **308.600₫**, cọc **154.300₫**.
- Bấm **Tiếp tục thanh toán**, chọn **Tiền mặt tại quầy**.

🎤 **Nói:**
> "Chị Trang hạng Challenger đặt sân trong nhà cho hai ngày sau. Mã chung WELCOME đã đóng để tránh lạm dụng, nên khách dùng mã cá nhân trong ví: voucher sinh nhật giảm 60.000₫. Từ 380.000₫ tiền sân, trừ ưu đãi hạng rồi trừ voucher, còn 308.600₫. Chị chọn trả cọc tiền mặt tại quầy."

🖱️ **Làm:** *Edge (Staff).* Vào **Đơn đặt sân**, mở đơn của **Phạm Thu Trang**, thu cọc tiền mặt **154.300₫**. Đơn chuyển sang **Đã xác nhận**.

📌 Staff phải thu cọc trước khi hết 5 phút giữ chỗ và không thu vượt số còn thiếu (« Thu vượt số tiền còn thiếu »).

### 2.6 Khách hủy sân
🖱️ **Làm:** *Chrome ẩn danh (Trang).* Vào **Đơn của tôi**, mở đơn B01, bấm **Hủy đơn**. Hộp xác nhận hiện « Hủy trước giờ chơi trên 24 tiếng: Hoàn lại 100% tiền cọc. ». Bấm **Xác nhận hủy**. Đơn chuyển sang **Đã hủy**, trạng thái **chờ hoàn 154.300₫**.

🎤 **Nói:**
> "Chị Trang có việc đột xuất nên hủy. Trước khi xác nhận, hệ thống cho khách biết rõ sẽ được hoàn bao nhiêu theo chính sách 3 mức: hủy trước 24 giờ hoàn 100%, từ 12 đến 24 giờ hoàn 50%, dưới 12 giờ không hoàn. Sân B01 được nhả ngay cho khách khác đặt."

📌 Nếu đơn có dùng điểm, điểm được trả lại ngay khi hủy. Khách vắng mặt không báo (no-show) thì không được trả điểm.

### 2.7 Hoàn tiền
🖱️ **Làm:** *Edge (Staff).* Vào **Thu tiền & hoàn tiền**, tab **Đơn cần hoàn tiền**, mở đơn chị Trang, bấm **Hoàn tiền ngay**. Số đề xuất là **154.300₫** (100% cọc). Bấm **Xác nhận đã chuyển khoản / hoàn tiền**.

🎤 **Nói:**
> "Đơn hủy tự vào hàng chờ hoàn tiền, kèm số tiền đề xuất đúng theo chính sách. Staff xác nhận đã chuyển trả khách, hệ thống ghi giao dịch hoàn kèm người thực hiện và lý do."

🖱️ **Làm (chứng minh ràng buộc):**
1. Bấm hoàn tiếp trên đơn này. Hệ thống báo « Tổng hoàn vượt số tiền đã thu còn lại ».
2. Mở đơn mẫu **#92929292**, nhập hoàn **240.000₫**. Hệ thống báo « Staff chỉ hoàn tối đa 120.000₫ theo chính sách. Khoản vượt mức cần Manager duyệt. ». Bấm **Hủy**.

🎤 **Nói:**
> "Có hai lớp chặn: không bao giờ hoàn quá số tiền đã thu, và Staff chỉ hoàn trong phạm vi chính sách. Khoản vượt mức phải được Manager duyệt, nên tiền ra khỏi quỹ luôn có kiểm soát."

---

## LUỒNG 3 — Check-in, thêm trọng tài, gia hạn, check-out, feedback, voucher (~8 phút)

### 3.1 Check-in bằng mã QR
🖱️ **Làm:** *Edge (Staff).* Bấm **Quét QR Check-in**, chọn **Nhập mã / Máy quét**, nhập `CT-xxxxxxxx` (mã anh Khoa ghi ở 2.3), bấm **Check-in**. Màn hình hiện « CHECK-IN TỰ ĐỘNG THÀNH CÔNG! » kèm tên khách, hạng, sân và giờ.

🎤 **Nói:**
> "Anh Khoa đến quầy và đưa vé QR. Staff quét mã, hệ thống kiểm tra vé hợp lệ, đã đóng cọc và đúng khung giờ rồi check-in tự động."

📌 Check-in được trong khoảng **30 phút trước đến 15 phút sau** giờ bắt đầu. Ngoài khung đó, hệ thống báo « Chưa tới giờ check-in (từ hh:mm…). Nhập lý do ngoại lệ để tiếp tục. »: Staff phải nhập lý do (ít nhất 5 ký tự) và thao tác được ghi nhật ký.

### 3.2 Thêm dịch vụ trọng tài ngay lúc check-in
🖱️ **Làm:** Bấm **Xem chi tiết đơn**, rồi **Chọn trọng tài**, rồi **Kiểm tra sân và trọng tài**. Ở từng slot 30 phút, chọn một trọng tài còn trống, ví dụ **TT Bùi Quang Minh · 150.000₫/giờ**. Bấm **Xác nhận phân công**. Tổng đơn tăng thêm **150.000₫** cho 1 giờ.

🎤 **Nói:**
> "Đến sân, anh Khoa muốn đánh tính điểm nên cần trọng tài. Staff thêm dịch vụ ngay trên đơn đang chơi. Danh sách chỉ hiện trọng tài **có ca trực và còn trống** đúng giờ đó, và mỗi slot chỉ một trọng tài, nên không thể xếp một người vào hai sân cùng lúc. Tiền trọng tài cộng thẳng vào đơn và sẽ được thu lúc check-out."

📌 Làm bước này **trước giờ bắt đầu chơi**, khi slot còn ở phía trước.

### 3.3 Gia hạn giờ chơi
🖱️ **Làm:** Trong chi tiết đơn, bấm **⚡ Gia hạn giờ chơi**, chọn **+30 phút** rồi xác nhận. Ví dụ khung trưa: 50.000₫ − ưu đãi Masters 2.500₫ = **47.500₫**. Toast « Đã gia hạn sân thêm 30 phút thành công! »

🎤 **Nói:**
> "Chơi hăng quá, anh Khoa xin thêm 30 phút. Hệ thống kiểm tra slot liền sau trên cùng sân còn trống mới cho gia hạn, và giá gia hạn vẫn được giảm theo hạng hội viên."

📌 Slot liền sau đã có khách đặt thì không gia hạn được.

### 3.4 Check-out
🖱️ **Làm:** *"Giả định anh Khoa đã chơi xong."* Bấm **Check-out**. Bảng công nợ hiện:
- Tiền sân
- Phí gia hạn 30 phút
- Tiền trọng tài
- Ưu đãi hạng
- Đã cọc
- **Còn phải thu**

Bấm thu tiền mặt, thấy « TRẠNG THÁI CÔNG NỢ: ĐÃ THANH TOÁN ĐỦ 100% », rồi bấm **Xác nhận Check-out & Giải phóng sân**. Đơn chuyển **Hoàn tất**.

🎤 **Nói:**
> "Lúc check-out, Staff thấy rõ từng khoản: tiền sân, phần gia hạn, trọng tài, trừ phần đã cọc online. Khách chỉ trả nốt phần còn lại, hệ thống không cho thu vượt. Sau khi đủ 100%, sân được giải phóng cho lượt sau."

🖱️ **Làm:** *Chrome ẩn danh (Khoa)*: anh Khoa đã **lên hạng Grand Slam** và được cộng điểm.

🎤 **Nói:**
> "Đơn hoàn tất thì hệ thống mới cộng chi tiêu và điểm. Với đơn này, anh Khoa vượt ngưỡng và lên hạng Grand Slam, kèm điểm thưởng lên hạng. Điểm và hạng chỉ tính trên tiền thực trả, nên hủy đơn hay hoàn tiền đều thu hồi tương ứng."

### 3.5 Khách gửi feedback
🖱️ **Làm:** *Chrome ẩn danh (Khoa).* Mở `/feedback`, chọn **3 sao**, nhập nội dung « Đèn sân A02 hơi tối ở cuối sân, mong CLB kiểm tra. », chọn đơn vừa chơi, bấm **Gửi đánh giá**.

🎤 **Nói:**
> "Chơi xong, anh Khoa đánh giá 3 sao vì đèn hơi tối. Khách chỉ đánh giá được đơn đã hoàn tất của chính mình, nên không có đánh giá ảo."

📌 Đánh giá **từ 3 sao trở xuống** tự vào hàng **Đánh giá thấp cần xử lý**, hạn xử lý 24 giờ.

### 3.6 Xử lý feedback và tặng voucher bù
🖱️ **Làm:** *Edge (Staff).* Vào **Feedback & Đánh giá**, mở **⚠️ Đánh giá thấp cần xử lý**, chọn đánh giá của anh Khoa. Trong phần **Tặng voucher xin lỗi khách hàng**, chọn **Xin lỗi nhẹ (50.000₫)** rồi bấm **🎁 Tặng voucher**. Toast « Đã tặng voucher SORRY-xxxx cho khách hàng (trạng thái: ACTIVE)! » Sau đó:
- **Ghi chú nội bộ / Biện pháp khắc phục**: « Đã báo kỹ thuật thay bóng đèn sân A02 ».
- **Phản hồi gửi đến khách hàng**: lời xin lỗi.

Bấm **Hoàn tất & Đóng ca xử lý**.

🎤 **Nói:**
> "Đánh giá thấp bắt buộc phải xử lý, không để trôi. Staff ghi nguyên nhân, biện pháp khắc phục, phản hồi khách và tặng voucher bù. Staff chỉ chọn được các mẫu cố định: xin lỗi 50.000₫ hoặc giảm 20% tối đa 100.000₫. Mức lớn hơn như 1 giờ sân miễn phí, hoặc voucher **tùy chỉnh**, chỉ Manager được tặng, và phải ghi lý do."

📌 *(Tùy chọn, ở Chrome thường.)* Manager mở cùng màn hình sẽ thấy thêm **1 giờ sân miễn phí** và **✏️ Tuỳ chỉnh (Manager)**. Voucher đã tặng có thể **Thu hồi** kèm lý do.

### 3.7 Khách nhận và dùng mã giảm giá
🖱️ **Làm:** *Chrome ẩn danh (Khoa).*
1. Bấm chuông **Thông báo**: có thông báo xin lỗi kèm mã `SORRY-xxxx`.
2. Mở **ví Ưu đãi**: mã đang hiệu lực 30 ngày.
3. Vào **Đặt sân**, chọn một ngày sau, chọn 1 giờ bất kỳ. Ở **Mã ưu đãi / Voucher**, mã `SORRY-xxxx` hiện màu xanh (đủ điều kiện). Bấm chọn: tóm tắt hiện **Voucher (SORRY-xxxx) −50.000₫**.

Dừng ở đây, không cần giữ chỗ.

🎤 **Nói:**
> "Khách nhận thông báo và mã ngay trong ví. Lần đặt sau, mã giảm giá tự hiện trong danh sách voucher đủ điều kiện. Hệ thống kiểm tra đơn tối thiểu, hạn dùng và giới hạn lượt dùng, rồi trừ đúng 50.000₫. Phản hồi xấu được xử lý thành một lý do để khách quay lại."

📌 Mã dùng một lần cho đúng khách được tặng. Mã không đủ điều kiện hiện 🔒 kèm lý do.

---

## LUỒNG 4 — Dashboard: tiền vào và tiền hoàn bị trừ (~4 phút)

### 4.1 Tiền vào và tiền hoàn trong ngày
🖱️ **Làm:** *Chrome thường (Manager).* Vào **VẬN HÀNH → Thu tiền & hoàn tiền**, bộ chọn kỳ **Theo Ngày** = hôm nay. So với số đã ghi ở bước chuẩn bị:

| Ô | Thay đổi | Lý do |
|---|---|---|
| **Tổng đã thu** | Tăng bằng cọc VietQR của anh Khoa + tiền thu nốt lúc check-out + cọc tiền mặt 154.300₫ của chị Trang | Mọi khoản tiền vào |
| **Tổng đã hoàn** | Tăng **154.300₫** | Khoản hoàn cọc chị Trang ở 2.7 |
| **Thu ròng** | = Tổng đã thu − Tổng đã hoàn | Tiền hoàn bị trừ khỏi doanh thu |

🎤 **Nói:**
> "Toàn bộ tiền phát sinh trong demo đã lên dashboard. Tổng đã thu tăng đúng bằng ba khoản: cọc online và tiền thu nốt của anh Khoa, cọc tiền mặt của chị Trang. Còn khoản 154.300₫ hoàn cho chị Trang **không bị xóa đi** mà ghi thành giao dịch hoàn riêng, vào ô Tổng đã hoàn, và **bị trừ** khỏi Thu ròng. Nhờ vậy vừa thấy được tổng tiền đã vào, vừa thấy tiền thực giữ lại, và vẫn truy vết được từng khoản."

🖱️ **Làm:** Đổi kỳ sang **Tháng này** rồi **Khoảng ngày**. Mỗi ô đều ghi rõ nhãn kỳ.

📌 Mọi con số đều ghi rõ kỳ tính. Tiền mặt ghi theo người thu, để chốt ca thu ngân.

### 4.2 Lịch sử thu và hoàn
🖱️ **Làm:** Tab **Lịch sử hoàn tiền**: có dòng 154.300₫, lý do, người thực hiện, thời điểm. Tab **Đối soát & Ngoại lệ**: các khoản thu thừa và đơn hủy còn giữ tiền.

🎤 **Nói:**
> "Mỗi khoản hoàn có lý do và người chịu trách nhiệm. Tab đối soát gom các ngoại lệ như khách chuyển thừa hay đơn hủy chưa hoàn, để không khoản tiền nào bị treo."

### 4.3 Báo cáo tổng hợp
🖱️ **Làm:** Vào **TRA CỨU → Báo cáo**, cùng kỳ. Chỉ ô **Tổng thực thu ròng** (ghi chú "Thu trừ hoàn (N giao dịch)"), khớp với **Thu ròng** ở 4.1. Tiếp theo:
- Biểu đồ doanh thu và khung giờ cao điểm.
- Công suất 10 sân.
- Báo cáo thành viên (tỷ lệ giữ hạng).

🎤 **Nói:**
> "Trang báo cáo dùng chung một cách tính với trang thu tiền, nên Tổng thực thu ròng khớp đúng với Thu ròng. Manager xem được khung giờ nào đông, sân nào hiệu suất thấp, và tỷ lệ hội viên giữ được hạng để điều chỉnh giá và khuyến mãi."

### 4.4 Truy vết và xuất báo cáo
🖱️ **Làm:** Trong danh sách đơn của kỳ, tìm đơn anh Khoa (**Hoàn tất**, có trọng tài và gia hạn) và đơn chị Trang (**Đã hủy**, đã hoàn). Bấm **Xuất báo cáo CSV** hoặc **In / Xuất PDF Báo Cáo**.

🎤 **Nói:**
> "Từ một con số trên dashboard, Manager lần ngược được đến từng đơn, từng giao dịch thu và hoàn trong demo, rồi xuất ra CSV hoặc PDF để kế toán đối chiếu."

---

## Kết (~1 phút)

🎤 **Nói:**
> "Tóm lại, qua 4 luồng nhóm em đã trình bày trọn vòng đời một lượt chơi:
> 1. Manager quản lý sân với ràng buộc chặt: không xóa hay khóa sân đã bán.
> 2. Khách đặt sân, giữ chỗ 5 phút, đặt cọc online có xác minh, và được hoàn tiền tự động theo chính sách khi hủy.
> 3. Tại sân: check-in bằng QR, thêm trọng tài, gia hạn, check-out minh bạch công nợ, và phản hồi xấu được xử lý bằng voucher bù.
> 4. Toàn bộ tiền vào và tiền hoàn hiện trên dashboard, khớp giữa các trang và truy vết được.
>
> Em xin cảm ơn thầy cô đã lắng nghe, nhóm em sẵn sàng nhận câu hỏi."

**Sau buổi demo:** chạy `.\reset-demo.ps1`, hoặc vào **Hệ thống & module → Đặt lại dữ liệu mẫu Hội đồng**.

---

## Phụ lục A — Phương án dự phòng

| Tình huống | Cách xử lý |
|---|---|
| Hôm nay không còn slot cách 20–30 phút | Đặt slot sớm nhất ngày mai. Ở 3.1, check-in sẽ bị báo « Chưa tới giờ check-in… ». Nhập lý do « Demo hội đồng, khách đến sớm », và nói thêm đây chính là luồng check-in ngoại lệ có ghi nhật ký. |
| Không còn trọng tài trống ở 3.2 | Chỉ vào dòng « Không có trọng tài có lịch làm việc và còn trống giờ này » và giải thích ràng buộc ca trực, rồi đi tiếp. |
| Slot liền sau đã có khách ở 3.3 | Gia hạn bị chặn. Giải thích ràng buộc "chỉ gia hạn khi slot liền sau trống". |
| Đã quá 5 phút giữ chỗ ở 2.5 | Đơn hết hạn. Đặt lại, rồi giải thích cơ chế tự nhả sân. |
| Lỡ thao tác sai dữ liệu | Chạy `.\reset-demo.ps1` (khoảng 10 giây), rồi làm lại từ luồng đang dở. |

## Phụ lục B — Câu hỏi hội đồng hay hỏi

| Câu hỏi | Gợi ý trả lời |
|---|---|
| Hai khách cùng bấm một slot thì sao? | Slot bị khóa ở mức cơ sở dữ liệu khi giữ chỗ. Người đến sau nhận lỗi 409 `SLOT_TAKEN`, kèm gợi ý sân khác cùng khu. |
| Khách dùng 40 điểm thì sao? | Không được trừ, vì tối thiểu là 100 điểm (= 10.000₫) và phải là bội số của 10. Giao diện báo đỏ ngay, điểm của khách không bị trừ. |
| Hủy đơn đã dùng điểm thì điểm đi đâu? | Hoàn lại đúng số điểm đã dùng. Nếu Manager khôi phục đơn thì trừ lại; nếu khách không đủ điểm, đơn được khôi phục nhưng không còn giảm giá bằng điểm. |
| Hoàn tiền một đơn đã hoàn tất thì điểm và hạng ra sao? | Điểm đã cộng bị thu hồi theo tỷ lệ tiền hoàn, chi tiêu tích lũy giảm tương ứng, và số dư điểm không bao giờ âm. |
| Tiền hoàn có làm sai doanh thu không? | Không. Tiền hoàn là giao dịch riêng, nằm ở ô Tổng đã hoàn và được trừ trong Thu ròng; Tổng đã thu vẫn giữ nguyên lịch sử. |
| Staff có tự tặng voucher lớn được không? | Không. Staff chỉ dùng mẫu cố định (50.000₫ hoặc 20% tối đa 100.000₫). Voucher 1 giờ sân miễn phí và voucher tùy chỉnh chỉ Manager tặng, bắt buộc có lý do và được ghi nhật ký. |
