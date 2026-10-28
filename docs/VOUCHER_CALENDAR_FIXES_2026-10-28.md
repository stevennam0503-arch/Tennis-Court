# Sửa lịch định kỳ và voucher sau rà soát 28/10/2026

Bản sửa xử lý ba phát hiện trên commit `3452200`, giữ luồng vận hành và số tiền của đơn cũ.

## Lịch và check-in

Lịch admin tìm đơn theo các slot của ngày đang xem, không chỉ ngày đầu/tiếp theo của cả đơn. Mỗi ngày hiển thị đúng trạng thái buổi; buổi đã hoàn tất không chiếm lại slot đã giải phóng. Bấm ô lịch và nút chi tiết đều mở cùng đơn, kèm ngày đang xem.

Hộp check-in cho chọn ngày trong các buổi chưa hoàn tất, mặc định ngày vừa chọn trên lịch. Backend đã hỗ trợ `visitDate`; giao diện nay gửi trường này rõ ràng. Danh sách đơn cũng lọc theo các ngày chơi trong khoảng được chọn.

## Giá xem trước và voucher

Preview và tổng tiền lưu sử dụng chung hàm áp dụng ưu đãi hội viên/voucher. Preview dùng giá đã ghi nhận của các slot giữ lại, bao gồm buổi đã chơi; hiển thị voucher và tính cọc sau ưu đãi. Cả đổi lịch và khôi phục kiểm tra `expectedTotal`; nếu khác thì transaction hoàn tác toàn bộ.

Chính sách lượt voucher:

- Đơn còn hoạt động hoặc đã có buổi hoàn tất giữ ưu đãi đã thỏa thuận. Hủy phần còn lại không trả lượt voucher đã được hưởng một phần.
- Hủy/hết hạn trước khi chơi trả lượt. Khi khôi phục, hệ thống kiểm tra lại thời hạn, số lượt toàn hệ thống/theo khách, giá trị đơn tối thiểu và điều kiện hội viên/khách mới, rồi ghi nhận lại redemption trong cùng transaction.
- Với voucher phần trăm đã được trả lượt, khôi phục tính lại mức giảm theo giá trị lịch khôi phục. Preview và số được lưu khớp nhau.
- Nếu redemption vẫn tồn tại, khôi phục giữ mức giảm cũ và không tăng thêm lượt. Gửi lại cùng mã yêu cầu không tăng thêm lượt.

## Database

V13 khôi phục redemption bị thiếu của các đơn đang hoạt động, hoàn tất hoặc đã chơi một phần dựa trên metadata ưu đãi đã có; đồng bộ `used_count` với ledger. Không thay tổng tiền, khoản đã thu hay chứng từ. Không tự lấy lại lượt của đơn hủy/hết hạn trước khi chơi.

Nếu thiếu định nghĩa voucher hoặc metadata không đủ để dựng lại redemption, migration giữ số tiền và gắn `VOUCHER_LEDGER_REVIEW` để quầy đối chiếu. `database/query.sql` có truy vấn ledger thiếu và bộ đếm lệch. `database/init.sql` đồng bộ V1–V13; generator/fixture và reset demo đồng bộ lại bộ đếm sau khi xóa dữ liệu mẫu.

Đã kiểm chứng trên đơn lỗi cũ: trước migration tổng/đã thu 350.000đ, redemption 0; sau migration vẫn 350.000đ, redemption 1 và used_count 1.

## Kiểm chứng

- Maven verify: **57 test Java**, gồm giữ lượt đã sử dụng, khôi phục có kiểm tra điều kiện, preview không tiêu thụ lượt và tính tổng chung.
- Frontend production build; **4 bộ test JavaScript** gồm lịch từng buổi, lọc ngày, lịch sử không chiếm sân, báo cáo, chọn giờ và định giá.
- **15 kiểm tra voucher qua API**: 13 tình huống vòng đời voucher và 2 tình huống tổng tiền/cọc của khách có ưu đãi hội viên. Fixture giới hạn một lượt kiểm tra cả việc hết lượt, trả lượt, gửi lặp và rollback khi giá xác nhận sai.
- **18 kiểm tra hồi quy** đơn định kỳ/bảo mật và **10 kiểm tra trọng tài** đều đạt.
- Chromium: mở được cùng đơn ở buổi đầu và tuần sau; check-in từ lịch tuần sau chọn đúng ngày, buổi đầu vẫn CONFIRMED; không có lỗi JavaScript.
- Database cũ nâng V12→V13. Database trống nạp init/seed/query thành công; backend xác minh đủ 13 migration. Sau API test, mọi `used_count` khớp số redemption.

`tests/voucher-lifecycle-api.mjs` dùng database demo riêng đã nạp dữ liệu mẫu và `tests/fixtures/voucher-lifecycle.sql`. Fixture yêu cầu `SET courtly.allow_test_data='on'`; chạy API bằng `COURTLY_TEST_WRITE=1`, `COURTLY_API_URL=http://127.0.0.1:<port>/api`. Script tạo dữ liệu nên dùng database bỏ đi; mỗi lần chạy toàn bộ cần fixture sạch. Không chạy trên database vận hành.

Không thử SMTP hoặc ngân hàng thật trong lượt này. Frontend vẫn có cảnh báo kích thước bundle.

## Cập nhật bản đang chạy

Trong thư mục repository:

```powershell
git pull --ff-only origin nam-dev
docker compose up -d --build
```

Backend tự chạy V13. Không nhập lại init/test_data và không xóa volume database đang dùng.
