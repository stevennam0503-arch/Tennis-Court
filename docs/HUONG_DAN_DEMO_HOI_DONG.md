# 🎾 KỊCH BẢN TRÌNH DIỄN HỘI ĐỒNG (GOLDEN SHOWCASE) - COURTLY TENNIS CLUB

Tài liệu này được biên soạn để hỗ trợ nhóm trình diễn hệ thống **Courtly** mượt mà, chuyên nghiệp và thuyết phục 100% trước Hội đồng chấm bảo vệ.

---

## ⚡ 1. CÔNG CỤ RESET DỮ LIỆU CHUẨN TRƯỚC VÀ TRONG GIỜ BẢO VỆ (1-CLICK RESET)
Bất cứ khi nào nhóm tập dượt xong (làm bẩn hoặc lệch dữ liệu), hoặc khi đang bảo vệ mà thầy cô Hội đồng yêu cầu: *"Em thử tạo đơn / hủy đơn / đặt lịch xem"*, bạn có thể đưa toàn bộ hệ thống về trạng thái chuẩn chỉ từng con số bằng các cách:

- **Cách 1 (Tuyệt vời nhất - Trực tiếp trên giao diện Admin):** 
  - Đăng nhập tài khoản Admin (`admin@gmail.com` / `12345`).
  - Vào menu **Hệ thống & module** $\rightarrow$ Bấm nút **[ 🔄 Đặt lại dữ liệu mẫu Hội đồng ]** ở góc phải tiêu đề hoặc tại tab **"Dữ liệu mẫu Hội đồng"**.
  - Bấm **"Xác nhận đặt lại dữ liệu"** $\rightarrow$ Hệ thống tự động xóa sạch các đơn phát sinh và nạp lại chuẩn 100% trong 1 giây, không cần mở cmd/terminal.
- **Cách 2 (Trên Windows qua file .bat):** Vào thư mục `scripts/`, nhấp đúp chuột vào file **`reset-showcase.bat`**.
- **Cách 3 (Qua Terminal):**
  ```bash
  npm --prefix frontend run demo:reset
  # hoặc
  python scripts/seed_showcase.py
  ```
> ⏱️ Thời gian reset chỉ mất **1 - 2 giây**. Toàn bộ đơn hàng rác bị xóa sạch, thay bằng **7 đơn hàng mẫu chuẩn** tương thích với thời gian thực của ngày hôm nay.

---

## 👥 2. DANH SÁCH TÀI KHOẢN TRÌNH DIỄN

| Vai trò | Email đăng nhập | Mật khẩu | Ghi chú & Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@gmail.com` | `12345` | Quản lý toàn bộ hệ thống: Sân, Nhân sự, Báo cáo tài chính, Giải đấu, Cấu hình. |
| **Lễ tân / Thu ngân (Staff)** | `staff@gmail.com` | `12345` | Thao tác tại quầy: Quét QR Check-in, Check-out, Thu tiền mặt, Gia hạn sân. |
| **Tài khoản tự tạo (Live Demo)** | Email bất kỳ (VD: `kietdlv@gmail.com`) | Bạn tự đặt khi tạo | **Tài khoản bạn tự tạo**: Sẽ được **tự động xóa sạch và giải phóng email hoàn toàn** mỗi khi bấm Reset, để bạn tự do biểu diễn quy trình đăng ký tài khoản mới từ đầu trước mặt Hội đồng! |
| **Khách hàng VIP (Hội viên Plus)** | `hoangnam@gmail.com` | `1234567890123` | Khách mẫu sở hữu gói **Plus**: Giảm giá 15% tiền sân, chứa các đơn mẫu Checked-in, Confirmed, Định kỳ, Hoàn tất, Hủy. |
| **Khách hàng mới** | `khachmoi@gmail.com` | `1234567890123` | Khách sở hữu đơn #CT-REF0007 (thuê trọng tài). |

---

## 🎬 3. KỊCH BẢN SHOWCASE 7 ĐƠN HÀNG MẪU (BAO QUÁT 100% NGHIỆP VỤ)

| Mã đơn | Trạng thái | Sân & Khung giờ | Khách hàng | Kịch bản demo cho Hội đồng |
| :--- | :--- | :--- | :--- | :--- |
| **#CT-NOW0001** | `CHECKED_IN` *(Đang chơi)* | **Sân A01**<br>Hôm nay (14:00 - 16:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Gia hạn sân & Thu tiền tại quầy:**<br>1. Vào giao diện Lễ tân $\rightarrow$ Thấy sân A01 đang có khách chơi.<br>2. Bấm **Gia hạn sân (+30 phút)** $\rightarrow$ Sân nối thêm giờ.<br>3. Hoặc bấm **Check-out** $\rightarrow$ Hệ thống tính số tiền còn lại phải thu (170.000đ) $\rightarrow$ Thu tiền mặt. |
| **#CT-CONF002** | `CONFIRMED` *(Đã cọc 50%)* | **Sân B01** *(Trong nhà)*<br>Hôm nay (19:00 - 21:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Vé điện tử & QR Code Check-in:**<br>1. Đăng nhập tài khoản khách $\rightarrow$ Mở mục "Đơn của tôi".<br>2. Bấm **"Vé điện tử & Mã QR Check-in"** $\rightarrow$ Show mã QR sắc nét.<br>3. Đổi sang tab Lễ tân $\rightarrow$ Giả lập quét QR để check-in cho khách vào sân. |
| **#CT-HOLD003** | `HOLDING` *(Giữ chỗ 5 phút)* | **Sân V01** *(VIP Lounge)*<br>Ngày mai (08:00 - 10:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Đồng hồ giữ chỗ & Thanh toán VietQR:**<br>1. Mở đơn $\rightarrow$ Thấy đồng hồ đếm ngược **5:00 phút** theo đúng chính sách CLB.<br>2. Quét mã QR chuyển khoản cọc $\rightarrow$ Đơn lập tức tự động chuyển sang `CONFIRMED`. |
| **#CT-RECUR04** | `CONFIRMED` *(Định kỳ)* | **Sân B02**<br>Chủ nhật hàng tuần (x 4 tuần) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Đặt lịch dài hạn định kỳ 4 tuần:**<br>1. Mở chi tiết đơn $\rightarrow$ Thấy huy hiệu `🔄 Định kỳ 4 tuần`.<br>2. Khung giờ được giữ cố định trên 4 tuần liên tiếp, tiền cọc 50% tính chính xác trên toàn chuỗi tuần. |
| **#CT-DONE005** | `COMPLETED` *(Đã hoàn tất)* | **Sân A02**<br>Hôm qua (17:00 - 19:00) | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Phiếu thu & Hóa đơn điện tử:**<br>1. Mở đơn đã hoàn tất $\rightarrow$ Bấm **"Xem phiếu thu / Hóa đơn"**.<br>2. Xuất hiện hóa đơn điện tử Courtly với đầy đủ mã đơn, thông tin thanh toán, dấu mộc CLB và chữ ký. |
| **#CT-CANC006** | `CANCELLED` *(Đã hủy)* | **Sân A03**<br>2 ngày trước | Trần Hoàng Nam *(Hội viên Plus)* | **Demo Chính sách Hoàn tiền & Minh bạch tài chính:**<br>1. Khách hủy lịch trước 24h $\rightarrow$ Hệ thống tự động hoàn 70% cọc (140.000đ) và giữ lại 30% phí (60.000đ).<br>2. Mở tab **Lịch sử thanh toán** $\rightarrow$ Thấy dòng hoàn tiền màu đỏ `−140.000đ` kèm badge `✓ Đã hoàn tiền` và lý do rõ ràng. |
| **#CT-REF0007** | `CONFIRMED` *(Có trọng tài)* | **Sân V02**<br>Hôm nay (17:00 - 19:00) | Lê Thu Hà | **Demo Dịch vụ Trọng tài chuyên nghiệp:**<br>1. Phân công Trọng tài TT Phạm Quốc Huy (250.000đ/giờ).<br>2. Hệ thống khóa ca làm việc của trọng tài, tính tổng tiền gồm tiền sân + phí trọng tài. |

---

## 🏆 4. DEMO GIẢI ĐẤU & HỘI VIÊN TRÊN BÁO CÁO DOANH THU

1. **Giải đấu `Courtly Winter Doubles Championship 2026`:**
   - Trạng thái `OPEN`, lệ phí 350.000đ/đội.
   - Có sẵn **4 cặp vận động viên** đã ghi danh và đóng lệ phí.
   - Khi vào **Báo cáo doanh thu Admin**: Mục **"Phí tham gia giải đấu"** hiển thị chính xác **1.400.000đ**.
2. **Gói Hội viên VIP Plus của Kiet Nguyen:**
   - Khi khách đặt sân, hệ thống tự động nhận diện và chiết khấu **15%**.
   - Doanh thu bán gói được ghi nhận chuẩn **499.000đ** trong cơ cấu doanh thu dịch vụ.

---

## 💡 5. BÍ QUYẾT TRẢ LỜI CÁC CÂU HỎI HỘI ĐỒNG THƯỜNG HỎI

- **Hội đồng hỏi: *"Hệ thống kiểm soát việc trùng lịch (Double Booking) như thế nào khi nhiều người cùng đặt 1 sân?"***
  $\rightarrow$ **Trả lời:** Hệ thống áp dụng cơ chế khóa bi quan (**Pessimistic Write Lock**) trực tiếp tại tầng cơ sở dữ liệu (`SELECT ... FOR UPDATE`). Khi khách hàng chọn khung giờ, slot được lock lập tức trong transaction, nếu có người khác cùng bấm thì hệ thống sẽ nhận diện xung đột và từ chối an toàn.

- **Hội đồng hỏi: *"Chính sách cọc và hủy lịch hoạt động ra sao?"***
  $\rightarrow$ **Trả lời:** Khách hàng bắt buộc cọc tối thiểu **50% tiền sân** để giữ chỗ. Nếu hủy trước 24 giờ, hệ thống hoàn lại **70% tiền cọc**; nếu hủy sát giờ hoặc không đến sân, tiền cọc sẽ không được hoàn trả theo quy định CLB. Khoản hoàn được lưu vết đầy đủ trong Lịch sử thanh toán và Báo cáo đối soát.
