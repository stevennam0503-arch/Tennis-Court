# Luồng khách hàng: bảng giá, giữ chỗ, hủy/đổi và thanh toán

## Điều hướng và bảng giá

Thanh điều hướng có Bảng giá, Đặt sân, Giải đấu và Hội viên. Hội viên là mục riêng để khách xem quyền lợi và đăng ký, không phải tìm trong phần giới thiệu.

`/bang-gia` đọc dữ liệu thật của CLB qua API, gồm:

- Bảng sân ngoài trời, trong nhà và VIP; mỗi loại có nút **Đặt sân ngay**. Bấm VIP mở `/dat-san` với bộ lọc VIP; có thể đổi bộ lọc hoặc chọn Tất cả.
- Hai cột giá Thứ 2–6 và Thứ 7–CN, chia theo các mốc giờ đã cấu hình trong `court_prices`. Khoảng chưa có giá riêng dùng `base_price`, giống cách backend tạo lịch. Không tự đặt thêm phụ phí cuối tuần: nếu CLB chưa cấu hình giá riêng thì hai cột có thể bằng nhau.
- Giá trọng tài đang hoạt động, không công khai số điện thoại/lịch làm việc của nhân viên.
- Tiền cọc, thời gian giữ chỗ, hạn hủy/đổi, tỷ lệ tiền dự kiến hoàn và cách xử lý khoản hoàn.

Giá sân sử dụng đơn vị VND/giờ. Khung đặt sân là 30 phút; API giữ đúng cả mốc giá có phút, ví dụ 17:30. Ưu đãi hội viên chỉ áp dụng theo báo giá backend.

## Đăng nhập và tạo đơn

Khách chưa đăng nhập được xem sân và chọn giờ, nhưng nút tiếp tục mở đăng nhập, không tạo đơn mẫu. Sau đăng nhập, lựa chọn vẫn còn để khách xác nhận.

API `/api/orders` yêu cầu phiên đăng nhập và CSRF. Với khách hàng, server lấy tài khoản, họ tên và số điện thoại từ phiên; không tin `accountId` mà trình duyệt gửi. API chặn thao tác trên đơn của khách khác. Vì thế đơn được gắn với đúng tài khoản để theo dõi lịch, tiền và lịch sử thay đổi.

## Giữ chỗ và chống đặt trùng

Khi xác nhận tạo đơn, server khóa các dòng lịch trong transaction, kiểm tra lại tình trạng trống và tạo đơn `HOLDING`. Các khung giờ chuyển sang `LOCKED` ngay, không chờ `CONFIRMED`.

Thời gian giữ mặc định mới là **5 phút**. Migration V7 chuyển giá trị mặc định cũ 10 phút thành 5 phút, giữ các thời gian khác đã cấu hình. Admin có thể chỉnh trong Hệ thống → Chính sách giữ chỗ. Đồng hồ đếm ngược hiển thị trong Đơn của tôi; giao diện cập nhật định kỳ và backend vẫn là nguồn quyết định.

Hết hạn mà chưa thu đủ cọc, backend chuyển đơn thành `EXPIRED` và giải phóng lịch. Có tác vụ dọn định kỳ; lệnh tạo đơn mới cũng dọn các lượt giữ đã hết hạn trước khi kiểm tra sân. Hai request đồng thời cùng khung giờ chỉ một request được tạo đơn thành công. Chỉ chọn giờ trên trình duyệt chưa giữ sân.

Cọc khách hàng bằng **50% tiền sân sau ưu đãi**, không gồm phí trọng tài. Chỉ khoản thu đã xác minh mới tăng tiền đã trả và có thể chuyển đơn sang `CONFIRMED`.

## Thanh toán và quyền xác nhận

Khách chọn **Tiền mặt tại quầy** hoặc **Chuyển khoản VietQR**.

- Tiền mặt: khách đến quầy trước khi hết thời gian giữ. Tài khoản `STAFF` hoặc `ADMIN` mở `/quay-thu`, chọn đơn, nhập số tiền thực nhận và xác nhận đã nhận tiền. Server kiểm tra quyền, số tiền còn thiếu và mã giao dịch chống ghi lặp. Admin có thể cấp vai trò STAFF trong Tài khoản & phân quyền; STAFF không được cấp quyền tài khoản hoặc duyệt hoàn tiền.
- Chuyển khoản: trình duyệt hiển thị QR được tạo tại chỗ và theo dõi trạng thái. **Tôi đã chuyển khoản** chỉ chuyển yêu cầu sang `CHECKING`, không tăng số tiền đã thu và không gia hạn giữ chỗ.
- Đã bỏ tự đếm ngược duyệt tiền và nút duyệt ngay. `/transfers/{id}/confirm` và đường xác nhận online thủ công cũ trả 403. API thu tại quầy chỉ nhận `CASH`.
- Khi chạy LIVE, webhook SePay phải có khóa xác thực và đúng tài khoản nhận. Kiểm tra nội dung tham chiếu, số tiền, thời hạn và trạng thái đơn trước khi áp dụng. Cùng mã sự kiện chỉ được ghi nhận một lần, kể cả gửi đồng thời.
- Tiền đến muộn, thu vượt hoặc đơn không còn hợp lệ chuyển sang `REVIEW`, không tự giành lại sân hoặc làm tăng tiền đã xác minh của đơn.
- Tạo yêu cầu chuyển khoản mô phỏng và chạy sandbox chỉ cho ADMIN khi môi trường có `PAYMENT_MODE=SANDBOX`. Khách không được gọi mô phỏng; LIVE không chấp nhận mô phỏng, kể cả ADMIN.

LIVE cần `PAYMENT_MODE=LIVE`, `PAYMENT_BANK_BIN`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_ACCOUNT_NAME`, `SEPAY_WEBHOOK_KEY` và webhook HTTPS của hệ thống được đăng ký với SePay. Nhập khóa qua cấu hình bảo mật của nơi triển khai; không đưa vào source hoặc chat. Chưa có thông tin ngân hàng hoặc chưa bật LIVE và xác minh webhook thì khách không được chọn chuyển khoản; không sinh QR dùng số tài khoản giả. Compose cũng dùng MANUAL và để trống thông tin ngân hàng mặc định.

Môi trường cloud phát triển dùng MANUAL và thu tiền mặt để có thể làm việc mà không cần kết nối ngân hàng. Kiểm thử webhook dùng callback cục bộ và khóa tạm trên database thử nghiệm; chưa xác minh giao dịch hoặc hoàn tiền ngân hàng thật.

## Hủy đơn đã thanh toán

Tại Đơn của tôi / Lịch sử đặt sân, bấm Hủy đơn:

1. API xem trước kiểm tra chủ đơn, trạng thái và hạn hủy. Đơn CONFIRMED mặc định phải báo trước **24 giờ**; chính sách đã cấu hình có ưu tiên. Đơn HOLDING được hủy trước giờ chơi mà không cần hạn báo trước của đơn đã xác nhận.
2. Hiển thị tiền đã thu, số dự kiến hoàn và phần giữ lại. Công thức: tiền còn giữ × `cancelRefundPercent`, làm tròn đến VND. Mặc định tỷ lệ là 100% cho hủy hợp lệ; quá hạn khách phải liên hệ quầy.
3. Khi xác nhận, server kiểm tra lại trong transaction, đổi đơn thành CANCELLED, giải phóng lịch và ghi lịch sử kèm trạng thái cũ. Request gửi lại cùng mã không tạo thêm sự kiện hủy.
4. Khoản được hoàn nằm trong `refundPending`; phần giữ lại được ghi trong `cancellationSettlement`. Tiền đã thu chưa tự giảm vì chưa chuyển hoàn thực tế. Admin xử lý và ghi nhận khoản hoàn qua quy trình hoàn tiền hiện có.

## Đổi lịch sau thanh toán

Bấm Đổi lịch, chọn lịch mới, rồi **Xem trước đổi lịch**. Màn hình báo tổng cũ/mới, chênh lệch, số còn thanh toán và khoản chờ hoàn/đối soát. Bấm Xác nhận đổi lịch để thực hiện.

Server kiểm tra chủ đơn, hạn báo trước, sân và trọng tài còn trống, quyền đặt trước và điều kiện hội viên. Khi xác nhận có kiểm tra lại tổng đã xem; giá thay đổi thì yêu cầu xem lại. Việc nhả lịch cũ và gán lịch mới nằm trong cùng transaction: nếu lịch mới bị người khác giữ, toàn bộ thao tác bị rollback, lịch cũ được giữ nguyên.

Đổi sang giá cao hơn: số dư còn thiếu hiển thị và được thu qua phương thức hợp lệ. Đổi sang giá thấp hơn khi đã trả nhiều hơn tổng mới: phần dư vào `refundPending`. Lưu snapshot lịch cũ, lịch mới và số tiền trong lịch sử; không sửa/xóa phiếu thu cũ.

Đơn đã check-in/hoàn tất không cho khách tự hủy/đổi. Hội viên đổi đơn đã xác nhận còn áp dụng điều kiện cùng khu, cùng thời lượng, báo trước ít nhất 24 giờ và giới hạn lượt theo gói. Đổi đơn đang HOLDING không tiêu tốn lượt đổi của đơn đã xác nhận.

## Kiểm chứng

- `backend`: Maven Wrapper `verify`, JDK 17, PostgreSQL 16 cho kiểm tra chạy ứng dụng.
- `node --test tests/booking-time.test.mjs tests/pricing.test.mjs`: lựa chọn giờ, ranh giới giá và giá cuối tuần.
- `node tests/render-pages.mjs`: render 20 trang và vỏ giao diện quản trị/khách.
- `node tests/smoke-api.mjs`: smoke test tổng thể, đã cập nhật khung 30 phút và endpoint đăng ký giải đấu hiện hành.
- `tests/customer-booking-api.mjs`: đăng nhập, giữ chỗ đồng thời, hết hạn, webhook, hủy/đổi đã thanh toán, rollback và quyền STAFF. Bắt buộc `COURTLY_TEST_WRITE=1`, `COURTLY_API_URL`, `COURTLY_TEST_WEBHOOK_KEY`; database thử có tên `courtly_booking_test...`. Bài kiểm tra hết hạn chủ động đặt deadline của một đơn thử trong PostgreSQL, không chờ đủ 5 phút.
- `tests/customer-booking-browser.mjs`: menu, bảng giá trên desktop/mobile, lọc VIP, đăng nhập, giữ chỗ, chọn tiền mặt, đồng hồ, hủy và giao diện thu ngân STAFF. Chỉ chạy với môi trường local phát triển riêng vì có tạo tài khoản, đơn và phiếu thu thử.

Migration mới V7 được Flyway áp dụng; không sửa checksum hoặc nội dung migration cũ, không xóa database/volume để cập nhật.
