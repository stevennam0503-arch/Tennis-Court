# Thanh toán QR và ngân hàng mô phỏng

## Thử ngay, không cần tài khoản ngân hàng

Đặt `PAYMENT_MODE=SANDBOX` rồi khởi động lại backend. Đăng nhập khách demo, chọn sân và tạo đơn. Hộp thanh toán có QR mô phỏng và các nút **Chuyển đủ**, **Chuyển thiếu**, **Gửi giao dịch lặp**, **Tiền đến sau hết hạn**. QR này không dùng để chuyển tiền qua ứng dụng ngân hàng.

- Nút “Tôi đã chuyển khoản” chỉ đổi sang chờ đối soát, không tăng tiền đã thu.
- Đủ cọc thì xác nhận đơn. Cọc khách hàng bằng 50% tiền sân sau ưu đãi, không gồm trọng tài; phần còn lại thanh toán riêng.
- Gửi lại cùng thông báo không thu tiền hai lần.
- Tiền đến sau hạn hoặc vượt khoản cần thu được ghi nhận để đối soát; không tự lấy lại sân đã nhả hoặc tự hoàn tiền.
- Hội viên chỉ kích hoạt khi đủ toàn bộ phí; chuyển thiếu giữ trạng thái chờ và lần sau chỉ cần trả phần còn thiếu.
- Giải đấu chỉ xác nhận suất khi đủ phí. Luồng quầy/admin vẫn sử dụng màn thu tiền và nghiệp vụ hiện có.

Sandbox là bộ mô phỏng của ứng dụng, không phải tài khoản ngân hàng ảo tại ngân hàng thật. Các API mô phỏng chỉ hoạt động khi backend ở SANDBOX và chỉ trên giao dịch của chính khách đó. Không dùng chế độ này trên hệ thống nhận tiền thật.

## Khi kết nối ngân hàng thật

Đề xuất **VietQR/NAPAS** cho mã chuyển khoản và **SePay webhook** để nhận thông báo giao dịch. Backend tạo payload EMV kèm CRC16; frontend dùng thư viện `qrcode` để vẽ tại chỗ. Không gửi dữ liệu khách tới dịch vụ tạo ảnh QR.

```dotenv
PAYMENT_MODE=LIVE
PAYMENT_BANK_BIN=<BIN ngân hàng 6 chữ số>
PAYMENT_ACCOUNT_NUMBER=<số tài khoản nhận>
PAYMENT_ACCOUNT_NAME=<tên chủ tài khoản>
SEPAY_WEBHOOK_KEY=<khóa ngẫu nhiên riêng, không đưa lên Git>
```

Trong SePay, cấu hình URL HTTPS của ứng dụng: `/api/webhooks/sepay`, phương thức POST, xác thực API key bằng header `Authorization: Apikey <khóa>`. Chọn thông báo tiền vào và đúng tài khoản đã liên kết. Cấu hình cụ thể cần đối chiếu tài khoản/dịch vụ SePay thực tế trước khi mở nhận tiền.

Payload sử dụng các trường `id`, `accountNumber`, `transferType` (`in`), `transferAmount` (VND nguyên dương) và `content` chứa mã `CT` + 16 ký tự hex. Mã được sinh riêng cho từng yêu cầu thanh toán. Backend xác thực khóa, tài khoản, nội dung, số tiền, hạn giữ chỗ, chủ thể giao dịch và trạng thái đơn. Khóa toàn giao dịch và bản ghi `bank-event:sepay:<id>` bảo đảm callback lặp chỉ ghi nhận một lần.

`MANUAL` là chế độ mặc định khi không cấu hình: quầy xác nhận tiền. Có thông tin ngân hàng thì hiển thị VietQR nhưng không nhận callback tự động. Chỉ chuyển sang LIVE sau khi đã kết nối ngân hàng và thử callback trên môi trường staging. Không đổi chế độ trên các đơn test để biến chúng thành giao dịch thật; dùng database riêng.

## Đối soát và giới hạn

Giao dịch không khớp mã, đến muộn hoặc chuyển dư được lưu tại `bank-event:*`; giao dịch có mã tương ứng cập nhật `transfer:*` sang REVIEW. Đơn có tiền cần đối soát xuất hiện theo cơ chế đánh dấu tài chính hiện có. `database/query.sql` có truy vấn các sự kiện cần xử lý, gồm cả tiền không khớp đơn. Chưa thêm một màn đối soát ngân hàng riêng vào admin để giữ nguyên luồng quản trị.

Phiếu thu chính thức nằm ở `payments` hoặc `membership-payment:*`. Tiền chuyển thiếu phí hội viên nằm trong yêu cầu chuyển khoản đến khi đủ phí; hủy gói sau khi đã chuyển thiếu chuyển sang đối soát. Hoàn tiền vẫn do quầy xử lý theo chính sách; chưa có API hoàn tiền ra ngân hàng. Tiền nhận qua quầy được hiển thị trong sổ thu; yêu cầu QR cũ có thể còn chờ/hết hạn và không được coi là chứng từ thu.

Đã kiểm tra hợp đồng webhook bằng HTTP nội bộ với số tài khoản giả: xác thực, callback lặp, chuyển dư, CRC QR và chặn sandbox trong LIVE. Chưa kiểm chứng một giao dịch thật với ngân hàng/SePay, vì chưa có thông tin kết nối thực tế.
