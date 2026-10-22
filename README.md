# Courtly — Java Spring Boot MVC + ReactJS

Mã nguồn Courtly chạy độc lập bằng **Java 17, Spring Boot 3.5.16, React 19.3, Vite 8.3.3 và PostgreSQL 16**. Backend là Java; không chạy Worker, D1, JavaScript engine hay Node.js để xử lý nghiệp vụ. Node.js chỉ dùng để phát triển/build React.

Logo gốc được giữ ở `frontend/public/favicon.svg`. Khu vực quản trị giữ sidebar, topbar và bố cục vận hành cũ. Phần khách hàng có giao diện riêng: tổng quan, sân/giờ trống, giải đấu, membership, thông tin CLB và menu tài khoản. Giao diện khách theo gói handoff nằm trong `frontend/src/guest/`, có VI/EN, footer dùng chung thông tin CLB và luồng thanh toán QR.

**Dựng bản demo đầy đủ:** xem [database/README.md](database/README.md) để nạp 244 đơn và tài khoản demo. Hướng dẫn [thanh toán sandbox/VietQR/SePay](docs/PAYMENTS.md).

## Chạy nhanh bằng Docker

Yêu cầu Docker Desktop/Docker Engine có Compose.

1. Clone repository, mở terminal trong thư mục `Tennis-Court-git`.
2. Sao chép `.env.example` thành `.env`.
3. Chạy:

```sh
docker compose up --build
```

Mở **http://localhost:3000**. API chạy ở `http://localhost:8080/api`; PostgreSQL ở `localhost:5432`.

Tài khoản quản trị được thiết lập một lần bởi Flyway V4:

- Email: `admin@gmail.com`
- Mật khẩu: `12345`

Migration V4 tạo hoặc cập nhật `admin@gmail.com` thành `ADMIN`, trạng thái `ACTIVE`, lưu mật khẩu bằng BCrypt cost 12. Nếu tài khoản đã có, ID và hồ sơ được giữ nguyên; các phiên cũ bị thu hồi. Flyway chỉ áp dụng một lần nên không đặt lại mật khẩu mỗi lần khởi động.

Khi cập nhật bản cũ, đặt `ADMIN_EMAIL=admin@gmail.com` trong `.env` để nhận diện đúng tài khoản chủ sân, sau đó chạy `docker compose up -d --build backend`. Không cần đặt `ADMIN_PASSWORD=12345`: cấu hình khởi tạo admin khác vẫn yêu cầu ít nhất 12 ký tự. `ADMIN_PASSWORD` mặc định để trống; chỉ dùng khi muốn tạo thêm admin theo email cấu hình chưa tồn tại. Đổi mật khẩu sau này qua hồ sơ tài khoản.

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
ADMIN_EMAIL=admin@gmail.com ./mvnw spring-boot:run
```

Windows PowerShell:

```powershell
cd backend
$env:ADMIN_EMAIL="admin@gmail.com"
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
| `backend/src/main/resources/db/migration/` | Flyway V1–V5, bảng, khóa, CHECK, index, trigger chống trùng |
| `frontend/src/pages/` | Các màn hình React |
| `frontend/src/components/` | Form, lịch chọn sân, modal, bảng và tóm tắt đơn dùng chung |
| `frontend/src/hooks/` | Nạp/làm mới dữ liệu, quản lý trạng thái |
| `frontend/src/services/api.js` | REST client, session cookie và CSRF token |
| `frontend/src/styles.css` | CSS hiện có, gồm layout admin |
| `frontend/src/guest/` | Giao diện khách theo handoff, VI/EN, đặt sân và QR |
| `database/` | init, query và dữ liệu mẫu đầy đủ |
| `docs/` | API, database, kiến trúc và kết quả kiểm thử |
| `tests/` | Kiểm thử HTTP và render React |

Ví dụ luồng tạo đơn: `BookingFlow.jsx → OrderController → OrderApplicationService → OrderService → Repository → PostgreSQL`. `PresentationService` tạo view có phân quyền để React đọc.

## Chức năng trong source

- Đăng ký/đăng nhập email và mật khẩu, session cookie HttpOnly, CSRF, phân quyền ADMIN/CUSTOMER ở backend; mật khẩu BCrypt. Đổi mật khẩu thu hồi phiên cũ; mã kích hoạt/đặt lại dùng một lần, hiệu lực 24 giờ, do quản trị viên cấp.
- Khách xem sân/giá trước đăng nhập, chọn nhiều slot liên tiếp trên một sân, chọn trọng tài riêng từng slot, kiểm tra giá từ server và tạo giữ chỗ. Không thuê thiết bị online từ tài khoản khách.
- Tài khoản gom hồ sơ, đơn có phân trang, lịch sử đặt sân, lịch sử thanh toán và membership. Khách chỉ nhận dữ liệu của mình từ API.
- Giữ chỗ có hạn, thu cọc/thu thêm tại quầy, đổi/hủy lịch, nhận tiền đến muộn để đối soát, ghi nhận hoàn tiền, nhật ký và phiếu thu có snapshot. Các thao tác quan trọng có `requestId` chống ghi lặp.
- POS/admin quản lý sân, bảng giá, đơn, đồ uống, thiết bị thuê và trả/hỏng/mất, nhân sự và lịch làm việc. Check-out không tự ghi nhận trả thiết bị hoặc thanh toán; tiền và thiết bị vẫn theo dõi riêng như luồng hiện tại.
- Giải đơn/đôi/đội, đăng ký, thu phí riêng, nhánh loại trực tiếp với số đăng ký 2^n, xếp sân/trọng tài, kết quả và đưa người thắng tới vòng sau.
- Giới thiệu, liên hệ, tin tức, feedback có quyền đồng ý công khai và quản trị duyệt/trả lời.
- Membership: so sánh Guest/Club/Plus, đăng ký chờ xác nhận, quầy xác minh nhận đủ phí mới kích hoạt; gói hết hạn tự mất quyền lợi. Chỉ giảm tiền sân của giờ chơi nằm trong kỳ hội viên; giữ snapshot ưu đãi trên đơn. Không tự gia hạn. Giá gói mặc định từ bản mẫu: Club 299.000đ/30 ngày, Plus 599.000đ/30 ngày; admin có thể sửa/tạm dừng gói. Giá và điều kiện đã đăng ký không bị sửa theo danh mục mới.
- Báo cáo, CSV, nhật ký và chính sách giữ cách tổ chức hiện có. Phí membership có phiếu thu riêng trong màn Membership và lịch sử thanh toán.

Đơn khách hàng mới đặt cọc **50% tiền sân sau ưu đãi**, không gồm phí trọng tài. Đơn tạo tại quầy giữ quy tắc `depositPercent` trên tổng đơn. Lịch mới có bước 30 phút; lịch cũ đã được tham chiếu giữ ID, thời lượng và giá cũ.

## Database và dữ liệu cũ

Database nghiệp vụ được chuyển thành **21 bảng quan hệ**, thêm `audit_logs`, `club_settings` và `app_documents` cho các phần mở rộng. Không lưu toàn bộ sân/đơn/thanh toán vào một bản ghi JSON. `app_documents` chứa các tài liệu nội dung, mã kích hoạt đã băm, khóa idempotency và dữ liệu mở rộng membership; xem `docs/DATABASE.md`.

Flyway tự tạo schema; Hibernate chỉ `ddl-auto=validate`. `database/init.sql` cũng chứa lịch sử Flyway đúng checksum để dựng database trống bằng SQL. Database có dữ liệu chỉ nâng cấp qua Flyway.

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

Có ngân hàng mô phỏng SANDBOX và tích hợp nhận callback SePay khi cấu hình LIVE. Chưa thử chuyển tiền thật; cần tài khoản nhận, khóa webhook và URL HTTPS. Hoàn tiền thực tế vẫn do quầy xử lý. Chưa gửi email/SMS/OTP tự động, hóa đơn điện tử thuế, live score 15/30/40, bye/vòng bảng hoặc phân trang/tải lớn đầy đủ. Bảng module giữ mức hoàn thiện của ứng dụng hiện có, không phải cam kết đã triển khai đầy đủ mọi module production.

Khi triển khai độc lập cần một host chạy JVM/container và PostgreSQL. Frontend production được Nginx phục vụ và proxy `/api` sang backend trong Compose.

## Tài liệu chính thức

- Spring Boot 3.5: https://docs.spring.io/spring-boot/3.5/
- Spring MVC: https://docs.spring.io/spring-framework/reference/web/webmvc.html
- Spring Security CSRF: https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html
- Spring Data JPA: https://docs.spring.io/spring-data/jpa/reference/
- React: https://react.dev/
- PostgreSQL: https://www.postgresql.org/docs/16/

ZIP chỉ chứa source, migration, asset, lockfile, Maven Wrapper và tài liệu. `target`, `node_modules`, `dist`, cache, log và cấu hình riêng của môi trường không được đóng gói; các lệnh trên tạo lại chúng.
