# Kiểm tra commit e615797 — 28/10/2026

Trường hợp dưới đây đã được sửa ở bản tiếp theo. Xem [thay đổi và kiểm chứng](SAME_DAY_RESTORE_FIX.md).

Đã fetch `origin/nam-dev`: phiên bản mới nhất vẫn là `e615797`. Không có commit mới hơn tại thời điểm rà soát. Các kiểm tra cơ bản đạt, nhưng xác nhận thêm một trường hợp đổi lịch bị chặn sau khôi phục cùng ngày.

## P2 — Đổi lịch bỏ sót chi phí đã chơi khi buổi khôi phục cùng ngày

Điều kiện tái hiện:

1. Đơn có hai buổi định kỳ; buổi đầu 13:00–14:00, tổng tiền 400.000đ.
2. Thu tiền, check-in/check-out buổi đầu; hủy phần lịch còn lại.
3. Khôi phục một giờ mới vào cùng ngày với buổi đã hoàn tất.
4. Đổi giờ chưa chơi sang 15:00–16:00.

Đã thực hiện qua API trên PostgreSQL riêng, đơn kiểm thử `530f4814-6859-4040-9099-56a2454fab3c`, ngày 08/12/2026. Check-in tương lai có lý do ngoại lệ để tái hiện nhanh trên dữ liệu bỏ đi.

Kết quả:

- Sau khôi phục, đơn có 2 slot đã hoàn tất và 2 slot chưa chơi, đều cùng ngày; tổng đúng là **400.000đ**.
- Preview đổi lịch báo **200.000đ**, bỏ tiền sân đã sử dụng trong ngày đó.
- Gửi `expectedTotal=200000` theo preview trả **400**, thông báo “Giá đã thay đổi; vui lòng xem trước lịch mới lại”. Transaction rollback, lịch cũ giữ nguyên.
- Kiểm tra riêng API admin khi không gửi expectedTotal: lịch đổi được và tổng lưu vẫn là **400.000đ**. Vì giao diện gửi expectedTotal từ preview, luồng bình thường bị chặn; chưa ghi nhận mất tiền hoặc mất slot trong tình huống này.

Nguyên nhân:

- `backend/src/main/java/com/courtly/service/BookingSupportService.java:238` và `:243`: khi đổi lịch, preview chỉ giữ các dòng khác ngày đang đổi, nên loại cả dòng sân/trọng tài đã hoàn tất trong cùng ngày. Tổng thực tế vẫn giữ các dòng `completed_at`, dẫn đến chênh lệch.
- `frontend/src/components/MoveDialog.jsx:10`: lọc slot theo ngày nhưng không loại slot đã hoàn tất. Đọc code đối chiếu dữ liệu API cho thấy form sẽ cộng cả hai giờ và lấy giờ bắt đầu của buổi cũ đã chơi; phần này chưa chạy trình duyệt lại trong lượt này.

Hướng sửa: preview luôn giữ các dòng đã hoàn tất bất kể ngày; phần chỉnh giờ/phân công chỉ lấy các slot chưa hoàn tất của buổi đang đổi. Khi sửa trọng tài cần giữ nguyên phí và phân công lịch sử. Thêm hồi quy cho hoàn tất → hủy phần còn lại → khôi phục cùng ngày → đổi giờ/phân công.

## Kiểm tra đạt

- **57 test Java** (`mvn test`).
- **4 bộ test JavaScript** về ngày chơi, báo cáo, chọn giờ và định giá.
- Frontend production build thành công; vẫn có cảnh báo bundle lớn.
- **18 kiểm tra API** đơn định kỳ và bảo mật trên database test riêng.
- Backend xác minh schema **V13** và khởi động thành công.

Lượt này không chạy lại toàn bộ 43 tình huống API hay các trang trình duyệt của lần xác minh trước. Không kiểm tra Docker/database trên máy người dùng, SMTP thật hoặc ngân hàng thật. Chỉ tạo báo cáo và dữ liệu kiểm thử; mã ứng dụng không thay đổi.
