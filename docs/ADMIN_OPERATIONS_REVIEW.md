# Rà soát vận hành admin — 23/10/2026

Đối chiếu trên `95a7805` và thay đổi ngừng dịch vụ phụ trong đợt này. Phân biệt phát hiện qua đọc code với kiểm thử chạy thật; dữ liệu kiểm thử nằm ở database riêng, không phải Docker của người dùng.

## Đã xử lý theo yêu cầu mới

Bỏ bán nước, thuê/trả thiết bị, quản lý tồn kho và các điểm thêm sản phẩm khỏi UI/API. Chỉ trọng tài được chọn làm dịch vụ cho đơn sân và trận đấu. V8 chặn ghi thêm dòng hàng hóa, giữ nguyên dòng lịch sử và chứng từ. Dữ liệu mẫu mới không có hàng hóa; phân công trọng tài một giờ bao phủ đủ hai slot nửa giờ. Danh mục nhân sự nội bộ vẫn là phần quản lý nhân sự, không phải danh sách dịch vụ được bán.

## Các vấn đề vận hành còn lại, chưa sửa trong thay đổi này

### P1 — Thanh toán chuyển khoản tại quầy không khớp backend

`frontend/src/components/OrderDialogs.jsx` vẫn cho chọn BANK_TRANSFER và hiển thị QR có ngân hàng/tài khoản cố định. Nội dung QR tự ghép từ mã đơn thay vì lấy payment intent. Trong khi đó `backend/src/main/java/com/courtly/controller/PaymentController.java` chỉ cho POST khoản thu CASH; chuyển khoản phải đi qua webhook.

Vì vậy nút xác nhận chuyển khoản ở form admin bị từ chối. QR cũng không phản ánh cấu hình ngân hàng thực tế và không có bảo đảm đối soát đúng intent. Đây là phát hiện từ đối chiếu code; không thực hiện chuyển tiền thật. Cần dùng chung luồng tạo intent/QR và trạng thái xác minh với backend, còn form thu tiền mặt chỉ ghi tiền mặt. `PaymentsPage.jsx` cũng đang khẳng định webhook MB Bank hoạt động bằng dòng chữ cố định, không kiểm tra chế độ/cấu hình thực tế.

### P1 — Thu tiền, đối chiếu ngày và báo cáo bỏ sót membership

`PaymentsPage.jsx` và bản in đối chiếu trong `DialogHost.jsx` chỉ cộng `data.payments`. `ReportsPage.jsx` tìm `MEMBERSHIP_FEE` trong cùng mảng này. Nhưng `MembershipService.view()` trả biên lai hội viên ở `membershipPayments` riêng.

Hậu quả: thu hội viên không được tính vào các tổng trên, số web không khớp số thực nhận. Kịch bản trên bản trước có 6 biên lai tổng 2.394.000đ bị bỏ; cấu trúc dữ liệu và cách cộng vẫn còn ở bản mới. Cần hợp nhất nguồn biên lai theo loại/mã, tránh đếm trùng, rồi dùng chung cho bảng thu và bản in.

### P2 — Công suất sân tính sai khi dùng slot 30 phút

`ReportsPage.jsx` đếm số slot nhưng chia cho `17 * số ngày`. Một slot nửa giờ chiếm khoảng 3% ngày 17 giờ, hiện tính khoảng 6%. Bản mới giới hạn phần trăm ở 100%, nhưng phép tính vẫn gấp đôi và che sai số khi vượt mức. Cần cộng số phút sử dụng thực tế, bao gồm lịch giải và các slot cũ dài một giờ.

### P2 — Sửa sân dùng ảnh mặc định bị từ chối

`CatalogService.court()` chỉ chấp nhận HTTPS hoặc `/images/...`, còn sân mẫu dùng `/guest/zone-*.webp`. Giữ nguyên ảnh khi lưu sửa sân sẽ gặp lỗi 400. Đã tái hiện trên bản trước; đoạn validator không thay đổi ở bản mới. Cần cho phép asset nội bộ đang sử dụng bằng danh sách đường dẫn hợp lệ.

### P2 — Chặn bảo trì sân dựa cả vào lịch quá khứ

`CatalogService.court()` xét mọi lịch của sân có trạng thái khác AVAILABLE, không giới hạn tương lai hoặc đơn đang sử dụng. Các lịch lịch sử còn BOOKED/LOCKED/BLOCKED có thể chặn đổi sân sang MAINTENANCE/INACTIVE dù không ảnh hưởng lịch sắp tới. Đây là phát hiện qua đọc code; cần xác định khoảng bảo trì, chỉ kiểm tra xung đột còn hiệu lực và hướng dẫn đổi/hủy đơn bị ảnh hưởng.

## Quy tắc cần hoàn thiện

- Check-out vẫn cho phép còn nợ và dùng COMPLETED để thể hiện đã kết thúc buổi chơi. Công nợ còn nằm ở finance và danh sách cần xử lý; cần quy định quyền cho nợ và thời hạn thu, tránh hiểu COMPLETED là đã thu đủ.
- Chốt ca mới là báo cáo tổng hợp ngày, chưa có mở/đóng/khóa ca, thực thu, chênh lệch và người duyệt.
- Nhân sự hiện vẫn có chức danh REFEREE/COACH/BALL_BOY, chưa đủ năm vai trò đã yêu cầu trước đó. Quyền tài khoản cần tách khỏi chức danh, đặc biệt quyền thu tiền, hoàn tiền và sửa giá. Đợt này chỉ giới hạn dịch vụ được phân công là trọng tài, chưa triển khai lại hệ thống phân quyền.

Kết luận cũ về tổng công nợ cộng âm không áp dụng cho ReportsPage mới, vì trang đã được thay thế. Lỗi thời lượng thuê thiết bị không còn là nghiệp vụ vận hành sau khi tính năng bị gỡ bỏ.

## Kiểm tra thay đổi ngừng dịch vụ phụ

- Build frontend và 12 kiểm thử backend đạt.
- 10 kiểm thử API trên database riêng đạt: đặt 90 phút với 3 slot trọng tài, đúng tiền, chặn catalog và API dịch vụ cũ, đổi/bỏ phân công, rollback khi chọn sai chức danh, thu tiền, check-in/out, phiếu thu và hoàn tiền.
- Đã sửa thao tác sửa phân công: danh sách chọn mới thay thế phân công cũ, có thể bỏ toàn bộ; giữ giá của dòng không đổi và rollback nếu có xung đột.
- Init mới khớp checksum cả 8 migration; dữ liệu mẫu không có đồ uống/thiết bị/dòng hàng hóa.
- Nâng cấp V6 → V8 giữ nguyên 17 dòng lịch sử, tổng đơn 73.595.000đ, tiền đã trả trên đơn 38.650.000đ, tổng biên lai 47.700.000đ và hoàn tiền 2.250.000đ trong bộ dữ liệu thử. Các tổng này thuộc các phạm vi khác nhau, không phải phép đối chiếu tổng thu của toàn ứng dụng.
- Thử ghi trực tiếp một dòng hàng hóa mới vào database bị V8 từ chối.

- Chromium: 16 trang admin, hộp chọn trọng tài và lịch nửa giờ đạt; không còn menu đồ uống/đồ thuê hoặc nút thêm sản phẩm.
