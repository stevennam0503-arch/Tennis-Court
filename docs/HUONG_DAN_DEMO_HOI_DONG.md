# 🎾 KỊCH BẢN TRÌNH DIỄN HỘI ĐỒNG (GOLDEN SHOWCASE) - COURTLY TENNIS CLUB

Tài liệu này được biên soạn để hỗ trợ nhóm trình diễn hệ thống **Courtly** mượt mà, chuyên nghiệp và thuyết phục 100% trước Hội đồng chấm bảo vệ.

---

## ⚡ 1. CÔNG CỤ RESET DỮ LIỆU CHUẨN TRƯỚC VÀ TRONG GIỜ BẢO VỆ (1-CLICK RESET)
Bất cứ khi nào nhóm tập dượt xong (làm bẩn hoặc lệch dữ liệu), hoặc khi đang bảo vệ mà thầy cô Hội đồng yêu cầu: *"Em thử tạo đơn / hủy đơn / đặt lịch xem"*, bạn có thể đưa toàn bộ hệ thống về trạng thái chuẩn chỉ từng con số bằng các cách:

- **Cách 1 (Tuyệt vời nhất - Trực tiếp trên giao diện Admin):** 
  - Đăng nhập tài khoản Admin (`admin@gmail.com` / `123456`; database mới chưa reset lần nào dùng `12345`).
  - Vào menu **Hệ thống & module** $\rightarrow$ Bấm nút **[ 🔄 Đặt lại dữ liệu mẫu Hội đồng ]** ở góc phải tiêu đề hoặc tại tab **"Dữ liệu mẫu Hội đồng"**.
  - Bấm **"Xác nhận đặt lại dữ liệu"** $\rightarrow$ Hệ thống tự động xóa sạch các đơn phát sinh và nạp lại chuẩn 100% trong 1 giây, không cần mở cmd/terminal.
- **Cách 2 (Trên Windows qua file .bat):** Vào thư mục `scripts/`, nhấp đúp chuột vào file **`reset-showcase.bat`**.
- **Cách 3 (Qua Terminal):**
  ```bash
  npm --prefix frontend run demo:reset
  # hoặc
  python scripts/seed_showcase.py
  ```
> ⏱️ Thời gian reset chỉ mất **1 - 2 giây**. Toàn bộ đơn hàng rác bị xóa sạch, thay bằng **17 đơn hàng mẫu** bám theo thời gian thực của ngày hôm nay. Tổng tiền, tiền cọc, phiếu thu và khoản hoàn của mọi đơn được tính lại từ bảng giá hiện hành mỗi lần reset, nên số tiền trên màn hình luôn khớp giá sân; tài liệu này vì vậy không ghi số tiền cố định. Reset cũng khôi phục đủ 10 sân chuẩn và đưa chính sách về giữ chỗ 5 phút, cọc 50%.

---

## 👥 2. DANH SÁCH TÀI KHOẢN TRÌNH DIỄN

> Mỗi lần bấm reset, mật khẩu của các tài khoản mẫu dưới đây được đưa về `123456`. Luôn reset trước khi trình diễn.

| Vai trò | Email đăng nhập | Mật khẩu | Ghi chú & Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@gmail.com` | `123456` | Quản lý toàn bộ hệ thống: Sân, Nhân sự, Báo cáo tài chính, Giải đấu, Cấu hình. |
| **Lễ tân / Thu ngân (Staff)** | `staff@gmail.com` | `123456` | Thao tác tại quầy: Quét QR Check-in, Check-out, Thu tiền mặt, Gia hạn sân. |
| **Tài khoản tự tạo (Live Demo)** | Email bất kỳ (VD: `kietdlv@gmail.com`) | Bạn tự đặt khi tạo | **Tài khoản bạn tự tạo**: Sẽ được **tự động xóa sạch và giải phóng email hoàn toàn** mỗi khi bấm Reset, để bạn tự do biểu diễn quy trình đăng ký tài khoản mới từ đầu trước mặt Hội đồng! |
| **Khách hàng VIP (Hội viên Plus)** | `hoangnam@gmail.com` | `123456` | Khách mẫu sở hữu gói **Plus**: Giảm giá 15% tiền sân, giảm 10% sân VIP; có đơn đang chơi, đã gia hạn và đơn định kỳ 4 tuần. |
| **Khách hàng mới** | `khachmoi@gmail.com` | `123456` | Khách thường (chưa là hội viên), có yêu cầu nâng cấp gói Plus đang chờ duyệt. |

---

## 🎬 3. DANH SÁCH 17 ĐƠN HÀNG MẪU SAU RESET

| Mã đơn | Trạng thái | Sân & khung giờ | Khách hàng | Dùng để demo |
| :--- | :--- | :--- | :--- | :--- |
| **#CT-11111111** | `CHECKED_IN` | Sân A01 · hôm nay, từ giờ reset đến +1,5 giờ | Trần Hoàng Nam (Plus) | Đang chơi, đã cọc 50% tiền sân sau ưu đãi 15%. Demo check-out: hệ thống tính phần còn lại, thu tiền mặt rồi check-out. |
| **#CT-14141414** | `CHECKED_IN` | Sân V01 · hôm nay, 1 giờ trước đến 1 giờ sau | Trần Hoàng Nam (Plus) | Đã gia hạn +30 phút, phí gia hạn bằng giá slot cuối; ưu đãi Plus 10% cho sân VIP. |
| **#CT-12121212** | `CHECKED_IN` | Sân A04 · hôm nay, sắp hết giờ | Lê Thị Thảo (Club) | Cảnh báo sắp hết giờ; ưu đãi Club 10%. |
| **#CT-13131313** | `CHECKED_IN` | Sân B04 · hôm nay, vừa hết giờ | Đặng Hoàng Long | Đơn trong thời gian ân hạn 15 phút, cần check-out. |
| **#CT-22222222** | `CONFIRMED` | Sân B01 · hôm nay 19:00 - 21:00 | Lê Thu Hà | Đã cọc 50%. Demo vé điện tử và quét QR check-in. |
| **#CT-77777777** | `CONFIRMED` | Sân V02 · hôm nay 17:00 - 19:00 | Đặng Hoàng Long | Thuê trọng tài TT Phạm Quốc Huy 2 ca (17:00 - 18:00, 18:00 - 19:00); tổng = tiền sân + phí trọng tài. |
| **#CT-26262626** | `CONFIRMED` | Sân A01 · ngày mai 08:00 - 10:00 | Phạm Minh Đức | Khách đã trả trước 100%. |
| **#CT-33333333** | `HOLDING` | Sân V01 · ngày mai 10:00 - 12:00 | Nguyễn Văn Tuấn (khách lẻ tại quầy) | Giữ chỗ 5 phút tính từ lúc reset; quá hạn thì sân tự nhả. Reset ngay trước khi demo phần này. |
| **#CT-44444444** | `CONFIRMED` | Sân B02 · 16:00 - 18:00, 4 tuần liên tiếp | Trần Hoàng Nam (Plus) | Đặt định kỳ 4 tuần, 16 slot; cọc 50% của cả chuỗi sau ưu đãi 15%. |
| **#CT-81818181** | `CHECKED_IN` | Sân A03 · 2 ngày trước 16:00 - 18:00 | Lê Thị Thảo (Club) | Quá hạn, còn nợ 50%: xuất hiện ở tab đơn chưa thu tiền. |
| **#CT-82828282** | `CHECKED_IN` | Sân V02 · hôm qua 17:00 - 19:00 | Đặng Hoàng Long | Có trọng tài, còn nợ phần còn lại; khách bị chặn đặt đơn mới tới khi trả nợ. |
| **#CT-83838383** | `CHECKED_IN` | Sân A01 · 2 ngày trước 18:00 - 20:00 | Phạm Minh Đức | Đã thu đủ 100% nhưng quên check-out: nằm ở tab cần check-out. |
| **#CT-55555555** | `COMPLETED` | Sân A02 · hôm qua 17:00 - 19:00 | Phạm Minh Đức | Đã hoàn tất, có hóa đơn INV-<ngày hôm qua>-001. Demo in phiếu thu K80/A4. |
| **#CT-91919191** | `CANCELLED` | Sân A02 · tuần sau 17:00 - 19:00 | Vũ Mai Phương | Hủy trước hơn 24 giờ → chờ hoàn 100% cọc (Admin duyệt chi). |
| **#CT-92929292** | `CANCELLED` | Sân B03 · ngày mai 06:00 - 08:00 | Đặng Hoàng Long | Hủy lúc 06:30 hôm nay, 23,5 giờ trước giờ chơi → chờ hoàn 50% cọc. |
| **#CT-93939393** | `CANCELLED` | Sân A03 · hôm nay 11:00 - 13:00 | Lê Thu Hà | Hủy lúc 09:00, 2 giờ trước giờ chơi → không hoàn, CLB giữ 100% cọc. |
| **#CT-66666666** | `CANCELLED` | Sân A03 · 2 ngày trước 18:00 - 20:00 | Vũ Mai Phương | Hủy 16 giờ trước giờ chơi → hoàn 50% cọc, Admin đã chi. Thấy dòng hoàn tiền trong Lịch sử thanh toán. |

--- | :--- | :--- | :--- | :--- |
| **#CT-NOW0001** | `CHECKED_IN` *(Đang chơi)* | **Sân A01**<br>Hôm nay (14:00 - 16:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Gia hạn sân & Thu tiền tại quầy:**<br>1. Vào giao diện Lễ tân $\rightarrow$ Thấy sân A01 đang có khách chơi.<br>2. Bấm **Gia hạn sân (+30 phút)** $\rightarrow$ Sân nối thêm giờ.<br>3. Hoặc bấm **Check-out** $\rightarrow$ Hệ thống tính số tiền còn lại phải thu (170.000đ) $\rightarrow$ Thu tiền mặt. |
| **#CT-CONF002** | `CONFIRMED` *(Đã cọc 50%)* | **Sân B01** *(Trong nhà)*<br>Hôm nay (19:00 - 21:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Vé điện tử & QR Code Check-in:**<br>1. Đăng nhập tài khoản khách $\rightarrow$ Mở mục "Đơn của tôi".<br>2. Bấm **"Vé điện tử & Mã QR Check-in"** $\rightarrow$ Show mã QR sắc nét.<br>3. Đổi sang tab Lễ tân $\rightarrow$ Giả lập quét QR để check-in cho khách vào sân. |
| **#CT-HOLD003** | `HOLDING` *(Giữ chỗ 5 phút)* | **Sân V01** *(VIP Lounge)*<br>Ngày mai (08:00 - 10:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Đồng hồ giữ chỗ & Thanh toán VietQR:**<br>1. Mở đơn $\rightarrow$ Thấy đồng hồ đếm ngược **5:00 phút** theo đúng chính sách CLB.<br>2. Quét mã QR chuyển khoản cọc $\rightarrow$ Đơn lập tức tự động chuyển sang `CONFIRMED`. |
| **#CT-RECUR04** | `CONFIRMED` *(Định kỳ)* | **Sân B02**<br>Chủ nhật hàng tuần (x 4 tuần) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Đặt lịch dài hạn định kỳ 4 tuần:**<br>1. Mở chi tiết đơn $\rightarrow$ Thấy huy hiệu `🔄 Định kỳ 4 tuần`.<br>2. Khung giờ được giữ cố định trên 4 tuần liên tiếp, tiền cọc 50% tính chính xác trên toàn chuỗi tuần. |
| **#CT-DONE005** | `COMPLETED` *(Đã hoàn tất)* | **Sân A02**<br>Hôm qua (17:00 - 19:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Phiếu thu & Hóa đơn điện tử:**<br>1. Mở đơn đã hoàn tất $\rightarrow$ Bấm **"Xem phiếu thu / Hóa đơn"**.<br>2. Xuất hiện hóa đơn điện tử Courtly với đầy đủ mã đơn, thông tin thanh toán, dấu mộc CLB và chữ ký. |
| **#CT-CANC006** | `CANCELLED` *(Đã hủy, đã hoàn)* | **Sân A03**<br>2 ngày trước (18:00 - 20:00) | Vũ Mai Phương | **Demo Chính sách hoàn cọc 3 mốc:**<br>1. Khách hủy lúc 02:00, tức 16 tiếng trước giờ chơi $\rightarrow$ thuộc mốc 12h - 24h: hoàn **50% cọc (100.000đ)**, CLB giữ 100.000đ.<br>2. Mở tab **Lịch sử thanh toán** $\rightarrow$ Thấy dòng hoàn tiền `−100.000đ` kèm badge `✓ Đã hoàn tiền` và lý do.<br>3. So sánh thêm: đơn của Lê Thu Hà hủy dưới 12h bị giữ 100% cọc; các đơn đang chờ hoàn (100% và 50%) nằm ở **Thu tiền & hoàn tiền**. |
| **#CT-REF0007** | `CONFIRMED` *(Có trọng tài)* | **Sân V02**<br>Hôm nay (17:00 - 19:00) | Lê Thu Hà | **Demo Dịch vụ Trọng tài chuyên nghiệp:**<br>1. Phân công Trọng tài TT Phạm Quốc Huy (250.000đ/giờ).<br>2. Hệ thống khóa ca làm việc của trọng tài, tính tổng tiền gồm tiền sân + phí trọng tài. |

---

## 🏆 4. DEMO GIẢI ĐẤU & HỘI VIÊN TRÊN BÁO CÁO DOANH THU

1. **Giải đấu `Courtly Winter Doubles Championship 2026`:**
   - Trạng thái `OPEN`, lệ phí 350.000đ/đội.
   - Có sẵn **4 cặp vận động viên** đã ghi danh và đóng lệ phí.
   - Khi vào **Báo cáo doanh thu Admin**: Mục **"Phí tham gia giải đấu"** hiển thị chính xác **1.400.000đ**.
2. **Gói hội viên:**
   - Trần Hoàng Nam có gói **Plus** (499.000đ): giảm 15% sân thường, 10% sân VIP.
   - Lê Thị Thảo có gói **Club** (249.000đ): giảm 10% sân thường, 5% sân VIP.
   - Lê Thu Hà có yêu cầu nâng cấp Plus đang chờ Admin xác nhận thanh toán.
   - Doanh thu bán gói trong báo cáo là **748.000đ** (499.000đ + 249.000đ).

---

## 🏷️ 5. DEMO ĐỔI GIÁ SÂN (BẢNG GIÁ THEO KHU THỐNG NHẤT)

Khi Hội đồng muốn xem tính năng quản lý và đổi giá sân linh hoạt theo chính sách CLB:

1. **Ghi nhận giá hiện tại:**
   - Đăng nhập tài khoản khách `hoangnam@gmail.com` (mật khẩu `123456`), mở lịch đặt sân ngày mai, ghi lại giá slot 18:00 Sân A01.
   - Mở trang **Bảng giá**, ghi lại giá khung 17:00 – 22:00 khu ngoài trời (OUTDOOR).
2. **Thao tác đổi giá phía Admin:**
   - Đăng nhập tài khoản Admin `admin@gmail.com` $\rightarrow$ Vào mục **Sân & bảng giá** $\rightarrow$ Chọn tab **"Bảng giá theo khu"** $\rightarrow$ Chọn khu **"Ngoài trời"**.
   - Sửa giá khung 17:00 – 22:00 ngày thường, chọn ô **"Áp dụng từ" = hôm nay**.
   - Bấm **"Xem trước"** để đối chiếu bảng giá cũ và mới $\rightarrow$ Bấm **"Lưu thay đổi"**.
   - Hệ thống thông báo số lượng slot còn trống (`AVAILABLE`, `MAINTENANCE`) được cập nhật tức thì.
3. **Kiểm tra kết quả phản ánh đồng bộ:**
   - Tải lại trang Bảng giá công khai và trang Lịch đặt sân của khách hàng: Giá mới hiển thị đồng bộ ở cả hai nơi, kể cả các ngày đã có lịch.
   - *(Ghi chú: Không cần chọn sân mới hay ngày chưa sinh lịch).*
4. **Đối soát tính toàn vẹn dữ liệu với đơn đã đặt:**
   - Mở đơn hàng mẫu đã đặt trước đó trên khu ngoài trời (ví dụ đơn **#CT-26262626**, Sân A01 ngày mai).
   - Đơn **giữ nguyên đơn giá và tổng tiền** tại thời điểm khách đặt lúc trước.
   - $\rightarrow$ **Câu trả lời cho Hội đồng:** *"Giá chốt vào đơn tại thời điểm đặt; đổi bảng giá chỉ áp dụng cho slot còn trống."*
5. **(Tùy chọn) Thử nghiệm ngày áp dụng tương lai:**
   - Lặp lại với **"Áp dụng từ" = tuần sau**: Lịch tuần này giữ giá cũ, lịch từ tuần sau có giá mới.
6. **Sau khi demo:**
   - Bấm **[ 🔄 Đặt lại dữ liệu mẫu Hội đồng ]** để đưa toàn bộ bảng giá và slot về chuẩn.

---

## 💡 6. BÍ QUYẾT TRẢ LỜI CÁC CÂU HỎI HỘI ĐỒNG THƯỜNG HỎI

- **Hội đồng hỏi: *"Hệ thống kiểm soát việc trùng lịch (Double Booking) như thế nào khi nhiều người cùng đặt 1 sân?"***
  $\rightarrow$ **Trả lời:** Hệ thống áp dụng cơ chế khóa bi quan (**Pessimistic Write Lock**) trực tiếp tại tầng cơ sở dữ liệu (`SELECT ... FOR UPDATE`). Khi khách hàng chọn khung giờ, slot được lock lập tức trong transaction, nếu có người khác cùng bấm thì hệ thống sẽ nhận diện xung đột và từ chối an toàn.

- **Hội đồng hỏi: *"Chính sách cọc và hủy lịch hoạt động ra sao?"***
  $\rightarrow$ **Trả lời:** Khách hàng bắt buộc cọc tối thiểu **50% tiền sân** để giữ chỗ. Khi hủy, hệ thống tính số giờ còn lại đến giờ chơi: **từ 24 giờ trở lên hoàn 100% cọc**, **từ 12 đến dưới 24 giờ hoàn 50%**, **dưới 12 giờ không hoàn**. Khoản hoàn không tự chuyển mà vào danh sách chờ để Admin duyệt chi, được lưu vết trong Lịch sử thanh toán và Báo cáo đối soát.
