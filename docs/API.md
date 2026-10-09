# REST API

Base URL local: http://localhost:8080/api. JSON request/response. UUID dùng cho khóa.

Lỗi trả `{ "message": "...", "timestamp": "..." }`: 400 khi nghiệp vụ/validation không hợp lệ, 409 khi ràng buộc hoặc khóa database xung đột.

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | /health | Trạng thái HTTP của backend |
| POST | /schedules/generate | `{date:"YYYY-MM-DD"}` sinh các slot còn thiếu |
| GET | /overview?date=YYYY-MM-DD | Dữ liệu các màn hình và lịch ngày chọn |
| POST | /catalog/{collection} | Thêm danh mục |
| PUT | /catalog/{collection}/{id} | Sửa danh mục |
| POST | /orders | `{name,phone,accountId?,scheduleIds:[uuid]}` tạo đơn giữ chỗ |
| POST | /orders/{id}/cancel | Hủy và nhả slot |
| POST | /orders/{id}/check-in | Check-in đơn đã xác nhận |
| POST | /orders/{id}/check-out | Check-out khi đã thu đủ |
| PATCH | /orders/{id}/schedule | `{scheduleIds:[uuid]}` đổi lịch |
| POST | /orders/{id}/products | `{productId,type,quantity,hours}` thêm hàng/thuê |
| POST | /orders/{id}/products/{lineId}/return | Ghi trả thiết bị |
| POST | /orders/{id}/staff | `{staffId}` phân công theo slot của đơn |
| POST | /orders/{id}/invoice | Sinh số phiếu thu nội bộ |
| POST | /payments | `{orderId?,registrationId?,amount,method,transactionCode}` ghi thu |
| POST | /payments/{id}/refunds | `{amount,reason}` ghi hoàn |
| POST | /tournaments/{id}/registrations | `{accountId,name,members:[string]}` đăng ký |
| POST | /tournaments/{id}/draw | Bốc thăm cho số người/đội 2^n |
| PUT | /matches/{id}/schedule | `{scheduleIds:[uuid],staffId?}` xếp lịch |
| POST | /matches/{id}/result | `{winnerId,score}` ghi kết quả |
| PUT | /settings | `{holdMinutes,depositPercent,cancelRefundPercent}` chính sách |

`collection`: `courts`, `prices`, `accounts`, `drinks`, `rentals`, `staff`, `staff-schedules`, `tournaments`. Xem `dto/request/CatalogRequest.java` và `CatalogService.java` để biết trường cần có cho mỗi danh mục. Frontend `EntityDialog.jsx` thể hiện payload đầy đủ.

`POST /payments` yêu cầu đúng một trong orderId/registrationId. method: CASH hoặc BANK_TRANSFER. transactionCode nên là UUID mới cho mỗi khoản thu; dùng lại mã cùng payload để thử lại giao dịch đó, không dùng cùng mã cho khoản thu khác.

`GET /overview` trả các trường đã chọn qua service; không trả passwordHash. Bản này chưa có authentication, chỉ dành cho môi trường phát triển được kiểm soát. CORS không phải là cơ chế phân quyền.
