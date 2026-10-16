# Courtly — Java Spring Boot MVC + ReactJS

Mã nguồn Courtly chạy độc lập bằng **Java 17, Spring Boot 3.5.16, React 19.3, Vite 8.3.3 và PostgreSQL 16**. Backend là Java; không chạy Worker, D1, JavaScript engine hay Node.js để xử lý nghiệp vụ. Node.js chỉ dùng để phát triển/build React.

Logo gốc được giữ ở `frontend/public/favicon.svg`. Khu vực quản trị giữ sidebar, topbar và bố cục vận hành cũ. Phần khách hàng có giao diện riêng: tổng quan, sân/giờ trống, giải đấu, membership, thông tin CLB và menu tài khoản. CSS khách hàng tách trong `frontend/src/customer.css`.

## Chạy nhanh bằng Docker

Yêu cầu Docker Desktop/Docker Engine có Compose.

1. Giải nén, mở terminal trong thư mục `Courtly-SpringBoot-React`.
2. Sao chép `.env.example` thành `.env`.
3. Chạy:

```sh
docker compose up --build
```

Mở **http://localhost:3000**. API chạy ở `http://localhost:8080/api`; PostgreSQL ở `localhost:5432`.

Tài khoản quản trị khởi tạo local theo `.env.example`:

- Email: `admin@courtly.local`
- Mật khẩu: `CourtlyLocal!2026`

Đây là thông tin mặc định cho máy phát triển. Có thể đổi `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `.env` trước lần khởi tạo đầu tiên. Sau khi tài khoản đã tồn tại, thay biến môi trường không ghi đè mật khẩu; dùng đổi mật khẩu trong hồ sơ. Không có mật khẩu người dùng của website cũ trong gói source.

Khách hàng chọn **Đăng nhập → Đăng ký** để tạo tài khoản. Các tài khoản danh bạ trong dữ liệu mẫu chưa có mật khẩu; quản trị viên có thể cấp mã kích hoạt từ màn Tài khoản.

Database được lưu trong volume `postgres_data`. `docker compose down` dừng dịch vụ và giữ dữ liệu; chỉ dùng `docker compose down -v` khi chủ động muốn xóa database local.

## Chạy riêng bằng IDE

Yêu cầu JDK 17+, Node.js 22.12+ hoặc 24, PostgreSQL 16, Maven Wrapper có trong source.

Khởi động PostgreSQL:

```sh
docker compose up -d postgres
```

Backend, terminal thứ nhất, Linux/macOS:

```sh
cd backend
ADMIN_EMAIL=admin@courtly.local ADMIN_PASSWORD='CourtlyLocal!2026' ./mvnw spring-boot:run
```

Windows PowerShell:

```powershell
cd backend
$env:ADMIN_EMAIL="admin@courtly.local"
$env:ADMIN_PASSWORD="CourtlyLocal!2026"
.\mvnw.cmd spring-boot:run
```

Frontend, terminal thứ hai:

```sh
cd frontend
npm ci
npm run dev
```

Mở **http://localhost:5173**. Vite proxy `/api` tới Spring Boot 8080; không cần đổi URL trong component. Với IntelliJ/Eclipse, import `backend/pom.xml`, chọn JDK 17 và chạy `com.courtly.CourtlyApplication`; khai báo biến môi trường trong Run Configuration.

Các biến cấu hình:

| Biến | Mặc định / ý nghĩa |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/courtly` |
| `DB_USERNAME`, `DB_PASSWORD` | `courtly`, `courtly_local` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tạo admin nếu email chưa tồn tại; mật khẩu không để trống khi cần tạo admin mới |
| `SEED_DEMO` | `true`; chỉ tạo dữ liệu sân/sản phẩm/giải khi database chưa có sân |
| `FRONTEND_ORIGIN` | `http://localhost:5173`; Compose đặt thành `http://localhost:3000` |
| `COOKIE_SECURE` | `false` khi chạy HTTP local; đặt `true` khi vận hành qua HTTPS |
| `SERVER_PORT` | `8080` |
| `API_PROXY_TARGET` | Frontend dev proxy mặc định `http://localhost:8080` |

## Tổ chức theo MVC và các tầng Spring

React là **View**; Spring MVC cung cấp REST Controller và DTO. Nghiệp vụ nằm ở Service; Entity và Repository là tầng Model/lưu trữ. Không dùng JSP/Thymeleaf vì giao diện đã dùng React.

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `backend/src/main/java/com/courtly/controller/` | Nhận HTTP, chuyển request tới service, trả JSON; chia theo tài khoản, đơn, tiền, danh mục, giải, nội dung, membership |
| `.../service/` | Nghiệp vụ Java, phân quyền dữ liệu, transaction, snapshot tiền, lịch sử và hết hạn |
| `.../repository/` | Spring Data JPA; truy vấn và khóa dữ liệu PostgreSQL |
| `.../entity/` | Entity ánh xạ bảng; UUID, quan hệ, BigDecimal và `@Version` |
| `.../dto/request/`, `.../dto/response/` | Request record có validation và response lỗi; view tổng hợp chỉ chọn trường được phép trả |
| `.../config/` | Spring Security, CSRF, CORS, phân quyền API, khởi tạo dữ liệu |
| `.../exception/` | BusinessException và xử lý lỗi HTTP thống nhất |
| `.../util/` | Quy tắc dùng chung, tiền và múi giờ Việt Nam |
| `backend/src/main/resources/db/migration/` | Flyway V1–V3, bảng, khóa, CHECK, index, trigger chống trùng |
| `frontend/src/pages/` | Các màn hình React |
| `frontend/src/components/` | Form, lịch chọn sân, modal, bảng và tóm tắt đơn dùng chung |
| `frontend/src/hooks/` | Nạp/làm mới dữ liệu, quản lý trạng thái |
| `frontend/src/services/api.js` | REST client, session cookie và CSRF token |
| `frontend/src/styles.css` | CSS hiện có, gồm layout admin |
| `frontend/src/customer.css` | Giao diện khách hàng và membership |
| `docs/` | API, database, kiến trúc và kết quả kiểm thử |
| `tests/` | Kiểm thử HTTP và render React |

Ví dụ luồng tạo đơn: `BookingFlow.jsx → OrderController → OrderApplicationService → OrderService → Repository → PostgreSQL`. `PresentationService` tạo view có phân quyền để React đọc.

## Chức năng trong source

- Đăng ký/đăng nhập email và mật khẩu, session cookie HttpOnly, CSRF, phân quyền ADMIN/CUSTOMER ở backend; mật khẩu BCrypt. Đổi mật khẩu thu hồi phiên cũ; mã kích hoạt/đặt lại dùng một lần, hiệu lực 24 giờ, do quản trị viên cấp.
- Khách xem sân/giá trước đăng nhập, chọn nhiều slot liên tiếp trên một sân, chọn trọng tài riêng từng slot, kiểm tra giá từ server và tạo giữ chỗ. Không thuê thiết bị online từ tài khoản khách.
- Tài khoản gom hồ sơ, đơn, lịch sử đặt sân, lịch sử thanh toán và membership. Khách chỉ nhận dữ liệu của mình từ API.
- Giữ chỗ có hạn, thu cọc/thu thêm tại quầy, đổi/hủy lịch, nhận tiền đến muộn để đối soát, ghi nhận hoàn tiền, nhật ký và phiếu thu có snapshot. Các thao tác quan trọng có `requestId` chống ghi lặp.
- POS/admin quản lý sân, bảng giá, đơn, đồ uống, thiết bị thuê và trả/hỏng/mất, nhân sự và lịch làm việc. Check-out không tự ghi nhận trả thiết bị hoặc thanh toán; tiền và thiết bị vẫn theo dõi riêng như luồng hiện tại.
- Giải đơn/đôi/đội, đăng ký, thu phí riêng, nhánh loại trực tiếp với số đăng ký 2^n, xếp sân/trọng tài, kết quả và đưa người thắng tới vòng sau.
- Giới thiệu, liên hệ, tin tức, feedback có quyền đồng ý công khai và quản trị duyệt/trả lời.
- Membership: so sánh Guest/Club/Plus, đăng ký chờ xác nhận, quầy xác minh nhận đủ phí mới kích hoạt; gói hết hạn tự mất quyền lợi. Chỉ giảm tiền sân của giờ chơi nằm trong kỳ hội viên; giữ snapshot ưu đãi trên đơn. Không tự gia hạn. Giá gói mặc định từ bản mẫu: Club 299.000đ/30 ngày, Plus 599.000đ/30 ngày; admin có thể sửa/tạm dừng gói. Giá và điều kiện đã đăng ký không bị sửa theo danh mục mới.
- Báo cáo, CSV, nhật ký và chính sách giữ cách tổ chức hiện có. Phí membership có phiếu thu riêng trong màn Membership và lịch sử thanh toán.

Tỷ lệ cọc hiện tại được tính trên **tổng đơn sau ưu đãi**, theo cấu hình `depositPercent`; đây là cách tính giữ từ phiên bản ứng dụng hiện tại. Không tự thay quy tắc nghiệp vụ sang phương án khác trong tài liệu thiết kế.

## Database và dữ liệu cũ

Database nghiệp vụ được chuyển thành **21 bảng quan hệ**, thêm `audit_logs`, `club_settings` và `app_documents` cho các phần mở rộng. Không lưu toàn bộ sân/đơn/thanh toán vào một bản ghi JSON. `app_documents` chứa các tài liệu nội dung, mã kích hoạt đã băm, khóa idempotency và dữ liệu mở rộng membership; xem `docs/DATABASE.md`.

Flyway tự tạo schema; Hibernate chỉ `ddl-auto=validate`. Không chạy SQL thủ công rồi bật lại Flyway trên cùng database chưa có lịch sử migration.

**Gói này chuyển mã nguồn và cấu trúc hệ thống; chưa sao chép dữ liệu, mật khẩu hoặc phiên đăng nhập đang có trên website D1 vào PostgreSQL.** Website đang chạy chưa bị sửa/triển khai lại. Database local được khởi tạo độc lập. Không đưa `.env` thật, database dump hoặc secret của Site vào ZIP.

## Build và kiểm thử

```sh
cd backend
./mvnw verify
```

```sh
cd frontend
npm ci
npm run build
```

Khi backend/database thử nghiệm đang chạy, từ thư mục dự án:

```sh
node tests/smoke-api.mjs
```

Có thể đặt `COURTLY_API_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Kịch bản tạo dữ liệu thử; chỉ chạy trên database phát triển riêng. Chi tiết kiểm tra đã chạy và giới hạn môi trường nằm ở `docs/TEST_RESULTS.md`.

## Phạm vi chưa kết nối

Không giả lập thanh toán ngân hàng thành công: QR/callback, chuyển khoản và hoàn tiền thực tế vẫn cần tích hợp nhà cung cấp; hiện quầy xác minh và ghi nhận. Chưa gửi email/SMS/OTP tự động, hóa đơn điện tử thuế, live score 15/30/40, bye/vòng bảng hoặc phân trang/tải lớn đầy đủ. Bảng module giữ mức hoàn thiện của ứng dụng hiện có, không phải cam kết đã triển khai đầy đủ mọi module production.

Khi triển khai độc lập cần một host chạy JVM/container và PostgreSQL. Frontend production được Nginx phục vụ và proxy `/api` sang backend trong Compose.

## Tài liệu chính thức

- Spring Boot 3.5: https://docs.spring.io/spring-boot/3.5/
- Spring MVC: https://docs.spring.io/spring-framework/reference/web/webmvc.html
- Spring Security CSRF: https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html
- Spring Data JPA: https://docs.spring.io/spring-data/jpa/reference/
- React: https://react.dev/
- PostgreSQL: https://www.postgresql.org/docs/16/

ZIP chỉ chứa source, migration, asset, lockfile, Maven Wrapper và tài liệu. `target`, `node_modules`, `dist`, cache, log và cấu hình riêng của môi trường không được đóng gói; các lệnh trên tạo lại chúng.
