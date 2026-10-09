# Courtly — Spring Boot · ReactJS · PostgreSQL

Bản chuyển đổi Courtly từ Worker/JavaScript sang **Java 17 + Spring Boot 3.5.16**, **React 19.3 + Vite 8.3.3**, **PostgreSQL 16**. Giao diện tiếng Việt, giữ các luồng nghiệp vụ của bản trước. Database gồm 21 bảng nghiệp vụ theo ERD và 2 bảng bổ sung `audit_logs`, `club_settings`; không còn lưu toàn hệ thống vào một ô JSON.

## Chạy nhanh bằng Docker

Yêu cầu Docker có Docker Compose.

Tại thư mục chứa `compose.yaml`:

```sh
docker compose up --build
```

Khi backend đã khởi động:

- Giao diện: http://localhost:3000
- API: http://localhost:8080/api/health
- PostgreSQL: `localhost:5432`, database `courtly`, user `courtly`, mật khẩu mặc định dùng local `courtly_local`.

Lần đầu sẽ tải image/phụ thuộc, chạy Flyway và tạo dữ liệu mẫu. Dữ liệu giữ trong volume `postgres_data`. Các cổng chỉ bind vào `127.0.0.1` để chạy phát triển trên máy cá nhân.

Có thể copy `.env.example` thành `.env` rồi đổi mật khẩu hoặc đặt `SEED_DEMO=false` trước lần khởi tạo đầu tiên. Đổi cờ sau khi đã khởi tạo không xóa dữ liệu đã có.

Dừng bằng Ctrl+C hoặc `docker compose down`. Lệnh down thông thường giữ dữ liệu. `docker compose down -v` sẽ xóa database — chỉ dùng khi chủ động muốn bắt đầu lại.

## Chạy riêng để phát triển

Yêu cầu JDK 17+, Node.js 22.12+ (hoặc Node 24), PostgreSQL 16. Có thể dùng Docker chỉ cho database:

```sh
docker compose up -d postgres
```

Backend, mở terminal thứ nhất:

```sh
cd backend
./mvnw spring-boot:run
```

Windows PowerShell dùng `mvnw.cmd spring-boot:run`. Nếu đã có Maven 3.6.3+, có thể dùng `mvn spring-boot:run`.

Frontend, terminal thứ hai:

```sh
cd frontend
npm ci
npm run dev
```

Mở http://localhost:5173. Vite tự proxy `/api` đến Spring Boot `localhost:8080`, không cần sửa URL trong từng component.

Nếu PostgreSQL ở địa chỉ khác, cấu hình các biến `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` cho backend. Ví dụ `DB_URL=jdbc:postgresql://localhost:5432/courtly`. JPA dùng `ddl-auto=validate`; Flyway chịu trách nhiệm tạo/cập nhật schema.

## Mở và xem mã nguồn

1. Giải nén ZIP; mở thư mục `Courtly-Spring-React`.
2. Với IntelliJ IDEA hoặc Eclipse, import `backend/pom.xml` dưới dạng Maven project và chọn JDK 17. Lớp chạy chính là `com.courtly.CourtlyApplication`.
3. Với VS Code, mở `frontend`; màn hình bắt đầu tại `src/App.jsx`, từng trang ở `src/pages`, biểu mẫu ở `src/components`.
4. Đọc `docs/API.md` để lần theo endpoint → controller → service → repository/entity. SQL đầy đủ nằm trong hai file `backend/src/main/resources/db/migration/*.sql`.

ZIP chứa source, Maven Wrapper và lockfile npm. Các thư mục có thể tạo lại (`node_modules`, `target`, `dist`) không được đưa vào ZIP; các lệnh build sẽ tạo chúng trên máy bạn.

## Tổ chức source

| Đường dẫn | Chức năng |
| --- | --- |
| `backend/pom.xml` | Maven, Spring Boot, JPA, Validation, Flyway, PostgreSQL driver, Lombok, test. |
| `backend/src/main/java/com/courtly/CourtlyApplication.java` | Điểm khởi động Spring Boot. |
| `.../controller/` | REST API: nhận DTO, gọi service, trả response. |
| `.../service/` | Nghiệp vụ và ranh giới transaction, tính tiền, phân bổ tài nguyên, scheduler hết hạn. |
| `.../repository/` | Spring Data JPA; query và khóa ghi `PESSIMISTIC_WRITE`. |
| `.../entity/` | Mỗi entity một file Java, ánh xạ bảng PostgreSQL. |
| `.../dto/request/` | Request DTO dạng Java record, Bean Validation. |
| `.../dto/response/` | Response lỗi API. Các view tổng hợp chỉ trả trường được lựa chọn, không serialize entity trực tiếp. |
| `.../config/` | CORS và dữ liệu demo. |
| `.../exception/` | BusinessException và xử lý lỗi chung. |
| `.../util/` | Quy tắc chung, tiền tệ và múi giờ Việt Nam. |
| `backend/src/main/resources/application.yml` | Cấu hình datasource, JPA, Flyway, server. |
| `backend/src/main/resources/db/migration/` | Migration schema, FK, CHECK, chỉ mục và ràng buộc chống trùng. |
| `backend/src/test/java/` | Unit test các giới hạn tiền và tài nguyên. |
| `frontend/src/pages/` | Mỗi màn hình nghiệp vụ là một React component. |
| `frontend/src/components/` | Modal, bảng, biểu mẫu, chi tiết đơn/giải dùng lại. |
| `frontend/src/hooks/useClub.js` | Nạp và làm mới dữ liệu, xử lý trạng thái tải/lỗi. |
| `frontend/src/services/api.js` | Client gọi REST API. |
| `frontend/src/utils/format.js` | Nhãn tiếng Việt, ngày và tiền. |
| `frontend/src/styles.css` | CSS tách riêng khỏi JSX. |
| `frontend/src/modules.json` | 50 module từ Excel gốc. |
| `frontend/nginx.conf` | Phục vụ React build và reverse proxy API khi dùng Docker. |
| `compose.yaml`, `backend/Dockerfile`, `frontend/Dockerfile` | Khởi động ba thành phần bằng Docker. |
| `docs/` | API, database, phạm vi và kết quả kiểm tra. |
| `tests/smoke-api.mjs` | Kiểm tra API trên database phát triển dùng riêng. |

## Luồng có thao tác

- Quản lý sân, bảng giá theo ngày/giờ; sinh slot 06:00–23:00, mỗi slot một giờ.
- Đặt nhiều slot/nhiều sân cùng ngày; khách trong danh bạ hoặc khách lẻ; giữ chỗ, thu cọc, xác nhận.
- Hủy/nhả sân, đổi lịch đơn chưa có nhân sự/đồ thuê đang dùng, check-in/check-out, phiếu thu nội bộ, CSV.
- Tiền mặt/chuyển khoản được xác nhận thủ công; chống thu vượt tiền và hoàn vượt giao dịch; mã giao dịch hỗ trợ lặp lại an toàn với cùng payload.
- Đồ uống, thiết bị thuê, trừ kho, kiểm tra thuê chồng khoảng thời gian, ghi trả đồ.
- Nhân sự và slot làm việc, phân công theo giờ, tổng hợp công của đơn hoàn tất.
- Giải đơn/đôi/đội, đăng ký, thu phí riêng, nhánh loại trực tiếp với số đội 2^n, xếp sân/trọng tài, kết quả và đẩy người thắng vào vòng tiếp theo.
- Báo cáo, nhật ký 100 thao tác gần nhất, chính sách, nhắc việc trong website và bảng đối chiếu 50 module.

## Phạm vi còn lại

Đây là chuyển đổi các luồng của bản Courtly cơ bản, chưa phải hoàn thành toàn bộ 50 module production. Cần bổ sung trước khi cung cấp rộng rãi:

- Đăng nhập, mật khẩu, email verification/reset, Spring Security và phân quyền API. Bảng Account có các trường tương ứng, hiện được dùng làm danh bạ; đổi `role` chưa tạo quyền truy cập.
- QR/callback ngân hàng, hoàn tiền thực tế, SMS/email, hóa đơn điện tử thuế.
- Thành viên đội chưa có màn hình liên kết tài khoản; chưa hỗ trợ bye, vòng bảng, loại kép, bảng xếp hạng đầy đủ.
- Đối chiếu ca chưa có phiên ca được khóa. Báo cáo tiền thu tách sân/phí giải; biểu đồ dịch vụ hiển thị giá trị đơn, chưa phân bổ khoản thu từng dịch vụ.
- Tỷ lệ hoàn trong cấu hình là tham khảo; thao tác hoàn vẫn phải được xác nhận thủ công.
- API tổng hợp phục vụ ứng dụng nhỏ; khi dữ liệu lớn cần thêm pagination và tối ưu truy vấn theo màn hình.
- Chưa tự chuyển dữ liệu đang lưu trên website D1 cũ. Database PostgreSQL của bản này được khởi tạo mới.

## Build và kiểm tra

```sh
cd backend
./mvnw verify
```

```sh
cd frontend
npm ci
npm run build
```

Kiểm tra API chỉ trên database thử nghiệm: khởi động backend rồi chạy từ thư mục dự án:

```sh
node tests/smoke-api.mjs
```

Test API tạo sân, khách, đơn, giao dịch và giải thử, không tự xóa các bản ghi. Dùng database riêng; có thể đổi endpoint bằng biến `COURTLY_API_URL`. Chi tiết các kiểm tra thực sự đã chạy nằm trong `docs/TEST_RESULTS.md`.

## Tài liệu chính thức

- Spring Boot: https://docs.spring.io/spring-boot/3.5/
- Spring Data JPA locking: https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html
- React: https://react.dev/
- Vite: https://vite.dev/guide/
- PostgreSQL constraints: https://www.postgresql.org/docs/16/ddl-constraints.html
