# Sửa đổi lịch sau khôi phục cùng ngày

Bản sửa xử lý trường hợp đã chơi một buổi, hủy phần còn lại, khôi phục vào cùng ngày rồi đổi giờ. Trước đây preview bỏ chi phí đã sử dụng trong ngày đó nên báo 200.000đ thay vì tổng thực tế 400.000đ; bước xác nhận bị chặn do không khớp giá.

## Thay đổi

- Preview luôn giữ các dòng sân và trọng tài có `completed=true`, dù trùng ngày đang đổi. Tổng tiền, tiền cọc và chênh lệch tính đủ phí đã sử dụng.
- Form đổi lịch/phân công chỉ lấy các slot và trọng tài chưa hoàn tất của ngày đang chỉnh. Không lấy giờ bắt đầu hay cộng thời lượng từ buổi đã chơi.
- Luồng khách dùng cùng cách xác định slot đang giữ cho lần đổi lịch, tránh coi slot lịch sử hoặc buổi khác là slot có thể chỉnh.
- Lịch sử, đơn giá đã ghi nhận và phí trọng tài đã sử dụng được giữ nguyên khi đổi giờ hoặc bỏ phân công còn lại.

Không thay schema hay dữ liệu lưu; database tiếp tục dùng V13. Không cần nhập SQL hoặc xóa volume khi cập nhật.

## Kiểm chứng

- Maven verify: 57 test Java đạt.
- Frontend production build và 4 bộ test JavaScript đạt; bổ sung trường hợp slot/trọng tài đã hoàn tất cùng ngày và mặc định khôi phục đơn chưa chơi.
- `tests/same-day-restore-api.mjs`: 12 kiểm tra cho đơn có/không có trọng tài; hoàn tất → hủy → khôi phục cùng ngày → preview → đổi giờ có expectedTotal → sửa trọng tài. Tổng preview bằng tổng lưu, lịch sử đã chơi không đổi.
- `tests/recurring-operations-api.mjs`: 18 kiểm tra hồi quy đạt.
- `tests/same-day-restore-browser.mjs`: kiểm tra form chỉ có một giờ chưa chơi, xác nhận đổi lịch thành công, chỉnh trọng tài giữ phí lịch sử, cả hai trường hợp có/không có trọng tài; không có lỗi JavaScript.

API/browser test chỉ dùng database bỏ đi có dữ liệu mẫu. Chạy API với `COURTLY_TEST_WRITE=1`, `COURTLY_API_URL`, `COURTLY_CASE_OUTPUT` (đường dẫn JSON ngoài repository); truyền cùng file case cho browser và đặt `COURTLY_WEB_URL`, `CHROMIUM_PATH` khi cần. Chọn ngày trống bằng `COURTLY_TEST_DAY_OFFSET` nếu chạy API lặp.

Không kiểm tra SMTP/ngân hàng thật trong lượt này. Cảnh báo bundle frontend lớn vẫn còn.
