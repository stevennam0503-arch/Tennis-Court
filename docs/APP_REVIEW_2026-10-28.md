# Rà soát phiên bản mới nhất — 28/10/2026

Các phát hiện trên bản `3452200` dưới đây đã được xử lý ở bản tiếp theo. Xem [bản sửa và kết quả kiểm chứng](VOUCHER_CALENDAR_FIXES_2026-10-28.md).

Đã fetch `origin/nam-dev`: commit mới nhất vẫn là `345220017160b6976fb24d46e896a94d7cdc33ab`, trùng bản sửa trước. Không có commit mới hơn trên nhánh này tại thời điểm kiểm tra. Kết luận: các sửa chữa đã có vượt qua hồi quy, nhưng còn ba vấn đề nghiệp vụ cần sửa trước khi chốt vận hành.

Kiểm thử bằng PostgreSQL riêng `courtly-review-20261027`, database `courtly_review`; không truy cập database người dùng. Các đơn phát sinh đều là dữ liệu kiểm thử. Backend demo tắt, SMTP trống, thanh toán MANUAL. Không gửi email hoặc chuyển tiền thật.

## P2 — Lịch admin không mở được buổi ở tuần sau của đơn định kỳ

- Vị trí: `frontend/src/pages/CalendarPage.jsx:17`, `:150`, `:177`.
- Trang lọc đơn bằng `o.date === date` trước khi tìm đơn sở hữu slot. `o.date` chỉ là ngày buổi còn lại sớm nhất; các slot tuần sau vẫn thuộc đơn nhưng bị loại khỏi danh sách.
- Tái hiện: đơn `3131525d-4b11-4595-97a6-1b4bb447e389`, Sân A01 17:00, hai ngày 04/12/2026 và 11/12/2026. API xác nhận buổi thứ hai vẫn được giữ sân. Chromium: ngày đầu hiện tên khách và bấm mở được chi tiết; ngày thứ hai chỉ hiện “Đã đặt”, bấm không mở đơn.
- Ảnh hưởng: quầy không truy cập đơn trực tiếp từ ô lịch tuần sau, số đơn của ngày đang xem cũng thiếu. Không phải lỗi nhả sân hoặc mất đặt chỗ trong database.
- Hướng sửa: tìm đơn theo slot thuộc ngày đang xem và trạng thái của buổi tương ứng; rà soát các bộ lọc ngày tương tự ở danh sách đơn.

## P2 — Xem trước đổi lịch bỏ qua voucher nhưng số tiền lưu vẫn trừ voucher

- Vị trí: `backend/src/main/java/com/courtly/service/BookingSupportService.java:253` và `backend/src/main/java/com/courtly/service/OrderTotalsService.java:57`.
- Preview tính tiền sân sau ưu đãi hội viên + trọng tài + khoản cũ, chưa trừ `voucherBenefit`. Tính tổng khi lưu lại có trừ khoản này.
- Tái hiện: đơn `a6961941-9034-4a58-8b42-0f261e259c4a`, hai tuần cùng giá sân, voucher COURTLY50K giảm 50.000đ. Đổi từ 13:00 sang 14:00: preview báo tổng **400.000đ**, lưu thành công với tổng thực tế **350.000đ**. Đã gửi `expectedTotal=400000` theo đúng preview; bước xác nhận vẫn chấp nhận.
- Ảnh hưởng: chênh lệch tiền, tiền cọc và số cần thu trong bản xem trước có thể sai; khách/quầy xác nhận một số tiền khác số được lưu.
- Hướng sửa: dùng chung logic tính tiền cho preview và ghi nhận, gồm cả voucher; kiểm tra giá xác nhận theo kết quả thực tế.

## P2 — Khôi phục đơn giữ ưu đãi voucher nhưng không ghi nhận lại lượt sử dụng

- Vị trí: `backend/src/main/java/com/courtly/service/OrderService.java:237`, `:519`; `backend/src/main/java/com/courtly/service/VoucherService.java:187`.
- Hủy đơn gọi `vouchers.release`, xóa redemption và giảm used_count, kể cả chuỗi đã có buổi hoàn tất. Khôi phục không redeem lại, trong khi metadata ưu đãi vẫn còn và tổng tiền tiếp tục được giảm.
- Tái hiện trên đơn voucher ở trên: đã thu tiền và hoàn tất buổi đầu, hủy phần còn lại rồi khôi phục. Đơn trở lại **CONFIRMED**, có hai slot hoàn tất và vẫn giảm **50.000đ**. SQL đối chiếu: `vouchers.used_count = 0`, số redemption của đơn **0**.
- Ảnh hưởng: bộ đếm voucher không phản ánh ưu đãi đang áp dụng; giới hạn toàn hệ thống/theo khách có thể cho phép sử dụng thêm sai. Việc hủy phần chưa chơi còn trả lại lượt của voucher đã được hưởng một phần.
- Hướng sửa: xác định chính sách giữ/hoàn lượt khi đã sử dụng dịch vụ; khôi phục phải đối chiếu điều kiện và cập nhật redemption trong cùng transaction.

## Những kiểm tra đạt trong lượt này

- Maven verify: **53 test Java**, không thất bại.
- Frontend production build; **3 bộ test JavaScript** về chọn giờ, định giá, phân kỳ báo cáo.
- **18 kiểm tra API** đơn định kỳ/bảo mật: nhả đúng buổi, giữ phí đã dùng, đổi giờ/gia hạn, hủy và khôi phục một phần, khoản chờ hoàn, chặn demo ngoài demo.
- **10 kiểm tra API** trọng tài: phân công/thay đổi, chặn dịch vụ đã bỏ, thu tiền, check-in/out, xuất phiếu thu, hoàn tiền.
- Backend khởi động và xác minh schema **V12** trên database đã nâng cấp.
- Chromium kiểm chứng trực tiếp lỗi lịch nêu trên; không ghi nhận lỗi JavaScript trong kịch bản này. Không lặp lại toàn bộ 20 trang từ lượt trước.

Frontend còn cảnh báo bundle lớn. Gửi SMTP thật, webhook ngân hàng thật, cấu hình Docker trên máy người dùng và triển khai production chưa được kiểm chứng trong lượt này. Báo cáo này không thay đổi mã ứng dụng hoặc database triển khai.
