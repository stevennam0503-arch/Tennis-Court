# COURTLY — TOÀN BỘ KIẾN TRÚC, MÃ NGUỒN VÀ DỮ LIỆU DỰ ÁN
> **Dành cho các AI / LLM & Lập trình viên:** Tài liệu này chứa toàn bộ bối cảnh hệ thống, kiến trúc tầng, mô hình nghiệp vụ, database schema (migrations V1-V8), API specification, cùng toàn bộ mã nguồn Backend (Java Spring Boot) và Frontend (React) của hệ thống Courtly Tennis Club.

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ](#1-tổng-quan-hệ-thống--công-nghệ)
2. [MÔ HÌNH NGHIỆP VỤ & QUY TẮC VẬN HÀNH](#2-mô-hình-nghiệp-vụ--quy-tắc-vận-hành)
3. [KIẾN TRÚC & LUỒNG DỮ LIỆU](#3-kiến-trúc--luồng-dữ-liệu)
4. [DATABASE SCHEMA & FLYWAY MIGRATIONS](#4-database-schema--flyway-migrations)
5. [CẤU HÌNH HỆ THỐNG & DEPLOYMENT](#5-cấu-hình-hệ-thống--deployment)
6. [TOÀN BỘ MÃ NGUỒN BACKEND (JAVA SPRING BOOT)](#6-toàn-bộ-mã-nguồn-backend-java-spring-boot)
   - 6.1 Controllers
   - 6.2 Services
   - 6.3 Entities & JPA Models
   - 6.4 Repositories
   - 6.5 DTOs & Payloads
   - 6.6 Security & Configs
   - 6.7 Utils & Exceptions
7. [TOÀN BỘ MÃ NGUỒN FRONTEND (REACT 19 + VITE)](#7-toàn-bộ-mã-nguồn-frontend-react-19--vite)
   - 7.1 Core App & Services
   - 7.2 Guest Portal (Giao diện khách đặt sân online)
   - 7.3 Components & Dialogs
   - 7.4 Admin & Operations Pages
8. [BỘ TEST TỰ ĐỘNG & KIỂM THỬ TÍCH HỢP](#8-bộ-test-tự-động--kiểm-thử-tích-hợp)

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ

### 1.1 Mục đích dự án
Courtly là hệ thống quản lý và vận hành Câu lạc bộ Quần vợt (Tennis Club Management Platform) khép kín, bao gồm:
* **Giao diện Khách hàng (Guest Portal):** Tra cứu sân/giờ trống theo thời gian thực (real-time 30-phút), đặt sân đơn hoặc đặt nhiều sân trong 1 đơn (Multi-court booking), chọn trọng tài đi kèm, đăng ký hội viên (Membership Club/Plus), đăng ký giải đấu, thanh toán cọc tự động qua VietQR Napas 24/7.
* **Giao diện Quản trị & Vận hành (Staff / Cashier / Admin App):** Sơ đồ lịch sân (Calendar Matrix), quầy thu ngân tiền mặt (Cash Desk), đối soát chốt ca cuối ngày, báo cáo doanh thu & công suất sân thực tế, điều hành giải đấu (bốc thăm sơ đồ nhánh $2^n$), quản lý nhân sự trọng tài và cấu hình chính sách CLB.

### 1.2 Tech Stack
* **Backend:** Java 17, Spring Boot 3.5.16, Spring MVC (RESTful JSON API), Spring Data JPA, Hibernate 6, Spring Security, BCrypt Password Encoder, Flyway Database Migration.
* **Database:** PostgreSQL 16 (Bảng quan hệ chuẩn hóa + Bảng tài liệu `app_documents` cho JSON snapshot và khóa phân tán).
* **Frontend:** React 19.3, Vite 8.3.3, Lucide Icons, Pure CSS Responsive Layout (Không phụ thuộc UI framework nặng).
* **Reverse Proxy & Edge:** Nginx Alpine (Reverse proxy `/api` tới backend, phục vụ React SPA, bảo vệ security headers, chặn giả mạo IP client).
* **Containerization:** Docker Compose đa container (`postgres`, `backend`, `frontend`).

---

## 2. MÔ HÌNH NGHIỆP VỤ & QUY TẮC VẬN HÀNH

### 2.1 Quản lý Sân & Khung giờ chơi
* CLB có các khu sân: **Khu A (Ngoài trời)**, **Khu B (Trong nhà)**, **Khu V (VIP Lounge)**.
* Khung giờ mở cửa: **06:00 – 23:00 mỗi ngày** (Tổng cộng 17 tiếng = 34 slot 30 phút mỗi sân).
* Slot lịch (`CourtSchedule`) được tự động sinh theo ngày với bước 30 phút. Mỗi slot có giá động phụ thuộc vào:
  * Loại ngày: `WEEKDAY` (Thứ 2 - Thứ 6) hoặc `WEEKEND` (Thứ 7 - CN).
  * Khung giờ: Giờ thường vs Giờ cao điểm (Peak hours).
  * Sân VIP có biểu giá riêng cao cấp hơn.
* **Công thức tính công suất sân (Occupancy):**
  $$\text{Occupancy (\%)} = \frac{\sum \text{Giờ chơi thực tế (Đơn đặt + Trận giải)}}{17 \times \text{Số ngày}} \times 100$$
  * Slot 30 phút tính $0.5$ giờ, slot 60 phút tính $1.0$ giờ.

### 2.2 Quy tắc Đặt sân & Đặt nhiều sân trong 1 đơn (Multi-Court Booking)
1. **Liên tục trên từng sân (Per-court Continuity):** Trên mỗi sân, các slot khách chọn bắt buộc phải liên tục (không để lại lỗ thủng 30 phút giữa chừng).
2. **Đặt nhiều sân (Multi-court):** Tối đa 3 sân trong 1 đơn. Giữa các sân:
   * Có thể diễn ra **cùng giờ (song song)**: Phục vụ công ty, hội nhóm giao lưu đánh nhiều sân cùng lúc.
   * Có thể diễn ra **nối tiếp nhau (chuyển sân)**: Sân 1 kết thúc lúc 18:00, Sân 2 bắt đầu lúc 18:00 (khoảng cách $\le 30$ phút).
   * **Chặn các khung giờ rời rạc:** Sân 1 sáng và Sân 2 tối (cách $> 30$ phút) bị từ chối để tránh kéo dài đơn qua nhiều ca trực gây thất thoát.
3. **Cọc & Giữ chỗ:**
   * Giữ chỗ tự động trong $15$ phút (`holdMinutes`). Sau 15 phút nếu chưa thanh toán cọc, Scheduler (`expireHolds`) tự động nhả slot về `AVAILABLE`.
   * Khách đặt online phải cọc **50% tiền sân sau ưu đãi hội viên** (không tính phí trọng tài vào cọc).
4. **Gắn nhãn công nợ:** Check-out cho phép kết thúc đơn còn nợ (khách quen trả sau), hệ thống gắn nhãn màu đỏ `CÒN NỢ: <số tiền>` trên bảng quản trị, không chặn luồng check-out.

### 2.3 Hội viên (Membership)
* Gói hội viên: **Club Member** (249.000đ/30 ngày) và **Plus Member** (499.000đ/30 ngày).
* Quyền lợi:
  * Giảm giá sân thường (5% - 10%) và sân VIP (5% - 10%).
  * Đặt sân trước: 14 ngày (Club) hoặc 21 ngày (Plus) so với 7 ngày của khách vãng lai.
  * Ưu đãi giữ chỗ và miễn phí đổi lịch báo trước 24 giờ.
* Đăng ký hội viên tạo phiếu thanh toán chờ. Chỉ kích hoạt khi thu đủ tiền tại quầy hoặc qua chuyển khoản.

### 2.4 Dịch vụ Trọng tài (Referee)
* Khách có thể chọn thuê trọng tài theo từng slot sân cụ thể.
* Ràng buộc hệ thống: 1 trọng tài không thể phân công cho 2 sân ở cùng một mốc thời gian.

### 2.5 Thanh toán & Đối soát
* **Tại quầy thu ngân (`/quay-thu` & modal thu tiền):** Chỉ ghi nhận tiền mặt (`CASH`), thủ quỹ kiểm đếm tiền trước khi bấm xác nhận.
* **Chuyển khoản VietQR:**
  * Sinh mã tham chiếu duy nhất: Tiền tố `CT` + 16 ký tự hex (ví dụ `CT65E7A81B...`).
  * Backend tạo chuỗi EMV CRC16 (`qrPayload`) và đường dẫn ảnh VietQR Napas 24/7 (`qrImageUrl` trỏ tới `img.vietqr.io` mẫu compact2).
  * Webhook SePay lắng nghe callback tiền vào tự động xác nhận đơn khi đủ tiền cọc.
* **Báo cáo chốt ca cuối ngày:** Hợp nhất cả doanh thu đơn đặt sân (`payments`) và doanh thu hội viên (`membershipPayments`), tránh đếm trùng.

---

## 3. KIẾN TRÚC & LUỒNG DỮ LIỆU

### 3.1 Sơ đồ kiến trúc tầng
```
[Trình duyệt Khách / Admin]
       │
       ▼ (HTTP/HTTPS Port 3000)
┌────────────────────────────────────────┐
│             Nginx Alpine               │
│  - Phục vụ React SPA (dist/index.html) │
│  - Bảo vệ Security Headers             │
│  - Ghi đè X-Forwarded-For: $remote_addr│
└──────────────────┬─────────────────────┘
                   │ (Reverse Proxy /api)
                   ▼ (Port 8080)
┌────────────────────────────────────────┐
│     Spring Boot 3.5.16 Application     │
│  ├── Tomcat (RemoteIpValve: native)    │
│  ├── Security & ApiAccessInterceptor   │
│  ├── Controllers (REST API Endpoints)  │
│  ├── Services (Nghiệp vụ, Lock, Audit) │
│  └── Repositories (Spring Data JPA)    │
└──────────────────┬─────────────────────┘
                   │
                   ▼ (Port 5432)
┌────────────────────────────────────────┐
│          PostgreSQL 16 DB              │
│  - 24 Bảng quan hệ chuẩn hóa           │
│  - Bảng app_documents (JSON Snapshot)  │
│  - Flyway Migrations V1 -> V8          │
└────────────────────────────────────────┘
```

---

## 4. DATABASE SCHEMA & FLYWAY MIGRATIONS

### 4.1 Danh sách bảng quan hệ

Hệ thống sử dụng PostgreSQL 16 với 24 bảng dữ liệu nghiệp vụ:
1. `accounts`: Tài khoản người dùng (ADMIN, STAFF, CUSTOMER)
2. `courts`: Danh mục sân tennis (A - Ngoài trời, B - Trong nhà, V - VIP)
3. `court_prices`: Bảng giá theo khung giờ và loại ngày (WEEKDAY/WEEKEND)
4. `court_schedules`: Các slot thời gian 30 phút của từng sân theo ngày
5. `orders`: Đơn đặt sân, tổng tiền, cọc, trạng thái (HOLDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED)
6. `bookings`: Thực thể đặt sân gắn với Order
7. `booking_slots`: Liên kết giữa Booking và CourtSchedule
8. `staff`: Nhân sự CLB (REFEREE, COACH, BALL_BOY)
9. `staff_schedules`: Ca làm việc của nhân sự
10. `booking_staff`: Phân công nhân sự cho từng slot đặt sân
11. `payments`: Chứng từ thu tiền (CASH, BANK_TRANSFER), số tiền, trạng thái
12. `refunds`: Biên lai hoàn tiền gắn với payment gốc
13. `tournaments`: Giải đấu thể thao (SINGLES, DOUBLES, TEAM)
14. `tournament_registrations`: Đăng ký tham gia giải và thu phí giải
15. `team_members`: Thành viên đội thi đấu
16. `matches`: Trận đấu trong sơ đồ loại trực tiếp
17. `match_slots`: Slot sân dành cho trận đấu
18. `match_staff`: Trọng tài bắt trận đấu
19. `drinks`: Danh mục đồ uống (dữ liệu lịch sử, ngừng kinh doanh từ V8)
20. `rental_items`: Thiết bị thuê (dữ liệu lịch sử, ngừng kinh doanh từ V8)
21. `order_products`: Chi tiết dòng sản phẩm trên đơn cũ
22. `club_settings`: Cấu hình chính sách cọc, giữ chỗ, hoàn tiền của CLB
23. `audit_logs`: Nhật ký kiểm toán thao tác hệ thống
24. `app_documents`: Bảng lưu trữ JSON động cho thông tin CLB, vé kích hoạt, OTP, thanh toán hội viên, khóa phân tán.

### 4.2 Chi tiết các migration Flyway (V1 - V8)

#### `V1__initial_schema.sql`
```sql
-- Normalized entities based on the supplied tennis ERD.

CREATE TABLE accounts (
    id uuid PRIMARY KEY,
    full_name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    phone varchar(255) NOT NULL,
    password_hash varchar(255),
    role varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE courts (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    type varchar(255) NOT NULL,
    description text,
    image_url varchar(255),
    status varchar(255) NOT NULL,
    base_price numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE court_prices (
    id uuid PRIMARY KEY,
    court_id uuid NOT NULL,
    day_type varchar(255) NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    price_per_hour numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE court_schedules (
    id uuid PRIMARY KEY,
    court_id uuid NOT NULL,
    schedule_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    price numeric(14,2) NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE orders (
    id uuid PRIMARY KEY,
    customer_account_id uuid,
    created_by_account_id uuid,
    customer_name varchar(255) NOT NULL,
    customer_phone varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    hold_expires_at timestamptz,
    subtotal numeric(14,2) NOT NULL DEFAULT 0,
    total_amount numeric(14,2) NOT NULL DEFAULT 0,
    deposit_required numeric(14,2) NOT NULL DEFAULT 0,
    paid_amount numeric(14,2) NOT NULL DEFAULT 0,
    payment_status varchar(255) NOT NULL,
    invoice_number varchar(255),
    issued_at timestamptz,
    created_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL,
    status varchar(255) NOT NULL,
    check_in_at timestamptz,
    check_out_at timestamptz,
    created_at timestamptz NOT NULL
);

CREATE TABLE booking_slots (
    id uuid PRIMARY KEY,
    booking_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    released_at timestamptz
);

CREATE TABLE booking_staff (
    id uuid PRIMARY KEY,
    booking_id uuid NOT NULL,
    staff_schedule_id uuid NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    released_at timestamptz
);

CREATE TABLE drinks (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    unit varchar(255) NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE rental_items (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    category varchar(255) NOT NULL,
    brand varchar(255),
    price_per_hour numeric(14,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE order_products (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    item_type varchar(255) NOT NULL,
    drink_id uuid,
    rental_item_id uuid,
    quantity integer NOT NULL DEFAULT 0,
    rent_start_at timestamptz,
    rent_end_at timestamptz,
    returned_at timestamptz,
    unit_price numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
    id uuid PRIMARY KEY,
    order_id uuid,
    registration_id uuid,
    received_by_account_id uuid,
    type varchar(255) NOT NULL,
    method varchar(255) NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0,
    transaction_code varchar(255) NOT NULL,
    qr_content text,
    qr_expires_at timestamptz,
    status varchar(255) NOT NULL,
    paid_at timestamptz NOT NULL
);

CREATE TABLE refunds (
    id uuid PRIMARY KEY,
    payment_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0,
    reason varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    processed_by_account_id uuid,
    refunded_at timestamptz NOT NULL
);

CREATE TABLE staff (
    id uuid PRIMARY KEY,
    full_name varchar(255) NOT NULL,
    phone varchar(255) NOT NULL,
    type varchar(255) NOT NULL,
    level varchar(255),
    hourly_rate numeric(14,2) NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE staff_schedules (
    id uuid PRIMARY KEY,
    staff_id uuid NOT NULL,
    work_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE tournaments (
    id uuid PRIMARY KEY,
    organizer_account_id uuid,
    name varchar(255) NOT NULL,
    format varchar(255) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    location varchar(255) NOT NULL,
    registration_fee numeric(14,2) NOT NULL DEFAULT 0,
    registration_deadline date NOT NULL,
    max_participants integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE tournament_registrations (
    id uuid PRIMARY KEY,
    tournament_id uuid NOT NULL,
    account_id uuid NOT NULL,
    registered_by_account_id uuid,
    team_name varchar(255) NOT NULL,
    skill_level varchar(255),
    status varchar(255) NOT NULL,
    registered_at timestamptz NOT NULL
);

CREATE TABLE team_members (
    id uuid PRIMARY KEY,
    registration_id uuid NOT NULL,
    tournament_id uuid NOT NULL,
    account_id uuid,
    member_name varchar(255),
    phone varchar(255)
);

CREATE TABLE matches (
    id uuid PRIMARY KEY,
    tournament_id uuid NOT NULL,
    registration1_id uuid,
    registration2_id uuid,
    winner_registration_id uuid,
    round_number integer NOT NULL DEFAULT 0,
    bracket_index integer NOT NULL DEFAULT 0,
    round_name varchar(255) NOT NULL,
    score varchar(255),
    status varchar(255) NOT NULL,
    updated_by_account_id uuid
);

CREATE TABLE match_slots (
    id uuid PRIMARY KEY,
    match_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    released_at timestamptz
);

CREATE TABLE match_staff (
    id uuid PRIMARY KEY,
    match_id uuid NOT NULL,
    staff_schedule_id uuid NOT NULL,
    role varchar(255) NOT NULL,
    released_at timestamptz
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY,
    actor varchar(255) NOT NULL,
    action varchar(255) NOT NULL,
    detail text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE club_settings (
    id uuid PRIMARY KEY,
    hold_minutes integer NOT NULL DEFAULT 0,
    deposit_percent integer NOT NULL DEFAULT 0,
    cancel_refund_percent integer NOT NULL DEFAULT 0
);

ALTER TABLE court_prices ADD CONSTRAINT fk_court_prices_court_id FOREIGN KEY (court_id) REFERENCES courts(id);
ALTER TABLE court_schedules ADD CONSTRAINT fk_court_schedules_court_id FOREIGN KEY (court_id) REFERENCES courts(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_account_id FOREIGN KEY (customer_account_id) REFERENCES accounts(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_created_by_account_id FOREIGN KEY (created_by_account_id) REFERENCES accounts(id);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE booking_slots ADD CONSTRAINT fk_booking_slots_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE booking_slots ADD CONSTRAINT fk_booking_slots_schedule_id FOREIGN KEY (schedule_id) REFERENCES court_schedules(id);
ALTER TABLE booking_staff ADD CONSTRAINT fk_booking_staff_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE booking_staff ADD CONSTRAINT fk_booking_staff_staff_schedule_id FOREIGN KEY (staff_schedule_id) REFERENCES staff_schedules(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_drink_id FOREIGN KEY (drink_id) REFERENCES drinks(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_rental_item_id FOREIGN KEY (rental_item_id) REFERENCES rental_items(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_registration_id FOREIGN KEY (registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_received_by_account_id FOREIGN KEY (received_by_account_id) REFERENCES accounts(id);
ALTER TABLE refunds ADD CONSTRAINT fk_refunds_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id);
ALTER TABLE refunds ADD CONSTRAINT fk_refunds_processed_by_account_id FOREIGN KEY (processed_by_account_id) REFERENCES accounts(id);
ALTER TABLE staff_schedules ADD CONSTRAINT fk_staff_schedules_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id);
ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_organizer_account_id FOREIGN KEY (organizer_account_id) REFERENCES accounts(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_account_id FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_registered_by_account_id FOREIGN KEY (registered_by_account_id) REFERENCES accounts(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_registration_id FOREIGN KEY (registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_account_id FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_registration1_id FOREIGN KEY (registration1_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_registration2_id FOREIGN KEY (registration2_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_winner_registration_id FOREIGN KEY (winner_registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_updated_by_account_id FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id);
ALTER TABLE match_slots ADD CONSTRAINT fk_match_slots_match_id FOREIGN KEY (match_id) REFERENCES matches(id);
ALTER TABLE match_slots ADD CONSTRAINT fk_match_slots_schedule_id FOREIGN KEY (schedule_id) REFERENCES court_schedules(id);
ALTER TABLE match_staff ADD CONSTRAINT fk_match_staff_match_id FOREIGN KEY (match_id) REFERENCES matches(id);
ALTER TABLE match_staff ADD CONSTRAINT fk_match_staff_staff_schedule_id FOREIGN KEY (staff_schedule_id) REFERENCES staff_schedules(id);
```

#### `V2__constraints_and_indexes.sql`
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE UNIQUE INDEX uq_accounts_email ON accounts(lower(email));
CREATE UNIQUE INDEX uq_orders_invoice ON orders(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE UNIQUE INDEX uq_payments_transaction ON payments(transaction_code);
ALTER TABLE courts ADD CHECK (base_price > 0);
ALTER TABLE court_prices ADD CHECK (price_per_hour > 0 AND end_time > start_time);
ALTER TABLE court_prices ADD CONSTRAINT no_court_price_overlap EXCLUDE USING gist
(court_id WITH =, day_type WITH =, tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') WITH &&);
ALTER TABLE court_schedules ADD CHECK (end_time > start_time AND price > 0);
ALTER TABLE court_schedules ADD CONSTRAINT uq_court_slot UNIQUE(court_id, schedule_date, start_time);
ALTER TABLE court_schedules ADD CONSTRAINT no_court_slot_overlap EXCLUDE USING gist
(court_id WITH =, tsrange(schedule_date + start_time, schedule_date + end_time, '[)') WITH &&);
ALTER TABLE staff_schedules ADD CHECK (end_time > start_time);
ALTER TABLE staff_schedules ADD CONSTRAINT uq_staff_slot UNIQUE(staff_id, work_date, start_time);
ALTER TABLE staff_schedules ADD CONSTRAINT no_staff_slot_overlap EXCLUDE USING gist
(staff_id WITH =, tsrange(work_date + start_time, work_date + end_time, '[)') WITH &&);
CREATE UNIQUE INDEX uq_active_booking_slot ON booking_slots(schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_match_slot ON match_slots(schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_booking_staff ON booking_staff(staff_schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_match_staff ON match_staff(staff_schedule_id) WHERE released_at IS NULL;
ALTER TABLE orders ADD CHECK (paid_amount >= 0 AND paid_amount <= total_amount AND deposit_required >= 0 AND deposit_required <= total_amount);
ALTER TABLE bookings ADD CHECK (check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at >= check_in_at));
ALTER TABLE bookings ADD CONSTRAINT uq_booking_order UNIQUE(id, order_id);
ALTER TABLE order_products ADD CONSTRAINT fk_product_booking_order FOREIGN KEY(booking_id, order_id) REFERENCES bookings(id,order_id);
ALTER TABLE order_products ADD CHECK (quantity > 0 AND unit_price > 0);
ALTER TABLE order_products ADD CHECK ((item_type='DRINK' AND drink_id IS NOT NULL AND rental_item_id IS NULL) OR (item_type='RENTAL' AND drink_id IS NULL AND rental_item_id IS NOT NULL AND rent_start_at IS NOT NULL AND rent_end_at > rent_start_at));
ALTER TABLE drinks ADD CHECK (unit_price > 0 AND stock_quantity >= 0);
ALTER TABLE rental_items ADD CHECK (price_per_hour > 0 AND stock_quantity >= 0);
ALTER TABLE staff ADD CHECK (hourly_rate > 0);
ALTER TABLE payments ADD CHECK (amount > 0 AND ((order_id IS NOT NULL AND registration_id IS NULL AND type IN ('DEPOSIT','BALANCE')) OR (order_id IS NULL AND registration_id IS NOT NULL AND type='TOURNAMENT_FEE')));
ALTER TABLE refunds ADD CHECK (amount > 0);
ALTER TABLE tournaments ADD CHECK (end_date >= start_date AND registration_deadline <= start_date AND registration_fee >= 0 AND max_participants >= 2);
ALTER TABLE tournament_registrations ADD CONSTRAINT uq_tournament_account UNIQUE(tournament_id, account_id);
ALTER TABLE tournament_registrations ADD CONSTRAINT uq_registration_tournament UNIQUE(id,tournament_id);
ALTER TABLE team_members ADD CONSTRAINT fk_member_registration_tournament FOREIGN KEY(registration_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
CREATE UNIQUE INDEX uq_member_tournament_account ON team_members(tournament_id,account_id) WHERE account_id IS NOT NULL;
ALTER TABLE team_members ADD CHECK (account_id IS NOT NULL OR member_name IS NOT NULL);
ALTER TABLE matches ADD CONSTRAINT fk_reg1_tournament FOREIGN KEY(registration1_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CONSTRAINT fk_reg2_tournament FOREIGN KEY(registration2_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CONSTRAINT fk_winner_tournament FOREIGN KEY(winner_registration_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CHECK (registration1_id IS NULL OR registration2_id IS NULL OR registration1_id <> registration2_id);
ALTER TABLE matches ADD CHECK (winner_registration_id IS NULL OR (registration1_id IS NOT NULL AND registration2_id IS NOT NULL AND winner_registration_id IN (registration1_id,registration2_id)));
ALTER TABLE matches ADD CONSTRAINT uq_bracket UNIQUE(tournament_id,round_number,bracket_index);
ALTER TABLE club_settings ADD CHECK (hold_minutes BETWEEN 1 AND 60 AND deposit_percent BETWEEN 1 AND 100 AND cancel_refund_percent BETWEEN 0 AND 100);
CREATE INDEX idx_orders_hold ON orders(status,hold_expires_at);
CREATE INDEX idx_orders_customer ON orders(customer_account_id);
CREATE INDEX idx_bookings_order ON bookings(order_id);
CREATE INDEX idx_booking_slots_booking ON booking_slots(booking_id);
CREATE INDEX idx_booking_staff_booking ON booking_staff(booking_id);
CREATE INDEX idx_products_order ON order_products(order_id);
CREATE INDEX idx_rental_overlap ON order_products(rental_item_id,rent_start_at,rent_end_at) WHERE returned_at IS NULL;
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_registration ON payments(registration_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
-- Both allocation tables lock the same parent slot before checking the other table.
CREATE FUNCTION guard_court_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.released_at IS NULL THEN
  PERFORM id FROM court_schedules WHERE id=NEW.schedule_id FOR UPDATE;
  IF (TG_TABLE_NAME='booking_slots' AND EXISTS(SELECT 1 FROM match_slots WHERE schedule_id=NEW.schedule_id AND released_at IS NULL)) OR
     (TG_TABLE_NAME='match_slots' AND EXISTS(SELECT 1 FROM booking_slots WHERE schedule_id=NEW.schedule_id AND released_at IS NULL)) THEN
   RAISE EXCEPTION 'Court slot already allocated' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_booking_slot BEFORE INSERT OR UPDATE ON booking_slots FOR EACH ROW EXECUTE FUNCTION guard_court_allocation();
CREATE TRIGGER guard_match_slot BEFORE INSERT OR UPDATE ON match_slots FOR EACH ROW EXECUTE FUNCTION guard_court_allocation();
CREATE FUNCTION guard_staff_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.released_at IS NULL THEN
  PERFORM id FROM staff_schedules WHERE id=NEW.staff_schedule_id FOR UPDATE;
  IF (TG_TABLE_NAME='booking_staff' AND EXISTS(SELECT 1 FROM match_staff WHERE staff_schedule_id=NEW.staff_schedule_id AND released_at IS NULL)) OR
     (TG_TABLE_NAME='match_staff' AND EXISTS(SELECT 1 FROM booking_staff WHERE staff_schedule_id=NEW.staff_schedule_id AND released_at IS NULL)) THEN
   RAISE EXCEPTION 'Staff slot already allocated' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_booking_staff BEFORE INSERT OR UPDATE ON booking_staff FOR EACH ROW EXECUTE FUNCTION guard_staff_allocation();
CREATE TRIGGER guard_match_staff BEFORE INSERT OR UPDATE ON match_staff FOR EACH ROW EXECUTE FUNCTION guard_staff_allocation();
```

#### `V3__auth_content_and_current_booking.sql`
```sql
ALTER TABLE accounts ADD COLUMN auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN metadata text NOT NULL DEFAULT '{}';
ALTER TABLE club_settings ADD COLUMN policies text NOT NULL DEFAULT '{}';
ALTER TABLE courts ADD COLUMN address text;
ALTER TABLE courts ADD COLUMN amenities text;
ALTER TABLE courts ADD COLUMN image_is_illustration boolean NOT NULL DEFAULT true;
ALTER TABLE booking_staff ADD COLUMN court_schedule_id uuid REFERENCES court_schedules(id);
ALTER TABLE order_products ADD COLUMN item_condition varchar(255);
ALTER TABLE order_products ADD COLUMN issued_at timestamptz;
-- Overpayments after a cheaper reschedule must remain visible for reconciliation.
DO $$ DECLARE c record; BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='orders'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%paid_amount%' LOOP EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I',c.conname); END LOOP; END $$;
ALTER TABLE orders ADD CONSTRAINT chk_order_money CHECK(paid_amount>=0 AND total_amount>=0 AND deposit_required>=0 AND deposit_required<=total_amount);
CREATE TABLE app_documents (document_key varchar(255) PRIMARY KEY, data text NOT NULL, version bigint);
```

#### `V4__configure_admin_account.sql`
```sql
-- For nam-dev 931496f (UUID accounts schema, after V3).
-- One-time credential setup; preserve profile and invalidate existing sessions.
INSERT INTO accounts (id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
VALUES (
    gen_random_uuid(), 'Quản trị viên', 'admin@gmail.com', '',
    '$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW',
    'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, 0
)
ON CONFLICT (lower(email)) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    auth_version = accounts.auth_version + 1;
```

#### `V5__customer_booking_support.sql`
```sql
-- Preserve existing bookings and their IDs/prices. Only unused future hourly slots
-- can be safely split; referenced historical slots remain unchanged.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM court_schedules s WHERE status='AVAILABLE' AND schedule_date>=CURRENT_DATE
   AND end_time-start_time=interval '1 hour'
   AND NOT EXISTS(SELECT FROM booking_slots b WHERE b.schedule_id=s.id)
   AND NOT EXISTS(SELECT FROM match_slots m WHERE m.schedule_id=s.id)
 LOOP
   UPDATE court_schedules SET end_time=r.start_time+interval '30 minutes',price=r.price/2 WHERE id=r.id;
   INSERT INTO court_schedules(id,court_id,schedule_date,start_time,end_time,price,status,version)
   VALUES(gen_random_uuid(),r.court_id,r.schedule_date,r.start_time+interval '30 minutes',r.end_time,r.price/2,'AVAILABLE',0);
 END LOOP;
 FOR r IN SELECT * FROM staff_schedules s WHERE status='AVAILABLE' AND work_date>=CURRENT_DATE
   AND end_time-start_time=interval '1 hour'
   AND NOT EXISTS(SELECT FROM booking_staff b WHERE b.staff_schedule_id=s.id)
   AND NOT EXISTS(SELECT FROM match_staff m WHERE m.staff_schedule_id=s.id)
 LOOP
   UPDATE staff_schedules SET end_time=r.start_time+interval '30 minutes' WHERE id=r.id;
   INSERT INTO staff_schedules(id,staff_id,work_date,start_time,end_time,status)
   VALUES(gen_random_uuid(),r.staff_id,r.work_date,r.start_time+interval '30 minutes',r.end_time,'AVAILABLE');
 END LOOP;
END $$;
ALTER TABLE team_members ADD COLUMN email varchar(254);
CREATE UNIQUE INDEX uq_tournament_player_email ON team_members(tournament_id,lower(email)) WHERE email IS NOT NULL;
-- Payment intents and provider events are persisted in app_documents, using the
-- existing transaction/advisory lock. Indexed prefixes support SQL reconciliation.
CREATE INDEX idx_documents_prefix ON app_documents(document_key text_pattern_ops);
```

#### `V6__complete_indoor_and_vip_courts.sql`
```sql
-- Upgrade existing installations that still have only the original four courts.
-- Empty databases are populated by DemoDataInitializer or the explicit SQL fixtures.
-- Existing court IDs, prices, statuses and bookings must remain unchanged.
INSERT INTO courts(id,name,type,description,image_url,status,base_price,address,amenities,image_is_illustration)
SELECT gen_random_uuid(), target.code, 'HARD',
       CASE WHEN target.code LIKE 'B%' THEN 'Sân tennis trong nhà' ELSE 'Sân tennis VIP' END,
       CASE WHEN target.code LIKE 'B%' THEN '/guest/zone-b-indoor.webp' ELSE '/guest/zone-v-lounge.webp' END,
       'ACTIVE', target.rate, '', '', true
FROM (VALUES ('B01',300000),('B02',300000),('B03',300000),('B04',300000),('V01',500000),('V02',500000)) AS target(code,rate)
WHERE EXISTS (SELECT FROM courts)
  AND NOT EXISTS (
    SELECT FROM courts c
    WHERE upper(regexp_replace(trim(c.name), '^(Sân|San)\s+', '', 'i')) = target.code
  );
-- PresentationService generates actual 30-minute schedules from each court's
-- tariff/base_price when a date is opened. No historical slots are rewritten.
```

#### `V7__customer_booking_policy.sql`
```sql
-- Keep configured policies; fill missing customer cancellation/change deadlines.
UPDATE club_settings
SET hold_minutes = CASE WHEN hold_minutes = 10 THEN 5 ELSE hold_minutes END,
    policies = ('{"cancelCutoffMinutes":1440,"changeCutoffMinutes":1440}'::jsonb
                || policies::jsonb)::text;
```

#### `V8__retire_product_services.sql`
```sql
-- Retain historical lines and receipts. No new beverage/equipment business.
UPDATE drinks SET status = 'INACTIVE';
UPDATE rental_items SET status = 'INACTIVE';

CREATE FUNCTION reject_retired_product_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product services have been retired; only referee services may be added'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER reject_new_order_products
BEFORE INSERT ON order_products
FOR EACH ROW EXECUTE FUNCTION reject_retired_product_service();
```

#### `V9__vouchers_and_redemptions.sql`
```sql
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    value NUMERIC(12, 2) NOT NULL,
    min_order NUMERIC(12, 2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(12, 2),
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    usage_limit INT,
    used_count INT NOT NULL DEFAULT 0,
    per_user_limit INT DEFAULT 1,
    member_only BOOLEAN NOT NULL DEFAULT FALSE,
    new_user_only BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    discount_amount NUMERIC(12, 2) NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_voucher_redemptions_account ON voucher_redemptions(account_id);
CREATE INDEX idx_voucher_redemptions_voucher ON voucher_redemptions(voucher_id);

INSERT INTO vouchers (code, type, value, min_order, max_discount, usage_limit, per_user_limit, new_user_only, member_only, description)
VALUES
  ('WELCOME', 'FIXED', 50000, 100000, 50000, 500, 1, TRUE, FALSE, 'Giảm 50.000 đ cho khách hàng đặt sân lần đầu'),
  ('HE2026', 'FIXED', 50000, 150000, 50000, 1000, 2, FALSE, FALSE, 'Giảm 50.000 đ mùa hè sôi động 2026'),
  ('COURTLY50K', 'FIXED', 50000, 100000, 50000, 300, 1, FALSE, FALSE, 'Voucher tri ân 50.000 đ'),
  ('VIP10', 'PERCENT', 10, 200000, 100000, 1000, 5, FALSE, TRUE, 'Giảm 10% (tối đa 100k) dành riêng cho hội viên'),
  ('FLASH25', 'PERCENT', 25, 100000, 150000, 200, 1, FALSE, FALSE, 'Ưu đãi Giờ Vàng giảm 25%');
```

## 5. CẤU HÌNH HỆ THỐNG & DEPLOYMENT

### `backend/src/main/resources/application.yml`
```yaml
server:
  port: ${SERVER_PORT:8080}
  forward-headers-strategy: native
  servlet:
    session:
      timeout: 8h
      cookie:
        http-only: true
        same-site: lax
        secure: ${COOKIE_SECURE:false}
  error:
    include-message: never
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/courtly}
    username: ${DB_USERNAME:courtly}
    password: ${DB_PASSWORD:courtly_local}
    hikari:
      maximum-pool-size: 10
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
  flyway:
    enabled: true
  jackson:
    default-property-inclusion: non_null
courtly:
  demo-mode: ${DEMO_MODE:false}
  payment:
    mode: ${PAYMENT_MODE:DEMO}
    bank-bin: ${PAYMENT_BANK_BIN:970422}
    account-number: ${PAYMENT_ACCOUNT_NUMBER:0345678999}
    account-name: ${PAYMENT_ACCOUNT_NAME:CLB TENNIS COURTLY}
    webhook-key: ${SEPAY_WEBHOOK_KEY:}
  admin-email: ${ADMIN_EMAIL:admin@gmail.com}
  admin-password: ${ADMIN_PASSWORD:}
  seed-demo: ${SEED_DEMO:false}
  security:
    otp-secret: ${OTP_SECRET:CourtlySecureHmacSecretKey2026!}
  allowed-origin: ${FRONTEND_ORIGIN:http://localhost:5173}
  mail:
    host: ${SMTP_HOST:smtp.gmail.com}
    port: ${SMTP_PORT:587}
    username: ${SMTP_USERNAME:kietdlv@gmail.com}
    password: ${SMTP_PASSWORD:}
    from: ${SMTP_FROM:kietdlv@gmail.com}
    from-name: ${SMTP_FROM_NAME:Courtly Tennis Club}
logging:
  level:
    org.hibernate.SQL: warn
```

### `frontend/nginx.conf`
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### `compose.yaml`
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-courtly}
      POSTGRES_USER: ${POSTGRES_USER:-courtly}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-courtly_local}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5433}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 12
  backend:
    build: ./backend
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-courtly}
      DB_USERNAME: ${POSTGRES_USER:-courtly}
      DB_PASSWORD: ${POSTGRES_PASSWORD:-courtly_local}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@gmail.com}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      DEMO_MODE: ${DEMO_MODE:-false}
      PAYMENT_MODE: ${PAYMENT_MODE:-DEMO}
      PAYMENT_BANK_BIN: ${PAYMENT_BANK_BIN:-970422}
      PAYMENT_ACCOUNT_NUMBER: ${PAYMENT_ACCOUNT_NUMBER:-0345678999}
      PAYMENT_ACCOUNT_NAME: ${PAYMENT_ACCOUNT_NAME:-CLB TENNIS COURTLY}
      SEPAY_WEBHOOK_KEY: ${SEPAY_WEBHOOK_KEY:-}
      SEED_DEMO: ${SEED_DEMO:-false}
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
      OTP_SECRET: ${OTP_SECRET:-CourtlySecureHmacSecretKey2026!}
      FRONTEND_ORIGIN: http://localhost:3000
      SMTP_HOST: ${SMTP_HOST:-smtp.gmail.com}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USERNAME: ${SMTP_USERNAME:-kietdlv@gmail.com}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      SMTP_FROM: ${SMTP_FROM:-kietdlv@gmail.com}
      SMTP_FROM_NAME: ${SMTP_FROM_NAME:-Courtly Tennis Club}
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8081}:8080"
    depends_on:
      postgres:
        condition: service_healthy
  frontend:
    build: ./frontend
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - backend
volumes:
  postgres_data:
```

## 6. TOÀN BỘ MÃ NGUỒN BACKEND (JAVA SPRING BOOT)

### 6.1 Controllers

#### File: `backend/src/main/java/com/courtly/controller/AuthController.java`
```java
package com.courtly.controller;

import com.courtly.service.AuthService;
import jakarta.servlet.http.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
  private final AuthService auth;

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/auth/session")
  public Map<String, Object> session(HttpServletRequest r) {
    return auth.session(r);
  }

  @PostMapping("/auth/{action}")
  public Map<String, Object> action(
      @PathVariable String action,
      @RequestBody Map<String, Object> body,
      HttpServletRequest req,
      HttpServletResponse res) {
    return auth.action(action, body, req, res);
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/CatalogController.java`
```java
package com.courtly.controller;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.service.CatalogService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/catalog")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class CatalogController {
  private final CatalogService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.repository.AccountRepository accounts;
  private final com.courtly.service.RequestService requests;

  @PostMapping("/{collection}")
  public Map<String, Object> create(
      @PathVariable String collection,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection,
        request,
        () -> com.courtly.util.Rules.map("id", service.save(collection, null, request)));
  }

  @PutMapping("/{collection}/{id}")
  public Map<String, Object> update(
      @PathVariable String collection,
      @PathVariable UUID id,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    if (collection.equals("accounts")) {
      var actor = auth.current(req);
      var old = accounts.findById(id).orElseThrow();
      if (auth.owner(old) || id.equals(actor.getId()))
        com.courtly.util.Rules.require(
            "ADMIN".equals(request.role()) && "ACTIVE".equals(request.status()),
            "Không được tự khóa/hạ quyền hoặc thay quyền chủ hệ thống");
      if (old.getPasswordHash() != null)
        com.courtly.util.Rules.require(
            old.getEmail().equalsIgnoreCase(request.email()),
            "Không đổi email đã liên kết đăng nhập");
    }
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection + ":" + id,
        request,
        () -> com.courtly.util.Rules.map("id", service.save(collection, id, request)));
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/ContentController.java`
```java
package com.courtly.controller;

import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ContentController {
  private final ContentService content;
  private final AuthService auth;

  @GetMapping("/public/content")
  public Map<String, Object> publicContent() {
    return content.get(null);
  }

  @GetMapping("/content")
  public Map<String, Object> content(HttpServletRequest r) {
    return content.get(auth.current(r));
  }

  @GetMapping("/feedback/mine")
  public List<Map<String, Object>> mine(HttpServletRequest r) {
    return content.mine(auth.current(r));
  }

  @RequestMapping(
      value = {
        "/feedback",
        "/content/club",
        "/content/articles",
        "/content/articles/{id}",
        "/content/feedback/{id}"
      },
      method = {RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH})
  public Map<String, Object> save(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return content.save(auth.current(r), r.getMethod(), r.getRequestURI(), b);
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/GuestController.java`
```java
package com.courtly.controller;
import static com.courtly.util.Rules.*;
import com.courtly.service.*;
import com.courtly.repository.*;
import com.courtly.dto.request.RegistrationRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor
public class GuestController {
 private final AuthService auth;private final RequestService requests;private final TournamentService tournaments;private final TournamentRepository tournamentRepo;private final JdbcTemplate jdbc;private final DocumentService docs;
 @PostMapping("/api/guest/tournaments/{id}/register") @Transactional
 public Map<String,Object> register(@PathVariable UUID id,@RequestBody Map<String,Object>b,HttpServletRequest req){
  var a=auth.current(req);
  return requests.execute(a.getId(),(String)b.get("requestId"),"guest-register:"+id,b,()->{
   require(Boolean.TRUE.equals(b.get("adult"))&&Boolean.TRUE.equals(b.get("rules")),"Cần xác nhận đủ 18 tuổi và đồng ý điều lệ");
   String phone=text((String)b.get("phone"),"Điện thoại");require(phone.matches("\\+?[0-9 ()-]{9,20}"),"Điện thoại không hợp lệ");
   String name=text((String)b.get("name"),"Tên người chơi");require(name.length()<=100,"Tên quá dài");
   var t=tournamentRepo.findForUpdate(id).orElseThrow();
   var emails=new ArrayList<String>();emails.add(a.getEmail().toLowerCase(Locale.ROOT));var extra=new ArrayList<String>();
   if(!"SINGLES".equals(t.getFormat())){
    String mate=text((String)b.get("partnerName"),"Tên đồng đội"),email=text((String)b.get("partnerEmail"),"Email đồng đội").toLowerCase(Locale.ROOT);
    require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")&&email.length()<=254,"Email đồng đội không hợp lệ");
    require(!email.equalsIgnoreCase(a.getEmail()),"Hai người chơi phải khác nhau");extra.add(mate);emails.add(email);
   }
   for(String email:emails)require(jdbc.queryForObject("SELECT count(*) FROM team_members m LEFT JOIN accounts a ON a.id=m.account_id WHERE m.tournament_id=? AND (lower(m.email)=? OR lower(a.email)=?)",Integer.class,id,email,email)==0,"Người chơi đã đăng ký giải này");
   UUID reg=tournaments.register(id,new RegistrationRequest(a.getId(),"SINGLES".equals(t.getFormat())?name:text((String)b.get("teamName"),"Tên đội"),extra));
   var members=jdbc.queryForList("SELECT id,account_id FROM team_members WHERE registration_id=? ORDER BY account_id NULLS LAST",reg);
   for(var m:members)jdbc.update("UPDATE team_members SET email=? WHERE id=?",m.get("account_id")!=null?emails.get(0):emails.get(1),m.get("id"));
   docs.put("registration-details:"+reg,map("id",reg,"accountId",a.getId(),"name",name,"phone",phone,"consentedAt",java.time.Instant.now().toString(),"adult",true));
   return map("id",reg);
  });
 }
}
```

#### File: `backend/src/main/java/com/courtly/controller/MembershipController.java`
```java
package com.courtly.controller;

import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/membership")
@RequiredArgsConstructor
public class MembershipController {
  private final MembershipService service;
  private final AuthService auth;

  @RequestMapping(
      value = {"/plans", "/requests", "/requests/{id}/{action}"},
      method = {RequestMethod.POST, RequestMethod.PUT})
  public Map<String, Object> action(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.action(auth.current(r), r.getMethod(), r.getRequestURI(), b);
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/OrderController.java`
```java
package com.courtly.controller;

import com.courtly.dto.request.BookingRequest;
import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OrderController {
  private final OrderApplicationService service;
  private final AuthService auth;
  private final VoucherService vouchers;

  @PostMapping("/orders")
  public Map<String, Object> create(@Valid @RequestBody BookingRequest b, HttpServletRequest r) {
    return service.create(b, auth.current(r));
  }

  @PostMapping("/booking/options")
  public Map<String, Object> options(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.options(b, auth.current(r));
  }

  @GetMapping("/orders/{id}/cancellation-preview")
  public Map<String, Object> cancellationPreview(@PathVariable UUID id, HttpServletRequest r) {
    return service.cancellationPreview(id, auth.current(r));
  }

  @GetMapping("/public/vouchers")
  public List<Map<String, Object>> vouchers() {
    return vouchers.listAvailable();
  }

  @PostMapping("/public/vouchers/validate")
  public Map<String, Object> validateVoucher(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    String code = (String) body.get("code");
    java.math.BigDecimal amount = PresentationService.decimal(body.get("amount"));
    UUID accountId = auth.optCurrent(r).map(com.courtly.entity.Account::getId).orElse(null);
    return vouchers.calculate(code, amount, accountId);
  }

  @GetMapping("/orders/{id}/extension-options")
  public Map<String, Object> extensionOptions(@PathVariable UUID id, HttpServletRequest r) {
    return service.extensionOptions(id, auth.current(r));
  }

  @PostMapping("/orders/{id}/preview")
  public Map<String, Object> preview(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.preview(id, b, auth.current(r));
  }

  @PatchMapping("/orders/{id}/schedule")
  public Map<String, Object> move(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.move(id, b, auth.current(r));
  }

  @PostMapping("/orders/{id}/{action}")
  public Map<String, Object> action(
      @PathVariable UUID id,
      @PathVariable String action,
      @RequestBody(required = false) Map<String, Object> b,
      HttpServletRequest r) {
    return service.action(id, action, b, auth.current(r));
  }

}
```

#### File: `backend/src/main/java/com/courtly/controller/OverviewController.java`
```java
package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OverviewController {
  private final PresentationService presentation;
  private final ScheduleService schedules;
  private final SettingsService settings;
  private final AuthService auth;
  private final RequestService requests;

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "UP", "runtime", "Spring Boot", "database", "PostgreSQL");
  }

  @GetMapping("/overview")
  public Map<String, Object> get(@RequestParam LocalDate date, HttpServletRequest r) {
    return presentation.get(date, auth.current(r));
  }

  @GetMapping("/public/overview")
  public Map<String, Object> publicOverview(@RequestParam LocalDate date) {
    return presentation.get(date, null);
  }

  @PostMapping("/schedules/generate")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> generate(
      @Valid @RequestBody ScheduleRequest body, HttpServletRequest r) {
    var a = auth.current(r);
    return requests.execute(
        a.getId(),
        null,
        "generate",
        body,
        () -> {
          schedules.generate(body.date());
          return Map.of("ok", true);
        });
  }

  @PutMapping("/settings")
  @PreAuthorize("hasRole('ADMIN')")
  public void settings(@Valid @RequestBody SettingsRequest b) {
    settings.update(b);
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/PaymentController.java`
```java
package com.courtly.controller;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
  private final PaymentService service;
  private final com.courtly.repository.CustomerOrderRepository orders;
  private final OrderService booking;
  private final RequestService requests;
  private final AuthService auth;
  private final ObjectMapper mapper;
  private final jakarta.validation.Validator validator;

  @GetMapping("/cash-desk")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  @org.springframework.transaction.annotation.Transactional
  public List<Map<String, Object>> cashDesk(HttpServletRequest r) {
    auth.cashier(auth.current(r));
    booking.expireHolds();
    return orders.findAllWithCustomerAccount().stream()
        .filter(o -> Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus())
            && o.getTotalAmount().compareTo(o.getPaidAmount()) > 0)
        .limit(100)
        .map(o -> map("id", o.getId(), "name", o.getCustomerName(), "status", o.getStatus(),
            "total", o.getTotalAmount(), "paid", o.getPaidAmount(), "deposit", o.getDepositRequired(),
            "due", o.getTotalAmount().subtract(o.getPaidAmount()), "holdUntil", o.getHoldExpiresAt()))
        .toList();
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> collect(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    auth.cashier(a);
    require("CASH".equals(b.get("method")), "Chuyển khoản chỉ được ghi nhận qua webhook ngân hàng");
    return requests.execute(
        a.getId(),
        "receipt:" + AuthService.hash(text((String) b.get("transactionCode"), "Mã giao dịch")),
        "payment",
        b,
        () -> map("id", service.collect(dto(b, PaymentRequest.class))));
  }

  @PostMapping("/{id}/refunds")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> refund(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    auth.admin(a);
    require(b.get("requestId") instanceof String, "Thiếu mã yêu cầu hoàn tiền");
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        "refund:" + id,
        b,
        () -> map("id", service.refund(id, dto(b, RefundRequest.class))));
  }

  private <T> T dto(Object value, Class<T> type) {
    var result = mapper.convertValue(value, type);
    var errors = validator.validate(result);
    require(
        errors.isEmpty(),
        errors.stream()
            .map(e -> e.getPropertyPath() + ": " + e.getMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ"));
    return result;
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/ProfileController.java`
```java
package com.courtly.controller;

import static com.courtly.util.Rules.*;

import com.courtly.repository.AccountRepository;
import com.courtly.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ProfileController {
  private final AuthService auth;
  private final AccountRepository accounts;

  @PatchMapping("/api/profile")
  @Transactional
  public Map<String, Object> profile(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    var a = auth.current(r);
    require(
        b.keySet().stream().allMatch(k -> Set.of("name", "phone").contains(k)),
        "Chỉ được sửa họ tên và điện thoại");
    a.setFullName(text((String) b.get("name"), "Họ tên"));
    String phone = String.valueOf(b.getOrDefault("phone", ""));
    require(phone.length() <= 30 && phone.matches("[+\\d\\s().-]*"), "Số điện thoại không hợp lệ");
    a.setPhone(phone);
    accounts.save(a);
    return map("id", a.getId());
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/TournamentController.java`
```java
package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.TournamentService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TournamentController {
  private final TournamentService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.service.RequestService requests;

  @PostMapping("/tournaments/{id}/registrations")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, UUID> register(
      @PathVariable UUID id,
      @Valid @RequestBody RegistrationRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    var a = auth.current(req);
    com.courtly.util.Rules.require("ADMIN".equals(a.getRole()), "Khách đăng ký qua /api/guest/tournaments để xác nhận điều lệ và thông tin người chơi");
    return Map.of("id", service.register(id, request));
  }

  @PostMapping("/tournaments/{id}/draw")
  @PreAuthorize("hasRole('ADMIN')")
  public void draw(@PathVariable UUID id) {
    service.draw(id);
  }

  @PutMapping("/matches/{id}/schedule")
  @PreAuthorize("hasRole('ADMIN')")
  public void schedule(@PathVariable UUID id, @Valid @RequestBody MatchScheduleRequest request) {
    service.schedule(id, request);
  }

  @PostMapping("/matches/{id}/result")
  @PreAuthorize("hasRole('ADMIN')")
  public void result(@PathVariable UUID id, @Valid @RequestBody MatchResultRequest request) {
    service.result(id, request);
  }
}
```

#### File: `backend/src/main/java/com/courtly/controller/TransferController.java`
```java
package com.courtly.controller;

import com.courtly.service.*;
import com.courtly.util.Rules;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class TransferController {
  private final TransferService transfers;
  private final AuthService auth;

  @GetMapping("/api/public/payment-config")
  public Map<String, Object> config() {
    return transfers.config();
  }

  @GetMapping("/api/transfers")
  public List<Map<String, Object>> mine(HttpServletRequest r) {
    return transfers.mine(auth.current(r));
  }

  @GetMapping("/api/admin/transfers")
  public List<Map<String, Object>> all(HttpServletRequest r) {
    var a = auth.current(r);
    Rules.require(Set.of("ADMIN", "STAFF").contains(a.getRole()), "Chỉ quản trị viên hoặc nhân viên mới có quyền");
    return transfers.all();
  }

  @PostMapping("/api/transfers")
  public Map<String, Object> create(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return transfers.create(auth.current(r), b);
  }

  @PostMapping("/api/transfers/{id}/declared")
  public Map<String, Object> declared(@PathVariable String id, HttpServletRequest r) {
    return transfers.declared(auth.current(r), id);
  }

  @PostMapping("/api/transfers/{id}/confirm")
  public Map<String, Object> confirm(@PathVariable String id, HttpServletRequest r) {
    return transfers.confirm(auth.current(r), id);
  }

  @PostMapping("/api/admin/transfers/{id}/confirm")
  public Map<String, Object> adminConfirm(@PathVariable String id, HttpServletRequest r) {
    var a = auth.current(r);
    Rules.require(Set.of("ADMIN", "STAFF").contains(a.getRole()), "Chỉ quản trị viên hoặc nhân viên mới có quyền");
    return transfers.adminConfirm(id);
  }

  @PostMapping("/api/transfers/{id}/sandbox")
  public Map<String, Object> sandbox(
      @PathVariable String id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return transfers.sandbox(auth.current(r), id, b);
  }

  @PostMapping("/api/webhooks/sepay")
  public Map<String, Object> webhook(
      @RequestHeader(value = "Authorization", required = false) String key,
      @RequestBody Map<String, Object> b) {
    return transfers.webhook(key, b);
  }
}
```

### 6.2 Services

#### File: `backend/src/main/java/com/courtly/service/AuditService.java`
```java
package com.courtly.service;

import com.courtly.entity.AuditLog;
import com.courtly.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {
  private final AuditLogRepository repository;

  public void log(String action, String detail) {
    AuditLog log = new AuditLog();
    var actor =
        org.springframework.security.core.context.SecurityContextHolder.getContext()
            .getAuthentication();
    log.setActor(actor == null ? "Hệ thống" : actor.getName());
    log.setAction(action);
    log.setDetail(detail);
    repository.save(log);
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/AuthService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.Account;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {
  private final AccountRepository accounts;
  private final PasswordEncoder encoder;
  private final HttpSessionSecurityContextRepository contexts;
  private final DocumentService documents;
  private final EmailService emails;

  @Value("${courtly.admin-email:admin@gmail.com}")
  private String adminEmail;

  @Value("${courtly.demo-mode:false}")
  private boolean demoMode;

  @Value("${courtly.security.otp-secret:CourtlySecureHmacSecretKey2026!}")
  private String otpSecret;

  private final java.util.concurrent.ConcurrentHashMap<String, long[]> failures =
      new java.util.concurrent.ConcurrentHashMap<>();

  private void pruneFailures() {
    long now = System.currentTimeMillis();
    failures.entrySet().removeIf(e -> now - e.getValue()[0] > 900000);
  }

  public Optional<Account> optCurrent(HttpServletRequest req) {
    var session = req.getSession(false);
    if (session == null || session.getAttribute("accountId") == null) {
      return Optional.empty();
    }
    UUID id = (UUID) session.getAttribute("accountId");
    return accounts.findById(id);
  }

  public Account current(HttpServletRequest req) {
    var session = req.getSession(false);
    if (session == null || session.getAttribute("accountId") == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
    var a =
        accounts
            .findById((UUID) session.getAttribute("accountId"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    if (!"ACTIVE".equals(a.getStatus())
        || !Objects.equals(session.getAttribute("authVersion"), a.getAuthVersion())) {
      session.invalidate();
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "Phiên đã bị thu hồi hoặc tài khoản bị khóa");
    }
    return a;
  }

  public void admin(Account a) {
    if (!"ADMIN".equals(a.getRole()))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Chỉ quản trị viên được thực hiện thao tác này");
  }

  public void cashier(Account a) {
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ nhân viên thu ngân hoặc quản trị được thu tiền mặt");
  }

  public boolean owner(Account a) {
    return a.getEmail().equalsIgnoreCase(adminEmail);
  }

  public Map<String, Object> user(Account a) {
    return map(
        "id",
        a.getId(),
        "accountId",
        a.getId(),
        "name",
        a.getFullName(),
        "email",
        a.getEmail(),
        "phone",
        a.getPhone(),
        "role",
        a.getRole(),
        "isOwner",
        owner(a));
  }

  public Map<String, Object> session(HttpServletRequest req) {
    if (req.getSession(false) == null || req.getSession(false).getAttribute("accountId") == null)
      return map("authenticated", false, "ownerSetupAvailable", false);
    return map("authenticated", true, "user", user(current(req)), "ownerSetupAvailable", false);
  }

  private Map<String, Object> signIn(Account a, HttpServletRequest req, HttpServletResponse res) {
    req.getSession(true);
    req.changeSessionId();
    req.getSession().setAttribute("accountId", a.getId());
    req.getSession().setAttribute("authVersion", a.getAuthVersion());
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            a.getId().toString(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + a.getRole()))));
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    return map("authenticated", true, "user", user(a));
  }

  private String email(Object v) {
    String e = text((String) v, "Email").toLowerCase(Locale.ROOT);
    require(e.length() <= 254 && e.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Email không hợp lệ");
    return e;
  }

  private String password(Object v) {
    require(v instanceof String, "Mật khẩu không hợp lệ");
    String p = (String) v;
    require(
        p.length() >= 8 && p.length() <= 128 && p.getBytes(StandardCharsets.UTF_8).length <= 72,
        "Mật khẩu từ 8 ký tự, tối đa 72 byte UTF-8");
    return p;
  }

  public static String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public String hashOtp(String code) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(otpSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(code.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to calculate HMAC-SHA-256 OTP hash", e);
    }
  }

  @Transactional
  public Map<String, Object> action(
      String action, Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    if (action.equals("logout")) {
      if (req.getSession(false) != null) req.getSession(false).invalidate();
      SecurityContextHolder.clearContext();
      return map("authenticated", false);
    }
    if (action.equals("login")) {
      pruneFailures();
      org.slf4j.LoggerFactory.getLogger(AuthService.class).info("Auth login attempt from IP: {}", req.getRemoteAddr());
      String e = email(b.get("email")), key = req.getRemoteAddr() + ":" + e;
      long t = System.currentTimeMillis();
      long[] tries =
          failures.compute(
              key, (k, old) -> old == null || t - old[0] > 900000 ? new long[] {t, 0} : old);
      require(tries[1] < 10, "Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.");
      var found = accounts.findByEmailIgnoreCase(e);
      String supplied = String.valueOf(b.getOrDefault("password", ""));
      if (found.isPresent() && "PENDING_ACTIVATION".equals(found.get().getStatus())) {
        if (found.get().getPasswordHash() != null && encoder.matches(supplied, found.get().getPasswordHash())) {
          String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
          String otpKey = "otp:activation:" + found.get().getEmail().toLowerCase(Locale.ROOT);
          documents.put(
              otpKey,
              map(
                  "documentKey", otpKey,
                  "accountId", found.get().getId().toString(),
                  "email", found.get().getEmail(),
                  "codeHash", hashOtp(code),
                  "attempts", 0,
                  "used", false,
                  "expiresAt", Instant.now().plusSeconds(900).toString()));
          emails.sendActivationEmail(found.get().getEmail(), found.get().getFullName(), code);
          var resp = new LinkedHashMap<String, Object>();
          resp.put("requiresActivation", true);
          resp.put("email", found.get().getEmail());
          if (demoMode) resp.put("devCode", code);
          resp.put("message", "Tài khoản của bạn chưa được kích hoạt. Mã OTP 6 số mới đã được gửi tới email.");
          return resp;
        }
      }
      if (found.isEmpty()
          || found.get().getPasswordHash() == null
          || !encoder.matches(supplied, found.get().getPasswordHash())
          || !"ACTIVE".equals(found.get().getStatus())) {
        synchronized (tries) {
          tries[1]++;
        }
        throw new BusinessException("Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.");
      }
      failures.remove(key);
      return signIn(found.get(), req, res);
    }
    if (action.equals("register")) {
      String e = email(b.get("email")), p = password(b.get("password"));
      require(
          accounts.findByEmailIgnoreCase(e).isEmpty(),
          "Email đã có tài khoản. Hãy đăng nhập hoặc liên hệ quầy.");
      String phone = (String) b.getOrDefault("phone", "");
      if (phone != null && !phone.isBlank()) {
        phone = phone.trim().replaceAll("\\s+", "");
        require(phone.matches("^0[0-9]{9}$"), "Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0)");
      } else if (Boolean.TRUE.equals(b.get("requireActivation"))) {
        throw new BusinessException("Vui lòng cung cấp số điện thoại liên hệ để đặt sân");
      }
      Account a = new Account();
      a.setFullName(text((String) b.get("name"), "Họ tên"));
      a.setEmail(e);
      a.setPhone(phone != null ? phone : "");
      a.setRole("CUSTOMER");
      a.setPasswordHash(encoder.encode(p));

      boolean requireAct = Boolean.TRUE.equals(b.get("requireActivation"));
      if (requireAct) {
        a.setStatus("PENDING_ACTIVATION");
        accounts.saveAndFlush(a);

        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String otpKey = "otp:activation:" + a.getEmail().toLowerCase(Locale.ROOT);
        documents.put(
            otpKey,
            map(
                "documentKey", otpKey,
                "accountId", a.getId().toString(),
                "email", a.getEmail(),
                "codeHash", hashOtp(code),
                "attempts", 0,
                "used", false,
                "expiresAt", Instant.now().plusSeconds(900).toString()));

        emails.sendActivationEmail(a.getEmail(), a.getFullName(), code);

        var resp = new LinkedHashMap<String, Object>();
        resp.put("requiresActivation", true);
        resp.put("email", a.getEmail());
        if (demoMode) resp.put("devCode", code);
        resp.put("message", "Mã kích hoạt OTP 6 số đã được gửi tới email " + a.getEmail() + ". Vui lòng nhập để hoàn tất đăng ký.");
        return resp;
      } else {
        a.setStatus("ACTIVE");
        accounts.saveAndFlush(a);
        return signIn(a, req, res);
      }
    }
    if (action.equals("resend-activation")) {
      String e = email(b.get("email"));
      var found = accounts.findByEmailIgnoreCase(e);
      if (found.isEmpty()) {
        throw new BusinessException("Không tìm thấy tài khoản với email " + e);
      }
      Account a = found.get();
      require("PENDING_ACTIVATION".equals(a.getStatus()), "Tài khoản đã được kích hoạt hoặc không ở trạng thái chờ kích hoạt.");

      String otpKey = "otp:activation:" + a.getEmail().toLowerCase(Locale.ROOT);
      String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
      documents.put(
          otpKey,
          map(
              "documentKey", otpKey,
              "accountId", a.getId().toString(),
              "email", a.getEmail(),
              "codeHash", hashOtp(code),
              "attempts", 0,
              "used", false,
              "expiresAt", Instant.now().plusSeconds(900).toString()));

      emails.sendActivationEmail(a.getEmail(), a.getFullName(), code);

      var resp = new LinkedHashMap<String, Object>();
      resp.put("success", true);
      resp.put("email", a.getEmail());
      if (demoMode) resp.put("devCode", code);
      resp.put("message", "Mã kích hoạt OTP 6 số mới đã được gửi tới email " + a.getEmail());
      return resp;
    }
    if (action.equals("forgot-password")) {
      String e = email(b.get("email")).toLowerCase(Locale.ROOT);
      var found = accounts.findByEmailIgnoreCase(e);
      String code = null;
      if (found.isPresent() && "ACTIVE".equals(found.get().getStatus())) {
        Account a = found.get();
        code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String key = "otp:reset:" + a.getEmail().toLowerCase(Locale.ROOT);
        documents.put(
            key,
            map(
                "documentKey", key,
                "accountId", a.getId().toString(),
                "email", a.getEmail(),
                "codeHash", hashOtp(code),
                "attempts", 0,
                "used", false,
                "expiresAt", Instant.now().plusSeconds(900).toString()));
        emails.sendPasswordResetEmail(a.getEmail(), a.getFullName(), code);
      }
      var resp = new LinkedHashMap<String, Object>();
      resp.put("success", true);
      resp.put("message", "Nếu email của bạn đã đăng ký trên hệ thống, mã xác nhận OTP đã được gửi về hòm thư. Mã có hiệu lực trong 15 phút.");
      resp.put("email", e);
      if (demoMode && code != null) {
        resp.put("code", code);
        resp.put("devCode", code);
      }
      return resp;
    }
    if (action.equals("reset-password")) {
      String code = text((String) b.getOrDefault("code", b.get("token")), "Mã xác nhận").trim();
      String email = b.get("email") != null ? String.valueOf(b.get("email")).trim().toLowerCase(Locale.ROOT) : "";
      Map<String, Object> info = null;
      com.courtly.entity.AppDocument row = null;

      if (!email.isBlank()) {
        String key = "otp:reset:" + email;
        row = documents.lock(key);
        info = documents.read(row);
        if (info.containsKey("accountId")) {
          int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
          if (attempts >= 5 || !Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now())) {
            throw new BusinessException("Mã xác nhận đã hết hạn hoặc thử sai quá 5 lần. Vui lòng yêu cầu mã mới.");
          }
          String storedHash = (String) info.get("codeHash");
          boolean valid = storedHash != null && MessageDigest.isEqual(
              hashOtp(code).getBytes(StandardCharsets.UTF_8),
              storedHash.getBytes(StandardCharsets.UTF_8));
          if (!valid) {
            info.put("attempts", attempts + 1);
            documents.save(row, info);
            throw new BusinessException("Mã xác nhận không đúng (còn " + (4 - attempts) + " lần thử).");
          }
        }
      }

      require(
          info != null
              && info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã xác nhận không đúng, đã dùng hoặc đã hết hạn (15 phút)");
      Account a =
          accounts.findForUpdate(UUID.fromString((String) info.get("accountId"))).orElseThrow();
      require("ACTIVE".equals(a.getStatus()), "Tài khoản đã bị khóa");
      a.setPasswordHash(encoder.encode(password(b.get("password"))));
      a.setAuthVersion(a.getAuthVersion() + 1);
      info.put("used", true);
      documents.save(row, info);
      return signIn(a, req, res);
    }
    if (action.equals("activate")) {
      String token = text((String) b.getOrDefault("code", b.get("token")), "Mã kích hoạt").trim();
      String email = b.get("email") != null ? String.valueOf(b.get("email")).trim().toLowerCase(Locale.ROOT) : "";
      Map<String, Object> info = null;
      com.courtly.entity.AppDocument row = null;

      if (!email.isBlank()) {
        String key = "otp:activation:" + email;
        row = documents.lock(key);
        info = documents.read(row);
        if (info.containsKey("accountId")) {
          int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
          if (attempts >= 5 || !Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now())) {
            throw new BusinessException("Mã kích hoạt đã hết hạn hoặc thử sai quá 5 lần. Vui lòng yêu cầu mã mới.");
          }
          String storedHash = (String) info.get("codeHash");
          boolean valid = storedHash != null && MessageDigest.isEqual(
              hashOtp(token).getBytes(StandardCharsets.UTF_8),
              storedHash.getBytes(StandardCharsets.UTF_8));
          if (!valid) {
            info.put("attempts", attempts + 1);
            documents.save(row, info);
            throw new BusinessException("Mã kích hoạt không đúng (còn " + (4 - attempts) + " lần thử).");
          }
        }
      }

      require(
          info != null
              && info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã kích hoạt không đúng, đã dùng hoặc đã hết hạn (15 phút)");
      Account a =
          accounts.findForUpdate(UUID.fromString((String) info.get("accountId"))).orElseThrow();
      require("ACTIVE".equals(a.getStatus()) || "PENDING_ACTIVATION".equals(a.getStatus()), "Tài khoản đã bị khóa");
      if ("PENDING_ACTIVATION".equals(a.getStatus())) {
        a.setStatus("ACTIVE");
      }
      if (b.containsKey("password") && b.get("password") != null && !String.valueOf(b.get("password")).isBlank()) {
        a.setPasswordHash(encoder.encode(password(b.get("password"))));
      }
      a.setAuthVersion(a.getAuthVersion() + 1);
      info.put("used", true);
      documents.save(row, info);
      return signIn(a, req, res);
    }
    if (action.equals("ticket"))
      return activation(current(req), UUID.fromString((String) b.get("accountId")));
    if (action.equals("password")) {
      Account a = current(req);
      require(
          a.getPasswordHash() != null
              && encoder.matches(String.valueOf(b.get("currentPassword")), a.getPasswordHash()),
          "Mật khẩu hiện tại không đúng");
      a.setPasswordHash(encoder.encode(password(b.getOrDefault("newPassword", b.get("password")))));
      a.setAuthVersion(a.getAuthVersion() + 1);
      return signIn(a, req, res);
    }
    throw new BusinessException("Thao tác tài khoản không hỗ trợ");
  }

  @Transactional
  public Map<String, Object> activation(Account actor, UUID id) {
    admin(actor);
    documents.mutationLock();
    for (var old : documents.list("activation:"))
      if (id.toString().equals(old.get("accountId")) && !Boolean.TRUE.equals(old.get("used"))) {
        old.put("used", true);
        if (old.get("documentKey") instanceof String key) documents.put(key, old);
      }
    Account a = accounts.findForUpdate(id).orElseThrow();
    require(
        !owner(a) || a.getId().equals(actor.getId()),
        "Không cấp mã của chủ hệ thống cho người khác");
    String token = UUID.randomUUID() + "." + UUID.randomUUID();
    documents.put(
        "activation:" + hash(token),
        map(
            "documentKey",
            "activation:" + hash(token),
            "accountId",
            id.toString(),
            "used",
            false,
            "expiresAt",
            Instant.now().plusSeconds(86400).toString()));
    return map("token", token, "expiresAt", Instant.now().plusSeconds(86400).toString());
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/BookingSupportService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class BookingSupportService {
  private final CourtScheduleRepository schedules;
  private final StaffRepository staff;
  private final StaffScheduleRepository shifts;
  private final CustomerOrderRepository orders;
  private final BookingStaffRepository bookingStaff;
  private final OrderService service;
  private final OverviewService views;
  private final SettingsService settings;
  private final MembershipService membership;
  private final VoucherService vouchers;

  public void owns(Account a, UUID id) {
    var o = orders.findById(id).orElseThrow();
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())
        && (o.getCustomerAccount() == null || !o.getCustomerAccount().getId().equals(a.getId())))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Đơn không thuộc tài khoản của bạn");
  }

  public List<CourtSchedule> selected(List<UUID> ids) {
    require(
        ids != null
            && !ids.isEmpty()
            && ids.size() <= 48
            && new HashSet<>(ids).size() == ids.size(),
        "Chọn các slot khác nhau");
    return ids.stream().map(id -> schedules.findById(id).orElseThrow()).toList();
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a) {
    return options(ids, exclude, a, a.getId(), null);
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a, UUID account) {
    return options(ids, exclude, a, account, null);
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a, UUID account, String voucherCode) {
    if (exclude != null) owns(a, exclude);
    var rows = selected(ids);
    service.future(rows);
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) membership.checkWindow(a.getId(),rows);
    require(
        rows.stream().map(CourtSchedule::getScheduleDate).distinct().count() == 1,
        "Các slot phải cùng ngày");
    var own =
        exclude == null
            ? Set.<UUID>of()
            : service.allocated(service.booking(orders.findById(exclude).orElseThrow())).stream()
                .map(CourtSchedule::getId)
                .collect(java.util.stream.Collectors.toSet());
    var conflict = new ArrayList<Map<String, Object>>();
    for (var s : rows)
      if (!"ACTIVE".equals(s.getCourt().getStatus())
          || !"AVAILABLE".equals(s.getStatus()) && !own.contains(s.getId()))
        conflict.add(
            map("scheduleId", s.getId(), "message", "Slot vừa được đặt hoặc đang bị khóa"));
    var slotViews =
        rows.stream()
            .map(
                s ->
                    map(
                        "id",
                        s.getId(),
                        "court",
                        s.getCourt().getId(),
                        "start", s.getStartTime(), "end", s.getEndTime(),
                        "hour",
                        s.getStartTime().getHour() + s.getStartTime().getMinute() / 60.0,
                        "price",
                        s.getPrice()))
            .toList();
    var staffRows = new ArrayList<Map<String, Object>>();
    var old =
        exclude == null
            ? List.<BookingStaff>of()
            : bookingStaff.findByBookingId(
                service.booking(orders.findById(exclude).orElseThrow()).getId());
    for (var s : rows) {
      var people = new ArrayList<Map<String, Object>>();
      for (var p : staff.findAll())
        if ("REFEREE".equals(p.getType()) && "ACTIVE".equals(p.getStatus())) {
          boolean free =
              shifts.findByStaffIdAndWorkDate(p.getId(), s.getScheduleDate()).stream()
                  .anyMatch(
                      x ->
                          x.getStartTime().equals(s.getStartTime()) && x.getEndTime().equals(s.getEndTime())
                              && ("AVAILABLE".equals(x.getStatus())
                                  || old.stream()
                                      .anyMatch(
                                          link ->
                                              link.getReleasedAt() == null
                                                  && link.getStaffSchedule()
                                                      .getId()
                                                      .equals(x.getId()))));
          people.add(
              map(
                  "id",
                  p.getId(),
                  "name",
                  p.getFullName(),
                  "level", p.getLevel(),
                  "rate",
                  p.getHourlyRate(),
                  "available",
                  free));
        }
      staffRows.add(map("scheduleId", s.getId(), "staff", people));
    }
    BigDecimal courtTotal = rows.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    Map<String, Object> voucherBenefit = null;
    if (voucherCode != null && !voucherCode.isBlank()) {
      voucherBenefit = vouchers.calculate(voucherCode, courtTotal, account);
    }
    return map(
        "courtQuote",
        membership.quote(account, rows),
        "date",
        rows.get(0).getScheduleDate(),
        "slots",
        slotViews,
        "conflicts",
        conflict,
        "staffSlots",
        staffRows,
        "voucherBenefit",
        voucherBenefit,
        "availableVouchers",
        vouchers.listAvailable());
  }

  public Map<String, Object> preview(UUID id, MoveBookingRequest r, Account a) {
    owns(a, id);
    var o = orders.findById(id).orElseThrow();
    require(
        Set.of("HOLDING", "CONFIRMED", "EXPIRED", "CANCELLED").contains(o.getStatus()),
        "Đơn không thể đổi lịch");
    var opt = options(r.scheduleIds(), id, a);
    require(((List<?>) opt.get("conflicts")).isEmpty(), "Lịch mới có slot không khả dụng");
    var rows = selected(r.scheduleIds());
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) service.continuous(rows);
    BigDecimal
        court = rows.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add),
        staffCost = BigDecimal.ZERO;
    var staffView = new ArrayList<Map<String, Object>>();
    Set<UUID> seen = new HashSet<>();
    Set<String> booked = new HashSet<>();
    require(r.assignments() != null, "Chọn lại trọng tài theo slot");
    for (var assign : r.assignments()) {
      var slot =
          rows.stream()
              .filter(s -> s.getId().equals(assign.scheduleId()))
              .findFirst()
              .orElseThrow();
      require(seen.add(slot.getId()), "Mỗi slot chỉ chọn một trọng tài");
      require(
          booked.add(assign.staffId() + ":" + slot.getStartTime()),
          "Trọng tài trùng giờ giữa các sân");
      var options = (List<Map<String, Object>>) opt.get("staffSlots");
      var sr =
          options.stream()
              .filter(x -> x.get("scheduleId").equals(slot.getId()))
              .findFirst()
              .orElseThrow();
      var st =
          ((List<Map<String, Object>>) sr.get("staff"))
              .stream()
                  .filter(
                      x ->
                          x.get("id").equals(assign.staffId())
                              && Boolean.TRUE.equals(x.get("available")))
                  .findFirst()
                  .orElseThrow();
      staffCost = staffCost.add(PresentationService.decimal(st.get("rate")).multiply(hours(slot.getStartTime(), slot.getEndTime())));
      staffView.add(
          map(
              "scheduleId",
              slot.getId(),
              "name",
              st.get("name"),
              "rate",
              st.get("rate"),
              "hours",
              hours(slot.getStartTime(), slot.getEndTime())));
    }
    var old = views.order(o);
    var products = (List<Map<String, Object>>) old.get("products");
    BigDecimal extras =
        products.stream()
            .map(p -> PresentationService.decimal(p.get("lineTotal")))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    var benefit =
        membership.quote(
            o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(), rows);
    BigDecimal total = PresentationService.decimal(benefit.get("net")).add(staffCost).add(extras);
    var next = new LinkedHashMap<>(old);
    next.put("slots", opt.get("slots"));
    next.put("date", opt.get("date"));
    next.put("staff", staffView);
    next.put("total", total);
    next.put("membershipBenefit", benefit);
    next.put(
        "deposit",
        Set.of("ADMIN", "STAFF").contains(a.getRole())
            ? total.multiply(BigDecimal.valueOf(settings.get().getDepositPercent())).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)
            : PresentationService.decimal(benefit.get("net")).multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.HALF_UP));
    return map(
        "next",
        next,
        "previous",
        old,
        "difference",
        total.subtract(o.getTotalAmount()),
        "additionalDue",
        total.subtract(o.getPaidAmount()).max(BigDecimal.ZERO),
        "reviewAmount",
        o.getPaidAmount().subtract(total).max(BigDecimal.ZERO));
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/CatalogService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CatalogService {
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository courtSchedules;
  private final AccountRepository accounts;
  private final StaffRepository staff;
  private final StaffScheduleRepository staffSchedules;
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TournamentMatchRepository matches;
  private final TournamentService tournamentService;
  private final AuditService audit;

  @Transactional
  public UUID save(String collection, UUID id, CatalogRequest r) {
    UUID result =
        switch (collection) {
          case "courts" -> court(id, r);
          case "prices" -> price(id, r);
          case "accounts" -> account(id, r);
          case "staff" -> staff(id, r);
          case "staff-schedules" -> staffSchedule(id, r);
          case "tournaments" -> tournament(id, r);
          default -> throw new BusinessException("Danh mục không được hỗ trợ");
        };
    audit.log("LƯU " + collection.toUpperCase(), result.toString());
    return result;
  }

  private UUID court(UUID id, CatalogRequest r) {
    Court c =
        id == null
            ? new Court()
            : courts
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Sân không tồn tại"));
    c.setName(text(r.name(), "Tên sân"));
    c.setType(oneOf(r.type(), "HARD", "CLAY", "GRASS"));
    String status = oneOf(r.status(), "ACTIVE", "MAINTENANCE", "INACTIVE");
    if (!"ACTIVE".equals(status) && id != null) {
      java.time.LocalDate today = java.time.LocalDate.now(ZONE);
      require(
          courtSchedules.findAll().stream()
              .filter(x -> x.getCourt().getId().equals(id))
              .filter(x -> !x.getScheduleDate().isBefore(today))
              .noneMatch(x -> !"AVAILABLE".equals(x.getStatus())),
          "Sân đang có lịch đặt sắp tới. Hủy hoặc đổi lịch trước khi chuyển trạng thái.");
    }
    c.setStatus(status);
    c.setBasePrice(positive(r.price()));
    c.setDescription(r.description());
    c.setAddress(r.address());
    c.setAmenities(r.amenities());
    if (r.imageUrl() != null && !r.imageUrl().isBlank()) {
      var url = java.net.URI.create(r.imageUrl());
      require(
          ("https".equals(url.getScheme()) && url.getHost() != null && url.getUserInfo() == null)
              || r.imageUrl().matches("^/images/[a-zA-Z0-9_-]+\\.(webp|png|jpg|jpeg)$")
              || r.imageUrl().matches("^/guest/[a-zA-Z0-9_-]+\\.(webp|png|jpg|jpeg)$"),
          "URL ảnh phải dùng HTTPS hoặc /images/, /guest/");
    }
    c.setImageUrl(r.imageUrl());
    c.setImageIsIllustration(r.imageIsIllustration() == null || r.imageIsIllustration());
    return courts.save(c).getId();
  }

  private UUID price(UUID id, CatalogRequest r) {
    times(r);
    CourtPrice p =
        id == null
            ? new CourtPrice()
            : prices
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Khung giá không tồn tại"));
    require(r.court() != null, "Chọn sân");
    p.setCourt(
        courts.findById(r.court()).orElseThrow(() -> new BusinessException("Sân không tồn tại")));
    p.setDayType(oneOf(r.dayType(), "WEEKDAY", "WEEKEND"));
    p.setStartTime(clock(r.start()));
    p.setEndTime(clock(r.end()));
    p.setPricePerHour(positive(r.price()));
    return prices.save(p).getId();
  }

  private UUID account(UUID id, CatalogRequest r) {
    Account a =
        id == null
            ? new Account()
            : accounts
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
    a.setFullName(text(r.name(), "Tên tài khoản"));
    String email = text(r.email(), "Email").toLowerCase(Locale.ROOT);
    require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Email không hợp lệ");
    require(
        accounts.findByEmailIgnoreCase(email).map(x -> x.getId().equals(id)).orElse(true),
        "Email đã tồn tại");
    a.setEmail(email);
    a.setPhone(r.phone() == null ? "" : r.phone());
    a.setRole(oneOf(r.role(), "ADMIN", "STAFF", "CUSTOMER"));
    a.setStatus(oneOf(r.status(), "ACTIVE", "LOCKED"));
    return accounts.save(a).getId();
  }

  private UUID staff(UUID id, CatalogRequest r) {
    Staff s =
        id == null
            ? new Staff()
            : staff
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Nhân sự không tồn tại"));
    s.setFullName(text(r.name(), "Tên nhân sự"));
    s.setType(oneOf(r.type(), "REFEREE", "BALL_BOY", "COACH"));
    s.setPhone(r.phone() == null ? "" : r.phone());
    s.setHourlyRate(positive(r.rate()));
    String status = oneOf(r.status(), "ACTIVE", "INACTIVE");
    if (id != null && "INACTIVE".equals(status))
      require(
          staffSchedules.findAll().stream()
              .noneMatch(
                  x -> x.getStaff().getId().equals(id) && !"AVAILABLE".equals(x.getStatus())),
          "Nhân sự đang có lịch phân công");
    s.setStatus(status);
    return staff.save(s).getId();
  }

  private void times(CatalogRequest r) {
    require(
        r.start() != null
            && r.end() != null
            && r.start() >= 6
            && r.end() <= 23
            && r.start() < r.end() && r.start()*2 == Math.rint(r.start()*2) && r.end()*2 == Math.rint(r.end()*2),
        "Giờ làm việc từ 6 đến 23, giờ kết thúc sau giờ bắt đầu");
  }

  private LocalTime clock(double hour) {return LocalTime.of((int)hour, (int)Math.round((hour % 1)*60));}

  private UUID staffSchedule(UUID id, CatalogRequest r) {
    times(r);
    require(r.staff() != null && r.date() != null, "Chọn nhân sự và ngày");
    Staff person =
        staff
            .findForUpdate(r.staff())
            .orElseThrow(() -> new BusinessException("Nhân sự không tồn tại"));
    require("ACTIVE".equals(person.getStatus()), "Nhân sự không hoạt động");
    if (id != null) {
      StaffSchedule s =
          staffSchedules
              .findForUpdate(id)
              .orElseThrow(() -> new BusinessException("Lịch không tồn tại"));
      require("AVAILABLE".equals(s.getStatus()), "Không sửa lịch đang được phân công");
      require(r.end() - r.start() == 0.5 || r.end() - r.start() == 1, "Mỗi slot nhân sự dài 30 hoặc 60 phút");
      s.setStaff(person);
      s.setWorkDate(r.date());
      s.setStartTime(clock(r.start()));
      s.setEndTime(clock(r.end()));
      return s.getId();
    }
    UUID first = null;
    for (int minute = (int)(r.start() * 60); minute < r.end() * 60; minute += 30) {
      StaffSchedule s = new StaffSchedule();
      s.setStaff(person);
      s.setWorkDate(r.date());
      s.setStartTime(LocalTime.of(minute / 60, minute % 60));
      s.setEndTime(LocalTime.of((minute + 30) / 60, (minute + 30) % 60));
      staffSchedules.save(s);
      if (first == null) first = s.getId();
    }
    return first;
  }

  private UUID tournament(UUID id, CatalogRequest r) {
    Tournament t =
        id == null
            ? new Tournament()
            : tournaments
                .findForUpdate(id)
                .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(
        r.startDate() != null
            && r.endDate() != null
            && r.deadline() != null
            && !r.endDate().isBefore(r.startDate())
            && !r.deadline().isAfter(r.startDate()),
        "Ngày giải không hợp lệ");
    require(r.max() != null && r.max() >= 2 && r.max() <= 1024, "Số đăng ký tối đa từ 2 đến 1024");
    require(r.fee() != null && r.fee().compareTo(BigDecimal.ZERO) >= 0, "Phí giải không hợp lệ");
    if (id != null && !registrations.findByTournamentId(id).isEmpty()) {
      require(
          t.getFormat().equals(r.format()) && t.getRegistrationFee().compareTo(r.fee()) == 0,
          "Không đổi thể thức hoặc phí khi đã có đăng ký");
      require(
          r.max() >= registrations.findByTournamentId(id).size(), "Sức chứa nhỏ hơn số đã đăng ký");
    }
    if (id != null && !matches.findByTournamentId(id).isEmpty())
      require(
          t.getStartDate().equals(r.startDate()) && t.getEndDate().equals(r.endDate()),
          "Không đổi thời gian giải sau khi bốc thăm");
    String status =
        oneOf(r.status(), "DRAFT", "OPEN", "CLOSED", "ONGOING", "FINISHED", "CANCELLED");
    if (id != null && "CANCELLED".equals(status))
      for (TournamentMatch m : matches.findByTournamentId(id)) {
        if (!"FINISHED".equals(m.getStatus())) {
          tournamentService.release(m);
          m.setStatus("CANCELLED");
        }
      }
    t.setName(text(r.name(), "Tên giải"));
    t.setFormat(oneOf(r.format(), "SINGLES", "DOUBLES", "TEAM"));
    t.setStatus(status);
    t.setStartDate(r.startDate());
    t.setEndDate(r.endDate());
    t.setRegistrationDeadline(r.deadline());
    t.setRegistrationFee(r.fee());
    t.setLocation(text(r.location(), "Địa điểm"));
    t.setMaxParticipants(r.max());
    return tournaments.save(t).getId();
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/ContentService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.Account;
import com.courtly.repository.TournamentRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ContentService {
  private final DocumentService docs;
  private final AuthService auth;
  private final TournamentRepository tournaments;
  private final RequestService requests;

  private String string(Map<String, Object> b, String k, int max, boolean required) {
    Object v = b.getOrDefault(k, "");
    require(v instanceof String, k + " không hợp lệ");
    String s = ((String) v).trim();
    require(s.length() <= max && (!required || !s.isEmpty()), k + " không hợp lệ");
    return s;
  }

  public Map<String, Object> club() {
    var saved = docs.get("club");
    if (!saved.isEmpty()) return saved;
    try {
      return docs.decode(
          new String(
              new ClassPathResource("default-club.json").getInputStream().readAllBytes(),
              java.nio.charset.StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Map<String, Object> get(Account viewer) {
    boolean admin = viewer != null && "ADMIN".equals(viewer.getRole());
    var articles = new ArrayList<Map<String, Object>>();
    for (var a : docs.list("article:"))
      if (admin || "PUBLISHED".equals(a.get("status"))) {
        var item = new LinkedHashMap<>(a);
        if (!admin && item.get("tournamentId") != null) {
          String tid = item.get("tournamentId").toString();
          if (!tid.isBlank()
              && !tid.equals("null")
              && tournaments
                  .findById(UUID.fromString(tid))
                  .map(t -> "DRAFT".equals(t.getStatus()))
                  .orElse(true)) item.put("tournamentId", null);
        }
        articles.add(item);
      }
    if (!admin)
      for (var t : tournaments.findAll())
        if (!"DRAFT".equals(t.getStatus()))
          articles.add(
              map(
                  "id",
                  "giai-" + t.getId(),
                  "title",
                  t.getName(),
                  "excerpt",
                  "Thông tin giải đấu tại " + t.getLocation(),
                  "body",
                  "Thông tin được cập nhật từ lịch giải đấu của câu lạc bộ.",
                  "category",
                  "TOURNAMENT",
                  "publishedAt",
                  t.getStartDate().toString(),
                  "source",
                  "TOURNAMENT",
                  "tournamentId",
                  t.getId(),
                  "tournament",
                  map(
                      "id",
                      t.getId(),
                      "name",
                      t.getName(),
                      "format",
                      t.getFormat(),
                      "start",
                      t.getStartDate(),
                      "end",
                      t.getEndDate(),
                      "deadline",
                      t.getRegistrationDeadline(),
                      "fee",
                      t.getRegistrationFee(),
                      "status",
                      t.getStatus(),
                      "max",
                      t.getMaxParticipants(),
                      "location",
                      t.getLocation())));
    articles.sort(
        Comparator.comparing(
            a -> String.valueOf(a.getOrDefault("publishedAt", "")), Comparator.reverseOrder()));
    var feedback = new ArrayList<Map<String, Object>>();
    for (var f : docs.list("feedback:"))
      if (admin) feedback.add(f);
      else if ("PUBLISHED".equals(f.get("status"))
          && Boolean.TRUE.equals(f.get("publishConsent"))) {
        var item = new LinkedHashMap<>(f);
        item.remove("accountId");
        item.remove("requestId");
        item.remove("publishConsent");
        feedback.add(item);
      }
    Object avg =
        feedback.isEmpty()
            ? null
            : Math.round(
                    feedback.stream()
                            .mapToInt(f -> ((Number) f.get("rating")).intValue())
                            .average()
                            .orElse(0)
                        * 10)
                / 10.0;
    return map(
        "club",
        club(),
        "articles",
        articles,
        "feedback",
        feedback,
        "sample",
        false,
        "feedbackStats",
        map("count", feedback.size(), "average", avg),
        "tournaments",
        admin
            ? tournaments.findAll().stream()
                .map(t -> map("id", t.getId(), "name", t.getName(), "status", t.getStatus()))
                .toList()
            : List.of());
  }

  public List<Map<String, Object>> mine(Account a) {
    return docs.list("feedback:").stream()
        .filter(f -> a.getId().toString().equals(f.get("accountId")))
        .toList();
  }

  public Map<String, Object> save(Account a, String method, String path, Map<String, Object> b) {
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        method + path,
        b,
        () -> {
          if (path.equals("/api/feedback")) {
            String msg = string(b, "message", 2000, true);
            require(msg.length() >= 10, "Nội dung cần ít nhất 10 ký tự");
            int rating = b.get("rating") instanceof Number n ? n.intValue() : 0;
            require(b.get("rating") instanceof Number n && n.doubleValue() == rating && rating >= 1 && rating <= 5, "Đánh giá từ 1 đến 5 sao");
            oneOf((String) b.get("topic"), "COURT", "SERVICE", "WEBSITE", "TOURNAMENT", "OTHER");
            require(b.get("publishConsent") instanceof Boolean, "Cần chọn quyền công khai");
            var recent =
                mine(a).stream()
                    .filter(
                        f ->
                            Instant.parse((String) f.get("createdAt"))
                                .isAfter(Instant.now().minusSeconds(86400)))
                    .toList();
            require(
                recent.size() < 5
                    && recent.stream()
                        .noneMatch(
                            f ->
                                Instant.parse((String) f.get("createdAt"))
                                    .isAfter(Instant.now().minusSeconds(60))),
                "Đợi một phút; tối đa 5 phản hồi mỗi ngày");
            String id = UUID.randomUUID().toString();
            docs.put(
                "feedback:" + id,
                map(
                    "id",
                    id,
                    "accountId",
                    a.getId().toString(),
                    "displayName",
                    a.getFullName(),
                    "rating",
                    rating,
                    "topic",
                    b.get("topic"),
                    "message",
                    msg,
                    "publishConsent",
                    b.get("publishConsent"),
                    "status",
                    "PENDING",
                    "createdAt",
                    Instant.now().toString(),
                    "reply",
                    ""));
            return map("id", id);
          }
          auth.admin(a);
          if (path.equals("/api/content/club")) {
            var c = club();
            for (String key : new ArrayList<>(c.keySet())) {
              String v =
                  string(
                      b,
                      key,
                      key.equals("story") ? 5000 : 2000,
                      Set.of("name", "tagline", "intro", "story", "mission").contains(key));
              if (Set.of("mapUrl", "socialUrl").contains(key) && !v.isEmpty()) {
                var u = java.net.URI.create(v);
                require(
                    "https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null,
                    "URL cần HTTPS hợp lệ");
              }
              c.put(key, v);
            }
            docs.put("club", c);
            return map("ok", true);
          }
          String[] parts = path.split("/");
          if (parts[3].equals("articles")) {
            String id = parts.length > 4 ? parts[4] : UUID.randomUUID().toString();
            var old = docs.get("article:" + id);
            require(parts.length <= 4 || !old.isEmpty(), "Bài viết không tồn tại");
            oneOf((String) b.get("status"), "DRAFT", "PUBLISHED");
            oneOf((String) b.get("category"), "NEWS", "NOTICE", "TOURNAMENT");
            String tournament = String.valueOf(b.getOrDefault("tournamentId", ""));
            if (!tournament.isBlank() && !tournament.equals("null")) {
              var t = tournaments.findById(UUID.fromString(tournament)).orElseThrow();
              require(
                  !"PUBLISHED".equals(b.get("status")) || !"DRAFT".equals(t.getStatus()),
                  "Công bố giải trước khi xuất bản tin");
            }
            var row =
                map(
                    "id",
                    id,
                    "title",
                    string(b, "title", 160, true),
                    "excerpt",
                    string(b, "excerpt", 400, true),
                    "body",
                    string(b, "body", 12000, true),
                    "category",
                    b.get("category"),
                    "status",
                    b.get("status"),
                    "tournamentId",
                    tournament.isBlank() ? null : tournament,
                    "source",
                    "EDITORIAL",
                    "createdAt",
                    old.getOrDefault("createdAt", Instant.now().toString()),
                    "updatedAt",
                    Instant.now().toString(),
                    "publishedAt",
                    "PUBLISHED".equals(b.get("status"))
                        ? (old.get("publishedAt") == null
                            ? Instant.now().toString()
                            : old.get("publishedAt"))
                        : null);
            docs.put("article:" + id, row);
            return map("id", id);
          }
          var f = docs.get("feedback:" + parts[4]);
          require(!f.isEmpty(), "Phản hồi không tồn tại");
          oneOf((String) b.get("status"), "PENDING", "PUBLISHED", "PRIVATE");
          require(
              !"PUBLISHED".equals(b.get("status")) || Boolean.TRUE.equals(f.get("publishConsent")),
              "Khách chưa đồng ý công khai");
          f.put("status", b.get("status"));
          f.put("reply", string(b, "reply", 2000, false));
          f.put("repliedAt", Instant.now().toString());
          docs.put("feedback:" + parts[4], f);
          return map("id", parts[4]);
        });
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/DocumentService.java`
```java
package com.courtly.service;

import com.courtly.entity.AppDocument;
import com.courtly.repository.AppDocumentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class DocumentService {
  private final AppDocumentRepository repository;
  private final ObjectMapper mapper;
  private final JdbcTemplate jdbc;

  public void mutationLock() {
    jdbc.execute("SELECT pg_advisory_xact_lock(1576841131)");
  }

  public Map<String, Object> decode(String text) {
    try {
      return mapper.readValue(text, new TypeReference<LinkedHashMap<String, Object>>() {});
    } catch (Exception e) {
      throw new IllegalStateException("Invalid stored JSON", e);
    }
  }

  public String encode(Object value) {
    try {
      return mapper
          .writer()
          .with(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
          .writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON", e);
    }
  }

  public Map<String, Object> get(String key) {
    return repository.findById(key).map(this::read).orElseGet(LinkedHashMap::new);
  }

  public AppDocument lock(String key) {
    return repository.lock(key).orElseGet(() -> new AppDocument(key));
  }

  public Map<String, Object> read(AppDocument row) {
    return decode(row.getData());
  }

  public void save(AppDocument row, Map<String, Object> data) {
    row.setData(encode(data));
    repository.save(row);
  }

  public void put(String key, Map<String, Object> data) {
    save(lock(key), data);
  }

  public List<Map<String, Object>> list(String prefix) {
    return repository.findByKeyStartingWith(prefix).stream().map(this::read).toList();
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/EmailService.java`
```java
package com.courtly.service;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import javax.net.ssl.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
  private final DocumentService documents;

  @Value("${courtly.mail.host:}")
  private String host;

  @Value("${courtly.mail.port:587}")
  private int port;

  @Value("${courtly.mail.username:}")
  private String username;

  @Value("${courtly.mail.password:}")
  private String password;

  @Value("${courtly.mail.from:no-reply@courtly.vn}")
  private String fromAddress;

  @Value("${courtly.mail.from-name:Courtly Tennis Club}")
  private String fromName;

  public boolean sendPasswordResetEmail(String toEmail, String fullName, String code) {
    String subject = "[Courtly Tennis Club] Mã xác nhận đặt lại mật khẩu của bạn";
    String plain = String.format("""
        Xin chào %s,

        Bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản Courtly (%s).

        Mã xác nhận OTP của bạn là: %s

        Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.
        Nếu bạn không thực hiện yêu cầu này, xin vui lòng bỏ qua email này.

        Trân trọng,
        CLB Tennis Courtly
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    String html = String.format("""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f7f5;margin:0;padding:24px;color:#21342e;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce3df;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
            <tr>
              <td style="background-color:#173c32;padding:28px 32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">COURTLY <span style="color:#def46a;font-size:14px;display:block;margin-top:4px;">TENNIS CLUB</span></h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="font-size:20px;margin-top:0;color:#173c32;">Yêu cầu đặt lại mật khẩu</h2>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Xin chào <strong>%s</strong>,</p>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>%s</strong> trên hệ thống Courtly Tennis Club.</p>
                
                <div style="background:#f0f5e8;border:2px dashed #9bc89a;border-radius:10px;padding:20px;text-align:center;margin:28px 0;">
                  <span style="display:block;font-size:12px;color:#4a6250;letter-spacing:1px;margin-bottom:8px;font-weight:600;text-transform:uppercase;">Mã xác nhận của bạn</span>
                  <span style="font-size:34px;font-weight:700;color:#173c32;letter-spacing:8px;font-family:monospace;">%s</span>
                  <span style="display:block;font-size:12px;color:#708477;margin-top:8px;">Hiệu lực trong 15 phút</span>
                </div>

                <p style="font-size:14px;line-height:1.6;color:#52655a;">Vui lòng nhập mã này vào màn hình xác nhận trên website để hoàn tất việc đổi mật khẩu mới.</p>
                <p style="font-size:13px;line-height:1.5;color:#85968b;margin-top:24px;padding-top:16px;border-top:1px solid #eef2ef;">Nếu bạn không gửi yêu cầu này, xin vui lòng bỏ qua thư này hoặc thông báo cho quầy lễ tân. Mật khẩu của bạn sẽ không bị thay đổi nếu chưa nhập mã xác nhận.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fbf9;padding:16px 32px;text-align:center;font-size:12px;color:#85968b;border-top:1px solid #eef2ef;">
                © 2026 Courtly Tennis Club · Hệ thống quản lý đặt sân & giải đấu chuyên nghiệp
              </td>
            </tr>
          </table>
        </body>
        </html>
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    return send(toEmail, subject, plain, html);
  }

  public boolean sendActivationEmail(String toEmail, String fullName, String code) {
    String subject = "[Courtly Tennis Club] Mã kích hoạt tài khoản của bạn";
    String plain = String.format("""
        Xin chào %s,

        Cảm ơn bạn đã đăng ký tài khoản tại Courtly Tennis Club (%s).

        Mã kích hoạt OTP 6 số của bạn là: %s

        Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.

        Trân trọng,
        CLB Tennis Courtly
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    String html = String.format("""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f7f5;margin:0;padding:24px;color:#21342e;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce3df;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
            <tr>
              <td style="background-color:#173c32;padding:28px 32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">COURTLY <span style="color:#def46a;font-size:14px;display:block;margin-top:4px;">TENNIS CLUB</span></h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="font-size:20px;margin-top:0;color:#173c32;">Kích hoạt tài khoản mới</h2>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Xin chào <strong>%s</strong>,</p>
                <p style="font-size:15px;line-height:1.6;color:#52655a;">Cảm ơn bạn đã đăng ký tài khoản tại hệ thống đặt sân <strong>Courtly Tennis Club</strong> (%s).</p>
                
                <div style="background:#f0f5e8;border:2px dashed #9bc89a;border-radius:10px;padding:20px;text-align:center;margin:28px 0;">
                  <span style="display:block;font-size:12px;color:#4a6250;letter-spacing:1px;margin-bottom:8px;font-weight:600;text-transform:uppercase;">Mã kích hoạt OTP của bạn</span>
                  <span style="font-size:34px;font-weight:700;color:#173c32;letter-spacing:8px;font-family:monospace;">%s</span>
                  <span style="display:block;font-size:12px;color:#708477;margin-top:8px;">Hiệu lực trong 15 phút</span>
                </div>

                <p style="font-size:14px;line-height:1.6;color:#52655a;">Vui lòng nhập mã này vào màn hình kích hoạt trên website để hoàn tất đăng ký tài khoản.</p>
                <p style="font-size:13px;line-height:1.5;color:#85968b;margin-top:24px;padding-top:16px;border-top:1px solid #eef2ef;">Nếu bạn không thực hiện đăng ký tài khoản này, xin vui lòng bỏ qua thư này.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fbf9;padding:16px 32px;text-align:center;font-size:12px;color:#85968b;border-top:1px solid #eef2ef;">
                © 2026 Courtly Tennis Club · Hệ thống quản lý đặt sân & giải đấu chuyên nghiệp
              </td>
            </tr>
          </table>
        </body>
        </html>
        """, fullName != null && !fullName.isBlank() ? fullName : "Quý khách", toEmail, code);

    return send(toEmail, subject, plain, html);
  }

  public boolean send(String to, String subject, String textBody, String htmlBody) {
    try {
      documents.put("email:log:" + UUID.randomUUID(), Map.of(
          "to", to,
          "subject", subject,
          "body", textBody,
          "sentAt", Instant.now().toString(),
          "hasSmtp", host != null && !host.isBlank()
      ));
    } catch (Exception e) {
      log.warn("Failed to store email log: {}", e.getMessage());
    }

    if (host == null || host.isBlank()) {
      log.info("\n======================================================\n" +
               "[COURTLY EMAIL - DEMO MODE (No SMTP server configured)]\n" +
               "To: {}\nSubject: {}\n" +
               "------------------------------------------------------\n" +
               "{}\n" +
               "======================================================", to, subject, textBody);
      return true;
    }

    try {
      sendSmtp(to, subject, textBody, htmlBody);
      log.info("Email successfully sent via SMTP ({}:{}) to {}", host, port, to);
      return true;
    } catch (Exception e) {
      log.error("Failed to send email via SMTP ({}:{}): {}", host, port, e.getMessage(), e);
      return false;
    }
  }

  private void sendSmtp(String to, String subject, String textBody, String htmlBody) throws Exception {
    boolean isSsl = port == 465;
    Socket rawSocket = isSsl ? SSLSocketFactory.getDefault().createSocket(host, port) : new Socket(host, port);
    rawSocket.setSoTimeout(15000);

    try (var in = new BufferedReader(new InputStreamReader(rawSocket.getInputStream(), StandardCharsets.UTF_8));
         var out = new BufferedWriter(new OutputStreamWriter(rawSocket.getOutputStream(), StandardCharsets.UTF_8))) {

      expect(in, "220");
      sendLine(out, "EHLO courtly.vn");
      readResponse(in);

      Socket socket = rawSocket;
      BufferedReader reader = in;
      BufferedWriter writer = out;

      if (!isSsl && (port == 587 || port == 25)) {
        sendLine(writer, "STARTTLS");
        String resp = in.readLine();
        if (resp != null && resp.startsWith("220")) {
          SSLSocket sslSocket = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault())
              .createSocket(rawSocket, host, port, true);
          sslSocket.startHandshake();
          socket = sslSocket;
          reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
          writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
          sendLine(writer, "EHLO courtly.vn");
          readResponse(reader);
        }
      }

      if (username != null && !username.isBlank() && password != null && !password.isBlank()) {
        sendLine(writer, "AUTH LOGIN");
        expect(reader, "334");
        sendLine(writer, Base64.getEncoder().encodeToString(username.getBytes(StandardCharsets.UTF_8)));
        expect(reader, "334");
        sendLine(writer, Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)));
        expect(reader, "235");
      }

      sendLine(writer, "MAIL FROM:<" + fromAddress + ">");
      expect(reader, "250");
      sendLine(writer, "RCPT TO:<" + to + ">");
      expect(reader, "250");
      sendLine(writer, "DATA");
      expect(reader, "354");

      String boundary = "----=_Part_" + System.currentTimeMillis();
      String rawSubject = "=?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=";
      String fromHeader = fromName != null && !fromName.isBlank()
          ? "=?UTF-8?B?" + Base64.getEncoder().encodeToString(fromName.getBytes(StandardCharsets.UTF_8)) + "?= <" + fromAddress + ">"
          : fromAddress;

      writer.write("From: " + fromHeader + "\r\n");
      writer.write("To: <" + to + ">\r\n");
      writer.write("Subject: " + rawSubject + "\r\n");
      writer.write("MIME-Version: 1.0\r\n");
      writer.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n");
      writer.write("\r\n");

      writer.write("--" + boundary + "\r\n");
      writer.write("Content-Type: text/plain; charset=UTF-8\r\n");
      writer.write("Content-Transfer-Encoding: base64\r\n\r\n");
      writer.write(Base64.getEncoder().encodeToString(textBody.getBytes(StandardCharsets.UTF_8)) + "\r\n\r\n");

      if (htmlBody != null && !htmlBody.isBlank()) {
        writer.write("--" + boundary + "\r\n");
        writer.write("Content-Type: text/html; charset=UTF-8\r\n");
        writer.write("Content-Transfer-Encoding: base64\r\n\r\n");
        writer.write(Base64.getEncoder().encodeToString(htmlBody.getBytes(StandardCharsets.UTF_8)) + "\r\n\r\n");
      }

      writer.write("--" + boundary + "--\r\n");
      writer.write(".\r\n");
      writer.flush();
      expect(reader, "250");

      sendLine(writer, "QUIT");
    }
  }

  private void sendLine(BufferedWriter writer, String line) throws IOException {
    writer.write(line + "\r\n");
    writer.flush();
  }

  private String readResponse(BufferedReader reader) throws IOException {
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) {
      sb.append(line).append("\n");
      if (line.length() >= 4 && line.charAt(3) == ' ') break;
    }
    return sb.toString();
  }

  private void expect(BufferedReader reader, String prefix) throws IOException {
    String resp = readResponse(reader);
    if (!resp.startsWith(prefix)) {
      throw new IOException("Unexpected SMTP response: " + resp);
    }
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/MembershipService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.AccountRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MembershipService {
  private final DocumentService docs;
  private final AuthService auth;
  private final RequestService requests;
  private final AccountRepository accounts;
  private final com.courtly.repository.PaymentRepository payments;

  public List<Map<String, Object>> plans() {
    var saved = docs.list("membership-plan:");
    if (!saved.isEmpty()) return saved;
    return List.of(
        map(
            "id",
            "club",
            "name",
            "Club",
            "price",
            249000,
            "days",
            30,
            "discountPercent",
            10, "vipDiscountPercent", 5, "advanceDays", 14, "freeChanges", 1,
            "enabled",
            true,
            "description",
            "Cho nhịp chơi đều đặn · Miễn phí gửi xe."),
        map(
            "id",
            "plus",
            "name",
            "Plus",
            "price",
            499000,
            "days",
            30,
            "discountPercent",
            15, "vipDiscountPercent", 10, "advanceDays", 21, "freeChanges", 2,
            "enabled",
            true,
            "description",
            "Dành cho người mê tennis · Miễn phí gửi xe & VIP Lounge."));
  }

  public String status(Map<String, Object> m) {
    return "ACTIVE".equals(m.get("status"))
            && !Instant.parse((String) m.get("endsAt")).isAfter(Instant.now())
        ? "EXPIRED"
        : (String) m.get("status");
  }

  public Map<String, Object> view(Account a) {
    var members =
        docs.list("membership:").stream()
            .filter(
                m -> "ADMIN".equals(a.getRole()) || a.getId().toString().equals(m.get("accountId")))
            .map(
                m -> {
                  var copy = new LinkedHashMap<>(m);
                  copy.put("status", status(m));
                  return copy;
                })
            .toList();
    var receipts =
        docs.list("membership-payment:").stream()
            .filter(
                m -> "ADMIN".equals(a.getRole()) || a.getId().toString().equals(m.get("accountId")))
            .toList();
    return map(
        "membershipPlans",
        plans().stream()
            .filter(p -> "ADMIN".equals(a.getRole()) || Boolean.TRUE.equals(p.get("enabled")))
            .toList(),
        "memberships",
        members,
        "membershipPayments",
        receipts);
  }

  public boolean hasActiveMembership(UUID account) {
    if (account == null) return false;
    return docs.list("membership:").stream()
        .anyMatch(
            m ->
                account.toString().equals(m.get("accountId"))
                    && "ACTIVE".equals(status(m))
                    && !Instant.parse((String) m.get("startsAt")).isAfter(Instant.now())
                    && !Instant.parse((String) m.get("endsAt")).isBefore(Instant.now()));
  }

  public Map<String, Object> quote(UUID account, List<CourtSchedule> slots) {
    var member =
        docs.list("membership:").stream()
            .filter(
                m ->
                    account != null
                        && account.toString().equals(m.get("accountId"))
                        && "ACTIVE".equals(status(m))
                        && Instant.parse((String) m.get("startsAt")).isBefore(Instant.now()))
            .findFirst();
    BigDecimal
        gross =
            slots.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add),
        discount = BigDecimal.ZERO;
    if (member.isPresent()) {
      var m = member.get();
      for (var s : slots)
        if (!at(s.getScheduleDate(), s.getStartTime())
                .isBefore(Instant.parse((String) m.get("startsAt")))
            && !at(s.getScheduleDate(), s.getEndTime())
                .isAfter(Instant.parse((String) m.get("endsAt"))))
          discount =
              discount.add(
                  s.getPrice()
                      .multiply(PresentationService.decimal(s.getCourt().getName().toUpperCase(Locale.ROOT).startsWith("V") ? m.getOrDefault("vipDiscountPercent", "plus".equals(m.get("planId")) ? 10 : 5) : m.get("discountPercent")))
                      .divide(new BigDecimal("100"), 0, java.math.RoundingMode.HALF_UP));
    }
    return map(
        "gross",
        gross,
        "discount",
        discount,
        "net",
        gross.subtract(discount),
        "membershipId",
        discount.signum() > 0 ? member.get().get("id") : null,
        "planName",
        discount.signum() > 0 ? member.get().get("planName") : null,
        "discountPercent",
        discount.signum() > 0 ? member.get().get("discountPercent") : 0);
  }

  public void checkWindow(UUID account, List<CourtSchedule> slots) {
    var latest = slots.stream().map(s -> at(s.getScheduleDate(),s.getEndTime())).max(Comparator.naturalOrder()).orElseThrow();
    var member = docs.list("membership:").stream().filter(m -> account.toString().equals(m.get("accountId")) && "ACTIVE".equals(status(m)) && !Instant.parse((String)m.get("endsAt")).isBefore(latest)).findFirst();
    int days = member.map(m -> ((Number)m.getOrDefault("advanceDays", "plus".equals(m.get("planId")) ? 21 : 14)).intValue()).orElse(7);
    require(slots.stream().allMatch(s -> !s.getScheduleDate().isAfter(java.time.LocalDate.now(ZONE).plusDays(days))), "Khoảng đặt trước vượt quyền lợi hội viên ("+days+" ngày)");
  }

  public void consumeChange(UUID account, List<CourtSchedule> before, List<CourtSchedule> after) {
    docs.mutationLock();
    var member = docs.list("membership:").stream().filter(m -> account.toString().equals(m.get("accountId")) && "ACTIVE".equals(status(m))).findFirst();
    if (member.isEmpty()) return; // Guests continue to use the existing club change policy.
    var m = member.get();
    var start = before.stream().map(s -> at(s.getScheduleDate(),s.getStartTime())).min(Comparator.naturalOrder()).orElseThrow();
    require(start.isAfter(Instant.now().plusSeconds(86400)), "Quyền lợi đổi lịch cần báo trước ít nhất 24 giờ; liên hệ quầy");
    var oldMinutes = before.stream().mapToLong(s -> java.time.Duration.between(s.getStartTime(),s.getEndTime()).toMinutes()).sum();
    var newMinutes = after.stream().mapToLong(s -> java.time.Duration.between(s.getStartTime(),s.getEndTime()).toMinutes()).sum();
    require(oldMinutes == newMinutes && zone(before.get(0)).equals(zone(after.get(0))), "Đổi lịch hội viên cần cùng khu sân và thời lượng; liên hệ quầy");
    int used = ((Number)m.getOrDefault("rescheduleUsage",0)).intValue();
    int limit = ((Number)m.getOrDefault("freeChanges","plus".equals(m.get("planId")) ? 2 : 1)).intValue();
    require(used < limit, "Đã dùng hết lượt đổi lịch của gói; liên hệ quầy");
    require(after.stream().allMatch(s -> !at(s.getScheduleDate(),s.getEndTime()).isAfter(Instant.parse((String)m.get("endsAt")))), "Lịch mới vượt thời hạn gói; liên hệ quầy");
    m.put("rescheduleUsage",used+1);docs.put("membership:"+m.get("id"),m);
  }
  private String zone(CourtSchedule s) {var name=s.getCourt().getName().toUpperCase(Locale.ROOT);return name.startsWith("V")?"V":name.startsWith("B")?"B":"A";}

  public Map<String, Object> action(Account a, String method, String path, Map<String, Object> b) {
    require(
        path.equals("/api/membership/plans") ? method.equals("PUT") : method.equals("POST"),
        "Phương thức không hỗ trợ");
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        method + path,
        b,
        () -> {
          if (path.equals("/api/membership/plans")) {
            auth.admin(a);
            var all = new ArrayList<>(plans());
            String id = (String) b.get("id");
            require(all.stream().anyMatch(p -> p.get("id").equals(id)), "Gói không tồn tại");
            for (String key : List.of("price", "days", "discountPercent")) {
              var n = PresentationService.decimal(b.get(key));
              require(n.signum() > 0 && n.scale() <= 0, "Giá trị gói cần là số nguyên dương");
            }
            require(
                PresentationService.decimal(b.get("days")).intValue() <= 366
                    && PresentationService.decimal(b.get("discountPercent")).intValue() <= 50,
                "Giới hạn gói không hợp lệ");
            require(b.get("enabled") instanceof Boolean, "Trạng thái gói không hợp lệ");
            var p =
                map(
                    "id",
                    id,
                    "name",
                    text((String) b.get("name"), "Tên gói"),
                    "description",
                    text((String) b.get("description"), "Mô tả"),
                    "price",
                    b.get("price"),
                    "days",
                    b.get("days"),
                    "discountPercent",
                    b.get("discountPercent"),
                    "enabled",
                    b.get("enabled"));
            for (var old : all) docs.put("membership-plan:" + old.get("id"), old);
            docs.put("membership-plan:" + id, p);
            return map("id", id);
          }
          if (path.equals("/api/membership/requests")) {
            require(
                docs.list("membership:").stream()
                    .noneMatch(
                        m ->
                            a.getId().toString().equals(m.get("accountId"))
                                && Set.of("PENDING", "ACTIVE").contains(status(m))),
                "Bạn đã có gói đang hoạt động hoặc chờ xác nhận");
            var p =
                plans().stream()
                    .filter(
                        x ->
                            x.get("id").equals(b.get("planId"))
                                && Boolean.TRUE.equals(x.get("enabled")))
                    .findFirst()
                    .orElseThrow();
            String id = UUID.randomUUID().toString();
            docs.put(
                "membership:" + id,
                map(
                    "id",
                    id,
                    "accountId",
                    a.getId().toString(),
                    "name",
                    a.getFullName(),
                    "planId",
                    p.get("id"),
                    "planName",
                    p.get("name"),
                    "price",
                    p.get("price"),
                    "days",
                    p.get("days"),
                    "discountPercent",
                    p.get("discountPercent"),
                    "vipDiscountPercent", p.getOrDefault("vipDiscountPercent", "plus".equals(p.get("id")) ? 10 : 5),
                    "advanceDays", p.getOrDefault("advanceDays", "plus".equals(p.get("id")) ? 21 : 14),
                    "freeChanges", p.getOrDefault("freeChanges", "plus".equals(p.get("id")) ? 2 : 1),
                    "status",
                    "PENDING",
                    "createdAt",
                    Instant.now().toString()));
            return map("id", id);
          }
          String[] parts = path.split("/");
          String id = parts[4], operation = parts[5];
          oneOf(operation, "cancel", "activate");
          var m = docs.get("membership:" + id);
          require(!m.isEmpty(), "Đăng ký không tồn tại");
          if (!"ADMIN".equals(a.getRole()))
            require(
                a.getId().toString().equals(m.get("accountId")),
                "Đăng ký không thuộc tài khoản của bạn");
          require("PENDING".equals(m.get("status")), "Đăng ký đã xử lý");
          if (operation.equals("cancel")) {
            m.put("status", "CANCELLED");
            m.put("cancelledAt", Instant.now().toString());
            for (var transfer : docs.list("transfer:")) {
              if ("MEMBERSHIP".equals(transfer.get("type")) && id.equals(transfer.get("targetId"))) {
                transfer.put("status", PresentationService.decimal(transfer.get("received")).signum()>0 ? "REVIEW" : "CANCELLED");
                transfer.put("reviewAmount", PresentationService.decimal(transfer.get("reviewAmount")).add(PresentationService.decimal(transfer.get("received"))));
                docs.put("transfer:"+transfer.get("id"),transfer);
              }
            }
          } else {
            auth.admin(a);
            require(
                Boolean.TRUE.equals(b.get("collected"))
                    && PresentationService.decimal(b.get("amount"))
                            .compareTo(PresentationService.decimal(m.get("price")))
                        == 0,
                "Cần xác minh nhận đủ phí trước khi kích hoạt");
            oneOf((String) b.get("method"), "CASH", "BANK_TRANSFER");
            String code = text((String) b.get("transactionCode"), "Mã phiếu thu");
            require(
                payments.findByTransactionCode(code).isEmpty()
                    && docs.list("membership-payment:").stream()
                        .noneMatch(p -> code.equals(p.get("transactionCode"))),
                "Mã phiếu thu đã tồn tại");
            require(
                "ACTIVE"
                    .equals(
                        accounts
                            .findById(UUID.fromString((String) m.get("accountId")))
                            .orElseThrow()
                            .getStatus()),
                "Tài khoản đã bị khóa");
            m.put("status", "ACTIVE");
            m.put("startsAt", Instant.now().toString());
            m.put(
                "endsAt",
                Instant.now().plusSeconds(((Number) m.get("days")).longValue() * 86400).toString());
            String receipt = UUID.randomUUID().toString();
            docs.put(
                "membership-payment:" + receipt,
                map(
                    "id",
                    receipt,
                    "membershipId",
                    id,
                    "accountId",
                    m.get("accountId"),
                    "planName",
                    m.get("planName"),
                    "amount",
                    m.get("price"),
                    "method",
                    b.get("method"),
                    "transactionCode",
                    code,
                    "createdAt",
                    Instant.now().toString()));
            m.put("paymentId", receipt);
          }
          docs.put("membership:" + id, m);
          return map("id", id);
        });
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/OrderApplicationService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
@Transactional
public class OrderApplicationService {
  private final OrderService service;
  private final AuthService auth;
  private final RequestService requests;
  private final PresentationService presentation;
  private final BookingSupportService support;
  private final DocumentService docs;
  private final OverviewService views;
  private final ObjectMapper mapper;
  private final jakarta.validation.Validator validator;
  private final SettingsService settings;
  private final MembershipService memberships;
  private final CourtScheduleRepository schedules;

  public Map<String, Object> create(BookingRequest r, Account actor) {
    var a = actor;
    require(r.requestId() != null && !r.requestId().isBlank(), "Thiếu mã yêu cầu");
    return requests.execute(
        a.getId(),
        r.requestId(),
        "create-order",
        r,
        () -> {
          service.expireHolds();
          BookingRequest effective = r;
          if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) {
            require(
                r.accountId() == null || r.accountId().equals(a.getId()),
                "Chỉ được đặt cho tài khoản của mình");
            service.continuous(support.selected(r.scheduleIds()));
            memberships.checkWindow(a.getId(), support.selected(r.scheduleIds()));
            effective =
                new BookingRequest(
                    a.getFullName(),
                    a.getPhone(),
                    a.getId(),
                    r.scheduleIds(),
                    r.assignments(),
                    r.requestId(),
                    r.voucherCode());
          }
          UUID id = service.create(effective);
          var o = service.lock(id);
          o.setCreatedByAccount(a);
          if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) {
            var meta = docs.decode(o.getMetadata());
            meta.put("customerFlow", true);
            o.setMetadata(docs.encode(meta));
            customerDeposit(o);
          }
          presentation.history(o, "CREATED", null);
          return map("id", id);
        });
  }

  public Map<String, Object> options(Map<String, Object> b, Account actor) {
    return support.options(
        ids(b.get("scheduleIds")),
        b.get("excludeId") == null ? null : UUID.fromString(b.get("excludeId").toString()),
        actor,
        Set.of("ADMIN", "STAFF").contains(actor.getRole())
            ? (b.get("accountId") == null ? null : UUID.fromString(b.get("accountId").toString()))
            : actor.getId(),
        (String) b.get("voucherCode"));
  }

  private List<UUID> ids(Object value) {
    require(value instanceof List<?>, "Chọn các khung giờ");
    return ((List<?>) value).stream().map(x -> UUID.fromString(x.toString())).toList();
  }

  private List<StaffAssignment> assignments(Map<String, Object> b) {
    return b.get("assignments") == null
        ? List.of()
        : ((List<?>) b.get("assignments"))
            .stream().map(x -> dto(x, StaffAssignment.class)).toList();
  }

  private void customerPolicy(Account a, CustomerOrder o, String action) {
    if (Set.of("ADMIN", "STAFF").contains(a.getRole())) return;
    require(
        Set.of("HOLDING", "CONFIRMED").contains(o.getStatus()), "Chỉ thay đổi trước khi check-in");
    service.future(service.allocated(service.booking(o)));
    if ("HOLDING".equals(o.getStatus())) return;
    var p = docs.decode(settings.get().getPolicies());
    var configured = p.get(action + "CutoffMinutes");
    long cutoff = configured instanceof Number n ? n.longValue() : 1440;
    var start = service.allocated(service.booking(o)).stream()
        .map(s -> at(s.getScheduleDate(), s.getStartTime()))
        .min(Comparator.naturalOrder()).orElseThrow();
    require(!start.isBefore(Instant.now().plusSeconds(cutoff * 60)),
        "Đã qua hạn đổi/hủy; liên hệ quầy");
  }

  public Map<String, Object> cancellationPreview(UUID id, Account actor) {
    support.owns(actor, id);
    var o = service.lock(id);
    customerPolicy(actor, o, "cancel");
    var percent = settings.get().getCancelRefundPercent();
    var refund = o.getPaidAmount().multiply(java.math.BigDecimal.valueOf(percent))
        .divide(java.math.BigDecimal.valueOf(100), 0, java.math.RoundingMode.HALF_UP);
    return map("paid", o.getPaidAmount(), "refundPercent", percent, "refundAmount", refund,
        "retainedAmount", o.getPaidAmount().subtract(refund),
        "status", refund.signum() > 0 ? "REFUND_PENDING" : "NO_REFUND",
        "requestedAt", Instant.now().toString());
  }

  public Map<String, Object> preview(UUID id, Map<String, Object> b, Account actor) {
    var a = actor;
    customerPolicy(a, service.lock(id), "change");
    return support.preview(
        id,
        new MoveBookingRequest(
            ids(b.get("scheduleIds")),
            assignments(b),
            (String) b.get("reason"),
            (String) b.get("requestId")),
        a);
  }

  public Map<String, Object> move(UUID id, Map<String, Object> b, Account actor) {
    var a = actor;
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        "move:" + id,
        b,
        () -> {
          support.owns(a, id);
          var o = service.lock(id);
          customerPolicy(a, o, "change");
          if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) memberships.checkWindow(a.getId(), support.selected(ids(b.get("scheduleIds"))));
          if (Set.of("ADMIN", "STAFF").contains(a.getRole())) text((String) b.get("reason"), "Lý do đổi lịch");
          var old = views.order(o);
          var r =
              new MoveBookingRequest(
                  ids(b.get("scheduleIds")),
                  assignments(b),
                  (String) b.get("reason"),
                  (String) b.get("requestId"));
          var preview = support.preview(id, r, a);
          if (b.get("expectedTotal") != null)
            require(PresentationService.decimal(((Map<?, ?>) preview.get("next")).get("total"))
                .compareTo(PresentationService.decimal(b.get("expectedTotal"))) == 0,
                "Giá đã thay đổi; vui lòng xem trước lịch mới lại");
          if (!Set.of("ADMIN", "STAFF").contains(a.getRole()) && "CONFIRMED".equals(o.getStatus())) memberships.consumeChange(a.getId(), service.allocated(service.booking(o)), support.selected(r.scheduleIds()));
          service.move(id, r);
          if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) customerDeposit(o);
          var extra = docs.decode(o.getMetadata());
          var excess = o.getPaidAmount().subtract(o.getTotalAmount()).max(java.math.BigDecimal.ZERO);
          extra.put("refundPending", excess);
          extra.put("financialReview", excess.signum() > 0 ? "REFUND_PENDING" : null);
          o.setMetadata(docs.encode(extra));
          presentation.history(o, "SCHEDULE", old);
          return map("id", id);
        });
  }

  public Map<String, Object> action(
      UUID id, String action, Map<String, Object> body, Account actor) {
    var b = body == null ? Map.<String, Object>of() : body;
    var a = actor;
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        action + ":" + id,
        b,
        () -> {
          support.owns(a, id);
          var o = service.lock(id);
          var before = views.order(o);
          switch (action) {
            case "cancel" -> {
              customerPolicy(a, o, "cancel");
              if (Set.of("ADMIN", "STAFF").contains(a.getRole())) text((String) b.get("reason"), "Lý do hủy");
              var settlement = cancellationPreview(id, a);
              service.cancel(id);
              var extra = docs.decode(o.getMetadata());
              extra.put("cancellationSettlement", settlement);
              extra.put("refundPending", settlement.get("refundAmount"));
              extra.put("financialReview", PresentationService.decimal(settlement.get("refundAmount")).signum() > 0 ? "REFUND_PENDING" : null);
              o.setMetadata(docs.encode(extra));
            }
            case "check-in" -> {
              var early = docs.decode(settings.get().getPolicies()).get("checkInEarlyMinutes");
              var slots = service.allocated(service.booking(o));
              var start =
                  slots.stream()
                      .map(s -> at(s.getScheduleDate(), s.getStartTime()))
                      .min(Comparator.naturalOrder())
                      .orElseThrow();
              var end =
                  slots.stream()
                      .map(s -> at(s.getScheduleDate(), s.getEndTime()))
                      .max(Comparator.naturalOrder())
                      .orElseThrow();
              if (!(early instanceof Number n)
                  || Instant.now().isBefore(start.minusSeconds(((Number) early).longValue() * 60))
                  || !Instant.now().isBefore(end)
                  || o.getPaidAmount().compareTo(o.getDepositRequired()) < 0)
                text((String) b.get("reason"), "Lý do check-in ngoại lệ");
              service.checkIn(id);
            }
            case "check-out" -> service.checkOut(id);
            case "legacy-staff" ->
                service.verifyLegacy(
                    id,
                    UUID.fromString(b.get("lineId").toString()),
                    ids(b.get("scheduleIds")),
                    (String) b.get("reason"));
            case "invoice" -> {
              service.invoice(id);
              var extra = docs.decode(o.getMetadata());
              var snapshot = views.order(o);
              snapshot.putAll(extra);
              snapshot.remove("invoiceSnapshot");
              extra.putIfAbsent("invoiceSnapshot", snapshot);
              o.setMetadata(docs.encode(extra));
            }
            case "staff" -> service.exactStaff(id, assignments(b));
            case "review", "refund-request" -> {
              text((String) b.get("reason"), "Lý do đối chiếu");
              var extra = docs.decode(o.getMetadata());
              if (action.equals("refund-request")) {
                var n = positive(PresentationService.decimal(b.get("amount")));
                require(n.compareTo(o.getPaidAmount()) <= 0, "Số hoàn dự kiến vượt tiền còn giữ");
                extra.put("refundPending", n);
                extra.put("financialReview", "REFUND_PENDING");
              } else
                extra.put(
                    "financialReview",
                    Boolean.TRUE.equals(b.get("resolved")) ? null : "MANUAL_REVIEW");
              o.setMetadata(docs.encode(extra));
            }
            case "restore" -> {
              text((String) b.get("reason"), "Lý do khôi phục");
              service.restore(
                  id,
                  new MoveBookingRequest(
                      ids(b.get("scheduleIds")),
                      assignments(b),
                      (String) b.get("reason"),
                      (String) b.get("requestId")));
            }
            case "extend" -> {
              var slotIds = ids(b.get("scheduleIds"));
              require(slotIds != null && !slotIds.isEmpty(), "Chọn khung giờ muốn gia hạn");
              service.extend(id, slotIds);
            }
            default ->
                throw new com.courtly.exception.BusinessException(
                    "Thao tác chưa được hỗ trợ: " + action);
          }
          presentation.history(
              o, action.toUpperCase(Locale.ROOT), Set.of("restore", "cancel").contains(action) ? before : null);
          return map("id", id);
        });
  }

  public Map<String, Object> extensionOptions(UUID id, Account actor) {
    support.owns(actor, id);
    var o = service.lock(id);
    var b = service.booking(o);
    var currentSlots = service.allocated(b);
    if (currentSlots.isEmpty()) {
      return map("canExtend", false, "reason", "Đơn chưa có lịch sân");
    }
    var latestSlot = currentSlots.stream()
        .max(Comparator.comparing(CourtSchedule::getScheduleDate).thenComparing(CourtSchedule::getEndTime))
        .orElseThrow();
    var court = latestSlot.getCourt();
    var date = latestSlot.getScheduleDate();
    var endTime = latestSlot.getEndTime();

    var courtSlots = schedules.findByCourtIdAndScheduleDate(court.getId(), date).stream()
        .sorted(Comparator.comparing(CourtSchedule::getStartTime))
        .toList();

    var nextSlot1 = courtSlots.stream().filter(s -> s.getStartTime().equals(endTime)).findFirst().orElse(null);
    if (nextSlot1 == null) {
      return map(
          "canExtend", false,
          "courtName", court.getName(),
          "currentEndTime", endTime.toString(),
          "reason", "Đã hết khung giờ hoạt động trong ngày của sân này.");
    }
    if (!"AVAILABLE".equals(nextSlot1.getStatus())) {
      return map(
          "canExtend", false,
          "courtName", court.getName(),
          "currentEndTime", endTime.toString(),
          "reason", "Sân đã có lịch đặt tiếp theo vào lúc " + endTime + ". Không thể gia hạn sân này.");
    }

    var nextSlot2 = courtSlots.stream().filter(s -> s.getStartTime().equals(nextSlot1.getEndTime())).findFirst().orElse(null);
    boolean slot2Available = nextSlot2 != null && "AVAILABLE".equals(nextSlot2.getStatus());

    UUID accountId = o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId();
    var quote1 = memberships.quote(accountId, List.of(nextSlot1));
    var opt1 = map(
        "duration", 30,
        "scheduleIds", List.of(nextSlot1.getId()),
        "startTime", nextSlot1.getStartTime().toString(),
        "endTime", nextSlot1.getEndTime().toString(),
        "price", quote1.get("gross"),
        "discount", quote1.get("discount"),
        "total", quote1.get("net"),
        "planName", quote1.get("planName")
    );
    List<Map<String, Object>> optionsList = new ArrayList<>();
    optionsList.add(opt1);

    if (slot2Available) {
      var quote2 = memberships.quote(accountId, List.of(nextSlot1, nextSlot2));
      var opt2 = map(
          "duration", 60,
          "scheduleIds", List.of(nextSlot1.getId(), nextSlot2.getId()),
          "startTime", nextSlot1.getStartTime().toString(),
          "endTime", nextSlot2.getEndTime().toString(),
          "price", quote2.get("gross"),
          "discount", quote2.get("discount"),
          "total", quote2.get("net"),
          "planName", quote2.get("planName")
      );
      optionsList.add(opt2);
    }

    return map(
        "canExtend", true,
        "courtName", court.getName(),
        "currentEndTime", endTime.toString(),
        "options", optionsList
    );
  }

  private void customerDeposit(CustomerOrder o) {
    var meta = docs.decode(o.getMetadata());
    var benefit = (Map<String,Object>) meta.get("membershipBenefit");
    var net = benefit == null ? o.getTotalAmount() : PresentationService.decimal(benefit.get("net"));
    var voucher = (Map<String,Object>) meta.get("voucherBenefit");
    if (voucher != null && benefit != null) {
      net = net.subtract(PresentationService.decimal(voucher.get("discount"))).max(java.math.BigDecimal.ZERO);
    }
    o.setDepositRequired(net.multiply(new java.math.BigDecimal("0.5")).setScale(0, java.math.RoundingMode.HALF_UP));
  }

  private <T> T dto(Object value, Class<T> type) {
    var result = mapper.convertValue(value, type);
    var errors = validator.validate(result);
    require(
        errors.isEmpty(),
        errors.stream()
            .map(e -> e.getPropertyPath() + ": " + e.getMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ"));
    return result;
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/OrderService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrderService {
  private final CustomerOrderRepository orders;
  private final AccountRepository accounts;
  private final BookingRepository bookings;
  private final BookingSlotRepository slots;
  private final BookingStaffRepository bookingStaff;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;
  private final ScheduleService scheduling;
  private final SettingsService settings;
  private final OrderTotalsService totals;
  private final AuditService audit;
  private final DocumentService documents;
  private final MembershipService membership;
  private final VoucherService vouchers;

  @Transactional
  public UUID create(BookingRequest request) {
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    future(selected);
    CustomerOrder order = new CustomerOrder();
    if (request.accountId() != null) {
      Account account =
          accounts
              .findById(request.accountId())
              .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
      require("ACTIVE".equals(account.getStatus()), "Tài khoản đã khóa");
      order.setCustomerAccount(account);
      order.setCustomerName(
          request.name() == null || request.name().isBlank()
              ? account.getFullName()
              : text(request.name(), "Tên khách"));
      order.setCustomerPhone(request.phone() == null ? account.getPhone() : request.phone());
    } else {
      order.setCustomerName(text(request.name(), "Tên khách"));
      order.setCustomerPhone(request.phone() == null ? "" : request.phone());
    }
    order.setHoldExpiresAt(Instant.now().plusSeconds(settings.get().getHoldMinutes() * 60L));
    orders.save(order);
    Booking booking = new Booking();
    booking.setOrder(order);
    bookings.save(booking);
    allocate(booking, selected, "LOCKED");
    assignExact(booking, selected, request.assignments());
    quote(order, selected);
    applyVoucher(order, request.voucherCode(), selected);
    totals.recalculate(order);
    order.setDepositRequired(
        depositBase(order)
            .multiply(BigDecimal.valueOf(depositPercent(order)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    audit.log("TẠO ĐƠN", order.getId().toString());
    return order.getId();
  }

  private int depositPercent(CustomerOrder o) {
    return Boolean.TRUE.equals(documents.decode(o.getMetadata()).get("customerFlow")) ? 50 : settings.get().getDepositPercent();
  }

  private BigDecimal depositBase(CustomerOrder o) {
    var metadata = documents.decode(o.getMetadata());
    if (Boolean.TRUE.equals(metadata.get("customerFlow")) && metadata.get("membershipBenefit") instanceof Map<?,?> benefit) {
      var net = PresentationService.decimal(benefit.get("net"));
      if (metadata.get("voucherBenefit") instanceof Map<?,?> voucher) {
        net = net.subtract(PresentationService.decimal(voucher.get("discount"))).max(BigDecimal.ZERO);
      }
      return net;
    }
    return o.getTotalAmount();
  }

  private void applyVoucher(CustomerOrder o, String voucherCode, List<CourtSchedule> selected) {
    if (voucherCode == null || voucherCode.isBlank()) return;
    BigDecimal courtTotal = selected.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    var extra = documents.decode(o.getMetadata());
    UUID accountId = o.getCustomerAccount() != null ? o.getCustomerAccount().getId() : null;
    var voucherBenefit = vouchers.redeem(voucherCode, o, courtTotal, accountId);
    if (voucherBenefit != null) {
      extra.put("voucherBenefit", voucherBenefit);
      o.setMetadata(documents.encode(extra));
    }
  }

  public CustomerOrder lock(UUID id) {
    return orders.findForUpdate(id).orElseThrow(() -> new BusinessException("Không tìm thấy đơn"));
  }

  public Booking booking(CustomerOrder order) {
    return bookings.findByOrderId(order.getId()).stream().findFirst().orElseThrow();
  }

  public List<CourtSchedule> allocated(Booking b) {
    return slots.findByBookingId(b.getId()).stream()
        .filter(x -> x.getReleasedAt() == null)
        .map(BookingSlot::getSchedule)
        .toList();
  }

  private void live(CustomerOrder order) {
    require(active(order.getStatus()), "Đơn đã kết thúc");
    require(
        !"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()),
        "Đơn đã hết thời gian giữ chỗ");
  }

  private void allocate(Booking booking, List<CourtSchedule> selected, String status) {
    for (CourtSchedule slot : selected) {
      slot.setStatus(status);
      BookingSlot row = new BookingSlot();
      row.setBooking(booking);
      row.setSchedule(slot);
      row.setUnitPrice(slot.getPrice());
      slots.save(row);
    }
  }

  private void release(Booking booking) {
    Instant releasedAt = Instant.now();
    for (BookingSlot link :
        slots.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      CourtSchedule slot = schedules.findForUpdate(link.getSchedule().getId()).orElseThrow();
      slot.setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
    for (BookingStaff link :
        bookingStaff.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getStaffSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      staffSchedules
          .findForUpdate(link.getStaffSchedule().getId())
          .orElseThrow()
          .setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
  }

  @Transactional
  public void cancel(UUID id) {
    CustomerOrder order = lock(id);
    require(active(order.getStatus()), "Đơn đã kết thúc");
    order.setStatus("CANCELLED");
    Booking b = booking(order);
    b.setStatus("CANCELLED");
    release(b);
    vouchers.release(id);
    audit.log("HỦY ĐƠN", id.toString());
  }

  @Transactional
  public void checkIn(UUID id) {
    CustomerOrder order = lock(id);
    require("CONFIRMED".equals(order.getStatus()), "Đơn chưa được xác nhận");
    order.setStatus("CHECKED_IN");
    Booking b = booking(order);
    b.setStatus("CHECKED_IN");
    b.setCheckInAt(Instant.now());
    audit.log("CHECK-IN", id.toString());
  }

  @Transactional
  public void checkOut(UUID id) {
    CustomerOrder order = lock(id);
    require("CHECKED_IN".equals(order.getStatus()), "Khách chưa check-in");
    // Preserve the current explicit cash-desk workflow; balances remain in finance.
    order.setStatus("COMPLETED");
    Booking b = booking(order);
    b.setStatus("COMPLETED");
    b.setCheckOutAt(Instant.now());
    release(b);
    audit.log("CHECK-OUT", id.toString());
  }

  @Transactional
  public void extend(UUID id, List<UUID> scheduleIds) {
    CustomerOrder order = lock(id);
    require(Set.of("CHECKED_IN", "CONFIRMED").contains(order.getStatus()), "Chỉ gia hạn cho đơn đang chơi hoặc đã xác nhận");
    Booking b = booking(order);
    List<CourtSchedule> currentSlots = allocated(b);
    require(!currentSlots.isEmpty(), "Đơn chưa có lịch sân");
    var latestCurrentSlot = currentSlots.stream()
        .max(Comparator.comparing(CourtSchedule::getScheduleDate).thenComparing(CourtSchedule::getEndTime))
        .orElseThrow();

    List<CourtSchedule> newSlots = scheduling.lockSlots(scheduleIds);
    scheduling.requireAvailable(newSlots);

    require(newSlots.stream().allMatch(s -> s.getCourt().getId().equals(latestCurrentSlot.getCourt().getId())),
        "Giờ gia hạn phải trên cùng sân đang chơi");

    var sortedNew = newSlots.stream()
        .sorted(Comparator.comparing(CourtSchedule::getScheduleDate).thenComparing(CourtSchedule::getStartTime))
        .toList();
    require(sortedNew.get(0).getScheduleDate().equals(latestCurrentSlot.getScheduleDate())
        && sortedNew.get(0).getStartTime().equals(latestCurrentSlot.getEndTime()),
        "Giờ gia hạn phải liền kề với giờ kết thúc hiện tại (" + latestCurrentSlot.getEndTime() + ")");

    for (int i = 1; i < sortedNew.size(); i++) {
      require(sortedNew.get(i - 1).getEndTime().equals(sortedNew.get(i).getStartTime()),
          "Các slot gia hạn phải liên tiếp nhau");
    }

    allocate(b, newSlots, "BOOKED");

    List<CourtSchedule> allSlots = new ArrayList<>(currentSlots);
    allSlots.addAll(newSlots);
    quote(order, allSlots);
    totals.recalculate(order);

    audit.log("GIA HẠN SÂN", id.toString() + " (+" + (newSlots.size() * 30) + " phút)");
  }

  @Transactional
  public void move(UUID id, MoveBookingRequest request) {
    CustomerOrder order = lock(id);
    live(order);
    Booking b = booking(order);
    require(request.assignments() != null, "Chọn lại trọng tài theo slot");
    // Lock old and new slots in the same order to avoid deadlocks between moves.
    List<UUID> all = new ArrayList<>(request.scheduleIds());
    allocated(b).forEach(x -> all.add(x.getId()));
    all.stream().distinct().sorted().forEach(x -> schedules.findForUpdate(x).orElseThrow());
    release(b);
    slots.flush();
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    allocate(b, selected, "HOLDING".equals(order.getStatus()) ? "LOCKED" : "BOOKED");
    future(selected);
    assignExact(b, selected, request.assignments());
    quote(order, selected);
    totals.recalculate(order);
    order.setDepositRequired(
        depositBase(order)
            .multiply(BigDecimal.valueOf(depositPercent(order)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    audit.log("ĐỔI LỊCH", id.toString());
  }

  @Transactional
  public void invoice(UUID id) {
    CustomerOrder order = lock(id);
    require(
        !Set.of("HOLDING", "CANCELLED", "EXPIRED").contains(order.getStatus()),
        "Đơn chưa đủ điều kiện xuất phiếu thu");
    if (order.getInvoiceNumber() == null) {
      order.setInvoiceNumber("INV-" + order.getId());
      order.setIssuedAt(Instant.now());
    }
  }

  @Scheduled(fixedDelayString = "${courtly.expiry-interval-ms:30000}")
  @Transactional
  public void expireHolds() {
    documents.mutationLock();
    for (var candidate :
        orders.findByStatusAndHoldExpiresAtBefore("HOLDING", Instant.now()).stream()
            .sorted(Comparator.comparing(CustomerOrder::getId))
            .toList()) {
      CustomerOrder order = lock(candidate.getId());
      if (!"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()))
        continue;
      order.setStatus("EXPIRED");
      Booking b = booking(order);
      b.setStatus("CANCELLED");
      release(b);
      vouchers.release(order.getId());
      audit.log("HẾT HẠN", order.getId().toString());
    }
  }

  public void future(List<CourtSchedule> rows) {
    for (var s : rows)
      require(
          at(s.getScheduleDate(), s.getStartTime()).isAfter(Instant.now()),
          "Chọn khung giờ chưa bắt đầu");
  }

  public void continuous(List<CourtSchedule> rows) {
    require(rows != null && !rows.isEmpty(), "Chọn ít nhất một khung giờ");
    Map<UUID, List<CourtSchedule>> byCourt =
        rows.stream().collect(java.util.stream.Collectors.groupingBy(s -> s.getCourt().getId()));
    require(byCourt.size() <= 3, "Tối đa 3 sân trong cùng một đơn đặt");

    for (var entry : byCourt.entrySet()) {
      var sorted = entry.getValue().stream().sorted(Comparator.comparing(CourtSchedule::getStartTime)).toList();
      for (int i = 1; i < sorted.size(); i++) {
        require(
            sorted.get(i - 1).getEndTime().equals(sorted.get(i).getStartTime()),
            "Các giờ chơi trên cùng sân phải liên tiếp nhau");
      }
    }

    if (byCourt.size() > 1) {
      record CourtSpan(LocalTime start, LocalTime end) {}
      List<CourtSpan> spans = new ArrayList<>();
      for (var list : byCourt.values()) {
        LocalTime min = list.stream().map(CourtSchedule::getStartTime).min(Comparator.naturalOrder()).orElseThrow();
        LocalTime max = list.stream().map(CourtSchedule::getEndTime).max(Comparator.naturalOrder()).orElseThrow();
        spans.add(new CourtSpan(min, max));
      }
      spans.sort(Comparator.comparing(CourtSpan::start));

      LocalTime maxEndSoFar = spans.get(0).end;
      for (int i = 1; i < spans.size(); i++) {
        CourtSpan next = spans.get(i);
        if (next.start.isAfter(maxEndSoFar)) {
          long gapMinutes = Duration.between(maxEndSoFar, next.start).toMinutes();
          require(
              gapMinutes <= 30,
              "Các sân trong cùng đơn phải diễn ra cùng khung giờ hoặc nối tiếp nhau (không cách quá 30 phút)");
        }
        if (next.end.isAfter(maxEndSoFar)) {
          maxEndSoFar = next.end;
        }
      }
    }
  }

  public void assignExact(Booking b, List<CourtSchedule> courtSlots, List<StaffAssignment> input) {
    if (input == null) return;
    require(input.size() <= 48, "Quá nhiều phân công");
    Set<UUID> seen = new HashSet<>();
    for (var a : input) {
      var court =
          courtSlots.stream()
              .filter(x -> x.getId().equals(a.scheduleId()))
              .findFirst()
              .orElseThrow(() -> new BusinessException("Slot trọng tài phải nằm trong đơn"));
      if (!seen.add(a.scheduleId())) {
        require(
            bookingStaff.findByBookingId(b.getId()).stream()
                .anyMatch(
                    x ->
                        x.getReleasedAt() == null
                            && x.getCourtSchedule() != null
                            && x.getCourtSchedule().getId().equals(a.scheduleId())
                            && x.getStaffSchedule().getStaff().getId().equals(a.staffId())),
            "Mỗi slot chỉ có một trọng tài");
        continue;
      }
      var existing =
          bookingStaff.findByBookingId(b.getId()).stream()
              .filter(
                  x ->
                      x.getReleasedAt() == null
                          && x.getCourtSchedule() != null
                          && x.getCourtSchedule().getId().equals(court.getId()))
              .toList();
      if (!existing.isEmpty()) {
        require(
            existing.size() == 1
                && existing.get(0).getStaffSchedule().getStaff().getId().equals(a.staffId()),
            "Slot sân đã có trọng tài");
        continue;
      }
      var work = scheduling.lockStaffSlots(a.staffId(), List.of(court));
      for (var shift : work) {
        require("REFEREE".equals(shift.getStaff().getType()), "Chọn nhân sự trọng tài");
        shift.setStatus("BOOKED");
        BookingStaff link = new BookingStaff();
        link.setBooking(b);
        link.setCourtSchedule(court);
        link.setStaffSchedule(shift);
        link.setUnitPrice(shift.getStaff().getHourlyRate());
        bookingStaff.save(link);
      }
    }
  }

  @Transactional
  public void exactStaff(UUID id, List<StaffAssignment> rows) {
    var o = lock(id);
    live(o);
    var b = booking(o);
    require(rows != null, "Chọn phân công trọng tài");
    // The editor submits the complete selection. Retain unchanged historical rates,
    // release removed assignments, and roll back everything if the new set conflicts.
    var releasedAt = Instant.now();
    for (var link : bookingStaff.findByBookingId(b.getId())) {
      if (link.getReleasedAt() != null || link.getCourtSchedule() == null) continue;
      boolean retained = rows.stream().anyMatch(r ->
          link.getCourtSchedule().getId().equals(r.scheduleId())
              && link.getStaffSchedule().getStaff().getId().equals(r.staffId()));
      if (!retained) {
        var shift = staffSchedules.findForUpdate(link.getStaffSchedule().getId()).orElseThrow();
        link.setReleasedAt(releasedAt);
        shift.setStatus("AVAILABLE");
      }
    }
    bookingStaff.flush();
    assignExact(b, allocated(b), rows);
    totals.recalculate(o);
    o.setDepositRequired(
        depositBase(o)
            .multiply(BigDecimal.valueOf(depositPercent(o)))
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
  }

  @Transactional
  public void restore(UUID id, MoveBookingRequest r) {
    var o = lock(id);
    require(
        Set.of("EXPIRED", "CANCELLED").contains(o.getStatus()), "Chỉ khôi phục đơn đã hủy/hết hạn");
    o.setStatus("HOLDING");
    o.setHoldExpiresAt(Instant.now().plusSeconds(settings.get().getHoldMinutes() * 60L));
    move(id, r);
    if (o.getPaidAmount().compareTo(o.getDepositRequired()) >= 0) {
      o.setStatus("CONFIRMED");
      allocated(booking(o)).forEach(s -> s.setStatus("BOOKED"));
    }
  }

  private void quote(CustomerOrder o, List<CourtSchedule> selected) {
    var extra = documents.decode(o.getMetadata());
    extra.put(
        "membershipBenefit",
        membership.quote(
            o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(), selected));
    o.setMetadata(documents.encode(extra));
  }

  @Transactional
  public void verifyLegacy(UUID id, UUID lineId, List<UUID> selected, String reason) {
    var o = lock(id);
    text(reason, "Lý do xác minh");
    var line = bookingStaff.findById(lineId).orElseThrow();
    require(
        line.getBooking().getOrder().getId().equals(id) && line.getCourtSchedule() == null,
        "Phân công không cần xác minh hoặc không thuộc đơn");
    require(selected.size() == 1, "Phân công một giờ cần một slot sân");
    var target =
        allocated(booking(o)).stream()
            .filter(s -> s.getId().equals(selected.get(0)))
            .findFirst()
            .orElseThrow();
    require(
        target.getScheduleDate().equals(line.getStaffSchedule().getWorkDate())
            && target.getStartTime().equals(line.getStaffSchedule().getStartTime()),
        "Slot không khớp lịch làm việc cũ");
    line.setCourtSchedule(target);
    audit.log("XÁC MINH PHÂN CÔNG CŨ", lineId + ": " + reason);
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/OrderTotalsService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderTotalsService {
  @org.springframework.beans.factory.annotation.Autowired private DocumentService documents;
  private final BookingRepository bookings;
  private final BookingSlotRepository slots;
  private final BookingStaffRepository staff;
  private final OrderProductRepository products;

  public BigDecimal productTotal(OrderProduct p) {
    BigDecimal duration =
        "RENTAL".equals(p.getItemType())
            ? BigDecimal.valueOf(Duration.between(p.getRentStartAt(), p.getRentEndAt()).toMinutes())
                .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP)
            : BigDecimal.ONE;
    return p.getUnitPrice()
        .multiply(BigDecimal.valueOf(p.getQuantity()))
        .multiply(duration)
        .setScale(2, RoundingMode.HALF_UP);
  }

  public void recalculate(CustomerOrder order) {
    BigDecimal sum = BigDecimal.ZERO;
    for (Booking booking : bookings.findByOrderId(order.getId())) {
      for (var s : slots.findByBookingId(booking.getId())) {
        if (s.getReleasedAt() == null) sum = sum.add(s.getUnitPrice());
      }
      for (var s : staff.findByBookingId(booking.getId())) {
        if (s.getReleasedAt() == null)
          sum =
              sum.add(
                  s.getUnitPrice()
                      .multiply(
                          hours(
                              s.getStaffSchedule().getStartTime(),
                              s.getStaffSchedule().getEndTime())));
      }
    }
    for (var p : products.findByOrderId(order.getId())) sum = sum.add(productTotal(p));
    // Preserve excess receipts after cheaper moves for explicit reconciliation.
    if (documents != null) {
      var extra = documents.decode(order.getMetadata());
      Object benefit = extra.get("membershipBenefit");
      if (benefit instanceof java.util.Map<?, ?> m)
        sum = sum.subtract(PresentationService.decimal(m.get("discount")));
      Object voucher = extra.get("voucherBenefit");
      if (voucher instanceof java.util.Map<?, ?> vm)
        sum = sum.subtract(PresentationService.decimal(vm.get("discount")));
      if (sum.compareTo(BigDecimal.ZERO) < 0) sum = BigDecimal.ZERO;
    }
    order.setSubtotal(sum);
    order.setTotalAmount(sum);
    updatePaymentStatus(order);
  }

  public void updatePaymentStatus(CustomerOrder order) {
    order.setPaymentStatus(
        order.getPaidAmount().signum() == 0
            ? "UNPAID"
            : order.getPaidAmount().compareTo(order.getTotalAmount()) >= 0 ? "PAID" : "PARTIAL");
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/OverviewService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OverviewService {
  private final AccountRepository accounts;
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository schedules;
  private final CustomerOrderRepository orders;
  private final BookingRepository bookings;
  private final BookingSlotRepository bookingSlots;
  private final BookingStaffRepository bookingStaff;
  private final OrderProductRepository products;
  private final StaffRepository staff;
  private final StaffScheduleRepository staffSchedules;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TeamMemberRepository members;
  private final TournamentMatchRepository matches;
  private final MatchSlotRepository matchSlots;
  private final MatchStaffRepository matchStaff;
  private final AuditLogRepository audit;
  private final ClubSettingsRepository settings;
  private final PaymentService paymentService;
  private final OrderTotalsService totals;

  public Map<String, Object> publicGet(LocalDate date) {
    ClubSettings s = settings.findAll().stream().findFirst().orElseThrow();
    return map(
        "courts",
            courts.findAll().stream()
                .sorted(Comparator.comparing(Court::getName))
                .map(
                    c ->
                        map(
                            "id",
                            c.getId(),
                            "name",
                            c.getName(),
                            "type",
                            c.getType(),
                            "status",
                            c.getStatus(),
                            "price",
                            c.getBasePrice(),
                            "description",
                            c.getDescription(),
                            "address",
                            c.getAddress(),
                            "amenities",
                            c.getAmenities(),
                            "imageUrl",
                            c.getImageUrl(),
                            "imageIsIllustration",
                            c.isImageIsIllustration()))
                .toList(),
        "prices",
            prices.findAllWithCourt().stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "dayType",
                            p.getDayType(),
                            "start",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "end",
                            p.getEndTime().getHour() + p.getEndTime().getMinute() / 60.0,
                            "price",
                            p.getPricePerHour()))
                .toList(),
        "schedules",
            schedules.findByScheduleDateOrderByStartTime(date).stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "date",
                            p.getScheduleDate(),
                            "start", p.getStartTime(), "end", p.getEndTime(),
                            "hour",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "price",
                            p.getPrice(),
                            "status",
                            !"ACTIVE".equals(p.getCourt().getStatus()) ? "BLOCKED" : p.getStatus(),
                            "version",
                            p.getVersion()))
                .toList(),
        "tournaments",
            tournaments.findAll().stream()
                .map(
                    t ->
                        map(
                            "id",
                            t.getId(),
                            "name",
                            t.getName(),
                            "format",
                            t.getFormat(),
                            "start",
                            t.getStartDate(),
                            "end",
                            t.getEndDate(),
                            "deadline",
                            t.getRegistrationDeadline(),
                            "fee",
                            t.getRegistrationFee(),
                            "max",
                            t.getMaxParticipants(),
                            "status",
                            t.getStatus(),
                            "location",
                            t.getLocation()))
                .toList(),
        "settings",
            map(
                "holdMinutes",
                s.getHoldMinutes(),
                "depositPercent",
                s.getDepositPercent(),
                "cancelRefundPercent",
                s.getCancelRefundPercent()));
  }

  public Map<String, Object> get(LocalDate date) {
    ClubSettings s = settings.findAll().stream().findFirst().orElseThrow();

    var allBookings = bookings.findAllWithOrder();
    var allSlots = bookingSlots.findAllWithDetails();
    var allProducts = products.findAllWithDetails();
    var allStaff = bookingStaff.findAllWithDetails();

    Map<UUID, List<Booking>> bookingsByOrder =
        allBookings.stream()
            .filter(b -> b.getOrder() != null)
            .collect(Collectors.groupingBy(b -> b.getOrder().getId()));

    Map<UUID, List<BookingSlot>> slotsByBooking =
        allSlots.stream()
            .filter(bs -> bs.getBooking() != null)
            .collect(Collectors.groupingBy(bs -> bs.getBooking().getId()));

    Map<UUID, List<OrderProduct>> productsByOrder =
        allProducts.stream()
            .filter(op -> op.getOrder() != null)
            .collect(Collectors.groupingBy(op -> op.getOrder().getId()));

    Map<UUID, List<BookingStaff>> staffByBooking =
        allStaff.stream()
            .filter(bs -> bs.getBooking() != null)
            .collect(Collectors.groupingBy(bs -> bs.getBooking().getId()));

    var allRefunds = refunds.findAllWithPayment();
    Map<UUID, BigDecimal> refundsByPayment =
        allRefunds.stream()
            .filter(r -> r.getPayment() != null)
            .collect(
                Collectors.groupingBy(
                    r -> r.getPayment().getId(),
                    Collectors.reducing(BigDecimal.ZERO, Refund::getAmount, BigDecimal::add)));

    var allPayments = payments.findAllWithOrderAndRegistration();
    Map<UUID, List<Payment>> paymentsByRegistration =
        allPayments.stream()
            .filter(p -> p.getRegistration() != null)
            .collect(Collectors.groupingBy(p -> p.getRegistration().getId()));

    var allMembers = members.findAllWithRegistration();
    Map<UUID, List<TeamMember>> membersByRegistration =
        allMembers.stream()
            .filter(m -> m.getRegistration() != null)
            .collect(Collectors.groupingBy(m -> m.getRegistration().getId()));

    var allMatchSlots = matchSlots.findAllWithDetails();
    Map<UUID, List<MatchSlot>> matchSlotsByMatch =
        allMatchSlots.stream()
            .filter(ms -> ms.getMatch() != null)
            .collect(Collectors.groupingBy(ms -> ms.getMatch().getId()));

    var allMatchStaff = matchStaff.findAllWithDetails();
    Map<UUID, List<MatchStaff>> matchStaffByMatch =
        allMatchStaff.stream()
            .filter(ms -> ms.getMatch() != null)
            .collect(Collectors.groupingBy(ms -> ms.getMatch().getId()));

    return map(
        "courts",
            courts.findAll().stream()
                .sorted(Comparator.comparing(Court::getName))
                .map(
                    c ->
                        map(
                            "id",
                            c.getId(),
                            "name",
                            c.getName(),
                            "type",
                            c.getType(),
                            "status",
                            c.getStatus(),
                            "price",
                            c.getBasePrice(),
                            "description",
                            c.getDescription(),
                            "address",
                            c.getAddress(),
                            "amenities",
                            c.getAmenities(),
                            "imageUrl",
                            c.getImageUrl(),
                            "imageIsIllustration",
                            c.isImageIsIllustration()))
                .toList(),
        "prices",
            prices.findAllWithCourt().stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "dayType",
                            p.getDayType(),
                            "start",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "end",
                            p.getEndTime().getHour() + p.getEndTime().getMinute() / 60.0,
                            "price",
                            p.getPricePerHour()))
                .toList(),
        "schedules",
            schedules.findByScheduleDateOrderByStartTime(date).stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "date",
                            p.getScheduleDate(),
                            "start", p.getStartTime(), "end", p.getEndTime(),
                            "hour",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "price",
                            p.getPrice(),
                            "status",
                            !"ACTIVE".equals(p.getCourt().getStatus()) ? "BLOCKED" : p.getStatus(),
                            "version",
                            p.getVersion()))
                .toList(),
        "accounts",
            accounts.findAll().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "name",
                            a.getFullName(),
                            "email",
                            a.getEmail(),
                            "phone",
                            a.getPhone(),
                            "role",
                            a.getRole(),
                            "status",
                            a.getStatus()))
                .toList(),
        "staff",
            staff.findAll().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "name",
                            a.getFullName(),
                            "phone",
                            a.getPhone(),
                            "type",
                            a.getType(),
                            "rate",
                            a.getHourlyRate(),
                            "status",
                            a.getStatus()))
                .toList(),
        "staffSchedules",
            staffSchedules.findByWorkDateOrderByStartTime(date).stream()
                .map(
                    x ->
                        map(
                            "id",
                            x.getId(),
                            "staff",
                            x.getStaff().getId(),
                            "date",
                            x.getWorkDate(),
                            "start",
                            x.getStartTime().getHour() + x.getStartTime().getMinute() / 60.0,
                            "end",
                            x.getEndTime().getHour() + x.getEndTime().getMinute() / 60.0,
                            "status",
                            x.getStatus()))
                .toList(),
        "orders",
            orders.findAllWithCustomerAccount().stream()
                .map(
                    o ->
                        order(
                            o,
                            bookingsByOrder,
                            slotsByBooking,
                            productsByOrder,
                            staffByBooking))
                .toList(),
        "products", List.of(),
        "payments",
            allPayments.stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "orderId",
                            p.getOrder() == null ? null : p.getOrder().getId(),
                            "registrationId",
                            p.getRegistration() == null ? null : p.getRegistration().getId(),
                            "amount",
                            p.getAmount(),
                            "method",
                            p.getMethod(),
                            "type",
                            p.getType(),
                            "createdAt",
                            p.getPaidAt(),
                            "transactionCode",
                            p.getTransactionCode(),
                            "refundable",
                            p.getAmount()
                                .subtract(
                                    refundsByPayment.getOrDefault(
                                        p.getId(), BigDecimal.ZERO))))
                .toList(),
        "refunds",
            allRefunds.stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "paymentId",
                            p.getPayment().getId(),
                            "amount",
                            p.getAmount(),
                            "reason",
                            p.getReason(),
                            "createdAt",
                            p.getRefundedAt()))
                .toList(),
        "tournaments",
            tournaments.findAll().stream()
                .map(
                    t ->
                        map(
                            "id",
                            t.getId(),
                            "name",
                            t.getName(),
                            "format",
                            t.getFormat(),
                            "start",
                            t.getStartDate(),
                            "end",
                            t.getEndDate(),
                            "deadline",
                            t.getRegistrationDeadline(),
                            "fee",
                            t.getRegistrationFee(),
                            "max",
                            t.getMaxParticipants(),
                            "status",
                            t.getStatus(),
                            "location",
                            t.getLocation()))
                .toList(),
        "registrations",
            registrations.findAllWithTournamentAndAccount().stream()
                .map(
                    r -> {
                      var rPayments =
                          paymentsByRegistration.getOrDefault(r.getId(), List.of());
                      var paid =
                          rPayments.stream()
                              .map(
                                  p ->
                                      p.getAmount()
                                          .subtract(
                                              refundsByPayment.getOrDefault(
                                                  p.getId(), BigDecimal.ZERO)))
                              .reduce(BigDecimal.ZERO, BigDecimal::add);
                      var rMembers =
                          membersByRegistration.getOrDefault(r.getId(), List.of()).stream()
                              .map(TeamMember::getMemberName)
                              .toList();
                      return map(
                          "id",
                          r.getId(),
                          "tournamentId",
                          r.getTournament().getId(),
                          "accountId",
                          r.getAccount().getId(),
                          "name",
                          r.getTeamName(),
                          "status",
                          r.getStatus(),
                          "paid",
                          paid,
                          "members",
                          rMembers);
                    })
                .toList(),
        "matches",
            matches.findAll().stream()
                .sorted(
                    Comparator.comparing(TournamentMatch::getRoundNumber)
                        .thenComparing(TournamentMatch::getBracketIndex))
                .map(m -> match(m, matchSlotsByMatch, matchStaffByMatch))
                .toList(),
        "audit",
            audit.findTop100ByOrderByCreatedAtDesc().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "actor",
                            a.getActor(),
                            "action",
                            a.getAction(),
                            "detail",
                            a.getDetail(),
                            "at",
                            a.getCreatedAt()))
                .toList(),
        "settings",
            map(
                "holdMinutes",
                s.getHoldMinutes(),
                "depositPercent",
                s.getDepositPercent(),
                "cancelRefundPercent",
                s.getCancelRefundPercent()));
  }

  private <T> List<T> currentLinks(List<T> list, Function<T, Instant> released) {
    var active = list.stream().filter(x -> released.apply(x) == null).toList();
    if (!active.isEmpty()) return active;
    Instant latest =
        list.stream()
            .map(released)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null);
    return list.stream().filter(x -> Objects.equals(released.apply(x), latest)).toList();
  }

  public Map<String, Object> order(CustomerOrder o) {
    Booking b = bookings.findByOrderId(o.getId()).stream().findFirst().orElseThrow();
    var slots = currentLinks(bookingSlots.findByBookingId(b.getId()), BookingSlot::getReleasedAt);
    return buildOrderMap(
        o,
        b,
        slots,
        products.findByOrderId(o.getId()),
        bookingStaff.findByBookingId(b.getId()));
  }

  public Map<String, Object> order(
      CustomerOrder o,
      Map<UUID, List<Booking>> bookingsByOrder,
      Map<UUID, List<BookingSlot>> slotsByBooking,
      Map<UUID, List<OrderProduct>> productsByOrder,
      Map<UUID, List<BookingStaff>> staffByBooking) {
    List<Booking> bList = bookingsByOrder.getOrDefault(o.getId(), List.of());
    if (bList.isEmpty()) {
      return order(o);
    }
    Booking b = bList.get(0);
    var slots = currentLinks(slotsByBooking.getOrDefault(b.getId(), List.of()), BookingSlot::getReleasedAt);
    return buildOrderMap(
        o,
        b,
        slots,
        productsByOrder.getOrDefault(o.getId(), List.of()),
        staffByBooking.getOrDefault(b.getId(), List.of()));
  }

  private Map<String, Object> buildOrderMap(
      CustomerOrder o,
      Booking b,
      List<BookingSlot> slots,
      List<OrderProduct> orderProducts,
      List<BookingStaff> staffList) {
    return map(
        "id",
        o.getId(),
        "bookingId",
        b.getId(),
        "name",
        o.getCustomerName(),
        "phone",
        o.getCustomerPhone(),
        "accountId",
        o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(),
        "date",
        slots.isEmpty() ? null : slots.get(0).getSchedule().getScheduleDate(),
        "status",
        o.getStatus(),
        "total",
        o.getTotalAmount(),
        "paid",
        o.getPaidAmount(),
        "deposit",
        o.getDepositRequired(),
        "createdAt",
        o.getCreatedAt(),
        "holdUntil",
        o.getHoldExpiresAt(),
        "checkInAt",
        b.getCheckInAt(),
        "checkOutAt",
        b.getCheckOutAt(),
        "invoice",
        o.getInvoiceNumber(),
        "issuedAt",
        o.getIssuedAt(),
        "metadataRaw",
        o.getMetadata(),
        "slots",
        slots.stream().map(x -> slot(x.getSchedule(), x.getUnitPrice())).toList(),
        "products",
        orderProducts.stream()
            .map(
                x ->
                    map(
                        "id",
                        x.getId(),
                        "productId",
                        x.getDrink() != null ? x.getDrink().getId() : x.getRentalItem().getId(),
                        "name",
                        x.getDrink() != null ? x.getDrink().getName() : x.getRentalItem().getName(),
                        "type",
                        x.getItemType(),
                        "quantity",
                        x.getQuantity(),
                        "price",
                        x.getUnitPrice(),
                        "lineTotal",
                        totals.productTotal(x),
                        "hours",
                        x.getRentStartAt() == null
                            ? 1
                            : Duration.between(x.getRentStartAt(), x.getRentEndAt()).toHours(),
                        "returned",
                        x.getReturnedAt() != null,
                        "condition",
                        x.getCondition(),
                        "issuedAt",
                        x.getIssuedAt()))
            .toList(),
        "staff",
        staffList.stream()
            .filter(
                x ->
                    x.getReleasedAt() == null
                        || !active(o.getStatus())
                            && slots.stream()
                                .anyMatch(
                                    link ->
                                        link.getReleasedAt() != null
                                            && link.getReleasedAt().equals(x.getReleasedAt())))
            .map(
                x ->
                    map(
                        "id",
                        x.getId(),
                        "staffId",
                        x.getStaffSchedule().getStaff().getId(),
                        "name",
                        x.getStaffSchedule().getStaff().getFullName(),
                        "rate",
                        x.getUnitPrice(),
                        "hours",
                        hours(
                            x.getStaffSchedule().getStartTime(), x.getStaffSchedule().getEndTime()),
                        "legacyNeedsReview",
                        x.getCourtSchedule() == null,
                        "scheduleId",
                        x.getCourtSchedule() == null ? null : x.getCourtSchedule().getId(),
                        "court",
                        x.getCourtSchedule() == null
                            ? null
                            : x.getCourtSchedule().getCourt().getId(),
                        "start", x.getStaffSchedule().getStartTime(), "end", x.getStaffSchedule().getEndTime(),
                        "hour",
                        x.getStaffSchedule().getStartTime().getHour() + x.getStaffSchedule().getStartTime().getMinute() / 60.0,
                        "date",
                        x.getStaffSchedule().getWorkDate()))
            .toList());
  }

  private Map<String, Object> slot(CourtSchedule s, Object price) {
    return map(
        "id",
        s.getId(),
        "court",
        s.getCourt().getId(),
        "start", s.getStartTime(), "end", s.getEndTime(),
        "hour",
        s.getStartTime().getHour() + s.getStartTime().getMinute() / 60.0,
        "price",
        price);
  }

  private Map<String, Object> match(
      TournamentMatch m,
      Map<UUID, List<MatchSlot>> matchSlotsByMatch,
      Map<UUID, List<MatchStaff>> matchStaffByMatch) {
    var slots =
        currentLinks(
            matchSlotsByMatch.getOrDefault(m.getId(), List.of()),
            MatchSlot::getReleasedAt);
    var staff =
        currentLinks(
            matchStaffByMatch.getOrDefault(m.getId(), List.of()),
            MatchStaff::getReleasedAt);
    return map(
        "id",
        m.getId(),
        "tournamentId",
        m.getTournament().getId(),
        "round",
        m.getRoundNumber(),
        "index",
        m.getBracketIndex(),
        "roundName",
        m.getRoundName(),
        "reg1",
        m.getRegistration1() == null ? null : m.getRegistration1().getId(),
        "reg2",
        m.getRegistration2() == null ? null : m.getRegistration2().getId(),
        "winner",
        m.getWinnerRegistration() == null ? null : m.getWinnerRegistration().getId(),
        "score",
        m.getScore(),
        "status",
        m.getStatus(),
        "slots",
        slots.stream().map(x -> slot(x.getSchedule(), 0)).toList(),
        "date",
        slots.isEmpty() ? null : slots.get(0).getSchedule().getScheduleDate(),
        "staffId",
        staff.isEmpty() ? null : staff.get(0).getStaffSchedule().getStaff().getId());
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/PaymentService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.*;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentService {
  @org.springframework.beans.factory.annotation.Autowired private DocumentService documents;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final CustomerOrderRepository orders;
  private final TournamentRegistrationRepository registrations;
  private final TournamentMatchRepository matches;
  private final BookingRepository bookings;
  private final BookingSlotRepository slots;
  private final OrderTotalsService totals;
  private final AuditService audit;

  public BigDecimal net(Payment payment) {
    return payment
        .getAmount()
        .subtract(
            refunds.findByPaymentId(payment.getId()).stream()
                .map(Refund::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  public BigDecimal registrationPaid(UUID id) {
    return payments.findByRegistrationId(id).stream()
        .map(this::net)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  @Transactional
  public UUID collect(PaymentRequest request) {
    require(
        (request.orderId() == null) != (request.registrationId() == null),
        "Chỉ chọn một đơn hoặc đăng ký giải");
    if (documents != null)
      require(
          documents.list("membership-payment:").stream()
              .noneMatch(p -> request.transactionCode().equals(p.get("transactionCode"))),
          "Mã giao dịch đã dùng cho phí hội viên");
    var existing = payments.findByTransactionCode(request.transactionCode());
    if (existing.isPresent()) {
      Payment old = existing.get();
      require(
          Objects.equals(old.getOrder() == null ? null : old.getOrder().getId(), request.orderId())
              && Objects.equals(
                  old.getRegistration() == null ? null : old.getRegistration().getId(),
                  request.registrationId())
              && old.getAmount().compareTo(request.amount()) == 0
              && old.getMethod().equals(request.method()),
          "Mã giao dịch đã dùng cho khoản thu khác");
      return old.getId();
    }
    Payment payment = new Payment();
    payment.setAmount(positive(request.amount()));
    payment.setMethod(oneOf(request.method(), "CASH", "BANK_TRANSFER"));
    payment.setTransactionCode(text(request.transactionCode(), "Mã giao dịch"));
    payment.setPaidAt(Instant.now());
    if (request.orderId() != null) {
      CustomerOrder order =
          orders
              .findForUpdate(request.orderId())
              .orElseThrow(() -> new BusinessException("Đơn không tồn tại"));
      if (Set.of("EXPIRED", "CANCELLED").contains(order.getStatus()))
        text(request.reason(), "Lý do ghi nhận tiền đến muộn");
      else
        require(
            active(order.getStatus()) || "COMPLETED".equals(order.getStatus()),
            "Đơn không nhận thanh toán");
      require(
          !"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()),
          "Đơn vừa hết hạn. Tải lại và ghi nhận đối soát");
      require(
          payment.getAmount().compareTo(order.getTotalAmount().subtract(order.getPaidAmount()))
              <= 0,
          "Thu vượt số tiền còn thiếu");
      payment.setOrder(order);
      payment.setType(
          order.getPaidAmount().compareTo(order.getDepositRequired()) < 0 ? "DEPOSIT" : "BALANCE");
      order.setPaidAmount(order.getPaidAmount().add(payment.getAmount()));
      if ("HOLDING".equals(order.getStatus())
          && order.getPaidAmount().compareTo(order.getDepositRequired()) >= 0) {
        order.setStatus("CONFIRMED");
        for (Booking b : bookings.findByOrderId(order.getId())) {
          b.setStatus("CONFIRMED");
          slots.findByBookingId(b.getId()).stream()
              .filter(x -> x.getReleasedAt() == null)
              .forEach(x -> x.getSchedule().setStatus("BOOKED"));
        }
      }
      totals.updatePaymentStatus(order);
    } else {
      var registration =
          registrations
              .findForUpdate(request.registrationId())
              .orElseThrow(() -> new BusinessException("Đăng ký không tồn tại"));
      require(
          !"CANCELLED".equals(registration.getStatus())
              && !"CANCELLED".equals(registration.getTournament().getStatus()),
          "Đăng ký hoặc giải đã hủy");
      BigDecimal paid = registrationPaid(registration.getId());
      BigDecimal fee = registration.getTournament().getRegistrationFee();
      require(payment.getAmount().compareTo(fee.subtract(paid)) <= 0, "Thu vượt phí còn thiếu");
      payment.setRegistration(registration);
      payment.setType("TOURNAMENT_FEE");
      if (paid.add(payment.getAmount()).compareTo(fee) >= 0) registration.setStatus("CONFIRMED");
    }
    payments.save(payment);
    audit.log("THU TIỀN", payment.getId().toString());
    return payment.getId();
  }

  @Transactional
  public UUID refund(UUID id, RefundRequest request) {
    Payment original =
        payments.findById(id).orElseThrow(() -> new BusinessException("Không tìm thấy giao dịch"));
    CustomerOrder order =
        original.getOrder() == null
            ? null
            : orders.findForUpdate(original.getOrder().getId()).orElseThrow();
    TournamentRegistration reg =
        original.getRegistration() == null
            ? null
            : registrations.findForUpdate(original.getRegistration().getId()).orElseThrow();
    Payment payment = payments.findForUpdate(id).orElseThrow();
    BigDecimal amount = positive(request.amount());
    require(amount.compareTo(net(payment)) <= 0, "Tổng hoàn vượt số tiền đã thu còn lại");
    if (reg != null)
      require(
          matches.findByTournamentId(reg.getTournament().getId()).isEmpty()
              || "CANCELLED".equals(reg.getTournament().getStatus()),
          "Hủy giải trước khi hoàn phí của giải đã bốc thăm");
    Refund refund = new Refund();
    refund.setPayment(payment);
    refund.setAmount(amount);
    refund.setReason(text(request.reason(), "Lý do hoàn"));
    refund.setRefundedAt(Instant.now());
    refunds.save(refund);
    if (order != null) {
      if (documents != null) {
        var extra = documents.decode(order.getMetadata());
        var pending = PresentationService.decimal(extra.get("refundPending"));
        if (pending.signum() > 0) {
          var remaining = pending.subtract(amount).max(BigDecimal.ZERO);
          extra.put("refundPending", remaining);
          if (remaining.signum() == 0 && "REFUND_PENDING".equals(extra.get("financialReview")))
            extra.put("financialReview", null);
        }
        order.setMetadata(documents.encode(extra));
      }
      order.setPaidAmount(order.getPaidAmount().subtract(amount));
      totals.updatePaymentStatus(order);
    }
    if (reg != null) reg.setStatus("PENDING");
    audit.log("HOÀN TIỀN", refund.getId().toString());
    return refund.getId();
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/PresentationService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PresentationService {
  private final OverviewService overview;
  private final ScheduleService schedules;
  private final OrderService orders;
  private final DocumentService docs;
  private final ContentService content;
  private final AuthService auth;
  private final CustomerOrderRepository orderRepo;
  private final AccountRepository accounts;
  private final SettingsService settings;
  private final MembershipService membership;
  private final StaffRepository staff;

  @Value("${courtly.seed-demo:false}")
  private boolean sample;

  public static BigDecimal decimal(Object v) {
    return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
  }

  private static List<Map<String, Object>> rows(Map<String, Object> m, String k) {
    return (List<Map<String, Object>>) m.getOrDefault(k, List.of());
  }

  private boolean same(Object a, Object b) {
    return a != null && b != null && a.toString().equals(b.toString());
  }

  public Map<String, Object> get(LocalDate date, Account viewer) {
    require(
        date != null
            && !date.isBefore(LocalDate.now(ZONE).minusYears(10))
            && !date.isAfter(LocalDate.now(ZONE).plusDays(90)),
        "Ngày ngoài khoảng hỗ trợ");

    if (viewer == null) {
      require(!date.isBefore(LocalDate.now(ZONE)), "Chọn ngày hôm nay hoặc ngày sắp tới");
      orders.expireHolds();
      schedules.generate(date);
      var v = overview.publicGet(date);
      var tournaments = rows(v, "tournaments");
      return map(
          "membershipPlans",
          membership.plans().stream().filter(p -> Boolean.TRUE.equals(p.get("enabled"))).toList(),
          "club",
          content.club(),
          "sample",
          sample,
          "courts",
          v.get("courts"),
          "prices",
          v.get("prices"),
          "schedules",
          v.get("schedules"),
          "tournaments",
          tournaments.stream().filter(t -> !"DRAFT".equals(t.get("status"))).toList(),
          "refereeRates", refereeRates(),
          "settings", publicSettings(),
          "orders",
          List.of(),
          "accounts",
          List.of(),
          "registrations",
          List.of(),
          "payments",
          List.of(),
          "refunds",
          List.of());
    }

    orders.expireHolds();
    schedules.generate(date);
    var v = overview.get(date);
    var regs = rows(v, "registrations");
    var tournaments = rows(v, "tournaments");
    for (var t : tournaments)
      t.put(
          "registeredCount",
          regs.stream()
              .filter(
                  r ->
                      same(r.get("tournamentId"), t.get("id"))
                          && !"CANCELLED".equals(r.get("status")))
              .count());

    Map<UUID, Account> accountEntities =
        accounts.findAll().stream().collect(Collectors.toMap(Account::getId, a -> a));
    for (var a : rows(v, "accounts")) {
      var account = accountEntities.get(UUID.fromString(a.get("id").toString()));
      if (account != null) {
        a.put("loginLinked", account.getPasswordHash() != null);
        a.put("isOwner", auth.owner(account));
      }
    }

    Map<String, List<Map<String, Object>>> paymentsByOrder =
        rows(v, "payments").stream()
            .filter(p -> p.get("orderId") != null)
            .collect(Collectors.groupingBy(p -> p.get("orderId").toString()));

    Map<String, BigDecimal> refundsByPayment =
        rows(v, "refunds").stream()
            .filter(r -> r.get("paymentId") != null)
            .collect(
                Collectors.groupingBy(
                    r -> r.get("paymentId").toString(),
                    Collectors.reducing(
                        BigDecimal.ZERO, r -> decimal(r.get("amount")), BigDecimal::add)));

    for (var o : rows(v, "orders")) {
      var rawMeta = o.get("metadataRaw");
      if (rawMeta != null) {
        o.putAll(docs.decode(rawMeta.toString()));
      } else {
        var entity = orderRepo.findById(UUID.fromString(o.get("id").toString())).orElseThrow();
        o.putAll(docs.decode(entity.getMetadata()));
      }
      var receipts = paymentsByOrder.getOrDefault(o.get("id").toString(), List.of());
      var ids = receipts.stream().map(p -> p.get("id").toString()).toList();
      var gross =
          receipts.stream()
              .map(p -> decimal(p.get("amount")))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      var refunded =
          ids.stream()
              .map(id -> refundsByPayment.getOrDefault(id, BigDecimal.ZERO))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      var total = decimal(o.get("total"));
      var paid = decimal(o.get("paid"));
      boolean ended = Set.of("CANCELLED", "EXPIRED").contains(o.get("status"));
      var excess = paid.subtract(total).max(BigDecimal.ZERO);
      var review = o.get("financialReview");
      boolean policyRetained = o.get("cancellationSettlement") instanceof Map<?, ?> settlement
          && paid.compareTo(decimal(settlement.get("retainedAmount"))) == 0;
      if (review == null && (excess.signum() > 0 || ended && paid.signum() > 0 && !policyRetained))
        review = "POLICY_REVIEW";
      o.put(
          "finance",
          map(
              "grossReceived",
              gross,
              "refunded",
              refunded,
              "netPaid",
              paid,
              "due",
              ended ? BigDecimal.ZERO : total.subtract(paid).max(BigDecimal.ZERO),
              "excess",
              excess,
              "refundPending",
              o.getOrDefault("refundPending", 0),
              "balanceNeedsReconciliation",
              gross.subtract(refunded).compareTo(paid) != 0,
              "review",
              review,
              "paymentStatus",
              refunded.signum() > 0
                  ? (paid.signum() == 0 ? "REFUNDED" : "PARTIAL_REFUND")
                  : paid.signum() == 0
                      ? "UNPAID"
                      : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL"));
    }
    ((Map<String, Object>) v.get("settings"))
        .put("policies", docs.decode(settings.get().getPolicies()));
    v.put("refereeRates", refereeRates());
    v.put("club", content.club());
    v.put("sample", sample);

    v.putAll(membership.view(viewer));
    v.put("viewer", auth.user(viewer));
    if (Set.of("ADMIN", "STAFF").contains(viewer.getRole())) return v;
    var mine =
        rows(v, "orders").stream().filter(o -> same(o.get("accountId"), viewer.getId())).toList();
    var mineRegs = regs.stream().filter(r -> same(r.get("accountId"), viewer.getId())).toList();
    var orderIds = mine.stream().map(o -> o.get("id").toString()).toList();
    var regIds = mineRegs.stream().map(r -> r.get("id").toString()).toList();
    var receipts =
        rows(v, "payments").stream()
            .filter(
                p ->
                    p.get("orderId") != null && orderIds.contains(p.get("orderId").toString())
                        || p.get("registrationId") != null
                            && regIds.contains(p.get("registrationId").toString()))
            .toList();
    var receiptIds = receipts.stream().map(p -> p.get("id").toString()).toList();
    v.put("orders", mine);
    v.put("registrations", mineRegs);
    v.put("payments", receipts);
    v.put(
        "refunds",
        rows(v, "refunds").stream()
            .filter(r -> receiptIds.contains(r.get("paymentId").toString()))
            .toList());
    v.put(
        "accounts",
        List.of(
            map(
                "id",
                viewer.getId(),
                "name",
                viewer.getFullName(),
                "email",
                viewer.getEmail(),
                "phone",
                viewer.getPhone(),
                "role",
                viewer.getRole(),
                "status",
                viewer.getStatus())));
    v.put(
        "tournaments", tournaments.stream().filter(t -> !"DRAFT".equals(t.get("status"))).toList());
    for (String key : List.of("staff", "staffSchedules", "products", "matches", "audit"))
      v.put(key, List.of());
    return v;
  }

  private List<Map<String, Object>> refereeRates() {
    return staff.findAll().stream()
        .filter(s -> "REFEREE".equals(s.getType()) && "ACTIVE".equals(s.getStatus()))
        .map(s -> map("name", s.getFullName(), "level", s.getLevel(), "rate", s.getHourlyRate()))
        .toList();
  }

  private Map<String, Object> publicSettings() {
    var s = settings.get();
    return map("holdMinutes", s.getHoldMinutes(), "depositPercent", 50,
        "cancelRefundPercent", s.getCancelRefundPercent(), "policies", docs.decode(s.getPolicies()));
  }

  public void history(CustomerOrder o, String type, Map<String, Object> before) {
    var extra = docs.decode(o.getMetadata());
    var history =
        (List<Map<String, Object>>) extra.computeIfAbsent("history", k -> new ArrayList<>());
    var current = overview.order(o);
    var event =
        map(
            "id",
            UUID.randomUUID(),
            "type",
            type,
            "at",
            java.time.Instant.now(),
            "date",
            current.get("date"),
            "slots",
            current.get("slots"),
            "staff",
            current.get("staff"),
            "total",
            o.getTotalAmount(),
            "status",
            o.getStatus());
    if (before != null) event.put("previous", before);
    history.add(event);
    o.setMetadata(docs.encode(extra));
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/RequestService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import java.util.*;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RequestService {
  private final DocumentService documents;

  @Transactional
  public Map<String, Object> execute(
      UUID actor,
      String requestId,
      String operation,
      Object payload,
      Supplier<Map<String, Object>> fn) {
    documents.mutationLock();
    if (requestId == null || requestId.isBlank()) return fn.get();
    require(requestId.length() <= 100, "Mã yêu cầu không hợp lệ");
    String key = "request:" + actor + ":" + requestId,
        signature =
            AuthService.hash(documents.encode(map("operation", operation, "body", payload)));
    var old = documents.get(key);
    if (!old.isEmpty()) {
      require(signature.equals(old.get("signature")), "Mã yêu cầu đã dùng với nội dung khác");
      return (Map<String, Object>) old.get("result");
    }
    var result = fn.get();
    documents.put(key, map("signature", signature, "result", result));
    return result;
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/ScheduleService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScheduleService {
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;

  @Transactional
  public void generate(LocalDate date) {
    require(date != null, "Chọn ngày");
    String dayType = date.getDayOfWeek().getValue() >= 6 ? "WEEKEND" : "WEEKDAY";
    for (Court item :
        courts.findAll().stream().sorted(Comparator.comparing(Court::getId)).toList()) {
      var existing = schedules.findByCourtIdAndScheduleDate(item.getId(), date);
      if (existing.size() >= 34) continue;
      Court court = courts.findForUpdate(item.getId()).orElseThrow();
      var tariff = prices.findByCourtId(court.getId());
      for (int minute = 360; minute < 1380; minute += 30) {
        LocalTime start = LocalTime.of(minute / 60, minute % 60);
        if (existing.stream().anyMatch(x -> !start.isBefore(x.getStartTime()) && start.isBefore(x.getEndTime()))) continue;
        CourtSchedule schedule = new CourtSchedule();
        schedule.setCourt(court);
        schedule.setScheduleDate(date);
        schedule.setStartTime(start);
        schedule.setEndTime(start.plusMinutes(30));
        schedule.setPrice(
            tariff.stream()
                .filter(
                    p ->
                        p.getDayType().equals(dayType)
                            && !start.isBefore(p.getStartTime())
                            && start.isBefore(p.getEndTime()))
                .findFirst()
                .map(CourtPrice::getPricePerHour)
                .orElse(court.getBasePrice()).divide(java.math.BigDecimal.valueOf(2)));
        schedules.save(schedule);
      }
    }
  }

  public List<CourtSchedule> lockSlots(List<UUID> ids) {
    require(ids != null && !ids.isEmpty() && ids.size() <= 48, "Chọn ít nhất một khung giờ");
    require(new HashSet<>(ids).size() == ids.size(), "Khung giờ bị lặp");
    List<CourtSchedule> result =
        ids.stream()
            .sorted()
            .map(
                id ->
                    schedules
                        .findForUpdate(id)
                        .orElseThrow(() -> new BusinessException("Không tìm thấy khung giờ")))
            .toList();
    require(
        result.stream().map(CourtSchedule::getScheduleDate).distinct().count() == 1,
        "Các slot cần cùng ngày");
    return result;
  }

  public void requireAvailable(List<CourtSchedule> slots) {
    for (CourtSchedule slot : slots) {
      require("ACTIVE".equals(slot.getCourt().getStatus()), "Sân không hoạt động");
      require("AVAILABLE".equals(slot.getStatus()), "Khung giờ vừa được đặt hoặc đang thi đấu");
    }
  }

  public List<StaffSchedule> lockStaffSlots(UUID staffId, List<CourtSchedule> courtSlots) {
    Set<LocalTime> starts = new HashSet<>();
    courtSlots.forEach(x -> starts.add(x.getStartTime()));
    List<StaffSchedule> options =
        staffSchedules.findByStaffIdAndWorkDate(staffId, courtSlots.get(0).getScheduleDate());
    List<UUID> ids = new ArrayList<>();
    for (LocalTime start : starts) {
      var slot =
          options.stream()
              .filter(
                  x -> x.getStartTime().equals(start) && courtSlots.stream().anyMatch(c -> c.getStartTime().equals(start) && c.getEndTime().equals(x.getEndTime())))
              .findFirst()
              .orElseThrow(() -> new BusinessException("Nhân sự chưa có lịch làm việc phù hợp"));
      ids.add(slot.getId());
    }
    List<StaffSchedule> result =
        ids.stream().sorted().map(id -> staffSchedules.findForUpdate(id).orElseThrow()).toList();
    for (var slot : result) {
      require("REFEREE".equals(slot.getStaff().getType()), "Chỉ hỗ trợ dịch vụ trọng tài");
      require("ACTIVE".equals(slot.getStaff().getStatus()), "Nhân sự không hoạt động");
      require("AVAILABLE".equals(slot.getStatus()), "Nhân sự đã được phân công trong giờ này");
    }
    return result;
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/SettingsService.java`
```java
package com.courtly.service;

import com.courtly.dto.request.SettingsRequest;
import com.courtly.entity.ClubSettings;
import com.courtly.repository.ClubSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SettingsService {
  private final ClubSettingsRepository repository;
  private final DocumentService documents;

  @Transactional
  public ClubSettings get() {
    return repository.findAll().stream()
        .findFirst()
        .orElseGet(
            () -> {
              ClubSettings settings = new ClubSettings();
              settings.setHoldMinutes(5);
              settings.setDepositPercent(50);
              settings.setCancelRefundPercent(100);
              settings.setPolicies("{\"cancelCutoffMinutes\":1440,\"changeCutoffMinutes\":1440}");
              return repository.save(settings);
            });
  }

  @Transactional
  public void update(SettingsRequest request) {
    ClubSettings settings = get();
    settings.setHoldMinutes(request.holdMinutes());
    settings.setDepositPercent(request.depositPercent());
    settings.setCancelRefundPercent(request.cancelRefundPercent());
    if (request.policies() != null) {
      for (var key :
          java.util.List.of(
              "cancelCutoffMinutes",
              "changeCutoffMinutes",
              "checkInEarlyMinutes",
              "additionalPaymentMinutes")) {
        var n = request.policies().get(key);
        com.courtly.util.Rules.require(
            n == null
                || n instanceof Number
                    && ((Number) n).intValue() >= 0
                    && ((Number) n).intValue() <= 10080,
            "Chính sách thời gian không hợp lệ");
      }
      settings.setPolicies(documents.encode(request.policies()));
    }
    repository.save(settings);
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/TournamentService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TournamentService {
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TeamMemberRepository members;
  private final AccountRepository accounts;
  private final TournamentMatchRepository matches;
  private final MatchSlotRepository matchSlots;
  private final MatchStaffRepository matchStaff;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;
  private final ScheduleService scheduling;
  private final AuditService audit;

  @Transactional
  public UUID register(UUID id, RegistrationRequest request) {
    Tournament t =
        tournaments
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(
        "OPEN".equals(t.getStatus()) && !LocalDate.now(ZONE).isAfter(t.getRegistrationDeadline()),
        "Giải đã đóng đăng ký");
    var current = registrations.findByTournamentId(id);
    require(current.size() < t.getMaxParticipants(), "Giải đã đủ người");
    require(
        current.stream().noneMatch(x -> x.getAccount().getId().equals(request.accountId())),
        "Tài khoản đã đăng ký giải");
    Account account =
        accounts
            .findById(request.accountId())
            .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
    require("ACTIVE".equals(account.getStatus()), "Tài khoản đã khóa");
    List<String> extra = request.members() == null ? List.of() : request.members();
    require(!"SINGLES".equals(t.getFormat()) || extra.isEmpty(), "Giải đơn chỉ có một người");
    require(!"DOUBLES".equals(t.getFormat()) || extra.size() == 1, "Giải đôi cần một đồng đội");
    require(!"TEAM".equals(t.getFormat()) || !extra.isEmpty(), "Thêm thành viên cho đội");
    TournamentRegistration registration = new TournamentRegistration();
    registration.setTournament(t);
    registration.setAccount(account);
    registration.setTeamName(text(request.name(), "Tên thi đấu"));
    registration.setStatus(t.getRegistrationFee().signum() == 0 ? "CONFIRMED" : "PENDING");
    registrations.save(registration);
    TeamMember leader = new TeamMember();
    leader.setTournament(t);
    leader.setRegistration(registration);
    leader.setAccount(account);
    leader.setMemberName(account.getFullName());
    members.save(leader);
    for (String name : extra) {
      TeamMember member = new TeamMember();
      member.setTournament(t);
      member.setRegistration(registration);
      member.setMemberName(text(name, "Thành viên"));
      members.save(member);
    }
    audit.log("ĐĂNG KÝ GIẢI", registration.getId().toString());
    return registration.getId();
  }

  @Transactional
  public void draw(UUID id) {
    Tournament t =
        tournaments
            .findForUpdate(id)
            .orElseThrow(() -> new BusinessException("Giải không tồn tại"));
    require(!Set.of("FINISHED", "CANCELLED").contains(t.getStatus()), "Giải đã kết thúc");
    require(matches.findByTournamentId(id).isEmpty(), "Giải đã có nhánh đấu");
    List<TournamentRegistration> confirmed =
        new ArrayList<>(
            registrations.findByTournamentId(id).stream()
                .filter(x -> "CONFIRMED".equals(x.getStatus()))
                .toList());
    int count = confirmed.size();
    require(count >= 2 && (count & (count - 1)) == 0, "Cần 2, 4, 8, 16… đăng ký đã xác nhận");
    Collections.shuffle(confirmed);
    for (int round = 1, games = count / 2; games > 0; round++, games /= 2) {
      for (int i = 0; i < games; i++) {
        TournamentMatch match = new TournamentMatch();
        match.setTournament(t);
        match.setRoundNumber(round);
        match.setBracketIndex(i);
        match.setRoundName(games == 1 ? "Chung kết" : "Vòng " + round);
        if (round == 1) {
          match.setRegistration1(confirmed.get(i * 2));
          match.setRegistration2(confirmed.get(i * 2 + 1));
        }
        matches.save(match);
      }
    }
    t.setStatus("CLOSED");
    audit.log("BỐC THĂM", id.toString());
  }

  public void release(TournamentMatch match) {
    Instant releasedAt = Instant.now();
    for (MatchSlot link :
        matchSlots.findByMatchId(match.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      schedules.findForUpdate(link.getSchedule().getId()).orElseThrow().setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
    for (MatchStaff link :
        matchStaff.findByMatchId(match.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getStaffSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      staffSchedules
          .findForUpdate(link.getStaffSchedule().getId())
          .orElseThrow()
          .setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
  }

  private TournamentMatch lock(UUID id) {
    TournamentMatch candidate =
        matches.findById(id).orElseThrow(() -> new BusinessException("Trận không tồn tại"));
    // Serialize bracket updates on the tournament before locking a match.
    tournaments.findForUpdate(candidate.getTournament().getId()).orElseThrow();
    return matches.findForUpdate(id).orElseThrow();
  }

  @Transactional
  public void schedule(UUID id, MatchScheduleRequest request) {
    TournamentMatch match = lock(id);
    require("SCHEDULED".equals(match.getStatus()), "Trận đã kết thúc hoặc hủy");
    require(
        match.getRegistration1() != null && match.getRegistration2() != null,
        "Chờ kết quả vòng trước");
    require(
        "CONFIRMED".equals(match.getRegistration1().getStatus())
            && "CONFIRMED".equals(match.getRegistration2().getStatus()),
        "Hai bên phải được xác nhận");
    List<UUID> all = new ArrayList<>(request.scheduleIds());
    matchSlots.findByMatchId(id).stream()
        .filter(x -> x.getReleasedAt() == null)
        .forEach(x -> all.add(x.getSchedule().getId()));
    all.stream().distinct().sorted().forEach(x -> schedules.findForUpdate(x).orElseThrow());
    release(match);
    matchSlots.flush();
    matchStaff.flush();
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    require(
        selected.stream().map(x -> x.getCourt().getId()).distinct().count() == 1,
        "Một trận chỉ dùng một sân");
    List<CourtSchedule> chronological =
        selected.stream().sorted(Comparator.comparing(CourtSchedule::getStartTime)).toList();
    for (int i = 1; i < chronological.size(); i++)
      require(
          chronological.get(i - 1).getEndTime().equals(chronological.get(i).getStartTime()),
          "Slot của trận phải liên tiếp");
    LocalDate date = selected.get(0).getScheduleDate();
    require(
        !date.isBefore(match.getTournament().getStartDate())
            && !date.isAfter(match.getTournament().getEndDate()),
        "Ngày trận phải nằm trong thời gian giải");
    for (CourtSchedule slot : selected) {
      slot.setStatus("IN_MATCH");
      MatchSlot link = new MatchSlot();
      link.setMatch(match);
      link.setSchedule(slot);
      matchSlots.save(link);
    }
    if (request.staffId() != null) {
      var staff = scheduling.lockStaffSlots(request.staffId(), selected);
      for (StaffSchedule slot : staff) {
        require("REFEREE".equals(slot.getStaff().getType()), "Chọn nhân sự trọng tài");
        slot.setStatus("IN_MATCH");
        MatchStaff link = new MatchStaff();
        link.setMatch(match);
        link.setStaffSchedule(slot);
        matchStaff.save(link);
      }
    }
    audit.log("XẾP TRẬN", id.toString());
  }

  @Transactional
  public void result(UUID id, MatchResultRequest request) {
    TournamentMatch match = lock(id);
    require("SCHEDULED".equals(match.getStatus()), "Trận đã ghi kết quả hoặc hủy");
    require(
        match.getRegistration1() != null && match.getRegistration2() != null,
        "Chưa đủ người thi đấu");
    require(
        matchSlots.findByMatchId(id).stream().anyMatch(x -> x.getReleasedAt() == null),
        "Xếp sân trước khi ghi kết quả");
    require(
        Set.of(match.getRegistration1().getId(), match.getRegistration2().getId())
            .contains(request.winnerId()),
        "Đội thắng phải thuộc trận");
    match.setWinnerRegistration(
        request.winnerId().equals(match.getRegistration1().getId())
            ? match.getRegistration1()
            : match.getRegistration2());
    match.setScore(text(request.score(), "Tỉ số"));
    match.setStatus("FINISHED");
    release(match);
    var next =
        matches.findByTournamentId(match.getTournament().getId()).stream()
            .filter(
                x ->
                    x.getRoundNumber() == match.getRoundNumber() + 1
                        && x.getBracketIndex() == match.getBracketIndex() / 2)
            .findFirst();
    if (next.isPresent()) {
      if (match.getBracketIndex() % 2 == 0)
        next.get().setRegistration1(match.getWinnerRegistration());
      else next.get().setRegistration2(match.getWinnerRegistration());
    } else match.getTournament().setStatus("FINISHED");
    audit.log("KẾT QUẢ TRẬN", id.toString());
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/TransferService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.PaymentRequest;
import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Bank notifications are separate from a customer's declaration of transfer. */
@Service
@RequiredArgsConstructor
@Transactional
public class TransferService {
  private final DocumentService docs;
  private final CustomerOrderRepository orders;
  private final TournamentRegistrationRepository registrations;
  private final AccountRepository accounts;
  private final PaymentService payments;
  private final OrderService booking;
  private final MembershipService memberships;

  @Value("${courtly.payment.mode:DEMO}")
  private String mode;

  @Value("${courtly.payment.bank-bin:970422}")
  private String bankBin;

  @Value("${courtly.payment.account-number:0345678999}")
  private String accountNumber;

  @Value("${courtly.payment.account-name:CLB TENNIS COURTLY}")
  private String accountName;

  @Value("${courtly.payment.webhook-key:}")
  private String webhookKey;

  @Value("${courtly.admin-email:admin@gmail.com}")
  private String adminEmail;

  public String getMode() {
    return mode != null && !mode.isBlank() ? mode : "DEMO";
  }

  public String getBankBin() {
    return bankBin != null && bankBin.matches("\\d{6}") ? bankBin : "";
  }

  public String getAccountNumber() {
    return accountNumber != null && !accountNumber.isBlank() ? accountNumber : "";
  }

  public String getAccountName() {
    return accountName != null && !accountName.isBlank() ? accountName : "";
  }

  public Map<String, Object> config() {
    boolean bankConfigured = getBankBin().matches("\\d{6}") && getAccountNumber().matches("\\d{6,30}") && !getAccountName().isBlank();
    boolean onlineEnabled = ("LIVE".equals(getMode()) && webhookKey != null && !webhookKey.isBlank())
        || ("DEMO".equals(getMode()) && bankConfigured);
    return map(
        "mode", getMode(),
        "onlineEnabled", onlineEnabled,
        "bankConfigured", bankConfigured,
        "bankBin", getBankBin(),
        "bankName", "970422".equals(getBankBin()) ? "MB Bank" : getBankBin(),
        "accountNumber", getAccountNumber(),
        "accountName", getAccountName());
  }

  private BigDecimal amount(Object n) {
    var v = PresentationService.decimal(n);
    require(v.signum() > 0 && v.stripTrailingZeros().scale() <= 0, "Số tiền phải là số nguyên VND dương");
    return v;
  }

  private void own(Account a, Object owner) {
    if (owner == null || !a.getId().toString().equals(owner.toString()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Giao dịch không thuộc tài khoản của bạn");
  }

  public List<Map<String, Object>> mine(Account a) {
    return docs.list("transfer:").stream()
        .filter(x -> a.getId().toString().equals(x.get("accountId")))
        .map(this::view)
        .toList();
  }

  public List<Map<String, Object>> all() {
    return docs.list("transfer:").stream().map(this::view).toList();
  }

  private Map<String, Object> view(Map<String, Object> x) {
    var v = new LinkedHashMap<>(x);
    if (Set.of("PENDING", "CHECKING").contains(x.get("status"))
        && Instant.parse((String) x.get("expiresAt")).isBefore(Instant.now()))
      v.put("status", "EXPIRED");
    return v;
  }

  public Map<String, Object> create(Account a, Map<String, Object> b) {
    docs.mutationLock();
    booking.expireHolds();
    require("DEMO".equals(getMode()) || "LIVE".equals(getMode()) || "SANDBOX".equals(getMode()) && "ADMIN".equals(a.getRole()), "Chuyển khoản hiện chưa khả dụng; vui lòng thanh toán tại quầy");
    require(Boolean.TRUE.equals(config().get("bankConfigured")), "Chưa cấu hình tài khoản nhận chuyển khoản; vui lòng thanh toán tại quầy");
    require(!"LIVE".equals(getMode()) || !webhookKey.isBlank(), "Chưa cấu hình xác minh ngân hàng; vui lòng thanh toán tại quầy");
    String type = oneOf((String) b.get("type"), "ORDER", "TOURNAMENT", "MEMBERSHIP"),
        target = text((String) b.get("targetId"), "Mã đơn");
    String purpose = "BALANCE".equals(b.get("purpose")) ? "BALANCE" : "DEPOSIT";
    BigDecimal due;
    Instant expires = Instant.now().plusSeconds(900);
    if (type.equals("ORDER")) {
      var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
      own(a, o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId());
      require(
          Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus()),
          "Đơn không nhận thanh toán mới");
      due =
          (purpose.equals("DEPOSIT") ? o.getDepositRequired() : o.getTotalAmount())
              .subtract(o.getPaidAmount());
      if (due.signum() <= 0) due = o.getTotalAmount().subtract(o.getPaidAmount());
      if (o.getStatus().equals("HOLDING")) expires = o.getHoldExpiresAt();
    } else if (type.equals("TOURNAMENT")) {
      var r = registrations.findForUpdate(UUID.fromString(target)).orElseThrow();
      own(a, r.getAccount().getId());
      require(
          !"CANCELLED".equals(r.getStatus()) && !"CANCELLED".equals(r.getTournament().getStatus()),
          "Đăng ký đã hủy");
      due = r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId()));
    } else {
      var m = docs.get("membership:" + target);
      own(a, m.get("accountId"));
      require("PENDING".equals(m.get("status")), "Gói đã được xử lý");
      due = amount(m.get("price")).subtract(membershipReceived(target));
    }
    require(due.signum() > 0, "Không còn khoản cần thanh toán");
    for (var old : mine(a))
      if (type.equals(old.get("type"))
          && target.equals(old.get("targetId"))
          && Set.of("PENDING", "CHECKING").contains(old.get("status"))
          && due.compareTo(PresentationService.decimal(old.get("remaining"))) == 0)
        return old;

    String id = UUID.randomUUID().toString(),
        reference = "CT" + id.replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
    var intent =
        map(
            "id", id,
            "accountId", a.getId().toString(),
            "type", type,
            "targetId", target,
            "amount", due,
            "remaining", due,
            "received", 0,
            "reviewAmount", 0,
            "reference", reference,
            "status", "PENDING",
            "mode", getMode(),
            "createdAt", Instant.now().toString(),
            "expiresAt", expires.toString());
    intent.putAll(config());

    String qr = vietQr(reference, due);
    String qrImg =
        "https://img.vietqr.io/image/"
            + getBankBin()
            + "-"
            + getAccountNumber()
            + "-compact2.png?amount="
            + due.setScale(0, RoundingMode.HALF_UP).toPlainString()
            + "&addInfo="
            + reference
            + "&accountName="
            + java.net.URLEncoder.encode(getAccountName(), StandardCharsets.UTF_8);

    intent.put("qrPayload", qr);
    intent.put("qrImageUrl", qrImg);
    docs.put("transfer:" + id, intent);
    return intent;
  }

  public Map<String, Object> declared(Account a, String id) {
    docs.mutationLock();
    var x = docs.get("transfer:" + id);
    require(!x.isEmpty(), "Giao dịch không tồn tại");
    own(a, x.get("accountId"));
    if ("PENDING".equals(view(x).get("status"))) {
      x.put("status", "CHECKING");
      docs.put("transfer:" + id, x);
    }
    return view(x);
  }

  public Map<String, Object> confirm(Account a, String id) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
        "Khách hàng không được xác nhận tiền đã thu; chờ xác minh từ ngân hàng");
  }

  public Map<String, Object> adminConfirm(String id) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
        "Chuyển khoản được xác minh qua webhook; thu tiền mặt qua phiếu thu tại quầy");
  }

  public Map<String, Object> sandbox(Account a, String id, Map<String, Object> b) {
    if (!"DEMO".equals(getMode()) && (!"ADMIN".equals(a.getRole()) || !"SANDBOX".equals(getMode())))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Mô phỏng chỉ dành cho môi trường thử nghiệm");
    docs.mutationLock();
    var x = docs.get("transfer:" + id);
    require(!x.isEmpty(), "Giao dịch không tồn tại");
    if (!"ADMIN".equals(a.getRole()) && !"STAFF".equals(a.getRole())) {
      own(a, x.get("accountId"));
    }
    String scenario = oneOf((String) b.get("scenario"), "SUCCESS", "PARTIAL", "DUPLICATE", "LATE");
    String event = "sandbox:" + id + ":" + scenario;
    if (!docs.get("bank-event:" + event).isEmpty()) return docs.get("transfer:" + id);
    if (scenario.equals("LATE")) {
      require("ORDER".equals(x.get("type")), "Kịch bản hết hạn áp dụng đơn sân");
      var o = orders.findForUpdate(UUID.fromString((String) x.get("targetId"))).orElseThrow();
      require("HOLDING".equals(o.getStatus()), "Chỉ mô phỏng hết hạn đơn đang giữ");
      o.setHoldExpiresAt(Instant.now().minusSeconds(1));
      orders.flush();
      booking.expireHolds();
      x.put("expiresAt", Instant.now().minusSeconds(1).toString());
      docs.put("transfer:" + id, x);
    }
    var due = PresentationService.decimal(x.get("remaining"));
    require(due.signum() > 0, "Giao dịch đã thu đủ");
    if (scenario.equals("PARTIAL"))
      due = due.divide(BigDecimal.valueOf(2), 0, RoundingMode.DOWN).max(BigDecimal.ONE);
    receive(event, (String) x.get("reference"), due, "SANDBOX");
    if (scenario.equals("DUPLICATE"))
      receive(event, (String) x.get("reference"), due, "SANDBOX");
    return view(docs.get("transfer:" + id));
  }

  public Map<String, Object> webhook(String authorization, Map<String, Object> b) {
    if (!"LIVE".equals(getMode()) || webhookKey.isBlank())
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook thanh toán chưa được cấu hình");
    if (authorization == null || !MessageDigest.isEqual(
        ("Apikey " + webhookKey).getBytes(StandardCharsets.UTF_8),
        authorization.getBytes(StandardCharsets.UTF_8)))
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook key");
    require(Boolean.TRUE.equals(config().get("bankConfigured")), "Chưa cấu hình tài khoản nhận tiền");
    require(getAccountNumber().equals(String.valueOf(b.get("accountNumber"))), "Sai tài khoản nhận tiền");
    if (!"in".equals(b.get("transferType"))) return map("success", true, "ignored", true);
    String providerId = String.valueOf(b.getOrDefault("id", ""));
    require(providerId.matches("[0-9]{1,30}"), "Mã giao dịch ngân hàng không hợp lệ");
    String event = "sepay:" + providerId;
    var matcher =
        java.util.regex.Pattern.compile("(?<![A-Z0-9])CT[A-F0-9]{16}(?![A-Z0-9])")
            .matcher(String.valueOf(b.get("content")).toUpperCase(Locale.ROOT));
    String ref = matcher.find() ? matcher.group() : "UNMATCHED";
    receive(event, ref, amount(b.get("transferAmount")), "LIVE");
    return map("success", true);
  }

  private void receive(String event, String reference, BigDecimal received, String source) {
    docs.mutationLock();
    var prior = docs.get("bank-event:" + event);
    if (!prior.isEmpty()) {
      require(
          reference.equals(prior.get("reference"))
              && received.compareTo(PresentationService.decimal(prior.get("amount"))) == 0,
          "Mã giao dịch lặp với nội dung khác");
      return;
    }
    var x =
        docs.list("transfer:").stream()
            .filter(i -> reference.equals(i.get("reference")))
            .findFirst()
            .orElse(null);
    var record =
        map(
            "id", event,
            "reference", reference,
            "amount", received,
            "receivedAt", Instant.now().toString(),
            "status", "REVIEW",
            "source", source);
    if (x == null) {
      docs.put("bank-event:" + event, record);
      return;
    }
    booking.expireHolds();
    boolean valid =
        Instant.parse((String) x.get("expiresAt")).isAfter(Instant.now())
            && Set.of("PENDING", "CHECKING").contains(x.get("status"));
    BigDecimal due = PresentationService.decimal(x.get("remaining"));
    String type = (String) x.get("type"), target = (String) x.get("targetId");
    if (type.equals("ORDER")) {
      var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
      valid &= Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus());
      due = due.min(o.getTotalAmount().subtract(o.getPaidAmount()));
    }
    if (type.equals("TOURNAMENT")) {
      var r = registrations.findForUpdate(UUID.fromString(target)).orElseThrow();
      valid &=
          !"CANCELLED".equals(r.getStatus())
              && !"CANCELLED".equals(r.getTournament().getStatus());
      due =
          due.min(
              r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId())));
    }
    if (type.equals("MEMBERSHIP")) {
      var m = docs.get("membership:" + target);
      valid &= "PENDING".equals(m.get("status"));
      due =
          due.min(
              PresentationService.decimal(m.get("price")).subtract(membershipReceived(target)));
    }
    valid &= received.compareTo(due) <= 0 && due.signum() > 0;
    if (valid) {
      if (type.equals("MEMBERSHIP")) {
        var total = membershipReceived(target).add(received);
        if (total.compareTo(
                PresentationService.decimal(docs.get("membership:" + target).get("price")))
            == 0) {
          var admin = accounts.findByEmailIgnoreCase(adminEmail).orElseThrow();
          memberships.action(
              admin,
              "POST",
              "/api/membership/requests/" + target + "/activate",
              map(
                  "collected", true,
                  "amount", total,
                  "method", "BANK_TRANSFER",
                  "transactionCode", event,
                  "requestId", event));
        }
      } else {
        payments.collect(
            new PaymentRequest(
                type.equals("ORDER") ? UUID.fromString(target) : null,
                type.equals("TOURNAMENT") ? UUID.fromString(target) : null,
                received,
                "BANK_TRANSFER",
                event));
      }
      x.put("received", PresentationService.decimal(x.get("received")).add(received));
      x.put("remaining", PresentationService.decimal(x.get("remaining")).subtract(received));
      x.put(
          "status",
          PresentationService.decimal(x.get("remaining")).signum() == 0
              ? "CONFIRMED"
              : "CHECKING");
      record.put("status", "APPLIED");
    } else {
      x.put("reviewAmount", PresentationService.decimal(x.get("reviewAmount")).add(received));
      x.put("status", "REVIEW");
      if (type.equals("ORDER")) {
        var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
        var meta = docs.decode(o.getMetadata());
        meta.put("financialReview", "MANUAL_REVIEW");
        meta.put(
            "transferReviewAmount",
            PresentationService.decimal(meta.get("transferReviewAmount")).add(received));
        o.setMetadata(docs.encode(meta));
      }
    }
    record.put("intentId", x.get("id"));
    docs.put("bank-event:" + event, record);
    docs.put("transfer:" + x.get("id"), x);
  }

  private BigDecimal membershipReceived(String target) {
    return docs.list("transfer:").stream()
        .filter(x -> "MEMBERSHIP".equals(x.get("type")) && target.equals(x.get("targetId")))
        .map(x -> PresentationService.decimal(x.get("received")))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private static String tlv(String id, String s) {
    return id + String.format(Locale.ROOT, "%02d", s.length()) + s;
  }

  private String vietQr(String reference, BigDecimal amount) {
    String merchant =
        tlv("00", "A000000727")
            + tlv("01", tlv("00", getBankBin()) + tlv("01", getAccountNumber()))
            + tlv("02", "QRIBFTTA");
    String payload =
        tlv("00", "01")
            + tlv("01", "12")
            + tlv("38", merchant)
            + tlv("53", "704")
            + tlv("54", amount.setScale(0, RoundingMode.HALF_UP).toPlainString())
            + tlv("58", "VN")
            + tlv("62", tlv("08", reference))
            + "6304";
    int crc = 0xffff;
    for (byte v : payload.getBytes(StandardCharsets.UTF_8)) {
      crc ^= (v & 255) << 8;
      for (int i = 0; i < 8; i++) {
        crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      }
      crc &= 0xffff;
    }
    return payload + String.format(Locale.ROOT, "%04X", crc);
  }
}
```

#### File: `backend/src/main/java/com/courtly/service/VoucherService.java`
```java
package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VoucherService {

  private final VoucherRepository vouchers;
  private final VoucherRedemptionRepository redemptions;
  private final CustomerOrderRepository orders;
  private final MembershipService memberships;

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAvailable() {
    Instant now = Instant.now();
    return vouchers.findByEnabledTrue().stream()
        .filter(v -> v.getStartsAt() == null || !v.getStartsAt().isAfter(now))
        .filter(v -> v.getExpiresAt() == null || !v.getExpiresAt().isBefore(now))
        .filter(v -> v.getUsageLimit() == null || v.getUsedCount() < v.getUsageLimit())
        .map(
            v ->
                map(
                    "code", v.getCode(),
                    "type", v.getType(),
                    "value", v.getValue(),
                    "minOrder", v.getMinOrder(),
                    "maxDiscount", v.getMaxDiscount(),
                    "memberOnly", v.getMemberOnly(),
                    "newUserOnly", v.getNewUserOnly(),
                    "description", v.getDescription()))
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount) {
    return calculate(rawCode, totalAmount, null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount, UUID accountId) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v =
        vouchers
            .findByCodeIgnoreCase(code)
            .orElseThrow(
                () ->
                    new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    validateVoucherRules(v, totalAmount, accountId);
    BigDecimal discount = computeDiscount(v, totalAmount);

    return map(
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "applied", true);
  }

  @Transactional
  public Map<String, Object> redeem(String rawCode, CustomerOrder order, BigDecimal totalAmount, UUID accountId) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    // Pessimistic write lock to prevent race conditions on usage limits
    Voucher v =
        vouchers
            .findByCodeForUpdate(code)
            .orElseThrow(
                () ->
                    new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    validateVoucherRules(v, totalAmount, accountId);
    BigDecimal discount = computeDiscount(v, totalAmount);

    v.setUsedCount(v.getUsedCount() + 1);
    vouchers.save(v);

    VoucherRedemption redemption = new VoucherRedemption();
    redemption.setVoucher(v);
    redemption.setOrder(order);
    if (order.getCustomerAccount() != null) {
      redemption.setAccount(order.getCustomerAccount());
    }
    redemption.setDiscountAmount(discount);
    redemption.setRedeemedAt(Instant.now());
    redemptions.save(redemption);

    return map(
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "applied", true);
  }

  @Transactional
  public void release(UUID orderId) {
    if (orderId == null) return;
    redemptions.findByOrderId(orderId).ifPresent(redemption -> {
      vouchers.findByCodeForUpdate(redemption.getVoucher().getCode()).ifPresent(v -> {
        if (v.getUsedCount() > 0) {
          v.setUsedCount(v.getUsedCount() - 1);
          vouchers.save(v);
        }
      });
      redemptions.delete(redemption);
    });
  }

  private void validateVoucherRules(Voucher v, BigDecimal totalAmount, UUID accountId) {
    if (!Boolean.TRUE.equals(v.getEnabled())) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' hiện đang tạm khóa");
    }

    Instant now = Instant.now();
    if (v.getStartsAt() != null && v.getStartsAt().isAfter(now)) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' chưa đến thời gian áp dụng");
    }
    if (v.getExpiresAt() != null && v.getExpiresAt().isBefore(now)) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' đã hết hạn");
    }

    if (v.getUsageLimit() != null && v.getUsedCount() >= v.getUsageLimit()) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' đã hết lượt sử dụng");
    }

    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    if (v.getMinOrder() != null && total.compareTo(v.getMinOrder()) < 0) {
      throw new BusinessException(
          "Đơn đặt sân tối thiểu "
              + v.getMinOrder().setScale(0, RoundingMode.HALF_UP)
              + " đ để áp dụng voucher "
              + v.getCode());
    }

    if (accountId != null) {
      if (Boolean.TRUE.equals(v.getNewUserOnly())) {
        long pastOrders = orders.countByCustomerAccountIdAndStatusNotIn(accountId, Set.of("CANCELLED", "EXPIRED"));
        if (pastOrders > 0) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho khách hàng mới đặt sân lần đầu");
        }
      }

      if (Boolean.TRUE.equals(v.getMemberOnly())) {
        boolean activeMember = memberships.hasActiveMembership(accountId);
        if (!activeMember) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho hội viên có gói active");
        }
      }

      if (v.getPerUserLimit() != null) {
        long userUsed = redemptions.countByVoucherIdAndAccountId(v.getId(), accountId);
        if (userUsed >= v.getPerUserLimit()) {
          throw new BusinessException(
              "Bạn đã dùng hết số lần cho phép của voucher "
                  + v.getCode()
                  + " (tối đa "
                  + v.getPerUserLimit()
                  + " lần/tài khoản)");
        }
      }
    }
  }

  private BigDecimal computeDiscount(Voucher v, BigDecimal totalAmount) {
    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    BigDecimal discount;
    if ("PERCENT".equals(v.getType())) {
      discount =
          total
              .multiply(v.getValue())
              .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
      if (v.getMaxDiscount() != null && discount.compareTo(v.getMaxDiscount()) > 0) {
        discount = v.getMaxDiscount();
      }
    } else {
      discount = v.getValue();
    }

    if (discount.compareTo(total) > 0) {
      discount = total;
    }
    return discount;
  }
}
```

### 6.3 Entities & JPA Models

#### File: `backend/src/main/java/com/courtly/entity/Account.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account extends BaseEntity {
  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column(name = "email", nullable = false)
  private String email;

  @Column(name = "phone", nullable = false)
  private String phone;

  @Column(name = "password_hash", nullable = true)
  private String passwordHash;

  @Column(name = "role", nullable = false)
  private String role = "CUSTOMER";

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(nullable = false)
  private Integer authVersion = 0;
}
```

#### File: `backend/src/main/java/com/courtly/entity/AppDocument.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "app_documents")
@Getter
@Setter
@NoArgsConstructor
public class AppDocument {
  @Id
  @Column(name = "document_key", length = 255)
  private String key;

  @Column(nullable = false, columnDefinition = "text")
  private String data = "{}";

  @Version private Long version;

  public AppDocument(String key) {
    this.key = key;
  }
}
```

#### File: `backend/src/main/java/com/courtly/entity/AuditLog.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog extends BaseEntity {
  @Column(name = "actor", nullable = false)
  private String actor;

  @Column(name = "action", nullable = false)
  private String action;

  @Column(name = "detail", nullable = false, columnDefinition = "text")
  private String detail;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
}
```

#### File: `backend/src/main/java/com/courtly/entity/BaseEntity.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;
}
```

#### File: `backend/src/main/java/com/courtly/entity/Booking.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
public class Booking extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = false)
  private CustomerOrder order;

  @Column(name = "status", nullable = false)
  private String status = "PENDING";

  @Column(name = "check_in_at", nullable = true)
  private Instant checkInAt;

  @Column(name = "check_out_at", nullable = true)
  private Instant checkOutAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
}
```

#### File: `backend/src/main/java/com/courtly/entity/BookingSlot.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "booking_slots")
@Getter
@Setter
@NoArgsConstructor
public class BookingSlot extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "booking_id", nullable = false)
  private Booking booking;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "schedule_id", nullable = false)
  private CourtSchedule schedule;

  @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(name = "released_at", nullable = true)
  private Instant releasedAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/BookingStaff.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "booking_staff")
@Getter
@Setter
@NoArgsConstructor
public class BookingStaff extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "booking_id", nullable = false)
  private Booking booking;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "staff_schedule_id", nullable = false)
  private StaffSchedule staffSchedule;

  @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(name = "released_at", nullable = true)
  private Instant releasedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "court_schedule_id")
  private CourtSchedule courtSchedule;
}
```

#### File: `backend/src/main/java/com/courtly/entity/ClubSettings.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "club_settings")
@Getter
@Setter
@NoArgsConstructor
public class ClubSettings extends BaseEntity {
  @Column(name = "hold_minutes", nullable = false)
  private Integer holdMinutes = 0;

  @Column(name = "deposit_percent", nullable = false)
  private Integer depositPercent = 0;

  @Column(name = "cancel_refund_percent", nullable = false)
  private Integer cancelRefundPercent = 0;

  @Column(nullable = false, columnDefinition = "text")
  private String policies = "{}";
}
```

#### File: `backend/src/main/java/com/courtly/entity/Court.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "courts")
@Getter
@Setter
@NoArgsConstructor
public class Court extends BaseEntity {
  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "type", nullable = false)
  private String type = "HARD";

  @Column(name = "description", nullable = true, columnDefinition = "text")
  private String description;

  @Column(name = "image_url", nullable = true)
  private String imageUrl;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Column(name = "base_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal basePrice = BigDecimal.ZERO;

  @Column(columnDefinition = "text")
  private String address = "";

  @Column(columnDefinition = "text")
  private String amenities = "";

  @Column(nullable = false)
  private boolean imageIsIllustration = true;
}
```

#### File: `backend/src/main/java/com/courtly/entity/CourtPrice.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "court_prices")
@Getter
@Setter
@NoArgsConstructor
public class CourtPrice extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "court_id", nullable = false)
  private Court court;

  @Column(name = "day_type", nullable = false)
  private String dayType;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "price_per_hour", nullable = false, precision = 14, scale = 2)
  private BigDecimal pricePerHour = BigDecimal.ZERO;
}
```

#### File: `backend/src/main/java/com/courtly/entity/CourtSchedule.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "court_schedules")
@Getter
@Setter
@NoArgsConstructor
public class CourtSchedule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "court_id", nullable = false)
  private Court court;

  @Column(name = "schedule_date", nullable = false)
  private LocalDate scheduleDate;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "price", nullable = false, precision = 14, scale = 2)
  private BigDecimal price = BigDecimal.ZERO;

  @Column(name = "status", nullable = false)
  private String status = "AVAILABLE";

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;
}
```

#### File: `backend/src/main/java/com/courtly/entity/CustomerOrder.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
public class CustomerOrder extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_account_id", nullable = true)
  private Account customerAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by_account_id", nullable = true)
  private Account createdByAccount;

  @Column(name = "customer_name", nullable = false)
  private String customerName;

  @Column(name = "customer_phone", nullable = false)
  private String customerPhone;

  @Column(name = "status", nullable = false)
  private String status = "HOLDING";

  @Column(name = "hold_expires_at", nullable = true)
  private Instant holdExpiresAt;

  @Column(name = "subtotal", nullable = false, precision = 14, scale = 2)
  private BigDecimal subtotal = BigDecimal.ZERO;

  @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal totalAmount = BigDecimal.ZERO;

  @Column(name = "deposit_required", nullable = false, precision = 14, scale = 2)
  private BigDecimal depositRequired = BigDecimal.ZERO;

  @Column(name = "paid_amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal paidAmount = BigDecimal.ZERO;

  @Column(name = "payment_status", nullable = false)
  private String paymentStatus = "UNPAID";

  @Column(name = "invoice_number", nullable = true)
  private String invoiceNumber;

  @Column(name = "issued_at", nullable = true)
  private Instant issuedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;

  @Column(nullable = false, columnDefinition = "text")
  private String metadata = "{}";
}
```

#### File: `backend/src/main/java/com/courtly/entity/Drink.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "drinks")
@Getter
@Setter
@NoArgsConstructor
public class Drink extends BaseEntity {
  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "unit", nullable = false)
  private String unit = "BOTTLE";

  @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(name = "stock_quantity", nullable = false)
  private Integer stockQuantity = 0;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";
}
```

#### File: `backend/src/main/java/com/courtly/entity/MatchSlot.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "match_slots")
@Getter
@Setter
@NoArgsConstructor
public class MatchSlot extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "match_id", nullable = false)
  private TournamentMatch match;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "schedule_id", nullable = false)
  private CourtSchedule schedule;

  @Column(name = "released_at", nullable = true)
  private Instant releasedAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/MatchStaff.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "match_staff")
@Getter
@Setter
@NoArgsConstructor
public class MatchStaff extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "match_id", nullable = false)
  private TournamentMatch match;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "staff_schedule_id", nullable = false)
  private StaffSchedule staffSchedule;

  @Column(name = "role", nullable = false)
  private String role = "REFEREE";

  @Column(name = "released_at", nullable = true)
  private Instant releasedAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/OrderProduct.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_products")
@Getter
@Setter
@NoArgsConstructor
public class OrderProduct extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = false)
  private CustomerOrder order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "booking_id", nullable = false)
  private Booking booking;

  @Column(name = "item_type", nullable = false)
  private String itemType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "drink_id", nullable = true)
  private Drink drink;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "rental_item_id", nullable = true)
  private RentalItem rentalItem;

  @Column(name = "quantity", nullable = false)
  private Integer quantity = 0;

  @Column(name = "rent_start_at", nullable = true)
  private Instant rentStartAt;

  @Column(name = "rent_end_at", nullable = true)
  private Instant rentEndAt;

  @Column(name = "returned_at", nullable = true)
  private Instant returnedAt;

  @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(name = "item_condition")
  private String condition;

  private Instant issuedAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/Payment.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = true)
  private CustomerOrder order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration_id", nullable = true)
  private TournamentRegistration registration;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "received_by_account_id", nullable = true)
  private Account receivedByAccount;

  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "method", nullable = false)
  private String method;

  @Column(name = "amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(name = "transaction_code", nullable = false)
  private String transactionCode;

  @Column(name = "qr_content", nullable = true, columnDefinition = "text")
  private String qrContent;

  @Column(name = "qr_expires_at", nullable = true)
  private Instant qrExpiresAt;

  @Column(name = "status", nullable = false)
  private String status = "PAID";

  @Column(name = "paid_at", nullable = false)
  private Instant paidAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/Refund.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refunds")
@Getter
@Setter
@NoArgsConstructor
public class Refund extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "payment_id", nullable = false)
  private Payment payment;

  @Column(name = "amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(name = "reason", nullable = false)
  private String reason;

  @Column(name = "status", nullable = false)
  private String status = "DONE";

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "processed_by_account_id", nullable = true)
  private Account processedByAccount;

  @Column(name = "refunded_at", nullable = false)
  private Instant refundedAt;
}
```

#### File: `backend/src/main/java/com/courtly/entity/RentalItem.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "rental_items")
@Getter
@Setter
@NoArgsConstructor
public class RentalItem extends BaseEntity {
  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "category", nullable = false)
  private String category = "RACKET";

  @Column(name = "brand", nullable = true)
  private String brand;

  @Column(name = "price_per_hour", nullable = false, precision = 14, scale = 2)
  private BigDecimal pricePerHour = BigDecimal.ZERO;

  @Column(name = "stock_quantity", nullable = false)
  private Integer stockQuantity = 0;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;
}
```

#### File: `backend/src/main/java/com/courtly/entity/Staff.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "staff")
@Getter
@Setter
@NoArgsConstructor
public class Staff extends BaseEntity {
  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column(name = "phone", nullable = false)
  private String phone;

  @Column(name = "type", nullable = false)
  private String type = "REFEREE";

  @Column(name = "level", nullable = true)
  private String level;

  @Column(name = "hourly_rate", nullable = false, precision = 14, scale = 2)
  private BigDecimal hourlyRate = BigDecimal.ZERO;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";
}
```

#### File: `backend/src/main/java/com/courtly/entity/StaffSchedule.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "staff_schedules")
@Getter
@Setter
@NoArgsConstructor
public class StaffSchedule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "staff_id", nullable = false)
  private Staff staff;

  @Column(name = "work_date", nullable = false)
  private LocalDate workDate;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "status", nullable = false)
  private String status = "AVAILABLE";

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;
}
```

#### File: `backend/src/main/java/com/courtly/entity/TeamMember.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "team_members")
@Getter
@Setter
@NoArgsConstructor
public class TeamMember extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration_id", nullable = false)
  private TournamentRegistration registration;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id", nullable = true)
  private Account account;

  @Column(name = "member_name", nullable = true)
  private String memberName;

  @Column(name = "phone", nullable = true)
  private String phone;
}
```

#### File: `backend/src/main/java/com/courtly/entity/Tournament.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tournaments")
@Getter
@Setter
@NoArgsConstructor
public class Tournament extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "organizer_account_id", nullable = true)
  private Account organizerAccount;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "format", nullable = false)
  private String format = "DOUBLES";

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(name = "location", nullable = false)
  private String location;

  @Column(name = "registration_fee", nullable = false, precision = 14, scale = 2)
  private BigDecimal registrationFee = BigDecimal.ZERO;

  @Column(name = "registration_deadline", nullable = false)
  private LocalDate registrationDeadline;

  @Column(name = "max_participants", nullable = false)
  private Integer maxParticipants = 0;

  @Column(name = "status", nullable = false)
  private String status = "OPEN";
}
```

#### File: `backend/src/main/java/com/courtly/entity/TournamentMatch.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
public class TournamentMatch extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration1_id", nullable = true)
  private TournamentRegistration registration1;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration2_id", nullable = true)
  private TournamentRegistration registration2;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "winner_registration_id", nullable = true)
  private TournamentRegistration winnerRegistration;

  @Column(name = "round_number", nullable = false)
  private Integer roundNumber = 0;

  @Column(name = "bracket_index", nullable = false)
  private Integer bracketIndex = 0;

  @Column(name = "round_name", nullable = false)
  private String roundName;

  @Column(name = "score", nullable = true)
  private String score;

  @Column(name = "status", nullable = false)
  private String status = "SCHEDULED";

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by_account_id", nullable = true)
  private Account updatedByAccount;
}
```

#### File: `backend/src/main/java/com/courtly/entity/TournamentRegistration.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tournament_registrations")
@Getter
@Setter
@NoArgsConstructor
public class TournamentRegistration extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id", nullable = false)
  private Account account;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registered_by_account_id", nullable = true)
  private Account registeredByAccount;

  @Column(name = "team_name", nullable = false)
  private String teamName;

  @Column(name = "skill_level", nullable = true)
  private String skillLevel;

  @Column(name = "status", nullable = false)
  private String status = "PENDING";

  @Column(name = "registered_at", nullable = false)
  private Instant registeredAt = Instant.now();
}
```

#### File: `backend/src/main/java/com/courtly/entity/Voucher.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
public class Voucher extends BaseEntity {
  @Column(name = "code", nullable = false, unique = true, length = 50)
  private String code;

  @Column(name = "type", nullable = false, length = 20)
  private String type; // FIXED or PERCENT

  @Column(name = "value", nullable = false, precision = 12, scale = 2)
  private BigDecimal value;

  @Column(name = "min_order", nullable = false, precision = 12, scale = 2)
  private BigDecimal minOrder = BigDecimal.ZERO;

  @Column(name = "max_discount", precision = 12, scale = 2)
  private BigDecimal maxDiscount;

  @Column(name = "starts_at")
  private Instant startsAt;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "usage_limit")
  private Integer usageLimit;

  @Column(name = "used_count", nullable = false)
  private Integer usedCount = 0;

  @Column(name = "per_user_limit")
  private Integer perUserLimit = 1;

  @Column(name = "member_only", nullable = false)
  private Boolean memberOnly = false;

  @Column(name = "new_user_only", nullable = false)
  private Boolean newUserOnly = false;

  @Column(name = "enabled", nullable = false)
  private Boolean enabled = true;

  @Column(name = "description")
  private String description;
}
```

#### File: `backend/src/main/java/com/courtly/entity/VoucherRedemption.java`
```java
package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "voucher_redemptions")
@Getter
@Setter
@NoArgsConstructor
public class VoucherRedemption extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "voucher_id", nullable = false)
  private Voucher voucher;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = false, unique = true)
  private CustomerOrder order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id")
  private Account account;

  @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
  private BigDecimal discountAmount;

  @Column(name = "redeemed_at", nullable = false)
  private Instant redeemedAt = Instant.now();
}
```

### 6.4 Repositories

#### File: `backend/src/main/java/com/courtly/repository/AccountRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Account;

public interface AccountRepository extends LockingRepository<Account> {
  java.util.Optional<Account> findByEmailIgnoreCase(String email);
}
```

#### File: `backend/src/main/java/com/courtly/repository/AppDocumentRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.AppDocument;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface AppDocumentRepository extends JpaRepository<AppDocument, String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from AppDocument d where d.key=:key")
  Optional<AppDocument> lock(@Param("key") String key);

  List<AppDocument> findByKeyStartingWith(String prefix);
}
```

#### File: `backend/src/main/java/com/courtly/repository/AuditLogRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.AuditLog;

public interface AuditLogRepository extends LockingRepository<AuditLog> {
  java.util.List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
```

#### File: `backend/src/main/java/com/courtly/repository/BookingRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Booking;
import org.springframework.data.jpa.repository.Query;

public interface BookingRepository extends LockingRepository<Booking> {
  java.util.List<Booking> findByOrderId(java.util.UUID id);

  @Query("select b from Booking b join fetch b.order o")
  java.util.List<Booking> findAllWithOrder();
}
```

#### File: `backend/src/main/java/com/courtly/repository/BookingSlotRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.BookingSlot;
import org.springframework.data.jpa.repository.Query;

public interface BookingSlotRepository extends LockingRepository<BookingSlot> {
  java.util.List<BookingSlot> findByBookingId(java.util.UUID id);

  java.util.List<BookingSlot> findByReleasedAtIsNull();

  @Query("select bs from BookingSlot bs join fetch bs.schedule s join fetch s.court c")
  java.util.List<BookingSlot> findAllWithDetails();
}
```

#### File: `backend/src/main/java/com/courtly/repository/BookingStaffRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.BookingStaff;
import org.springframework.data.jpa.repository.Query;

public interface BookingStaffRepository extends LockingRepository<BookingStaff> {
  java.util.List<BookingStaff> findByBookingId(java.util.UUID id);

  @Query("select bs from BookingStaff bs join fetch bs.staffSchedule ss join fetch ss.staff s left join fetch bs.courtSchedule cs left join fetch cs.court c")
  java.util.List<BookingStaff> findAllWithDetails();
}
```

#### File: `backend/src/main/java/com/courtly/repository/ClubSettingsRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.ClubSettings;

public interface ClubSettingsRepository extends LockingRepository<ClubSettings> {}
```

#### File: `backend/src/main/java/com/courtly/repository/CourtPriceRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.CourtPrice;
import org.springframework.data.jpa.repository.Query;

public interface CourtPriceRepository extends LockingRepository<CourtPrice> {
  java.util.List<CourtPrice> findByCourtId(java.util.UUID court);

  @Query("select p from CourtPrice p join fetch p.court c")
  java.util.List<CourtPrice> findAllWithCourt();
}
```

#### File: `backend/src/main/java/com/courtly/repository/CourtRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Court;

public interface CourtRepository extends LockingRepository<Court> {}
```

#### File: `backend/src/main/java/com/courtly/repository/CourtScheduleRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.CourtSchedule;

public interface CourtScheduleRepository extends LockingRepository<CourtSchedule> {
  java.util.List<CourtSchedule> findByScheduleDateOrderByStartTime(java.time.LocalDate date);

  java.util.List<CourtSchedule> findByCourtIdAndScheduleDate(
      java.util.UUID court, java.time.LocalDate date);
}
```

#### File: `backend/src/main/java/com/courtly/repository/CustomerOrderRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.CustomerOrder;
import org.springframework.data.jpa.repository.Query;

public interface CustomerOrderRepository extends LockingRepository<CustomerOrder> {
  java.util.List<CustomerOrder> findByStatusAndHoldExpiresAtBefore(
      String status, java.time.Instant before);

  @Query("select o from CustomerOrder o left join fetch o.customerAccount a order by o.createdAt desc")
  java.util.List<CustomerOrder> findAllWithCustomerAccount();

  long countByCustomerAccountIdAndStatusNotIn(java.util.UUID customerAccountId, java.util.Collection<String> statuses);
}
```

#### File: `backend/src/main/java/com/courtly/repository/DrinkRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Drink;

public interface DrinkRepository extends LockingRepository<Drink> {}
```

#### File: `backend/src/main/java/com/courtly/repository/LockingRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.BaseEntity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface LockingRepository<T extends BaseEntity> extends JpaRepository<T, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from #{#entityName} e where e.id = :id")
  Optional<T> findForUpdate(@Param("id") UUID id);
}
```

#### File: `backend/src/main/java/com/courtly/repository/MatchSlotRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.MatchSlot;
import org.springframework.data.jpa.repository.Query;

public interface MatchSlotRepository extends LockingRepository<MatchSlot> {
  java.util.List<MatchSlot> findByMatchId(java.util.UUID id);

  @Query("select ms from MatchSlot ms join fetch ms.schedule s join fetch s.court c")
  java.util.List<MatchSlot> findAllWithDetails();
}
```

#### File: `backend/src/main/java/com/courtly/repository/MatchStaffRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.MatchStaff;
import org.springframework.data.jpa.repository.Query;

public interface MatchStaffRepository extends LockingRepository<MatchStaff> {
  java.util.List<MatchStaff> findByMatchId(java.util.UUID id);

  @Query("select ms from MatchStaff ms join fetch ms.staffSchedule ss join fetch ss.staff s")
  java.util.List<MatchStaff> findAllWithDetails();
}
```

#### File: `backend/src/main/java/com/courtly/repository/OrderProductRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.OrderProduct;

public interface OrderProductRepository extends LockingRepository<OrderProduct> {
  java.util.List<OrderProduct> findByOrderId(java.util.UUID id);

  @org.springframework.data.jpa.repository.Query(
      "select op from OrderProduct op left join fetch op.drink left join fetch op.rentalItem")
  java.util.List<OrderProduct> findAllWithDetails();

  @org.springframework.data.jpa.repository.Query(
      "select coalesce(sum(p.quantity),0) from OrderProduct p where p.rentalItem.id=:item and"
          + " p.returnedAt is null and p.order.status not in ('CANCELLED','EXPIRED','COMPLETED')"
          + " and p.rentStartAt < :end and p.rentEndAt > :start")
  long countRented(
      @org.springframework.data.repository.query.Param("item") java.util.UUID item,
      @org.springframework.data.repository.query.Param("start") java.time.Instant start,
      @org.springframework.data.repository.query.Param("end") java.time.Instant end);
}
```

#### File: `backend/src/main/java/com/courtly/repository/PaymentRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Payment;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends LockingRepository<Payment> {
  java.util.List<Payment> findByOrderId(java.util.UUID id);

  java.util.List<Payment> findByRegistrationId(java.util.UUID id);

  java.util.Optional<Payment> findByTransactionCode(String code);

  @Query("select p from Payment p left join fetch p.order left join fetch p.registration order by p.paidAt desc")
  java.util.List<Payment> findAllWithOrderAndRegistration();
}
```

#### File: `backend/src/main/java/com/courtly/repository/RefundRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Refund;
import org.springframework.data.jpa.repository.Query;

public interface RefundRepository extends LockingRepository<Refund> {
  java.util.List<Refund> findByPaymentId(java.util.UUID id);

  @Query("select r from Refund r join fetch r.payment p order by r.refundedAt desc")
  java.util.List<Refund> findAllWithPayment();
}
```

#### File: `backend/src/main/java/com/courtly/repository/RentalItemRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.RentalItem;

public interface RentalItemRepository extends LockingRepository<RentalItem> {}
```

#### File: `backend/src/main/java/com/courtly/repository/StaffRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Staff;

public interface StaffRepository extends LockingRepository<Staff> {}
```

#### File: `backend/src/main/java/com/courtly/repository/StaffScheduleRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.StaffSchedule;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffScheduleRepository extends LockingRepository<StaffSchedule> {
  java.util.List<StaffSchedule> findByStaffIdAndWorkDate(
      java.util.UUID id, java.time.LocalDate date);

  @Query("select s from StaffSchedule s join fetch s.staff st where s.workDate = :date order by s.startTime")
  java.util.List<StaffSchedule> findByWorkDateOrderByStartTime(@Param("date") java.time.LocalDate date);
}
```

#### File: `backend/src/main/java/com/courtly/repository/TeamMemberRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.TeamMember;
import org.springframework.data.jpa.repository.Query;

public interface TeamMemberRepository extends LockingRepository<TeamMember> {
  java.util.List<TeamMember> findByRegistrationId(java.util.UUID id);

  @Query("select m from TeamMember m join fetch m.registration r")
  java.util.List<TeamMember> findAllWithRegistration();
}
```

#### File: `backend/src/main/java/com/courtly/repository/TournamentMatchRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.TournamentMatch;

public interface TournamentMatchRepository extends LockingRepository<TournamentMatch> {
  java.util.List<TournamentMatch> findByTournamentId(java.util.UUID id);
}
```

#### File: `backend/src/main/java/com/courtly/repository/TournamentRegistrationRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.TournamentRegistration;
import org.springframework.data.jpa.repository.Query;

public interface TournamentRegistrationRepository
    extends LockingRepository<TournamentRegistration> {
  java.util.List<TournamentRegistration> findByTournamentId(java.util.UUID id);

  @Query("select tr from TournamentRegistration tr join fetch tr.tournament t join fetch tr.account a")
  java.util.List<TournamentRegistration> findAllWithTournamentAndAccount();
}
```

#### File: `backend/src/main/java/com/courtly/repository/TournamentRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Tournament;

public interface TournamentRepository extends LockingRepository<Tournament> {}
```

#### File: `backend/src/main/java/com/courtly/repository/VoucherRedemptionRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.VoucherRedemption;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoucherRedemptionRepository extends JpaRepository<VoucherRedemption, UUID> {
  Optional<VoucherRedemption> findByOrderId(UUID orderId);

  long countByVoucherIdAndAccountId(UUID voucherId, UUID accountId);

  void deleteByOrderId(UUID orderId);
}
```

#### File: `backend/src/main/java/com/courtly/repository/VoucherRepository.java`
```java
package com.courtly.repository;

import com.courtly.entity.Voucher;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoucherRepository extends LockingRepository<Voucher> {
  Optional<Voucher> findByCodeIgnoreCase(String code);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select v from Voucher v where upper(v.code) = upper(:code)")
  Optional<Voucher> findByCodeForUpdate(@Param("code") String code);

  List<Voucher> findByEnabledTrue();
}
```

### 6.5 DTOs & Payloads

#### File: `backend/src/main/java/com/courtly/dto/request/AddProductRequest.java`
```java
package com.courtly.dto.request;

public record AddProductRequest(
    @jakarta.validation.constraints.NotNull java.util.UUID productId,
    @jakarta.validation.constraints.NotBlank String type,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(999) int quantity,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(17) int hours) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/AssignStaffRequest.java`
```java
package com.courtly.dto.request;

public record AssignStaffRequest(@jakarta.validation.constraints.NotNull java.util.UUID staffId) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/BookingRequest.java`
```java
package com.courtly.dto.request;

import jakarta.validation.constraints.*;
import java.util.*;

public record BookingRequest(
    @Size(max = 255) String name,
    @Size(max = 30) String phone,
    UUID accountId,
    @NotEmpty @Size(max = 48) List<UUID> scheduleIds,
    List<StaffAssignment> assignments,
    String requestId,
    String voucherCode) {
  public BookingRequest(String name, String phone, UUID accountId, List<UUID> ids) {
    this(name, phone, accountId, ids, List.of(), null, null);
  }

  public BookingRequest(
      String name,
      String phone,
      UUID accountId,
      List<UUID> ids,
      List<StaffAssignment> assignments,
      String requestId) {
    this(name, phone, accountId, ids, assignments, requestId, null);
  }
}
```

#### File: `backend/src/main/java/com/courtly/dto/request/CatalogRequest.java`
```java
package com.courtly.dto.request;

public record CatalogRequest(
    @jakarta.validation.constraints.Size(max = 255) String name,
    String type,
    String status,
    java.math.BigDecimal price,
    Integer stock,
    @jakarta.validation.constraints.Email String email,
    String phone,
    String role,
    java.math.BigDecimal rate,
    java.util.UUID court,
    String dayType,
    Double start,
    Double end,
    java.util.UUID staff,
    java.time.LocalDate date,
    String format,
    java.time.LocalDate startDate,
    java.time.LocalDate endDate,
    java.time.LocalDate deadline,
    String location,
    java.math.BigDecimal fee,
    Integer max,
    String description,
    String address,
    String amenities,
    String imageUrl,
    Boolean imageIsIllustration) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/MatchResultRequest.java`
```java
package com.courtly.dto.request;

public record MatchResultRequest(
    @jakarta.validation.constraints.NotNull java.util.UUID winnerId,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100)
        String score) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/MatchScheduleRequest.java`
```java
package com.courtly.dto.request;

public record MatchScheduleRequest(
    @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max = 17)
        java.util.List<java.util.UUID> scheduleIds,
    java.util.UUID staffId) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/MoveBookingRequest.java`
```java
package com.courtly.dto.request;

import jakarta.validation.constraints.*;
import java.util.*;

public record MoveBookingRequest(
    @NotEmpty @Size(max = 48) List<UUID> scheduleIds,
    List<StaffAssignment> assignments,
    String reason,
    String requestId) {
  public MoveBookingRequest(List<UUID> ids) {
    this(ids, List.of(), null, null);
  }
}
```

#### File: `backend/src/main/java/com/courtly/dto/request/PaymentRequest.java`
```java
package com.courtly.dto.request;

public record PaymentRequest(
    java.util.UUID orderId,
    java.util.UUID registrationId,
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.01")
        java.math.BigDecimal amount,
    @jakarta.validation.constraints.NotBlank String method,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100)
        String transactionCode,
    String reason) {
  public PaymentRequest(
      java.util.UUID o, java.util.UUID r, java.math.BigDecimal n, String m, String code) {
    this(o, r, n, m, code, null);
  }
}
```

#### File: `backend/src/main/java/com/courtly/dto/request/RefundRequest.java`
```java
package com.courtly.dto.request;

public record RefundRequest(
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.01")
        java.math.BigDecimal amount,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 255)
        String reason) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/RegistrationRequest.java`
```java
package com.courtly.dto.request;

public record RegistrationRequest(
    @jakarta.validation.constraints.NotNull java.util.UUID accountId,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 255)
        String name,
    @jakarta.validation.constraints.Size(max = 30)
        java.util.List<
                @jakarta.validation.constraints.NotBlank
                @jakarta.validation.constraints.Size(max = 255) String>
            members) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/ScheduleRequest.java`
```java
package com.courtly.dto.request;

public record ScheduleRequest(@jakarta.validation.constraints.NotNull java.time.LocalDate date) {}
```

#### File: `backend/src/main/java/com/courtly/dto/request/SettingsRequest.java`
```java
package com.courtly.dto.request;

public record SettingsRequest(
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(60) int holdMinutes,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100)
        int depositPercent,
    @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(100)
        int cancelRefundPercent,
    java.util.Map<String, Object> policies) {
  public SettingsRequest(int hold, int deposit, int refund) {
    this(hold, deposit, refund, null);
  }
}
```

#### File: `backend/src/main/java/com/courtly/dto/request/StaffAssignment.java`
```java
package com.courtly.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StaffAssignment(@NotNull UUID scheduleId, @NotNull UUID staffId) {}
```

#### File: `backend/src/main/java/com/courtly/dto/response/ApiError.java`
```java
package com.courtly.dto.response;

import java.time.Instant;

public record ApiError(String message, Instant timestamp) {}
```

### 6.6 Security & Configs

#### File: `backend/src/main/java/com/courtly/config/ApiAccessInterceptor.java`
```java
package com.courtly.config;

import com.courtly.repository.CustomerOrderRepository;
import com.courtly.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class ApiAccessInterceptor implements HandlerInterceptor {
  private final AuthService auth;
  private final CustomerOrderRepository orders;

  @Override
  public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    String p = req.getRequestURI();
    if (req.getMethod().equals("OPTIONS")
        || p.startsWith("/api/public/")
        || p.startsWith("/api/auth/")
        || p.equals("/api/csrf") || p.equals("/api/webhooks/sepay")) return true;
    var a = auth.current(req);
    req.setAttribute("actor", a);
    boolean staffOrAdmin = Set.of("ADMIN", "STAFF").contains(a.getRole());
    if (!staffOrAdmin && p.matches("/api/orders/[^/]+.*")) {
      String[] parts = p.split("/");
      UUID orderId;
      try {
        orderId = UUID.fromString(parts[3]);
      } catch (IllegalArgumentException e) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Đơn không tồn tại");
      }
      var o =
          orders
              .findById(orderId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
      if (o.getCustomerAccount() == null || !o.getCustomerAccount().getId().equals(a.getId()))
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "Bạn chỉ được xem và sửa đơn của mình");
      if (parts.length < 5 || !Set.of("cancel", "schedule", "preview", "cancellation-preview").contains(parts[4]))
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "Dịch vụ và vận hành đơn chỉ xử lý tại quầy");
    }
    return true;
  }
}
```

#### File: `backend/src/main/java/com/courtly/config/DemoDataInitializer.java`
```java
package com.courtly.config;

import static com.courtly.util.Rules.ZONE;

import com.courtly.entity.*;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DemoDataInitializer implements ApplicationRunner {
  private final CourtRepository courts;
  private final AccountRepository accounts;
  private final StaffRepository staff;
  private final TournamentRepository tournaments;
  private final SettingsService settings;
  private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
  private final org.springframework.core.env.Environment environment;

  @Value("${courtly.admin-email}")
  private String adminEmail;

  @Value("${courtly.admin-password:}")
  private String adminPassword;

  @Value("${courtly.seed-demo}")
  private boolean enabled;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    settings.get();

    // 1. Tài khoản ADMIN
    if (adminPassword.isBlank()) {
      log.warn("ADMIN_PASSWORD chưa được cấu hình cho tài khoản: {}", adminEmail);
      // Chỉ trong môi trường demo/dev (không phải prod) và khi tài khoản admin chưa tồn tại:
      // cấp tài khoản admin mặc định với mật khẩu 12345 để phục vụ kiểm thử và phát triển local
      if (enabled && !environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "production")) && accounts.findByEmailIgnoreCase(adminEmail).isEmpty()) {
        Account admin = new Account();
        admin.setFullName("Quản trị Courtly");
        admin.setEmail(adminEmail.toLowerCase(java.util.Locale.ROOT));
        admin.setPhone("");
        admin.setRole("ADMIN");
        admin.setPasswordHash(passwordEncoder.encode("12345"));
        accounts.save(admin);
      }
    } else {
      // Khi CÓ cấu hình ADMIN_PASSWORD: bắt buộc kiểm tra độ an toàn (>= 10 ký tự, <= 72 byte chuẩn BCrypt)
      com.courtly.util.Rules.require(
          adminPassword.length() >= 10
              && adminPassword.getBytes(StandardCharsets.UTF_8).length <= 72,
          "ADMIN_PASSWORD cần ít nhất 10 ký tự, tối đa 72 byte UTF-8");
      var adminOpt = accounts.findByEmailIgnoreCase(adminEmail);
      if (adminOpt.isEmpty()) {
        Account admin = new Account();
        admin.setFullName("Quản trị Courtly");
        admin.setEmail(adminEmail.toLowerCase(java.util.Locale.ROOT));
        admin.setPhone("");
        admin.setRole("ADMIN");
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        accounts.save(admin);
      } else {
        Account admin = adminOpt.get();
        if (!"ADMIN".equals(admin.getRole())) {
          log.warn(
              "Tài khoản {} đã tồn tại với vai trò '{}' (không phải ADMIN). Bỏ qua khởi tạo để tránh nâng quyền trái phép.",
              adminEmail,
              admin.getRole());
        } else {
          // Chỉ khởi tạo mật khẩu nếu admin chưa từng có mật khẩu (tuyệt đối không ghi đè nếu đã đổi)
          if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            accounts.save(admin);
          }
        }
      }
    }

    // 2. Phân định quyền duy nhất: CHỈ hạ quyền các tài khoản ADMIN khác NẾU VÀ CHỈ NẾU
    // tài khoản chủ sân (adminEmail) thực sự tồn tại và đang mang quyền ADMIN!
    // Tránh tình trạng: cấu hình sai hoặc thiếu ADMIN_PASSWORD dẫn đến hạ quyền admin cũ làm mất sạch admin.
    accounts.findByEmailIgnoreCase(adminEmail).ifPresent(adminAcc -> {
      if ("ADMIN".equals(adminAcc.getRole())) {
        for (Account a : accounts.findAll()) {
          if ("ADMIN".equals(a.getRole()) && !adminEmail.equalsIgnoreCase(a.getEmail())) {
            a.setRole("STAFF");
            accounts.save(a);
          }
        }
      }
    });

    // 3. BẢO VỆ MÔI TRƯỜNG THỰC: Toàn bộ dữ liệu mẫu (staff mẫu, sân mẫu, tài khoản demo...) PHẢI NẰM SAU DÒNG NÀY!
    // Khi SEED_DEMO=false, hàm kết thúc ngay tại đây -> Không tạo staff@gmail.com, không seed sân hay demo users!
    if (!enabled) return;

    // 4. Khởi tạo tài khoản STAFF mẫu (chỉ chạy khi enabled == true)
    // TUYỆT ĐỐI KHÔNG tự động nâng quyền tài khoản đã tồn tại (tránh nâng quyền nhầm nếu khách hàng đã đăng ký với email này)
    var staffOpt = accounts.findByEmailIgnoreCase("staff@gmail.com");
    if (staffOpt.isEmpty()) {
      Account staffAcc = new Account();
      staffAcc.setFullName("Nhân viên Staff");
      staffAcc.setEmail("staff@gmail.com");
      staffAcc.setPhone("0987654321");
      staffAcc.setRole("STAFF");
      staffAcc.setPasswordHash(passwordEncoder.encode("12345"));
      accounts.save(staffAcc);
    }

    // 5. Kiểm tra nếu đã có dữ liệu sân thì không seed lại
    if (courts.count() > 0) return;

    for (int i = 1; i <= 10; i++) {
      Court c = new Court();
      String zone = i <= 4 ? "A" : i <= 8 ? "B" : "V";
      int number = i <= 4 ? i : i <= 8 ? i - 4 : i - 8;
      c.setName(zone + "0" + number);
      c.setType("HARD");
      c.setStatus("ACTIVE");
      c.setBasePrice(BigDecimal.valueOf(i <= 4 ? 200000 : i <= 8 ? 300000 : 500000));
      c.setImageUrl("/guest/zone-" + zone.toLowerCase(java.util.Locale.ROOT)
          + (i <= 4 ? "-outdoor.webp" : i <= 8 ? "-indoor.webp" : "-lounge.webp"));
      courts.save(c);
    }
    String[] names = {"Nguyễn Minh Anh", "Trần Hoàng Nam", "Lê Thu Hà"};
    for (int i = 0; i < names.length; i++) {
      Account a = new Account();
      a.setFullName(names[i]);
      a.setEmail("demo" + (i + 1) + "@example.com");
      a.setPhone("090000000" + i);
      a.setRole("CUSTOMER");
      accounts.save(a);
    }
    String[] people = {"Phạm Quốc Huy", "Vũ Thanh Bình", "Ngô Đức Long"};
    String[] types = {"REFEREE", "REFEREE", "REFEREE"};
    for (int i = 0; i < people.length; i++) {
      Staff s = new Staff();
      s.setFullName(people[i]);
      s.setType(types[i]);
      s.setPhone("091000000" + i);
      s.setHourlyRate(BigDecimal.valueOf(i == 1 ? 250000 : i == 0 ? 120000 : 60000));
      staff.save(s);
    }
    Tournament t = new Tournament();
    t.setName("Courtly Open");
    t.setLocation("CLB Courtly");
    t.setStatus("OPEN");
    t.setStartDate(LocalDate.now(ZONE).plusDays(7));
    t.setEndDate(t.getStartDate().plusDays(2));
    t.setRegistrationDeadline(t.getStartDate());
    t.setRegistrationFee(BigDecimal.valueOf(300000));
    t.setMaxParticipants(16);
    tournaments.save(t);
  }
}
```

#### File: `backend/src/main/java/com/courtly/config/ProductionSecurityValidator.java`
```java
package com.courtly.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Fail-fast security invariant validator for production environments.
 * Runs with highest precedence before any other runner can execute or seed data.
 * Prevents the application from starting if insecure default credentials,
 * unencrypted cookies, demo modes, placeholder secrets, or sample bank accounts are configured.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class ProductionSecurityValidator implements ApplicationRunner {

  private final Environment environment;

  @Override
  public void run(ApplicationArguments args) {
    if (!environment.acceptsProfiles(Profiles.of("prod", "production"))) {
      log.debug("Non-production profile active. Skipping strict production security validation.");
      return;
    }

    log.info("Validating production security invariants...");

    String dbPassword = environment.getProperty("spring.datasource.password", "");
    if (dbPassword.isBlank() || "courtly_local".equalsIgnoreCase(dbPassword)) {
      throw new IllegalStateException(
          "FATAL: Insecure default database password ('courtly_local') detected in production profile! "
              + "Please configure a secure DB_PASSWORD via environment variables.");
    }

    boolean cookieSecure = Boolean.parseBoolean(
        environment.getProperty("server.servlet.session.cookie.secure", "false"));
    if (!cookieSecure) {
      throw new IllegalStateException(
          "FATAL: server.servlet.session.cookie.secure must be true in production profile! "
              + "Please set COOKIE_SECURE=true.");
    }

    boolean demoMode = Boolean.parseBoolean(
        environment.getProperty("courtly.demo-mode", "false"));
    if (demoMode) {
      throw new IllegalStateException(
          "FATAL: courtly.demo-mode must be false in production profile! "
              + "Please set DEMO_MODE=false.");
    }

    boolean seedDemo = Boolean.parseBoolean(
        environment.getProperty("courtly.seed-demo", "false"));
    if (seedDemo) {
      throw new IllegalStateException(
          "FATAL: courtly.seed-demo must be false in production profile! "
              + "Please set SEED_DEMO=false.");
    }

    String otpSecret = environment.getProperty("courtly.security.otp-secret", "");
    if (otpSecret.isBlank() || "CourtlySecureHmacSecretKey2026!".equals(otpSecret)) {
      throw new IllegalStateException(
          "FATAL: Insecure default or blank courtly.security.otp-secret detected in production profile! "
              + "Please configure a cryptographically random OTP_SECRET.");
    }

    String adminPassword = environment.getProperty("courtly.admin-password", "");
    if (adminPassword.isBlank() || "12345".equals(adminPassword)) {
      throw new IllegalStateException(
          "FATAL: ADMIN_PASSWORD is missing or set to default '12345' in production profile! "
              + "Please configure a strong ADMIN_PASSWORD.");
    }

    String paymentMode = environment.getProperty("courtly.payment.mode", "");
    if ("DEMO".equalsIgnoreCase(paymentMode)) {
      throw new IllegalStateException(
          "FATAL: PAYMENT_MODE must not be 'DEMO' in production profile! "
              + "Please set PAYMENT_MODE=SEPAY or configure a live payment provider.");
    }

    String webhookKey = environment.getProperty("courtly.payment.webhook-key", "");
    if (webhookKey.isBlank()) {
      throw new IllegalStateException(
          "FATAL: SEPAY_WEBHOOK_KEY is required and cannot be blank in production profile! "
              + "Please configure a valid SEPAY_WEBHOOK_KEY.");
    }

    String frontendOrigin = environment.getProperty("courtly.allowed-origin", "");
    if (frontendOrigin.isBlank()
        || frontendOrigin.contains("localhost")
        || frontendOrigin.contains("127.0.0.1")) {
      throw new IllegalStateException(
          "FATAL: FRONTEND_ORIGIN cannot be empty or point to localhost in production profile! "
              + "Configured value: '" + frontendOrigin + "'. Please configure a production domain.");
    }

    String accountNumber = environment.getProperty("courtly.payment.account-number", "");
    if ("0345678999".equals(accountNumber)) {
      throw new IllegalStateException(
          "FATAL: Default sample bank account number ('0345678999') detected in production profile! "
              + "Please configure a real PAYMENT_ACCOUNT_NUMBER via environment variables.");
    }

    log.info("All production security invariants validated successfully.");
  }
}
```

#### File: `backend/src/main/java/com/courtly/config/SecurityConfig.java`
```java
package com.courtly.config;

import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  org.springframework.security.core.userdetails.UserDetailsService users() {
    return name -> {
      throw new org.springframework.security.core.userdetails.UsernameNotFoundException(
          "Use Courtly authentication API");
    };
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  HttpSessionSecurityContextRepository securityContexts() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    return http.cors(c -> {})
        .csrf(
            c ->
                c.ignoringRequestMatchers("/api/webhooks/sepay").csrfTokenRepository(new HttpSessionCsrfTokenRepository())
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/api/csrf", "/api/auth/**", "/api/public/**", "/api/webhooks/sepay")
                    .permitAll()
                    // Thu ngân / thu tiền tại quầy: ADMIN và STAFF
                    .requestMatchers(HttpMethod.GET, "/api/payments/cash-desk").hasAnyRole("ADMIN", "STAFF")
                    .requestMatchers(HttpMethod.POST, "/api/payments").hasAnyRole("ADMIN", "STAFF")
                    // Toàn bộ các route quản trị nhạy cảm: chỉ ADMIN
                    .requestMatchers(
                        "/api/catalog/**",
                        "/api/settings",
                        "/api/settings/**",
                        "/api/content/**",
                        "/api/matches/**",
                        "/api/tournaments/*/draw",
                        "/api/tournaments/*/registrations",
                        "/api/payments/*/refunds")
                    .hasRole("ADMIN")
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .formLogin(c -> c.disable())
        .httpBasic(c -> c.disable())
        .logout(c -> c.disable())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setStatus(401);
                          res.setContentType("application/json;charset=UTF-8");
                          res.getWriter()
                              .write("{\"message\":\"Vui lòng đăng nhập để tiếp tục.\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, ex) -> {
                          res.setStatus(403);
                          res.setContentType("application/json;charset=UTF-8");
                          res.getWriter()
                              .write(
                                  "{\"message\":\"Không có quyền hoặc phiên xác thực đã thay đổi."
                                      + " Tải lại trang rồi thử lại.\"}");
                        }))
        .build();
  }
}
```

#### File: `backend/src/main/java/com/courtly/config/WebConfig.java`
```java
package com.courtly.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  @org.springframework.beans.factory.annotation.Autowired private ApiAccessInterceptor access;

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(access).addPathPatterns("/api/**");
  }

  @Value("${courtly.allowed-origin}")
  private String allowedOrigin;

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
        .addMapping("/api/**")
        .allowedOrigins(allowedOrigin)
        .allowedMethods("GET", "POST", "PUT", "PATCH", "OPTIONS")
        .allowCredentials(true)
        .allowedHeaders("Content-Type", "Idempotency-Key", "X-CSRF-TOKEN");
  }
}
```

### 6.7 Utils & Exceptions

#### File: `backend/src/main/java/com/courtly/exception/BusinessException.java`
```java
package com.courtly.exception;

public class BusinessException extends RuntimeException {
  public BusinessException(String message) {
    super(message);
  }
}
```

#### File: `backend/src/main/java/com/courtly/exception/GlobalExceptionHandler.java`
```java
package com.courtly.exception;

import com.courtly.dto.response.ApiError;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public ResponseEntity<ApiError> status(org.springframework.web.server.ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(
            new ApiError(
                e.getReason() == null ? "Không có quyền truy cập" : e.getReason(), Instant.now()));
  }

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiError> business(BusinessException e) {
    return ResponseEntity.badRequest().body(new ApiError(e.getMessage(), Instant.now()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
    String message =
        e.getBindingResult().getFieldErrors().stream()
            .map(x -> x.getField() + ": " + x.getDefaultMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ");
    return ResponseEntity.badRequest().body(new ApiError(message, Instant.now()));
  }

  @ExceptionHandler({
    DataIntegrityViolationException.class,
    PessimisticLockingFailureException.class
  })
  public ResponseEntity<ApiError> conflict(Exception e) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new ApiError("Dữ liệu bị trùng hoặc vừa thay đổi. Tải lại và thử lại.", Instant.now()));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    IllegalArgumentException.class
  })
  public ResponseEntity<ApiError> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(new ApiError("Dữ liệu gửi lên không đúng định dạng.", Instant.now()));
  }
}
```

### 6.8 Utils

#### File: `backend/src/main/java/com/courtly/util/Rules.java`
```java
package com.courtly.util;

import com.courtly.exception.BusinessException;
import java.math.*;
import java.time.*;
import java.util.*;

public final class Rules {
  public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

  private Rules() {}

  public static void require(boolean condition, String message) {
    if (!condition) throw new BusinessException(message);
  }

  public static String text(String value, String label) {
    require(value != null && !value.isBlank() && value.length() <= 255, label + " không hợp lệ");
    return value.trim();
  }

  public static String oneOf(String value, String... choices) {
    require(
        value != null && Arrays.asList(choices).contains(value), "Giá trị không hợp lệ: " + value);
    return value;
  }

  public static BigDecimal positive(BigDecimal value) {
    require(
        value != null && value.signum() > 0 && value.compareTo(new BigDecimal("999999999999")) < 0,
        "Số tiền phải lớn hơn 0");
    return value.setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal hours(LocalTime start, LocalTime end) {
    return BigDecimal.valueOf(Duration.between(start, end).toMinutes())
        .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
  }

  public static boolean active(String status) {
    return !Set.of("COMPLETED", "CANCELLED", "EXPIRED").contains(status);
  }

  public static Instant at(LocalDate date, LocalTime time) {
    return date.atTime(time).atZone(ZONE).toInstant();
  }

  public static Map<String, Object> map(Object... pairs) {
    Map<String, Object> out = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
    return out;
  }
}
```

## 7. TOÀN BỘ MÃ NGUỒN FRONTEND (REACT 19 + VITE)

### 7.1 Core App & Services

#### File: `frontend/src/App.jsx`
```jsx
import GuestPortal from './guest/Portal';
import React,{useState,useCallback,useRef,useEffect} from 'react';
import {CalendarDays,ClipboardList,Wallet,Grid2X2,Package,Users,Trophy,ChartColumn,Settings,Bell,Menu,UserRound,LogOut,MessageSquare} from 'lucide-react';
import {CourtlyContext} from './context';
import {useClub} from './hooks/useClub';
import {api} from './services/api';
import {today,dateLabel} from './utils/format';
import {Button} from './components/UI';
import AuthDialog from './components/AuthDialog';
import PublicPage from './pages/PublicPage';
import {PublicHeader,PublicFooter} from './components/PublicLayout';
import MembershipPage from './pages/MembershipPage';
import MembershipAdminPage from './pages/MembershipAdminPage';
import InformationPage from './pages/InformationPage';
import ContentAdminPage from './pages/ContentAdminPage';
import DialogHost from './components/DialogHost';
import CustomerDialogs from './components/CustomerDialogs';
import CustomerPage from './pages/CustomerPage';
import {MyHistory,MyPayments,MyServices} from './pages/CustomerHistory';
import ProfilePage from './pages/ProfilePage';
import OperationsPage from './pages/OperationsPage';
import CalendarPage from './pages/CalendarPage';
import OrdersPage from './pages/OrdersPage';
import PaymentsPage from './pages/PaymentsPage';
import CourtsPage from './pages/CourtsPage';
import StaffPage from './pages/StaffPage';
import AccountsPage from './pages/AccountsPage';
import TournamentsPage from './pages/TournamentsPage';
import ReportsPage from './pages/ReportsPage';
import SystemPage from './pages/SystemPage';
import NotificationsPage from './pages/NotificationsPage';
const adminMenu=[['operations',ClipboardList,'Việc cần xử lý'],['history',CalendarDays,'Lịch sử đặt sân'],['payment-history',Wallet,'Lịch sử thanh toán'],['services',Package,'Dịch vụ trọng tài'],['calendar',CalendarDays,'Lịch sân'],['orders',ClipboardList,'Đơn đặt sân'],['payments',Wallet,'Thu tiền & hoàn tiền'],['courts',Grid2X2,'Sân & bảng giá'],['membership',Users,'Membership & hội viên'],['staff',Users,'Nhân sự'],['tournaments',Trophy,'Giải đấu'],['accounts',Users,'Tài khoản & phân quyền'],['reports',ChartColumn,'Báo cáo'],['content',MessageSquare,'Nội dung & feedback'],['system',Settings,'Hệ thống & module'],['profile',UserRound,'Hồ sơ của tôi']];
const staffMenu=[['operations',ClipboardList,'Việc cần xử lý'],['calendar',CalendarDays,'Lịch sân'],['orders',ClipboardList,'Đơn đặt sân'],['payments',Wallet,'Thu tiền & hoàn tiền'],['services',Package,'Dịch vụ trọng tài'],['history',CalendarDays,'Lịch sử đặt sân'],['profile',UserRound,'Hồ sơ của tôi']];
const customerMenu=[['calendar',CalendarDays,'Đặt sân'],['tournaments',Trophy,'Giải đấu']];
const pages={membership:MembershipAdminPage,operations:OperationsPage,history:MyHistory,'payment-history':MyPayments,services:MyServices,calendar:CalendarPage,orders:OrdersPage,payments:PaymentsPage,courts:CourtsPage,staff:StaffPage,tournaments:TournamentsPage,accounts:AccountsPage,reports:ReportsPage,system:SystemPage,notifications:NotificationsPage,profile:ProfilePage,content:ContentAdminPage};
export function AuthenticatedApp({session,onAccessError,onLogout,pending,onConsumed}){
 const [date,setDate]=useState(()=>pending?.date||today()),[route,setRoute]=useState(()=>location.hash.slice(1)||(session.user.role==='ADMIN'||session.user.role==='STAFF'?'operations':'calendar'));
 const [membershipPlan]=useState(pending?.type==='membership'?pending.planId:null);
 const [dialog,setDialog]=useState(null),[mobile,setMobile]=useState(false),[toast,setToast]=useState('');const toastTimer=useRef();
 const club=useClub(date,onAccessError),user=club.data?.viewer||session.user,isAdmin=user.role==='ADMIN',isStaff=user.role==='STAFF',isInternal=isAdmin||isStaff,menu=isAdmin?adminMenu:isStaff?staffMenu:customerMenu;
 const mappedRoute=!isInternal&&['orders','history','payments'].includes(route)?'profile-'+route:route;const safeRoute=mappedRoute.startsWith('profile')||menu.some(x=>x[0]===mappedRoute)||(isAdmin&&mappedRoute==='notifications')?mappedRoute:(isInternal?'operations':'calendar');
 const notify=useCallback(text=>{clearTimeout(toastTimer.current);setToast(text);toastTimer.current=setTimeout(()=>setToast(''),4500);},[]);
 useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
 useEffect(()=>{setDialog(null);},[user.role]);
 const navigate=useCallback(r=>{setRoute(r);setMobile(false);setDialog(null);history.replaceState(null,'','#'+r);},[]);
 useEffect(()=>{const warn=()=>notify('Thao tác đã thành công, nhưng chưa tải lại được dữ liệu. Hãy làm mới; không gửi lại thao tác.');window.addEventListener('courtly-committed-refresh-error',warn);return()=>window.removeEventListener('courtly-committed-refresh-error',warn);},[notify]);
 const close=useCallback(()=>setDialog(null),[]);
 const resumed=useRef(false);
 useEffect(()=>{
  if(!club.data||!pending||resumed.current)return;
  resumed.current=true;
  if(pending.type==='navigate'){navigate(pending.route==='payments'&&isAdmin?'payment-history':pending.route);}
  else if(pending.type==='membership'){navigate(isAdmin?'membership':'profile-membership');}
  else if(isInternal){notify(`Đã đăng nhập ${isAdmin?'quản trị':'staff'}. Bạn có thể xử lý lịch và đơn tại đây.`);}
  else if(pending.type==='booking'){
   const selected=club.data.schedules.filter(s=>pending.scheduleIds.includes(s.id));
   if(selected.length===pending.scheduleIds.length&&selected.every(s=>s.status==='AVAILABLE'))setDialog({...pending});
   else {setDialog({...pending});notify('Đang kiểm tra lại lựa chọn. Nếu có xung đột, quay lại chọn khoảng giờ.');}
  }else if(pending.type==='registration'){setRoute('tournaments');setDialog({...pending});}
  onConsumed?.();
 },[club.data,pending,isAdmin,isInternal,notify,onConsumed,navigate]);
 const menuGroups=isAdmin?[
  {label:'VẬN HÀNH',ids:['operations','calendar','orders','services','payments']},
  {label:'TRA CỨU',ids:['history','payment-history','reports']},
  {label:'KINH DOANH',ids:['courts','membership','tournaments']},
  {label:'QUẢN TRỊ',ids:['staff','accounts','content','system','profile']}
 ]:isStaff?[
  {label:'VẬN HÀNH',ids:['operations','calendar','orders','payments','services']},
  {label:'TRA CỨU & CÁ NHÂN',ids:['history','profile']}
 ]:[{label:'LỊCH CHƠI CỦA BẠN',ids:customerMenu.map(x=>x[0])}];
 useEffect(()=>{const change=()=>setRoute(location.hash.slice(1)||(session.user.role==='ADMIN'||session.user.role==='STAFF'?'operations':'calendar'));window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 const Page=pages[safeRoute]||CalendarPage;
 if(!isInternal)return <CourtlyContext.Provider value={{...club,user,isAdmin,isStaff,date,setDate,navigate,show:setDialog,notify}}><div className="customer-workspace"><PublicHeader user={user} onLogout={onLogout}/><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'} initialPlan={membershipPlan}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main><PublicFooter/>{club.data&&dialog&&<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></div></CourtlyContext.Provider>;
 return <CourtlyContext.Provider value={{...club,user,isAdmin,isStaff,date,setDate,navigate,show:setDialog,notify}}><div className="layout"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><img src="/favicon.svg" alt="" width="34" height="34"/><div>Courtly<em>TENNIS CLUB</em></div></div><nav className="nav" aria-label={isAdmin?'Quản trị':isStaff?'Staff':'Khách hàng'}>{menuGroups.map(group=><section className="nav-group" key={group.label}><div className="nav-caption">{group.label}</div>{group.ids.map(id=>{const [,Icon,label]=menu.find(x=>x[0]===id);return <button key={id} className={safeRoute===id?'active':''} onClick={()=>navigate(id)}><Icon size={19}/>{label}</button>;})}</section>)}</nav><div className="side-foot"><button className="signed-user avatar-button" aria-label="Hồ sơ của tôi" onClick={()=>navigate('profile')}><span className="avatar">{user.name.slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{isAdmin?'Quản trị viên':isStaff?'Staff':'Khách hàng'}</small></div></button><a className="signout" href="/">Website câu lạc bộ ↗</a><a className="signout" href="/feedback">Gửi feedback ↗</a><button className="signout" onClick={onLogout}><LogOut size={16}/>Đăng xuất</button></div></aside><div className="content"><header className="topbar"><div className="tools"><button className="mobile-menu" aria-label="Mở menu" onClick={()=>setMobile(!mobile)}><Menu size={20}/></button><span className="crumb">Courtly <span className="muted"> / </span>{menu.find(x=>x[0]===safeRoute)?.[2]||'Thông báo'}</span></div><div className="right"><span className="date-label meta">{dateLabel(today())}</span><span className={`chip ${isAdmin?'green':isStaff?'orange':'blue'}`}>{isAdmin?'Admin':isStaff?'Staff':'Khách hàng'}</span>{isAdmin&&<button aria-label="Thông báo" onClick={()=>navigate('notifications')}><Bell size={20}/></button>}<button className="header-signout" onClick={onLogout} aria-label="Đăng xuất"><LogOut size={19}/></button></div></header><main className="main">{club.error&&<div className="error" role="alert">{club.error} <Button className="sm" onClick={()=>club.refresh().catch(()=>{})}>Thử lại</Button></div>}{club.loading?<div className="loading">Đang tải dữ liệu…</div>:club.data?(safeRoute.startsWith('profile')?<ProfilePage tab={safeRoute.split('-')[1]||'info'}/>:isInternal?<Page key={safeRoute}/>:<CustomerPage key={safeRoute} route={safeRoute}/>):<div className="empty">Không thể kết nối máy chủ. Vui lòng thử lại.</div>}</main></div></div>{club.data&&dialog&&(isInternal?<DialogHost key={`${dialog.type}-${dialog.id||dialog.collection||''}`} dialog={dialog} onClose={close}/>:<CustomerDialogs key={`${dialog.type}-${dialog.id||''}`} dialog={dialog} onClose={close}/>)}<div aria-live="polite">{toast&&<div className="toast">{toast}</div>}</div></CourtlyContext.Provider>;
}
export default function App(){
 const [session,setSession]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{api('/auth/session').then(setSession).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const logout=async()=>{await api('/auth/logout','POST',{});setSession(null);history.replaceState(null,'','/');};
 if(loading)return <div className="loading">Courtly…</div>;
 if(session?.authenticated&&['ADMIN','STAFF'].includes(session.user.role)&&location.pathname==='/app')return <AuthenticatedApp session={session} onAccessError={e=>{setError(e.message);setSession(null)}} onLogout={logout}/>;
 return <GuestPortal session={session} onSession={setSession} onLogout={logout}/>;
}
```

#### File: `frontend/src/services/api.js`
```javascript
const base = import.meta.env.VITE_API_URL || '/api';
let csrf = null;
async function csrfToken(){if(!csrf){const r=await fetch(`${base}/csrf`,{credentials:'same-origin'});if(!r.ok)throw new Error('Không thể khởi tạo phiên xác thực');csrf=await r.json();}return csrf;}
export async function api(path, method = 'GET', body) {
  const token=!['GET','HEAD','OPTIONS'].includes(method)?await csrfToken():null;
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(token?{[token.headerName]:token.token}:{}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if(response.status===403)csrf=null;
  if (!response.ok) { const error=new Error(data?.message || `Không thể xử lý yêu cầu (${response.status}).`); error.status=response.status; throw error; }
  if(path.startsWith('/auth/')&&method==='POST')csrf=null;
  return data;
}
```

#### File: `frontend/src/utils/format.js`
```javascript
export const money = n => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const localDate = instant => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
export const dateLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
export const active = order => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status);
export const labels = {
  HOLDING: 'Đang giữ chỗ', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đang sử dụng', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
  ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng hoạt động', MAINTENANCE: 'Bảo trì', PENDING: 'Chờ thanh toán', OPEN: 'Mở đăng ký', CLOSED: 'Đã đóng đăng ký',
  DRAFT: 'Bản nháp', ONGOING: 'Đang diễn ra', FINISHED: 'Kết thúc', SCHEDULED: 'Chờ thi đấu', HARD: 'Sân cứng', CLAY: 'Sân đất nện', GRASS: 'Sân cỏ',
  REFEREE: 'Trọng tài', COACH: 'Huấn luyện viên', BALL_BOY: 'Nhặt bóng', CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', DEPOSIT: 'Tiền cọc', BALANCE: 'Thanh toán',
  TOURNAMENT_FEE: 'Phí giải', MEMBERSHIP_FEE: 'Phí hội viên', DRINK: 'Đồ uống', RENTAL: 'Đồ thuê', ADMIN: 'Quản trị', STAFF: 'Staff', CUSTOMER: 'Khách hàng', LOCKED: 'Đã khóa',
  SINGLES: 'Đơn', DOUBLES: 'Đôi', TEAM: 'Đồng đội', WEEKDAY: 'Ngày thường', WEEKEND: 'Cuối tuần', AVAILABLE: 'Còn trống', BOOKED: 'Đã đặt', IN_MATCH: 'Thi đấu',
};
export const options = keys => keys.map(value => ({ value, label: labels[value] || value }));

// Precise time labels for both legacy hourly and new half-hour slots.
export const hourLabel = h => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
export const slotLabel = s => `${s.start?.slice(0,5)||hourLabel(s.hour)}–${s.end?.slice(0,5)||hourLabel(s.hour+1)}`;
export const slotHours = s => s.start&&s.end ? ((Number(s.end.slice(0,2))*60+Number(s.end.slice(3,5)))-(Number(s.start.slice(0,2))*60+Number(s.start.slice(3,5))))/60 : 1;
```

### 7.2 Guest Portal (Giao diện khách)

#### File: `frontend/src/guest/Auth.jsx`
```jsx
import React, { useState } from 'react';
import { api } from '../services/api';
import { useGuest, Action } from './context';

export default function GuestAuth({ onSuccess }) {
  const { t } = useGuest();
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ email: '', password: '', name: '', phone: '', confirm: '', token: '', code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setValues(x => ({ ...x, [k]: v }));

  const handleResend = async () => {
    if (busy || !values.email.trim()) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const res = await api('/auth/resend-activation', 'POST', { email: values.email.trim() });
      setSuccess(t('Đã gửi lại mã kích hoạt mới đến email của bạn.'));
      if (res.devCode) {
        setDevCode(res.devCode);
        set('code', res.devCode);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'register') {
      const p = values.phone.trim().replace(/\s+/g, '');
      if (!/^0[0-9]{9}$/.test(p)) {
        return setError(t('Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0).'));
      }
    }

    if (!['login', 'activate-otp'].includes(mode) && values.password !== values.confirm) {
      return setError(t('Hai mật khẩu chưa trùng nhau.'));
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await api('/auth/register', 'POST', {
          ...values,
          phone: values.phone.trim().replace(/\s+/g, ''),
          requireActivation: true
        });
        if (res.requiresActivation) {
          setMode('activate-otp');
          if (res.email) set('email', res.email);
          setSuccess(res.message || t('Mã kích hoạt OTP 6 số đã được gửi tới email.'));
          if (res.devCode) {
            setDevCode(res.devCode);
            set('code', res.devCode);
          }
          return;
        }
        await onSuccess(res);
        return;
      }

      if (mode === 'activate-otp') {
        const session = await api('/auth/activate', 'POST', {
          code: values.code.trim(),
          email: values.email?.trim()
        });
        await onSuccess(session);
        return;
      }

      const res = await api('/auth/' + mode, 'POST', values);
      if (res.requiresActivation) {
        setMode('activate-otp');
        if (res.email) set('email', res.email);
        setSuccess(res.message || t('Tài khoản chưa kích hoạt. Vui lòng nhập mã OTP.'));
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
        return;
      }
      await onSuccess(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="gx-form">
      <h2>
        {t(
          mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Kích hoạt tài khoản'
            : 'Đặt lại mật khẩu'
        )}
      </h2>

      {success && <div className="gx-notice" role="status" style={{ marginBottom: 12 }}>{success}</div>}

      {mode === 'register' && (
        <>
          <label>
            {t('Họ và tên')}
            <input required maxLength={100} autoComplete="name" value={values.name} onChange={e => set('name', e.target.value)} />
          </label>
          <label>
            {t('Số điện thoại liên hệ')}
            <input
              type="tel"
              required
              maxLength={15}
              placeholder="0912345678"
              value={values.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </label>
        </>
      )}

      {mode === 'activate-otp' ? (
        <>
          <label>
            Email
            <input type="email" value={values.email} readOnly disabled style={{ background: '#f5f7f5', color: '#555' }} />
          </label>

          {devCode && (
            <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo:</small>
                <span style={{ fontSize: 13, color: '#14532d' }}>Mã OTP: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
              </div>
              <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                {t('Điền nhanh')}
              </button>
            </div>
          )}

          <label>
            {t('Mã kích hoạt OTP 6 số (gửi về email)')}
            <input
              required
              maxLength={12}
              placeholder="123456"
              value={values.code}
              onChange={e => set('code', e.target.value.trim())}
              style={{ fontSize: '20px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px' }}>
            <small style={{ color: '#637269' }}>{t('Hiệu lực trong 15 phút.')}</small>
            <button type="button" className="btn sm" disabled={busy} onClick={handleResend} style={{ background: 'none', border: 'none', color: '#173c32', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
              {t('Gửi lại mã OTP')}
            </button>
          </div>
        </>
      ) : mode === 'activate' ? (
        <label>
          {t('Mã kích hoạt')}
          <input required value={values.token} onChange={e => set('token', e.target.value)} />
        </label>
      ) : (
        <label>
          Email
          <input type="email" autoComplete="username" required maxLength={254} value={values.email} onChange={e => set('email', e.target.value)} />
        </label>
      )}

      {mode !== 'activate-otp' && (
        <label>
          {t('Mật khẩu')}
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'login' ? undefined : 8}
            maxLength={128}
            value={values.password}
            onChange={e => set('password', e.target.value)}
          />
        </label>
      )}

      {!['login', 'activate-otp'].includes(mode) && (
        <label>
          {t('Nhập lại mật khẩu')}
          <input type="password" autoComplete="new-password" required value={values.confirm} onChange={e => set('confirm', e.target.value)} />
        </label>
      )}

      {error && <div className="gx-error" role="alert">{t(error)}</div>}

      <Action type="submit" disabled={busy}>
        {t(
          busy
            ? 'Đang xử lý…'
            : mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Xác nhận kích hoạt'
            : 'Lưu mật khẩu & tiếp tục'
        )}
      </Action>

      <div className="gx-actions">
        {mode === 'activate-otp' ? (
          <>
            <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
              {t('Đã kích hoạt? Đăng nhập')}
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
              {t('Đăng ký lại')}
            </button>
          </>
        ) : (
          ['login', 'register', 'activate']
            .filter(m => m !== mode)
            .map(m => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setSuccess('');
                }}
              >
                {t(m === 'login' ? 'Đăng nhập' : m === 'register' ? 'Đăng ký' : 'Quên mật khẩu / Có mã kích hoạt')}
              </button>
            ))
        )}
      </div>

      {mode === 'activate' && <p>{t('Liên hệ quầy để xác minh và nhận mã đặt lại mật khẩu.')}</p>}
    </form>
  );
}
```

#### File: `frontend/src/guest/Booking.jsx`
```jsx
import React, {useState, useEffect, useRef} from 'react';
import {ArrowUpRight, ArrowRight, Clock, UserRound, RotateCcw, Check, Plus, Tag} from 'lucide-react';
import {api} from '../services/api';
import {useGuest, Action, Empty, money, time, dateToday, zone, requestId} from './context';
import {toMinutes, clock, rangeSlots, canEndAt, timePoints} from './bookingTime.mjs';
import CourtMap from './CourtMap';

export default function Booking() {
  const {t, lang, data, date, setDate, user, login, preferredZone, setPreferredZone, refresh, navigate, pay, moveOrder, setMoveOrder, notify} = useGuest();
  const [courtId, setCourtId] = useState('');
  const [courtRanges, setCourtRanges] = useState({});
  const [hover, setHover] = useState(null);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [wantReferee, setWantReferee] = useState(false), [refStart, setRefStart] = useState(''), [refEnd, setRefEnd] = useState(''), [refId, setRefId] = useState('');
  const [options, setOptions] = useState(null);
  const [preview, setPreview] = useState(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [publicVouchers, setPublicVouchers] = useState([]);
  const req = useRef(requestId());

  useEffect(() => {
    api('/public/vouchers').then(setPublicVouchers).catch(() => {});
  }, []);

  const allCourts = data?.courts || [];
  const courts = preferredZone === 'ALL' ? allCourts : allCourts.filter(c => zone(c) === preferredZone);
  const court = courts.find(c => c.id === courtId) || courts.find(c => zone(c) === preferredZone && c.status === 'ACTIVE') || courts[0];

  const currentRange = (court && courtRanges[court.id]) || {start: null, end: null, phase: 'start', valid: false, rangeLabel: '', slots: []};
  const {start, end, phase, valid, rangeLabel} = currentRange;

  const rowsFor = c => (data?.schedules || []).filter(s => s.court === c?.id && s.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const rows = rowsFor(court);
  const ownIds = new Set(moveOrder?.slots?.map(s => s.id) || []);
  const available = s => (s.status === 'AVAILABLE' || ownIds.has(s.id)) && Date.parse(`${date}T${s.start}+07:00`) > Date.now();

  const resetAll = () => {
    setCourtRanges({});
    setHover(null);
    setRefId('');
    setOptions(null);
    setPreview(null);
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setError('');
  };

  const resetCurrentCourt = () => {
    if (!court) return;
    setCourtRanges(prev => {
      const copy = {...prev};
      delete copy[court.id];
      return copy;
    });
    setHover(null);
    setError('');
  };

  useEffect(() => {
    resetAll();
  }, [date, moveOrder?.id]);

  useEffect(() => {
    setCourtId('');
  }, [preferredZone]);

  const allChosen = Object.values(courtRanges).flatMap(v => (v.valid ? v.slots : []));
  const signature = allChosen.map(s => s.id).sort().join(',');

  useEffect(() => {
    setPreview(null);
  }, [signature, refId, refStart, refEnd, wantReferee]);

  useEffect(() => {
    setRefStart(start === null ? '' : clock(start));
    setRefEnd(end === null ? '' : clock(end));
    setRefId('');
    req.current = requestId();
  }, [start, end, court?.id, date]);

  useEffect(() => {
    let live = true;
    setOptions(null);
    if (allChosen.length > 0 && user) {
      api('/booking/options', 'POST', {
        scheduleIds: allChosen.map(s => s.id),
        voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
        ...(moveOrder ? {excludeId: moveOrder.id} : {})
      })
        .then(x => { if (live) { setOptions(x); setError(''); } })
        .catch(e => { if (live) setError(e.message); });
    }
    return () => { live = false; };
  }, [signature, allChosen.length, user?.id, moveOrder?.id, appliedVoucher?.code]);

  const checkMultiCourtGap = (minuteStart, minuteEnd) => {
    const otherCourts = Object.entries(courtRanges).filter(([cid, val]) => cid !== court?.id && val.valid);
    if (!otherCourts.length) return true;
    for (const [_, other] of otherCourts) {
      const overlap = !(minuteEnd <= other.start || minuteStart >= other.end);
      if (overlap) return true;
      const gapBefore = minuteStart - other.end;
      const gapAfter = other.start - minuteEnd;
      if ((gapBefore >= 0 && gapBefore <= 30) || (gapAfter >= 0 && gapAfter <= 30)) return true;
    }
    return false;
  };

  const pickTime = minute => {
    setError('');
    setHover(null);
    if (!court) return;

    if (phase === 'end' && start !== null) {
      if (!canEndAt(rows, start, minute, available)) return;
      if (!checkMultiCourtGap(start, minute)) {
        setError(t('Các sân trong cùng đơn phải cùng khung giờ hoặc nối tiếp nhau (không cách quá 30 phút).'));
        return;
      }
      const slots = rangeSlots(rows, start, minute);
      setCourtRanges(prev => ({
        ...prev,
        [court.id]: {
          courtId: court.id,
          start,
          end: minute,
          phase: 'start',
          valid: true,
          rangeLabel: `${clock(start)}–${clock(minute)}`,
          slots
        }
      }));
    } else {
      const otherValidCourts = Object.entries(courtRanges).filter(([cid, val]) => cid !== court.id && val.valid);
      if (otherValidCourts.length >= 3) {
        setError(t('Tối đa 3 sân trong cùng một đơn đặt.'));
        return;
      }
      if (!rows.some(s => toMinutes(s.start) === minute && available(s))) return;
      setCourtRanges(prev => ({
        ...prev,
        [court.id]: {
          courtId: court.id,
          start: minute,
          end: null,
          phase: 'end',
          valid: false,
          rangeLabel: '',
          slots: []
        }
      }));
    }
  };

  const refSlots = (currentRange.slots || []).filter(s => refStart && refEnd && toMinutes(s.start) >= toMinutes(refStart) && toMinutes(s.end) <= toMinutes(refEnd));
  const refValid = refSlots.length > 0 && time(refSlots[0].start) === refStart && time(refSlots.at(-1).end) === refEnd;
  const people = refValid && options ? (options.staffSlots?.find(s => s.scheduleId === refSlots[0]?.id)?.staff || [])
    .filter(p => refSlots.every(s => options.staffSlots.find(x => x.scheduleId === s.id)?.staff.some(x => x.id === p.id && x.available))) : [];
  const referee = wantReferee ? people.find(p => p.id === refId) : null;
  const refFee = referee ? (toMinutes(refEnd) - toMinutes(refStart)) * referee.rate / 60 : 0;

  const gross = allChosen.reduce((sum, s) => sum + s.price, 0);
  const discount = options?.courtQuote?.discount ?? 0;
  const baseCourtNet = options?.courtQuote?.net ?? Math.max(0, gross - discount);
  const voucherDiscount = appliedVoucher ? appliedVoucher.discount : 0;
  const net = Math.max(0, baseCourtNet - voucherDiscount);
  const totalAmount = net + refFee;
  const depositAmount = Math.round(net / 2);
  const displayDate = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', {weekday: 'short', day: '2-digit', month: '2-digit'}).format(new Date(date + 'T12:00:00'));

  const applyVoucher = async (codeToUse) => {
    const code = (codeToUse || voucherInput).trim().toUpperCase();
    if (!code) return;
    if (!gross) {
      setVoucherError(t('Vui lòng chọn giờ chơi trước khi áp dụng voucher.'));
      return;
    }
    setVoucherBusy(true);
    setVoucherError('');
    try {
      const res = await api('/public/vouchers/validate', 'POST', { code, amount: gross });
      setAppliedVoucher(res);
      setVoucherInput(code);
    } catch (e) {
      setVoucherError(e.message);
    } finally {
      setVoucherBusy(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
  };

  const selectedCourtEntries = Object.entries(courtRanges)
    .filter(([_, v]) => v.valid && v.slots?.length > 0)
    .map(([cid, v]) => ({
      court: data?.courts?.find(c => c.id === cid) || court,
      ...v
    }));

  const ready = allChosen.length > 0 && !saving && (!user || !!options) && !options?.conflicts?.length && (!wantReferee || !!referee);
  const previewEnd = phase === 'end' && hover !== null && canEndAt(rows, start, hover, available) ? hover : null;
  const instruction = phase === 'end'
    ? t('Chọn mốc kết thúc cho sân này.')
    : valid
    ? t('Đã chọn giờ sân này. Bạn có thể bấm sân khác trên bản đồ để chọn thêm sân vào đơn.')
    : t('Nhấn một mốc giờ để bắt đầu.');

  const submit = async () => {
    if (!user) { login(); return; }
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      const assignments = referee ? refSlots.map(s => ({scheduleId: s.id, staffId: referee.id})) : [];
      if (moveOrder) {
        if (!preview) {
          const result = await api(`/orders/${moveOrder.id}/preview`, 'POST', {scheduleIds: allChosen.map(s => s.id), assignments});
          setPreview(result);
          return;
        }
        await api(`/orders/${moveOrder.id}/schedule`, 'PATCH', {
          scheduleIds: allChosen.map(s => s.id),
          assignments,
          reason: 'Khách đổi lịch',
          expectedTotal: preview.next.total,
          requestId: req.current
        });
        setMoveOrder(null);
        navigate('orders');
        notify(t('Đã đổi lịch'));
        await refresh();
      } else {
        const result = await api('/orders', 'POST', {
          name: user.name,
          phone: '',
          accountId: user.id,
          scheduleIds: allChosen.map(s => s.id),
          assignments,
          voucherCode: appliedVoucher?.code || undefined,
          requestId: req.current
        });
        resetAll();
        navigate('orders');
        await refresh();
        await pay('ORDER', result.id);
      }
    } catch (e) {
      setError(e.message);
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ct-pad gx-booking">
      <header className="gx-booking-heading">
        <div>
          <span className="ct-eyebrow">COURTLY / {t('ĐẶT SÂN')}</span>
          <h1>{t('Chọn sân. Hẹn giờ chơi.')}</h1>
          <p>{t('Một buổi tennis, bắt đầu bằng một cuộc hẹn. Có thể đặt nhiều sân trong cùng 1 đơn.')}</p>
        </div>
        <span className="gx-opening"><Clock size={16}/> 06:00–23:00 · {t('Mỗi ngày')}</span>
      </header>

      {moveOrder && (
        <div className="gx-notice">
          {t('Đang đổi lịch đơn')} #{moveOrder.id.slice(0, 8)}{' '}
          <button onClick={() => setMoveOrder(null)}>{t('Bỏ đổi lịch')}</button>
        </div>
      )}

      <div className="gx-date-bar">
        <label>
          {t('Ngày chơi')}
          <input
            aria-label={t('Ngày chơi')}
            type="date"
            min={dateToday()}
            max={new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}
            value={date}
            onChange={e => {
              if (e.target.value) {
                resetAll();
                setDate(e.target.value);
              }
            }}
          />
        </label>
        <p><Clock size={16}/>{t('Chọn theo mốc 30 phút. Giá hiển thị theo giờ.')}</p>
      </div>

      <label className="gx-zone-filter">
        {t('Loại sân')}
        <select
          aria-label={t('Loại sân')}
          value={preferredZone}
          onChange={e => {
            setPreferredZone(e.target.value);
            setCourtId('');
          }}
        >
          {[['ALL', 'Tất cả'], ['A', 'Ngoài trời'], ['B', 'Trong nhà'], ['V', 'VIP']].map(([id, label]) => (
            <option key={id} value={id}>{t(label)}</option>
          ))}
        </select>
      </label>

      {/* CourtMap: Hiển thị trạng thái của từng sân, sân nào đã chọn sẽ có viền xanh + nhãn giờ */}
      <CourtMap
        courts={courts}
        selected={court}
        courtSelections={courtRanges}
        onSelect={c => {
          setCourtId(c.id);
          setError('');
        }}
        rangeLabel={rangeLabel}
        availability={c => {
          const sel = courtRanges[c.id];
          return sel && sel.valid ? true : canEndAt(rowsFor(c), start, end, available);
        }}
      />

      <div className="gx-book-layout">
        <section className="gx-play-panel" aria-labelledby="guest-time-title">
          <div className="gx-block-heading">
            <div>
              <span className="gx-step">02</span>
              <h2 id="guest-time-title">{t('Chọn giờ chơi')}</h2>
            </div>
            <span>{t('Mỗi mốc 30 phút')}</span>
          </div>

          {selectedCourtEntries.length > 0 && selectedCourtEntries.length < 3 && !moveOrder && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              fontSize: 13,
              color: '#1e40af'
            }}>
              <span>
                💡 <b>Đặt nhiều sân:</b> Đang có {selectedCourtEntries.length} sân trong đơn. Bạn có thể chạm vào sân khác trên bản đồ phía trên để chọn thêm giờ.
              </span>
            </div>
          )}

          <div className="gx-selected-court">
            <img
              src={court?.imageUrl || `/guest/zone-${zone(court).toLowerCase()}-${zone(court) === 'A' ? 'outdoor' : zone(court) === 'B' ? 'indoor' : 'lounge'}.webp`}
              alt=""
            />
            <div>
              <span>{t('Khu')} {zone(court)} · {t(zone(court) === 'A' ? 'Ngoài trời' : zone(court) === 'B' ? 'Trong nhà' : 'VIP')}</span>
              <h3>{court?.name || t('Chọn sân')}</h3>
              <p>{displayDate}</p>
            </div>
            <strong>{money(court?.price)}<small>/ {t('giờ')}</small></strong>
          </div>

          <div className="gx-range-head">
            <button
              type="button"
              aria-label={t('Giờ bắt đầu')}
              aria-pressed={phase === 'start' && end === null}
              onClick={resetCurrentCourt}
            >
              <span>01 · {t('Giờ bắt đầu')}</span>
              <strong data-range-start>{start === null ? '— — : — —' : clock(start)}</strong>
            </button>
            <ArrowRight aria-hidden="true"/>
            <button
              type="button"
              aria-label={t('Giờ kết thúc')}
              aria-pressed={phase === 'end'}
              disabled={start === null}
              onClick={() => {
                if (court) {
                  setCourtRanges(prev => ({
                    ...prev,
                    [court.id]: {
                      ...prev[court.id],
                      end: null,
                      phase: 'end',
                      valid: false
                    }
                  }));
                }
              }}
            >
              <span>02 · {t('Giờ kết thúc')}</span>
              <strong data-range-end>{end === null ? '— — : — —' : clock(end)}</strong>
            </button>
            <button
              type="button"
              className="gx-range-reset"
              aria-label={t('Chọn lại giờ')}
              onClick={resetCurrentCourt}
            >
              <RotateCcw size={17}/>
              <span>{t('Chọn lại')}</span>
            </button>
          </div>

          <p className="gx-time-instruction" role="status" aria-live="polite">
            <span className={valid ? 'gx-complete-dot' : ''}/>
            {instruction}
          </p>

          <div className="gx-time-grid" aria-label={t('Mốc giờ chơi')} onMouseLeave={() => setHover(null)}>
            {timePoints(rows).map(minute => {
              const enabled = court?.status === 'ACTIVE' && (phase === 'end' ? canEndAt(rows, start, minute, available) : rows.some(s => toMinutes(s.start) === minute && available(s)));
              const first = minute === start, last = minute === end, between = valid && minute > start && minute < end;
              const preview = previewEnd !== null && minute > start && minute <= previewEnd;
              const label = first ? 'Bắt đầu' : last ? 'Kết thúc' : phase === 'end' ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu';
              return (
                <button
                  key={minute}
                  type="button"
                  data-time={clock(minute)}
                  disabled={!enabled}
                  aria-pressed={first || last || between}
                  aria-label={`${clock(minute)} · ${t(label)}`}
                  className={[first ? 'gx-time-start' : '', last ? 'gx-time-end' : '', between ? 'gx-time-between' : '', preview ? 'gx-time-preview' : ''].join(' ')}
                  onMouseEnter={() => setHover(minute)}
                  onFocus={() => setHover(minute)}
                  onBlur={() => setHover(null)}
                  onClick={() => pickTime(minute)}
                >
                  <strong>{clock(minute)}</strong>
                  <small>{first ? t('Bắt đầu') : last ? t('Kết thúc') : between ? t('Đã chọn') : !enabled && phase === 'start' && minute !== 1380 ? t('Không khả dụng') : '\u00a0'}</small>
                </button>
              );
            })}
          </div>

          {!rows.length && <Empty>{t('Chưa có lịch sân cho ngày này.')}</Empty>}
          <div className="gx-time-legend">
            <span><i/>{t('Còn trống')}</span>
            <span><i className="gx-legend-busy"/>{t('Không khả dụng')}</span>
            <span><i className="gx-legend-range"/>{t('Khoảng đã chọn')}</span>
          </div>

          <p className="gx-range-help">{t('Nhấn lần đầu để chọn giờ bắt đầu, lần sau để chọn giờ kết thúc. Có thể chọn tối đa 3 sân trên bản đồ để gộp chung đơn.')}</p>

          {/* Dịch vụ trọng tài */}
          <section className="gx-referee-section">
            <label className="gx-referee-toggle">
              <input
                type="checkbox"
                checked={wantReferee}
                disabled={!valid}
                onChange={e => {
                  setWantReferee(e.target.checked);
                  setRefId('');
                  req.current = requestId();
                }}
              />
              <UserRound aria-hidden="true"/>
              <span>
                <strong>{t('Thêm trọng tài')}</strong>
                <small>{t(valid ? 'Chọn người hỗ trợ trong khoảng giờ sân này.' : 'Chọn đủ giờ chơi để xem trọng tài.')}</small>
              </span>
              <span className="gx-optional">{t('Không bắt buộc')}</span>
            </label>

            {wantReferee && valid && (!user ? (
              <Action secondary onClick={login}>{t('Đăng nhập để xem trọng tài')}</Action>
            ) : !options ? (
              <p role="status">{t('Đang tải dữ liệu…')}</p>
            ) : (
              <div className="gx-referee-panel">
                <div className="gx-time-select">
                  <label>
                    {t('Từ giờ')}
                    <select
                      aria-label={t('Từ giờ')}
                      value={refStart}
                      onChange={e => {
                        setRefStart(e.target.value);
                        if (toMinutes(refEnd) <= toMinutes(e.target.value)) setRefEnd(clock(end));
                        setRefId('');
                      }}
                    >
                      {currentRange.slots?.map(s => (
                        <option key={s.id} value={time(s.start)}>{time(s.start)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Đến giờ')}
                    <select
                      aria-label={t('Đến giờ')}
                      value={refEnd}
                      onChange={e => {
                        setRefEnd(e.target.value);
                        setRefId('');
                      }}
                    >
                      {currentRange.slots?.filter(s => toMinutes(s.end) > toMinutes(refStart)).map(s => (
                        <option key={s.id} value={time(s.end)}>{time(s.end)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="gx-referees">
                  {people.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={refId === p.id ? 'gx-selected gx-ref-card' : 'gx-ref-card'}
                      aria-pressed={refId === p.id}
                      onClick={() => {
                        setRefId(p.id);
                        req.current = requestId();
                      }}
                    >
                      <div className="gx-ref-top">
                        <span className="gx-ref-avatar"><UserRound size={20}/></span>
                        <div className="gx-ref-meta">
                          <strong>{p.name}</strong>
                          <span className="gx-ref-badge">{p.level?.split('·')?.[0]?.trim() || t('Trọng tài CLB')}</span>
                        </div>
                      </div>
                      <p className="gx-ref-desc">{p.level?.split('·')?.slice(1)?.join('·')?.trim() || t('Đạt chuẩn điều hành thi đấu')}</p>
                      <div className="gx-ref-foot">
                        <b className="gx-ref-rate">{money(p.rate)} <small>/ {t('giờ')}</small></b>
                        {refId === p.id ? <span className="gx-ref-chosen"><Check size={16}/> {t('Đã chọn')}</span> : <span className="gx-ref-pick">{t('Chọn')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                {referee && (
                  <div className="gx-notice" style={{marginTop: 14, background: '#f2f8eb', borderColor: '#b5d3a6'}}>
                    ✓ {t('Đã chọn')} <b>{referee.name}</b>. {t('Trọng tài sẽ có mặt trước giờ bắt đầu 10 phút để kiểm tra sân, lưới và phổ biến điều lệ thi đấu.')}
                  </div>
                )}
                {!people.length && <Empty>{t('Không có trọng tài rảnh toàn khoảng này. Hãy đổi giờ hoặc bỏ dịch vụ.')}</Empty>}
              </div>
            ))}
          </section>
        </section>

        {/* CỘT TỔNG KẾT ĐƠN HÀNG */}
        <aside className="gx-quote" aria-label={t('Chi phí buổi chơi')}>
          <span className="ct-eyebrow">{t('BUỔI CHƠI CỦA BẠN')}</span>
          <h2>{selectedCourtEntries.length > 1 ? `${selectedCourtEntries.length} ${t('sân trong đơn')} · Courtly` : court?.name || 'Courtly'}</h2>
          <p className="gx-quote-date">{displayDate}</p>

          {/* DANH SÁCH TẤT CẢ CÁC SÂN ĐANG CHỌN */}
          {selectedCourtEntries.length > 0 && (
            <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 14}}>
              <div style={{fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span>{t('CÁC SÂN TRONG ĐƠN')} ({selectedCourtEntries.length}/3)</span>
                {selectedCourtEntries.length > 1 && (
                  <span style={{fontSize: 11, color: '#16a34a', fontWeight: 600}}>✓ {t('Gộp chung 1 đơn')}</span>
                )}
              </div>
              {selectedCourtEntries.map(sc => (
                <div
                  key={sc.court.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px dashed #e2e8f0'
                  }}
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setCourtId(sc.court.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontWeight: sc.court.id === court?.id ? 700 : 600,
                        color: sc.court.id === court?.id ? '#173c32' : '#334155',
                        fontSize: 13,
                        textAlign: 'left'
                      }}
                    >
                      {sc.court.name} {sc.court.id === court?.id ? `(${t('đang xem')})` : ''}
                    </button>
                    <div style={{fontSize: 11, color: '#64748b'}}>
                      {sc.rangeLabel} ({sc.slots.length * 30} {t('phút')}) · {money(sc.slots.reduce((sum, s) => sum + s.price, 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCourtRanges(prev => {
                        const copy = {...prev};
                        delete copy[sc.court.id];
                        return copy;
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 'bold',
                      padding: '2px 6px'
                    }}
                    title={t('Xóa sân này khỏi đơn')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* SÂN ĐANG CHỌN DỞ */}
          {valid && (
            <div className="gx-quote-range">
              <Clock size={18}/>
              <div>
                <strong>{court.name}: {rangeLabel}</strong>
                <span>{`${end - start} ${t('phút')}`}</span>
              </div>
            </div>
          )}
          {!valid && selectedCourtEntries.length === 0 && (
            <div className="gx-quote-range">
              <Clock size={18}/>
              <div>
                <strong>{t('Chưa chọn giờ')}</strong>
                <span>{t('Chọn giờ bắt đầu và kết thúc')}</span>
              </div>
            </div>
          )}

          {/* KHU VỰC NHẬP VÀ CHỌN VOUCHER */}
          <div className="gx-voucher-box" style={{
            margin: '14px 0',
            padding: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8}}>
              <Tag size={15} color="#173c32"/>
              <span style={{fontSize: 12, fontWeight: 700, color: '#173c32', textTransform: 'uppercase', letterSpacing: '0.04em'}}>
                {t('Mã ưu đãi / Voucher')}
              </span>
            </div>

            {!appliedVoucher ? (
              <>
                <div style={{display: 'flex', gap: 6}}>
                  <input
                    type="text"
                    aria-label={t('Mã voucher')}
                    placeholder={t('VD: WELCOME, HE2026...')}
                    value={voucherInput}
                    onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyVoucher(); } }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}
                  />
                  <button
                    type="button"
                    disabled={voucherBusy || !voucherInput.trim()}
                    onClick={() => applyVoucher()}
                    style={{
                      background: '#173c32',
                      color: '#def46a',
                      border: 'none',
                      padding: '0 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: voucherBusy || !voucherInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: voucherBusy || !voucherInput.trim() ? 0.6 : 1
                    }}
                  >
                    {voucherBusy ? '…' : t('Áp dụng')}
                  </button>
                </div>

                {/* Dynamic Quick chips from API */}
                {((options?.availableVouchers?.length ? options.availableVouchers : publicVouchers) || []).length > 0 && (
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8}}>
                    {((options?.availableVouchers?.length ? options.availableVouchers : publicVouchers) || []).map(vc => (
                      <button
                        key={vc.code}
                        type="button"
                        onClick={() => applyVoucher(vc.code)}
                        title={vc.description}
                        style={{
                          background: '#edf2e8',
                          border: '1px solid #cbd2c2',
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#173c32',
                          cursor: 'pointer'
                        }}
                      >
                        +{vc.code}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '8px 10px'
              }}>
                <div>
                  <div style={{fontWeight: 700, fontSize: 13, color: '#16a34a'}}>
                    ✓ {appliedVoucher.code} (−{money(appliedVoucher.discount)})
                  </div>
                  <div style={{fontSize: 11, color: '#15803d'}}>
                    {appliedVoucher.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeVoucher}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  ✕ {t('Gỡ')}
                </button>
              </div>
            )}

            {voucherError && (
              <div style={{color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 6}}>
                ⚠️ {voucherError}
              </div>
            )}
          </div>

          <dl>
            <div>
              <dt>{t('Tiền sân')} ({allChosen.length * 30} {t('phút')})</dt>
              <dd>{money(gross)}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>{t('Ưu đãi hội viên')}</dt>
                <dd>−{money(discount)}</dd>
              </div>
            )}
            {appliedVoucher && (
              <div>
                <dt>{t('Voucher')} ({appliedVoucher.code})</dt>
                <dd style={{color: '#16a34a', fontWeight: 700}}>−{money(appliedVoucher.discount)}</dd>
              </div>
            )}
            <div>
              <dt>{t('Trọng tài')}</dt>
              <dd>{money(refFee)}</dd>
            </div>
            <div className="gx-total">
              <dt>{t('Tổng tiền')}</dt>
              <dd>{money(totalAmount)}</dd>
            </div>
          </dl>

          <div className="gx-deposit">
            <div>
              <span>{t('Cọc 50% tiền sân')}</span>
              <strong>{money(depositAmount)}</strong>
            </div>
            <p>{t('Phí trọng tài nằm trong phần thanh toán còn lại.')}</p>
          </div>

          {preview && (
            <div className="gx-notice" role="status">
              <h3>{t('Xem trước đổi lịch')}</h3>
              <p>{t('Tổng cũ')}: {money(preview.previous.total)} → {t('Tổng mới')}: {money(preview.next.total)}</p>
              <p>{t('Chênh lệch')}: {money(preview.difference)}</p>
              <p>{t('Còn thanh toán')}: {money(preview.additionalDue)}</p>
              <p>{t('Chờ hoàn / đối soát')}: {money(preview.reviewAmount)}</p>
            </div>
          )}

          {!user && (
            <p className="gx-notice">{t('Đăng nhập để tạo đơn gắn với tài khoản của bạn. Lựa chọn hiện tại được giữ khi đăng nhập.')}</p>
          )}

          {error && <div className="gx-error" role="alert">{t(error)}</div>}

          <Action disabled={!ready} onClick={submit}>
            {t(saving ? 'Đang xử lý…' : !user ? 'Đăng nhập để đặt sân' : moveOrder ? (preview ? 'Xác nhận đổi lịch' : 'Xem trước đổi lịch') : 'Tiếp tục thanh toán')}
            <ArrowUpRight size={18}/>
          </Action>
          <p className="gx-quote-note">
            {t('Lựa chọn chưa giữ chỗ. Sân được kiểm tra lại khi tạo đơn.')} {t('Thời gian giữ chỗ')}: {data?.settings?.holdMinutes ?? 5} {t('phút')}.{' '}
            <button onClick={() => navigate('pricing')}>{t('Bảng giá & chính sách')}</button>
          </p>
        </aside>
      </div>
    </div>
  );
}
```

#### File: `frontend/src/guest/CashDesk.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {api} from '../services/api';
import {useGuest,Action,Empty,State,money,requestId} from './context';

export default function CashDesk(){
 const {t,user}=useGuest();const [rows,setRows]=useState([]),[selected,setSelected]=useState(''),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
 const [transaction,setTransaction]=useState(requestId);
 const allowed=['ADMIN','STAFF'].includes(user?.role);
 const load=()=>api('/payments/cash-desk').then(setRows);
 useEffect(()=>{if(allowed)load().catch(e=>setError(e.message))},[allowed]);
 const order=rows.find(o=>o.id===selected);
 const submit=async e=>{
  e.preventDefault();if(!order)return;setBusy(true);setError('');
  try{const r=await api('/payments','POST',{orderId:order.id,amount:Number(amount),method:'CASH',transactionCode:transaction});setReceipt(r.id);setSelected('');setAmount('');setTransaction(requestId());await load()}catch(e){setError(e.message)}finally{setBusy(false)}
 };
 if(!allowed)return <section className="ct-pad"><h1>{t('Thu tiền tại quầy')}</h1><Empty>{t('Chỉ nhân viên thu ngân và quản trị được truy cập.')}</Empty></section>;
 return <section className="ct-pad"><div className="gx-heading"><h1>{t('Thu tiền mặt tại quầy')}</h1><p>{t('Chỉ xác nhận sau khi đã nhận đủ số tiền nhập bên dưới. Chuyển khoản do ngân hàng xác minh tự động.')}</p></div><form className="gx-form" onSubmit={submit}><label>{t('Chọn đơn')}<select aria-label={t('Chọn đơn')} required value={selected} onChange={e=>{const o=rows.find(x=>x.id===e.target.value);setSelected(e.target.value);setAmount(o?Math.min(o.due,Math.max(0,o.deposit-o.paid)||o.due):'');setTransaction(requestId());setReceipt('')}}><option value="">{t('Chọn đơn cần thu')}</option>{rows.map(o=><option key={o.id} value={o.id}>#{o.id.slice(0,8)} · {o.name} · {money(o.due)}</option>)}</select></label>{order&&<p><State value={order.status}/> · {t('Đã thu')}: {money(order.paid)} · {t('Còn thiếu')}: {money(order.due)}</p>}<label>{t('Số tiền mặt thực nhận (VND)')}<input required type="number" min="1" step="1" max={order?.due} value={amount} onChange={e=>{setAmount(e.target.value);setTransaction(requestId())}}/></label><label className="gx-check"><input required type="checkbox" key={selected+transaction}/>{t('Tôi đã nhận tiền mặt và kiểm tra đúng đơn, đúng số tiền.')}</label>{error&&<div className="gx-error" role="alert">{t(error)}</div>}{receipt&&<p role="status">{t('Đã ghi nhận phiếu thu')}: {receipt}</p>}<Action type="submit" disabled={busy||!order}>{t(busy?'Đang xử lý…':'Xác nhận tiền mặt đã thu')}</Action><Action secondary disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>{t('Làm mới')}</Action></form></section>;
}
```

#### File: `frontend/src/guest/CourtMap.jsx`
```jsx
import React from 'react';
import {Sun, House, Crown, Check, Construction} from 'lucide-react';
import {useGuest, money, zone} from './context';

const zones = [
  {id:'A', name:'Ngoài trời', style:'outdoor', Icon:Sun},
  {id:'B', name:'Trong nhà', style:'indoor', Icon:House},
  {id:'V', name:'VIP', style:'vip', Icon:Crown},
];

export default function CourtMap({courts, selected, onSelect, availability, rangeLabel, courtSelections = {}}) {
  const {t} = useGuest();
  return <section className="gx-map-section" aria-labelledby="guest-court-map-title">
    <div className="gx-block-heading">
      <div>
        <span className="gx-step">01</span>
        <h2 id="guest-court-map-title">{t('Chọn sân của bạn')}</h2>
      </div>
      <span>{rangeLabel || t('Chạm vào sân để xem hoặc chọn giờ')}</span>
    </div>
    <div className="dg-board" aria-label={t('Bản đồ sân')}>
      {zones.filter(z=>courts.some(c=>zone(c)===z.id)).map(({id, name, style, Icon}) => {
        const items = courts.filter(court => zone(court) === id);
        return <section className={`dg-zone dg-${style}`} key={id} aria-label={`${t('Khu')} ${id} · ${t(name)}`}>
          <div className="dg-zone-head"><Icon aria-hidden="true"/><div><h3>{t(name)}</h3><span>{t('Khu')} {id} · {items.length} {t('sân')}</span></div></div>
          <div className="dg-zone-courts">{items.map(court => {
            const maintenance = court.status !== 'ACTIVE';
            const busy = !maintenance && availability(court) === false;
            const chosen = court.id === selected?.id;
            const courtSel = courtSelections[court.id];
            const hasRange = Boolean(courtSel && courtSel.valid);
            const status = maintenance ? 'Bảo trì' : hasRange ? `✓ ${courtSel.rangeLabel}` : busy ? 'Bận trong giờ đã chọn' : chosen ? 'Đang xem' : rangeLabel ? 'Còn trống' : 'Xem lịch';
            return <button key={court.id} type="button" data-court-id={court.name} aria-pressed={chosen || hasRange}
              aria-label={`${court.name} · ${t(name)} · ${t(status)} · ${money(court.price)} / ${t('giờ')}`}
              className={`dg-court ${maintenance ? 'gm-maintenance' : busy ? 'gm-busy' : ''} ${chosen ? 'chosen' : ''}`}
              style={hasRange ? {borderColor: '#16a34a', background: '#f0fdf4', boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.2)'} : {}}
              disabled={maintenance} onClick={() => onSelect(court)}>
              <span className="dg-art" aria-hidden="true">
                {id === 'A' && <><span className="dg-fence"/><span className="dg-light dg-light-left"/><span className="dg-light dg-light-right"/></>}
                {id === 'B' && <><span className="dg-building"/><span className="dg-roof"/></>}
                {id === 'V' && <><span className="dg-vip-frame"/><span className="dg-crown"><Crown/></span></>}
                <span className="dg-field"><span className="dg-service"/><span className="dg-net"/></span>
                <span className="dg-maintenance-mark"><Construction/></span>
                <span className="dg-selected" style={hasRange ? {display: 'flex', background: '#16a34a', color: '#fff'} : {}}><Check/></span>
              </span>
              <span className="dg-court-caption">
                <strong className="dg-court-id">{court.name}</strong>
                <span className="gm-court-state" style={hasRange ? {color: '#15803d', fontWeight: 700} : {}}>{t(status)}</span>
              </span>
              <span className="gx-map-price">{money(court.price)} <span>/ {t('giờ')}</span></span>
            </button>;
          })}</div>
          {!items.length && <p className="gx-map-empty">{t('Chưa có sân trong khu này.')}</p>}
        </section>;
      })}
    </div>
    <p className="gx-map-note">{t('Chạm vào từng sân để chọn giờ. Có thể chọn tối đa 3 sân cùng lúc trong cùng một đơn đặt.')}</p>
  </section>;
}
```

#### File: `frontend/src/guest/Overview.jsx`
```jsx
import React from 'react';
import {ArrowUpRight,ArrowDown,Armchair,Coffee,ShowerHead,SquareParking,Dumbbell,ClipboardCheck,Sparkles} from 'lucide-react';
import tree from './overview.json';
import {useGuest,Action,dateToday,zone} from './context';
import {EventCards} from './Tournaments';
const icons={'arrow-up-right':ArrowUpRight,'arrow-down':ArrowDown,armchair:Armchair,coffee:Coffee,'shower-head':ShowerHead,'square-parking':SquareParking,dumbbell:Dumbbell,'clipboard-check':ClipboardCheck,sparkles:Sparkles};
export default function Overview(){const {t,navigate,date,setDate,setPreferredZone,preferredZone,data}=useGuest();
 const quick=<section className="ct-quick-book"><div className="haus-quick-intro"><span className="ct-eyebrow">LET'S PLAY</span><strong>{t('Trận tiếp theo')}<br/>{t('bắt đầu từ đây.')}</strong></div><label>{t('Ngày chơi')}<input type="date" value={date} min={dateToday()} onChange={e=>e.target.value&&setDate(e.target.value)}/></label><label>{t('Khu sân')}<select onChange={e=>setPreferredZone(e.target.value)} defaultValue="A"><option value="A">{t('Ngoài trời')}</option><option value="B">{t('Trong nhà')}</option><option value="V">VIP</option></select></label><Action onClick={()=>{if(preferredZone==='ALL')setPreferredZone('A');navigate('booking')}}>{t('Tìm giờ trống')}<ArrowUpRight/></Action></section>;
 function render(n,key){if(typeof n==='string')return t(n.trim());const a=n.attrs||{};
 if(a.class==='ct-quick-book')return <React.Fragment key={key}>{quick}</React.Fragment>;
 if('data-overview-events' in a)return <EventCards key={key} events={(data?.tournaments||[]).filter(x=>x.start>=dateToday()&&x.status==='OPEN').slice(0,3)}/>;
 if('data-overview-events-empty' in a)return null;
 if(a.class==='ce-proposal'||a.class==='haus-fine-print')return null;
 if(a['data-lucide']){const I=icons[a['data-lucide']]||ArrowUpRight;return <I key={key} aria-hidden="true"/>;}
 const props={key};for(const [k,v]of Object.entries(a)){if(k==='style'||k==='hidden')continue;if(k==='class')props.className=v;else if(k==='aria-label')props[k]=t(v);else if(k==='src')props[k]=v.replace('assets/images/','/guest/');else props[k]=v===null?'':v;}
 const dest=a['data-page']||a['data-info'];if(dest)props.onClick=()=>navigate(dest==='courts'?'booking':dest==='overview'?'about':dest);
 if(a['data-choose-court'])props.onClick=()=>{setPreferredZone(a['data-choose-court'][0]);navigate('booking')};
 if('data-book-referee'in a)props.onClick=()=>navigate('booking');
 if(a.class==='ce-ref-rate')return <div className="ce-ref-rate" key={key}><strong>{t('Trọng tài theo lịch trống thực tế')}</strong><span>{t('Phí được tính riêng theo khoảng giờ đã chọn.')}</span></div>;
 return React.createElement(n.tag,props,...n.children.map((c,i)=>render(c,key+'-'+i)));}
 return render(tree,'overview');}
```

#### File: `frontend/src/guest/Payments.jsx`
```jsx
import React,{useState,useEffect,useRef} from 'react';
import QRCode from 'qrcode';
import {Copy,CheckCircle2,ArrowRight} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money} from './context';

export function PaymentDialog({intent,onClose}){
  const {t,refresh,notify,navigate}=useGuest();
  const lastStatus=useRef(intent.status);
  const [current,setCurrent]=useState(intent);
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');


  const fallbackVietQrUrl = current.amount && current.reference
    ? `https://img.vietqr.io/image/${current.bankBin || '970422'}-${current.accountNumber || '0345678999'}-compact2.png?amount=${current.amount}&addInfo=${current.reference}&accountName=${encodeURIComponent(current.accountName || 'CLB TENNIS COURTLY')}`
    : null;
  const qrSrc = qr || current.qrImageUrl || fallbackVietQrUrl;

  // Generate standard VietQR QR canvas from EMVCo payload
  useEffect(()=>{
    if(current.qrPayload){
      QRCode.toDataURL(current.qrPayload,{width:320,margin:1,errorCorrectionLevel:'M'})
        .then(setQr)
        .catch(()=>setError(t('Không thể tạo QR. Dùng nội dung chuyển khoản bên dưới.')));
    }
  },[current.qrPayload]);

  // Realtime polling check for bank transaction
  useEffect(()=>{
    let live=true;
    const timer=setInterval(()=>{
      api('/transfers').then(rows=>{
        const found=rows.find(r=>r.id===intent.id);
        if(live&&found){
          setCurrent(found);
          if(found.status!==lastStatus.current){
            lastStatus.current=found.status;
            refresh().catch(()=>{});
          }
        }
      }).catch(()=>{});
    },3000);
    return()=>{live=false;clearInterval(timer)};
  },[intent.id,refresh]);

  const action=async(path,b={})=>{
    setBusy(true);setError('');
    try{
      const updated=await api(`/transfers/${current.id}/${path}`,'POST',b);
      setCurrent(updated);
      await refresh();
      if(updated.status==='CONFIRMED'){
        notify(t('Khoản chuyển đã được xác minh. Vui lòng kiểm tra số dư của đơn.'));
      }
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  };

  const copy=async(text,msg)=>{
    try{
      await navigator.clipboard.writeText(text);
      notify(t(`Đã sao chép ${msg||''}`));
    }catch{
      notify(text);
    }
  };

  const isConfirmed = current.status === 'CONFIRMED';

  if(isConfirmed){
    return (
      <div className="gx-payment" style={{textAlign:'center',padding:'20px 10px'}}>
        <div style={{color:'#173c32',marginBottom:12}}>
          <CheckCircle2 size={54} strokeWidth={2.2} style={{color:'#2e7d32',margin:'0 auto'}}/>
        </div>
        <span className="ct-eyebrow" style={{color:'#2e7d32',letterSpacing:'1px',fontWeight:700}}>
          {t('GIAO DỊCH THÀNH CÔNG')}
        </span>
        <h2 style={{fontSize:24,margin:'8px 0 12px 0',color:'#173c32'}}>
          {t('KHOẢN CHUYỂN ĐÃ XÁC MINH')}
        </h2>
        <p style={{fontSize:13,color:'#555',margin:'0 auto 20px auto',maxWidth:380}}>
          {t('Khoản chuyển đã được xác minh. Xem đơn để biết số dư còn lại và trạng thái lịch đặt.')}
        </p>

        <div style={{background:'#f0f4ec',border:'1px solid #d2dec8',borderRadius:6,padding:'14px 18px',marginBottom:22,textAlign:'left',fontSize:13}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Mã giao dịch')}:</span>
            <b>{current.reference}</b>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Số tiền đã thu')}:</span>
            <b style={{color:'#2e7d32',fontSize:15}}>{money(current.received||current.amount)}</b>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Hình thức')}:</span>
            <span>Chuyển khoản VietQR (Napas 247)</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#666'}}>{t('Trạng thái giao dịch')}:</span>
            <State value={current.status}/>
          </div>
        </div>

        <Action onClick={()=>{onClose();if(navigate)navigate('orders');}}>
          {t('Xem đơn hàng của tôi')} <ArrowRight size={16} style={{display:'inline',verticalAlign:'middle',marginLeft:4}}/>
        </Action>
      </div>
    );
  }

  return (
    <div className="gx-payment">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span className="ct-eyebrow" style={{margin:0}}>
          {t('CHUYỂN KHOẢN VIETQR 24/7')}
        </span>
        <State value={current.status}/>
      </div>

      <p className="gx-notice" style={{fontSize:12.5, lineHeight:1.5, color:'#475569', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'10px 14px', margin:'0 0 12px'}}>
        {t('Vui lòng quét mã VietQR hoặc chuyển khoản đúng nội dung bên dưới. Sau khi ngân hàng xác nhận giao dịch, hệ thống sẽ tự động đối soát và cấp Vé Điện Tử.')}
      </p>
      {/* VietQR Display */}
      <div className="gx-qr" style={{textAlign:'center',margin:'10px 0'}}>
        {qrSrc ? (
          <img
            src={qrSrc}
            width="240"
            height="240"
            alt="Mã VietQR thanh toán"
            style={{borderRadius:8, border:'1px solid #e2e8f0', boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}
          />
        ) : (
          <Empty>{t('Đang tạo mã VietQR...')}</Empty>
        )}
        <div style={{fontSize:11,color:'#666',marginTop:6}}>
          {t('Quét bằng ứng dụng ngân hàng bất kỳ (MB Bank, VCB, BIDV, Techcombank, Momo,...)')}
        </div>
      </div>

      {/* Amount Display */}
      <div style={{textAlign:'center',margin:'12px 0'}}>
        <div style={{fontSize:12,color:'#666'}}>{t('Số tiền thanh toán')}</div>
        <h3 style={{fontSize:24,color:'#173c32',margin:'4px 0'}}>
          {money(current.amount)}
        </h3>
      </div>

      {/* Bank Account Details with Copy */}
      <div style={{background:'#fdfcf8',border:'1px solid #dcdad2',borderRadius:6,padding:'12px 14px',fontSize:12,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Ngân hàng')}:</span>
          <b>{current.bankName || 'MB Bank (Quân Đội)'}</b>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Chủ tài khoản')}:</span>
          <b>{current.accountName || 'CLB TENNIS COURTLY'}</b>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Số tài khoản')}:</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <b style={{fontSize:13,letterSpacing:'.5px'}}>{current.accountNumber || '—'}</b>
            <button type="button" onClick={()=>copy(current.accountNumber||'',t('số tài khoản'))} style={{border:'none',background:'none',cursor:'pointer',padding:2}}>
              <Copy size={13}/>
            </button>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0'}}>
          <span style={{color:'#666'}}>{t('Nội dung chuyển khoản')}:</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <b style={{color:'#b71c1c',fontSize:13}}>{current.reference}</b>
            <button type="button" onClick={()=>copy(current.reference,t('nội dung'))} style={{border:'none',background:'none',cursor:'pointer',padding:2}}>
              <Copy size={13}/>
            </button>
          </div>
        </div>
      </div>

      <div style={{fontSize:11,color:'#777',textAlign:'center',marginBottom:14}}>
        {t('Hết hạn lúc')}: {new Date(current.expiresAt).toLocaleTimeString('vi-VN')} {new Date(current.expiresAt).toLocaleDateString('vi-VN')}
      </div>

      {error&&<div className="gx-error" role="alert" style={{marginBottom:10}}>{t(error)}</div>}

      {/* Realtime Waiting Indicator for Customer */}
      {['PENDING','CHECKING'].includes(current.status)&&(
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '12px 16px',
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: 8,
          marginBottom: 12
        }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#16a34a',
            display: 'inline-block'
          }}/>
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
            {t('Đang lắng nghe biến động số dư từ MB Bank… (Tự động xác nhận)')}
          </span>
        </div>
      )}

      {/* Presentation & Thesis Defense Simulation Tool */}
      {['PENDING','CHECKING'].includes(current.status)&&(
        <details style={{
          background: '#f8fafc',
          border: '1px dashed #94a3b8',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 14,
          textAlign: 'left'
        }}>
          <summary style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            ⚡ {t('Công cụ Demo Hội đồng: Giả lập Ngân hàng gửi Webhook')}
          </summary>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
            <p style={{ margin: '0 0 10px', lineHeight: 1.5 }}>
              {t('Ngoài đời thực, khi khách chuyển tiền, MB Bank sẽ tự động bắn Webhook về endpoint /api/webhooks/sepay. Nhấn nút bên dưới để mô phỏng tín hiệu Webhook ngân hàng bắn về Server:')}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={()=>action('sandbox', { scenario: 'SUCCESS' })}
              style={{
                width: '100%',
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                borderRadius: 6,
                padding: '11px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(23,60,50,0.15)'
              }}
            >
              {busy ? t('Đang phát tín hiệu Webhook…') : `⚡ ${t('Giả lập MB Bank chuyển đủ')} (${money(current.amount)})`}
            </button>
          </div>
        </details>
      )}

      <Action secondary onClick={onClose}>{t('Đóng')}</Action>
    </div>
  );
}

export function PaymentChoice({onChoose}){
 const {t}=useGuest();const [busy,setBusy]=useState(false),[online,setOnline]=useState(null);
 useEffect(()=>{let live=true;api('/public/payment-config').then(c=>{if(live)setOnline(Boolean(c.onlineEnabled&&c.bankConfigured))}).catch(()=>{if(live)setOnline(false)});return()=>{live=false}},[]);
 return <div className="gx-form"><h2>{t('Chọn phương thức thanh toán')}</h2><p>{t('Tiền chỉ được ghi nhận khi nhân viên thu tiền mặt hoặc ngân hàng gửi xác minh chuyển khoản.')}</p><Action disabled={busy||online===false} onClick={async()=>{setBusy(true);try{await onChoose('BANK_TRANSFER')}finally{setBusy(false)}}}>{t('Chuyển khoản VietQR')}</Action>{online===false&&<p>{t('Chuyển khoản hiện chưa khả dụng. Vui lòng thanh toán tại quầy.')}</p>}<Action secondary disabled={busy} onClick={()=>onChoose('CASH')}>{t('Tiền mặt tại quầy')}</Action></div>;
}

export default function Payments(){
  const {t,data,transfers,pay}=useGuest();
  return (
    <section className="ct-pad">
      <div className="gx-heading">
        <span className="ct-eyebrow">COURTLY / {t('TÀI KHOẢN')}</span>
        <h1>{t('Lịch sử thanh toán')}</h1>
        <p>{t('Tiền đã nhận và yêu cầu chuyển khoản được theo dõi riêng biệt, minh bạch.')}</p>
      </div>

      <h2>{t('Yêu cầu thanh toán chuyển khoản')}</h2>
      <div className="gx-records">
        {transfers.map(x=><article key={x.id}>
          <header>
            <b>{x.reference}</b>
            <State value={x.status}/>
          </header>
          <p>{t(x.type)} • {money(x.amount)}</p>
          <p>{t('Đã xác nhận thu')}: {money(x.received)} • {t('Tiền cần đối soát')}: {money(x.reviewAmount)}</p>
          <Action secondary onClick={()=>pay(null,null,null,x)}>{t('Xem mã QR thanh toán')}</Action>
        </article>)}
      </div>
      {!transfers.length&&<Empty/>}

      <h2>{t('Phiếu thu đã xác nhận')}</h2>
      <div className="gx-records">
        {[...(data?.payments||[]),...(data?.membershipPayments||[])]
          .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
          .map(p=><article key={p.id}>
            <header>
              <b>{p.code||p.transactionCode||p.id.slice(0,8)}</b>
              <b>{money(p.amount)}</b>
            </header>
            <p>{t(p.method)} • {new Date(p.createdAt||p.paidAt).toLocaleString('vi-VN')}</p>
            <p>{t('Mã đơn / Giải')}: {(p.orderId||p.registrationId||p.membershipId)?.slice(0,8)} {p.planName||''}</p>
          </article>)}
      </div>
    </section>
  );
}
```

#### File: `frontend/src/guest/Portal.jsx`
```jsx
import React,{useState,useEffect,useCallback,useRef} from 'react';
import {X} from 'lucide-react';
import {api} from '../services/api';
import {GuestContext,translate,dateToday,Action} from './context';
import {Header,Footer} from './Layout';
import Overview from './Overview';
import Booking from './Booking';
import Pricing from './Pricing.jsx';
import CashDesk from './CashDesk';
import Tournaments,{EventDialog} from './Tournaments';
import {News,Article,Contact,Feedback,Policies} from './Content';
import {Orders,CancelDialog,Membership,Profile,TicketDialog,ZaloZnsDialog,ExtendCourtDialog} from './Account';
import Payments,{PaymentDialog,PaymentChoice} from './Payments';
import GuestAuth from './Auth';
import './handoff.css';
import './guest.css';
import './booking.css';
import './header.css';
import './footer.css';
function Modal({children,onClose,title}){const ref=useRef();useEffect(()=>{const old=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector('button,input')?.focus();const handler=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const all=[...ref.current.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus()}}};document.addEventListener('keydown',handler);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handler);old?.focus()}},[]);return <div className="gx-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="gx-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={title}><button className="gx-close" aria-label={title} onClick={onClose}><X/></button>{children}</section></div>}
const paths={about:'/',booking:'/dat-san',pricing:'/bang-gia',cashdesk:'/quay-thu',news:'/tin-tuc',contact:'/lien-he',feedback:'/feedback',tournaments:'/giai-dau',membership:'/membership',orders:'/tai-khoan/don',history:'/tai-khoan/lich',payments:'/tai-khoan/thanh-toan',profile:'/tai-khoan',policies:'/chinh-sach'};
const initialRoute=()=>Object.entries(paths).find(([,p])=>p===location.pathname)?.[0]||({orders:'orders',history:'history',payments:'payments','profile-orders':'orders','profile-history':'history','profile-payments':'payments','profile-membership':'membership',profile:'profile',tournaments:'tournaments'})[location.hash.slice(1)]||'about';
export default function Portal({session,onSession,onLogout}){const [lang,setLang]=useState(()=>localStorage.getItem('courtly-language')||'vi'),[route,setRoute]=useState(initialRoute),[date,setDate]=useState(dateToday),[data,setData]=useState(null),[content,setContent]=useState({}),[transfers,setTransfers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[dialog,setDialog]=useState(null),[auth,setAuth]=useState(false),[preferredZone,setPreferredZone]=useState(()=>new URLSearchParams(location.search).get('khu')||'ALL'),[moveOrder,setMoveOrder]=useState(null),[toast,setToast]=useState(''),[bannerDismissed,setBannerDismissed]=useState(false);const serial=useRef(0),timer=useRef();const user=session?.authenticated?session.user:null;const t=useCallback(s=>translate(lang,s),[lang]);
 const navigate=useCallback(id=>{setRoute(id);history.pushState(null,'',paths[id]||'/');window.scrollTo({top:0,behavior:'instant'})},[]);
 useEffect(()=>{const change=()=>setRoute(initialRoute());window.addEventListener('popstate',change);return()=>window.removeEventListener('popstate',change)},[]);
 useEffect(()=>{localStorage.setItem('courtly-language',lang);document.documentElement.lang=lang},[lang]);
 const notify=useCallback(s=>{clearTimeout(timer.current);setToast(s);timer.current=setTimeout(()=>setToast(''),6000)},[]);
 const refresh=useCallback(async()=>{const id=++serial.current;try{const [d,c,ps]=await Promise.all([api(`${user?'/overview':'/public/overview'}?date=${date}`),api('/public/content'),user?api('/transfers'):Promise.resolve([])]);if(id===serial.current){setData(d);setContent(c);setTransfers(ps);setError('')}}catch(e){if(id===serial.current)setError(e.message);throw e}finally{if(id===serial.current)setLoading(false)}},[date,user?.id]);
 useEffect(()=>{setLoading(true);refresh().catch(()=>{})},[refresh]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const login=()=>setAuth(true),logout=async()=>{try{await onLogout();setData(null);setTransfers([]);setDialog(null);setMoveOrder(null);navigate('about')}catch(e){notify(e.message)}};
 useEffect(()=>{if(route==='booking'&&!user)setAuth(true);},[route,user]);
 const pay=(type,targetId,purpose='DEPOSIT',existing)=>{
  if(!user){login();return;}
  if(existing){setDialog({kind:'payment',intent:existing});return;}
  setDialog({kind:'payment-choice',type,targetId,purpose});
 };
 const choosePayment=async method=>{
  if(method==='CASH'){setDialog(null);notify(t('Vui lòng thanh toán tại quầy trước khi hết hạn giữ chỗ. Nhân viên sẽ xác nhận số tiền thực thu.'));return;}
  try{const x=await api('/transfers','POST',{type:dialog.type,targetId:dialog.targetId,purpose:dialog.purpose});setDialog({kind:'payment',intent:x});refresh().catch(()=>{})}catch(e){notify(e.message)}
 };
 useEffect(()=>{
  if(route!=='booking'&&route!=='orders'&&route!=='history')return;
  const timer=setInterval(()=>refresh().catch(()=>{}),10000);
  return()=>clearInterval(timer);
 },[route,refresh]);
 const value={t,lang,setLang,user,route,navigate,date,setDate,data,content,club:content.club||data?.club||{},transfers,refresh,notify,login,logout,preferredZone,setPreferredZone,moveOrder,setMoveOrder,show:setDialog,pay};
 const protectedRoute=['profile','orders','history','payments','cashdesk'].includes(route);
 const todayMatch = user && !bannerDismissed && data?.orders?.find(o => {
   const oDate = o.date || o.slots?.[0]?.scheduleDate || '';
   return oDate === dateToday() && ['CONFIRMED', 'CHECKED_IN'].includes(o.status);
 });
 return <GuestContext.Provider value={value}><div id="courtly-balanced-amenities" lang={lang}><Header/>{todayMatch&&<aside className="gx-match-reminder-banner" style={{background:'linear-gradient(90deg, #173c32 0%, #1e4d40 100%)',color:'#ffffff',padding:'11px 24px',boxShadow:'0 4px 14px rgba(23,60,50,0.18)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,position:'sticky',top:60,zIndex:90}}><div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:22}}>🎾</span><div><div style={{display:'flex',alignItems:'center',gap:8}}><strong style={{color:'#def46a',fontSize:13,textTransform:'uppercase',letterSpacing:0.5}}>{t('Nhắc lịch thi đấu hôm nay')}</strong><span style={{background:todayMatch.status==='CHECKED_IN'?'#2563eb':'#15803d',color:'#fff',fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:10}}>{todayMatch.status==='CHECKED_IN'?t('● ĐANG TRÊN SÂN'):t('✓ SẴN SÀNG CHECK-IN')}</span></div><span style={{fontSize:13,color:'#e2ebd9',display:'block',marginTop:2}}>{data?.courts?.find(c=>c.id===todayMatch.slots?.[0]?.court)?.name||t('Sân Tennis')} · ⏰ <b>{todayMatch.slots?.[0]?.hour}:00 – {(todayMatch.slots?.at(-1)?.hour||0)+1}:00</b> · {t('Mã vé')}: <b style={{color:'#def46a',fontFamily:'monospace'}}>CT-{todayMatch.id.slice(0,8).toUpperCase()}</b></span></div></div><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>setDialog({kind:'ticket',order:todayMatch})} style={{background:'#def46a',color:'#173c32',border:'none',padding:'7px 14px',borderRadius:6,fontSize:12.5,fontWeight:700,cursor:'pointer'}}>🎫 {t('Mở Vé QR Check-in')}</button><button type="button" onClick={()=>setDialog({kind:'zalo',order:todayMatch})} style={{background:'#0068ff',color:'#ffffff',border:'none',padding:'7px 14px',borderRadius:6,fontSize:12.5,fontWeight:600,cursor:'pointer'}}>💬 {t('Zalo ZNS')}</button>{todayMatch.status==='CHECKED_IN'&&<button type="button" onClick={()=>setDialog({kind:'extend',order:todayMatch})} style={{background:'rgba(255,255,255,0.18)',color:'#ffffff',border:'1px solid rgba(255,255,255,0.35)',padding:'7px 12px',borderRadius:6,fontSize:12.5,fontWeight:600,cursor:'pointer'}}>⚡ {t('Gia hạn')}</button>}<button type="button" onClick={()=>setBannerDismissed(true)} aria-label="Đóng thông báo" style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.7)',fontSize:18,cursor:'pointer',padding:'4px 8px'}}>✕</button></div></aside>}<main>{error&&<div className="gx-error gx-global-error" role="alert">{t(error)} <button onClick={()=>refresh().catch(()=>{})}>{t('Thử lại')}</button></div>}{loading&&!data?<div className="ct-pad" role="status">{t('Đang tải dữ liệu…')}</div>:<>{route==='about'&&<Overview/>}{route==='pricing'&&<Pricing/>}{route==='booking'&&!user?<section className="ct-pad gx-login-required" style={{textAlign:'center',padding:'80px 24px',maxWidth:580,margin:'0 auto'}}><div style={{width:64,height:64,borderRadius:'50%',background:'rgba(23,60,50,0.08)',color:'#173c32',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h1 style={{fontSize:26,fontWeight:700,color:'#173c32',marginBottom:12}}>{t('Đăng nhập để đặt sân trực tuyến')}</h1><p style={{color:'#52655a',fontSize:15,lineHeight:1.6,marginBottom:24}}>{t('Để đảm bảo tính xác thực của lịch đặt và giữ chỗ sân theo thời gian thực, vui lòng đăng nhập hoặc tạo tài khoản Courtly trước khi chọn khung giờ.')}</p><Action onClick={login} style={{padding:'12px 32px',fontSize:15}}>{t('Đăng nhập / Đăng ký ngay')}</Action></section>:<div hidden={route!=='booking'}><Booking/></div>}{protectedRoute&&!user?<section className="ct-pad gx-login-required"><h1>{t('Đăng nhập để xem tài khoản')}</h1><Action onClick={login}>{t('Đăng nhập')}</Action></section>:<>{route==='orders'&&<Orders/>}{route==='history'&&<Orders history/>}{route==='payments'&&<Payments/>}{route==='profile'&&<Profile/>}{route==='cashdesk'&&<CashDesk/>}</>}{route==='membership'&&<Membership/>}{route==='tournaments'&&<Tournaments/>}{route==='news'&&<News/>}{route==='feedback'&&<Feedback/>}{route==='contact'&&<Contact/>}{route==='policies'&&<Policies/>}</>}</main><Footer/>{auth?<Modal title={t('Đóng đăng nhập')} onClose={()=>setAuth(false)}><GuestAuth onSuccess={async s=>{onSession(s);setAuth(false);if(['ADMIN','STAFF'].includes(s.user.role)){location.assign('/app')}}}/> </Modal>:dialog&&<Modal title={t('Đóng')} onClose={()=>setDialog(null)}>{dialog.kind==='ticket'?<TicketDialog order={dialog.order} onClose={()=>setDialog(null)}/>:dialog.kind==='zalo'?<ZaloZnsDialog order={dialog.order} onClose={()=>setDialog(null)}/>:dialog.kind==='extend'?<ExtendCourtDialog order={dialog.order} onClose={()=>setDialog(null)}/>:dialog.kind==='payment-choice'?<PaymentChoice onChoose={choosePayment}/>:dialog.kind==='payment'?<PaymentDialog intent={dialog.intent} onClose={()=>setDialog(null)}/>:dialog.kind==='event'?<EventDialog event={dialog.event} onClose={()=>setDialog(null)}/>:dialog.kind==='article'?<Article article={dialog.article}/>:dialog.kind==='cancel'?<CancelDialog order={dialog.order} onClose={()=>setDialog(null)}/>:null}</Modal>}<div className="gx-toast" role="status" aria-live="polite">{toast&&t(toast)}</div></div></GuestContext.Provider>;
}
```

#### File: `frontend/src/guest/Pricing.jsx`
```jsx
import React, { useState } from 'react';
import { Sun, House, Crown, ArrowUpRight, Zap, Clock, ShieldCheck, CheckCircle2, Ticket, Gift, LogIn, AlertCircle, CreditCard, RefreshCw, Scale } from 'lucide-react';
import { useGuest, Action, Empty, money, zone } from './context';
import { WEEK_DAYS, getCourtMatrix } from './pricing.mjs';

const TABS = [
  { id: 'A', name: 'Sân Ngoài Trời', Icon: Sun, defaultMin: 105000 },
  { id: 'B', name: 'Mái Che Trong Nhà', Icon: House, defaultMin: 135000 },
  { id: 'V', name: 'Sân VIP Clubhouse', Icon: Crown, defaultMin: 200000 }
];

export default function Pricing() {
  const { t, data, setPreferredZone, navigate } = useGuest();
  const [selectedZone, setSelectedZone] = useState('A');
  const [modalCell, setModalCell] = useState(null);

  const settings = data?.settings || {};
  const policies = settings.policies || {};

  // Find courts in the selected zone
  const courtsInZone = (data?.courts || []).filter(c => zone(c) === selectedZone);
  const activeCourt = courtsInZone.find(c => c.status === 'ACTIVE') || courtsInZone[0];

  // Calculate pricing matrix for active court
  const matrix = activeCourt ? getCourtMatrix(activeCourt, data?.prices || []) : [];

  const handleCellClick = (block, dayKey, dayData) => {
    const dayMeta = WEEK_DAYS.find(d => d.key === dayKey);
    const isDiscount = dayData.type === 'flash';
    const origPrice = isDiscount ? Math.round(dayData.price / 0.75) : dayData.price;
    const depositPercent = settings.depositPercent || 30;
    const depositPrice = Math.round((dayData.price * depositPercent) / 100);

    setModalCell({
      block,
      dayMeta,
      price: dayData.price,
      origPrice,
      isDiscount,
      depositPercent,
      depositPrice,
      courtName: activeCourt?.name || t('Sân Tennis')
    });
  };

  const handleBookNow = () => {
    setPreferredZone(selectedZone);
    setModalCell(null);
    navigate('booking');
  };

  return (
    <section className="ct-pad gx-pricing" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="gx-heading" style={{ marginBottom: 28 }}>
        <span className="ct-eyebrow" style={{ color: '#6b8274', letterSpacing: '0.15em', fontWeight: 700, fontSize: 12 }}>
          COURTLY · {t('BẢNG GIÁ NIÊM YẾT 2026')}
        </span>
        <h1 style={{ color: '#173c32', fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, margin: '8px 0 12px' }}>
          {t('Bảng giá sân theo ngày & khung giờ')}
        </h1>
        <p style={{ color: '#52655a', fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
          {t('Biểu phí chuẩn theo giờ và phân bổ riêng biệt cho từng ngày trong tuần. Khung Giờ Vàng (-25%) tự động áp dụng trực tiếp khi tạo đơn.')}
        </p>
      </div>

      {/* 1. HORIZONTAL TABS SELECTOR (HÀNG NGANG GỌN GÀNG, KHÔNG CÓ CHỮ NHỎ SÂN 1-4, KHÔNG CÓ Ô ĐƠN VỊ) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b8274' }}>
            {t('Chọn loại sân')}:
          </span>
          <span style={{ fontSize: 12, color: '#52655a' }}>
            {t('Nhấp vào tab để xem biểu giá tương ứng')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {TABS.map(tab => {
            const isActive = selectedZone === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedZone(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: 8,
                  border: isActive ? '2px solid #173c32' : '1px solid #cbd2c2',
                  background: isActive ? '#173c32' : '#fffefa',
                  color: isActive ? '#ffffff' : '#173c32',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(23,60,50,0.18)' : 'none',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={20} stroke={isActive ? '#def46a' : '#173c32'} />
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>
                    {t(tab.name)}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: isActive ? '#def46a' : '#edf2e8',
                    color: '#173c32',
                    border: isActive ? 'none' : '1px solid #cbd2c2'
                  }}
                >
                  {t('Từ')} {money(tab.defaultMin)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THE EXCEL MATRIX TABLE */}
      <div style={{ background: '#fffefa', borderRadius: 10, border: '1px solid #cbd2c2', overflow: 'hidden', boxShadow: '0 2px 12px rgba(23,60,50,0.06)', marginBottom: 36 }}>
        {/* Sub-bar */}
        <div style={{ background: '#edf1e6', padding: '12px 18px', borderBottom: '1px solid #cbd2c2', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: '#173c32' }}>{t('Đang xem')}:</span>
            <span style={{ fontWeight: 700, background: '#ffffff', color: '#173c32', padding: '3px 10px', borderRadius: 4, border: '1px solid #bfc7ba' }}>
              {t(TABS.find(z => z.id === selectedZone)?.name || 'Sân Ngoài Trời')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#52655a' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#15803d', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#15803d' }} /> {t('Giờ Vàng (-25%)')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9a3412', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c' }} /> {t('Cao điểm đèn')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b21a8', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} /> {t('Cuối tuần')}
            </span>
          </div>
        </div>

        {/* Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#e4e9dc', color: '#173c32', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                <th style={{ padding: '12px 14px', width: 160, textAlign: 'center', background: '#d8e0ce', borderRight: '1px solid #cbd2c2', borderBottom: '1px solid #cbd2c2', position: 'sticky', left: 0, zIndex: 10 }}>
                  {t('Khung Giờ')}
                </th>
                {WEEK_DAYS.map(day => {
                  const isWeekend = day.dayType === 'WEEKEND';
                  return (
                    <th
                      key={day.key}
                      style={{
                        padding: '12px 10px',
                        textAlign: 'center',
                        minWidth: 120,
                        borderRight: '1px solid #cbd2c2',
                        borderBottom: '1px solid #cbd2c2',
                        background: isWeekend ? '#ede8f5' : day.key === 'fri' ? '#dde3d4' : '#e4e9dc',
                        color: isWeekend ? '#5b21b6' : '#173c32'
                      }}
                    >
                      <div>{t(day.label)}</div>
                      <span style={{ fontSize: 9.5, opacity: 0.7, fontWeight: 400 }}>{day.short}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody style={{ background: '#fffefa' }}>
              {matrix.map((row, idx) => (
                <tr key={idx}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', background: '#f3f6ee', borderRight: '1px solid #cbd2c2', borderBottom: '1px solid #cbd2c2', position: 'sticky', left: 0, zIndex: 5 }}>
                    <div style={{ fontWeight: 700, color: '#173c32', fontVariantNumeric: 'tabular-nums' }}>{row.time}</div>
                    <div style={{ fontSize: 11, color: '#52655a', fontWeight: 400, marginTop: 2 }}>{t(row.label)}</div>
                  </th>
                  {WEEK_DAYS.map(day => {
                    const dayData = row.days[day.key];
                    const isFlash = dayData.type === 'flash';
                    const isPeak = dayData.type === 'peak';
                    const isWeekend = dayData.type === 'weekend';

                    let badgeStyle = { background: '#f1f4eb', color: '#52655a', border: '1px solid #cbd2c2' };
                    let badgeText = t('Chuẩn');

                    if (isFlash) {
                      badgeStyle = { background: '#d6e9d7', color: '#15803d', border: '1px solid #a7d4aa' };
                      badgeText = t('Giảm 25%');
                    } else if (isPeak) {
                      badgeStyle = { background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa' };
                      badgeText = t('Cao điểm');
                    } else if (isWeekend) {
                      badgeStyle = { background: '#ede8f5', color: '#5b21b6', border: '1px solid #ddd6fe' };
                      badgeText = t('Cuối tuần');
                    }

                    return (
                      <td
                        key={day.key}
                        onClick={() => handleCellClick(row, day.key, dayData)}
                        title={t('Bấm để xem chi tiết tiền cọc & giữ chỗ')}
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          borderRight: '1px solid #cbd2c2',
                          borderBottom: '1px solid #cbd2c2',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f4ea')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ fontWeight: 800, color: '#173c32', fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                          {money(dayData.price)}
                        </div>
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, marginTop: 3, ...badgeStyle }}>
                          {badgeText}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div style={{ background: '#edf1e6', padding: '12px 18px', borderTop: '1px solid #cbd2c2', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#52655a' }}>
            <CheckCircle2 size={15} color="#173c32" />
            <span>{t('Bấm trực tiếp vào ô giá bất kỳ để xem tiền cọc 30% và chuyển sang đặt lịch.')}</span>
          </div>
          <div style={{ fontWeight: 700, color: '#173c32' }}>
            {t('Hội viên Courtly')}: <span style={{ color: '#15803d' }}>{t('Giảm thêm từ 10% – 20% trên giá niêm yết')}</span>
          </div>
        </div>
      </div>

      {/* 3. BỘ CHÍNH SÁCH VẬN HÀNH ĐẦY ĐỦ 7 NHÓM */}
      <div style={{ marginTop: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <ShieldCheck size={24} color="#173c32" />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#173c32', margin: 0 }}>
            {t('Quy định & Chính sách hoạt động của CLB')}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          
          {/* Card 1: Tiền cọc */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <CreditCard size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Tiền cọc & Thanh toán')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Đặt sân trực tuyến yêu cầu cọc')} <b>{settings.depositPercent || 30}%</b> {t('tiền sân sau khi trừ ưu đãi hội viên và voucher. Miễn cọc cho hội viên VIP.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Thanh toán cọc nhanh qua mã VietQR tự động xác nhận trong 3 giây hoặc nộp tiền mặt tại quầy lễ tân.')}
            </p>
          </article>

          {/* Card 2: Giữ chỗ */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Clock size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Thời hạn giữ chỗ 15 phút')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Hệ thống giữ chỗ trong')} <b>{settings.holdMinutes || 15} {t('phút')}</b> {t('kể từ khi tạo đơn. Khung giờ được khóa độc quyền để không ai khác đặt trùng.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Hết 15 phút đếm ngược nếu chưa hoàn tất tiền cọc, hệ thống tự động hủy đơn và giải phóng lịch cho khách khác.')}
            </p>
          </article>

          {/* Card 3: Hủy & Đổi lịch */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <RefreshCw size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Quy định Hủy / Đổi lịch')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Hủy trước')} <b>{policies.cancelCutoffMinutes ? Math.round(policies.cancelCutoffMinutes / 60) : 24} {t('tiếng')}</b>: {t('Hoàn')} <b>{settings.cancelRefundPercent || 100}%</b> {t('tiền cọc vào ví hoàn của bạn. Hủy dưới 6 tiếng không hoàn cọc.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Đổi lịch trước 24 tiếng hoàn toàn miễn phí. Hệ thống tự động bù hoặc hoàn chênh lệch giá giữa các khung giờ.')}
            </p>
          </article>

          {/* Card 4: Trọng tài & HLV */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Scale size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Dịch vụ Trọng tài & HLV')}</h3>
            </div>
            {data?.refereeRates?.length ? (
              <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13, color: '#52655a' }}>
                {data.refereeRates.slice(0, 3).map((r, i) => (
                  <li key={i}>
                    <strong>{r.name}</strong> {r.level && `· ${r.level}`}: <b>{money(r.rate)}</b> / {t('giờ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
                {t('Thù lao niêm yết từ 100.000 đ – 250.000 đ/giờ tùy cấp bậc trọng tài.')}
              </p>
            )}
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Tính theo slot 30 phút. Trọng tài có mặt trước trận 10 phút kiểm tra bóng và mặt sân tiêu chuẩn.')}
            </p>
          </article>

          {/* Card 5: Khuyến mãi tự động */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Zap size={18} color="#15803d" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Khuyến mãi Giờ Vàng Tự Động')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Khung giờ 09:00 – 16:00 các ngày Thứ 2 đến Thứ 5 được tự động giảm')} <b>25%</b> {t('trên toàn bộ hệ thống sân.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Đến đúng khung giờ khuyến mãi, hệ thống tự động áp giá ưu đãi mà người chơi không cần nhập mã.')}
            </p>
          </article>

          {/* Card 6: Voucher & Điểm thưởng */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <Ticket size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Chính sách Voucher & Đổi Điểm')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Người dùng nhập mã voucher tại trang đặt sân hoặc quầy thu ngân để được khấu trừ trực tiếp vào tiền cọc.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Tích lũy 10 điểm cho mỗi 100.000 đ chi tiêu để đổi voucher giảm 50k, 100k hoặc slot thuê vợt miễn phí.')}
            </p>
          </article>

          {/* Card 7: Check-in / Check-out */}
          <article style={{ background: '#fffefa', border: '1px solid #cbd2c2', borderRadius: 8, padding: 22, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#173c32' }}>
              <LogIn size={18} color="#173c32" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('Quy định Check-in & Check-out')}</h3>
            </div>
            <p style={{ fontSize: 13, color: '#52655a', margin: '0 0 10px' }}>
              {t('Cho phép quét mã QR vé điện tử sớm tối đa')} <b>15 {t('phút')}</b> {t('để nhận sân. Thời gian ân hạn dọn sân là 5 phút sau khi hết giờ.')}
            </p>
            <p style={{ fontSize: 13, color: '#52655a', margin: 0 }}>
              {t('Chơi quá giờ khi sân sau trống sẽ tính phí gia hạn theo slot; nếu có khách kế tiếp, áp dụng phí phụ thu chiếm sân.')}
            </p>
          </article>

        </div>
      </div>

      {/* 4. MODAL DRAWER ON CELL CLICK */}
      {modalCell && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(14, 36, 22, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setModalCell(null)}
        >
          <div
            style={{
              background: '#f6f4ee',
              borderRadius: 12,
              maxWidth: 440,
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #b5c3ad',
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#173c32', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#def46a', fontWeight: 700 }}>
                  {modalCell.courtName}
                </span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>
                  {t(modalCell.dayMeta.label)} · {modalCell.block.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCell(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 22, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ background: '#fffefa', padding: 16, borderRadius: 8, border: '1px solid #cbd2c2', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#52655a', marginBottom: 6 }}>
                  <span>{t('Giá niêm yết chuẩn')}:</span>
                  <span style={{ textDecoration: modalCell.isDiscount ? 'line-through' : 'none' }}>
                    {money(modalCell.origPrice)}
                  </span>
                </div>
                {modalCell.isDiscount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#15803d', fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={14} /> {t('Ưu đãi Giờ Vàng')}:
                    </span>
                    <span>-25% ({t('Tiết kiệm')} {money(modalCell.origPrice - modalCell.price)})</span>
                  </div>
                )}
                <div style={{ paddingTop: 8, borderTop: '1px solid #cbd2c2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, fontWeight: 800, color: '#173c32' }}>
                  <span>{t('Giá áp dụng')}:</span>
                  <span style={{ color: '#15803d', fontSize: 19 }}>{money(modalCell.price)} / {t('giờ')}</span>
                </div>
              </div>

              <div style={{ background: '#eef2e7', padding: 12, borderRadius: 8, border: '1px solid #cbd2c2', fontSize: 12, color: '#52655a', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Tiền cọc giữ chỗ')} ({modalCell.depositPercent}%):</span>
                  <b style={{ color: '#173c32' }}>{money(modalCell.depositPrice)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #d8e0ce' }}>
                  <span>{t('Thời hạn giữ chỗ')}:</span>
                  <b style={{ color: '#173c32' }}>{settings.holdMinutes || 15} {t('phút')} ({t('Đếm ngược')})</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6 }}>
                  <span>{t('Chính sách hoàn tiền')}:</span>
                  <span style={{ color: '#15803d', fontWeight: 600 }}>{t('Hoàn 100% nếu hủy trước 24h')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBookNow}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 6,
                  background: '#173c32',
                  color: '#f6f4ee',
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(23,60,50,0.2)'
                }}
              >
                <span>{t('Tiến hành đặt sân ngay')}</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

#### File: `frontend/src/guest/Tournaments.jsx`
```jsx
import React,{useState} from 'react';
import {ArrowUpRight,CalendarDays} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money,requestId,dateToday} from './context';
export function EventCards({events}){const {t,show}=useGuest();return <div className="gx-event-grid">{events.map(e=><article key={e.id}><img src={e.format==='DOUBLES'?'/guest/doubles.webp':'/guest/hero-singles.webp'} alt={t('Ảnh minh họa tennis')}/><div><span className="ct-eyebrow">{t(e.format)} · {e.start}</span><h3>{e.name}</h3><p>{e.location} · {money(e.fee)}</p><button className="ct-text-button" onClick={()=>show({kind:'event',event:e})}>{t('Chi tiết & đăng ký')}<ArrowUpRight/></button></div></article>)}{!events.length&&<Empty>{t('Chưa có giải đấu sắp tới.')}</Empty>}</div>}
export default function Tournaments(){const {t,data}=useGuest();return <section className="ct-pad"><div className="gx-heading"><span className="ct-eyebrow">COURTLY / COMMUNITY</span><h1>{t('Hẹn nhau ở trận tiếp theo.')}</h1><p>{t('Khám phá giải đấu, đọc điều lệ và đăng ký cùng đồng đội.')}</p></div><EventCards events={data?.tournaments||[]}/></section>}
export function EventDialog({event:e,onClose}){const {t,user,login,refresh,pay,data}=useGuest();const [values,setValues]=useState({name:user?.name||'',phone:'',teamName:'',partnerName:'',partnerEmail:'',adult:false,rules:false}),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const [req]=useState(requestId);const doubles=e.format!=='SINGLES';const reg=data?.registrations?.find(r=>r.tournamentId===e.id);const set=(k,v)=>{setReview(false);setValues(s=>({...s,[k]:v}))};
 const submit=async ev=>{ev.preventDefault();if(!user){login();return}if(!review){setReview(true);return}setBusy(true);setError('');try{const result=await api(`/guest/tournaments/${e.id}/register`,'POST',{...values,requestId:req});await refresh();onClose();if(e.fee>0)await pay('TOURNAMENT',result.id)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="gx-event-detail"><img src={doubles?'/guest/doubles.webp':'/guest/hero-singles.webp'} alt={t('Ảnh minh họa tennis')}/><span className="ct-eyebrow">{t(e.format)}</span><h2>{e.name}</h2><p>{e.start} – {e.end} · {e.location}</p><p>{t('Hạn đăng ký')}: {e.deadline} · {e.registeredCount||0}/{e.max} {t(doubles?'đội':'người')}</p><p>{t('Phí tham gia')}: {money(e.fee)}</p><details open><summary>{t('Điều lệ giải đấu')}</summary><ul><li>{t('Dành cho người chơi đủ 18 tuổi. Thi đấu loại trực tiếp.')}</li><li>{t('Một set 6 game, cách biệt 2. Tỷ số 6–6 đánh tie-break 7 điểm, cách biệt 2.')}</li><li>{t(doubles?'Giải đôi: no-ad tại 40–40, đội nhận chọn bên nhận.':'Giải đơn: tính điểm lợi điểm tại 40–40.')}</li><li>{t('Check-in trước giờ thi đấu 30 phút; mang giày phù hợp, vợt và bóng.')}</li><li>{t('Phí bao gồm tổ chức trận và trọng tài. Lịch chi tiết được CLB công bố trước giải.')}</li><li>{t('Đổi thành viên hoặc yêu cầu hoàn phí cần liên hệ CLB trước hạn đăng ký. Không tự động hoàn tiền.')}</li><li>{t('Tôn trọng đối thủ và quyết định của trọng tài; không có hành vi gây nguy hiểm.')}</li></ul></details>{reg?<><State value={reg.status}/><p>{t('Bạn đã đăng ký giải này.')}</p>{reg.paid<e.fee&&<Action onClick={()=>pay('TOURNAMENT',reg.id)}>{t('Thanh toán phí giải')}</Action>}</>:e.status!=='OPEN'||e.deadline<dateToday()||e.registeredCount>=e.max?<Empty>{t('Giải đã đóng đăng ký hoặc đủ chỗ.')}</Empty>:!user?<Action onClick={login}>{t('Đăng nhập để đăng ký')}</Action>:<form onSubmit={submit} className="gx-form"><h3>{t(review?'Kiểm tra đăng ký':'Thông tin người chơi')}</h3>{[['name','Họ và tên','text'],['phone','Điện thoại','tel'],...(doubles?[['teamName','Tên đội','text'],['partnerName','Tên đồng đội','text'],['partnerEmail','Email đồng đội','email']]:[])].map(([key,label,type])=><label key={key}>{t(label)}<input type={type} required maxLength={key.includes('Email')?254:100} pattern={key==='phone'?'[+0-9 ()-]{9,20}':undefined} readOnly={review} value={values[key]} onChange={ev=>set(key,ev.target.value)}/></label>)}<p>{t('Email người đăng ký')}: {user.email}</p>{['adult','rules'].map(k=><label className="gx-check" key={k}><input type="checkbox" required checked={values[k]} onChange={e=>set(k,e.target.checked)}/>{t(k==='adult'?'Tôi xác nhận tất cả người chơi đủ 18 tuổi.':'Tôi đã đọc và đồng ý điều lệ giải đấu.')}</label>)}{review&&<p className="gx-notice">{t('Kiểm tra thông tin trước khi xác nhận. Suất thi đấu được xác nhận sau khi thu đủ phí.')}</p>}{error&&<div className="gx-error" role="alert">{t(error)}</div>}<div className="gx-actions">{review&&<Action secondary onClick={()=>setReview(false)}>{t('Sửa thông tin')}</Action>}<Action type="submit" disabled={busy}>{t(busy?'Đang xử lý…':review?'Xác nhận đăng ký':'Kiểm tra thông tin')}</Action></div></form>}</div>}
```

#### File: `frontend/src/guest/bookingTime.mjs`
```javascript
// Schedule boundaries, rather than fixed slot counts, also support older 60-minute slots.
export const toMinutes = value => {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
};
export const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function rangeSlots(rows, start, end) {
  return rows.filter(row => toMinutes(row.start) >= start && toMinutes(row.end) <= end)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}
export function canEndAt(rows, start, end, available) {
  if (start === null || end <= start) return false;
  const selected = rangeSlots(rows, start, end);
  return selected.length > 0 && toMinutes(selected[0].start) === start
    && toMinutes(selected.at(-1).end) === end
    && selected.every((row, i) => available(row) && (!i || toMinutes(selected[i - 1].end) === toMinutes(row.start)));
}
export function timePoints(rows) {
  return [...new Set(rows.flatMap(row => [toMinutes(row.start), toMinutes(row.end)]))].sort((a, b) => a - b);
}
```

#### File: `frontend/src/guest/context.jsx`
```jsx
import React,{createContext,useContext} from 'react';
import translations from './translations.json';
export const GuestContext=createContext(null);
export const useGuest=()=>useContext(GuestContext);
const states={ALL:['Tất cả','All'],HOLDING:['Đang giữ chỗ','On hold'],CONFIRMED:['Đã xác nhận','Confirmed'],CHECKED_IN:['Đang chơi','Checked in'],COMPLETED:['Hoàn tất','Completed'],CANCELLED:['Đã hủy','Cancelled'],EXPIRED:['Hết hạn','Expired'],PENDING:['Chờ xử lý','Pending'],CHECKING:['Chờ đối soát','Checking'],REVIEW:['Cần đối soát','Under review'],ACTIVE:['Hoạt động','Active'],BOOKED:['Đã đặt','Booked'],LOCKED:['Đang giữ chỗ','On hold'],BLOCKED:['Bảo trì','Maintenance'],IN_MATCH:['Thi đấu','Match'],SINGLES:['Đơn','Singles'],DOUBLES:['Đôi','Doubles'],TEAM:['Đồng đội','Team'],CASH:['Tiền mặt','Cash'],BANK_TRANSFER:['Chuyển khoản','Bank transfer'],ORDER:['Đơn sân','Court booking'],TOURNAMENT:['Giải đấu','Tournament'],MEMBERSHIP:['Hội viên','Membership'],COURT:['Chất lượng sân','Court quality'],SERVICE:['Dịch vụ','Service'],WEBSITE:['Website','Website'],OTHER:['Khác','Other'],NEWS:['Tin tức','News'],NOTICE:['Thông báo','Notice']};
export const translate=(lang,text)=>states[text]?.[lang==='en'?1:0]||(lang==='en'?(translations[text]||text):text);
export const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const time=s=>String(s||'').slice(0,5);
export const minutes=s=>{const [h,m]=time(s).split(':').map(Number);return h*60+m;};
export const stamp=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const zone=c=>{const name=String(c?.name||'').trim().replace(/^(Sân|San)\s+/i,'');return /^B/i.test(name)?'B':/^V/i.test(name)?'V':'A';};
export const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n||0))+'₫';
export const requestId=()=>crypto.randomUUID();
export function Action({children,onClick,type='button',secondary=false,...props}){return <button type={type} className={secondary?'ct-outline':'ct-primary'} onClick={onClick} {...props}>{children}</button>;}
export function State({value}){const {t}=useGuest();return <span className={'gx-status gx-'+value}>{t(value)}</span>;}
export function Empty({children}){const {t}=useGuest();return <div className="gx-empty">{children||t('Chưa có dữ liệu')}</div>;}
```

### 7.3 Components & Dialogs

#### File: `frontend/src/components/AuthDialog.jsx`
```jsx
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal, Button } from './UI';
import { api } from '../services/api';

function PasswordField({ id, label, value, onChange, placeholder, required = true, minLength, maxLength = 128, autoComplete, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrapper">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow(s => !s)}
          title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function AuthDialog({ onClose, onSuccess, ownerSetupAvailable = false, initialMode = 'login', initialToken = '' }) {
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState({ email: '', password: '', confirm: '', name: '', phone: '', token: initialToken, code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);

  const titles = {
    login: 'Đăng nhập Courtly',
    register: 'Tạo tài khoản Courtly',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt lại mật khẩu',
    activate: 'Kích hoạt / Đặt lại mật khẩu',
    'activate-otp': 'Kích hoạt tài khoản Courtly',
    'owner-activate': 'Thiết lập tài khoản của bạn'
  };

  const set = (name, value) => setValues(v => ({ ...v, [name]: value }));

  const switchMode = next => {
    setMode(next);
    setError('');
    setSuccess('');
    setDevCode('');
    setValues(v => ({ ...v, password: '', confirm: '' }));
  };

  const handleForgotPassword = async e => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setSuccess('');
    if (!values.email.trim()) return setError('Vui lòng nhập địa chỉ email của bạn.');
    setBusy(true);
    try {
      const res = await api('/auth/forgot-password', 'POST', { email: values.email.trim() });
      setSuccess(res.message || 'Mã xác nhận đã được gửi về email của bạn.');
      if (res.code) {
        set('code', res.code);
        setDevCode(res.code);
      }
      setMode('reset');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy || !values.email.trim()) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (mode === 'activate-otp') {
        const res = await api('/auth/resend-activation', 'POST', { email: values.email.trim() });
        setSuccess('Đã gửi lại mã kích hoạt mới đến email của bạn.');
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
      } else {
        const res = await api('/auth/forgot-password', 'POST', { email: values.email.trim() });
        setSuccess('Đã gửi lại mã xác nhận mới đến email của bạn.');
        if (res.code) {
          setDevCode(res.code);
          set('code', res.code);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (mode === 'forgot') return handleForgotPassword(e);

    if (mode === 'register') {
      const p = values.phone.trim().replace(/\s+/g, '');
      if (!/^0[0-9]{9}$/.test(p)) {
        return setError('Số điện thoại không hợp lệ (cần đúng 10 chữ số, bắt đầu bằng số 0).');
      }
    }

    if (['register', 'reset', 'activate', 'owner-activate'].includes(mode) && values.password !== values.confirm) {
      return setError('Hai mật khẩu chưa trùng nhau.');
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await api('/auth/register', 'POST', {
          ...values,
          phone: values.phone.trim().replace(/\s+/g, ''),
          requireActivation: true
        });
        if (res.requiresActivation) {
          setMode('activate-otp');
          setSuccess(res.message || 'Mã OTP 6 số đã được gửi về email.');
          if (res.devCode) {
            setDevCode(res.devCode);
            set('code', res.devCode);
          }
          return;
        }
        await onSuccess(res);
        return;
      }

      if (mode === 'activate-otp') {
        const session = await api('/auth/activate', 'POST', {
          code: values.code.trim(),
          email: values.email?.trim()
        });
        await onSuccess(session);
        return;
      }

      let endpoint = `/auth/${mode}`;
      let payload = values;
      if (mode === 'reset') {
        endpoint = '/auth/reset-password';
        payload = {
          code: (values.code || values.token || '').trim(),
          password: values.password,
          email: values.email?.trim()
        };
      }
      const res = await api(endpoint, 'POST', payload);
      if (res.requiresActivation) {
        setMode('activate-otp');
        if (res.email) set('email', res.email);
        setSuccess(res.message || 'Tài khoản chưa được kích hoạt. Vui lòng nhập mã OTP.');
        if (res.devCode) {
          setDevCode(res.devCode);
          set('code', res.devCode);
        }
        return;
      }
      await onSuccess(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={titles[mode]} onClose={() => { if (!busy) onClose(); }}>
      <p className="subtitle" style={{ marginBottom: 20 }}>
        {mode === 'login'
          ? 'Dùng email và mật khẩu Courtly. Sau đăng nhập, bạn sẽ được đưa đến không gian phù hợp với tài khoản.'
          : mode === 'register'
          ? 'Tạo tài khoản để đặt sân, thuê trọng tài và tham gia các giải đấu CLB.'
          : mode === 'activate-otp'
          ? `Mã kích hoạt OTP 6 số đã được gửi đến ${values.email}. Vui lòng kiểm tra hộp thư và nhập mã bên dưới để hoàn tất đăng ký.`
          : mode === 'forgot'
          ? 'Nhập email đã đăng ký. Hệ thống sẽ gửi mã xác nhận 6 số để bạn đặt mật khẩu mới.'
          : mode === 'reset'
          ? `Mã xác nhận 6 số đã được gửi đến ${values.email}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác) và nhập mã bên dưới.`
          : mode === 'owner-activate'
          ? 'Đặt mật khẩu Courtly cho tài khoản chủ Site đã được xác thực.'
          : 'Nhập mã kích hoạt một lần do quản trị viên cung cấp để đặt mật khẩu.'}
      </p>

      {success && <div className="auth-hint-success" role="status">{success}</div>}

      <form onSubmit={submit} className="auth-fields">
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="auth-name">Họ và tên</label>
              <input
                id="auth-name"
                autoComplete="name"
                required
                maxLength={100}
                placeholder="Ví dụ: Nguyễn Văn A"
                value={values.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-phone">Số điện thoại liên hệ (để xác nhận đặt sân)</label>
              <input
                id="auth-phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={15}
                placeholder="Ví dụ: 0912345678 (10 số, bắt đầu số 0)"
                value={values.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </>
        )}

        {['login', 'register', 'forgot'].includes(mode) && (
          <div className="field">
            <label htmlFor="auth-email">Email đăng nhập</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="tenban@gmail.com"
              value={values.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>
        )}

        {mode === 'activate-otp' && (
          <>
            <div className="field">
              <label htmlFor="auth-activate-email">Email đăng ký</label>
              <input
                id="auth-activate-email"
                type="email"
                value={values.email}
                readOnly
                disabled
                style={{ background: '#f5f7f5', color: '#555' }}
              />
            </div>

            {devCode && (
              <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo đồ án:</small>
                  <span style={{ fontSize: 13, color: '#14532d' }}>Mã kích hoạt OTP: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
                </div>
                <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                  Điền nhanh
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-otp-code">Mã kích hoạt OTP 6 số (gửi về email)</label>
              <input
                id="auth-otp-code"
                autoComplete="one-time-code"
                required
                maxLength={12}
                placeholder="Nhập mã 6 chữ số"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{ fontSize: '20px', letterSpacing: '4px', fontWeight: 'bold', textAlign: 'center' }}
              />
              <div className="auth-resend">
                <small>Mã có hiệu lực trong 15 phút.</small>
                <button type="button" className="btn sm" disabled={busy} onClick={handleResend}>
                  Gửi lại mã OTP
                </button>
              </div>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="field">
              <label htmlFor="auth-reset-email">Email</label>
              <input
                id="auth-reset-email"
                type="email"
                value={values.email}
                readOnly
                disabled
                style={{ background: '#f5f7f5', color: '#555' }}
              />
            </div>

            {devCode && (
              <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <small style={{ display: 'block', color: '#166534', fontWeight: 600 }}>Thử nghiệm / Demo đồ án:</small>
                  <span style={{ fontSize: 13, color: '#14532d' }}>Mã xác nhận: <strong style={{ letterSpacing: 2, fontSize: 15, fontFamily: 'monospace' }}>{devCode}</strong></span>
                </div>
                <button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('code', devCode)}>
                  Điền nhanh
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-code">Mã xác nhận 6 số (gửi về email)</label>
              <input
                id="auth-code"
                autoComplete="one-time-code"
                required
                maxLength={64}
                placeholder="Nhập mã 6 chữ số trong email"
                value={values.code}
                onChange={e => set('code', e.target.value.trim())}
                style={{ fontSize: '18px', letterSpacing: '2px', fontWeight: 'bold' }}
              />
              <div className="auth-resend">
                <small>Mã có hiệu lực trong 15 phút.</small>
                <button type="button" className="btn sm" disabled={busy} onClick={handleResend}>
                  Gửi lại mã
                </button>
              </div>
            </div>
          </>
        )}

        {mode === 'activate' && (
          <div className="field">
            <label htmlFor="auth-token">Mã kích hoạt</label>
            <input
              id="auth-token"
              autoComplete="off"
              required
              placeholder="Dán mã kích hoạt tại đây"
              value={values.token}
              onChange={e => set('token', e.target.value.trim())}
            />
          </div>
        )}

        {!['forgot', 'activate-otp'].includes(mode) && (
          <PasswordField
            id="auth-password"
            label={mode === 'login' ? 'Mật khẩu' : 'Mật khẩu mới'}
            required
            minLength={mode === 'login' ? undefined : 8}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Nhập mật khẩu của bạn"
            value={values.password}
            onChange={e => set('password', e.target.value)}
            hint={mode !== 'login' ? 'Từ 8 ký tự, tối đa 72 byte UTF-8. Có thể dùng cụm từ dễ nhớ.' : undefined}
          />
        )}

        {['register', 'reset', 'activate', 'owner-activate'].includes(mode) && (
          <PasswordField
            id="auth-confirm"
            label="Nhập lại mật khẩu"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Nhập lại chính xác mật khẩu trên"
            value={values.confirm}
            onChange={e => set('confirm', e.target.value)}
          />
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <button className="btn primary auth-submit" disabled={busy}>
          {busy
            ? 'Đang xử lý…'
            : mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
            ? 'Tạo tài khoản'
            : mode === 'activate-otp'
            ? 'Xác nhận kích hoạt & Đăng nhập'
            : mode === 'forgot'
            ? 'Gửi mã về email'
            : mode === 'reset'
            ? 'Lưu mật khẩu & Đăng nhập'
            : 'Lưu mật khẩu & tiếp tục'}
        </button>
      </form>

      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
              <Button disabled={busy} onClick={() => switchMode('register')}>
                Chưa có tài khoản? Đăng ký
              </Button>
              <Button disabled={busy} onClick={() => switchMode('forgot')}>
                Quên mật khẩu?
              </Button>
            </div>
            <Button className="sm" disabled={busy} onClick={() => switchMode('activate')}>
              Có mã kích hoạt / vé quầy cấp?
            </Button>
            {ownerSetupAvailable && (
              <Button disabled={busy} onClick={() => switchMode('owner-activate')}>
                Thiết lập tài khoản của bạn
              </Button>
            )}
          </>
        ) : mode === 'activate-otp' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
            <Button disabled={busy} onClick={() => switchMode('login')}>
              Đã kích hoạt? Đăng nhập
            </Button>
            <Button disabled={busy} onClick={() => switchMode('register')}>
              Đổi email / Đăng ký lại
            </Button>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => switchMode('login')}>
            Đã có tài khoản? Đăng nhập
          </Button>
        )}
      </div>

      {mode === 'activate' && (
        <p className="auth-hint">
          Nếu chưa có mã, hãy bấm <b>"Quên mật khẩu"</b> để nhận mã tự động qua email hoặc liên hệ quầy lễ tân để được cấp mã trực tiếp.
        </p>
      )}
    </Modal>
  );
}
```

#### File: `frontend/src/components/BookingFlow.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React,{useState,useEffect,useRef} from 'react';
import {useCourtly} from '../context';
import {api} from '../services/api';
import {PolicyNotice} from './OrderSummary';
import {Modal,Button} from './UI';
import {money} from '../utils/format';

export function RefereeSlots({options,value,onChange,disabled=false}){
 return <div className="referee-slots">{options.staffSlots.map(row=>{const slot=options.slots.find(s=>s.id===row.scheduleId),staffId=value.find(x=>x.scheduleId===slot.id)?.staffId||'';return <label className="referee-slot" key={slot.id}><span>{slotLabel(slot)}</span><select aria-label={`Trọng tài ${slot.hour} giờ`} value={staffId} disabled={disabled} onChange={e=>onChange([...value.filter(x=>x.scheduleId!==slot.id),...(e.target.value?[{scheduleId:slot.id,staffId:e.target.value}]:[])])}><option value="">Không thuê trọng tài</option>{row.staff.map(st=><option key={st.id} value={st.id} disabled={!st.available}>{st.name} · {money(st.rate)}/giờ{!st.available?' · Không khả dụng':''}</option>)}</select>{!row.staff.some(st=>st.available)&&<small>Không có trọng tài có lịch làm việc và còn trống giờ này. Bạn vẫn có thể đặt sân.</small>}</label>;})}</div>;
}

export default function BookingFlow({scheduleIds,onCreated,onClose}){
 const {data,user,isAdmin,isStaff,mutate,show,notify}=useCourtly();
 const isInternal=isAdmin||isStaff;
 const [ids,setIds]=useState(scheduleIds);
 const [options,setOptions]=useState(null),[assignments,setAssignments]=useState([]),[step,setStep]=useState(3),[error,setError]=useState(''),[busy,setBusy]=useState(false),[customer,setCustomer]=useState({accountId:isInternal?'':user.accountId,name:isInternal?'':user.name,phone:isInternal?'':user.phone||''});
 const [voucherCode,setVoucherCode]=useState(''),[appliedVoucher,setAppliedVoucher]=useState(null),[voucherErr,setVoucherErr]=useState('');
 const request=useRef(crypto.randomUUID());
 const load=()=>api('/booking/options','POST',{scheduleIds:ids,accountId:customer.accountId||null}).then(setOptions).catch(e=>setError(e.message));
 useEffect(()=>{load();},[ids.join('|'),customer.accountId]);
 const courtTotal=options?.slots.reduce((n,s)=>n+s.price,0)||0,staffTotal=assignments.reduce((n,a)=>n+(options?.staffSlots.find(x=>x.scheduleId===a.scheduleId)?.staff.find(x=>x.id===a.staffId)?.rate||0)*slotHours(options.slots.find(s=>s.id===a.scheduleId)),0),discount=options?.courtQuote?.discount||0;
 const voucherDiscount=appliedVoucher?.discount||0;
 const total=Math.max(0, courtTotal-discount-voucherDiscount+staffTotal);
 const change=rows=>{setAssignments(rows);request.current=crypto.randomUUID();setStep(3);};
 const submit=async()=>{if(busy)return;setBusy(true);setError('');try{const r=await mutate('/orders',{...customer,accountId:customer.accountId||null,requestId:request.current,scheduleIds:ids,assignments,voucherCode:appliedVoucher?.code||undefined});onCreated?.();notify(r.refreshFailed?'Đã tạo đơn thành công. Chưa tải lại được dữ liệu; hãy làm mới, không tạo lại đơn.':'Đã giữ chỗ. Liên hệ quầy để thanh toán cọc.');show({type:'order',id:r.id});}catch(e){setError(e.message);await load();}finally{setBusy(false);}};
 return <Modal title="Đặt sân · Trọng tài & xác nhận" onClose={()=>!busy&&onClose()} wide><ol className="booking-steps"><li>1. Sân & ngày ✓</li><li>2. Khoảng giờ ✓</li><li aria-current={step===3?'step':undefined}>3. Trọng tài tùy chọn</li><li aria-current={step===4?'step':undefined}>4. Kiểm tra & xác nhận</li></ol>{error&&<p role="alert" className="error">{error}</p>}{!options?<p role="status">Đang kiểm tra sân và lịch trọng tài…</p>:<>{isInternal?<div className="form-grid"><label className="field full">Khách hàng<select value={customer.accountId} onChange={e=>{const a=data.accounts.find(x=>x.id===e.target.value);setCustomer({accountId:e.target.value,name:a?.name||'',phone:a?.phone||''});request.current=crypto.randomUUID();}}><option value="">Khách lẻ tại quầy</option>{data.accounts.filter(a=>a.role==='CUSTOMER').map(a=><option key={a.id} value={a.id}>{a.name} ({a.phone})</option>)}</select></label><label className="field">Tên khách<input value={customer.name} onChange={e=>{setCustomer({...customer,name:e.target.value});request.current=crypto.randomUUID();}}/></label><label className="field">Điện thoại<input value={customer.phone} onChange={e=>{setCustomer({...customer,phone:e.target.value});request.current=crypto.randomUUID();}}/></label></div>:<p>{user.name} · {user.phone||'Chưa có số điện thoại'}</p>}{options.conflicts?.length>0&&<div className="error" role="alert"><p>Một số giờ không còn khả dụng: {options.conflicts.map(x=>options.slots.find(s=>s.id===x.scheduleId)?.hour+':00').join(', ')}.</p><Button onClick={()=>{const available=options.slots.filter(s=>!options.conflicts.some(c=>c.scheduleId===s.id)).sort((a,b)=>a.hour-b.hour),runs=[];for(const slot of available){const run=runs.at(-1);if(run&&run.at(-1).court===slot.court&&run.at(-1).hour+slotHours(run.at(-1))===slot.hour)run.push(slot);else runs.push([slot]);}const keep=runs.sort((a,b)=>b.length-a.length)[0];if(keep){setIds(keep.map(s=>s.id));setStep(3);request.current=crypto.randomUUID();}else onClose();}}>Giữ khoảng liên tục còn trống / chọn lại</Button></div>}<h3>{options.date} · {options.slots.reduce((n,s)=>n+slotHours(s),0)} giờ sân</h3>{step===3&&<><p className="subtitle">Chọn riêng từng giờ cần trọng tài. Giá được kiểm tra lại khi giữ chỗ.</p><RefereeSlots options={options} value={assignments} onChange={change} disabled={busy}/></>}{step===4&&<><div className="slot-review">{options.slots.map(s=>{const a=assignments.find(a=>a.scheduleId===s.id),st=options.staffSlots.find(x=>x.scheduleId===s.id)?.staff.find(x=>x.id===a?.staffId);return <div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} · {slotLabel(s)}<small>{st?`${st.name} · ${slotHours(s)} giờ · ${money(st.rate*slotHours(s))}`:'Không thuê trọng tài'}</small></span><b>{money(s.price+(st?.rate||0)*slotHours(s))}</b></div>;})}</div><div style={{margin:'14px 0',padding:'12px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8}}><div style={{display:'flex',gap:8,alignItems:'center'}}><input aria-label="Mã Voucher" type="text" placeholder="Nhập mã voucher (VD: WELCOME, HE2026, VIP10...)" value={voucherCode} onChange={e=>{setVoucherCode(e.target.value.toUpperCase());setVoucherErr('');}} style={{textTransform:'uppercase',padding:'6px 10px',borderRadius:6,border:'1px solid #cbd5e1',flex:1,fontWeight:600}}/><Button type="button" disabled={busy||!voucherCode.trim()} onClick={async()=>{try{setVoucherErr('');const res=await api('/public/vouchers/validate','POST',{code:voucherCode,amount:courtTotal});setAppliedVoucher(res);}catch(e){setVoucherErr(e.message);}}}>Áp dụng</Button></div>{voucherErr&&<small style={{color:'#dc2626',display:'block',marginTop:6,fontWeight:500}}>⚠️ {voucherErr}</small>}{appliedVoucher&&<div style={{marginTop:8,padding:'6px 10px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,fontSize:13,color:'#16a34a',display:'flex',justifyContent:'space-between',alignItems:'center',fontWeight:600}}><span>✓ {appliedVoucher.code} ({appliedVoucher.description}): −{money(appliedVoucher.discount)}</span><button type="button" onClick={()=>{setAppliedVoucher(null);setVoucherCode('');}} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:12,fontWeight:700}}>✕ Gỡ</button></div>}</div></>}<div className="summary-line"><span>Tiền sân</span><b>{money(courtTotal)}</b></div>{discount>0&&<div className="summary-line membership-discount"><span>Ưu đãi {options.courtQuote.planName}</span><b>−{money(discount)}</b></div>}{appliedVoucher?.discount>0&&<div className="summary-line voucher-discount" style={{color:'#16a34a'}}><span>Voucher ({appliedVoucher.code})</span><b>−{money(appliedVoucher.discount)}</b></div>}<div className="summary-line"><span>Tiền trọng tài · {assignments.length} giờ</span><b>{money(staffTotal)}</b></div><div className="summary-line total"><span>Tổng tiền</span><b>{money(total)}</b></div><p className="notice">Cọc {money(Math.round(total*data.settings.depositPercent/100))} ({data.settings.depositPercent}%) · giữ {data.settings.holdMinutes} phút. {data.club?.paymentInstructions||'Thanh toán và ghi nhận tại quầy.'}</p><PolicyNotice/><div className="step-row"><Button disabled={busy} onClick={step===4?()=>setStep(3):onClose}>{step===4?'Quay lại chọn trọng tài':'Quay lại'}</Button>{step===3?<Button className="primary" onClick={()=>setStep(4)}>Kiểm tra đơn</Button>:<Button className="primary" disabled={busy||!customer.name.trim()||!!options.conflicts?.length} onClick={submit}>{busy?'Đang giữ chỗ…':'Xác nhận giữ chỗ'}</Button>}</div></>}</Modal>;
}
```

#### File: `frontend/src/components/BookingPicker.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {ArrowRight,Check,Clock} from 'lucide-react';
import {Panel,Button} from './UI';
import {CourtPhoto,courtDescription} from './CourtGallery';
import {money,today,labels} from '../utils/format';

export default function BookingPicker({data,date,setDate,onBook,initialCourtId}){
  const [courtId,setCourtId]=useState(''),[period,setPeriod]=useState('all'),[selected,setSelected]=useState([]),[error,setError]=useState('');
  useEffect(()=>{if(initialCourtId)setCourtId(initialCourtId);},[initialCourtId]);
  const court=data.courts.find(c=>c.id===courtId)||data.courts.find(c=>c.status==='ACTIVE')||data.courts[0];
  useEffect(()=>{setSelected([]);setError('');},[date]);
  const chosen=data.schedules.filter(s=>selected.includes(s.id));
  const upcoming=s=>Date.parse(`${s.date}T${String(s.hour).padStart(2,'0')}:00:00+07:00`)>Date.now();
  const available=s=>upcoming(s)&&s.status==='AVAILABLE'&&data.courts.find(c=>c.id===s.court)?.status==='ACTIVE';
  const slots=data.schedules.filter(s=>s.court===court?.id&&upcoming(s)&&(period==='all'||(period==='morning'?s.hour<12:period==='afternoon'?s.hour>=12&&s.hour<17:s.hour>=17)));
  const total=chosen.reduce((n,s)=>n+s.price,0),maxDate=new Date(Date.now()+90*86400000).toISOString().slice(0,10);

  const choose=id=>{
    setError('');
    const clicked=data.schedules.find(s=>s.id===id);
    if(!clicked)return;
    const otherCourtSlots=chosen.filter(s=>s.court!==clicked.court).map(s=>s.id);
    const previous=chosen.filter(s=>s.court===clicked.court).sort((a,b)=>a.hour-b.hour);
    const otherCourts=new Set(data.schedules.filter(s=>otherCourtSlots.includes(s.id)).map(s=>s.court));

    if(!previous.length){
      if(otherCourts.size>=3){
        setError('Tối đa 3 sân trong cùng một đơn.');
        return;
      }
      setSelected([...otherCourtSlots,id]);
      return;
    }
    if(previous.length===1&&previous[0].id===id){
      setSelected(otherCourtSlots);
      return;
    }
    const start=Math.min(previous[0].hour,clicked.hour),end=clicked.hour<previous[0].hour?previous.at(-1).hour:clicked.hour;
    const range=data.schedules.filter(s=>s.court===clicked.court&&s.hour>=start&&s.hour<=end).sort((a,b)=>a.hour-b.hour);
    if(range.length!==end-start+1||range.some(s=>!available(s))){
      setError('Khoảng giờ đi qua slot bận. Hãy chọn khoảng trống liên tiếp.');
      return;
    }
    setSelected([...otherCourtSlots,...range.map(s=>s.id)]);
  };

  const proceed=()=>{
    if(!chosen.length)return;
    if(chosen.some(s=>!available(s))){
      setError('Một khung giờ vừa thay đổi. Vui lòng chọn lại.');
      setSelected(old=>old.filter(id=>data.schedules.some(s=>s.id===id&&available(s))));
      return;
    }
    onBook({type:'booking',date,scheduleIds:chosen.map(s=>s.id),onCreated:()=>setSelected([])});
  };

  const chosenCourtsList=Array.from(new Set(chosen.map(s=>s.court)));

  return <div className={`booking-picker ${chosen.length?'has-selection':''}`}><Panel title="Tìm giờ trống" action={<div className="booking-date"><label htmlFor="booking-date">Ngày chơi</label><input id="booking-date" type="date" min={today()} max={maxDate} value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></div>}><div className="panel-body">
  <div className="picker-step"><span>1</span><h3>Chọn sân</h3></div><div className="court-options" role="group" aria-label="Chọn sân">{data.courts.map(c=>{
    const cCount=chosen.filter(s=>s.court===c.id).length;
    return <button key={c.id} aria-pressed={court?.id===c.id} className={`${court?.id===c.id?'chosen':''} ${cCount>0?'has-selection':''}`} disabled={c.status!=='ACTIVE'} onClick={()=>{setCourtId(c.id);setError('');}}><b>{c.name}{cCount>0?` (${cCount}h)`:''}</b><span>{labels[c.type]} · {c.status==='ACTIVE'?'Đang hoạt động':'Bảo trì'}</span></button>;
  })}</div>
  <div className="court-picker-info">{court&&<><CourtPhoto court={court}/><div><h4>{court.name}</h4><p>{courtDescription(court)}</p><p>{court.address||data.club?.address||'Địa chỉ đang cập nhật'}</p>{court.amenities&&<p>{court.amenities}</p>}</div></>}</div><div className="picker-step"><span>2</span><h3>Chọn giờ chơi</h3></div><div className="time-filters" role="group" aria-label="Buổi chơi">{[['all','Cả ngày'],['morning','Buổi sáng'],['afternoon','Buổi chiều'],['evening','Buổi tối']].map(([id,text])=><button key={id} aria-pressed={period===id} className={period===id?'on':''} onClick={()=>setPeriod(id)}>{text}</button>)}</div><p className="slot-guide">Mỗi slot dài 1 giờ. Chọn giờ đầu rồi giờ cuối để đặt trên từng sân. Bạn có thể chọn chuyển tab sân khác để đặt tối đa 3 sân trong 1 đơn.</p>
  <div className="time-options">{slots.map(s=>{const on=selected.includes(s.id),can=available(s),status=court?.status!=='ACTIVE'?'Bảo trì':s.status==='LOCKED'?'Đang giữ chỗ':s.status==='IN_MATCH'?'Có trận đấu':s.status==='BOOKED'?'Đã đặt':'Còn trống';return <button key={s.id} disabled={!can} aria-pressed={on} className={`time-option ${on?'chosen':''}`} onClick={()=>choose(s.id)} aria-label={`${court?.name}, ${s.hour} đến ${s.hour+1} giờ, ${money(s.price)}, ${on?'Đang chọn':status}`}><b>{on?<Check size={15}/>:<Clock size={15}/>} {s.hour}:00 – {s.hour+1}:00</b><span>{money(s.price)}</span><small>{on?'Đang chọn':status}</small></button>;})}</div>{!slots.length&&<p className="empty">Không còn khung giờ trong khoảng này. Hãy chọn buổi hoặc ngày khác.</p>}
  {error&&<div className="error" role="alert">{error}</div>}<p className="booking-policy">Giữ chỗ {data.settings.holdMinutes} phút · Cọc {data.settings.depositPercent}% tại quầy để xác nhận.</p></div></Panel>
  {chosen.length>0&&<div className="booking-summary" role="region" aria-label="Lựa chọn đặt sân"><div className="selection-info" aria-live="polite"><b>{chosen.length} khung giờ ({chosenCourtsList.length} sân) · {money(total)}</b><span>Cọc dự kiến {money(total*data.settings.depositPercent/100)}</span><details><summary>Xem chi tiết từng sân</summary>{chosenCourtsList.map(cid=>{const cName=data.courts.find(c=>c.id===cid)?.name||'Sân';const cSlots=chosen.filter(s=>s.court===cid).sort((a,b)=>a.hour-b.hour);return <div key={cid} style={{margin:'4px 0'}}><b>{cName}:</b> {cSlots.map(s=>`${s.hour}:00–${s.hour+1}:00`).join(', ')} ({cSlots.length} giờ · {money(cSlots.reduce((a,b)=>a+b.price,0))})</div>;})}</details></div><Button onClick={()=>setSelected([])}>Bỏ chọn tất cả</Button><Button className="primary" onClick={proceed}>Tiếp tục <ArrowRight size={17}/></Button></div>}
  </div>;
}
```

#### File: `frontend/src/components/CourtGallery.jsx`
```jsx
import React from 'react';
import {MapPin,ArrowRight} from 'lucide-react';
import {Chip} from './UI';
import {money,labels} from '../utils/format';
export const courtImage=c=>c.imageUrl||`/images/court-${({HARD:'hard',CLAY:'clay',GRASS:'grass'})[c.type]||'hard'}.webp`;
export const courtDescription=c=>c.description||({HARD:'Mặt sân cứng cho các buổi tập và thi đấu tennis. Xem giá theo từng giờ trước khi đặt.',CLAY:'Mặt sân đất nện. Chọn lịch và kiểm tra trạng thái sân trước buổi chơi.',GRASS:'Mặt sân cỏ. Lịch sử dụng phụ thuộc trạng thái hoạt động và bảo trì.'})[c.type];
export function CourtPhoto({court}){const fallback=`/images/court-${({HARD:'hard',CLAY:'clay',GRASS:'grass'})[court.type]||'hard'}.webp`;return <figure className="court-photo"><img src={courtImage(court)} alt={`${court.name} · ${labels[court.type]}${!court.imageUrl||court.imageIsIllustration?' (ảnh minh họa)':''}`} loading="lazy" width="1200" height="800" onError={e=>{if(!e.currentTarget.src.endsWith(fallback)){e.currentTarget.src=fallback;e.currentTarget.closest('figure').querySelector('figcaption').textContent='Ảnh minh họa';}}}/><figcaption>{!court.imageUrl||court.imageIsIllustration?'Ảnh minh họa':'Ảnh sân do CLB cung cấp'}</figcaption></figure>;}
export default function CourtGallery({courts,club={},onChoose}){return <div className="court-gallery">{courts.filter(c=>c.status!=='INACTIVE').map(c=><article className="court-card" key={c.id}><CourtPhoto court={c}/><div className="court-card-body"><div className="customer-order-top"><span className="section-kicker">{labels[c.type]}</span><Chip status={c.status}/></div><h3>{c.name}</h3><p>{courtDescription(c)}</p>{c.amenities&&<p className="court-amenities">{c.amenities}</p>}<p className="court-address"><MapPin size={16}/>{c.address||club.address||'Địa chỉ đang cập nhật'}</p><div className="court-price"><span>Giá cơ bản <b>{money(c.price)}<small>/giờ</small></b></span>{c.status==='ACTIVE'&&<button className="btn primary" onClick={()=>onChoose(c.id)}>Chọn sân <ArrowRight size={16}/></button>}</div></div></article>)}</div>;}
```

#### File: `frontend/src/components/CustomerDialogs.jsx`
```jsx
import React from 'react';
import BookingFlow from './BookingFlow';
import {FinancialSummary,StaffLines} from './OrderSummary';
import OrderActions from './OrderActions';
import {OrderTimeline} from '../pages/CustomerHistory';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Chip,Table} from './UI';
import {OrderActionDialog,InvoiceDialog} from './OrderDialogs';
import {money,labels,today} from '../utils/format';
export default function CustomerDialogs({dialog,onClose}){
 const {data,user,show,mutate,notify,navigate}=useCourtly(),p={...dialog,onClose};

 if(dialog.type==='cancel'||dialog.type==='move')return data.orders.some(o=>o.id===dialog.id)?<OrderActionDialog {...p}/>:null;
 if(dialog.type==='invoice')return data.orders.some(o=>o.id===dialog.id&&o.invoice)?<InvoiceDialog {...p}/>:null;
 if(dialog.type==='booking')return <BookingFlow {...p}/>;
 if(dialog.type==='order'){
  const o=data.orders.find(o=>o.id===dialog.id);if(!o)return null;
  const payments=data.payments.filter(p=>p.orderId===o.id),paymentIds=new Set(payments.map(p=>p.id)),refunds=data.refunds.filter(r=>paymentIds.has(r.paymentId));
  return <Modal title="Chi tiết đơn của tôi" onClose={onClose} wide footer={<><Button onClick={()=>{onClose();navigate('profile-orders');}}>Đơn của tôi</Button><Button onClick={onClose}>Đóng</Button>{o.invoice&&<Button className="primary" onClick={()=>show({type:'invoice',id:o.id})}>Xem phiếu thu</Button>}</>}><div className="detail-head"><div className="customer-order-top"><h2>{o.date}</h2><Chip status={o.status}/></div><small>{o.id}</small></div>{o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span><b>{money(s.price)}</b></div>)}{o.products.map(p=><div className="order-line" key={p.id}><span>{p.name} × {p.quantity}{p.type==='RENTAL'?` · ${p.hours} giờ`:''}</span><b>{money(p.lineTotal)}</b></div>)}<StaffLines order={o}/><FinancialSummary order={o}/><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu, trừ hoàn</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div><h3 style={{margin:'20px 0 12px'}}>Lịch sử thanh toán</h3><Table headings={['Thời điểm','Nội dung','Số tiền']} empty={!payments.length&&!refunds.length}>{payments.map(p=><tr key={p.id}><td>{new Date(p.createdAt).toLocaleString('vi-VN')}</td><td>{labels[p.method]}</td><td>{money(p.amount)}</td></tr>)}{refunds.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td><td>Hoàn tiền</td><td>−{money(r.amount)}</td></tr>)}</Table>{o.total>o.paid&&['HOLDING','CONFIRMED','CHECKED_IN'].includes(o.status)&&<div className="notice" style={{marginTop:16}}>{data.club?.paymentInstructions||'Vui lòng liên hệ quầy để thanh toán. Chỉ quản trị viên được ghi nhận khoản thu hoặc hoàn tiền.'}</div>}<OrderActions order={o} details={false}/><details className="history-details"><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>{['CANCELLED','EXPIRED'].includes(o.status)&&o.paid>0&&<p className="notice">Đơn đã kết thúc, còn {money(o.paid)} đã thu sau hoàn. Liên hệ quầy để kiểm tra khoản hoàn theo chính sách.</p>}</Modal>;
 }
 if(dialog.type==='registration'){
  const t=data.tournaments.find(t=>t.id===dialog.id);if(!t)return null;
  return <FormDialog title={`Đăng ký · ${t.name}`} initial={{name:user.name,members:''}} fields={[{name:'name',label:t.format==='SINGLES'?'Tên thi đấu':'Tên đội',full:true},...(t.format!=='SINGLES'?[{name:'members',label:t.format==='DOUBLES'?'Tên đồng đội':'Thành viên bổ sung, mỗi dòng một người',type:'textarea',full:true}]:[])]} onClose={onClose} submitText="Xác nhận đăng ký" onSubmit={async v=>{await mutate(`/tournaments/${t.id}/registrations`,{accountId:user.accountId,name:v.name,members:t.format==='SINGLES'?[]:v.members.split('\n').map(x=>x.trim()).filter(Boolean)});notify('Đã đăng ký giải');show({type:'tournament',id:t.id});}}><div className="notice" style={{marginBottom:18}}>Người đăng ký: {user.name}. Phí tham gia: {money(t.fee)}. {t.fee>0?'Liên hệ quầy để thanh toán và xác nhận đăng ký.':''}</div></FormDialog>;
 }
 if(dialog.type==='tournament'){
  const t=data.tournaments.find(t=>t.id===dialog.id),r=data.registrations.find(r=>r.tournamentId===dialog.id);if(!t)return null;
  return <Modal title={t.name} onClose={onClose} footer={<><Button onClick={onClose}>Đóng</Button>{!r&&t.status==='OPEN'&&t.deadline>=today()&&<Button className="primary" onClick={()=>show({type:'registration',id:t.id})}>Đăng ký</Button>}</>}><div className="detail-head"><Chip status={t.status}/><h3 style={{marginTop:12}}>{labels[t.format]} · {t.location}</h3><p>{t.start} → {t.end}</p></div><div className="summary-line"><span>Phí đăng ký</span><b>{money(t.fee)}</b></div><div className="summary-line"><span>Hạn đăng ký</span><b>{t.deadline}</b></div><div className="summary-line"><span>Đã đăng ký</span><b>{t.registeredCount}/{t.max}</b></div>{r&&<><h3 style={{marginTop:20}}>Đăng ký của bạn</h3><p>{r.name}</p><Chip status={r.status}/><p className="subtitle" style={{marginTop:10}}>{r.members.join(' · ')}</p><div className="summary-line"><span>Đã thanh toán</span><b>{money(r.paid)}</b></div></>}</Modal>;
 }
 return null;
}
```

#### File: `frontend/src/components/DialogHost.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React from 'react';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Table} from './UI';
import MoveDialog from './MoveDialog';
import EntityDialog from './EntityDialog';
import {BookingDialog,OrderDetail,OrderActionDialog,PaymentDialog,RefundDialog,InvoiceDialog,ExtendOrderDialog} from './OrderDialogs';
import {TournamentDetail,TournamentActionDialog,MatchDetail,MatchActionDialog} from './TournamentDialogs';
import OrderTable from './OrderTable';
import {money,labels,localDate} from '../utils/format';
export default function DialogHost({dialog,onClose}){
 const {data,date,mutate,notify}=useCourtly();if(!dialog)return null;
 const p={...dialog,onClose};
 switch(dialog.type){
  case 'legacy-staff':{const order=data.orders.find(o=>o.id===dialog.id),line=order.staff.find(x=>x.id===dialog.lineId);return <FormDialog title="Xác minh phân công cũ — giữ ID và giá" initial={{requestId:crypto.randomUUID(),reason:''}} fields={[...Array.from({length:line.hours},(_,i)=>({name:'slot'+i,label:'Slot phục vụ '+(i+1),options:[{value:'',label:'Chọn slot thực tế'},...order.slots.map(s=>({value:s.id,label:`${data.courts.find(c=>c.id===s.court)?.name} ${slotLabel(s)}`}))]})),{name:'reason',label:'Căn cứ xác minh tại quầy',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${dialog.id}/legacy-staff`,{lineId:line.id,scheduleIds:Array.from({length:line.hours},(_,i)=>v['slot'+i]),reason:v.reason,requestId:v.requestId});notify('Đã xác minh, giữ nguyên ID và giá lịch sử');onClose();}}><p className="notice">{line.name} · {line.hours} giờ · giá lịch sử {money(line.rate)}/giờ. Chỉ chọn khi có căn cứ thực tế; hệ thống kiểm tra lịch làm việc và trùng giờ. Nếu chưa đủ dữ liệu, đóng và giữ nhãn cần kiểm tra.</p></FormDialog>;}
  case 'restore':return <MoveDialog {...p} mode="restore"/>;
  case 'check-in':return <FormDialog title="Kiểm tra check-in" fields={[{name:'reason',label:'Lý do ngoại lệ (nếu ngoài giờ cấu hình hoặc thiếu cọc)',required:false,full:true}]} onClose={onClose} submitText="Check-in" onSubmit={async v=>{await mutate(`/orders/${dialog.id}/check-in`,v);notify('Đã check-in');onClose();}}><p className="notice">Giờ check-in sớm: {data.settings.policies?.checkInEarlyMinutes??'chưa cấu hình'} phút. Ngoài cửa sổ giờ hoặc chưa đủ cọc cần lý do ngoại lệ.</p></FormDialog>;
  case 'financial-review':return <FormDialog title="Đối chiếu tiền" initial={{requestId:crypto.randomUUID(),action:'review',amount:0,reason:''}} fields={[{name:'action',label:'Xử lý',options:[{value:'review',label:'Ghi nhận đã đối chiếu'},{value:'refund-request',label:'Duyệt khoản cần hoàn, chờ thực hiện'}]},{name:'amount',label:'Số tiền hoàn dự kiến (nếu duyệt hoàn)',type:'number',min:0},{name:'reason',label:'Kết quả đối chiếu / cơ sở quyết định',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/orders/${dialog.id}/${v.action}`,{...v,resolved:true});notify('Đã ghi kết quả đối chiếu');onClose();}}><p className="notice">Không khôi phục lịch tự động. Khoản hoàn chỉ ghi là đã hoàn sau khi thực hiện và ghi nhận tại Thu tiền & hoàn tiền.</p></FormDialog>;
  case 'entity':return <EntityDialog {...p}/>;
  case 'booking':return <BookingDialog {...p}/>;
  case 'order':return <OrderDetail {...p}/>;
  case 'extend-order':return <ExtendOrderDialog {...p}/>;
  case 'cancel':case 'move':case 'assign-staff':return <OrderActionDialog {...p}/>;
  case 'payment':return <PaymentDialog {...p}/>;
  case 'refund':return <RefundDialog {...p}/>;
  case 'invoice':return <InvoiceDialog {...p}/>;
  case 'tournament':return <TournamentDetail {...p}/>;
  case 'registration':case 'draw':return <TournamentActionDialog {...p}/>;
  case 'match':return <MatchDetail {...p}/>;
  case 'match-schedule':case 'match-result':return <MatchActionDialog {...p}/>;
  case 'customer-history':return <Modal title={`Lịch sử · ${data.accounts.find(a=>a.id===dialog.id)?.name}`} onClose={onClose} wide><OrderTable orders={data.orders.filter(o=>o.accountId===dialog.id)}/></Modal>;
  case 'settings':return <FormDialog title="Chính sách giữ chỗ" initial={{...data.settings,...data.settings.policies}} fields={[{name:'holdMinutes',label:'Thời gian giữ (phút)',type:'number',min:1,max:60},{name:'depositPercent',label:'Tiền cọc (%)',type:'number',min:1,max:100},{name:'cancelRefundPercent',label:'Tỷ lệ tiền chờ hoàn khi hủy hợp lệ (%)',type:'number',min:0,max:100,full:true},...['cancelCutoffMinutes','changeCutoffMinutes','checkInEarlyMinutes','additionalPaymentMinutes'].map((key,i)=>({name:key,label:['Hạn hủy trước giờ chơi (phút)','Hạn đổi trước giờ chơi (phút)','Cho check-in sớm (phút)','Hạn thu thêm sau đổi lịch (phút)'][i],type:'number',min:0,max:10080,required:false})),...['lateCancellation','noShow','closureWeather'].map((key,i)=>({name:key,label:['Hủy sát giờ: hướng dẫn xử lý','Khách không đến: hướng dẫn xử lý','Sân đóng / thời tiết / bảo trì: hướng dẫn'][i],type:'textarea',full:true,required:false}))]} onClose={onClose} onSubmit={async v=>{await mutate('/settings',{...v,policies:Object.fromEntries(['cancelCutoffMinutes','changeCutoffMinutes','checkInEarlyMinutes','additionalPaymentMinutes','lateCancellation','noShow','closureWeather'].map(k=>[k,v[k]??null]))},'PUT');notify('Đã lưu chính sách');onClose();}}/>;
  case 'closing':{
   const memRows=(data.membershipPayments||[]).map(m=>({...m,type:'MEMBERSHIP_FEE'}));
   const rows=[...data.payments, ...memRows].filter(p=>localDate(p.createdAt)===date),refund=data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0),total=rows.reduce((a,p)=>a+p.amount,0);
   return <Modal title={`Đối chiếu ca · ${date}`} onClose={onClose} footer={<Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button>}><Table headings={['Giao dịch','Phương thức','Tiền thu']} empty={!rows.length}>{rows.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}{p.type==='MEMBERSHIP_FEE'?` (${p.planName||'Hội viên'})`:''}</td><td>{labels[p.method]||p.method}</td><td>{money(p.amount)}</td></tr>)}</Table><div className="summary-line"><span>Tổng thu</span><b>{money(total)}</b></div><div className="summary-line"><span>Đã hoàn</span><b>{money(refund)}</b></div><div className="summary-line total"><span>Thu ròng</span><b>{money(total-refund)}</b></div></Modal>;
  }
  default:return null;
 }
}
```

#### File: `frontend/src/components/EntityDialog.jsx`
```jsx
import React from 'react';
import { FormDialog } from './UI';
import { useCourtly } from '../context';
import { options, today } from '../utils/format';
export default function EntityDialog({ collection, row = {}, onClose }) {
  const { data, mutate, notify, date } = useCourtly();
  const names = { courts:'sân', prices:'khung giá', accounts:'tài khoản', staff:'nhân sự', 'staff-schedules':'lịch làm việc', tournaments:'giải đấu' };
  const f = (name,label,type='text',extra={}) => ({name,label,type,...extra});
  const s = (name,label,values,extra={}) => ({name,label,options:values,...extra});
  const status = s('status','Trạng thái',options(['ACTIVE','INACTIVE']));
  const choose = list => list.map(x => ({value:x.id,label:x.name}));
  let fields = [], defaults = {};
  if (collection === 'courts') { fields = [f('name','Tên sân'),s('type','Loại sân',options(['HARD','CLAY','GRASS'])),f('price','Giá cơ bản / giờ (₫)','number',{min:1}),s('status','Trạng thái',options(['ACTIVE','MAINTENANCE','INACTIVE'])),f('description','Mô tả sân','textarea',{full:true,required:false,maxLength:2000}),f('address','Địa chỉ sân (để trống dùng địa chỉ CLB)','text',{full:true,required:false,maxLength:400}),f('amenities','Tiện ích thực tế','text',{full:true,required:false,maxLength:500}),f('imageUrl','URL ảnh HTTPS (để trống dùng ảnh minh họa)','text',{full:true,required:false,maxLength:1000}),s('imageIsIllustration','Nguồn ảnh',[{value:'true',label:'Ảnh minh họa'},{value:'false',label:'Ảnh sân thật do CLB cung cấp'}])]; defaults={type:'HARD',price:180000,status:'ACTIVE',description:'',address:'',amenities:'',imageUrl:'',imageIsIllustration:true}; }
  if (collection === 'prices') { fields=[s('court','Sân',choose(data.courts)),s('dayType','Loại ngày',options(['WEEKDAY','WEEKEND'])),f('start','Giờ bắt đầu','number',{min:6,max:22.5,step:0.5}),f('end','Giờ kết thúc','number',{min:6.5,max:23,step:0.5}),f('price','Giá / giờ (₫)','number',{min:1,full:true})]; defaults={court:data.courts[0]?.id,dayType:'WEEKDAY',start:6,end:17,price:180000}; }
  if (collection === 'accounts') { fields=[f('name','Họ tên'),f('email','Email đăng nhập','email',{readOnly:!!row.loginLinked}),f('phone','Điện thoại','tel'),s('role','Quyền truy cập',options(['CUSTOMER','STAFF','ADMIN']),{disabled:!!row.isOwner}),s('status','Trạng thái',options(['ACTIVE','LOCKED']),{disabled:!!row.isOwner})]; defaults={role:'CUSTOMER',status:'ACTIVE'}; }
  if (collection === 'staff') { fields=[f('name','Họ tên'),s('type','Vị trí',options(['REFEREE','COACH','BALL_BOY'])),f('phone','Điện thoại','tel'),f('rate','Đơn giá / giờ (₫)','number',{min:1}),status]; defaults={type:'REFEREE',rate:120000,status:'ACTIVE'}; }
  if (collection === 'staff-schedules') { fields=[s('staff','Nhân sự',choose(data.staff)),f('date','Ngày làm việc','date'),f('start','Giờ bắt đầu','number',{min:6,max:22.5,step:0.5}),f('end','Giờ kết thúc','number',{min:6.5,max:23,step:0.5})]; defaults={staff:data.staff[0]?.id,date,start:6,end:23}; }
  if (collection === 'tournaments') { fields=[f('name','Tên giải','text',{full:true}),s('format','Thể thức',options(['SINGLES','DOUBLES','TEAM'])),s('status','Trạng thái',options(['DRAFT','OPEN','CLOSED','ONGOING','FINISHED','CANCELLED'])),f('startDate','Ngày bắt đầu','date'),f('endDate','Ngày kết thúc','date'),f('deadline','Hạn đăng ký','date'),f('location','Địa điểm'),f('fee','Phí đăng ký (₫)','number',{min:0}),f('max','Số đăng ký tối đa','number',{min:2,max:1024})]; defaults={format:'DOUBLES',status:'OPEN',startDate:row.start||today(),endDate:row.end||today(),deadline:today(),location:'CLB Courtly',fee:300000,max:16}; }
  return <FormDialog title={`${row.id ? 'Sửa' : 'Thêm'} ${names[collection]}`} fields={fields} initial={{...defaults,...row}} onClose={onClose} onSubmit={async values => {
    // Send only the catalog DTO fields, never view-only ids or calculated columns.
    const body=Object.fromEntries(fields.map(f=>[f.name,values[f.name]]));if(collection==='courts')body.imageIsIllustration=String(values.imageIsIllustration??true)==='true';
    await mutate(`/catalog/${collection}${row.id ? '/'+row.id : ''}`,body,row.id?'PUT':'POST');
    notify('Đã lưu thông tin'); onClose();
  }}>{collection==='accounts'&&<div className="notice" style={{marginBottom:18}}>Khách đăng nhập bằng đúng email này sẽ nhận quyền đã cấp. Email đã liên kết đăng nhập được giữ cố định. Chủ Site không thể bị khóa hoặc hạ quyền.</div>}{collection==='prices' && <div className="notice" style={{marginBottom:18}}>Giá áp dụng khi sinh lịch mới. Các slot đã sinh giữ giá đã chụp.</div>}{collection==='staff-schedules' && <div className="notice" style={{marginBottom:18}}>Thêm mới sẽ chia khoảng thời gian thành từng slot 30 phút.</div>}</FormDialog>;
}
```

#### File: `frontend/src/components/MembershipPlans.jsx`
```jsx
import React from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import {Button} from './UI';
import {money} from '../utils/format';
export default function MembershipPlans({plans=[],onChoose,busy=false,blocked=false}){
 return <div className="membership-plans"><article className="membership-plan"><span className="section-kicker">CHƠI THEO NHU CẦU</span><h2>Guest</h2><p>Cho những cuộc hẹn ngẫu hứng.</p><div className="membership-price">Miễn phí<small>Không phí hội viên</small></div><ul><li><Check size={18}/>Đặt sân theo giá niêm yết</li><li><Check size={18}/>Chọn nhiều giờ liên tiếp trên mỗi sân</li><li><Check size={18}/>Thêm trọng tài cho từng khung giờ</li></ul><a className="btn" href="/#booking">Chọn sân <ArrowUpRight size={20}/></a></article>{plans.filter(p=>p.enabled).map((p,i)=><article key={p.id} className={`membership-plan ${i===0?'featured':''}`}><span className="section-kicker">COURTLY MEMBERSHIP</span><h2>{p.name}</h2><p>{p.description}</p><div className="membership-price">{money(p.price)}<small>/ {p.days} ngày · Không tự gia hạn</small></div><ul><li><Check size={18}/><strong>Giảm {p.discountPercent}% tiền sân</strong></li><li><Check size={18}/>Áp dụng giờ chơi trong hạn hội viên</li><li><Check size={18}/>Theo dõi quyền lợi trong tài khoản</li></ul><Button className={i===0?'primary':''} disabled={busy||blocked} onClick={()=>onChoose(p)}>{blocked?'Đã có gói / đăng ký đang chờ':'Chọn gói '+p.name}<ArrowUpRight size={20}/></Button></article>)}</div>;
}
export function MembershipTerms(){return <section className="membership-terms"><div><span className="section-kicker">RÕ QUYỀN LỢI. RÕ ĐIỀU KIỆN.</span><h2>Trước khi tham gia.</h2></div><div><details open><summary>Ưu đãi áp dụng như thế nào?</summary><p>Giảm trên tiền sân cho những khung giờ nằm trọn trong thời hạn hội viên; không giảm phí trọng tài hoặc phí giải. Không cộng dồn với ưu đãi khác. Tiền cọc tính theo tỷ lệ chính sách hiện tại và hiển thị trước khi giữ chỗ.</p></details><details><summary>Khi nào gói có hiệu lực?</summary><p>Đăng ký tạo yêu cầu chờ xác nhận. Quầy chỉ kích hoạt khi đã kiểm tra nhận đủ phí. Hiệu lực tính từ lúc kích hoạt, không tự gia hạn. Mỗi tài khoản có một gói hoạt động hoặc một đăng ký đang chờ.</p></details><details><summary>Đổi lịch có giữ nguyên ưu đãi không?</summary><p>Lịch mới được kiểm tra lại quyền lợi tại thời điểm đổi. Giờ chơi ngoài thời hạn hội viên dùng giá thường; tổng và cọc mới được hiển thị trước khi xác nhận. Đơn cũ không bị thay giá khi gói hết hạn.</p></details></div></section>;}
```

#### File: `frontend/src/components/MoveDialog.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React,{useState,useRef} from 'react';
import {useCourtly} from '../context';
import {api} from '../services/api';
import {Modal,Button} from './UI';
import {PolicyNotice} from './OrderSummary';
import {RefereeSlots} from './BookingFlow';
import {money,today} from '../utils/format';
export default function MoveDialog({id,onClose,mode='move'}){
 const {data,isAdmin,mutate,show,notify}=useCourtly(),o=data.orders.find(x=>x.id===id),assign=mode==='assign',restore=mode==='restore';
 const [form,setForm]=useState({date:o.date,court:o.slots[0]?.court,start:o.slots[0]?.hour,hours:o.slots.reduce((n,s)=>n+slotHours(s),0),reason:''}),[options,setOptions]=useState(null),[assignments,setAssignments]=useState([]),[preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const requestId=useRef(crypto.randomUUID());
 const edit=(key,value)=>{setForm(v=>({...v,[key]:value}));setOptions(null);setPreview(null);requestId.current=crypto.randomUUID();};
 const load=async()=>{setError('');setBusy(true);try{let ids=o.slots.map(s=>s.id);if(!assign){await api('/schedules/generate','POST',{date:form.date});const snap=await api('/overview?date='+form.date);const chosen=snap.schedules.filter(s=>s.court===form.court&&s.hour>=Number(form.start)&&s.hour+slotHours(s)<=Number(form.start)+Number(form.hours)).sort((a,b)=>a.hour-b.hour);ids=chosen.map(s=>s.id);if(!chosen.length||chosen[0].hour!==Number(form.start)||chosen.reduce((n,s)=>n+slotHours(s),0)!==Number(form.hours))throw Error('Khoảng giờ không hợp lệ');}const opts=await api('/booking/options','POST',{scheduleIds:ids,excludeId:id});setOptions(opts);setAssignments(o.staff.filter(x=>x.scheduleId&&ids.includes(x.scheduleId)).map(x=>({staffId:x.staffId,scheduleId:x.scheduleId})));setPreview(null);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const payload=()=>({requestId:requestId.current,scheduleIds:options.slots.map(s=>s.id),assignments,reason:form.reason});
 const review=async()=>{setBusy(true);setError('');try{setPreview(await api(`/orders/${id}/preview`,'POST',payload()));}catch(e){setError(e.message);}finally{setBusy(false);}};
 const submit=async()=>{if(busy)return;setBusy(true);setError('');try{await mutate(`/orders/${id}/${assign?'staff':restore?'restore':'schedule'}`,payload(),assign||restore?'POST':'PATCH');notify('Đã cập nhật; lịch sử và chứng từ được giữ lại');show({type:'order',id});}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal title={assign?'Phân công trọng tài theo slot':restore?'Khôi phục / đổi lịch sau đối chiếu':'Kiểm tra đổi lịch'} onClose={()=>!busy&&onClose()} wide><p className="notice">Lịch cũ: {o.date} · {o.slots.map(s=>`${data.courts.find(c=>c.id===s.court)?.name} ${slotLabel(s)}`).join(' / ')} · {money(o.total)}</p>{o.staff.length>0&&<p>Trọng tài cũ: {o.staff.map(x=>`${x.name} · ${x.scheduleId?slotLabel(x):'cần kiểm tra phân công cũ'}`).join(', ')}. Chọn rõ slot mới hoặc xác nhận không thuê; không tự chuyển phân công.</p>}{!assign&&<div className="form-grid"><label className="field">Ngày mới<input type="date" min={today()} value={form.date} onChange={e=>edit('date',e.target.value)}/></label><label className="field">Sân<select value={form.court} onChange={e=>edit('court',e.target.value)}>{data.courts.filter(c=>c.status==='ACTIVE').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field">Giờ bắt đầu<input type="number" min={6} max={22.5} step={0.5} value={form.start} onChange={e=>edit('start',Number(e.target.value))}/></label><label className="field">Số giờ liên tục<input type="number" min={0.5} max={17} step={0.5} value={form.hours} onChange={e=>edit('hours',Number(e.target.value))}/></label></div>}{isAdmin&&<label className="field">Lý do thực hiện<input value={form.reason} maxLength={500} onChange={e=>{setForm({...form,reason:e.target.value});requestId.current=crypto.randomUUID();setPreview(null);}}/></label>}<div className="step-row"><Button disabled={busy} onClick={load}>Kiểm tra sân và trọng tài</Button></div>{options&&<><RefereeSlots options={options} value={assignments} onChange={rows=>{setAssignments(rows);setPreview(null);requestId.current=crypto.randomUUID();}}/>{assign?<Button className="primary" disabled={busy} onClick={submit}>Xác nhận phân công</Button>:<Button disabled={busy} onClick={review}>Xem lịch mới & chênh lệch tiền</Button>}</>}{preview&&<><h3>Lịch mới: {preview.next.date}</h3>{preview.next.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} {slotLabel(s)} · {preview.next.staff.find(x=>x.scheduleId===s.id)?.name||'Không thuê trọng tài'}</span><b>{money(s.price)}</b></div>)}<p>Tổng mới: <b>{money(preview.next.total)}</b> · Chênh lệch: {money(preview.difference)}</p><p>Còn phải thu: {money(preview.additionalDue)} · Cần xử lý chênh lệch theo chính sách: {money(preview.reviewAmount)}</p><p className="notice">Xác nhận sẽ kiểm tra lại sân và trọng tài. Có xung đột thì giữ nguyên toàn bộ lịch cũ. Không tự hoàn hoặc thu phí phạt.</p><Button className="primary" disabled={busy||isAdmin&&!form.reason.trim()} onClick={submit}>Xác nhận {restore?'khôi phục':'đổi lịch'}</Button></>}<PolicyNotice/>{error&&<p className="error" role="alert">{error}</p>}</Modal>;
}
```

#### File: `frontend/src/components/OrderActions.jsx`
```jsx
import React from 'react';
import {useCourtly} from '../context';
import {Button} from './UI';

export const beforePlay = order => order.slots.length > 0 && order.slots.every(slot =>
  Date.parse(`${order.date}T${slot.start||`${String(Math.floor(slot.hour)).padStart(2,'0')}:${slot.hour%1?'30':'00'}:00`}+07:00`) > Date.now());
export const canRent = order => ['HOLDING','CONFIRMED'].includes(order.status) && beforePlay(order);
export const canEdit = (order,isAdmin=false) => ['HOLDING','CONFIRMED'].includes(order.status) && (isAdmin || beforePlay(order));
export const canCancel = (order,isAdmin=false) => isAdmin
  ? ['HOLDING','CONFIRMED','CHECKED_IN'].includes(order.status)
  : canEdit(order);

export default function OrderActions({order,details=true}){
  const {show,isAdmin}=useCourtly();
  return <div className="step-row">
    {details&&<Button className="sm" onClick={()=>show({type:'order',id:order.id})}>Chi tiết đơn</Button>}
    {isAdmin&&canRent(order)&&<Button className="primary sm" onClick={()=>show({type:'assign-staff',id:order.id})}>Chọn trọng tài</Button>}
    {canEdit(order,isAdmin)&&<Button className="sm" onClick={()=>show({type:'move',id:order.id})}>Sửa lịch</Button>}
    {canCancel(order,isAdmin)&&<Button className="sm danger" onClick={()=>show({type:'cancel',id:order.id})}>Hủy lịch</Button>}
  </div>;
}
```

#### File: `frontend/src/components/OrderDialogs.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React,{useRef,useState} from 'react';
import BookingFlow from './BookingFlow';
import MoveDialog from './MoveDialog';
import {FinancialSummary,StaffLines,PolicyNotice} from './OrderSummary';
import OrderActions from './OrderActions';
import {OrderTimeline} from '../pages/CustomerHistory';
import { useCourtly } from '../context';
import { Modal, FormDialog, Button, Chip, Table } from './UI';
import { api } from '../services/api';
import { money, active, options } from '../utils/format';

async function resolveSlots(values) {
  await api('/schedules/generate','POST',{date:values.date});
  const snapshot=await api(`/overview?date=${values.date}`);
  const start=Number(values.start),end=start+Number(values.hours);
  const rows=snapshot.schedules.filter(s=>s.court===values.court&&s.hour>=start&&s.hour+slotHours(s)<=end).sort((a,b)=>a.hour-b.hour);
  if(!rows.length||rows[0].hour!==start||rows.reduce((n,s)=>n+slotHours(s),0)!==Number(values.hours)) throw new Error('Khoảng giờ phải liên tục và nằm trong 06:00–23:00.');
  return rows.map(s=>s.id);
}
export {resolveSlots};

export const BookingDialog=BookingFlow;
export function OrderDetail({id,onClose}) {
  const {data,show,mutate,notify}=useCourtly();
  const o=data.orders.find(x=>x.id===id);
  if(!o) return null;
  const acc=data.accounts?.find(a=>a.id===o.accountId);
  const doAction=async (op,body={})=>{try{await mutate(`/orders/${id}/${op}`,body);notify('Đã cập nhật đơn');}catch(e){notify(e.message);}};

  return <Modal title={`Chi tiết đơn đặt sân #${o.id.slice(0,8)}`} onClose={onClose} wide footer={<>
    {o.status==='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu cọc tại quầy ({money(o.deposit)})</Button>}
    {o.status==='CONFIRMED'&&<Button className="primary" onClick={()=>show({type:'check-in',id})}>Thực hiện Check-in vào sân</Button>}
    {o.status==='CHECKED_IN'&&<Button className="primary" onClick={()=>doAction('check-out')}>Check-out & Hoàn tất</Button>}
    {o.status==='CHECKED_IN'&&<Button onClick={()=>show({type:'extend-order',id})}>⚡ Gia hạn giờ chơi</Button>}
    {active(o)&&o.paid<o.total&&o.status!=='HOLDING'&&<Button className="lime" onClick={()=>show({type:'payment',id})}>Thu nốt tiền ({money(o.total-o.paid)})</Button>}
    {!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}
    <Button onClick={onClose}>Đóng</Button>
  </>}>
    <div className="order-lifecycle-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '0 0 18px', padding: '12px 14px', background: '#f8faf7', borderRadius: 8, border: '1px solid #dce4d6' }}>
      <div style={{ textAlign: 'center', opacity: ['HOLDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'HOLDING' ? '#b45309' : '#173c32' }}>1. GIỮ CHỖ</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.status === 'HOLDING' ? 'Đang giữ 5p' : '✓ Đã tạo đơn'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'CONFIRMED' ? '#15803d' : '#173c32' }}>2. ĐÃ CỌC (50%)</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.paid >= o.deposit ? `✓ ${money(o.deposit)}` : 'Chờ cọc'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: ['CHECKED_IN', 'COMPLETED'].includes(o.status) ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'CHECKED_IN' ? '#2563eb' : '#173c32' }}>3. CHECK-IN</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.checkInAt ? new Date(o.checkInAt).toLocaleTimeString('vi-VN') : 'Chưa vào sân'}</small>
      </div>
      <div style={{ textAlign: 'center', opacity: o.status === 'COMPLETED' ? 1 : 0.4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: o.status === 'COMPLETED' ? '#173c32' : '#666' }}>4. HOÀN TẤT</span>
        <small style={{ display: 'block', fontSize: 10, color: '#666', marginTop: 2 }}>{o.checkOutAt ? new Date(o.checkOutAt).toLocaleTimeString('vi-VN') : 'Check-out'}</small>
      </div>
    </div>

    <div className="detail-head">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>{o.name}</h2>
        <Chip status={o.status}/>
      </div>
      <small style={{display:'block',marginTop:4}}>Mã đơn: <b>{o.id}</b> • Điện thoại: <b>{o.phone || acc?.phone || 'Chưa cung cấp'}</b> • Email: <b>{acc?.email || 'Khách vãng lai tại quầy'}</b></small>
    </div>

    {o.status==='HOLDING' && (
      <div className="notice" style={{marginTop:12, background:'#fffbeb', borderColor:'#fde68a', color:'#92400e'}}>
        ⏳ <b>Đơn đang trong thời hạn giữ chỗ:</b> Hạn thanh toán cọc đến {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}. Nếu khách không cọc hoặc quầy không xác nhận, hệ thống sẽ tự động giải phóng sân.
      </div>
    )}
    {o.status==='CONFIRMED' && (
      <div className="notice" style={{marginTop:12, background:'#f0fdf4', borderColor:'#bbf7d0', color:'#166534'}}>
        ✓ <b>Lịch đặt đã được xác nhận</b> (Đã cọc {money(o.paid)}). Lễ tân kiểm tra thẻ hội viên/thông tin và bấm <b>"Thực hiện Check-in vào sân"</b> khi khách tới.
      </div>
    )}
    {o.status==='CHECKED_IN' && (
      <div className="notice" style={{marginTop:12, background:'#eff6ff', borderColor:'#bfdbfe', color:'#1e40af'}}>
        🎾 <b>Khách đang chơi trên sân</b> (Check-in lúc {new Date(o.checkInAt).toLocaleTimeString('vi-VN')}). Khi hết giờ, kiểm tra sân và bấm <b>"Check-out & Hoàn tất"</b>.
      </div>
    )}
    {o.status==='COMPLETED' && (
      <div className="notice" style={{marginTop:12, background:'#f8fafc', borderColor:'#e2e8f0', color:'#475569'}}>
        ✓ <b>Buổi chơi đã hoàn tất</b> (Check-out lúc {o.checkOutAt ? new Date(o.checkOutAt).toLocaleTimeString('vi-VN') : 'Đúng giờ'}).
      </div>
    )}

    <div className="detail-grid" style={{marginTop:14}}>
      <div><span>Ngày chơi</span><b>{o.date}</b></div>
      <div><span>Phân loại khách</span><b>{o.accountId?'Tài khoản thành viên':'Khách lẻ tại quầy'}</b></div>
      {o.status==='HOLDING'&&<><div><span>Hạn giữ chỗ</span><b>{new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</b></div><div><span>Cọc yêu cầu</span><b>{money(o.deposit)}</b></div></>}
      {o.checkInAt&&<div><span>Thời gian Check-in</span><b>{new Date(o.checkInAt).toLocaleString('vi-VN')}</b></div>}
      {o.checkOutAt&&<div><span>Thời gian Check-out</span><b>{new Date(o.checkOutAt).toLocaleString('vi-VN')}</b></div>}
    </div>

    <h3 style={{marginTop:20}}>Khung giờ sân</h3>
    {o.slots.map(s=><div className="order-line" key={s.id}><span>{data.courts.find(c=>c.id===s.court)?.name} • {slotLabel(s)}</span><b>{money(s.price)}</b></div>)}
    {o.products.length>0&&<details><summary>Khoản thu lịch sử trước khi ngừng dịch vụ</summary>{o.products.map(p=><div className="order-line" key={p.id}><span>{p.name} × {p.quantity}</span><b>{money(p.lineTotal)}</b></div>)}</details>}
    <h3 style={{marginTop:20}}>Trọng tài</h3><StaffLines order={o}/><FinancialSummary order={o}/>
    <div style={{marginTop:20}}><div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu (trừ hoàn)</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>
    <div className="step-row no-print" style={{marginTop:16}}>{active(o)&&<><Button className="sm" onClick={()=>show({type:'assign-staff',id})}>Chọn trọng tài</Button></>}{!['HOLDING','CANCELLED','EXPIRED'].includes(o.status)&&<Button className="sm" onClick={async()=>{await doAction('invoice');show({type:'invoice',id});}}>In phiếu thu</Button>}</div>
    <OrderActions order={o} details={false}/>
    <div className="step-row" style={{marginTop:10}}><Button className="sm" onClick={()=>show({type:'financial-review',id})}>Đối chiếu / khoản cần hoàn</Button>{['EXPIRED','CANCELLED'].includes(o.status)&&<><Button className="sm" onClick={()=>show({type:'restore',id})}>Kiểm tra khôi phục / đổi lịch</Button><Button className="sm" onClick={()=>show({type:'payment',id})}>Ghi tiền đến muộn</Button></>}</div>
    <details className="history-details" style={{marginTop:16}}><summary>Lịch sử cập nhật đơn</summary><OrderTimeline order={o} courts={data.courts}/></details>
  </Modal>;
}
export function OrderActionDialog({type,id,onClose}) {
  const {data,mutate,notify,show,isAdmin}=useCourtly();
  const requestId=useRef(crypto.randomUUID());
  const order=data.orders.find(o=>o.id===id);
  const done=()=>{notify('Đã cập nhật đơn');show({type:'order',id});};
  if(type==='cancel') return <FormDialog title="Hủy đơn đặt sân" fields={isAdmin?[{name:'reason',label:'Lý do hủy',full:true}]:[]} onClose={onClose} submitText="Xác nhận hủy" onSubmit={async v=>{await mutate(`/orders/${id}/cancel`,{...v,requestId:requestId.current});done();}}><PolicyNotice/><p>Hủy đơn của <b>{order.name}</b> và nhả {order.slots.length} khung giờ?</p><div className="notice" style={{marginTop:16}}>Đã thu {money(order.paid)}. Hủy sẽ nhả sân và lịch trọng tài. Đơn và giao dịch vẫn được lưu trong lịch sử; tiền không tự hoàn về ngân hàng, cần quầy xử lý riêng.</div></FormDialog>;
  if(type==='assign-staff')return <MoveDialog id={id} mode="assign" onClose={onClose}/>;
  if(type==='move')return <MoveDialog id={id} onClose={onClose}/>;
  return null;
}
export function PaymentDialog({id,registrationId,onClose}) {
  const {data,mutate,notify}=useCourtly();
  const orders=data.orders.filter(o=>(active(o)||o.status==='COMPLETED'||o.id===id)&&o.paid<o.total);
  const order=data.orders.find(o=>o.id===id)||orders[0];
  const reg=data.registrations.find(r=>r.id===registrationId);
  const due=reg?data.tournaments.find(t=>t.id===reg.tournamentId).fee-reg.paid:order?order.total-order.paid:0;
  const targetId=reg?reg.id:order?.id;
  const refCode=targetId?('CT'+targetId.replace(/-/g,'').substring(0,16).toUpperCase()):'';

  return <FormDialog
    title="Ghi nhận thu tiền mặt tại quầy"
    submitText="Xác nhận đã nhận tiền mặt"
    initial={{orderId:reg?null:order?.id,amount:due,method:'CASH',transactionCode:refCode||crypto.randomUUID()}}
    fields={[
      ...(!reg?[{name:'orderId',label:'Đơn đặt sân',full:true,options:orders.map(o=>({value:o.id,label:`${o.name} • còn ${money(o.total-o.paid)}`}))}]:[]),
      {name:'amount',label:'Số tiền mặt (đ)',type:'number',min:1},
      {name:'reason',label:'Lý do (bắt buộc với tiền đến muộn)',required:false,full:true}
    ]}
    onChange={(v,name)=>{
      const o=data.orders.find(o=>o.id===v.orderId);
      return name==='orderId'&&o?{...v,amount:o.total-o.paid}:v;
    }}
    onClose={onClose}
    onSubmit={async v=>{
      await mutate('/payments',{...v,method:'CASH',orderId:reg?null:v.orderId,registrationId:registrationId||null});
      notify('Đã ghi nhận thu tiền mặt thành công');
      onClose();
    }}
  >
    {reg&&<div className="notice" style={{marginBottom:15}}>Phí giải • {reg.name} • cần {money(due)}</div>}

    <div className="notice" style={{marginBottom:14}}>
      Nhận đủ tiền mặt từ khách tại quầy trước khi bấm [Xác nhận đã nhận tiền mặt]. Khách muốn chuyển khoản vui lòng quét mã VietQR trên đơn đặt sân hoặc hồ sơ cá nhân.
    </div>
  </FormDialog>;
}

export function RefundDialog({id,onClose}) {
  const {data,mutate,notify}=useCourtly();const p=data.payments.find(p=>p.id===id);
  return <FormDialog title="Ghi nhận hoàn tiền" submitText="Xác nhận đã hoàn" initial={{amount:p.refundable,reason:'',requestId:crypto.randomUUID()}} fields={[{name:'amount',label:'Số tiền hoàn (đ)',type:'number',min:1,max:p.refundable,full:true},{name:'reason',label:'Lý do hoàn',full:true}]} onClose={onClose} onSubmit={async v=>{await mutate(`/payments/${id}/refunds`,v);notify('Đã ghi nhận khoản hoàn');onClose();}}><div className="notice" style={{marginBottom:18}}>Có thể hoàn tối đa <b>{money(p.refundable)}</b>.</div></FormDialog>;
}
export function InvoiceDialog({id,onClose}) {
  const {data}=useCourtly();const current=data.orders.find(x=>x.id===id);const o=current.invoiceSnapshot||current;
  return <Modal title={`PHIẾU THU • ${o.invoice||''}`} onClose={onClose} wide footer={<><Button onClick={onClose}>Đóng</Button><Button className="primary" onClick={()=>window.print()}>In / Lưu PDF</Button></>}><h2>COURTLY TENNIS CLUB</h2><p className="subtitle">Ngày phát hành: {o.issuedAt?new Date(o.issuedAt).toLocaleString('vi-VN'):''}</p><div className="detail-head" style={{marginTop:20}}>Khách hàng: {o.name}<br/>Điện thoại: {o.phone}<br/>Ngày sử dụng: {o.date}</div><Table headings={['Dịch vụ','Thành tiền']}>{o.slots.map(s=><tr key={s.id}><td>{data.courts.find(c=>c.id===s.court)?.name} • {slotLabel(s)}</td><td>{money(s.price)}</td></tr>)}{o.products.map(p=><tr key={p.id}><td>{p.name} × {p.quantity}{p.type==='RENTAL'?` • ${p.hours} giờ`:''}</td><td>{money(p.lineTotal??p.price*p.quantity*(p.type==='RENTAL'?p.hours:1))}</td></tr>)}{o.staff.map(s=><tr key={s.id}><td>{s.name} • {s.hours} giờ</td><td>{money(s.rate*s.hours)}</td></tr>)}</Table>{o.membershipBenefit?.discount>0&&<div className="summary-line membership-discount"><span>Ưu đãi {o.membershipBenefit.planName}</span><b>–{money(o.membershipBenefit.discount)}</b></div>}{o.voucherBenefit?.discount>0&&<div className="summary-line voucher-discount" style={{color:'#16a34a'}}><span>Voucher ({o.voucherBenefit.code})</span><b>–{money(o.voucherBenefit.discount)}</b></div>}<div className="summary-line total"><span>Tổng tiền</span><b>{money(o.total)}</b></div><div className="summary-line"><span>Đã thu</span><b>{money(o.paid)}</b></div><div className="summary-line"><span>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn phải thu'}</span><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div><p className="subtitle">Phiếu thu nội bộ • chưa tích hợp hóa đơn điện tử thuế.</p></Modal>;
}

export function ExtendOrderDialog({id, onClose}) {
  const {data, mutate, notify} = useCourtly();
  const o = data.orders.find(x => x.id === id);
  const [loading, setLoading] = useState(true);
  const [extData, setExtData] = useState(null);
  const [error, setError] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/orders/${id}/extension-options`)
      .then(res => {
        setExtData(res);
        if (res.options?.length) setSelectedDuration(res.options[0].duration);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!o) return null;
  const selectedOpt = extData?.options?.find(opt => opt.duration === selectedDuration) || extData?.options?.[0];

  const handleConfirm = async () => {
    if (!selectedOpt) return;
    setSubmitting(true);
    setError('');
    try {
      await mutate(`/orders/${id}/extend`, {
        scheduleIds: selectedOpt.scheduleIds,
        requestId: crypto.randomUUID()
      });
      notify(`Đã gia hạn sân thêm ${selectedOpt.duration} phút thành công!`);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Gia hạn sân · Đơn #${o.id.slice(0,8)} (${o.name})`} onClose={onClose}>
      <p className="subtitle">
        Sân: <b>{extData?.courtName || 'Đang sử dụng'}</b> · Giờ kết thúc hiện tại: <b>{extData?.currentEndTime || '...'}</b>
      </p>

      {loading ? (
        <p role="status">Đang kiểm tra tính khả dụng của sân và bảng giá…</p>
      ) : error ? (
        <p className="error" role="alert">{error}</p>
      ) : !extData?.canExtend ? (
        <div className="notice" style={{background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginTop: 14}}>
          <strong style={{display: 'block', marginBottom: 4}}>⚠️ Không thể gia hạn sân này</strong>
          <p style={{margin: 0}}>{extData?.reason || 'Sân đã có lịch đặt tiếp theo ngay sau giờ chơi.'}</p>
          <small style={{display: 'block', marginTop: 6, color: '#78350f'}}>
            Vui lòng yêu cầu khách trả sân đúng giờ hoặc kiểm tra lịch để sắp xếp sân khác còn trống.
          </small>
          <div style={{marginTop: 14}}>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="notice" style={{background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', margin: '12px 0'}}>
            ✓ Sân trống ở khung giờ liền kề. Có thể gia hạn cho khách ngay!
          </div>

          <div style={{display: 'grid', gap: 10, margin: '14px 0'}}>
            {extData.options.map(opt => {
              const isSelected = selectedDuration === opt.duration;
              return (
                <label
                  key={opt.duration}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #173c32' : '1px solid #dce4d6',
                    background: isSelected ? '#f7faf5' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    <input
                      type="radio"
                      name="staff-ext-duration"
                      checked={isSelected}
                      onChange={() => setSelectedDuration(opt.duration)}
                    />
                    <div>
                      <strong>+{opt.duration} phút ({opt.startTime} – {opt.endTime})</strong>
                      {opt.planName && <small style={{display: 'block', color: '#15803d'}}>★ Ưu đãi {opt.planName}: -{money(opt.discount)}</small>}
                    </div>
                  </div>
                  <b>+{money(opt.total)}</b>
                </label>
              );
            })}
          </div>

          <p className="notice">
            Tiền gia hạn (+{money(selectedOpt?.total || 0)}) sẽ được cộng vào công nợ của đơn. Lễ tân có thể thu nốt tại quầy trước hoặc khi làm thủ tục check-out.
          </p>

          <div className="step-row" style={{marginTop: 16}}>
            <Button disabled={submitting} onClick={onClose}>Hủy</Button>
            <Button className="primary" disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'Đang gia hạn…' : `Xác nhận gia hạn (+${selectedOpt?.duration || 30}p)`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

#### File: `frontend/src/components/OrderSummary.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React from 'react';
import {useCourtly} from '../context';
import {Button} from './UI';
import {money} from '../utils/format';
const statuses={UNPAID:'Chưa thanh toán',PARTIAL:'Thanh toán một phần',PAID:'Đã thanh toán',REFUNDED:'Đã hoàn toàn bộ',PARTIAL_REFUND:'Đã hoàn một phần'};
export function StaffLines({order}){const {data,isAdmin,show}=useCourtly();return <>{order.staff.map(s=><div className="order-line" key={s.id}><span>{s.name} · {s.hours} giờ<small>{s.allocations?s.allocations.map(a=>`${data.courts.find(c=>c.id===a.court)?.name||a.court} ${slotLabel(a)}`).join(', '):s.scheduleId?`${data.courts.find(c=>c.id===s.court)?.name||s.court} · ${slotLabel(s)}`:'Phân công cũ chưa xác định sân/slot · cần admin kiểm tra'}</small></span><div><b>{money(s.rate*s.hours)}</b>{isAdmin&&s.legacyNeedsReview&&['HOLDING','CONFIRMED','CHECKED_IN'].includes(order.status)&&<Button className="sm" onClick={()=>show({type:'legacy-staff',id:order.id,lineId:s.id})}>Xác minh slot cũ</Button>}</div></div>)}</>;}
export function FinancialSummary({order:o}){const f=o.finance||{};return <div className="financial-summary"><h3>Thanh toán · {statuses[f.paymentStatus]||'Cần đối chiếu'}</h3><div className="summary-line"><span>Tiền sân</span><b>{money(o.slots.reduce((n,s)=>n+s.price,0))}</b></div>{o.membershipBenefit?.discount>0&&<div className="summary-line membership-discount"><span>Ưu đãi {o.membershipBenefit.planName}</span><b>−{money(o.membershipBenefit.discount)}</b></div>}{o.voucherBenefit?.discount>0&&<div className="summary-line voucher-discount" style={{color:'#16a34a'}}><span>Voucher ({o.voucherBenefit.code})</span><b>−{money(o.voucherBenefit.discount)}</b></div>}<div className="summary-line"><span>Tiền trọng tài</span><b>{money(o.staff.reduce((n,s)=>n+s.rate*s.hours,0))}</b></div>{o.products.length>0&&<div className="summary-line"><span>Khoản thu dịch vụ cũ</span><b>{money(o.products.reduce((n,p)=>n+(p.lineTotal??p.price*p.quantity*(p.type==='RENTAL'?p.hours:1)),0))}</b></div>}<div className="summary-line"><span>Cọc yêu cầu</span><b>{money(o.deposit)}</b></div><div className="summary-line"><span>Tổng đã thu</span><b>{money(f.grossReceived??o.paid)}</b></div><div className="summary-line"><span>Đã hoàn thực tế</span><b>{money(f.refunded||0)}</b></div><div className="summary-line"><span>Còn phải thu</span><b>{money(f.due??Math.max(0,o.total-o.paid))}</b></div>{o.status==='HOLDING'&&<p className="notice">Hạn giữ chỗ: {new Date(o.holdUntil).toLocaleString('vi-VN')}</p>}{o.additionalDueAt&&<p>Hạn thu bổ sung: {new Date(o.additionalDueAt).toLocaleString('vi-VN')}</p>}{f.balanceNeedsReconciliation&&<p className="notice">Số dư lịch sử chưa khớp chứng từ chi tiết. Quầy cần đối chiếu; hệ thống không tạo giao dịch bù.</p>}{f.refundPending>0&&<p className="notice">Khoản hoàn đã duyệt, chờ thực hiện: {money(f.refundPending)}. Chưa ghi nhận là đã hoàn.</p>}{f.review&&<p className="notice">Cần quầy đối chiếu khoản tiền{f.excess>0?` chênh lệch ${money(f.excess)}`:''}. Số được hoàn tùy chính sách và quyết định được ghi nhận; chưa tự hoàn tiền.</p>}</div>;}

export function PolicyNotice(){const {data}=useCourtly(),p=data.settings.policies||{};return <details className="history-details"><summary>Chính sách đổi / hủy và hỗ trợ</summary><p>Hạn đổi: {p.changeCutoffMinutes==null?'cần liên hệ quầy':p.changeCutoffMinutes+' phút trước giờ chơi'}. Hạn hủy: {p.cancelCutoffMinutes==null?'cần liên hệ quầy':p.cancelCutoffMinutes+' phút trước giờ chơi'}.</p><p>Hủy sát giờ: {p.lateCancellation||'cần liên hệ quầy'}</p><p>Không đến: {p.noShow||'cần liên hệ quầy'}</p><p>Sân đóng / bảo trì / thời tiết: {p.closureWeather||'cần liên hệ quầy'}</p><p>Thu bổ sung sau đổi: {p.additionalPaymentMinutes==null?'cần liên hệ quầy':p.additionalPaymentMinutes+' phút'}. Khoản hoàn cần quầy duyệt và thực hiện, không tự tính phí phạt.</p></details>;}
```

#### File: `frontend/src/components/OrderTable.jsx`
```jsx
import React from 'react';
import { Button, Chip, Table } from './UI';
import { useCourtly } from '../context';
import { money } from '../utils/format';

export default function OrderTable({ orders }) {
  const { data, show } = useCourtly();
  return (
    <Table headings={['Khách hàng','Lịch sân','Tổng tiền','Trạng thái','']} empty={!orders.length}>
      {orders.map(o => (
        <tr key={o.id}>
          <td className="name">{o.name}<small>{o.id.slice(0,8)}</small></td>
          <td>
            {o.slots.slice(0,2).map(s => <div key={s.id}>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00</div>)}
            {o.slots.length>2 && <small>+{o.slots.length-2} giờ</small>}
            <small>{o.date}</small>
          </td>
          <td>{money(o.total)}<small>Đã thu {money(o.paid)}</small></td>
          <td>
            <Chip status={o.status}/>
            {o.status==='COMPLETED' && o.paid < o.total && (
              <span style={{ display:'inline-block', marginLeft:6, padding:'2px 6px', fontSize:11, fontWeight:700, color:'#b91c1c', background:'#fee2e2', borderRadius:4 }}>
                CÒN NỢ {money(o.total - o.paid)}
              </span>
            )}
          </td>
          <td><Button className="sm" onClick={()=>show({type:'order',id:o.id})}>Chi tiết</Button></td>
        </tr>
      ))}
    </Table>
  );
}
```

#### File: `frontend/src/components/PasswordForm.jsx`
```jsx
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Panel } from './UI';
import { api } from '../services/api';

function PasswordField({ id, label, value, onChange, placeholder, required = true, minLength, maxLength = 128, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrapper">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow(s => !s)}
          title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ marginTop: 24 }}>
      <Panel title="Đổi mật khẩu">
        <div className="notice" style={{ marginTop: 24 }}>
          Đổi mật khẩu sẽ thu hồi tất cả các phiên đăng nhập cũ trên các thiết bị khác. Mật khẩu mới cần từ 8 ký tự để đảm bảo an toàn.
        </div>
        <form
          className="panel-body auth-fields"
          onSubmit={async e => {
            e.preventDefault();
            if (busy) return;
            setError('');
            setSuccess('');
            if (values.password !== values.confirm) {
              return setError('Hai mật khẩu mới chưa trùng nhau.');
            }
            setBusy(true);
            try {
              await api('/auth/password', 'POST', values);
              setValues({ currentPassword: '', password: '', confirm: '' });
              setSuccess('Đã đổi mật khẩu thành công và đăng xuất các phiên đăng nhập khác.');
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PasswordField
            id="password-currentPassword"
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu hiện tại"
            value={values.currentPassword}
            onChange={e => setValues(v => ({ ...v, currentPassword: e.target.value }))}
          />
          <PasswordField
            id="password-password"
            label="Mật khẩu mới"
            minLength={8}
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={values.password}
            onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
          />
          <PasswordField
            id="password-confirm"
            label="Nhập lại mật khẩu mới"
            minLength={8}
            autoComplete="new-password"
            placeholder="Nhập lại chính xác mật khẩu mới"
            value={values.confirm}
            onChange={e => setValues(v => ({ ...v, confirm: e.target.value }))}
          />
          <small>Mật khẩu mới từ 8 ký tự, tối đa 72 byte UTF-8.</small>
          {error && <div className="error" role="alert">{error}</div>}
          {success && <div className="notice" role="status" style={{ background: '#e8f5e9', borderColor: '#a5d6a7', color: '#1b5e20' }}>{success}</div>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
```

#### File: `frontend/src/components/PublicLayout.jsx`
```jsx
import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {Button} from './UI';
import {customerNavigation,customerFooterLinks} from '../navigation';
export const publicLinks=customerNavigation.map(({href,label})=>[href,label]);
export const publicFooterLinks=(customerFooterLinks||customerNavigation).map(({href,label})=>[href,label]);
export function PublicHeader({onLogin,user,active,onLogout}){
 return <header className="public-header"><a className="brand" href="/" aria-label="Courtly trang chủ"><img src="/favicon.svg" width="38" height="38" alt=""/><div>Courtly<em>TENNIS CLUB</em></div></a><nav aria-label="Điều hướng chính">{publicLinks.map(([href,label])=><a key={href} href={href} aria-current={active===href?'page':undefined}>{label}</a>)}</nav>{user?<div className="public-account">{['ADMIN','STAFF'].includes(user.role)&&<a className="btn" href="/app#operations">{user.role==='ADMIN'?'Quản trị':'Vận hành'}</a>}{user.role==='ADMIN'?<a className="avatar-button" aria-label="Hồ sơ của tôi" href="/app#profile"><span className="avatar">{(user.name||'T').slice(0,1).toUpperCase()}</span><span>Tài khoản</span></a>:<details className="customer-avatar-menu"><summary className="avatar-button"><span className="avatar">{(user.name||'T').slice(0,1).toUpperCase()}</span><span>Tài khoản</span></summary><div>{[['profile','Hồ sơ của tôi'],['profile-orders','Đơn của tôi'],['profile-history','Lịch sử đặt sân'],['profile-payments','Lịch sử thanh toán'],['profile-membership','Membership của tôi']].map(([route,label])=><a key={route} href={'/app#'+route} onClick={e=>e.currentTarget.closest('details').removeAttribute('open')}>{label}</a>)}{onLogout&&<button type="button" onClick={onLogout}>Đăng xuất</button>}</div></details>}</div>:<Button className="primary" onClick={()=>onLogin('login')}>Đăng nhập</Button>}</header>;
}
export function PublicFooter(){return <footer className="public-footer content-footer"><div><a className="footer-brand" href="/">Courtly · Tennis Club</a><p>Chủ động lịch chơi, sẵn sàng ra sân.</p></div><nav aria-label="Điều hướng cuối trang">{publicFooterLinks.filter(([href])=>href!=='/dat-san').map(([href,label])=><a key={href} href={href}>{label}</a>)}</nav><a className="footer-book" href="/dat-san">Hẹn nhau trên sân <ArrowUpRight size={18}/></a></footer>;}
```

#### File: `frontend/src/components/TournamentDialogs.jsx`
```jsx
import React from 'react';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Chip,Table} from './UI';
import {money,labels,slotLabel,slotHours} from '../utils/format';
import {resolveSlots} from './OrderDialogs';
export function TournamentDetail({id,onClose}){
 const {data,show}=useCourtly();const t=data.tournaments.find(t=>t.id===id),regs=data.registrations.filter(r=>r.tournamentId===id),matches=data.matches.filter(m=>m.tournamentId===id);
 const name=id=>regs.find(r=>r.id===id)?.name||'Chờ vòng trước';
 return <Modal title={t.name} onClose={onClose} wide footer={<Button onClick={onClose}>Đóng</Button>}><div className="detail-head"><Chip status={t.status}/> {labels[t.format]} · {money(t.fee)}/đăng ký</div><div className="step-row"><Button className="primary sm" disabled={t.status!=='OPEN'} onClick={()=>show({type:'registration',id})}>Thêm đăng ký</Button>{!matches.length&&<Button className="sm" onClick={()=>show({type:'draw',id})}>Bốc thăm nhánh đấu</Button>}</div><h3 style={{margin:'22px 0 12px'}}>Đăng ký ({regs.length}/{t.max})</h3><Table headings={['Đội / cá nhân','Thành viên','Trạng thái','Đã thu','']} empty={!regs.length}>{regs.map(r=><tr key={r.id}><td className="name">{r.name}</td><td>{r.members.map((name,i)=><div key={i}>{name}</div>)}</td><td><Chip status={r.status}/></td><td>{money(r.paid)}</td><td>{r.paid<t.fee&&<Button className="sm" onClick={()=>show({type:'payment',registrationId:r.id})}>Thu phí</Button>}</td></tr>)}</Table><h3 style={{marginTop:22}}>Nhánh đấu</h3>{matches.length?<div className="bracket">{[...new Set(matches.map(m=>m.round))].sort().map(round=><div className="round" key={round}><h3>Vòng {round}</h3>{matches.filter(m=>m.round===round).map(m=><div className="match-card" key={m.id}><p className={m.winner===m.reg1?'winner':''}>{name(m.reg1)}</p><p className={m.winner===m.reg2?'winner':''}>{name(m.reg2)}</p><small>{m.score||'Chưa có kết quả'}{m.date?' · '+m.date:''}</small><div style={{marginTop:10}}><Button className="sm" onClick={()=>show({type:'match',id:m.id})}>Chi tiết trận</Button></div></div>)}</div>)}</div>:<p className="subtitle">Bốc thăm sau khi có 2, 4, 8, 16… đăng ký đã xác nhận.</p>}</Modal>;
}
export function TournamentActionDialog({type,id,onClose}){
 const {data,mutate,notify,show}=useCourtly();const t=data.tournaments.find(t=>t.id===id);
 const done=()=>{notify('Đã cập nhật giải');show({type:'tournament',id});};
 if(type==='draw')return <FormDialog title="Bốc thăm nhánh đấu" fields={[]} onClose={onClose} submitText="Bốc thăm" onSubmit={async()=>{await mutate(`/tournaments/${id}/draw`);done();}}><p>Sinh nhánh loại trực tiếp cho 2, 4, 8, 16… đăng ký đã xác nhận. Bản hiện tại chưa hỗ trợ bye.</p></FormDialog>;
 return <FormDialog title="Đăng ký giải đấu" initial={{accountId:data.accounts.find(a=>a.status==='ACTIVE')?.id,name:'',members:''}} fields={[{name:'accountId',label:'Người đăng ký',full:true,options:data.accounts.filter(a=>a.status==='ACTIVE').map(a=>({value:a.id,label:a.name}))},{name:'name',label:t.format==='SINGLES'?'Tên thi đấu':'Tên đội',full:true},{name:'members',label:'Thành viên bổ sung (mỗi dòng một người)',type:'textarea',full:true,required:t.format!=='SINGLES'}]} onClose={onClose} submitText="Đăng ký" onSubmit={async v=>{await mutate(`/tournaments/${id}/registrations`,{...v,members:v.members.split('\n').map(x=>x.trim()).filter(Boolean)});done();}}><div className="notice" style={{marginBottom:18}}>Người đăng ký tự được thêm vào đội. Giải đôi cần thêm đúng một đồng đội.</div></FormDialog>;
}
export function MatchDetail({id,onClose}){
 const {data,show}=useCourtly();const m=data.matches.find(x=>x.id===id);
 const name=id=>data.registrations.find(r=>r.id===id)?.name||'Chờ vòng trước';
 return <Modal title={`Trận đấu · ${m.roundName}`} onClose={onClose} footer={<Button onClick={()=>show({type:'tournament',id:m.tournamentId})}>Về giải đấu</Button>}><div className="detail-head"><h2>{name(m.reg1)} <span className="muted">vs</span> {name(m.reg2)}</h2><p className="subtitle"><Chip status={m.status}/> {m.score}</p></div>{m.slots.length?<div className="notice">{m.date}<br/>{m.slots.map(s=><div key={s.id}>{data.courts.find(c=>c.id===s.court)?.name} · {slotLabel(s)}</div>)}{m.staffId&&<div>Trọng tài: {data.staff.find(s=>s.id===m.staffId)?.name}</div>}</div>:<p className="subtitle">Chưa xếp sân.</p>}{m.status==='SCHEDULED'&&m.reg1&&m.reg2&&<div className="step-row"><Button className="primary" onClick={()=>show({type:'match-schedule',id})}>Xếp lịch sân & trọng tài</Button><Button disabled={!m.slots.length} onClick={()=>show({type:'match-result',id})}>Nhập kết quả</Button></div>}</Modal>;
}
export function MatchActionDialog({type,id,onClose}){
 const {data,mutate,notify,show}=useCourtly();const m=data.matches.find(x=>x.id===id),t=data.tournaments.find(x=>x.id===m.tournamentId);
 const done=()=>{notify('Đã cập nhật trận');show({type:'match',id});};
 if(type==='match-result')return <FormDialog title="Ghi kết quả trận" initial={{winnerId:m.reg1,score:''}} fields={[{name:'winnerId',label:'Đội / người thắng',options:[m.reg1,m.reg2].map(id=>({value:id,label:data.registrations.find(r=>r.id===id)?.name}))},{name:'score',label:'Tỉ số (ví dụ 6-4, 6-3)'}]} onClose={onClose} submitText="Kết thúc trận & nhả sân" onSubmit={async v=>{await mutate(`/matches/${id}/result`,v);done();}}/>;
 return <FormDialog title="Xếp lịch thi đấu" initial={{date:m.date||t.start,court:m.slots[0]?.court||data.courts.find(c=>c.status==='ACTIVE')?.id,start:m.slots[0]?.hour||8,hours:m.slots.reduce((n,s)=>n+slotHours(s),0)||1,staffId:m.staffId||''}} fields={[{name:'date',label:'Ngày thi đấu',type:'date',min:t.start,max:t.end},{name:'court',label:'Sân',options:data.courts.filter(c=>c.status==='ACTIVE').map(c=>({value:c.id,label:c.name}))},{name:'start',label:'Giờ bắt đầu',type:'number',min:6,max:22.5,step:0.5},{name:'hours',label:'Số giờ liên tiếp',type:'number',min:0.5,max:17,step:0.5},{name:'staffId',label:'Trọng tài',full:true,required:false,options:[{value:'',label:'Không phân công'},...data.staff.filter(s=>s.type==='REFEREE'&&s.status==='ACTIVE').map(s=>({value:s.id,label:s.name}))]}]} onClose={onClose} onSubmit={async v=>{await mutate(`/matches/${id}/schedule`,{scheduleIds:await resolveSlots(v),staffId:v.staffId||null},'PUT');done();}}/>;
}
```

#### File: `frontend/src/components/UI.jsx`
```jsx
import React, { useEffect, useRef, useState } from 'react';
import { labels } from '../utils/format';

export function Button({ children, className = '', ...props }) {
  return <button type="button" className={`btn ${className}`} {...props}>{children}</button>;
}
export function Title({ children, subtitle, action }) {
  return <div className="title-row"><div><h1>{children}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</div>;
}
export function Panel({ title, action, children }) {
  return <section className="panel"><div className="panel-head"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Stat({ title, value, note, icon: Icon }) {
  return <div className="stat"><div className="stat-top">{title}{Icon && <span className="stat-icon"><Icon size={19}/></span>}</div><div className="number">{value}</div><div className="note">{note}</div></div>;
}
export function Chip({ status }) {
  const color = ['ACTIVE','CONFIRMED','COMPLETED','OPEN','FINISHED'].includes(status) ? 'green' : ['HOLDING','PENDING','MAINTENANCE'].includes(status) ? 'orange' : ['CANCELLED','EXPIRED','INACTIVE','LOCKED'].includes(status) ? 'red' : ['CHECKED_IN','BOOKED'].includes(status) ? 'blue' : '';
  return <span className={`chip ${color}`}>{labels[status] || status}</span>;
}
export function Table({ headings, children, empty }) {
  return <div className="table-wrap"><table><thead><tr>{headings.map((h,i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{empty ? <tr><td className="empty" colSpan={headings.length}>Chưa có dữ liệu</td></tr> : children}</tbody></table></div>;
}
export function Tabs({ options, value, onChange }) {
  return <div className="tabs" role="tablist">{options.map(([id,text]) => <button role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} key={id} onClick={() => onChange(id)}>{text}</button>)}</div>;
}
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input,select,button,textarea')?.focus();
    const handler = e => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = [...ref.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="close" onClick={onClose} aria-label="Đóng">×</button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</section></div>;
}
export function FormDialog({ title, fields, initial = {}, onSubmit, onClose, children, submitText = 'Lưu thông tin', onChange, wide = false }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async e => {
    e.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try { await onSubmit(values); } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const change = (name, value) => setValues(previous => {
    const next = { ...previous, [name]: value };
    return onChange ? onChange(next, name) : next;
  });
  return <Modal title={title} onClose={onClose} wide={wide} footer={<><Button onClick={onClose}>Đóng</Button><button type="submit" form="dialog-form" className="btn primary" disabled={saving}>{saving ? 'Đang lưu…' : submitText}</button></>}>
    {children}<form id="dialog-form" onSubmit={submit}><div className="form-grid">{fields.map(f => {
      const choices = typeof f.options === 'function' ? f.options(values) : f.options;
      return <div key={f.name} className={`field ${f.full ? 'full' : ''}`}><label htmlFor={`field-${f.name}`}>{f.label}</label>{choices ? <select id={`field-${f.name}`} disabled={f.disabled} required={f.required !== false} value={values[f.name] ?? ''} onChange={e => change(f.name,e.target.value)}>{choices.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : f.type === 'textarea' ? <textarea id={`field-${f.name}`} value={values[f.name] ?? ''} required={f.required !== false} onChange={e => change(f.name,e.target.value)}/> : <input id={`field-${f.name}`} readOnly={f.readOnly} disabled={f.disabled} type={f.type || 'text'} value={values[f.name] ?? ''} min={f.min} max={f.max} maxLength={f.maxLength || 255} step={f.type === 'number' ? (f.step || 1) : undefined} required={f.required !== false} onChange={e => change(f.name,f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}/>}</div>;
    })}</div></form>{error && <div className="error" role="alert">{error}</div>}
  </Modal>;
}
```

### 7.4 Admin & Operations Pages

#### File: `frontend/src/pages/AccountsPage.jsx`
```jsx
import React,{useState} from 'react';
import {useCourtly} from '../context';
import {api} from '../services/api';
import {Title,Panel,Table,Chip,Button,Modal} from '../components/UI';
export default function AccountsPage(){
 const {data,show,notify}=useCourtly();const [ticket,setTicket]=useState(null),[issuing,setIssuing]=useState(false);
 const issue=async accountId=>{if(issuing)return;setIssuing(true);try{setTicket(await api('/auth/ticket','POST',{accountId}));}catch(e){notify(e.message);}finally{setIssuing(false);}};const [query,setQuery]=useState('');const list=data.accounts.filter(a=>`${a.name} ${a.email} ${a.phone}`.toLowerCase().includes(query.toLowerCase()));
 return <><Title subtitle="Cấp quyền khách hàng/admin và kiểm soát tài khoản đăng nhập." action={<Button className="primary" onClick={()=>show({type:'entity',collection:'accounts'})}>Thêm tài khoản</Button>}>Tài khoản & phân quyền</Title><Panel title="Danh sách tài khoản" action={<div className="tools"><input className="search" placeholder="Tìm tên, email, số điện thoại" value={query} onChange={e=>setQuery(e.target.value)}/></div>}><Table headings={['Họ tên','Liên hệ','Vai trò','Trạng thái','']} empty={!list.length}>{list.map(a=><tr key={a.id}><td className="name">{a.name}{a.isOwner&&<small>Chủ Site</small>}<span className="login-linked">{a.loginLinked?'Đã liên kết đăng nhập':'Chưa đăng nhập'}</span></td><td>{a.email}<small>{a.phone}</small></td><td><Chip status={a.role}/></td><td><Chip status={a.status}/></td><td><div className="row-actions"><Button className="sm" onClick={()=>show({type:'entity',collection:'accounts',row:a})}>Sửa</Button><Button className="sm" onClick={()=>show({type:'customer-history',id:a.id})}>Lịch sử</Button>{a.id!==data.viewer.accountId&&(!a.isOwner||data.viewer.isOwner)&&<Button className="sm" disabled={issuing} onClick={()=>issue(a.id)}>{a.loginLinked?'Đặt lại mật khẩu':'Kích hoạt'}</Button>}</div></td></tr>)}</Table></Panel><div className="notice warn" style={{marginTop:20}}>Khách chỉ xem và thao tác dữ liệu của mình. Admin được quản lý toàn bộ vận hành và tài khoản. Khóa tài khoản hoặc đổi quyền có hiệu lực ở lần gọi API tiếp theo. Mã kích hoạt có hiệu lực 24 giờ và chỉ dùng một lần. Xác minh người nhận trước khi giao mã trực tiếp; hệ thống không tự gửi email.</div>{ticket&&<Modal title="Mã kích hoạt một lần" onClose={()=>setTicket(null)} footer={<Button onClick={()=>setTicket(null)}>Đóng</Button>}><p>Giao mã này riêng cho đúng chủ tài khoản sau khi xác minh. Mã dùng một lần, hết hạn sau 24 giờ.</p><label htmlFor="activation-code" style={{marginTop:20}}>Mã kích hoạt</label><input id="activation-code" readOnly value={ticket.token} onFocus={e=>e.target.select()}/><p className="subtitle" style={{marginTop:12}}>Người nhận chọn Đăng nhập → Quên mật khẩu / Có mã kích hoạt để đặt mật khẩu.</p></Modal>}</>;
}
```

#### File: `frontend/src/pages/CalendarPage.jsx`
```jsx
import {hourLabel,slotHours} from '../utils/format';
import React, { useEffect, useState } from 'react';
import { Wallet, CalendarDays, Users, Grid2X2, Plus, RefreshCw } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Button } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { active, money, localDate, today, labels } from '../utils/format';
export default function CalendarPage() {
  const { data, date, setDate, show, refresh, notify } = useCourtly();
  const [selected,setSelected] = useState([]);
  useEffect(()=>setSelected([]),[date]);
  const orders=data.orders.filter(o=>o.date===date);
  const occupied=data.schedules.filter(s=>s.status!=='AVAILABLE').length;
  const income=data.payments.filter(p=>p.orderId && localDate(p.createdAt)===date).reduce((a,p)=>a+p.amount,0)-data.refunds.filter(r=>localDate(r.createdAt)===date && data.payments.find(p=>p.id===r.paymentId)?.orderId).reduce((a,r)=>a+r.amount,0);
  const choose = id => setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
  const create = () => { if(!selected.length) return notify('Chọn các khung giờ trống trước.'); show({type:'booking',scheduleIds:selected,onCreated:()=>setSelected([])}); };
  return <><Title subtitle="Theo dõi lịch và đặt sân trong một màn hình." action={<Button className="primary" onClick={create}><Plus size={17}/>Tạo đơn đặt sân</Button>}>Lịch sân</Title><div className="stats"><Stat title="Tiền thu từ đơn sân" value={money(income)} note="Trong ngày · đã trừ hoàn" icon={Wallet}/><Stat title="Đơn đặt sân" value={orders.length} note="Ngày đang xem" icon={CalendarDays}/><Stat title="Công suất sân" value={`${Math.round(occupied/Math.max(1,data.schedules.filter(s=>data.courts.some(c=>c.id===s.court&&c.status==='ACTIVE')).length)*100)}%`} note={`${occupied} khung giờ đã giữ/đặt`} icon={Grid2X2}/><Stat title="Khách đang chơi" value={orders.filter(o=>o.status==='CHECKED_IN').length} note="Đơn đã check-in" icon={Users}/></div>
    <Panel title="Lịch sử dụng sân" action={<div className="tools"><Button className="sm" onClick={()=>setDate(today())}>Hôm nay</Button><input type="date" aria-label="Ngày xem lịch" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><Button className="sm" aria-label="Cập nhật" onClick={()=>refresh().catch(e=>notify(e.message))}><RefreshCw size={16}/></Button></div>}>
      <div className="panel-body" style={{paddingTop:14,paddingBottom:14}}><div className="legend">{[['#d9e6da','Còn trống'],['#83b599','Đã đặt'],['#ebc66c','Giữ chỗ'],['#b6a1d9','Thi đấu'],['#cfd5cf','Bảo trì']].map(([color,text])=><span key={text}><i style={{background:color}}/>{text}</span>)}</div></div>
      <div className="schedule-scroll" style={{maxHeight:620}}><div className="schedule" style={{'--cols':Math.max(1,data.courts.length)}}><div className="court-head">Giờ</div>{data.courts.map(c=><div className="court-head" key={c.id}>{c.name}<small>{labels[c.type]}</small></div>)}
        {[...new Set(data.schedules.map(s=>s.hour))].sort((a,b)=>a-b).map(hour=><React.Fragment key={hour}><div className="time-cell">{hourLabel(hour)}</div>{data.courts.map(c=>{
          const slot=data.schedules.find(s=>s.court===c.id&&s.hour===hour);
          const order=orders.find(o=>active(o)&&o.slots.some(s=>s.id===slot?.id));
          const match=data.matches.find(m=>!['FINISHED','CANCELLED'].includes(m.status)&&m.slots.some(s=>s.id===slot?.id));
          const disabled=c.status!=='ACTIVE'||!slot;
          const status=disabled?'maintenance':selected.includes(slot.id)?'selected':slot.status==='LOCKED'?'holding':slot.status==='BOOKED'?'booked':slot.status==='IN_MATCH'?'match':'available';
          return <div className="slot-wrap" key={c.id}><button className={`slot ${status}`} disabled={disabled} aria-pressed={!!slot&&selected.includes(slot.id)} aria-label={`${c.name} ${hour} giờ`} onClick={()=>order?show({type:'order',id:order.id}):match?show({type:'match',id:match.id}):slot.status==='AVAILABLE'?choose(slot.id):refresh()}><span>{disabled?labels[c.status]:order?.name||match?.roundName||(selected.includes(slot.id)?'Đã chọn':labels[slot.status])}</span><small>{disabled?'Tạm ngừng':order?labels[order.status]:match?'Lịch thi đấu':money(slot.price)+' / '+(slotHours(slot)*60)+' phút'}</small></button></div>;
        })}</React.Fragment>)}
      </div></div><div className="schedule-foot"><span>{selected.length ? `${selected.length} khung giờ · ${money(data.schedules.filter(s=>selected.includes(s.id)).reduce((a,s)=>a+s.price,0))}` : 'Chọn một hoặc nhiều khung giờ trống để đặt sân.'}</span><div className="tools">{!!selected.length&&<Button className="sm" onClick={()=>setSelected([])}>Bỏ chọn</Button>}<Button className="primary sm" onClick={create}>Đặt khung giờ đã chọn</Button></div></div>
    </Panel><div className="bottom-grid"><Panel title="Đơn trong ngày"><OrderTable orders={orders.slice(0,5)}/></Panel><Panel title="Cần chú ý"><div className="panel-body"><div className="activity"><div><p>{data.orders.filter(o=>o.status==='HOLDING').length} đơn đang giữ chỗ</p><small>Tự nhả sau {data.settings.holdMinutes} phút nếu chưa đủ cọc.</small></div></div><div className="activity"><div><p>{data.tournaments.filter(t=>t.status==='OPEN').length} giải mở đăng ký</p><small>Phí giải được theo dõi riêng.</small></div></div></div></Panel></div>
  </>;
}
```

#### File: `frontend/src/pages/ContentAdminPage.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {api} from '../services/api';
import {Title,Panel,Button,Modal,Table} from '../components/UI';
import {Stars} from './InformationPage';
const articleEmpty={title:'',excerpt:'',body:'',category:'NEWS',status:'DRAFT',tournamentId:''};
const profileFields=[['name','Tên câu lạc bộ',100],['tagline','Câu giới thiệu ngắn',160],['intro','Đoạn mở đầu',800,'textarea'],['story','Câu chuyện / thông tin về câu lạc bộ',5000,'textarea'],['mission','Định hướng trải nghiệm',1000,'textarea'],['address','Địa chỉ',400],['phone','Điện thoại',30,'tel'],['email','Email liên hệ',254,'email'],['openingHours','Giờ tiếp nhận / hỗ trợ',250],['mapUrl','Link bản đồ HTTPS',500,'url'],['socialUrl','Link mạng xã hội HTTPS',500,'url'],['paymentInstructions','Hướng dẫn cọc, thanh toán và hoàn tiền',2000,'textarea']];
export default function ContentAdminPage(){
 const [data,setData]=useState(null),[tab,setTab]=useState('club'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[editor,setEditor]=useState(null),[review,setReview]=useState(null),[filter,setFilter]=useState('ALL');
 const load=async()=>{const d=await api('/content');setData(d);return d;};
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const save=async(path,method,body,done)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await api(path,method,body);await load();done?.();setNotice('Đã lưu thay đổi.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const change=(key,value)=>setData(d=>({...d,club:{...d.club,[key]:value}}));
 return <><Title subtitle="Chỉnh thông tin công khai, biên tập tin tức và tiếp nhận feedback." action={<a className="btn" href="/gioi-thieu">Xem website</a>}>Nội dung & feedback</Title><div className="time-filters" role="group" aria-label="Quản lý nội dung">{[['club','Giới thiệu & liên hệ'],['articles','Tin tức & thông báo'],['feedback','Feedback']].map(([key,label])=><button key={key} className={tab===key?'on':''} aria-pressed={tab===key} onClick={()=>{setTab(key);setError('');setNotice('');}}>{label}{key==='feedback'&&data?` (${data.feedback.filter(f=>f.status==='PENDING').length})`:''}</button>)}</div>{error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="notice" role="status" style={{marginBottom:16}}>{notice}</div>}{!data?<div className="loading">Đang tải nội dung…</div>:<>
 {tab==='club'&&<Panel title="Thông tin câu lạc bộ"><form className="panel-body" onSubmit={e=>{e.preventDefault();save('/content/club','PUT',data.club);}}><p className="notice" style={{marginBottom:24}}>Nhập thông tin thực tế trước khi công bố. Những trường liên hệ để trống sẽ hiện “Đang cập nhật”; không tạo địa chỉ hoặc số điện thoại mẫu.</p><div className="form-grid">{profileFields.map(([key,label,max,type])=><div className={`field ${type==='textarea'?'full':''}`} key={key}><label htmlFor={'club-'+key}>{label}</label>{type==='textarea'?<textarea id={'club-'+key} rows={key==='story'?6:3} maxLength={max} required={['intro','story','mission'].includes(key)} value={data.club[key]} onChange={e=>change(key,e.target.value)}/>:<input id={'club-'+key} type={type||'text'} maxLength={max} required={['name','tagline'].includes(key)} value={data.club[key]} onChange={e=>change(key,e.target.value)}/>}</div>)}</div><button className="btn primary" disabled={busy} style={{marginTop:24}}>{busy?'Đang lưu…':'Lưu thông tin công khai'}</button></form></Panel>}
 {tab==='articles'&&<Panel title="Bài viết của câu lạc bộ" action={<Button className="primary" onClick={()=>{setError('');setEditor({...articleEmpty});}}>Viết bài mới</Button>}><div className="panel-body"><p className="subtitle">Lưu nháp để biên tập; chọn Xuất bản khi sẵn sàng. Thông tin giải đấu có sẵn tự xuất hiện trên trang tin, không cần tạo lại.</p></div><Table headings={['Tiêu đề','Loại tin','Trạng thái','']} empty={!data.articles.length}>{data.articles.map(a=><tr key={a.id}><td className="name">{a.title}<small>{new Date(a.updatedAt).toLocaleString('vi-VN')}</small></td><td>{{NEWS:'Tin câu lạc bộ',NOTICE:'Thông báo',TOURNAMENT:'Giải đấu'}[a.category]}</td><td><span className={`chip ${a.status==='PUBLISHED'?'green':'orange'}`}>{a.status==='PUBLISHED'?'Đã xuất bản':'Bản nháp'}</span></td><td><div className="row-actions"><Button className="sm" onClick={()=>{setError('');setEditor({...a,tournamentId:a.tournamentId||''});}}>Biên tập</Button>{a.status==='PUBLISHED'&&<><a className="btn sm" href={'/tin-tuc/'+a.id}>Xem bài</a><Button className="sm" disabled={busy} onClick={()=>save('/content/articles/'+a.id,'PUT',{...a,status:'DRAFT'})}>Gỡ khỏi trang</Button></>}</div></td></tr>)}</Table></Panel>}
 {tab==='feedback'&&<Panel title="Hộp thư góp ý" action={<select aria-label="Lọc phản hồi" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Tất cả</option><option value="PENDING">Đang tiếp nhận</option><option value="PUBLISHED">Đã công khai</option><option value="PRIVATE">Giữ riêng</option></select>}><div className="panel-body"><p className="notice">Chỉ được công khai khi người gửi đã đồng ý. Không sửa nội dung hoặc số sao của khách. Câu trả lời sẽ hiển thị trong “Phản hồi bạn đã gửi”.</p></div><Table headings={['Người gửi','Đánh giá','Nội dung','Hiển thị','']} empty={!data.feedback.some(f=>filter==='ALL'||f.status===filter)}>{data.feedback.filter(f=>filter==='ALL'||f.status===filter).map(f=><tr key={f.id}><td>{f.displayName}<small>{new Date(f.createdAt).toLocaleString('vi-VN')}</small></td><td><Stars rating={f.rating}/></td><td><p className="feedback-excerpt">{f.message}</p></td><td>{f.status==='PUBLISHED'?'Công khai':f.status==='PRIVATE'?'Giữ riêng':'Đang tiếp nhận'}<small>{f.publishConsent?'Khách đồng ý công khai':'Khách gửi riêng'}</small></td><td><Button className="sm" onClick={()=>{setError('');setReview({...f});}}>Xem & trả lời</Button></td></tr>)}</Table></Panel>}
 </>}
 {editor&&<Modal title={editor.id?'Biên tập bài viết':'Bài viết mới'} wide onClose={()=>!busy&&setEditor(null)}><form className="auth-fields" onSubmit={e=>{e.preventDefault();save('/content/articles'+(editor.id?'/'+editor.id:''),editor.id?'PUT':'POST',editor,()=>setEditor(null));}}><div className="field"><label htmlFor="article-title">Tiêu đề</label><input id="article-title" required maxLength={160} value={editor.title} onChange={e=>setEditor(a=>({...a,title:e.target.value}))}/></div><div className="form-grid"><div className="field"><label htmlFor="article-category">Loại tin</label><select id="article-category" value={editor.category} onChange={e=>setEditor(a=>({...a,category:e.target.value}))}><option value="NEWS">Tin câu lạc bộ</option><option value="NOTICE">Thông báo</option><option value="TOURNAMENT">Giải đấu</option></select></div><div className="field"><label htmlFor="article-status">Trạng thái</label><select id="article-status" value={editor.status} onChange={e=>setEditor(a=>({...a,status:e.target.value}))}><option value="DRAFT">Lưu nháp</option><option value="PUBLISHED">Xuất bản công khai</option></select></div></div><div className="field"><label htmlFor="article-tournament">Giải đấu liên quan</label><select id="article-tournament" value={editor.tournamentId} onChange={e=>setEditor(a=>({...a,tournamentId:e.target.value}))}><option value="">Không gắn giải đấu</option>{data.tournaments.map(t=><option key={t.id} value={t.id}>{t.name}{t.status==='DRAFT'?' (bản nháp)':''}</option>)}</select></div><div className="field"><label htmlFor="article-excerpt">Tóm tắt</label><textarea id="article-excerpt" required maxLength={400} rows={3} value={editor.excerpt} onChange={e=>setEditor(a=>({...a,excerpt:e.target.value}))}/></div><div className="field"><label htmlFor="article-body">Nội dung bài viết</label><textarea id="article-body" required maxLength={12000} rows={10} value={editor.body} onChange={e=>setEditor(a=>({...a,body:e.target.value}))}/><small>Văn bản thuần, xuống dòng để tách đoạn. Không hỗ trợ mã HTML.</small></div>{error&&<div className="error" role="alert">{error}</div>}<button className="btn primary" disabled={busy}>{busy?'Đang lưu…':editor.status==='PUBLISHED'?'Lưu & xuất bản':'Lưu bản nháp'}</button></form></Modal>}
 {review&&<Modal title="Tiếp nhận feedback" onClose={()=>!busy&&setReview(null)}><Stars rating={review.rating}/><p className="preserve-lines" style={{margin:'16px 0'}}>{review.message}</p><p className="subtitle">{review.displayName} · {review.publishConsent?'Đồng ý công khai':'Chỉ gửi riêng cho câu lạc bộ'}</p><form className="auth-fields" style={{marginTop:24}} onSubmit={e=>{e.preventDefault();save('/content/feedback/'+review.id,'PATCH',{status:review.status,reply:review.reply},()=>setReview(null));}}><div className="field"><label htmlFor="review-status">Hiển thị</label><select id="review-status" value={review.status} onChange={e=>setReview(f=>({...f,status:e.target.value}))}><option value="PENDING">Đang tiếp nhận</option><option value="PRIVATE">Giữ riêng / Đã xử lý</option><option value="PUBLISHED" disabled={!review.publishConsent}>Công khai trên trang Feedback</option></select></div><div className="field"><label htmlFor="review-reply">Câu trả lời của câu lạc bộ</label><textarea id="review-reply" rows={5} maxLength={2000} value={review.reply} onChange={e=>setReview(f=>({...f,reply:e.target.value}))}/></div>{error&&<div className="error" role="alert">{error}</div>}<button className="btn primary" disabled={busy}>{busy?'Đang lưu…':'Lưu phản hồi'}</button></form></Modal>}
 </>;
}
```

#### File: `frontend/src/pages/CourtsPage.jsx`
```jsx
import React,{useState} from 'react';
import {CourtPhoto,courtDescription} from '../components/CourtGallery';
import {useCourtly} from '../context';
import {Title,Panel,Table,Chip,Button,Tabs} from '../components/UI';
import {labels,money} from '../utils/format';
export default function CourtsPage(){
 const {data,show,navigate}=useCourtly();const [tab,setTab]=useState('courts');
 const edit=(collection,row)=>show({type:'entity',collection,row});
 return <><Title subtitle="Loại sân, trạng thái và giá theo khung giờ." action={<Button className="primary" onClick={()=>edit('courts')}>Thêm sân</Button>}>Sân & bảng giá</Title><Tabs options={[["courts","Danh sách sân"],["prices","Bảng giá"]]} value={tab} onChange={setTab}/>{tab==='courts'?<div className="grid-cards">{data.courts.map(c=><article className="item-card" key={c.id}><CourtPhoto court={c}/><div className="card-body"><div className="card-top"><h2>{c.name}</h2><Chip status={c.status}/></div><div className="metric"><span className="muted">Loại sân</span><b>{labels[c.type]}</b></div><div className="metric"><span className="muted">Giá cơ bản / giờ</span><b>{money(c.price)}</b></div><p className="subtitle">{courtDescription(c)}</p><p className="subtitle">{c.address||'Dùng địa chỉ CLB'}</p><div className="card-buttons"><Button className="sm" onClick={()=>edit('courts',c)}>Sửa thông tin</Button><Button className="sm" onClick={()=>navigate('calendar')}>Xem lịch</Button></div></div></article>)}</div>:<><Panel title="Khung giá" action={<Button className="primary sm" onClick={()=>edit('prices')}>Thêm khung giá</Button>}><Table headings={['Sân','Ngày','Khung giờ','Giá / giờ','']} empty={!data.prices.length}>{data.prices.map(p=><tr key={p.id}><td>{data.courts.find(c=>c.id===p.court)?.name}</td><td>{labels[p.dayType]}</td><td>{p.start}:00–{p.end}:00</td><td>{money(p.price)}</td><td><Button className="sm" onClick={()=>edit('prices',p)}>Sửa</Button></td></tr>)}</Table></Panel><div className="notice" style={{marginTop:20}}>Khung giờ ngoài bảng giá dùng giá cơ bản của sân. Giá được chụp vào lịch khi sinh slot cho ngày đó.</div></>}</>;
}
```

#### File: `frontend/src/pages/CustomerHistory.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Button,Chip,Table,Tabs} from '../components/UI';
import OrderActions,{canRent} from '../components/OrderActions';
import {money,labels,localDate} from '../utils/format';
const dateLabel=d=>d?.split('-').reverse().join('/');
const timeLabel=d=>d?new Date(d).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
export function OrderTimeline({order,courts}){
 const events=order.history?.length?order.history:[];
 const names={CREATED:'Tạo đơn đặt sân',SCHEDULE:'Đổi lịch sân',CANCEL:'Hủy lịch đặt',SERVICES:'Thêm dịch vụ thuê',PRODUCTS:'Thêm sản phẩm',STAFF:'Thêm nhân sự','CHECK-IN':'Check-in','CHECK-OUT':'Hoàn tất buổi chơi',RETURN:'Trả thiết bị',INVOICE:'Xuất phiếu thu',EXPIRED:'Hết hạn giữ chỗ'};
 const slots=e=>`${dateLabel(e.date)} · ${e.slots?.map(s=>`${courts.find(c=>c.id===s.court)?.name||s.court} ${slotLabel(s)}`).join(', ')}`;
 if(!events.length)return <p className="notice">Đơn cũ chưa có nhật ký chi tiết. Các thông tin hiện tại vẫn được giữ nguyên.</p>;
 return <ol className="order-timeline">{[...events].reverse().map(e=><li key={e.id}><div><b>{names[e.type]||e.type}</b><time>{timeLabel(e.at)}</time></div>{e.type==='SCHEDULE'&&e.previous&&<p><span>Trước: </span>{slots(e.previous)}</p>}<p>{slots(e)}</p>{e.total!==undefined&&<small>Tổng đơn tại thời điểm này: {money(e.total)}</small>}</li>)}</ol>;
}
export function MyHistory(){
 const {data,show,isAdmin}=useCourtly();const [query,setQuery]=useState('');const [from,setFrom]=useState(''),[to,setTo]=useState(''),[status,setStatus]=useState('');
 const rows=data.orders.filter(o=>`${o.id} ${isAdmin?o.name:''}`.toLowerCase().includes(query.toLowerCase())&&(!from||o.date>=from)&&(!to||o.date<=to)&&(!status||o.status===status)).sort((a,b)=>b.date.localeCompare(a.date));
 return <><Title subtitle="Tra cứu mọi lịch đã đặt, kể cả đơn đã hủy hoặc hết hạn.">Lịch sử đặt sân</Title><div className="history-filters"><label>{isAdmin?'Tên khách / mã đơn':'Mã đơn'}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm đơn đặt sân…"/></label><label>Từ ngày<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến ngày<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option>{['HOLDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label></div><p className="subtitle">{rows.length} lịch đặt phù hợp</p><div className="history-list">{rows.map(o=><article className="customer-order" key={o.id}><div className="customer-order-top"><div><h2>{dateLabel(o.date)}</h2><small>{o.id.slice(0,8).toUpperCase()}{isAdmin?` · ${o.name}`:''}</small></div><Chip status={o.status}/></div><p className="subtitle">{o.slots.map(s=>`${data.courts.find(c=>c.id===s.court)?.name} · ${slotLabel(s)}`).join(' / ')}</p><OrderActions order={o}/><details className="history-details"><summary>Xem các lần cập nhật</summary><OrderTimeline order={o} courts={data.courts}/></details></article>)}</div>{!rows.length&&<p className="empty">Chưa có lịch đặt trong khoảng đã chọn.</p>}</>;
}
export function MyPayments(){
 const {data,show,isAdmin,navigate}=useCourtly();
 const allPayments=[...data.payments,...(data.membershipPayments||[]).map(p=>({...p,type:"MEMBERSHIP_FEE"}))];const [query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const received=allPayments.reduce((n,p)=>n+p.amount,0),refunded=data.refunds.reduce((n,p)=>n+p.amount,0);
 const rows=[...allPayments.map(p=>({...p,kind:'PAYMENT'})),...data.refunds.map(r=>{const p=data.payments.find(p=>p.id===r.paymentId);return {...r,kind:'REFUND',orderId:p?.orderId,registrationId:p?.registrationId,method:p?.method};})].filter(p=>(!from||localDate(p.createdAt)>=from)&&(!to||localDate(p.createdAt)<=to)&&`${p.id} ${p.orderId||''} ${p.transactionCode||''} ${isAdmin?data.orders.find(o=>o.id===p.orderId)?.name||'':''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <><Title subtitle={isAdmin?'Tra cứu giao dịch của mọi khách hàng, bao gồm khoản thu và hoàn tiền.':'Các khoản thực tế đã được quầy ghi nhận cho tài khoản của bạn.'}>Lịch sử thanh toán</Title><div className="payment-summary"><div><small>Tổng đã thanh toán</small><b>{money(received)}</b></div><div><small>Tổng đã hoàn</small><b>{money(refunded)}</b></div><div><small>Thanh toán sau hoàn</small><b>{money(received-refunded)}</b></div></div><div className="history-filters"><label>Từ ngày<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến ngày<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label></div><Panel title="Thu tiền & hoàn tiền" action={<input aria-label="Tìm giao dịch" placeholder={isAdmin?'Tên khách, mã đơn hoặc giao dịch':'Mã đơn hoặc mã giao dịch'} value={query} onChange={e=>setQuery(e.target.value)}/>}><Table headings={['Thời điểm','Nội dung','Phương thức','Số tiền','Đơn liên quan']} empty={!rows.length}>{rows.map(p=><tr key={p.kind+p.id}><td>{timeLabel(p.createdAt)}<small>{p.transactionCode||p.id}</small></td><td>{p.kind==='REFUND'?'Hoàn tiền':p.type==='MEMBERSHIP_FEE'?'Phí membership':p.type==='TOURNAMENT_FEE'?'Phí giải đấu':p.type==='DEPOSIT'?'Tiền cọc':'Thanh toán đơn'}</td><td>{labels[p.method]||p.method||'—'}</td><td className={p.kind==='REFUND'?'refund-amount':''}>{p.kind==='REFUND'?'−':''}{money(p.amount)}</td><td>{isAdmin&&p.orderId&&<small>{data.orders.find(o=>o.id===p.orderId)?.name}</small>}{p.membershipId?<Button className="sm" onClick={()=>navigate(isAdmin?'membership':'profile-membership')}>{p.planName||'Membership'}</Button>:p.orderId?<Button className="sm" onClick={()=>show({type:'order',id:p.orderId})}>{p.orderId.slice(0,8).toUpperCase()}</Button>:<Button className="sm" onClick={()=>show({type:'tournament',id:data.registrations.find(r=>r.id===p.registrationId)?.tournamentId})}>{data.registrations.find(r=>r.id===p.registrationId)?.name||'Đăng ký giải'}</Button>}</td></tr>)}</Table></Panel><p className="notice" style={{marginTop:20}}>Hủy lịch không tự chuyển tiền hoàn về ngân hàng. Khoản hoàn chỉ xuất hiện sau khi quầy xử lý và ghi nhận.</p></>;
}
export function MyServices(){
 const {data,show,navigate,isAdmin}=useCourtly();
 const [tab,setTab]=useState('available'),[query,setQuery]=useState('');
 const eligible=data.orders.filter(canRent);
 const rented=data.orders.filter(o=>o.staff.length);
 const orders=(tab==='available'?eligible:rented).filter(o=>`${o.id} ${o.date} ${isAdmin?o.name:''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>tab==='available'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 return <>
  <Title subtitle={isAdmin?'Phân công trọng tài theo sân và khung giờ của từng đơn.':'Chọn trọng tài cho lịch sân của bạn. Xem giá trước khi xác nhận.'} action={<Button onClick={()=>navigate('orders')}>Xem đơn hàng</Button>}>Dịch vụ trọng tài</Title>
  <div className="rental-intro"><article><h2>Thuê trọng tài</h2><p>Chọn trọng tài có lịch làm việc bao phủ giờ chơi, không trùng buổi khác. Chi phí tính theo số giờ sử dụng.</p></article></div>
  {isAdmin&&<div className="step-row"><Button onClick={()=>navigate('staff')}>Quản lý trọng tài & lịch làm việc</Button></div>}
  <Tabs value={tab} onChange={setTab} options={[["available",`Đặt thêm dịch vụ (${eligible.length})`],["rented",`Lịch sử thuê (${rented.length})`]]}/>
  <div className="history-filters"><label>{isAdmin?'Tìm khách, mã đơn hoặc ngày':'Tìm mã đơn hoặc ngày'}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm đơn thuê…"/></label></div>
  <div className="history-list">{orders.map(o=><article className="customer-order" key={o.id}>
   <div className="customer-order-top"><div><h2>{dateLabel(o.date)}</h2><small>{o.id.slice(0,8).toUpperCase()}{isAdmin?` · ${o.name}`:''}</small></div><Chip status={o.status}/></div>
   <p className="subtitle">{o.slots.map(s=>`${data.courts.find(c=>c.id===s.court)?.name} ${slotLabel(s)}`).join(' / ')}</p>
   {o.staff.map(st=><div className="order-line" key={st.id}><span>{st.name} · {st.hours} giờ</span><b>{money(st.rate*st.hours)}</b></div>)}
   <OrderActions order={o}/>
  </article>)}</div>
  {!orders.length&&<div className="empty"><h3>{query?'Không tìm thấy đơn phù hợp':tab==='rented'?'Chưa có lịch sử thuê dịch vụ':'Chưa có lịch sân phù hợp để thuê'}</h3><p>{tab==='available'?'Cần có đơn sắp tới, chưa check-in. Chọn lịch sân trước để kiểm tra trọng tài còn trống.':'Dịch vụ sau khi xác nhận sẽ được lưu cùng đơn đặt sân tại đây.'}</p>{tab==='available'&&<Button className="primary" onClick={()=>navigate('calendar')}>Đặt sân</Button>}</div>}
 </>;
}
```

#### File: `frontend/src/pages/CustomerPage.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {CalendarDays,Clock,Trophy,ArrowRight,CheckCircle2} from 'lucide-react';
import {MyHistory,MyPayments,MyServices} from './CustomerHistory';
import OrderActions from '../components/OrderActions';
import BookingPicker from '../components/BookingPicker';
import {useCourtly} from '../context';
import {Title,Panel,Button,Chip,Tabs} from '../components/UI';
import {money,today,labels} from '../utils/format';
export default function CustomerPage({route}){
 if(route==='orders')return <MyOrders/>;
 if(route==='history')return <MyHistory/>;
 if(route==='payments')return <MyPayments/>;
 if(route==='services')return <MyServices/>;
 if(route==='tournaments')return <MyTournaments/>;
 return <BookCourt/>;
}
function BookCourt(){
 const {data,user,date,setDate,show}=useCourtly();
 return <><Title subtitle={`Chào ${user.name}. Chọn ngày, sân và giờ để bắt đầu.`}>Đặt sân</Title><BookingPicker data={data} date={date} setDate={setDate} onBook={show}/></>;
}
export function MyOrders(){
 const {data,show,navigate}=useCourtly();const [tab,setTab]=useState('active');
 const rows=data.orders.filter(o=>tab==='all'||(tab==='active'?(['HOLDING','CONFIRMED','CHECKED_IN'].includes(o.status)||o.finance?.review||o.status==='COMPLETED'&&o.paid<o.total):['COMPLETED','CANCELLED','EXPIRED'].includes(o.status)));
 return <><Title subtitle="Theo dõi lịch, tiền cọc và trạng thái từng đơn của bạn." action={<Button className="primary" onClick={()=>navigate('calendar')}>Đặt sân mới</Button>}>Đơn của tôi</Title><Tabs value={tab} onChange={setTab} options={[["all","Tất cả"],["active","Đang hoạt động"],["finished","Đã kết thúc"]]}/><div className="customer-orders">{rows.map(o=><section className="customer-order" key={o.id}><div className="customer-order-top"><span className="meta">MÃ ĐƠN · {o.id.slice(0,8).toUpperCase()}</span><Chip status={o.status}/></div><h2>{o.date.split('-').reverse().join('/')}</h2><div className="booking-times">{o.slots.map(s=><span key={s.id}><Clock size={15}/>{data.courts.find(c=>c.id===s.court)?.name} · {s.hour}:00–{s.hour+1}:00</span>)}</div><div className="order-costs"><div><small>Tổng tiền</small><b>{money(o.total)}</b></div><div><small>Đã thu</small><b>{money(o.paid)}</b></div><div><small>{['CANCELLED','EXPIRED'].includes(o.status)?'Không thu thêm':'Còn lại'}</small><b>{money(['CANCELLED','EXPIRED'].includes(o.status)?0:Math.max(0,o.total-o.paid))}</b></div></div>{o.status==='HOLDING'&&<p className="notice">Giữ chỗ đến {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}. Cọc cần thu: {money(o.deposit)}. Liên hệ quầy để thanh toán.</p>}<OrderActions order={o}/></section>)}</div>{!rows.length&&<div className="empty"><CalendarDays size={32}/><h3>Chưa có đơn trong mục này</h3><p>Chọn sân và khung giờ để tạo lịch chơi đầu tiên.</p></div>}</>;
}
function MyTournaments(){
 const {data,show}=useCourtly();
 return <><Title subtitle="Khám phá giải đấu và theo dõi đăng ký của bạn.">Giải đấu</Title><div className="grid-cards">{data.tournaments.map(t=>{const reg=data.registrations.find(r=>r.tournamentId===t.id),open=t.status==='OPEN'&&t.deadline>=today();return <section className="customer-order" key={t.id}><div className="customer-order-top"><Trophy size={25}/><Chip status={t.status}/></div><h2>{t.name}</h2><p className="subtitle">{labels[t.format]} · {t.location}</p><div className="detail-grid" style={{marginTop:22}}><div><span>Thời gian</span>{t.start} → {t.end}</div><div><span>Phí đăng ký</span>{money(t.fee)}</div><div><span>Hạn đăng ký</span>{t.deadline}</div><div><span>Đã đăng ký</span>{t.registeredCount}/{t.max}</div></div>{reg?<div className="notice"><b>Đăng ký của bạn: {reg.name}</b><div style={{marginTop:8}}><Chip status={reg.status}/></div><p className="subtitle">Đã thu {money(reg.paid)} / {money(t.fee)}</p></div>:<p className="subtitle">{open?'Sẵn sàng tham gia cùng câu lạc bộ?':'Giải chưa mở hoặc đã đóng đăng ký.'}</p>}<div className="step-row"><Button className="sm" onClick={()=>show({type:'tournament',id:t.id})}>Chi tiết</Button>{!reg&&open&&<Button className="primary sm" onClick={()=>show({type:'registration',id:t.id})}>Đăng ký tham gia</Button>}</div></section>;})}</div>{!data.tournaments.length&&<div className="empty">Chưa có giải đấu được công bố.</div>}</>;
}
```

#### File: `frontend/src/pages/InformationPage.jsx`
```jsx
import React,{useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,MapPin,Phone,Mail,Clock,MessageSquare,Star,Trophy,CalendarDays,Users,CheckCircle2,Globe} from 'lucide-react';
import {api} from '../services/api';
import {Button,Chip} from '../components/UI';
import {PublicHeader,PublicFooter} from '../components/PublicLayout';
import {money,labels} from '../utils/format';
const categories={ALL:'Tất cả',NEWS:'Tin câu lạc bộ',NOTICE:'Thông báo',TOURNAMENT:'Giải đấu'};
const topics={COURT:'Chất lượng sân',SERVICE:'Dịch vụ',WEBSITE:'Trải nghiệm website',TOURNAMENT:'Giải đấu',OTHER:'Khác'};
const safeDecode=value=>{try{return decodeURIComponent(value);}catch{return '';}};
const dateLabel=value=>value?new Date(value).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
export function Stars({rating}){return <span className="rating-stars" aria-label={`${rating} trên 5 sao`}>{Array.from({length:5},(_,i)=><Star key={i} size={16} aria-hidden="true" fill={i<rating?'currentColor':'none'}/>)}</span>;}
function PageIntro({label,title,description}){return <section className="info-intro"><span className="section-kicker">{label}</span><h1>{title}</h1><p>{description}</p></section>;}
export default function InformationPage({path,onLogin,user}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;api('/public/content').then(v=>{if(active){setData(v);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[revision]);
 const active=path.startsWith('/tin-tuc')?'/tin-tuc':path;
 useEffect(()=>{const name=path.startsWith('/tin-tuc/')?data?.articles.find(a=>a.id===safeDecode(path.slice('/tin-tuc/'.length)))?.title:({'/gioi-thieu':'Giới thiệu','/lien-he':'Liên hệ','/feedback':'Feedback','/tin-tuc':'Tin tức & thông báo'})[path];document.title=(name||'Thông tin câu lạc bộ')+' · Courtly';},[path,data]);
 return <div className="public-page information-page"><a className="skip-link" href="#page-content">Bỏ qua đến nội dung</a><PublicHeader active={active} user={user} onLogin={onLogin}/><main id="page-content" className="info-container">{error?<div className="error" role="alert">{error} <Button onClick={()=>setRevision(x=>x+1)}>Thử lại</Button></div>:!data?<div className="loading" role="status">Đang tải nội dung…</div>:path==='/gioi-thieu'?<About club={data.club}/>:path==='/lien-he'?<Contact club={data.club}/>:path==='/feedback'?<Feedback data={data} user={user} onLogin={onLogin}/>:path==='/tin-tuc'?<News data={data}/>:<Article data={data} id={safeDecode(path.slice('/tin-tuc/'.length))}/>}</main><PublicFooter/></div>;
}
export function About({club}){return <><section className="about-hero"><div><span className="eyebrow">VỀ {club.name.toUpperCase()}</span><h1>{club.tagline}</h1><p>{club.intro}</p><a href="/#booking" className="btn lime">Khám phá lịch sân <ArrowRight size={18}/></a></div><div className="about-court" aria-hidden="true"><span>PLAY.<br/>CONNECT.<br/>REPEAT.</span><div className="court-art"><div/><span/></div></div></section><section className="about-story"><div><span className="section-kicker">CÂU CHUYỆN COURTLY</span><h2>Mỗi trận đấu bắt đầu<br/>từ sự kết nối.</h2></div><div><p className="preserve-lines">{club.story}</p><div className="mission"><span className="section-kicker">ĐIỀU CHÚNG TÔI HƯỚNG TỚI</span><p>{club.mission}</p></div></div></section><section className="about-services"><div className="section-heading"><div><span className="section-kicker">TRẢI NGHIỆM CÙNG COURTLY</span><h2>Từ lịch chơi đến ngày thi đấu</h2></div></div><div className="service-columns">{[[CalendarDays,'Chủ động lịch chơi','Xem giờ trống, giá từng khung và tiền cọc trước khi xác nhận đặt sân.'],[Trophy,'Theo dõi giải đấu','Tìm hiểu thể thức, lịch diễn ra và thông báo mới của từng giải.'],[MessageSquare,'Lắng nghe trải nghiệm','Gửi góp ý trực tiếp tới câu lạc bộ và theo dõi phản hồi trong tài khoản.']].map(([Icon,title,body],i)=><article key={title}><span className="service-index">0{i+1}</span><Icon size={26}/><h3>{title}</h3><p>{body}</p></article>)}</div></section><section className="info-cta"><div><h2>Hẹn nhau trên sân?</h2><p>Chọn lịch chơi phù hợp hoặc liên hệ với câu lạc bộ.</p></div><div className="step-row"><a className="btn primary" href="/#booking">Xem giờ trống</a><a className="btn" href="/lien-he">Liên hệ</a></div></section></>;}
export function Contact({club}){
 const items=[[MapPin,'Địa chỉ',club.address,null],[Phone,'Điện thoại',club.phone,club.phone?'tel:'+club.phone.replace(/[^+\d]/g,''):null],[Mail,'Email',club.email,club.email?'mailto:'+club.email:null],[Clock,'Giờ tiếp nhận',club.openingHours,null]];
 return <><PageIntro label="KẾT NỐI VỚI COURTLY" title="Hãy bắt đầu một cuộc trò chuyện." description="Bạn cần hỗ trợ đặt sân, tìm hiểu giải đấu hay muốn chia sẻ trải nghiệm? Chọn cách liên hệ phù hợp bên dưới."/><div className="contact-layout"><section className="contact-card"><h2>Thông tin liên hệ</h2><p className="subtitle">{club.name}</p><dl>{items.map(([Icon,title,value,href])=><div key={title}><Icon size={22}/><div><dt>{title}</dt><dd>{value?(href?<a href={href}>{value}</a>:value):<span className="muted">Đang cập nhật</span>}</dd></div></div>)}</dl>{club.socialUrl&&<a className="social-link" href={club.socialUrl} target="_blank" rel="noopener noreferrer"><Globe size={18}/>Kênh chính thức của câu lạc bộ <ArrowUpRight size={16}/></a>}</section><div className="contact-side"><section className="contact-map"><MapPin size={36}/><span className="section-kicker">HẸN GẶP TẠI SÂN</span><h2>{club.address?'Đường đến Courtly':'Thông tin vị trí đang được cập nhật'}</h2><p>{club.address||'Địa chỉ và chỉ đường sẽ hiển thị tại đây khi câu lạc bộ công bố thông tin chính thức.'}</p>{club.mapUrl&&<a className="btn lime" href={club.mapUrl} target="_blank" rel="noopener noreferrer">Mở bản đồ <ArrowUpRight size={16}/></a>}</section><section className="contact-feedback"><MessageSquare size={25}/><div><h3>Góp ý để Courtly tốt hơn</h3><p>Bạn có thể gửi riêng cho câu lạc bộ hoặc đồng ý chia sẻ trải nghiệm công khai.</p><a href="/feedback">Gửi feedback <ArrowRight size={15}/></a></div></section></div></div><section className="contact-faq"><span className="section-kicker">TRƯỚC KHI BẠN LIÊN HỆ</span><h2>Một vài thông tin hữu ích</h2><details><summary>Tôi cần đăng nhập để xem lịch sân không?</summary><p>Không. Bạn có thể xem sân, giờ trống và giá trước. Courtly chỉ yêu cầu đăng nhập khi tiếp tục đặt sân hoặc đăng ký tham gia giải.</p></details><details><summary>Làm thế nào để xác nhận đơn đặt sân?</summary><p>Kiểm tra mức cọc và thời hạn giữ chỗ trên đơn, sau đó liên hệ quầy để hoàn tất thanh toán. Đơn được xác nhận sau khi quầy ghi nhận đủ tiền cọc.</p></details><details><summary>Tôi xem thông báo giải đấu ở đâu?</summary><p>Truy cập <a href="/tin-tuc">Tin tức</a> và chọn mục Giải đấu để đọc thông tin, lịch và các thông báo liên quan.</p></details></section></>;
}
export function News({data}){
 const [category,setCategory]=useState('ALL'),[query,setQuery]=useState(''),[limit,setLimit]=useState(9);
 const list=data.articles.filter(a=>(category==='ALL'||a.category===category)&&`${a.title} ${a.excerpt}`.toLowerCase().includes(query.toLowerCase())),featured=list[0];
 return <><PageIntro label="NHỊP SỐNG TRÊN SÂN" title="Tin tức & thông báo" description="Theo dõi hoạt động câu lạc bộ, lịch giải đấu và những cập nhật dành cho người chơi."/>{data.sample&&<p className="demo-note">Thông tin giải hiện có thể bao gồm dữ liệu mẫu của bản trải nghiệm.</p>}<div className="news-toolbar"><div role="group" aria-label="Loại tin" className="time-filters">{Object.entries(categories).map(([key,value])=><button key={key} aria-pressed={category===key} className={category===key?'on':''} onClick={()=>{setCategory(key);setLimit(9);}}>{value}</button>)}</div><input aria-label="Tìm tin tức" placeholder="Tìm tên giải hoặc tin tức…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(9);}}/></div>{featured&&<a href={'/tin-tuc/'+encodeURIComponent(featured.id)} className="featured-news"><div className="news-art" aria-hidden="true"><Trophy size={72}/><span>COURTLY JOURNAL</span></div><div><span className="news-category">{categories[featured.category]}</span><small>{dateLabel(featured.publishedAt)}</small><h2>{featured.title}</h2><p>{featured.excerpt}</p><span className="read-more">Đọc tiếp <ArrowRight size={18}/></span></div></a>}<div className="news-grid">{list.slice(1,limit).map(a=><a className="news-card" key={a.id} href={'/tin-tuc/'+encodeURIComponent(a.id)}><div className="news-card-top"><span>{categories[a.category]}</span><small>{dateLabel(a.publishedAt)}</small></div><h3>{a.title}</h3><p>{a.excerpt}</p><span className="read-more">Xem bài viết <ArrowUpRight size={16}/></span></a>)}</div>{list.length>limit&&<Button onClick={()=>setLimit(x=>x+9)}>Xem thêm tin</Button>}{!list.length&&<div className="empty"><CalendarDays size={32}/><h3>Chưa có tin trong mục này</h3><p>Thông báo mới sẽ xuất hiện tại đây khi được câu lạc bộ công bố.</p></div>}</>;
}
export function Article({data,id}){
 const article=data.articles.find(a=>a.id===id);if(!article)return <div className="empty"><h1>Bài viết chưa được công bố</h1><p>Nội dung có thể đã được chuyển về bản nháp hoặc không tồn tại.</p><a className="btn primary" href="/tin-tuc">Trở lại tin tức</a></div>;
 const t=article.tournament;
 return <article className="article-page"><a className="article-back" href="/tin-tuc">← Tin tức & thông báo</a><header><span className="section-kicker">{categories[article.category]}</span><h1>{article.title}</h1><div className="article-meta">{dateLabel(article.publishedAt)} · {article.source==='TOURNAMENT'?'Thông tin từ lịch giải đấu':'Biên tập Courtly'}</div><p>{article.excerpt}</p></header><div className="article-rule"/><div className="article-body preserve-lines">{article.body}</div>{t&&<section className="tournament-facts"><h2>Thông tin giải đấu</h2><Chip status={t.status}/><dl>{[['Thể thức',labels[t.format]],['Thời gian',`${t.start} → ${t.end}`],['Hạn đăng ký',t.deadline],['Địa điểm',t.location],['Phí tham gia',money(t.fee)],['Số suất tối đa',t.max]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>}{article.tournamentId&&<a className="btn primary" href="/#tournaments">Xem giải & đăng ký <ArrowRight size={16}/></a>}<section className="article-contact"><p>Cần hỗ trợ thêm?</p><a href="/lien-he">Liên hệ Courtly <ArrowUpRight size={16}/></a></section></article>;
}
export function Feedback({data,user,onLogin}){
 const [rating,setRating]=useState(0),[topic,setTopic]=useState('SERVICE'),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[mine,setMine]=useState([]),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const refresh=()=>api('/feedback/mine').then(setMine).catch(e=>setError(e.message));
 useEffect(()=>{if(user)refresh();else setMine([]);},[user?.id]);
 const submit=async e=>{e.preventDefault();if(busy)return;setError('');setSuccess('');if(!rating)return setError('Vui lòng chọn số sao đánh giá.');setBusy(true);try{await api('/feedback','POST',{rating,topic,message,publishConsent:consent,requestId});setSuccess('Đã gửi phản hồi đến câu lạc bộ. Bạn có thể theo dõi trả lời bên dưới.');setMessage('');setRating(0);setConsent(false);setRequestId(crypto.randomUUID());await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><PageIntro label="LẮNG NGHE ĐỂ TỐT HƠN" title="Trải nghiệm của bạn có ý nghĩa." description="Chia sẻ điều bạn hài lòng và những điều Courtly có thể cải thiện. Mỗi góp ý đều có nơi để được tiếp nhận."/><div className="feedback-layout"><section className="feedback-form-card"><h2>Gửi lời nhắn đến Courtly</h2><p className="subtitle">Nội dung được gửi tới quản trị viên trước khi công khai.</p>{user?<form className="auth-fields" onSubmit={submit}><fieldset className="rating-field"><legend>Bạn đánh giá trải nghiệm thế nào?</legend><div>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} trên 5 sao`} aria-pressed={rating===n} onClick={()=>setRating(n)}><Star size={30} fill={n<=rating?'currentColor':'none'}/></button>)}</div><span>{rating?`${rating}/5 sao`:'Chọn từ 1 đến 5 sao'}</span></fieldset><div className="field"><label htmlFor="feedback-topic">Chủ đề</label><select id="feedback-topic" value={topic} onChange={e=>setTopic(e.target.value)}>{Object.entries(topics).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="field"><label htmlFor="feedback-message">Chia sẻ của bạn</label><textarea id="feedback-message" required minLength={10} maxLength={2000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Điều gì khiến bạn hài lòng? Chúng mình có thể làm tốt hơn ở đâu?"/><small>{message.length}/2000 ký tự</small></div><label className="consent-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Tôi đồng ý hiển thị tên, số sao và nội dung này công khai sau khi được duyệt. Không chọn nếu chỉ muốn gửi riêng.</span></label><small>Không đưa số điện thoại, email hoặc thông tin nhạy cảm vào nội dung muốn công khai.</small>{error&&<div className="error" role="alert">{error}</div>}{success&&<div className="notice" role="status">{success}</div>}<button className="btn primary" disabled={busy}>{busy?'Đang gửi…':'Gửi feedback'} <ArrowRight size={17}/></button></form>:<div className="feedback-login"><MessageSquare size={32}/><h3>Mỗi chia sẻ, một kết nối.</h3><p>Đăng nhập bằng tài khoản Courtly để gửi góp ý và theo dõi phản hồi của câu lạc bộ.</p><Button className="primary" onClick={()=>onLogin('login')}>Đăng nhập để gửi</Button></div>}</section><aside className="feedback-community"><div className="feedback-score"><span className="section-kicker">CHIA SẺ TỪ NGƯỜI CHƠI</span><strong>{data.feedbackStats.average??'—'}<small>/5</small></strong><p>{data.feedbackStats.count} phản hồi được đồng ý công khai và duyệt.</p></div>{data.feedback.slice(0,12).map(f=><article className="feedback-quote" key={f.id}><Stars rating={f.rating}/><p className="preserve-lines">{f.message}</p><footer><b>{f.displayName}</b><span>{dateLabel(f.createdAt)}</span></footer>{f.reply&&<div className="club-reply"><b>Courtly phản hồi</b><p className="preserve-lines">{f.reply}</p></div>}</article>)}{!data.feedback.length&&<div className="feedback-empty"><MessageSquare size={26}/><h3>Chờ chia sẻ đầu tiên</h3><p>Các đánh giá thực tế sẽ xuất hiện tại đây sau khi được người gửi đồng ý và câu lạc bộ duyệt.</p></div>}</aside></div>{user&&<section className="my-feedback"><h2>Phản hồi bạn đã gửi</h2>{mine.length?mine.map(f=><article className="feedback-quote" key={f.id}><div className="feedback-meta"><Stars rating={f.rating}/><small>{dateLabel(f.createdAt)} · {f.status==='PUBLISHED'?'Đã công khai':f.reply?'Đã có trả lời':'Đang tiếp nhận'}</small></div><p className="preserve-lines">{f.message}</p>{f.reply&&<div className="club-reply"><b>Courtly phản hồi</b><p className="preserve-lines">{f.reply}</p></div>}</article>):<p className="subtitle">Bạn chưa gửi phản hồi nào.</p>}</section>}</>;
}
```

#### File: `frontend/src/pages/MembershipAdminPage.jsx`
```jsx
import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Table,Button,Chip,Modal,FormDialog} from '../components/UI';
import {money,labels} from '../utils/format';
const time=v=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa kích hoạt';
export default function MembershipAdminPage(){
 const {data,mutate}=useCourtly(),[edit,setEdit]=useState(null),[collect,setCollect]=useState(null),[method,setMethod]=useState('CASH'),[code,setCode]=useState(''),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('PENDING'),[request,setRequest]=useState('');
 const members=(data.memberships||[]).filter(m=>!filter||m.status===filter);
 const start=m=>{setCollect(m);setMethod('CASH');setCode('');setVerified(false);setError('');setRequest(crypto.randomUUID());};
 const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await mutate(`/membership/requests/${collect.id}/activate`,{amount:collect.price,method,transactionCode:code.trim(),collected:verified,requestId:request});setCollect(null);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><Title subtitle="Quản lý gói, đăng ký và xác minh phí trước khi kích hoạt.">Membership & hội viên</Title><div className="grid-cards membership-admin-plans">{(data.membershipPlans||[]).map(p=><section className="panel" key={p.id}><div className="panel-body"><Chip status={p.enabled?'ACTIVE':'INACTIVE'}/><h2>{p.name}</h2><p>{money(p.price)} / {p.days} ngày · Giảm {p.discountPercent}% tiền sân</p><Button onClick={()=>setEdit(p)}>Sửa gói</Button></div></section>)}</div><Panel title="Danh sách hội viên" action={<label>Lọc trạng thái<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tất cả</option>{['PENDING','ACTIVE','EXPIRED','CANCELLED'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>}><Table headings={['Khách hàng / mã đăng ký','Gói & phí','Hiệu lực','Trạng thái','Thao tác']} empty={!members.length}>{members.map(m=><tr key={m.id}><td>{data.accounts.find(a=>a.id===m.accountId)?.name||m.name}<small>{m.id}</small></td><td>{m.planName}<small>{money(m.price)} / {m.days} ngày · {m.discountPercent}%</small></td><td>{time(m.startsAt)}{m.endsAt&&<small>Đến trước {time(m.endsAt)}</small>}</td><td><Chip status={m.status}/></td><td>{m.status==='PENDING'?<Button className="primary" onClick={()=>start(m)}>Thu phí & kích hoạt</Button>:'—'}</td></tr>)}</Table></Panel><Panel title="Phiếu thu phí membership"><Table headings={['Thời điểm','Khách hàng / gói','Mã phiếu thu','Phương thức','Số tiền']} empty={!data.membershipPayments?.length}>{(data.membershipPayments||[]).map(p=><tr key={p.id}><td>{time(p.createdAt)}</td><td>{data.accounts.find(a=>a.id===p.accountId)?.name}<small>{p.planName}</small></td><td>{p.transactionCode}</td><td>{labels[p.method]}</td><td className="money-cell">{money(p.amount)}</td></tr>)}</Table></Panel>{edit&&<FormDialog title={'Sửa gói '+edit.name} initial={edit} onClose={()=>setEdit(null)} fields={[{name:'name',label:'Tên gói',maxLength:60},{name:'price',label:'Phí gói (đ)',type:'number',min:1,max:100000000},{name:'days',label:'Hiệu lực (ngày)',type:'number',min:1,max:366},{name:'discountPercent',label:'Giảm tiền sân (%)',type:'number',min:1,max:50},{name:'description',label:'Mô tả ngắn',maxLength:200,full:true},{name:'enabled',label:'Mở đăng ký',options:[{value:true,label:'Mở đăng ký'},{value:false,label:'Tạm dừng'}]}]} onSubmit={async v=>{await mutate('/membership/plans',{...v,enabled:v.enabled===true||v.enabled==='true'},'PUT');setEdit(null);}}><p className="notice">Giá và quyền lợi mới chỉ áp dụng cho đăng ký tạo sau khi sửa. Gói đã đăng ký giữ nguyên giá và điều kiện.</p></FormDialog>}{collect&&<Modal title={'Xác minh phí · '+collect.planName} onClose={()=>!busy&&setCollect(null)} footer={<><Button disabled={busy} onClick={()=>setCollect(null)}>Quay lại</Button><button type="submit" form="membership-collect" className="btn primary" disabled={busy||!verified}>{busy?'Đang ghi nhận…':'Ghi nhận thu & kích hoạt'}</button></>}><p>{collect.name} · Phí cần xác minh: <b>{money(collect.price)}</b></p><p className="notice" style={{margin:'16px 0'}}>Thao tác này ghi nhận tiền thực nhận và bắt đầu {collect.days} ngày hội viên. Chỉ xác nhận khi đã kiểm tra tiền mặt hoặc sao kê.</p><form id="membership-collect" onSubmit={submit}><div className="form-grid"><label>Phương thức<select value={method} onChange={e=>{setMethod(e.target.value);setRequest(crypto.randomUUID());}}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label><label>Mã phiếu thu / giao dịch *<input required maxLength={100} value={code} onChange={e=>{setCode(e.target.value);setRequest(crypto.randomUUID());}}/></label></div><label className="consent-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>Tôi đã xác minh nhận đủ {money(collect.price)}.</label></form>{error&&<p className="error" role="alert">{error}</p>}</Modal>}</>;
}
```

#### File: `frontend/src/pages/MembershipPage.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {PublicHeader,PublicFooter} from '../components/PublicLayout';
import MembershipPlans,{MembershipTerms} from '../components/MembershipPlans';
import {api} from '../services/api';
import {today} from '../utils/format';
import {Button} from '../components/UI';
export default function MembershipPage({onLogin,user,onAction}){
 const [plans,setPlans]=useState(null),[error,setError]=useState('');
 const load=()=>{setError('');api('/public/overview?date='+today()).then(d=>setPlans(d.membershipPlans||[])).catch(e=>setError(e.message));};
 useEffect(()=>{load();},[]);
 return <div className="public-page"><PublicHeader user={user} onLogin={onLogin} active="/membership"/><main className="membership-public public-section"><header className="membership-intro"><span className="section-kicker">COURTLY MEMBERSHIP</span><h1>Chơi thường xuyên.<br/>Gắn bó nhiều hơn.</h1><p>Chọn quyền lợi phù hợp với nhịp ra sân. Xem rõ phí hội viên, thời hạn và ưu đãi trước khi đăng ký.</p></header>{error?<div className="error" role="alert">{error} <Button onClick={load}>Thử lại</Button></div>:plans?<MembershipPlans plans={plans} onChoose={p=>onAction({type:'membership',planId:p.id})}/>:<p className="loading" role="status">Đang tải các gói hội viên…</p>}<MembershipTerms/></main><PublicFooter/></div>;
}
```

#### File: `frontend/src/pages/MyMembership.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {useCourtly} from '../context';
import {Title,Button,Modal,Chip} from '../components/UI';
import MembershipPlans,{MembershipTerms} from '../components/MembershipPlans';
import {money} from '../utils/format';
const time=v=>new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export default function MyMembership({initialPlan}){
 const {data,user,mutate,navigate}=useCourtly(),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const mine=(data.memberships||[]).filter(m=>m.accountId===user.accountId),active=mine.find(m=>m.status==='ACTIVE'),pending=mine.find(m=>m.status==='PENDING'),plans=data.membershipPlans||[];
 useEffect(()=>{if(initialPlan&&!active&&!pending)setSelected(plans.find(p=>p.id===initialPlan&&p.enabled)||null);},[initialPlan]);
 const [request,setRequest]=useState(()=>crypto.randomUUID());
 const choose=p=>{setSelected(p);setError('');setRequest(crypto.randomUUID());};
 const register=async()=>{if(busy)return;setBusy(true);setError('');try{await mutate('/membership/requests',{planId:selected.id,requestId:request});setSelected(null);setSuccess('Đã gửi đăng ký. Gói chưa có hiệu lực; vui lòng thanh toán phí tại quầy để được xác nhận.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const cancel=async()=>{if(busy)return;setBusy(true);setError('');try{await mutate(`/membership/requests/${pending.id}/cancel`,{requestId:crypto.randomUUID()});setSuccess('Đã hủy đăng ký chờ xác nhận.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <><Title subtitle="Quyền lợi, thời hạn và đăng ký gói hội viên gắn với tài khoản của bạn.">Membership của tôi</Title>{success&&<p className="notice" role="status">{success}</p>}{error&&!selected&&<p className="error" role="alert">{error}</p>}{active&&<section className="member-pass"><span className="section-kicker">COURTLY MEMBER</span><div><h2>{active.planName}</h2><Chip status="ACTIVE"/></div><p>{user.name} · Giảm {active.discountPercent}% tiền sân hợp lệ</p><dl><div><dt>Hiệu lực từ</dt><dd>{time(active.startsAt)}</dd></div><div><dt>Đến trước</dt><dd>{time(active.endsAt)}</dd></div><div><dt>Đã tiết kiệm trên đơn đang dùng / hoàn tất</dt><dd>{money(data.orders.filter(o=>!['CANCELLED','EXPIRED'].includes(o.status)&&o.membershipBenefit?.membershipId===active.id).reduce((n,o)=>n+o.membershipBenefit.discount,0))}</dd></div></dl><Button onClick={()=>navigate('calendar')}>Đặt sân với quyền lợi hội viên</Button></section>}{pending&&<section className="membership-pending"><Chip status="PENDING"/><h2>Đăng ký {pending.planName}</h2><p>Phí {money(pending.price)} / {pending.days} ngày · Giảm {pending.discountPercent}% tiền sân. Chưa bắt đầu tính thời hạn.</p><p>Quầy xác minh đủ phí mới kích hoạt gói. Vui lòng cung cấp mã đăng ký: <b>{pending.id}</b>.</p><Button disabled={busy} onClick={cancel}>{busy?'Đang xử lý…':'Hủy đăng ký chưa thanh toán'}</Button></section>}<MembershipPlans plans={plans} onChoose={choose} blocked={!!active||!!pending} busy={busy}/><MembershipTerms/>{mine.length>0&&<section className="membership-log"><h2>Lịch sử hội viên</h2>{mine.map(m=><div className="order-line" key={m.id}><span>{m.planName} · {money(m.price)}<small>Đăng ký {time(m.createdAt)}{m.endsAt?' · Hết hạn '+time(m.endsAt):''}</small></span><Chip status={m.status}/></div>)}</section>}{selected&&<Modal title={'Đăng ký gói '+selected.name} onClose={()=>!busy&&setSelected(null)} footer={<><Button disabled={busy} onClick={()=>setSelected(null)}>Quay lại</Button><Button className="primary" disabled={busy} onClick={register}>{busy?'Đang gửi…':'Gửi đăng ký'}</Button></>}><p>Gói <b>{selected.name}</b> · {money(selected.price)} / {selected.days} ngày · Giảm {selected.discountPercent}% tiền sân.</p><p className="notice" style={{marginTop:16}}>Chưa thu tiền khi gửi yêu cầu. Chỉ kích hoạt sau khi quầy xác minh đã nhận đủ phí. Không tự gia hạn.</p>{error&&<p className="error" role="alert">{error}</p>}</Modal>}</>;
}
```

#### File: `frontend/src/pages/NotificationsPage.jsx`
```jsx
import React from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Button} from '../components/UI';
import {today,money} from '../utils/format';
export default function NotificationsPage(){
 const {data,show}=useCourtly();const holds=data.orders.filter(o=>o.status==='HOLDING'),soon=data.orders.filter(o=>o.date===today()&&o.status==='CONFIRMED');
 return <><Title subtitle="Nhắc việc trong website khi bạn mở trang.">Thông báo</Title><Panel title="Việc cần xử lý"><div className="panel-body">{holds.map(o=><div className="activity" key={o.id}><div><p>{o.name} · chờ cọc {money(Math.max(0,o.deposit-o.paid))}</p><small>Hạn giữ: {new Date(o.holdUntil).toLocaleTimeString('vi-VN')}</small><Button className="sm" onClick={()=>show({type:'order',id:o.id})}>Xem đơn</Button></div></div>)}{soon.map(o=><div className="activity" key={o.id}><div><p>{o.name} · có lịch hôm nay</p><small>{o.slots.map(s=>s.hour+':00').join(', ')}</small></div></div>)}{!holds.length&&!soon.length&&<p className="empty">Không có việc cần chú ý</p>}<div className="notice" style={{marginTop:20}}>Chưa gửi SMS hoặc email. Backend tự kiểm tra hết hạn giữ chỗ mỗi 30 giây.</div></div></Panel></>;
}
```

#### File: `frontend/src/pages/OperationsPage.jsx`
```jsx
import {slotLabel,slotHours,hourLabel} from '../utils/format';
import React from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Button,Chip,Table} from '../components/UI';
import {money,today} from '../utils/format';
export default function OperationsPage(){const {data,show}=useCourtly();const groups=[['Khách sắp đến',data.orders.filter(o=>o.status==='CONFIRMED'&&o.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.slots[0].hour-b.slots[0].hour)],['Khách đang sử dụng sân',data.orders.filter(o=>o.status==='CHECKED_IN')],['Chờ cọc / sắp hết hạn',data.orders.filter(o=>o.status==='HOLDING').sort((a,b)=>a.holdUntil.localeCompare(b.holdUntil))],['Cần thu / hoàn / đối chiếu',data.orders.filter(o=>o.finance?.review||o.finance?.refundPending>0||['CONFIRMED','CHECKED_IN','COMPLETED'].includes(o.status)&&o.paid<o.total)],['Phân công trọng tài',data.orders.filter(o=>['HOLDING','CONFIRMED','CHECKED_IN'].includes(o.status)&&o.staff.length)]];return <><Title subtitle="Ưu tiên công việc cần xử lý và truy cập trực tiếp vào đơn.">Vận hành hôm nay</Title><div className="operations-grid">{groups.map(([title,orders])=><Panel key={title} title={title+' · '+orders.length}><Table headings={['Khách / lịch','Trạng thái','Thao tác']} empty={!orders.length}>{orders.map(o=><tr key={o.id}><td><b>{o.name}</b><small>{o.date} · {o.slots.map(s=>slotLabel(s)).join(', ')}</small>{o.status==='HOLDING'&&<small>Hạn {new Date(o.holdUntil).toLocaleString('vi-VN')}</small>}<small>{o.finance?.review?'Cần đối chiếu tiền':`Còn thu ${money(o.finance?.due||0)}`}</small>{title==='Phân công trọng tài'&&o.staff.map(st=><small key={st.id}>{st.name} · {st.scheduleId?`${data.courts.find(c=>c.id===st.court)?.name} ${st.hour}h`:'Phân công cũ cần kiểm tra'}</small>)}</td><td><Chip status={o.status}/></td><td><Button className="sm" onClick={()=>show({type:'order',id:o.id})}>Mở đơn</Button></td></tr>)}</Table></Panel>)}</div></>;}
```

#### File: `frontend/src/pages/OrdersPage.jsx`
```jsx
import React, { useState, useMemo } from 'react';
import { Calendar, Search, Filter, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Panel, Button, Chip, Modal } from '../components/UI';
import OrderTable from '../components/OrderTable';
import { labels, today, money } from '../utils/format';

export default function OrdersPage() {
  const { data, navigate, mutate, notify, show } = useCourtly();
  const currentToday = today();

  // Search, status and date range filters
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState('all'); // 'today' | 'upcoming' | 'recent7' | 'month' | 'custom' | 'all'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Quick QR/Ticket Check-In Dialog State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const matchedOrder = useMemo(() => {
    const raw = (ticketInput || '').trim();
    if (!raw) return null;
    let target = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.orderId) target = parsed.orderId;
      else if (parsed.ticket) target = parsed.ticket;
    } catch {}

    const clean = target.toUpperCase().replace(/^#/, '');
    return data.orders.find(o => {
      const tCode = 'CT' + o.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const tCodeHyphen = 'CT-' + o.id.replace(/-/g, '').slice(0, 6).toUpperCase();
      return (
        o.id === target ||
        o.id.startsWith(target) ||
        tCode === clean ||
        tCodeHyphen === clean ||
        o.phone === target ||
        (clean.length >= 4 && (tCode.includes(clean) || o.id.replace(/-/g, '').toUpperCase().includes(clean)))
      );
    });
  }, [ticketInput, data.orders]);

  const handleQuickCheckIn = async (orderId) => {
    try {
      setActionLoading(true);
      await mutate(`/orders/${orderId}/check-in`, {});
      notify('✅ Khách đã check-in thành công!');
    } catch (e) {
      notify(e.message || 'Không thể check-in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickCheckOut = async (orderId) => {
    try {
      setActionLoading(true);
      await mutate(`/orders/${orderId}/check-out`, {});
      notify('🏁 Khách đã check-out & hoàn tất!');
    } catch (e) {
      notify(e.message || 'Không thể check-out');
    } finally {
      setActionLoading(false);
    }
  };

  // Status counts for quick tabs
  const counts = useMemo(() => {
    const map = { all: data.orders.length, HOLDING: 0, CONFIRMED: 0, CHECKED_IN: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const o of data.orders) {
      if (map[o.status] !== undefined) map[o.status]++;
      else if (o.status === 'EXPIRED') map.CANCELLED++;
    }
    return map;
  }, [data.orders]);

  // Filter orders
  const filtered = useMemo(() => {
    return data.orders.filter(o => {
      // 1. Search text
      if (query.trim()) {
        const q = query.toLowerCase();
        const match = `${o.name} ${o.phone || ''} ${o.id}`.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Status filter
      if (status) {
        if (status === 'CANCELLED') {
          if (!['CANCELLED', 'EXPIRED'].includes(o.status)) return false;
        } else if (o.status !== status) {
          return false;
        }
      }

      // 3. Date range filter
      if (dateRange === 'today') {
        if (o.date !== currentToday) return false;
      } else if (dateRange === 'upcoming') {
        if (o.date < currentToday || ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(o.status)) return false;
      } else if (dateRange === 'recent7') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString().slice(0, 10);
        if (o.date < d7Str || o.date > currentToday) return false;
      } else if (dateRange === 'month') {
        const curM = currentToday.slice(0, 7);
        if (!o.date.startsWith(curM)) return false;
      } else if (dateRange === 'custom') {
        if (customFrom && o.date < customFrom) return false;
        if (customTo && o.date > customTo) return false;
      }

      return true;
    }).sort((a, b) => {
      // Newest date first; if same date, compare createdAt
      const dComp = b.date.localeCompare(a.date);
      if (dComp !== 0) return dComp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [data.orders, query, status, dateRange, customFrom, customTo, currentToday]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleStatusChange = s => {
    setStatus(s);
    setPage(1);
  };

  const handleDateRangeChange = r => {
    setDateRange(r);
    setPage(1);
  };

  return (
    <>
      <Title
        subtitle="Quản lý vòng đời đơn: từ giữ chỗ, check-in, dịch vụ tại sân đến hóa đơn."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              className="secondary"
              onClick={() => { setScannerOpen(true); setTicketInput(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#e8f5e9',
                borderColor: '#a5d6a7',
                color: '#1b5e20',
                fontWeight: 600
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Quét mã / Check-in vé
            </Button>
            <Button className="primary" onClick={() => navigate('calendar')}>
              <Plus size={16} /> Đặt sân mới
            </Button>
          </div>
        }
      >
        Đơn đặt sân
      </Title>

      {/* Quick Status Tabs with Badges */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          ['', `Tất cả (${counts.all})`],
          ['HOLDING', `Chờ cọc (${counts.HOLDING})`],
          ['CONFIRMED', `Đã xác nhận (${counts.CONFIRMED})`],
          ['CHECKED_IN', `Đang chơi (${counts.CHECKED_IN})`],
          ['COMPLETED', `Hoàn tất (${counts.COMPLETED})`],
          ['CANCELLED', `Đã hủy / Hết hạn (${counts.CANCELLED})`]
        ].map(([s, label]) => (
          <button
            key={s}
            className={status === s ? 'on' : ''}
            onClick={() => handleStatusChange(s)}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel
        title={`Danh sách đơn hàng (${filtered.length} đơn phù hợp)`}
        action={
          <div className="tools" style={{ gap: 10 }}>
            {/* Date filter selector */}
            <select
              aria-label="Khoảng thời gian"
              value={dateRange}
              onChange={e => handleDateRangeChange(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="all">Toàn bộ thời gian</option>
              <option value="today">Hôm nay ({currentToday})</option>
              <option value="upcoming">Sắp tới (chưa check-in)</option>
              <option value="recent7">7 ngày gần nhất</option>
              <option value="month">Tháng này ({currentToday.slice(0, 7)})</option>
              <option value="custom">Khoảng ngày tùy chọn…</option>
            </select>

            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  aria-label="Từ ngày"
                  placeholder="Từ ngày"
                  value={customFrom}
                  onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                  style={{ width: 145 }}
                />
                <input
                  type="date"
                  aria-label="Đến ngày"
                  placeholder="Đến ngày"
                  value={customTo}
                  onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                  style={{ width: 145 }}
                />
              </>
            )}

            {/* Search Box */}
            <input
              className="search"
              placeholder="Tìm tên khách, số ĐT, mã đơn…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              style={{ minWidth: 230 }}
            />
          </div>
        }
      >
        <OrderTable orders={pagedOrders} />

        {/* Pagination Toolbar */}
        {filtered.length > 0 && (
          <div
            className="panel-body"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--line)',
              padding: '14px 20px',
              flexWrap: 'wrap',
              gap: 12,
              background: '#fcfdfc'
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Hiển thị <b>{(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filtered.length)}</b> trong tổng số <b>{filtered.length}</b> đơn hàng
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ margin: 0, fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Số dòng:
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ minHeight: 34, padding: '4px 8px', width: 'auto' }}
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  className="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Trang trước
                </Button>
                <span style={{ fontSize: 13, fontWeight: 600, padding: '6px 10px', background: 'white', border: '1px solid var(--line)', borderRadius: 6 }}>
                  {currentPage} / {totalPages}
                </span>
                <Button
                  className="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Trang sau <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {scannerOpen && (
        <Modal
          title="Quét mã QR / Check-in vé điện tử"
          onClose={() => { setScannerOpen(false); setTicketInput(''); }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#173c32' }}>
              Mã vé QR hoặc mã đơn / Số điện thoại:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                type="text"
                value={ticketInput}
                onChange={e => setTicketInput(e.target.value)}
                placeholder="Nhập hoặc dán mã vé (CT-XXXX), ID đơn, hoặc quét QR…"
                style={{ flex: 1, padding: '10px 14px', fontSize: 15, borderRadius: 8, border: '1px solid #173c32' }}
              />
              {ticketInput && (
                <Button className="sm" onClick={() => setTicketInput('')}>
                  Xóa
                </Button>
              )}
            </div>
            <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
              Tip: Quét mã QR từ điện thoại của khách hoặc nhập mã vé in trên E-Ticket (ví dụ: CT-ABC123).
            </small>
          </div>

          {matchedOrder ? (
            <div style={{
              background: '#f8faf7',
              border: '1.5px solid #c2dbbe',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 4px 12px rgba(23,60,50,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{
                    display: 'inline-block',
                    background: '#173c32',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5
                  }}>
                    CT-{matchedOrder.id.replace(/-/g, '').slice(0, 6).toUpperCase()}
                  </span>
                  <h3 style={{ margin: '6px 0 0', fontSize: 18, color: '#173c32' }}>{matchedOrder.name}</h3>
                  <div style={{ fontSize: 13, color: '#666' }}>ĐT: <b>{matchedOrder.phone || 'Chưa cung cấp'}</b></div>
                </div>
                <Chip status={matchedOrder.status} />
              </div>

              <div style={{ background: '#fff', border: '1px solid #e1e7de', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Lịch sân:</span>
                  <b>{matchedOrder.date} • {matchedOrder.slots.map(s => `${data.courts.find(c => c.id === s.court)?.name || 'Sân'} (${s.hour}:00)`).join(', ')}</b>
                </div>
                {matchedOrder.staff?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: '#666' }}>Trọng tài:</span>
                    <b>{matchedOrder.staff.map(st => st.name).join(', ')}</b>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px dashed #eee', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ color: '#666' }}>Tài chính:</span>
                  <span>Đã thu: <b style={{ color: '#1b5e20' }}>{money(matchedOrder.paid)}</b> / Tổng: <b>{money(matchedOrder.total)}</b></span>
                </div>
              </div>

              {matchedOrder.status === 'HOLDING' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ⏳ Đơn đang giữ chỗ và chưa thanh toán tiền cọc. Lễ tân cần thu cọc <b>{money(matchedOrder.deposit)}</b> trước khi xác nhận check-in.
                </div>
              )}

              {matchedOrder.status === 'CONFIRMED' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ✓ Vé hợp lệ! Đã đặt cọc thành công. Khách đã đến sân và sẵn sàng check-in.
                </div>
              )}

              {matchedOrder.status === 'CHECKED_IN' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  🎾 Khách đang chơi trên sân (Check-in lúc {new Date(matchedOrder.checkInAt).toLocaleTimeString('vi-VN')}). Khi kết thúc giờ chơi, bấm Check-out & Hoàn tất.
                </div>
              )}

              {matchedOrder.status === 'COMPLETED' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                  ✓ Đơn hàng đã hoàn tất buổi chơi lúc {matchedOrder.checkOutAt ? new Date(matchedOrder.checkOutAt).toLocaleTimeString('vi-VN') : ''}.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                {matchedOrder.status === 'CONFIRMED' && (
                  <Button
                    className="primary"
                    disabled={actionLoading}
                    onClick={() => handleQuickCheckIn(matchedOrder.id)}
                    style={{ background: '#166534', borderColor: '#166534', fontWeight: 700 }}
                  >
                    {actionLoading ? 'Đang xử lý…' : '✅ Xác nhận Check-in ngay'}
                  </Button>
                )}
                {matchedOrder.status === 'CHECKED_IN' && (
                  <Button
                    className="primary"
                    disabled={actionLoading}
                    onClick={() => handleQuickCheckOut(matchedOrder.id)}
                    style={{ background: '#1e40af', borderColor: '#1e40af', fontWeight: 700 }}
                  >
                    {actionLoading ? 'Đang xử lý…' : '🏁 Check-out & Hoàn tất'}
                  </Button>
                )}
                {matchedOrder.status === 'HOLDING' && (
                  <Button
                    className="lime"
                    onClick={() => { setScannerOpen(false); show({ type: 'payment', id: matchedOrder.id }); }}
                  >
                    Thu cọc tại quầy ({money(matchedOrder.deposit)})
                  </Button>
                )}
                <Button
                  onClick={() => { setScannerOpen(false); show({ type: 'order', id: matchedOrder.id }); }}
                >
                  Xem chi tiết đơn
                </Button>
                <Button onClick={() => setScannerOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          ) : ticketInput ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', background: '#fff5f5', border: '1px dashed #feb2b2', borderRadius: 8, color: '#c53030' }}>
              Không tìm thấy đơn hàng nào khớp với mã: <b>"{ticketInput}"</b>.
              <div style={{ fontSize: 12, marginTop: 6, color: '#742a2a' }}>Vui lòng kiểm tra lại mã vé trên điện thoại của khách.</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 12px', background: '#f9f9f9', border: '1px dashed #d1d5db', borderRadius: 8, color: '#6b7280' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', color: '#9ca3af' }}>
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <div>Chưa nhập mã vé hoặc chưa quét QR.</div>
              <small>Có thể dán mã vé (ví dụ: CT-XXXX) hoặc quét mã từ camera / máy quét mã vạch.</small>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
```

#### File: `frontend/src/pages/PaymentsPage.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {Wallet, RefreshCw, Trophy, ChartColumn, Users} from 'lucide-react';
import {useCourtly} from '../context';
import {Title, Stat, Panel, Table, Chip, Button, Tabs} from '../components/UI';
import {money,labels,localDate,dateLabel} from '../utils/format';

export default function PaymentsPage(){
 const {data,show,date,setDate}=useCourtly(); const [tab,setTab]=useState('transactions');
 const [payConfig,setPayConfig]=useState(null);
 useEffect(()=>{fetch('/api/public/payment-config').then(r=>r.ok?r.json():null).then(d=>d&&setPayConfig(d)).catch(()=>{});},[]);

 const memPayments = (data.membershipPayments || []).map(m => ({
   ...m,
   id: m.id,
   orderId: m.membershipId || '',
   type: 'MEMBERSHIP_FEE',
   refundable: 0,
   createdAt: m.createdAt,
   paidAt: m.createdAt,
   isMembership: true
 }));
 const allPayments = [...data.payments, ...memPayments].sort((a,b) => new Date(b.createdAt||b.paidAt) - new Date(a.createdAt||a.paidAt));

 const income = allPayments.reduce((a,p)=>a+p.amount,0);
 const refund = data.refunds.reduce((a,p)=>a+p.amount,0);
 const memTotal = memPayments.reduce((a,p)=>a+p.amount,0);
 const inDay = allPayments.filter(p=>localDate(p.createdAt||p.paidAt)===date);

 return <><Title subtitle="Tiền mặt, chuyển khoản VietQR và lịch sử khoản hoàn." action={<Button className="primary" onClick={()=>show({type:'payment'})}>Thu tiền tại quầy</Button>}>Thu tiền & hoàn tiền</Title>
 <div className="stats">
   <Stat title="Tổng đã thu" value={money(income)} note="Toàn bộ sân, giải & hội viên" icon={Wallet}/>
   <Stat title="Tổng đã hoàn" value={money(refund)} note="Khoản hoàn ghi nhận" icon={RefreshCw}/>
   <Stat title="Thu phí hội viên" value={money(memTotal)} note="Gói Club & Plus" icon={Users}/>
   <Stat title="Thu ròng" value={money(income-refund)} note="Thu trừ hoàn" icon={ChartColumn}/>
 </div>
 <Tabs options={[["transactions","Giao dịch"],["refunds","Hoàn tiền"],["closing","Đối chiếu ca"]]} value={tab} onChange={setTab}/>
 <Panel title={tab==='refunds'?'Lịch sử hoàn tiền':tab==='closing'?'Đối chiếu cuối ngày':'Lịch sử giao dịch'} action={tab==='closing'&&<div className="tools"><input aria-label="Ngày đối chiếu" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/><Button className="sm" onClick={()=>show({type:'closing'})}>In đối chiếu</Button></div>}>
 {tab==='transactions'&&<Table headings={['Giao dịch','Đơn / Đăng ký','Loại thu','Phương thức','Số tiền','']} empty={!allPayments.length}>{allPayments.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}<small>{new Date(p.createdAt||p.paidAt).toLocaleString('vi-VN')}</small></td><td>{p.isMembership ? (p.planName ? `Gói ${p.planName}` : 'Hội viên') : (p.orderId||p.registrationId||'').slice(0,8)}</td><td><Chip status={p.type}/></td><td>{labels[p.method]||p.method}</td><td className="name">{money(p.amount)}</td><td><Button className="sm" disabled={p.refundable<=0} onClick={()=>show({type:'refund',id:p.id})}>Hoàn tiền</Button></td></tr>)}</Table>}
 {tab==='refunds'&&<Table headings={['Mã hoàn','Giao dịch','Số tiền','Lý do','Thời điểm']} empty={!data.refunds.length}>{data.refunds.map(r=><tr key={r.id}><td>{r.id.slice(0,8)}</td><td>{r.paymentId.slice(0,8)}</td><td>{money(r.amount)}</td><td>{r.reason}</td><td>{new Date(r.createdAt).toLocaleString('vi-VN')}</td></tr>)}</Table>}
 {tab==='closing'&&<div className="panel-body"><p className="subtitle">{dateLabel(date)}</p>{['CASH','BANK_TRANSFER'].map(m=><div className="summary-line" key={m}><span>{labels[m]||m} • {inDay.filter(p=>p.method===m).length} giao dịch</span><b>{money(inDay.filter(p=>p.method===m).reduce((a,p)=>a+p.amount,0))}</b></div>)}<div className="summary-line"><span>Đã hoàn trong ngày</span><b>{money(data.refunds.filter(r=>localDate(r.createdAt)===date).reduce((a,r)=>a+r.amount,0))}</b></div><div className="notice">Báo cáo đối chiếu tổng hợp doanh thu theo ngày (đã bao gồm tiền mặt & chuyển khoản sân bãi, giải đấu và hội viên).</div></div>}
 </Panel>
 <div className="notice" style={{marginTop:20,background:payConfig?.mode==='LIVE'?'#e8f5e9':'#eff6ff',borderColor:payConfig?.mode==='LIVE'?'#a5d6a7':'#bfdbfe',color:payConfig?.mode==='LIVE'?'#1b5e20':'#1e40af'}}>
   {payConfig?.mode === 'LIVE' ? (
     <>✓ <b>Cổng thanh toán VietQR Napas 24/7 ({payConfig.bankName || 'MB Bank'}) đang hoạt động [LIVE].</b> Tự động khớp lệnh qua webhook SePay.</>
   ) : payConfig?.mode === 'SANDBOX' ? (
     <>⚡ <b>Chế độ Sandbox thử nghiệm ({payConfig?.bankName || 'MB Bank'}).</b> Webhook mô phỏng đang bật để kiểm thử đối soát giao dịch.</>
   ) : (
     <>ℹ <b>Chế độ Demo nội bộ ({payConfig?.bankName || 'MB Bank'}).</b> Hỗ trợ mô phỏng thanh toán chuyển khoản và thu tiền mặt tại quầy.</>
   )}
 </div></>;
}
```

#### File: `frontend/src/pages/ProfilePage.jsx`
```jsx
import MyMembership from './MyMembership';
import {MyOrders} from './CustomerPage';
import {MyHistory,MyPayments} from './CustomerHistory';
import React,{useState,useEffect} from 'react';
import {CourtlyContext,useCourtly} from '../context';
import PasswordForm from '../components/PasswordForm';
import {Title,Panel,Chip,Tabs} from '../components/UI';
export function PersonalDetails(){
 const {user,mutate,notify}=useCourtly();const [name,setName]=useState(user.name),[phone,setPhone]=useState(user.phone||''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{setName(user.name);setPhone(user.phone||'');},[user.name,user.phone]);
 return <><Title subtitle="Thông tin dùng khi đặt sân và đăng ký giải.">Hồ sơ của tôi</Title><div className="profile-grid"><Panel title="Thông tin cá nhân"><form className="panel-body" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);setError('');try{await mutate('/profile',{name,phone},'PATCH');notify('Đã cập nhật hồ sơ');}catch(e){setError(e.message);}finally{setSaving(false);}}}><div className="form-grid"><div className="field"><label htmlFor="profile-name">Họ và tên</label><input id="profile-name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></div><div className="field"><label htmlFor="profile-phone">Số điện thoại</label><input id="profile-phone" type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></div><div className="field full"><label htmlFor="profile-email">Email đăng nhập</label><input id="profile-email" value={user.email} readOnly/><small>Email dùng để đăng nhập tài khoản Courtly.</small></div></div>{error&&<div className="error" role="alert">{error}</div>}<button className="btn primary" style={{marginTop:24}} disabled={saving}>{saving?'Đang lưu…':'Lưu hồ sơ'}</button></form></Panel><Panel title="Quyền truy cập"><div className="panel-body"><Chip status={user.role}/><p className="subtitle" style={{marginTop:14}}>{user.role==='ADMIN'?'Bạn có quyền quản lý vận hành câu lạc bộ, tài khoản và giao dịch.':'Bạn có thể đặt sân, xem và đổi/hủy đơn của mình trước khi check-in, đăng ký giải và cập nhật hồ sơ.'}</p>{user.isOwner&&<p className="notice" style={{marginTop:18}}>Bạn là chủ Site. Quyền quản trị của tài khoản này được bảo vệ.</p>}</div></Panel></div><PasswordForm/></>;
}

export default function ProfilePage({tab='info',initialPlan}){const {navigate,data,user}=useCourtly(),isAdmin=user.role==='ADMIN';const mine={...data,orders:isAdmin?data.orders.filter(o=>o.ownerUserId?o.ownerUserId===user.id:o.accountId===user.accountId):data.orders,registrations:isAdmin?data.registrations.filter(r=>r.ownerUserId?r.ownerUserId===user.id:r.accountId===user.accountId):data.registrations};const ids=new Set(mine.orders.map(o=>o.id)),regs=new Set(mine.registrations.map(r=>r.id));mine.payments=data.payments.filter(p=>ids.has(p.orderId)||regs.has(p.registrationId));const payments=new Set(mine.payments.map(p=>p.id));mine.refunds=data.refunds.filter(r=>payments.has(r.paymentId));mine.memberships=(data.memberships||[]).filter(m=>m.accountId===user.accountId);mine.membershipPayments=(data.membershipPayments||[]).filter(m=>m.accountId===user.accountId);const ctx=useCourtly();return <><Tabs value={tab} onChange={t=>navigate(t==='info'?'profile':'profile-'+t)} options={[["info","Thông tin cá nhân"],["membership","Membership của tôi"],["orders","Đơn của tôi"],["history","Lịch sử đặt sân"],["payments","Lịch sử thanh toán"]]}/><CourtlyContext.Provider value={{...ctx,data:mine,isAdmin:false}}>{tab==='membership'?<MyMembership initialPlan={initialPlan}/>:tab==='orders'?<MyOrders/>:tab==='history'?<MyHistory/>:tab==='payments'?<MyPayments/>:<PersonalDetails/>}</CourtlyContext.Provider></>;}
```

#### File: `frontend/src/pages/PublicPage.jsx`
```jsx
import React,{useState,useEffect} from 'react';
import {ArrowRight,CalendarDays,Trophy,Check,Menu,Package,ClipboardList,Wallet} from 'lucide-react';
import {api} from '../services/api';
import {today,money,labels} from '../utils/format';
import {Button,Chip,Modal} from '../components/UI';
import {PublicHeader,PublicFooter} from '../components/PublicLayout';
import BookingPicker from '../components/BookingPicker';
import CourtGallery from '../components/CourtGallery';
export default function PublicPage({onLogin,onAction,ownerSetupAvailable,sessionError,user}){
 const [date,setDate]=useState(today),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[detail,setDetail]=useState(null),[chosenCourt,setChosenCourt]=useState('');
 useEffect(()=>{let active=true;const refresh=async()=>{try{const value=await api(`/public/overview?date=${date}`);if(active){setData(value);setError('');}}catch(e){if(active)setError(e.message);}finally{if(active)setLoading(false);}};setLoading(true);refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer);};},[date]);
 const tournament=data?.tournaments.find(t=>t.id===detail);
 return <div className="public-page"><a className="skip-link" href="#booking">Bỏ qua đến chọn sân</a><PublicHeader onLogin={onLogin} user={user}/>
 <main><section id="overview" className="public-hero customer-overview-hero"><div><span className="eyebrow">COURTLY · HẸN NHAU TRÊN SÂN</span><h1>Giờ chơi của bạn.<br/>Sân sẵn sàng.</h1><p>Xem sân, chọn khung giờ phù hợp và lên lịch cho trận tennis tiếp theo.</p><a className="btn lime" href="#booking">Tìm giờ trống <ArrowRight size={18}/></a><span className="hero-note">Xem lịch và giá trước. Đăng nhập khi bạn muốn đặt sân.</span></div><div className="hero-court hero-photo"><img src="/images/court-hard.webp" alt="Ảnh minh họa sân tennis cứng" width="1200" height="800" fetchPriority="high"/><span>Ảnh minh họa</span></div></section>
 {sessionError&&<div className="error public-message" role="alert">{sessionError}</div>}{ownerSetupAvailable&&<div className="notice public-message">Tài khoản chủ Site của bạn đã được xác thực. <Button className="sm" onClick={()=>onLogin('owner-activate')}>Thiết lập mật khẩu Courtly</Button></div>}
 <section className="public-section customer-ways"><div className="section-heading"><div><span className="section-kicker">TRẢI NGHIỆM CÙNG COURTLY</span><h2>Bạn muốn bắt đầu từ đâu?</h2></div><p>Các tiện ích quen thuộc, theo hành trình ra sân của bạn.</p></div><div>{[['01','Tự do đặt sân','Chọn khoảng giờ liên tục, xem giá và tổng tiền trước khi giữ chỗ.','/#booking','Tìm giờ trống'],['02','Trận đấu có trọng tài','Chọn chính xác từng khung giờ cần trọng tài ngay khi đặt sân.','/#booking','Lên lịch chơi'],['03','Chơi đều. Nhận nhiều hơn.','Khám phá membership và theo dõi quyền lợi trong tài khoản.','/membership','Xem gói hội viên']].map(([n,title,body,href,action])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p><a href={href}>{action} <ArrowRight size={18}/></a></article>)}</div></section>
 <section className="public-section customer-membership-banner"><div><span className="section-kicker">COURTLY MEMBERSHIP</span><h2>Biến một buổi chơi thành một thói quen.</h2><p>Chọn quyền lợi phù hợp với nhịp ra sân.</p></div><a className="btn" href="/membership">Khám phá membership <ArrowRight size={18}/></a></section>
 <section id="booking" className="public-section"><div className="section-heading"><div><span className="section-kicker">CHỌN LỊCH CHƠI</span><h2>Sân & giờ trống</h2><p>Giá từng giờ hiển thị ngay trên lịch. Chỉ đăng nhập khi tiếp tục đặt sân.</p></div><CalendarDays size={28}/></div>{data?.sample&&<p className="demo-note">Courtly đang hiển thị dữ liệu mẫu để trải nghiệm. Vui lòng xác nhận với câu lạc bộ trước khi thanh toán.</p>}{error&&<div className="error" role="alert">{error}</div>}{loading?<div className="loading" role="status">Đang tải lịch sân…</div>:data&&<BookingPicker data={data} date={date} setDate={setDate} onBook={onAction} initialCourtId={chosenCourt}/>}</section>
 <section id="courts" className="public-section"><div className="section-heading"><div><span className="section-kicker">KHÁM PHÁ SÂN</span><h2>Chọn mặt sân. Lên lịch chơi.</h2><p>Thông tin sân, giá cơ bản và hình ảnh trước khi đặt.</p></div></div>{data&&<CourtGallery courts={data.courts} club={data.club} onChoose={id=>{setChosenCourt(id);document.getElementById('booking')?.scrollIntoView({behavior:'smooth'});}}/>}</section>
 <section id="tournaments" className="public-section"><div className="section-heading"><div><span className="section-kicker">CÙNG NHAU THI ĐẤU</span><h2>Giải đấu tại Courtly</h2><p>Xem thể thức, thời gian và phí tham gia trước khi đăng ký.</p></div><Trophy size={28}/></div><div className="public-tournaments">{data?.tournaments.map(t=><article className="public-tournament" key={t.id}><div className="tournament-symbol"><Trophy size={30}/><Chip status={t.status}/></div><h3>{t.name}</h3><p>{labels[t.format]} · {t.location}</p><dl><div><dt>Thời gian</dt><dd>{t.start} → {t.end}</dd></div><div><dt>Phí đăng ký</dt><dd>{money(t.fee)}</dd></div><div><dt>Hạn đăng ký</dt><dd>{t.deadline}</dd></div></dl><div className="step-row"><Button onClick={()=>setDetail(t.id)}>Xem chi tiết</Button>{t.status==='OPEN'&&t.deadline>=today()&&<Button className="primary" onClick={()=>onAction({type:'registration',id:t.id,date})}>Đăng ký tham gia</Button>}</div></article>)}</div>{data&&!data.tournaments.length&&<p className="empty">Chưa có giải đấu được công bố.</p>}</section>
 <section id="how-it-works" className="public-section how-section"><div className="section-heading"><div><span className="section-kicker">TỪ LỊCH TRỐNG ĐẾN TRẬN ĐẤU</span><h2>Đặt sân theo bốn bước</h2></div></div><ol><li><span>01</span><h3>Chọn sân & ngày</h3><p>Chọn ngày, xem giá và đánh dấu các khung giờ còn trống.</p></li><li><span>02</span><h3>Chọn khoảng giờ</h3><p>Chọn giờ đầu và cuối trong khoảng sân còn trống.</p></li><li><span>03</span><h3>Trọng tài tùy chọn</h3><p>Chọn trọng tài riêng cho từng giờ bạn cần.</p></li><li><span>04</span><h3>Kiểm tra & xác nhận</h3><p>Đăng nhập, kiểm tra từng slot và thanh toán cọc tại quầy.</p></li></ol></section></main>
 <PublicFooter/>
 {tournament&&<Modal title={tournament.name} onClose={()=>setDetail(null)} footer={<><Button onClick={()=>setDetail(null)}>Đóng</Button>{tournament.status==='OPEN'&&tournament.deadline>=today()&&<Button className="primary" onClick={()=>{setDetail(null);onAction({type:'registration',id:tournament.id,date});}}>Đăng ký tham gia</Button>}</>}><p>{labels[tournament.format]} · {tournament.location}</p><div className="detail-grid"><div><span>Thời gian</span>{tournament.start} → {tournament.end}</div><div><span>Phí tham gia</span>{money(tournament.fee)}</div><div><span>Hạn đăng ký</span>{tournament.deadline}</div><div><span>Số đăng ký</span>{tournament.registeredCount}/{tournament.max}</div></div></Modal>}
 </div>;
}
```

#### File: `frontend/src/pages/ReportsPage.jsx`
```jsx
import React, { useState, useMemo } from 'react';
import { Wallet, Trophy, Check, Clock, Calendar, TrendingUp, Download } from 'lucide-react';
import { useCourtly } from '../context';
import { Title, Stat, Panel, Button, Table, Chip } from '../components/UI';
import { money, labels, today, localDate, slotHours } from '../utils/format';

export default function ReportsPage() {
  const { data } = useCourtly();
  const currentToday = today(); // YYYY-MM-DD
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  // Period modes: 'day' | 'month' | 'quarter' | 'year' | 'all'
  const [periodType, setPeriodType] = useState('month');
  const [selectedDay, setSelectedDay] = useState(currentToday);
  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${currentQuarter}`);
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(currentYear);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Compute startDate and endDate based on periodType
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (periodType === 'day') {
      const parts = selectedDay.split('-');
      return {
        startDate: selectedDay,
        endDate: selectedDay,
        periodLabel: `Ngày ${parts[2]}/${parts[1]}/${parts[0]}`
      };
    }
    if (periodType === 'month') {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      return {
        startDate: `${y}-${m}-01`,
        endDate: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
        periodLabel: `Tháng ${m}/${y}`
      };
    }
    if (periodType === 'quarter') {
      const q = Number(selectedQuarter.replace('Q', ''));
      const startM = String((q - 1) * 3 + 1).padStart(2, '0');
      const endM = String(q * 3).padStart(2, '0');
      const lastDay = new Date(selectedQuarterYear, q * 3, 0).getDate();
      return {
        startDate: `${selectedQuarterYear}-${startM}-01`,
        endDate: `${selectedQuarterYear}-${endM}-${String(lastDay).padStart(2, '0')}`,
        periodLabel: `Quý ${q}/${selectedQuarterYear} (${startM}/${selectedQuarterYear} – ${endM}/${selectedQuarterYear})`
      };
    }
    if (periodType === 'year') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        periodLabel: `Năm ${selectedYear}`
      };
    }
    return {
      startDate: '1970-01-01',
      endDate: '2099-12-31',
      periodLabel: 'Toàn bộ thời gian'
    };
  }, [periodType, selectedDay, selectedMonth, selectedQuarter, selectedQuarterYear, selectedYear]);

  // Filter orders in period
  const ordersInPeriod = useMemo(() => {
    return data.orders.filter(o => o.date >= startDate && o.date <= endDate);
  }, [data.orders, startDate, endDate]);

  const validOrders = useMemo(() => {
    return ordersInPeriod.filter(o => !['CANCELLED', 'EXPIRED'].includes(o.status));
  }, [ordersInPeriod]);

  // Filter payments & refunds in period
  const paymentsInPeriod = useMemo(() => {
    return data.payments.filter(p => {
      const d = localDate(p.createdAt || p.paidAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.payments, startDate, endDate]);

  const refundsInPeriod = useMemo(() => {
    return data.refunds.filter(r => {
      const d = localDate(r.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.refunds, startDate, endDate]);

  // Cashflow
  const netOrderCash = useMemo(() => {
    const collected = paymentsInPeriod.filter(p => p.orderId).reduce((a, p) => a + p.amount, 0);
    const refunded = refundsInPeriod.filter(r => {
      const p = data.payments.find(x => x.id === r.paymentId);
      return p && p.orderId;
    }).reduce((a, r) => a + r.amount, 0);
    return collected - refunded;
  }, [paymentsInPeriod, refundsInPeriod, data.payments]);

  const netTournamentCash = useMemo(() => {
    const collected = paymentsInPeriod.filter(p => p.registrationId).reduce((a, p) => a + p.amount, 0);
    const refunded = refundsInPeriod.filter(r => {
      const p = data.payments.find(x => x.id === r.paymentId);
      return p && p.registrationId;
    }).reduce((a, r) => a + r.amount, 0);
    return collected - refunded;
  }, [paymentsInPeriod, refundsInPeriod, data.payments]);

  const membershipPaymentsInPeriod = useMemo(() => {
    return (data.membershipPayments || []).filter(p => {
      const d = localDate(p.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data.membershipPayments, startDate, endDate]);

  const netMembershipCash = useMemo(() => {
    return membershipPaymentsInPeriod.reduce((a, p) => a + p.amount, 0);
  }, [membershipPaymentsInPeriod]);

  const totalNetCash = useMemo(() => {
    const totalOrderAndTournPaid = paymentsInPeriod.reduce((a, p) => a + p.amount, 0);
    const totalRefund = refundsInPeriod.reduce((a, r) => a + r.amount, 0);
    return totalOrderAndTournPaid + netMembershipCash - totalRefund;
  }, [paymentsInPeriod, netMembershipCash, refundsInPeriod]);

  // Value by categories on valid orders
  const courtValue = validOrders.flatMap(o => o.slots).reduce((a, s) => a + (s.price || 0), 0);
  const legacyValue = validOrders.flatMap(o => o.products).reduce((a,p) => a + (p.lineTotal || 0), 0);
  const staffValue = validOrders.flatMap(o => o.staff).reduce((a, s) => a + (s.hours || 1) * (s.rate || 0), 0);
  const totalValue = courtValue + legacyValue + staffValue;

  const categories = [
    ['Tiền thuê sân', courtValue],
    ['Trọng tài', staffValue],
    ...(legacyValue ? [['Khoản dịch vụ cũ (lịch sử)', legacyValue]] : [])
  ];
  const maxCategory = Math.max(1, ...categories.map(x => x[1]));

  // Number of calendar days in period for occupancy calculation
  const periodDays = useMemo(() => {
    const s = new Date(startDate), e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(366, diff));
  }, [startDate, endDate]);

  // Occupancy per court (calculated by actual hours using slotHours)
  const courtOccupancy = useMemo(() => {
    const totalPossibleHours = 17 * periodDays;
    return data.courts.map(c => {
      const orderHours = validOrders
        .flatMap(o => o.slots)
        .filter(s => s.court === c.id)
        .reduce((sum, s) => sum + slotHours(s), 0);
      const matchHours = data.matches
        .filter(m => m.date >= startDate && m.date <= endDate && m.status !== 'CANCELLED')
        .flatMap(m => m.slots)
        .filter(s => s.court === c.id)
        .reduce((sum, s) => sum + slotHours(s), 0);
      const totalUsedHours = orderHours + matchHours;
      const percent = totalPossibleHours > 0 ? Math.round((totalUsedHours / totalPossibleHours) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        used: totalUsedHours,
        totalPossible: totalPossibleHours,
        percent
      };
    });
  }, [data.courts, validOrders, data.matches, startDate, endDate, periodDays]);

  const avgOccupancy = courtOccupancy.length
    ? Math.round(courtOccupancy.reduce((a, c) => a + c.percent, 0) / courtOccupancy.length)
    : 0;

  // Monthly sub-breakdown for Year or Quarter mode
  const monthlyBreakdown = useMemo(() => {
    if (periodType !== 'year' && periodType !== 'quarter') return [];
    const months = [];
    const startM = periodType === 'quarter' ? (Number(selectedQuarter.replace('Q', '')) - 1) * 3 + 1 : 1;
    const endM = periodType === 'quarter' ? Number(selectedQuarter.replace('Q', '')) * 3 : 12;
    const yr = periodType === 'quarter' ? selectedQuarterYear : selectedYear;

    for (let m = startM; m <= endM; m++) {
      const mStr = `${yr}-${String(m).padStart(2, '0')}`;
      const mOrders = data.orders.filter(o => o.date.startsWith(mStr));
      const mValid = mOrders.filter(o => !['CANCELLED', 'EXPIRED'].includes(o.status));
      const mRevenue = data.payments.filter(p => localDate(p.createdAt || p.paidAt).startsWith(mStr)).reduce((a, p) => a + p.amount, 0)
        - data.refunds.filter(r => localDate(r.createdAt).startsWith(mStr)).reduce((a, r) => a + r.amount, 0);
      months.push({
        label: `Tháng ${m}/${yr}`,
        ordersCount: mOrders.length,
        completedCount: mOrders.filter(o => o.status === 'COMPLETED').length,
        revenue: mRevenue,
        orderValue: mValid.reduce((a, o) => a + o.total, 0)
      });
    }
    return months;
  }, [periodType, selectedQuarter, selectedQuarterYear, selectedYear, data.orders, data.payments, data.refunds]);

  // Export CSV
  const exportCsv = () => {
    const escape = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    const rows = [
      ['BÁO CÁO DOANH THU & VẬN HÀNH COURTLY TENNIS CLUB'],
      ['Kỳ báo cáo', periodLabel],
      ['Từ ngày', startDate, 'Đến ngày', endDate],
      [''],
      ['I. TỔNG QUAN TÀI CHÍNH'],
      ['Chỉ số', 'Số tiền (VNĐ)'],
      ['Tổng thực thu ròng', totalNetCash],
      ['Thu ròng từ đơn sân', netOrderCash],
      ['Thu ròng phí giải đấu', netTournamentCash],
      ['Thu phí hội viên Membership', netMembershipCash],
      ['Giá trị dịch vụ trên đơn', totalValue],
      [''],
      ['II. THỐNG KÊ ĐƠN HÀNG'],
      ['Tổng đơn trong kỳ', ordersInPeriod.length],
      ['Đơn hoàn tất', ordersInPeriod.filter(o => o.status === 'COMPLETED').length],
      ['Đơn đã hủy', ordersInPeriod.filter(o => o.status === 'CANCELLED').length],
      ['Đơn hết hạn giữ chỗ', ordersInPeriod.filter(o => o.status === 'EXPIRED').length],
      [''],
      ['III. CƠ CẤU DOANH THU DỊCH VỤ'],
      ['Hạng mục', 'Giá trị (VNĐ)'],
      ...categories.map(([name, val]) => [name, val]),
      [''],
      ['IV. CÔNG SUẤT SÂN'],
      ['Tên sân', 'Khung giờ sử dụng', 'Tổng khung giờ khả dụng', 'Tỷ lệ lấp đầy (%)'],
      ...courtOccupancy.map(c => [c.name, c.used, c.totalPossible, c.percent + '%']),
      [''],
      ['V. CHI TIẾT ĐƠN HÀNG TRONG KỲ'],
      ['Mã đơn', 'Khách hàng', 'Số điện thoại', 'Ngày', 'Trạng thái', 'Tổng tiền', 'Đã thanh toán'],
      ...ordersInPeriod.map(o => [
        o.id,
        o.name,
        o.phone || '',
        o.date,
        labels[o.status] || o.status,
        o.total,
        o.paid
      ])
    ];

    const csvContent = '\ufeff' + rows.map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-courtly-${periodType}-${startDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Title
        subtitle={`Phân tích tài chính, cơ cấu dịch vụ và công suất sân (${periodLabel}).`}
        action={
          <Button className="primary" onClick={exportCsv}>
            <Download size={16} /> Xuất báo cáo CSV
          </Button>
        }
      >
        Báo cáo & Thống kê
      </Title>

      {/* Period Filter Bar */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: 'var(--green)' }} />
            <b>Kỳ báo cáo:</b>
          </div>

          <div className="time-filters" style={{ margin: 0 }}>
            {[
              ['day', 'Theo Ngày'],
              ['month', 'Theo Tháng'],
              ['quarter', 'Theo Quý'],
              ['year', 'Theo Năm'],
              ['all', 'Tất cả']
            ].map(([mode, label]) => (
              <button
                key={mode}
                className={periodType === mode ? 'on' : ''}
                onClick={() => setPeriodType(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sub-pickers */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {periodType === 'day' && (
              <>
                <input
                  type="date"
                  aria-label="Chọn ngày"
                  value={selectedDay}
                  onChange={e => e.target.value && setSelectedDay(e.target.value)}
                  style={{ width: 170 }}
                />
                <Button className="sm" onClick={() => setSelectedDay(currentToday)}>Hôm nay</Button>
              </>
            )}

            {periodType === 'month' && (
              <input
                type="month"
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                style={{ width: 170 }}
              />
            )}

            {periodType === 'quarter' && (
              <>
                <select
                  aria-label="Chọn quý"
                  value={selectedQuarter}
                  onChange={e => setSelectedQuarter(e.target.value)}
                  style={{ width: 130 }}
                >
                  <option value="Q1">Quý 1 (T1-T3)</option>
                  <option value="Q2">Quý 2 (T4-T6)</option>
                  <option value="Q3">Quý 3 (T7-T9)</option>
                  <option value="Q4">Quý 4 (T10-T12)</option>
                </select>
                <select
                  aria-label="Chọn năm"
                  value={selectedQuarterYear}
                  onChange={e => setSelectedQuarterYear(Number(e.target.value))}
                  style={{ width: 110 }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </>
            )}

            {periodType === 'year' && (
              <select
                aria-label="Chọn năm"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{ width: 130 }}
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            )}

            <span className="chip green" style={{ fontWeight: 600 }}>
              {periodLabel}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats">
        <Stat
          title="Tổng thực thu ròng"
          value={money(totalNetCash)}
          note={`Thu trừ hoàn (${paymentsInPeriod.length} giao dịch)`}
          icon={Wallet}
        />
        <Stat
          title="Thu ròng đơn sân"
          value={money(netOrderCash)}
          note="Tiền sân & dịch vụ trên đơn"
          icon={TrendingUp}
        />
        <Stat
          title="Thu giải & Hội viên"
          value={money(netTournamentCash + netMembershipCash)}
          note={`Giải: ${money(netTournamentCash)} · HV: ${money(netMembershipCash)}`}
          icon={Trophy}
        />
        <Stat
          title="Đơn hoàn tất trong kỳ"
          value={`${ordersInPeriod.filter(o => o.status === 'COMPLETED').length} / ${ordersInPeriod.length}`}
          note={`Tỷ lệ hoàn tất: ${ordersInPeriod.length ? Math.round(ordersInPeriod.filter(o => o.status === 'COMPLETED').length / ordersInPeriod.length * 100) : 0}%`}
          icon={Check}
        />
      </div>

      {/* Split Panels: Category breakdown & Court Occupancy */}
      <div className="split">
        <Panel title={`Cơ cấu doanh thu dịch vụ (${periodLabel})`}>
          <div className="panel-body">
            {categories.map(([name, value]) => (
              <div className="bar-row" key={name}>
                <span style={{ width: 170 }}>{name}</span>
                <div className="bar">
                  <b style={{ width: `${(value / maxCategory) * 100}%` }} />
                </div>
                <b>{money(value)}</b>
              </div>
            ))}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Tổng giá trị dịch vụ:</span>
              <b style={{ color: 'var(--green)', fontSize: 16 }}>{money(totalValue)}</b>
            </div>
            <small style={{ marginTop: 8, display: 'block' }}>
              Giá trị dịch vụ tính trên các đơn đặt sân hợp lệ (loại trừ đơn hủy/hết hạn).
            </small>
          </div>
        </Panel>

        <Panel title={`Công suất sân (${periodLabel}) · Trung bình ${avgOccupancy}%`}>
          <div className="panel-body">
            {courtOccupancy.map(c => (
              <div className="bar-row" key={c.id}>
                <span style={{ width: 140 }}>
                  {c.name} <small style={{ display: 'inline', color: 'var(--muted)' }}>({labels[c.type] || c.type})</small>
                </span>
                <div className="bar">
                  <b
                    style={{
                      width: `${c.percent}%`,
                      backgroundColor: c.percent > 70 ? '#2e7d32' : c.percent > 40 ? '#589569' : '#81c784'
                    }}
                  />
                </div>
                <b>{c.percent}%</b>
              </div>
            ))}
            <small style={{ marginTop: 14, display: 'block' }}>
              Tính trên {periodDays} ngày vận hành ({periodDays * 17} giờ mở cửa mỗi sân, khung 06:00–23:00).
            </small>
          </div>
        </Panel>
      </div>

      {/* If Year or Quarter, display monthly breakdown */}
      {monthlyBreakdown.length > 0 && (
        <Panel title={`Chi tiết doanh thu theo tháng (${periodLabel})`} style={{ marginTop: 24 }}>
          <Table headings={['Tháng', 'Tổng số đơn', 'Đơn hoàn tất', 'Giá trị dịch vụ', 'Doanh thu thực thu']}>
            {monthlyBreakdown.map(m => (
              <tr key={m.label}>
                <td className="name">{m.label}</td>
                <td>{m.ordersCount} đơn</td>
                <td><Chip status={m.completedCount > 0 ? 'COMPLETED' : 'PENDING'} /> {m.completedCount} đơn</td>
                <td>{money(m.orderValue)}</td>
                <td className="name" style={{ color: 'var(--green)' }}>{money(m.revenue)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {/* Orders summary table in period */}
      <Panel title={`Danh sách đơn hàng trong kỳ (${ordersInPeriod.length} đơn)`} style={{ marginTop: 24 }}>
        <Table headings={['Mã đơn', 'Khách hàng', 'Ngày đặt', 'Trạng thái', 'Tổng tiền', 'Đã thu']} empty={!ordersInPeriod.length}>
          {ordersInPeriod.slice(0, 15).map(o => (
            <tr key={o.id}>
              <td>
                <b>{o.id.slice(0, 8).toUpperCase()}</b>
                <small>{o.phone}</small>
              </td>
              <td className="name">{o.name}</td>
              <td>{o.date}</td>
              <td><Chip status={o.status} /></td>
              <td>{money(o.total)}</td>
              <td className="name">{money(o.paid)}</td>
            </tr>
          ))}
        </Table>
        {ordersInPeriod.length > 15 && (
          <div className="panel-body" style={{ textAlign: 'center', background: '#fcfdfc' }}>
            <small>Đang hiển thị 15 đơn tiêu biểu. Bấm <b>"Xuất báo cáo CSV"</b> ở góc trên để tải toàn bộ {ordersInPeriod.length} đơn hàng chi tiết trong kỳ.</small>
          </div>
        )}
      </Panel>
    </>
  );
}
```

#### File: `frontend/src/pages/StaffPage.jsx`
```jsx
import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Table,Chip,Button,Tabs} from '../components/UI';
import {money,labels,hourLabel} from '../utils/format';
export default function StaffPage(){
 const {data,show}=useCourtly();const [tab,setTab]=useState('staff');
 return <><Title subtitle="Nhân sự, slot làm việc và tổng hợp công." action={<Button className="primary" onClick={()=>show({type:'entity',collection:'staff'})}>Thêm nhân sự</Button>}>Nhân sự</Title><Tabs options={[["staff","Nhân sự"],["schedules","Lịch làm việc"],["payroll","Tổng hợp công"]]} value={tab} onChange={setTab}/>
 {tab==='staff'&&<div className="grid-cards">{data.staff.map(p=><article className="item-card" key={p.id}><div className="card-body"><div className="card-top"><span className="avatar">{p.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><Chip status={p.status}/></div><h2>{p.name}</h2><p className="subtitle">{labels[p.type]}</p><div className="metric"><span className="muted">Điện thoại</span><span>{p.phone}</span></div><div className="metric"><span className="muted">Đơn giá / giờ</span><b>{money(p.rate)}</b></div><div className="card-buttons"><Button className="sm" onClick={()=>show({type:'entity',collection:'staff',row:p})}>Chỉnh sửa</Button><Button className="sm" onClick={()=>show({type:'entity',collection:'staff-schedules',row:{staff:p.id}})}>Tạo lịch</Button></div></div></article>)}</div>}
 {tab==='schedules'&&<Panel title="Lịch làm việc" action={<Button className="primary sm" onClick={()=>show({type:'entity',collection:'staff-schedules'})}>Thêm lịch</Button>}><Table headings={['Nhân sự','Ngày','Thời gian','Trạng thái','']} empty={!data.staffSchedules.length}>{data.staffSchedules.map(s=><tr key={s.id}><td>{data.staff.find(p=>p.id===s.staff)?.name}</td><td>{s.date}</td><td>{hourLabel(s.start)}–{hourLabel(s.end)}</td><td><Chip status={s.status}/></td><td><Button className="sm" disabled={s.status!=='AVAILABLE'} onClick={()=>show({type:'entity',collection:'staff-schedules',row:s})}>Sửa</Button></td></tr>)}</Table></Panel>}
 {tab==='payroll'&&<Panel title="Công trên đơn hoàn tất"><Table headings={['Nhân sự','Giờ làm','Tiền công']}>{data.staff.map(p=>{const lines=data.orders.filter(o=>o.status==='COMPLETED').flatMap(o=>o.staff).filter(s=>s.staffId===p.id);return <tr key={p.id}><td>{p.name}</td><td>{lines.reduce((a,s)=>a+s.hours,0)} giờ</td><td>{money(lines.reduce((a,s)=>a+s.hours*s.rate,0))}</td></tr>;})}</Table><div className="panel-body"><small>Phân công trận đấu không tính phí theo ERD. Báo cáo công này chưa thay thế bảng lương.</small></div></Panel>}
 </>;
}
```

#### File: `frontend/src/pages/SystemPage.jsx`
```jsx
import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Table,Button,Tabs} from '../components/UI';
import {PolicyNotice} from '../components/OrderSummary';
import modules from '../modules.json';
const pending=[34],partial=[1,3,6,7,13,15,18,20,23,24,31,35,36,39,40,42,44,47,48,49,50];
export default function SystemPage(){
 const {data,show}=useCourtly();const [tab,setTab]=useState('modules');
 return <><Title subtitle="Đối chiếu phạm vi với tài liệu 50 module.">Hệ thống & module</Title><Tabs options={[["modules","50 module"],["audit","Nhật ký"],["settings","Chính sách"]]} value={tab} onChange={setTab}/>
 {tab==='modules'&&<><div className="notice" style={{marginBottom:20}}>Hệ thống đã hỗ trợ đăng ký/đăng nhập email + mật khẩu, quên mật khẩu gửi mã 6 số về email và hiện/ẩn mật khẩu an toàn. Thanh toán VietQR Napas 24/7 và webhook đối soát tự động đang hoạt động. Các nhãn bên dưới thể hiện phạm vi đã triển khai.</div><Panel title="50 module từ tài liệu"><Table headings={['#','Module','Phạm vi','Ưu tiên']}>{modules.map(m=><tr key={m.id}><td>{m.id}</td><td><span className="name">{m.name}</span><small>{m.group}</small><small style={{maxWidth:570}}>{m.description}</small></td><td><span className={`chip ${pending.includes(m.id)?'orange':partial.includes(m.id)?'blue':'green'}`}>{pending.includes(m.id)?'Chưa kết nối':partial.includes(m.id)?'Bản cơ bản':'Đã có thao tác'}</span></td><td>{m.priority}</td></tr>)}</Table></Panel></>}
 {tab==='audit'&&<Panel title="100 thao tác gần nhất"><Table headings={['Thời điểm','Người thao tác','Hành động','Chi tiết']} empty={!data.audit.length}>{data.audit.map(a=><tr key={a.id}><td>{new Date(a.at).toLocaleString('vi-VN')}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.detail}{a.reason&&<small>Lý do: {a.reason}</small>}<details><summary>Trước / sau</summary><pre style={{whiteSpace:'pre-wrap',maxWidth:500,maxHeight:300,overflow:'auto'}}>{JSON.stringify({before:a.before,after:a.after},null,2)}</pre></details></td></tr>)}</Table></Panel>}
 {tab==='settings'&&<Panel title="Chính sách giữ chỗ"><div className="panel-body"><div className="summary-line"><span>Thời gian giữ chỗ</span><b>{data.settings.holdMinutes} phút</b></div><div className="summary-line"><span>Tiền cọc</span><b>{data.settings.depositPercent}%</b></div><div className="summary-line"><span>Tỷ lệ tiền chờ hoàn</span><b>{data.settings.cancelRefundPercent}%</b></div><p className="subtitle" style={{margin:'14px 0'}}>Khách hủy hợp lệ được tính khoản chờ hoàn theo tỷ lệ này. Nhân viên có thẩm quyền vẫn phải thực hiện và ghi nhận tiền hoàn.</p><PolicyNotice/><Button className="primary" onClick={()=>show({type:'settings'})}>Sửa chính sách</Button></div></Panel>}
 </>;
}
```

#### File: `frontend/src/pages/TournamentsPage.jsx`
```jsx
import React from 'react';
import {Trophy} from 'lucide-react';
import {useCourtly} from '../context';
import {Title,Chip,Button} from '../components/UI';
import {money,labels} from '../utils/format';
export default function TournamentsPage(){
 const {data,show}=useCourtly();
 return <><Title subtitle="Đăng ký, thu phí, nhánh đấu và lịch thi đấu." action={<Button className="primary" onClick={()=>show({type:'entity',collection:'tournaments'})}>Tạo giải</Button>}>Giải đấu</Title><div className="grid-cards">{data.tournaments.map(t=>{const regs=data.registrations.filter(r=>r.tournamentId===t.id);return <article className="item-card" key={t.id}><div className="card-body"><div className="card-top"><span className="stat-icon"><Trophy size={20}/></span><Chip status={t.status}/></div><h2>{t.name}</h2><p className="subtitle">{labels[t.format]} · {t.location}</p><div className="metric"><span className="muted">Ngày thi đấu</span><span>{t.start}</span></div><div className="metric"><span className="muted">Hạn đăng ký</span><span>{t.deadline}</span></div><div className="metric"><span className="muted">Phí đăng ký</span><b>{money(t.fee)}</b></div><div className="progress"><b style={{width:`${Math.min(100,regs.length/t.max*100)}%`}}/></div><small>{regs.length}/{t.max} đăng ký · {regs.filter(r=>r.status==='CONFIRMED').length} xác nhận</small><div className="card-buttons"><Button className="primary sm" onClick={()=>show({type:'tournament',id:t.id})}>Quản lý giải</Button><Button className="sm" onClick={()=>show({type:'entity',collection:'tournaments',row:t})}>Sửa</Button></div></div></article>;})}</div></>;
}
```

## 8. BỘ TEST TỰ ĐỘNG & KIỂM THỬ TÍCH HỢP

### 8.1 Backend JUnit Tests

#### File: `backend/src/test/java/com/courtly/config/DemoDataInitializerTest.java`
```java
package com.courtly.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import com.courtly.service.SettingsService;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class DemoDataInitializerTest {
  private CourtRepository courts;
  private AccountRepository accounts;
  private StaffRepository staff;
  private TournamentRepository tournaments;
  private SettingsService settings;
  private PasswordEncoder encoder;
  private org.springframework.core.env.Environment environment;
  private DemoDataInitializer initializer;

  @BeforeEach
  void setUp() {
    courts = mock(CourtRepository.class);
    accounts = mock(AccountRepository.class);
    staff = mock(StaffRepository.class);
    tournaments = mock(TournamentRepository.class);
    settings = mock(SettingsService.class);
    encoder = new BCryptPasswordEncoder();
    environment = mock(org.springframework.core.env.Environment.class);
    when(environment.acceptsProfiles(any(org.springframework.core.env.Profiles.class))).thenReturn(false);

    initializer = new DemoDataInitializer(courts, accounts, staff, tournaments, settings, encoder, environment);
    ReflectionTestUtils.setField(initializer, "adminEmail", "admin@gmail.com");
    ReflectionTestUtils.setField(initializer, "adminPassword", "");
    ReflectionTestUtils.setField(initializer, "enabled", false);
  }

  @Test
  void productionModeDoesNotCreateAdminWithoutPassword() {
    ReflectionTestUtils.setField(initializer, "enabled", false);
    ReflectionTestUtils.setField(initializer, "adminPassword", "");
    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of());

    initializer.run(new DefaultApplicationArguments());

    // Never save admin with a guessed password when ADMIN_PASSWORD is blank in production
    verify(accounts, never()).save(argThat(a -> "ADMIN".equals(a.getRole())));
  }

  @Test
  void productionModeDoesNotCreateStaffSampleAccount() {
    ReflectionTestUtils.setField(initializer, "enabled", false);
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of());

    initializer.run(new DefaultApplicationArguments());

    // In production (enabled == false), staff@gmail.com must never be created
    verify(accounts, never()).save(argThat(a -> "staff@gmail.com".equals(a.getEmail())));
  }

  @Test
  void adminPasswordRequiresMinimum10Characters() {
    ReflectionTestUtils.setField(initializer, "adminPassword", "Short1!"); // < 10 chars
    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());

    assertThrows(BusinessException.class, () -> initializer.run(new DefaultApplicationArguments()));
  }

  @Test
  void adminCreatedWithSecurePasswordWhenConfigured() {
    ReflectionTestUtils.setField(initializer, "adminPassword", "SecureClubAdmin2026!");
    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of());

    initializer.run(new DefaultApplicationArguments());

    verify(accounts).save(argThat(a ->
        "ADMIN".equals(a.getRole()) && encoder.matches("SecureClubAdmin2026!", a.getPasswordHash())));
  }

  @Test
  void doesNotOverwriteExistingPasswordOnRestart() {
    Account existingAdmin = new Account();
    existingAdmin.setEmail("admin@gmail.com");
    existingAdmin.setRole("ADMIN");
    String changedPasswordHash = encoder.encode("CustomSecretPass2026!");
    existingAdmin.setPasswordHash(changedPasswordHash);

    Account existingStaff = new Account();
    existingStaff.setEmail("staff@gmail.com");
    existingStaff.setRole("STAFF");
    String staffChangedPasswordHash = encoder.encode("StaffChangedPass2026!");
    existingStaff.setPasswordHash(staffChangedPasswordHash);

    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.of(existingAdmin));
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.of(existingStaff));
    when(accounts.findAll()).thenReturn(List.of(existingAdmin, existingStaff));

    initializer.run(new DefaultApplicationArguments());

    // Password hashes must NOT be modified or reset to 12345
    assertEquals(changedPasswordHash, existingAdmin.getPasswordHash());
    assertTrue(encoder.matches("CustomSecretPass2026!", existingAdmin.getPasswordHash()));
    assertFalse(encoder.matches("12345", existingAdmin.getPasswordHash()));

    assertEquals(staffChangedPasswordHash, existingStaff.getPasswordHash());
    assertTrue(encoder.matches("StaffChangedPass2026!", existingStaff.getPasswordHash()));
    assertFalse(encoder.matches("12345", existingStaff.getPasswordHash()));
  }

  @Test
  void devModeInitializesPasswordWhenEnabled() {
    ReflectionTestUtils.setField(initializer, "enabled", true);
    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of());

    initializer.run(new DefaultApplicationArguments());

    verify(accounts).save(argThat(a ->
        "ADMIN".equals(a.getRole()) && encoder.matches("12345", a.getPasswordHash())));
    verify(accounts).save(argThat(a ->
        "STAFF".equals(a.getRole()) && encoder.matches("12345", a.getPasswordHash())));
  }

  @Test
  void doesNotDemoteExistingAdminIfAdminEmailNotCreated() {
    ReflectionTestUtils.setField(initializer, "enabled", false);
    ReflectionTestUtils.setField(initializer, "adminEmail", "newowner@courtly.vn");
    ReflectionTestUtils.setField(initializer, "adminPassword", ""); // blank, so newowner not created

    Account oldAdmin = new Account();
    oldAdmin.setEmail("oldadmin@courtly.vn");
    oldAdmin.setRole("ADMIN");

    when(accounts.findByEmailIgnoreCase("newowner@courtly.vn")).thenReturn(Optional.empty());
    when(accounts.findAll()).thenReturn(List.of(oldAdmin));

    initializer.run(new DefaultApplicationArguments());

    // oldAdmin must NOT be demoted to STAFF because newowner does not exist
    assertEquals("ADMIN", oldAdmin.getRole());
  }

  @Test
  void doesNotElevateExistingAccountIfAlreadyCustomer() {
    ReflectionTestUtils.setField(initializer, "enabled", true);
    Account customerAccount = new Account();
    customerAccount.setEmail("staff@gmail.com");
    customerAccount.setRole("CUSTOMER");

    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.empty());
    when(accounts.findByEmailIgnoreCase("staff@gmail.com")).thenReturn(Optional.of(customerAccount));
    when(accounts.findAll()).thenReturn(List.of());

    initializer.run(new DefaultApplicationArguments());

    // Must NOT elevate existing customer to STAFF
    assertEquals("CUSTOMER", customerAccount.getRole());
    verify(accounts, never()).save(customerAccount);
  }

  @Test
  void doesNotElevateExistingCustomerToAdminWhenConfiguringAdminPassword() {
    ReflectionTestUtils.setField(initializer, "adminPassword", "SecureClubAdmin2026!");
    Account customerAccount = new Account();
    customerAccount.setEmail("admin@gmail.com");
    customerAccount.setRole("CUSTOMER");
    customerAccount.setPasswordHash(null);

    when(accounts.findByEmailIgnoreCase("admin@gmail.com")).thenReturn(Optional.of(customerAccount));
    when(accounts.findAll()).thenReturn(List.of(customerAccount));

    initializer.run(new DefaultApplicationArguments());

    // Must NOT elevate existing non-admin account to ADMIN
    assertEquals("CUSTOMER", customerAccount.getRole());
    assertNull(customerAccount.getPasswordHash());
    verify(accounts, never()).save(customerAccount);
  }
}
```

#### File: `backend/src/test/java/com/courtly/config/ProductionSecurityValidatorTest.java`
```java
package com.courtly.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

class ProductionSecurityValidatorTest {
  private Environment environment;
  private ProductionSecurityValidator validator;

  @BeforeEach
  void setUp() {
    environment = mock(Environment.class);
    validator = new ProductionSecurityValidator(environment);
  }

  private void mockSecureDefaults() {
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("false");
    when(environment.getProperty("courtly.seed-demo", "false")).thenReturn("false");
    when(environment.getProperty("courtly.security.otp-secret", "")).thenReturn("SuperSecretCryptoRandomKey987654321");
    when(environment.getProperty("courtly.admin-password", "")).thenReturn("AdminStrongPassword2026!");
    when(environment.getProperty("courtly.payment.mode", "")).thenReturn("SEPAY");
    when(environment.getProperty("courtly.payment.webhook-key", "")).thenReturn("LiveSepayWebhookSecret12345");
    when(environment.getProperty("courtly.allowed-origin", "")).thenReturn("https://tennis.courtly.vn");
    when(environment.getProperty("courtly.payment.account-number", "")).thenReturn("987654321098");
  }

  @Test
  void nonProdProfileDoesNotEnforceProductionInvariants() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(false);

    // Should not throw even with default/insecure environment values
    assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
  }

  @Test
  void prodProfileRejectsDefaultDatabasePassword() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("courtly_local");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("Insecure default database password"));
  }

  @Test
  void prodProfileRejectsInsecureCookieSetting() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("false");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("cookie.secure must be true"));
  }

  @Test
  void prodProfileRejectsDemoMode() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("true");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("courtly.demo-mode must be false"));
  }

  @Test
  void prodProfileRejectsDefaultOtpSecret() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("false");
    when(environment.getProperty("courtly.seed-demo", "false")).thenReturn("false");
    when(environment.getProperty("courtly.security.otp-secret", "")).thenReturn("CourtlySecureHmacSecretKey2026!");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("courtly.security.otp-secret"));
  }

  @Test
  void prodProfileRejectsPaymentModeDemo() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.mode", "")).thenReturn("DEMO");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("PAYMENT_MODE must not be 'DEMO'"));
  }

  @Test
  void prodProfileRejectsBlankSepayWebhookKey() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.webhook-key", "")).thenReturn("");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("SEPAY_WEBHOOK_KEY is required"));
  }

  @Test
  void prodProfileRejectsLocalhostFrontendOrigin() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.allowed-origin", "")).thenReturn("http://localhost:3000");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("FRONTEND_ORIGIN cannot be empty or point to localhost"));
  }

  @Test
  void prodProfileRejectsSampleBankAccountNumber() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.account-number", "")).thenReturn("0345678999");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("Default sample bank account number"));
  }

  @Test
  void prodProfileAcceptsFullySecuredConfiguration() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();

    assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
  }
}
```

#### File: `backend/src/test/java/com/courtly/service/OrderTotalsServiceTest.java`
```java
package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.entity.OrderProduct;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrderTotalsServiceTest {
  private final OrderTotalsService service = new OrderTotalsService(null, null, null, null);

  @Test
  void rentalUsesPriceSnapshotQuantityAndDuration() {
    OrderProduct p = new OrderProduct();
    p.setItemType("RENTAL");
    p.setQuantity(2);
    p.setUnitPrice(new BigDecimal("50000"));
    p.setRentStartAt(Instant.parse("2026-10-08T01:00:00Z"));
    p.setRentEndAt(Instant.parse("2026-10-08T03:00:00Z"));
    assertEquals(new BigDecimal("200000.00"), service.productTotal(p));
  }

  @Test
  void drinksAreNotChargedByRentalDuration() {
    OrderProduct p = new OrderProduct();
    p.setItemType("DRINK");
    p.setQuantity(3);
    p.setUnitPrice(new BigDecimal("15000"));
    assertEquals(new BigDecimal("45000.00"), service.productTotal(p));
  }
}
```

#### File: `backend/src/test/java/com/courtly/service/PaymentServiceTest.java`
```java
package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
  @Mock PaymentRepository payments;
  @Mock RefundRepository refunds;
  @Mock CustomerOrderRepository orders;
  @Mock TournamentRegistrationRepository registrations;
  @Mock TournamentMatchRepository matches;
  @Mock BookingRepository bookings;
  @Mock BookingSlotRepository slots;
  @Mock OrderTotalsService totals;
  @Mock AuditService audit;
  @InjectMocks PaymentService service;

  private CustomerOrder order() {
    CustomerOrder o = new CustomerOrder();
    o.setId(UUID.randomUUID());
    o.setTotalAmount(new BigDecimal("400000"));
    o.setDepositRequired(new BigDecimal("200000"));
    o.setPaidAmount(BigDecimal.ZERO);
    o.setHoldExpiresAt(Instant.now().plusSeconds(600));
    return o;
  }

  @Test
  void rejectsOverpaymentBeforePersisting() {
    CustomerOrder o = order();
    when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
    var request =
        new PaymentRequest(o.getId(), null, new BigDecimal("400001"), "CASH", "test-overpay");
    assertThrows(BusinessException.class, () -> service.collect(request));
    verify(payments, never()).save(any());
    assertEquals(BigDecimal.ZERO, o.getPaidAmount());
  }

  @Test
  void enoughDepositConfirmsBookingAndMarksSlotsBooked() {
    CustomerOrder o = order();
    Booking b = new Booking();
    b.setId(UUID.randomUUID());
    b.setOrder(o);
    CourtSchedule schedule = new CourtSchedule();
    schedule.setStatus("LOCKED");
    BookingSlot slot = new BookingSlot();
    slot.setSchedule(schedule);
    when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
    when(bookings.findByOrderId(o.getId())).thenReturn(List.of(b));
    when(slots.findByBookingId(b.getId())).thenReturn(List.of(slot));
    when(payments.save(any()))
        .thenAnswer(
            call -> {
              Payment p = call.getArgument(0);
              p.setId(UUID.randomUUID());
              return p;
            });
    service.collect(
        new PaymentRequest(o.getId(), null, new BigDecimal("200000"), "CASH", "test-deposit"));
    assertEquals("CONFIRMED", o.getStatus());
    assertEquals("CONFIRMED", b.getStatus());
    assertEquals("BOOKED", schedule.getStatus());
    assertEquals(0, o.getPaidAmount().compareTo(new BigDecimal("200000")));
  }

  @Test
  void expiredHoldCannotBePaid() {
    CustomerOrder o = order();
    o.setHoldExpiresAt(Instant.now().minusSeconds(1));
    when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
    assertThrows(
        BusinessException.class,
        () ->
            service.collect(
                new PaymentRequest(o.getId(), null, new BigDecimal("100"), "CASH", "expired")));
    verify(payments, never()).save(any());
  }

  @Test
  void sameTransactionCodeCannotPayAnotherOrder() {
    Payment p = new Payment();
    p.setId(UUID.randomUUID());
    p.setOrder(order());
    p.setAmount(new BigDecimal("100"));
    p.setMethod("CASH");
    when(payments.findByTransactionCode("duplicate")).thenReturn(Optional.of(p));
    assertThrows(
        BusinessException.class,
        () ->
            service.collect(
                new PaymentRequest(
                    UUID.randomUUID(), null, new BigDecimal("100"), "CASH", "duplicate")));
    verify(orders, never()).findForUpdate(any());
  }

  @Test
  void refundCannotExceedRemainingReceipt() {
    CustomerOrder o = order();
    o.setStatus("CONFIRMED");
    o.setPaidAmount(new BigDecimal("100"));
    Payment p = new Payment();
    p.setId(UUID.randomUUID());
    p.setOrder(o);
    p.setAmount(new BigDecimal("200"));
    Refund prior = new Refund();
    prior.setAmount(new BigDecimal("100"));
    when(payments.findById(p.getId())).thenReturn(Optional.of(p));
    when(payments.findForUpdate(p.getId())).thenReturn(Optional.of(p));
    when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
    when(refunds.findByPaymentId(p.getId())).thenReturn(List.of(prior));
    assertThrows(
        BusinessException.class,
        () -> service.refund(p.getId(), new RefundRequest(new BigDecimal("101"), "test")));
    verify(refunds, never()).save(any());
    assertEquals(new BigDecimal("100"), o.getPaidAmount());
  }
}
```

#### File: `backend/src/test/java/com/courtly/service/ScheduleServiceTest.java`
```java
package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import java.util.List;
import org.junit.jupiter.api.Test;

class ScheduleServiceTest {
  private final ScheduleService service = new ScheduleService(null, null, null, null);

  @Test
  void matchOccupancyBlocksCustomerBooking() {
    Court c = new Court();
    c.setStatus("ACTIVE");
    CourtSchedule s = new CourtSchedule();
    s.setCourt(c);
    s.setStatus("IN_MATCH");
    assertThrows(BusinessException.class, () -> service.requireAvailable(List.of(s)));
  }

  @Test
  void maintenanceBlocksEvenAnAvailableSlot() {
    Court c = new Court();
    c.setStatus("MAINTENANCE");
    CourtSchedule s = new CourtSchedule();
    s.setCourt(c);
    s.setStatus("AVAILABLE");
    assertThrows(BusinessException.class, () -> service.requireAvailable(List.of(s)));
  }
}
```

#### File: `backend/src/test/java/com/courtly/service/TransferSecurityTest.java`
```java
package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import com.courtly.entity.Account;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class TransferSecurityTest {
  private TransferService service() {
    return new TransferService(null, null, null, null, null, null, null);
  }

  @Test
  void missingWebhookKeyCannotAcceptBankEvents() {
    var service = service();
    ReflectionTestUtils.setField(service, "mode", "LIVE");
    ReflectionTestUtils.setField(service, "webhookKey", "");
    assertEquals(503, assertThrows(ResponseStatusException.class,
        () -> service.webhook(null, Map.of())).getStatusCode().value());
  }

  @Test
  void unconfiguredBankDoesNotExposeInventedAccount() {
    var config = service().config();
    assertEquals(false, config.get("bankConfigured"));
    assertEquals("", config.get("accountNumber"));
  }

  @Test
  void directConfirmationCannotCreditCustomerOrAdministrator() {
    var service = service();
    for (var role : new String[]{"CUSTOMER", "STAFF", "ADMIN"}) {
      var actor = new Account(); actor.setRole(role);
      assertEquals(403, assertThrows(ResponseStatusException.class,
          () -> service.confirm(actor, "any-intent")).getStatusCode().value());
    }
    assertEquals(403, assertThrows(ResponseStatusException.class,
        () -> service.adminConfirm("any-intent")).getStatusCode().value());
  }
}
```

#### File: `backend/src/test/java/com/courtly/service/VoucherServiceTest.java`
```java
package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VoucherServiceTest {

  private VoucherRepository vouchers;
  private VoucherRedemptionRepository redemptions;
  private CustomerOrderRepository orders;
  private MembershipService memberships;
  private VoucherService service;

  @BeforeEach
  void setUp() {
    vouchers = mock(VoucherRepository.class);
    redemptions = mock(VoucherRedemptionRepository.class);
    orders = mock(CustomerOrderRepository.class);
    memberships = mock(MembershipService.class);
    service = new VoucherService(vouchers, redemptions, orders, memberships);
  }

  private Voucher createVoucher(String code, String type, BigDecimal val, BigDecimal min, BigDecimal max) {
    Voucher v = new Voucher();
    v.setId(UUID.randomUUID());
    v.setCode(code);
    v.setType(type);
    v.setValue(val);
    v.setMinOrder(min);
    v.setMaxDiscount(max);
    v.setEnabled(true);
    v.setUsedCount(0);
    v.setUsageLimit(100);
    v.setPerUserLimit(1);
    v.setMemberOnly(false);
    v.setNewUserOnly(false);
    v.setDescription("Test voucher " + code);
    return v;
  }

  @Test
  void welcomeVoucherApplies50kDiscountForNewUser() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    v.setNewUserOnly(true);
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(orders.countByCustomerAccountIdAndStatusNotIn(eq(accountId), any())).thenReturn(0L);

    var result = service.calculate("WELCOME", new BigDecimal("150000"), accountId);
    assertNotNull(result);
    assertEquals("WELCOME", result.get("code"));
    assertEquals(new BigDecimal("50000"), result.get("discount"));
    assertEquals(true, result.get("applied"));
  }

  @Test
  void welcomeVoucherRejectsExistingUserWithPastOrders() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    v.setNewUserOnly(true);
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(orders.countByCustomerAccountIdAndStatusNotIn(eq(accountId), any())).thenReturn(2L);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("WELCOME", new BigDecimal("150000"), accountId));
    assertTrue(ex.getMessage().contains("chỉ áp dụng cho khách hàng mới"));
  }

  @Test
  void vip10RequiresActiveMembership() {
    Voucher v = createVoucher("VIP10", "PERCENT", new BigDecimal("10"), new BigDecimal("200000"), new BigDecimal("100000"));
    v.setMemberOnly(true);
    when(vouchers.findByCodeIgnoreCase("VIP10")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(memberships.hasActiveMembership(accountId)).thenReturn(false);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("VIP10", new BigDecimal("250000"), accountId));
    assertTrue(ex.getMessage().contains("chỉ áp dụng cho hội viên"));

    when(memberships.hasActiveMembership(accountId)).thenReturn(true);
    var result = service.calculate("VIP10", new BigDecimal("250000"), accountId);
    assertEquals(new BigDecimal("25000.00"), result.get("discount"));
  }

  @Test
  void voucherThrowsWhenOrderBelowMinimum() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    var ex = assertThrows(BusinessException.class, () -> service.calculate("WELCOME", new BigDecimal("80000")));
    assertTrue(ex.getMessage().contains("tối thiểu 100000"));
  }

  @Test
  void voucherRejectsWhenTotalUsageLimitExceeded() {
    Voucher v = createVoucher("HE2026", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), null);
    v.setUsageLimit(10);
    v.setUsedCount(10);
    when(vouchers.findByCodeIgnoreCase("HE2026")).thenReturn(Optional.of(v));

    var ex = assertThrows(BusinessException.class, () -> service.calculate("HE2026", new BigDecimal("150000")));
    assertTrue(ex.getMessage().contains("hết lượt sử dụng"));
  }

  @Test
  void voucherRejectsWhenPerUserLimitExceeded() {
    Voucher v = createVoucher("COURTLY50K", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), null);
    v.setPerUserLimit(1);
    when(vouchers.findByCodeIgnoreCase("COURTLY50K")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(redemptions.countByVoucherIdAndAccountId(v.getId(), accountId)).thenReturn(1L);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("COURTLY50K", new BigDecimal("150000"), accountId));
    assertTrue(ex.getMessage().contains("đã dùng hết số lần cho phép"));
  }

  @Test
  void redeemLocksVoucherIncrementsCountAndSavesRedemption() {
    Voucher v = createVoucher("FLASH25", "PERCENT", new BigDecimal("25"), new BigDecimal("100000"), new BigDecimal("150000"));
    v.setUsedCount(5);
    when(vouchers.findByCodeForUpdate("FLASH25")).thenReturn(Optional.of(v));

    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());

    var result = service.redeem("FLASH25", order, new BigDecimal("200000"), null);
    assertNotNull(result);
    assertEquals(new BigDecimal("50000.00"), result.get("discount"));
    assertEquals(6, v.getUsedCount());

    verify(vouchers).save(v);
    verify(redemptions).save(any(VoucherRedemption.class));
  }

  @Test
  void releaseDecrementsUsageAndDeletesRedemption() {
    UUID orderId = UUID.randomUUID();
    Voucher v = createVoucher("FLASH25", "PERCENT", new BigDecimal("25"), new BigDecimal("100000"), new BigDecimal("150000"));
    v.setUsedCount(6);

    VoucherRedemption redemption = new VoucherRedemption();
    redemption.setVoucher(v);
    when(redemptions.findByOrderId(orderId)).thenReturn(Optional.of(redemption));
    when(vouchers.findByCodeForUpdate(v.getCode())).thenReturn(Optional.of(v));

    service.release(orderId);

    assertEquals(5, v.getUsedCount());
    verify(vouchers).save(v);
    verify(redemptions).delete(redemption);
  }
}
```

### 8.2 Node.js Integration & Regression Tests

#### File: `tests/booking-time.test.mjs`
```javascript
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canEndAt, timePoints, rangeSlots, clock} from '../frontend/src/guest/bookingTime.mjs';
const rows=[['18:00','18:30','AVAILABLE'],['18:30','19:00','AVAILABLE'],['19:00','19:30','AVAILABLE'],['19:30','20:00','BOOKED'],['20:00','20:30','AVAILABLE'],['22:30','23:00','AVAILABLE']].map(([start,end,status])=>({start,end,status}));
const available=s=>s.status==='AVAILABLE';
test('first click has no completed range; second click uses its exact boundary',()=>{
 assert.equal(canEndAt(rows,null,1080,available),false);
 assert.equal(canEndAt(rows,1080,1080,available),false);
 assert.equal(canEndAt(rows,1080,1170,available),true);
 assert.equal(rangeSlots(rows,1080,1170).length,3);
});
test('30-minute minimum, reverse range rejected',()=>{
 assert.equal(canEndAt(rows,1080,1110,available),true);
 assert.equal(canEndAt(rows,1110,1080,available),false);
});
test('can end exactly when a booked slot begins, cannot cross it',()=>{
 assert.equal(canEndAt(rows,1080,1170,available),true);
 assert.equal(canEndAt(rows,1080,1200,available),false);
 assert.equal(canEndAt(rows,1080,1230,available),false);
});
test('missing schedule intervals cannot be bridged',()=>assert.equal(canEndAt(rows,1200,1380,available),false));
test('closing time is available as an end boundary',()=>{
 assert.equal(canEndAt(rows,1350,1380,available),true);
 assert.equal(timePoints(rows).at(-1),1380);
 assert.equal(clock(1380),'23:00');
});
test('existing hourly bookings retain their real boundaries',()=>{
 const legacy=[{start:'06:00:00',end:'07:00:00',status:'AVAILABLE'}];
 assert.equal(canEndAt(legacy,360,420,available),true);
 assert.equal(canEndAt(legacy,360,390,available),false);
 assert.deepEqual(timePoints(legacy),[360,420]);
});
test('a refreshed unavailable slot invalidates the previously selected range',()=>{
 const updated=rows.map(s=>s.start==='18:30'?{...s,status:'LOCKED'}:s);
 assert.equal(canEndAt(updated,1080,1170,available),false);
});
```

#### File: `tests/booking-ux-browser.mjs`
```javascript
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';

// Reads the demo fixtures only; never creates bookings or payments.
const output = process.env.COURTLY_SCREENSHOTS || '/tmp/courtly-booking-ux';
await mkdir(output, {recursive:true});
const base = process.env.COURTLY_WEB_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/dat-san');
  await page.locator('[data-court-id="A01"]').waitFor();
  const day = offset => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
  const changeDate = async value => {
    const loaded = page.waitForResponse(r => r.url().includes('/overview?date='+value) && r.ok());
    await page.getByLabel('Ngày chơi', {exact:true}).fill(value);
    await loaded;
    await page.locator('[data-time="09:00"]').waitFor();
  };
  const point = value => page.locator(`[data-time="${value}"]`);
  const empty = '— — : — —';
  await changeDate(day(4));
  await page.locator('[data-court-id="A01"]').click();
  assert.equal(await point('10:00').isDisabled(), true, 'Fixture has a booked 10:00–11:00 interval');
  await point('09:00').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-range-start]').innerText(), '09:00');
  assert.equal(await page.locator('[data-range-end]').innerText(), empty);
  assert.equal(await page.locator('.gx-quote .ct-primary').isDisabled(), true);
  assert.equal(await point('10:00').isEnabled(), true, 'Can finish where another booking starts');
  assert.equal(await point('10:30').isDisabled(), true, 'Cannot cross a booked interval');
  await point('10:00').click();
  assert.equal(await page.locator('[data-range-end]').innerText(), '10:00');
  assert.match(await page.locator('.gx-quote-range').innerText(), /60 phút/);
  await point('22:30').click();
  assert.equal(await page.locator('[data-range-end]').innerText(), empty, 'Third click starts a new range');
  await point('23:00').click();
  assert.match(await page.locator('.gx-quote-range').innerText(), /30 phút/);
  await page.locator('[data-court-id="B01"]').click();
  assert.equal(await page.locator('[data-range-start]').innerText(), empty, 'Changing court clears range');
  await point('18:00').click();
  await point('19:30').click();
  await changeDate(day(5));
  assert.equal(await page.locator('[data-range-end]').innerText(), empty, 'Changing date clears range');
  await point('18:00').click();
  await point('19:30').click();
  await page.getByRole('button', {name:'Đăng nhập',exact:true}).click();
  await page.getByLabel('Email', {exact:true}).fill('minh.anh@example.com');
  await page.getByLabel('Mật khẩu', {exact:true}).fill('CourtlyDemo2026');
  await page.locator('.gx-dialog').getByRole('button', {name:'Đăng nhập',exact:true}).click();
  await page.locator('.gx-dialog').waitFor({state:'hidden'});
  await page.locator('.gx-quote .ct-primary:not(:disabled)').waitFor();
  await page.locator('.gx-referee-toggle input').check();
  await page.locator('.gx-referee-panel select').first().waitFor();
  await page.getByLabel('Đến giờ', {exact:true}).selectOption('18:30');
  await page.getByLabel('Từ giờ', {exact:true}).selectOption('19:00');
  assert.equal(await page.getByLabel('Đến giờ', {exact:true}).inputValue(), '19:30', 'Referee end stays after new start');
  await page.locator('.gx-referee-toggle input').uncheck();

  for (const width of [1440,1024,768,650,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Booking overflow '+width);
    const cells = await page.locator('.dg-art').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    assert.ok(cells.every(w => w >= 65), 'Court illustrations remain visible at '+width);
    await page.evaluate(() => window.scrollTo(0,0));
    if ([1440,390].includes(width)) await page.screenshot({path:`${output}/booking-${width}.png`,fullPage:true});
  }
  await page.goto(base);
  await page.locator('.haus-hero').waitFor();
  for (const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overview overflow '+width);
    if ([1440,390].includes(width)) await page.screenshot({path:`${output}/overview-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors, []);
  console.log('PASS booking UX: keyboard, exact end boundary, blocked ranges, closing time, court/date reset, referee hours, responsive booking and overview. No bookings created.');
} finally {
  await browser.close();
}
```

#### File: `tests/customer-booking-api.mjs`
```javascript
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

assert.equal(process.env.COURTLY_TEST_WRITE,'1','Run only against a disposable database');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8084/api';
const key=process.env.COURTLY_TEST_WEBHOOK_KEY;
assert.ok(key,'A local webhook test key is required');
const db=process.env.COURTLY_TEST_DB||'courtly_booking_test';
assert.match(db,/^courtly_booking_test(?:_[a-z0-9_]+)?$/);
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);console.log('PASS',++checks,label)};
class Client{
 cookies=new Map();
 async raw(path,method='GET',body,headers={}){
  if(method!=='GET'&&!path.startsWith('/webhooks/')){
   const csrf=await this.raw('/csrf');headers={...headers,[csrf.data.headerName]:csrf.data.token};
  }
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}
  const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
 }
 async call(path,method='GET',body){const r=await this.raw(path,method,body);assert.ok(r.status<400,`${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data}
}
const anon=new Client(),admin=new Client(),a=new Client(),b=new Client();
await admin.call('/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@gmail.com',password:process.env.ADMIN_PASSWORD||'12345'});
for(const [c,name] of [[a,'Alice'],[b,'Bob']])await c.call('/auth/register','POST',{name,email:`booking-${randomUUID()}@example.com`,password:'CustomerBooking!2026'});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+4*86400000));
const view=await anon.call('/public/overview?date='+date);
check(view.settings.holdMinutes===5&&view.settings.policies.cancelCutoffMinutes===1440,'five-minute hold and 24-hour default cancellation policy');
check(view.refereeRates.length>0&&!JSON.stringify(view.refereeRates).includes('phone'),'public referee prices without private staff fields');
const court=zone=>view.courts.find(c=>c.name.startsWith(zone)&&c.status==='ACTIVE');
const slot=(zone,hour)=>view.schedules.find(s=>s.court===court(zone).id&&s.hour===hour);
const orderBody=slots=>({scheduleIds:slots.map(s=>s.id),assignments:[],requestId:randomUUID()});
check((await anon.raw('/orders','POST',orderBody([slot('A',6)]))).status===401,'anonymous users cannot create an order');
const raced=await Promise.all([a.raw('/orders','POST',orderBody([slot('A',6)])),b.raw('/orders','POST',orderBody([slot('A',6)]))]);
check(raced.filter(r=>r.status===200).length===1&&raced.filter(r=>r.status===400).length===1,'concurrent customers: exactly one hold succeeds');
const winner=raced[0].status===200?a:b,loser=winner===a?b:a,held=raced.find(r=>r.status===200).data;
let heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.status==='HOLDING'&&Date.parse(heldView.holdUntil)-Date.now()>285000,'pending order reserves a slot immediately for five minutes');
check((await loser.raw(`/orders/${held.id}/cancel`,'POST',{requestId:randomUUID()})).status===403,'another customer cannot cancel a hold');
const intent=await winner.call('/transfers','POST',{type:'ORDER',targetId:held.id});
await winner.call(`/transfers/${intent.id}/declared`,'POST',{});
check((await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id).paid===0,'declaring a transfer does not credit money');
check((await winner.raw(`/transfers/${intent.id}/confirm`,'POST',{})).status===403,'customer self-confirmation is rejected');
check((await winner.raw(`/transfers/${intent.id}/sandbox`,'POST',{scenario:'SUCCESS'})).status===403,'customer cannot simulate a payment');
check((await admin.raw(`/transfers/${intent.id}/sandbox`,'POST',{scenario:'SUCCESS'})).status===403,'sandbox cannot run in LIVE mode, including for admin');
check((await admin.raw(`/admin/transfers/${intent.id}/confirm`,'POST',{})).status===403,'manual online confirmation cannot bypass bank verification');
check((await winner.raw('/payments','POST',{orderId:held.id,amount:intent.amount,method:'CASH',transactionCode:randomUUID()})).status===403,'customer cannot create a cash receipt');
check((await admin.raw('/payments','POST',{orderId:held.id,amount:intent.amount,method:'BANK_TRANSFER',transactionCode:randomUUID()})).status===400,'online receipts require a bank callback');
const bank=new Client();let eventId=Date.now();
const notification=(i,amount=i.amount)=>({id:++eventId,accountNumber:'999999999999',transferType:'in',content:'PAY '+i.reference,transferAmount:amount});
const send=body=>bank.raw('/webhooks/sepay','POST',body,{Authorization:'Apikey '+key});
let event=notification(intent);
check((await bank.raw('/webhooks/sepay','POST',event)).status===401,'unauthenticated webhook rejected');
check((await send({...event,accountNumber:'00000'})).status===400,'wrong receiving bank account rejected');
const callbacks=await Promise.all([send(event),send(event)]);
check(callbacks.every(r=>r.status===200),'simultaneous duplicate callbacks acknowledged');
heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.paid===intent.amount&&heldView.status==='CONFIRMED','bank callback credits the deposit exactly once and confirms booking');
check((await send({...event,transferAmount:event.transferAmount+1})).status===400,'same event ID cannot carry changed payment data');
// Enforce the configured deadline for both preview and the final mutation.
const settings=(await admin.call('/overview?date='+date)).settings;
await admin.call('/settings','PUT',{...settings,policies:{...settings.policies,cancelCutoffMinutes:10080,changeCutoffMinutes:10080}});
check((await winner.raw(`/orders/${held.id}/cancellation-preview`)).status===400,'cancellation preview enforces deadline');
check((await winner.raw(`/orders/${held.id}/cancel`,'POST',{requestId:randomUUID()})).status===400,'cancellation commit enforces deadline');
check((await winner.raw(`/orders/${held.id}/schedule`,'PATCH',{...orderBody([slot('A',7)]),reason:'test'})).status===400,'reschedule commit enforces deadline');
await admin.call('/settings','PUT',settings);
const quote=await winner.call(`/orders/${held.id}/cancellation-preview`);
check(quote.refundAmount===heldView.paid&&quote.retainedAmount===0,'eligible cancellation quotes the refundable amount');
const cancelBody={requestId:randomUUID()};await winner.call(`/orders/${held.id}/cancel`,'POST',cancelBody);await winner.call(`/orders/${held.id}/cancel`,'POST',cancelBody);
heldView=(await winner.call('/overview?date='+date)).orders.find(o=>o.id===held.id);
check(heldView.status==='CANCELLED'&&heldView.finance.refundPending===intent.amount&&heldView.paid===intent.amount,'cancel paid booking: release slot, queue refund, preserve collected balance');
check(heldView.history.filter(h=>h.type==='CANCEL').length===1&&heldView.history.at(-1).previous.status==='CONFIRMED','cancellation history is idempotent and preserves prior booking');
await loser.call('/orders','POST',orderBody([slot('A',6)]));
check(true,'released slot can be reserved by another customer');
// Expire only a test-owned hold, then book directly without an overview refresh.
const expired=await a.call('/orders','POST',orderBody([slot('A',8)]));
const lateIntent=await a.call('/transfers','POST',{type:'ORDER',targetId:expired.id});
assert.match(expired.id,/^[a-f0-9-]{36}$/);
execFileSync('docker',['compose','-p','courtly-cloud','exec','-T','postgres','psql','-U','courtly','-d',db,'-v','ON_ERROR_STOP=1','-c',`UPDATE orders SET hold_expires_at=NOW()-INTERVAL '1 second' WHERE id='${expired.id}'`],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
await b.call('/orders','POST',orderBody([slot('A',8)]));
check((await a.call('/overview?date='+date)).orders.find(o=>o.id===expired.id).status==='EXPIRED','expired hold is released before the next booking command');
check((await send(notification(lateIntent))).status===200,'late money event is acknowledged');
check((await a.call('/transfers')).find(i=>i.id===lateIntent.id).status==='REVIEW','late payment enters reconciliation instead of reclaiming another booking');
// A fully paid VIP booking may move to a cheaper available court; report credit and history.
const vip=await a.call('/orders','POST',orderBody([slot('V',10),slot('V',10.5)]));
let vipView=(await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id);
await admin.call('/payments','POST',{orderId:vip.id,amount:vipView.total,method:'CASH',transactionCode:randomUUID()});
const move={...orderBody([slot('A',10),slot('A',10.5)]),reason:'Change to outdoor'};
const preview=await a.call(`/orders/${vip.id}/preview`,'POST',move);
check(preview.difference<0&&preview.reviewAmount>0,'reschedule preview reports cheaper price and amount pending refund');
await a.call(`/orders/${vip.id}/schedule`,'PATCH',move);
vipView=(await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id);
check(vipView.status==='CONFIRMED'&&vipView.total===preview.next.total&&vipView.finance.refundPending===preview.reviewAmount,'paid reschedule updates booking and queues the excess for refund');
check(vipView.history.some(h=>h.type==='SCHEDULE'&&h.previous.total>h.total),'reschedule records previous booking and amount');
const other=await b.call('/orders','POST',orderBody([slot('A',11)]));
check((await a.raw(`/orders/${vip.id}/schedule`,'PATCH',{...orderBody([slot('A',11)]),reason:'conflict'})).status===400,'reschedule cannot steal another active hold');
check((await a.call('/overview?date='+date)).orders.find(o=>o.id===vip.id).slots[0].id===vipView.slots[0].id,'failed reschedule rolls back and preserves the old booking');
// A STAFF account can collect cash, but cannot access management or refunds.
const staffEmail=`cashier-${randomUUID()}@example.com`;
const staffAccount=await admin.call('/catalog/accounts','POST',{name:'Test Cashier',email:staffEmail,phone:'0900000009',role:'STAFF',status:'ACTIVE'});
const ticket=await admin.call('/auth/ticket','POST',{accountId:staffAccount.id});
const staff=new Client();await staff.call('/auth/activate','POST',{token:ticket.token,password:'CashierBooking!2026'});
const cashDesk=await staff.call('/payments/cash-desk');
check(cashDesk.some(o=>o.id===other.id),'STAFF can view unpaid bookings at the cash desk');
check((await a.raw('/payments/cash-desk')).status===403,'customers cannot access cash desk bookings');
const otherView=(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id);
const cashBody={orderId:other.id,amount:otherView.deposit,method:'CASH',transactionCode:randomUUID()};
const receipt=await staff.call('/payments','POST',cashBody);const repeated=await staff.call('/payments','POST',cashBody);
check(receipt.id===repeated.id&&(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id).paid===otherView.deposit,'STAFF confirms actual cash once with an idempotent receipt');
check((await staff.raw('/catalog/accounts','POST',{name:'Forbidden'})).status===403,'STAFF cannot create privileged accounts');
check((await staff.raw(`/payments/${receipt.id}/refunds`,'POST',{requestId:randomUUID(),amount:1,reason:'Forbidden'})).status===403,'cashier role does not grant refund approval');
check((await staff.raw(`/transfers/${intent.id}/confirm`,'POST',{})).status===403,'STAFF cannot self-confirm online payments');
await admin.call('/settings','PUT',{...settings,cancelRefundPercent:50});
const partialQuote=await b.call(`/orders/${other.id}/cancellation-preview`);
check(partialQuote.refundAmount===Math.round(otherView.deposit/2)&&partialQuote.retainedAmount===otherView.deposit-partialQuote.refundAmount,'configured partial refund separates refundable and retained funds');
await b.call(`/orders/${other.id}/cancel`,'POST',{requestId:randomUUID()});
await admin.call(`/payments/${receipt.id}/refunds`,'POST',{requestId:randomUUID(),amount:partialQuote.refundAmount,reason:'Local test: refund actually processed'});
const settled=(await b.call('/overview?date='+date)).orders.find(o=>o.id===other.id);
check(settled.finance.refundPending===0&&settled.paid===partialQuote.retainedAmount&&!settled.finance.review,'recorded refund clears pending review and preserves the policy retention');
await admin.call('/settings','PUT',settings);
console.log(`Completed ${checks} customer booking and payment checks against a disposable database.`);
```

#### File: `tests/customer-booking-browser.mjs`
```javascript
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const base=process.env.COURTLY_WEB_URL||'http://localhost:5173';
const output=process.env.COURTLY_SCREENSHOTS||'/tmp/courtly-customer-changes';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let created=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/orders')created++});
 await page.goto(base+'/bang-gia');await page.getByRole('heading',{name:'Bảng giá sân & dịch vụ'}).waitFor();await page.locator('.gx-pricing table').first().waitFor();
 for(const name of ['Bảng giá','Giải đấu','Hội viên'])assert.equal(await page.locator('#guest-primary-navigation').getByRole('button',{name,exact:true}).count(),1);
 assert.equal(await page.locator('.gx-pricing table').count(),3);
 assert.ok(await page.locator('.gx-pricing').innerText().then(s=>s.includes('Thứ 2–6')&&s.includes('Thứ 7–CN')&&s.includes('Giá thuê trọng tài')));
 for(const width of [1880,1440,1180,1179,768,390,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`);
  const logo=await page.locator('header .ct-logo').boundingBox(),tools=await page.locator('.cl-header-tools').boundingBox();
  assert.ok(logo.x+logo.width<=tools.x,`header logo/tools fit at ${width}`);
 }
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/pricing-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Đặt sân ngay · VIP'}).click();
 assert.equal(new URL(page.url()).pathname,'/dat-san');
 assert.equal(await page.getByLabel('Loại sân',{exact:true}).inputValue(),'V');
 assert.equal(await page.locator('.dg-court').count(),2);
 assert.equal(await page.locator('.dg-outdoor').count(),0);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
 const loaded=page.waitForResponse(r=>r.url().includes('/overview?date='+day)&&r.ok());await page.getByLabel('Ngày chơi',{exact:true}).fill(day);await loaded;
 await page.locator('[data-time="14:00"]').click();await page.locator('[data-time="15:00"]').click();
 await page.getByRole('button',{name:'Đăng nhập để đặt sân',exact:true}).click();
 await page.getByRole('dialog').waitFor();assert.equal(created,0,'anonymous click only opens authentication');
 await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
 await page.getByLabel('Họ và tên',{exact:true}).fill('Browser Booking');await page.getByLabel('Email',{exact:true}).fill('browser-'+crypto.randomUUID()+'@example.com');
 await page.getByLabel('Mật khẩu',{exact:true}).fill('BrowserBooking!2026');await page.getByLabel('Nhập lại mật khẩu',{exact:true}).fill('BrowserBooking!2026');
 await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Tiếp tục thanh toán',exact:true}).click();
 await page.getByRole('heading',{name:'Chọn phương thức thanh toán'}).waitFor();assert.equal(created,1,'signed-in customer creates one account-linked hold');
 await page.getByRole('button',{name:'Tiền mặt tại quầy',exact:true}).click();
 await page.getByRole('heading',{name:'Đơn của tôi',exact:true}).waitFor();
 assert.ok(await page.locator('[role="timer"]').innerText().then(s=>s.includes('Còn giữ chỗ')));
 assert.equal(await page.getByRole('button',{name:/Duyệt ngay|Xác nhận đã thanh toán/}).count(),0);
 await page.getByRole('button',{name:'Hủy đơn',exact:true}).first().click();await page.getByText('Dự kiến hoàn:').waitFor();
 await page.getByRole('button',{name:'Xác nhận hủy',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.ok(await page.locator('.gx-records').innerText().then(s=>s.includes('Đã hủy')));
 await page.setViewportSize({width:390,height:1000});await page.goto(base+'/bang-gia');await page.getByRole('heading',{name:'Bảng giá sân & dịch vụ'}).waitFor();await page.locator('.gx-pricing table').first().waitFor();await page.screenshot({path:output+'/pricing-mobile.png',fullPage:true});
 // Exercise the cashier UI with a separate STAFF login and a local test booking.
 const call=async(context,path,method='GET',body)=>{
  const headers={};if(method!=='GET'){const c=await context.request.get(base+'/api/csrf');const token=await c.json();headers[token.headerName]=token.token}
  const r=await context.request.fetch(base+'/api'+path,{method,headers,data:body});assert.ok(r.ok(),path+': '+await r.text());return r.status()===204?null:r.json();
 };
 const customer=page.context();
 const overview=await call(customer,'/overview?date='+day);
 const vip=overview.courts.find(c=>c.name==='V02');
 const available=overview.schedules.filter(s=>s.court===vip.id&&s.status==='AVAILABLE').sort((a,b)=>a.start.localeCompare(b.start));
 const first=available.findIndex((s,i)=>available[i+1]?.start===s.end);assert.ok(first>=0);
 const ids=available.slice(first,first+2).map(s=>s.id);
 const held=await call(customer,'/orders','POST',{scheduleIds:ids,assignments:[],requestId:crypto.randomUUID()});
 const admin=await browser.newContext();
 await call(admin,'/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@gmail.com',password:process.env.ADMIN_PASSWORD||'12345'});
 const account=await call(admin,'/catalog/accounts','POST',{name:'Browser Cashier',email:'cashier-'+crypto.randomUUID()+'@example.com',phone:'0900000008',role:'STAFF',status:'ACTIVE'});
 const ticket=await call(admin,'/auth/ticket','POST',{accountId:account.id});
 const staff=await browser.newContext();await call(staff,'/auth/activate','POST',{token:ticket.token,password:'BrowserCashier!2026'});
 const desk=await staff.newPage();desk.on('pageerror',e=>errors.push(e.message));await desk.goto(base+'/quay-thu');
 await desk.getByRole('heading',{name:'Thu tiền mặt tại quầy',exact:true}).waitFor();
 await desk.getByLabel('Chọn đơn',{exact:true}).selectOption(held.id);
 await desk.getByRole('checkbox').check();await desk.getByRole('button',{name:'Xác nhận tiền mặt đã thu',exact:true}).click();
 await desk.getByText('Đã ghi nhận phiếu thu:',{exact:false}).waitFor({timeout:10000}).catch(async error=>{await desk.screenshot({path:output+'/cashier-failure.png'});throw new Error(error.message+'\n'+await desk.locator('main').innerText())});
 assert.equal((await call(customer,'/overview?date='+day)).orders.find(o=>o.id===held.id).status,'CONFIRMED');
 await call(customer,`/orders/${held.id}/cancel`,'POST',{requestId:crypto.randomUUID()});
 await staff.close();await admin.close();
 assert.deepEqual(errors,[]);console.log('PASS browser: navigation, responsive pricing, VIP filter, login gate, account-linked hold, cash choice, countdown, cancellation and STAFF cash collection; no page errors.');
}finally{await browser.close()}
```

#### File: `tests/handoff-admin-api.mjs`
```javascript
import assert from 'node:assert/strict';
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8083/api';
if(!process.env.COURTLY_TEST_WRITE)throw Error('Set COURTLY_TEST_WRITE=1; run only against a disposable test database.');
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);console.log('PASS',++checks,msg)};
class Client{cookies=new Map();async raw(path,method='GET',body,headers={}){const res=await fetch(base+path,{method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const c of res.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}let data;try{data=await res.json()}catch{data=null}return {status:res.status,data}}
async call(path,method='GET',body){let headers={};if(method!=='GET'){const c=await this.raw('/csrf');headers[c.data.headerName]=c.data.token}const r=await this.raw(path,method,body,headers);if(r.status>=400)throw Object.assign(Error(path+': '+JSON.stringify(r)),r);return r.data}
async fails(path,method,body,status){let failed=false;try{await this.call(path,method,body)}catch(e){failed=true;if(status)assert.equal(e.status,status)}check(failed,'reject '+path)}
async login(email){return this.call('/auth/login','POST',{email,password:email==='admin@gmail.com'?'12345':'CourtlyDemo2026'})}}

const admin=new Client();await admin.login('admin@gmail.com');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+31*86400000));
let view=await admin.call('/overview?date='+date);const person=view.staff.find(s=>s.type==='REFEREE');
const result=await admin.call('/catalog/staff-schedules','POST',{staff:person.id,date,start:8.5,end:10.5});
view=await admin.call('/overview?date='+date);const shifts=view.staffSchedules.filter(s=>s.staff===person.id&&s.date===date);
check(shifts.length===4&&shifts.some(s=>s.start===8.5&&s.end===9),'admin creates four half-hour shifts with accurate times');
const first=shifts.find(s=>s.start===8.5);await admin.call('/catalog/staff-schedules/'+first.id,'PUT',{staff:person.id,date,start:8.5,end:9});check(true,'admin edits existing half-hour shift');
await admin.fails('/catalog/staff-schedules','POST',{staff:person.id,date,start:8.25,end:9});
check(view.schedules.length===340,'admin generates future half-hour court calendar');
console.log('Completed',checks,'admin half-hour API checks');
```

#### File: `tests/handoff-admin-browser.mjs`
```javascript
import assert from 'node:assert/strict';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {mkdir} from 'node:fs/promises';
const output=process.env.COURTLY_SCREENSHOTS||'/tmp/courtly-handoff-screens';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.COURTLY_WEB_URL||'http://127.0.0.1:5175');
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('admin@gmail.com');await page.getByLabel('Mật khẩu',{exact:true}).fill('12345');
 await page.locator('.gx-dialog').getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.locator('.sidebar').waitFor();await page.locator('.main h1').waitFor();
 assert.equal(await page.locator('#courtly-balanced-amenities').count(),0,'Guest layout does not wrap admin');
 assert.equal(await page.locator('.sidebar nav').getByRole('button',{name:'Đồ uống & đồ thuê',exact:true}).count(),0);
 const buttons=page.locator('.sidebar nav button');const count=await buttons.count();
 for(let i=0;i<count;i++){const label=await buttons.nth(i).innerText();await buttons.nth(i).click();await page.locator('.main h1').waitFor();assert.equal(await page.locator('.main .error').count(),0,label);console.log('PASS admin page',label)}
 await page.locator('.sidebar nav').getByRole('button',{name:'Dịch vụ trọng tài',exact:true}).click();
 await page.locator('.main').getByRole('button',{name:'Chọn trọng tài',exact:true}).first().click();
 await page.getByRole('button',{name:'Kiểm tra sân và trọng tài',exact:true}).click();
 await page.getByRole('button',{name:'Xác nhận phân công',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Thêm sản phẩm',exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'Thiết bị thuê theo giờ',exact:true}).count(),0);
 await page.screenshot({path:output+'/admin-referee-only.png'});
 await page.keyboard.press('Escape');
 console.log('PASS referee selection dialog and retired product controls absent');
 await page.locator('.sidebar nav').getByRole('button',{name:'Lịch sân',exact:true}).click();await page.locator('.main h1').waitFor();
 assert.ok((await page.locator('.main').innerText()).includes('06:30'),'Half-hour calendar labels');
 await page.screenshot({path:output+'/admin-calendar.png'});
 assert.deepEqual(errors,[]);console.log('PASS admin layout, navigation and 30-minute calendar');
}finally{await browser.close()}
```

#### File: `tests/handoff-api.mjs`
```javascript
import assert from 'node:assert/strict';
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8083/api';
if(!process.env.COURTLY_TEST_WRITE)throw Error('Set COURTLY_TEST_WRITE=1; run only against a disposable test database.');
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);console.log('PASS',++checks,msg)};
class Client{cookies=new Map();async raw(path,method='GET',body,headers={}){const res=await fetch(base+path,{method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const c of res.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}let data;try{data=await res.json()}catch{data=null}return {status:res.status,data}}
async call(path,method='GET',body){let headers={};if(method!=='GET'){const c=await this.raw('/csrf');headers[c.data.headerName]=c.data.token}const r=await this.raw(path,method,body,headers);if(r.status>=400)throw Object.assign(Error(path+': '+JSON.stringify(r)),r);return r.data}
async fails(path,method,body,status){let failed=false;try{await this.call(path,method,body)}catch(e){failed=true;if(status)assert.equal(e.status,status)}check(failed,'reject '+path)}
async login(email){return this.call('/auth/login','POST',{email,password:email==='admin@gmail.com'?'12345':'CourtlyDemo2026'})}}
const admin=new Client(),user=new Client(),other=new Client();
const as=await admin.login('admin@gmail.com'),us=await user.login('minh.anh@example.com'),os=await other.login('player2@courtly.example');check(as.user.role==='ADMIN'&&as.user.isOwner,'admin login and owner');check(us.user.role==='CUSTOMER','demo customer login');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));
let view=await user.call('/overview?date='+date);check(view.courts.length===10,'10 courts');check(view.orders.length>=140,'abundant demo booking history');check(view.schedules.length===340,'30-minute court schedules');check(view.accounts.length===1&&view.accounts[0].id===us.user.id,'account privacy');
await user.fails('/payments','POST',{orderId:view.orders[0].id,amount:1,method:'CASH',transactionCode:'forged'},403);
const slots=(name,start,end)=>view.schedules.filter(s=>s.court===view.courts.find(c=>c.name===name).id&&s.start>=start&&s.end<=end).sort((a,b)=>a.start.localeCompare(b.start));
const chosen=slots('A01','15:00','16:30:00');check(chosen.length===3,'90-minute contiguous selection');
const options=await user.call('/booking/options','POST',{scheduleIds:chosen.map(s=>s.id)});const ref=options.staffSlots[0].staff.find(p=>p.rate===150000&&p.available);check(!!ref,'referee available');
const req={scheduleIds:chosen.map(s=>s.id),assignments:[{scheduleId:chosen[0].id,staffId:ref.id}],requestId:crypto.randomUUID()};
const created=await user.call('/orders','POST',req);const duplicate=await user.call('/orders','POST',req);check(created.id===duplicate.id,'booking request idempotency');
await other.fails('/orders','POST',{scheduleIds:chosen.map(s=>s.id),assignments:[],requestId:crypto.randomUUID()});
view=await user.call('/overview?date='+date);let order=view.orders.find(o=>o.id===created.id);check(order.total===375000&&order.deposit===150000,'90min A court + 30min referee: 375000 total / 150000 deposit');
let intent=await user.call('/transfers','POST',{type:'ORDER',targetId:created.id});const again=await user.call('/transfers','POST',{type:'ORDER',targetId:created.id});check(intent.id===again.id,'reuse pending payment intent');
await other.fails('/transfers/'+intent.id+'/declared','POST',{},403);
intent=await user.call('/transfers/'+intent.id+'/declared','POST',{});check(intent.status==='CHECKING'&&intent.received===0,'customer declaration does not receive money');
intent=await user.call('/transfers/'+intent.id+'/sandbox','POST',{scenario:'PARTIAL'});check(intent.received===75000&&intent.remaining===75000,'partial transfer');
intent=await user.call('/transfers/'+intent.id+'/sandbox','POST',{scenario:'DUPLICATE'});check(intent.received===150000&&intent.status==='CONFIRMED','duplicate notification counted once');
view=await user.call('/overview?date='+date);order=view.orders.find(o=>o.id===created.id);check(order.status==='CONFIRMED'&&order.paid===150000,'deposit confirms booking');
const balance=await user.call('/transfers','POST',{type:'ORDER',targetId:created.id,purpose:'BALANCE'});check(balance.amount===225000,'remaining court + referee balance');
await user.call('/transfers/'+balance.id+'/sandbox','POST',{scenario:'SUCCESS'});view=await user.call('/overview?date='+date);check(view.orders.find(o=>o.id===created.id).paid===375000,'balance fully paid');
const next=slots('A02','16:00','16:30:00');const late=await user.call('/orders','POST',{scheduleIds:next.map(s=>s.id),assignments:[],requestId:crypto.randomUUID()});const lateIntent=await user.call('/transfers','POST',{type:'ORDER',targetId:late.id});const reviewed=await user.call('/transfers/'+lateIntent.id+'/sandbox','POST',{scenario:'LATE'});check(reviewed.status==='REVIEW'&&reviewed.received===0&&reviewed.reviewAmount===50000,'late money goes to review');
view=await user.call('/overview?date='+date);check(view.orders.find(o=>o.id===late.id).status==='EXPIRED'&&view.schedules.find(s=>s.id===next[0].id).status==='AVAILABLE','late payment does not reclaim court');
const vip=slots('V01','17:00','17:30:00');const vopt=await other.call('/booking/options','POST',{scheduleIds:vip.map(s=>s.id)});check(vopt.courtQuote.net===237500,'Club VIP discount 5%');
const vref=vopt.staffSlots[0].staff.find(p=>p.rate===150000&&p.available);const vb=await other.call('/orders','POST',{scheduleIds:vip.map(s=>s.id),assignments:[{scheduleId:vip[0].id,staffId:vref.id}],requestId:crypto.randomUUID()});const ov=await other.call('/overview?date='+date);const vo=ov.orders.find(o=>o.id===vb.id);check(vo.total===312500&&vo.deposit===118750,'Club VIP + referee price/deposit example');
const single=view.tournaments.find(t=>t.format==='SINGLES'&&t.status==='OPEN');const tr=await user.call(`/guest/tournaments/${single.id}/register`,'POST',{name:'Demo user',phone:'0901234567',adult:true,rules:true,requestId:crypto.randomUUID()});const fee=await user.call('/transfers','POST',{type:'TOURNAMENT',targetId:tr.id});await user.call('/transfers/'+fee.id+'/sandbox','POST',{scenario:'SUCCESS'});check((await user.call('/overview?date='+date)).registrations.find(r=>r.id===tr.id).status==='CONFIRMED','tournament fee confirms registration');
const doubles=view.tournaments.find(t=>t.format==='DOUBLES'&&t.status==='OPEN');await user.fails(`/guest/tournaments/${doubles.id}/register`,'POST',{name:'Demo',phone:'0901234567',teamName:'Team',partnerName:'Same player',partnerEmail:'minh.anh@example.com',adult:true,rules:true,requestId:crypto.randomUUID()});
await user.fails('/feedback','POST',{rating:4.5,message:'Sample feedback with invalid rating',topic:'COURT',publishConsent:false,requestId:crypto.randomUUID()});
const fb=await user.call('/feedback','POST',{rating:5,message:'Feedback test: clear booking and payment information.',topic:'WEBSITE',publishConsent:false,requestId:crypto.randomUUID()});const content=await user.call('/public/content');check(!content.feedback.some(f=>f.id===fb.id),'private feedback not published');
const member=await user.call('/membership/requests','POST',{planId:'club',requestId:crypto.randomUUID()});let mv=await user.call('/overview?date='+date);check(mv.memberships.find(m=>m.id===member.id).status==='PENDING','membership pending before payment');const mi=await user.call('/transfers','POST',{type:'MEMBERSHIP',targetId:member.id});await user.call('/transfers/'+mi.id+'/sandbox','POST',{scenario:'PARTIAL'});const reuseMember=await user.call('/transfers','POST',{type:'MEMBERSHIP',targetId:member.id});check(reuseMember.id===mi.id&&reuseMember.remaining===149500,'membership partial payment resumes remaining amount');await user.call('/transfers/'+mi.id+'/sandbox','POST',{scenario:'SUCCESS'});mv=await user.call('/overview?date='+date);check(mv.memberships.find(m=>m.id===member.id).status==='ACTIVE','full membership payment activates plan');
const futureDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
const future=await user.call('/overview?date='+futureDate);const at=(start)=>future.schedules.filter(s=>s.court===future.courts.find(c=>c.name==='A04').id&&s.start===start);
const original=await user.call('/orders','POST',{scheduleIds:at('18:00:00').map(s=>s.id),assignments:[],requestId:crypto.randomUUID()});
const change={scheduleIds:at('19:00:00').map(s=>s.id),assignments:[],requestId:crypto.randomUUID()};await user.call('/orders/'+original.id+'/schedule','PATCH',change);await user.call('/orders/'+original.id+'/schedule','PATCH',change);
check((await user.call('/overview?date='+futureDate)).memberships.find(m=>m.id===member.id).rescheduleUsage===1,'membership reschedule consumes one allowance, retry is idempotent');
await user.fails('/orders/'+original.id+'/schedule','PATCH',{scheduleIds:at('20:00:00').map(s=>s.id),assignments:[],requestId:crypto.randomUUID()});
console.log('Completed',checks,'checks');
```

#### File: `tests/handoff-browser.mjs`
```javascript
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output=process.env.COURTLY_SCREENSHOTS||'/tmp/courtly-handoff-screens';await mkdir(output,{recursive:true});
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable seeded database and set COURTLY_TEST_WRITE=1');
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.COURTLY_WEB_URL||'http://127.0.0.1:5175';
await page.goto(base);await page.locator('.haus-hero').waitFor();
await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
await page.getByLabel('Email',{exact:true}).fill('minh.anh@example.com');await page.getByLabel('Mật khẩu',{exact:true}).fill('CourtlyDemo2026');await page.locator('.gx-dialog').getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.locator('.gx-dialog').waitFor({state:'hidden'}).catch(async e=>{console.log(await page.locator('.gx-dialog').innerText());throw e});
await page.locator('.ct-header nav').getByRole('button',{name:'Đặt sân',exact:true}).click();
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+2*86400000));
await page.locator('.gx-booking').getByLabel('Ngày chơi',{exact:true}).fill(day);
await page.locator('[data-court-id="A03"]').click();
await page.locator('[data-time="18:00"]').click();assert.equal(await page.locator('[data-range-end]').innerText(),'— — : — —');await page.locator('[data-time="19:30"]').click();
await page.locator('.gx-quote').getByRole('button',{name:'Tiếp tục thanh toán',exact:true}).waitFor();
await page.getByRole('button',{name:'EN',exact:true}).click();
assert.equal(await page.locator('[data-range-start]').innerText(),'18:00');assert.equal(await page.locator('[data-range-end]').innerText(),'19:30');
await page.getByRole('button',{name:'VI',exact:true}).click();
await page.screenshot({path:output+'/booking.png',fullPage:true});
await page.locator('.gx-quote').getByRole('button',{name:'Tiếp tục thanh toán',exact:true}).click();
await page.locator('.gx-payment').waitFor({timeout:30000});assert.match(await page.locator('.gx-payment').innerText(),/THỬ NGHIỆM/);
await page.screenshot({path:output+'/payment.png'});
await page.getByRole('button',{name:'Chuyển đủ',exact:true}).click();await page.locator('.gx-payment .gx-CONFIRMED').waitFor();await page.keyboard.press('Escape');
await page.reload();await page.locator('.gx-records').waitFor();assert.ok((await page.locator('.gx-records article').count())>0);
for(const width of [1440,1024,736,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width)}
await page.goto(base+'/feedback');await page.locator('.gx-stars input[value="4"]').check();assert.equal(await page.locator('.gx-stars input:checked').inputValue(),'4');
await page.goto(base+'/tin-tuc');await page.locator('.gx-event-grid article').first().getByRole('button').click();await page.locator('.gx-article').waitFor();await page.keyboard.press('Escape');
await page.goto(base+'/lien-he');await page.locator('.gx-split').waitFor();assert.ok((await page.locator('.gx-split').innerText()).includes('DEMO'));assert.ok((await page.locator('footer').innerText()).includes('DEMO'));
assert.deepEqual(errors,[]);console.log('PASS browser: login, 90-minute selection, language state persistence, payment sandbox, reload persistence, feedback, article, consistent contact, responsive widths.');
await browser.close();
```

#### File: `tests/handoff-webhook.mjs`
```javascript
import assert from 'node:assert/strict';
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8084/api';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Disposable test DB only');
const key=process.env.COURTLY_TEST_WEBHOOK_KEY;assert.ok(key,'Set local test webhook key');
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);console.log('PASS',++checks,msg)};
class Client{cookies=new Map();async raw(path,method='GET',body,headers={}){const res=await fetch(base+path,{method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const c of res.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}let data;try{data=await res.json()}catch{data=null}return {status:res.status,data}}
async call(path,method='GET',body){let headers={};if(method!=='GET'){const c=await this.raw('/csrf');headers[c.data.headerName]=c.data.token}const r=await this.raw(path,method,body,headers);if(r.status>=400)throw Object.assign(Error(path+': '+JSON.stringify(r)),r);return r.data}
async fails(path,method,body,status){let failed=false;try{await this.call(path,method,body)}catch(e){failed=true;if(status)assert.equal(e.status,status)}check(failed,'reject '+path)}
async login(email){return this.call('/auth/login','POST',{email,password:email==='admin@gmail.com'?'12345':'CourtlyDemo2026'})}}

const user=new Client();await user.login('player3@courtly.example');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+4*86400000));
const view=await user.call('/overview?date='+date);const slot=view.schedules.find(s=>s.court===view.courts.find(c=>c.name==='B04').id&&s.start==='21:00:00');
const order=await user.call('/orders','POST',{scheduleIds:[slot.id],assignments:[],requestId:crypto.randomUUID()});
const intent=await user.call('/transfers','POST',{type:'ORDER',targetId:order.id});
check(intent.mode==='LIVE'&&intent.qrPayload.startsWith('000201010212'),'local VietQR EMV payload');
let crc=0xffff;for(const v of new TextEncoder().encode(intent.qrPayload.slice(0,-4))){crc^=v<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;crc&=0xffff}
check(crc.toString(16).toUpperCase().padStart(4,'0')===intent.qrPayload.slice(-4),'QR CRC16 checksum');
await user.fails('/transfers/'+intent.id+'/sandbox','POST',{scenario:'SUCCESS'},404);
const bank=new Client();const notification={id:800001,accountNumber:'999999999999',transferType:'in',content:'PAY '+intent.reference,transferAmount:intent.amount};
check((await bank.raw('/webhooks/sepay','POST',notification)).status===401,'webhook requires API key');
const send=b=>bank.raw('/webhooks/sepay','POST',b,{Authorization:'Apikey '+key});
check((await send({...notification,id:null})).status>=400,'reject absent bank event ID');
check((await send({...notification,accountNumber:'00000'})).status>=400,'reject incorrect receiving account');
check((await send(notification)).status===200,'verified incoming transfer accepted');
check((await send(notification)).status===200,'duplicate event acknowledged');
let current=(await user.call('/overview?date='+date)).orders.find(o=>o.id===order.id);
check(current.paid===intent.amount&&current.status==='CONFIRMED','callback credited once, order confirmed');
check((await send({...notification,transferAmount:intent.amount+1})).status>=400,'reject changed contents for same event ID');
await send({...notification,id:800002,transferAmount:intent.amount*10});
const reviewed=(await user.call('/transfers')).find(x=>x.id===intent.id);
check(reviewed.status==='REVIEW'&&reviewed.reviewAmount===intent.amount*10,'overpayment routed to reconciliation');
current=(await user.call('/overview?date='+date)).orders.find(o=>o.id===order.id);check(current.paid===intent.amount,'overpayment does not alter verified order balance');
console.log('Completed',checks,'local webhook contract checks; no real bank contacted.');
```

#### File: `tests/header-courts-browser.mjs`
```javascript
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const base = process.env.COURTLY_WEB_URL || 'http://127.0.0.1:5175';
const output = process.env.COURTLY_SCREENSHOTS || '/tmp/courtly-header-courts';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1880,height:1050}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base+'/dat-san');
  await page.locator('.dg-court').first().waitFor();
  assert.equal(await page.locator('.dg-indoor .dg-court').count(), 4);
  assert.equal(await page.locator('.dg-vip .dg-court').count(), 2);
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3*86400000));
  const loaded = page.waitForResponse(r => r.url().includes('/overview?date='+day) && r.ok());
  await page.getByLabel('Ngày chơi',{exact:true}).fill(day);
  await loaded;
  for (const code of ['B01','B02','B03','B04','V01','V02']) {
    await page.locator(`[data-court-id="${code}"]`).click();
    await page.locator('[data-time="18:00"]').click();
    await page.locator('[data-time="19:00"]').click();
    assert.equal(await page.locator('[data-range-end]').innerText(),'19:00');
    assert.equal(await page.locator('.gx-quote .ct-primary').isEnabled(),true,code+' has real selectable schedules');
  }
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path:output+'/courts-desktop.png'});
  const checkHeader = async state => {
    for (const lang of ['VI','EN']) {
      await page.getByRole('button',{name:lang,exact:true}).click();
      for (const width of [1880,1440,1180,1179,1024,768,390,320]) {
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,`${state} ${lang} overflow ${width}`);
        const logo=await page.locator('header .ct-logo').boundingBox();
        const tools=await page.locator('.cl-header-tools').boundingBox();
        assert.ok(logo.x+logo.width<=tools.x, 'Logo and tools do not overlap');
        if (width>=1180) {
          const nav=await page.locator('#guest-primary-navigation').boundingBox();
          assert.ok(nav && nav.x>=logo.x+logo.width && nav.x+nav.width<=tools.x,'Three header regions do not overlap');
          assert.ok(await page.locator('#guest-primary-navigation button').first().evaluate(n => parseFloat(getComputedStyle(n).fontSize)>=16),'Readable desktop navigation');
          if (width===1880 && lang==='VI') {
            await page.evaluate(() => window.scrollTo(0,0));
            await page.screenshot({path:`${output}/header-${state}.png`,clip:{x:0,y:0,width,height:140}});
          }
        } else {
          const toggle=page.locator('.gx-menu');
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'),'true');
          assert.equal(await page.locator('#guest-primary-navigation button:visible').count(),5);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,'Open menu stays within screen');
          if (width===390 && lang==='VI') await page.screenshot({path:`${output}/menu-${state}-390.png`});
          await page.locator('#guest-primary-navigation button').nth(1).click();
          assert.equal(await toggle.getAttribute('aria-expanded'),'false','Navigation closes mobile menu');
        }
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'VI',exact:true}).click();
  };
  await checkHeader('guest');
  // The migration-only fixture has no customer accounts; use the SQL demo for this part.
  if (process.env.COURTLY_SKIP_LOGIN !== '1') {
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill('minh.anh@example.com');
    await page.getByLabel('Mật khẩu',{exact:true}).fill('CourtlyDemo2026');
    await page.locator('.gx-dialog').getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.locator('.gx-dialog').waitFor({state:'hidden'});
    await checkHeader('customer');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS four indoor/two VIP courts with schedules; readable header, VI/EN, responsive menu and non-overlapping regions.');
} finally {await browser.close();}
```

#### File: `tests/multi-court.test.mjs`
```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';

const base = process.env.COURTLY_API_URL || 'http://localhost:3000/api';

class Client {
  cookies = new Map();
  csrf = null;
  async call(path, method = 'GET', body, expected = 200) {
    if (!['GET', 'HEAD'].includes(method) && !this.csrf) {
      const r = await this.call('/csrf');
      this.csrf = r;
    }
    const r = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: new URL(base).origin,
        cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(this.csrf ? {[this.csrf.headerName]: this.csrf.token} : {})
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });
    for (const raw of r.headers.getSetCookie()) {
      const pair = raw.split(';')[0], index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = {raw: text.slice(0, 300)}; }
    if (expected !== null) assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
    return expected === null ? {status: r.status, body: data} : data;
  }
}

test('Multi-court booking in single order validation', async () => {
  const admin = new Client();
  const alice = new Client();
  const offset = 4;
  const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const email = `multi-${randomUUID().slice(0, 8)}@example.com`;

  // Register alice
  await alice.call('/auth/register', 'POST', {name: 'Alice Multi', email, password: 'CourtlyCustomer!2026'});

  // Trigger schedule generation via overview
  const overview = await alice.call('/overview?date=' + date);
  const activeCourts = overview.courts.filter(c => c.status === 'ACTIVE');
  assert(activeCourts.length >= 2, 'Need at least 2 active courts');

  const c1 = activeCourts[0].id;
  const c2 = activeCourts[1].id;
  const slot = (courtId, hour) => overview.schedules.find(s => s.court === courtId && s.date === date && s.hour === hour)?.id;
  const isAvailable = (courtId, h) => overview.schedules.some(s => s.court === courtId && s.hour === h && s.status === 'AVAILABLE');

  // Find parallel available hours
  const possibleHours = [9, 10, 11, 13, 14, 15, 16, 17, 21].filter(h =>
    isAvailable(c1, h) && isAvailable(c1, h + 0.5) && isAvailable(c2, h) && isAvailable(c2, h + 0.5)
  );
  assert(possibleHours.length >= 2, 'Need available hours');
  const hParallel = possibleHours[0];

  // 1. Parallel booking: c1 and c2 at the same hour
  const parallelSlots = [slot(c1, hParallel), slot(c1, hParallel + 0.5), slot(c2, hParallel), slot(c2, hParallel + 0.5)].filter(Boolean);
  assert.equal(parallelSlots.length, 4);

  const parallelOrder = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: parallelSlots,
    assignments: []
  });
  assert(parallelOrder.id, 'Parallel order should be created');

  const checkParallel = (await alice.call('/overview?date=' + date)).orders.find(o => o.id === parallelOrder.id);
  assert.equal(checkParallel.slots.length, 4);
  const courtIdsInOrder = new Set(checkParallel.slots.map(s => s.court));
  assert.equal(courtIdsInOrder.size, 2, 'Order must contain 2 distinct courts');

  // 2. Sequential booking: c1 at hSeq and c2 at hSeq + 1 (connected)
  const overview2 = await alice.call('/overview?date=' + date);
  const isAvailable2 = (courtId, h) => overview2.schedules.some(s => s.court === courtId && s.hour === h && s.status === 'AVAILABLE');
  const hSeq = possibleHours.find(h => h !== hParallel && isAvailable2(c1, h) && isAvailable2(c1, h + 0.5) && isAvailable2(c2, h + 1) && isAvailable2(c2, h + 1.5));
  assert(hSeq !== undefined, 'Need available sequential hours');
  const seqSlots = [slot(c1, hSeq), slot(c1, hSeq + 0.5), slot(c2, hSeq + 1), slot(c2, hSeq + 1.5)].filter(Boolean);
  assert.equal(seqSlots.length, 4);

  const seqOrder = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: seqSlots,
    assignments: []
  });
  assert(seqOrder.id, 'Sequential order should be created');

  // 3. Disparate times: c1 morning + c2 evening (gap > 30 mins) -> should reject with 400
  const disparateSlots = [slot(c1, 8), slot(c1, 8.5), slot(c2, 22), slot(c2, 22.5)].filter(Boolean);
  assert.equal(disparateSlots.length, 4);

  const dispRes = await alice.call('/orders', 'POST', {
    requestId: randomUUID(),
    scheduleIds: disparateSlots,
    assignments: []
  }, null);
  assert.equal(dispRes.status, 400);
  assert.match(dispRes.body.message, /cùng khung giờ hoặc nối tiếp nhau/);
});
```

#### File: `tests/password-persistence.test.mjs`
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const BASE = process.env.COURTLY_API_URL || 'http://localhost:8081/api';

class Client {
  cookies = new Map();
  csrf = null;

  async call(path, method = 'GET', body, expected = 200) {
    if (!['GET', 'HEAD'].includes(method) && !this.csrf) {
      const r = await this.call('/csrf');
      this.csrf = r;
    }
    const r = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: new URL(BASE).origin,
        cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(this.csrf ? { [this.csrf.headerName]: this.csrf.token } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const raw of r.headers.getSetCookie()) {
      const pair = raw.split(';')[0], idx = pair.indexOf('=');
      this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
    if (expected !== null) {
      assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
    }
    return expected === null ? { status: r.status, body: data } : data;
  }
}

async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const ping = await fetch(BASE + '/auth/session');
      if (ping.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

test('Password persistence across multiple backend restarts', async () => {
  const staffClient = new Client();

  // 1. Initial login with 12345
  const loginRes = await staffClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(loginRes.authenticated, true);
  assert.equal(loginRes.user.email, 'staff@gmail.com');
  assert.equal(loginRes.user.role, 'STAFF');

  // 2. Change password to StaffSecure!2026
  const changeRes = await staffClient.call('/auth/password', 'POST', {
    currentPassword: '12345',
    password: 'StaffSecure!2026',
    confirm: 'StaffSecure!2026'
  });
  assert.equal(changeRes.authenticated, true);

  // 3. Verify old password 12345 is immediately rejected
  const oldLoginClient = new Client();
  const oldLoginRes = await oldLoginClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);
  assert.match(oldLoginRes.message, /Email hoặc mật khẩu không đúng/);

  // 4. Verify new password works
  const newLoginClient = new Client();
  const newLoginRes = await newLoginClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(newLoginRes.authenticated, true);

  // 5. FIRST RESTART: Restart backend container (simulating server reboot #1)
  console.log('Restarting backend container (Restart 1)...');
  execSync('docker compose restart backend', { stdio: 'inherit' });
  assert.equal(await waitForBackend(), true, 'Backend failed to restart within 30s');

  // 6. Verify old password 12345 is STILL REJECTED after restart 1
  const postRestart1OldClient = new Client();
  const postRestart1OldRes = await postRestart1OldClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);
  assert.match(postRestart1OldRes.message, /Email hoặc mật khẩu không đúng/);

  // 7. Verify changed password is STILL ACCEPTED after restart 1!
  const postRestart1NewClient = new Client();
  const postRestart1NewRes = await postRestart1NewClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(postRestart1NewRes.authenticated, true);

  // 8. SECOND RESTART: Restart backend container AGAIN (simulating server reboot #2)
  console.log('Restarting backend container (Restart 2)...');
  execSync('docker compose restart backend', { stdio: 'inherit' });
  assert.equal(await waitForBackend(), true, 'Backend failed to restart within 30s on reboot 2');

  // 9. Verify old password is STILL REJECTED and new password STILL WORKS on reboot 2!
  const postRestart2OldClient = new Client();
  await postRestart2OldClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  }, 400);

  const postRestart2NewClient = new Client();
  const postRestart2NewRes = await postRestart2NewClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: 'StaffSecure!2026'
  });
  assert.equal(postRestart2NewRes.authenticated, true);

  // 10. Revert password back to 12345 directly via DB so other test suites stay consistent
  execSync(
    'docker compose exec -T postgres psql -U courtly -d courtly -c ' +
    '"UPDATE accounts SET password_hash = \'$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW\' WHERE email = \'staff@gmail.com\';"'
  );

  // Verify revert succeeded
  const revertClient = new Client();
  const revertRes = await revertClient.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(revertRes.authenticated, true);
});
```

#### File: `tests/pricing.test.mjs`
```javascript
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tariffRows, getCourtMatrix, getSlotPrice, WEEK_DAYS, STANDARD_TIME_BLOCKS} from '../frontend/src/guest/pricing.mjs';

const court = { id: 'vip', price: 500000 };

test('weekday and weekend tariffs align across half-hour boundaries and base-price gaps', () => {
  const rows = tariffRows(court, [
    { court: 'vip', dayType: 'WEEKDAY', start: 17.5, end: 21, price: 600000 },
    { court: 'vip', dayType: 'WEEKEND', start: 6, end: 23, price: 700000 },
    { court: 'other', dayType: 'WEEKDAY', start: 8, end: 10, price: 1 }
  ]);
  assert.deepEqual(rows, [
    { start: '06:00', end: '17:30', weekday: 500000, weekend: 700000 },
    { start: '17:30', end: '21:00', weekday: 600000, weekend: 700000 },
    { start: '21:00', end: '23:00', weekday: 500000, weekend: 700000 }
  ]);
});

test('a court without special tariffs shows its actual base price on both calendars', () => {
  assert.deepEqual(tariffRows(court, []), [
    { start: '06:00', end: '23:00', weekday: 500000, weekend: 500000 }
  ]);
});

test('getCourtMatrix generates a 6x7 Excel-style matrix with 6 standard time blocks and 7 days', () => {
  const matrix = getCourtMatrix(court, []);
  assert.equal(matrix.length, 6);
  assert.equal(matrix.length, STANDARD_TIME_BLOCKS.length);

  for (const row of matrix) {
    assert.ok(row.time);
    assert.ok(row.label);
    assert.equal(Object.keys(row.days).length, 7);
    for (const day of WEEK_DAYS) {
      assert.ok(row.days[day.key]);
      assert.ok(typeof row.days[day.key].price === 'number');
    }
  }
});

test('getSlotPrice applies 25% automatic flash discount during weekday off-peak (09:00 - 16:00)', () => {
  const testCourt = { id: 'outdoor', price: 140000 };
  const mon = WEEK_DAYS.find(d => d.key === 'mon');
  const sat = WEEK_DAYS.find(d => d.key === 'sat');

  // Mon 10:00 -> 140,000 * 0.75 = 105,000
  const flashPrice = getSlotPrice(testCourt, [], mon, 10);
  assert.equal(flashPrice, 105000);

  // Sat 10:00 -> weekend, no flash discount
  const weekendPrice = getSlotPrice(testCourt, [], sat, 10);
  assert.equal(weekendPrice, 140000);
});
```

#### File: `tests/referee-only-api.mjs`
```javascript
import assert from 'node:assert/strict';
assert.equal(process.env.COURTLY_TEST_WRITE,'1','Use a disposable database');
const base=process.env.COURTLY_API_URL||'http://127.0.0.1:8091/api';
let checks=0;function check(condition,label){assert.ok(condition,label);console.log('PASS',++checks,label)}
class Client{
 cookies=new Map();
 async call(path,method='GET',body,expected=200){
  let headers={'Content-Type':'application/json'};
  if(method!=='GET'){const csrf=await this.call('/csrf');headers[csrf.headerName]=csrf.token}
  headers.Cookie=[...this.cookies].map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');this.cookies.set(k,v.join('='))}
  const content=await r.text();let data;try{data=JSON.parse(content)}catch{data=content}
  assert.equal(r.status,expected,path+': '+content);return data;
 }
}
const a=new Client();await a.call('/auth/login','POST',{email:'admin@gmail.com',password:'12345'});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+Number(process.env.COURTLY_TEST_DAY_OFFSET||43)*86400000));
let v=await a.call('/overview?date='+date);
check(v.products.length===0&&v.orders.every(o=>o.products.length===0),'fresh fixture has no product catalog or product charges');
const referee=v.staff.find(s=>s.type==='REFEREE');
await a.call('/catalog/staff-schedules','POST',{staff:referee.id,date,start:12,end:13.5});
const court=v.courts.find(c=>c.status==='ACTIVE');const slots=v.schedules.filter(s=>s.court===court.id&&s.hour>=12&&s.hour<13.5);
assert.equal(slots.length,3);
const assignments=slots.map(s=>({scheduleId:s.id,staffId:referee.id}));
const options=await a.call('/booking/options','POST',{scheduleIds:slots.map(s=>s.id)});
check(options.staffSlots.every(s=>s.staff.every(p=>v.staff.find(x=>x.id===p.id).type==='REFEREE')),'booking offers only referees');
const made=await a.call('/orders','POST',{name:'Referee regression',phone:'0900000001',scheduleIds:slots.map(s=>s.id),assignments,requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);let o=v.orders.find(o=>o.id===made.id);
check(o.staff.length===3&&o.staff.reduce((n,s)=>n+s.hours,0)===1.5,'90-minute booking assigns three half-hour referee slots');
check(o.total===slots.reduce((n,s)=>n+s.price,0)+referee.rate*1.5,'total contains only court and actual referee time');
for(const path of ['/catalog/drinks','/catalog/rentals'])await a.call(path,'POST',{name:'Retired',price:10000,stock:5,status:'ACTIVE'},400);
for(const action of ['products','services'])await a.call(`/orders/${o.id}/${action}`,'POST',{requestId:crypto.randomUUID(),type:'DRINK',productId:crypto.randomUUID(),quantity:1,rentals:[]},400);
await a.call(`/orders/${o.id}/services`,'GET',undefined,405);
await a.call(`/orders/${o.id}/products/${crypto.randomUUID()}/return`,'POST',{},404);
check(true,'retired catalog, sales, rental and return endpoints reject writes');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:assignments.slice(0,1),requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===1&&o.total===slots.reduce((n,s)=>n+s.price,0)+referee.rate*.5,'admin can change referee coverage without adding other services');
const coach=await a.call('/catalog/staff','POST',{name:'Non-billable test staff',type:'COACH',phone:'0900000099',rate:100000,status:'ACTIVE'});
await a.call('/catalog/staff-schedules','POST',{staff:coach.id,date,start:12,end:13.5});
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[{scheduleId:slots[0].id,staffId:coach.id}],requestId:crypto.randomUUID()},400);
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===1&&o.staff[0].staffId===referee.id,'non-referee assignment rejected and previous assignment retained atomically');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:[],requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.staff.length===0&&o.total===slots.reduce((n,s)=>n+s.price,0),'removing all referees releases their time and recalculates the order');
await a.call(`/orders/${o.id}/staff`,'POST',{assignments:assignments.slice(0,1),requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
const receipt=await a.call('/payments','POST',{orderId:o.id,method:'CASH',amount:o.total,transactionCode:'referee-'+crypto.randomUUID()});
await a.call(`/orders/${o.id}/check-in`,'POST',{reason:'Isolated regression test'});
await a.call(`/orders/${o.id}/check-out`,'POST',{});
await a.call(`/orders/${o.id}/invoice`,'POST',{});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.status==='COMPLETED'&&o.paid===o.total&&o.products.length===0&&o.invoice,'collect, check-in, check-out and invoice work with referee-only order');
await a.call(`/payments/${receipt.id}/refunds`,'POST',{amount:10000,reason:'Isolated refund test',requestId:crypto.randomUUID()});
v=await a.call('/overview?date='+date);o=v.orders.find(x=>x.id===o.id);
check(o.finance.due===10000,'refund still reconciles order balance');
console.log('Completed',checks,'referee-only checks');
```

#### File: `tests/render-pages.mjs`
```javascript
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../frontend',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const React=require('react'),{renderToString}=require('react-dom/server');
const data=JSON.parse(await readFile(new URL('./fixtures/overview.json',import.meta.url),'utf8'));
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
globalThis.location=new URL('http://localhost/app#calendar');
try{
 const {CourtlyContext}=await server.ssrLoadModule('/src/context.js');
 const value={data,user:data.viewer,isAdmin:true,date:new Date().toISOString().slice(0,10),setDate(){},navigate(){},show(){},notify(){},mutate(){},refresh(){}};
 const names=['Calendar','Orders','Payments','Courts','Products','Staff','Accounts','Tournaments','Reports','System','Notifications','Operations','Profile','Customer','Public','Information','Membership','MyMembership','MembershipAdmin','ContentAdmin'];
 for(const name of names){const {default:Page}=await server.ssrLoadModule(`/src/pages/${name}Page.jsx`.replace('/MyMembershipPage.jsx','/MyMembership.jsx'));const props=name==='Information'?{path:'/gioi-thieu'}:name==='Customer'?{route:'calendar'}:{};const html=renderToString(React.createElement(CourtlyContext.Provider,{value},React.createElement(Page,props)));assert(html.length>0);assert(!html.includes('NaN'));console.log('PASS render',name);}
 const {AuthenticatedApp}=await server.ssrLoadModule('/src/App.jsx');
 const admin=renderToString(React.createElement(AuthenticatedApp,{session:{user:data.viewer},onLogout(){}}));assert(admin.includes('class="sidebar'));
 const customer=renderToString(React.createElement(AuthenticatedApp,{session:{user:{...data.viewer,role:'CUSTOMER'}},onLogout(){}}));assert(customer.includes('customer-workspace'));assert(!customer.includes('class="sidebar'));
 const {PublicHeader}=await server.ssrLoadModule('/src/components/PublicLayout.jsx');
 const {Header:GuestHeader}=await server.ssrLoadModule('/src/guest/Layout.jsx');
 const {GuestContext}=await server.ssrLoadModule('/src/guest/context.jsx');
 const publicHeader=renderToString(React.createElement(PublicHeader,{onLogin(){}}));
 const guestHeader=renderToString(React.createElement(GuestContext.Provider,{value:{t:s=>s,lang:'vi',setLang(){},navigate(){},route:'about',login(){},logout(){}}},React.createElement(GuestHeader)));
 for(const [name,html]of [['public',publicHeader],['guest',guestHeader]]){
  for(const label of ['Bảng giá','Giải đấu','Hội viên'])assert(html.includes(label),`${name} header includes ${label}`);
 }
 assert(publicHeader.includes('href="/bang-gia"')&&publicHeader.includes('href="/giai-dau"')&&publicHeader.includes('href="/membership"'));
 console.log('PASS pricing, tournaments and membership in both public headers.');
 console.log('PASS admin shell retained; customer shell independent.');
}finally{await server.close();}
```

#### File: `tests/security-config.test.mjs`
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.COURTLY_API_URL || 'http://localhost:8081/api';

class Client {
  cookies = new Map();
  csrf = null;

  async call(path, method = 'GET', body, expected = 200) {
    if (!['GET', 'HEAD'].includes(method) && !this.csrf) {
      const r = await this.call('/csrf');
      this.csrf = r;
    }
    const r = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: new URL(BASE).origin,
        cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(this.csrf ? { [this.csrf.headerName]: this.csrf.token } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const raw of r.headers.getSetCookie()) {
      const pair = raw.split(';')[0], idx = pair.indexOf('=');
      this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
    if (expected !== null) {
      assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
    }
    return expected === null ? { status: r.status, body: data } : data;
  }
}

test('Spring Security authorization enforcement across roles', async () => {
  const anon = new Client();
  const customer = new Client();
  const staff = new Client();
  const admin = new Client();

  // 1. Unauthenticated requests MUST return 401
  await anon.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 401);
  await anon.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 401);
  await anon.call('/payments/cash-desk', 'GET', undefined, 401);
  await anon.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 401);

  // 2. Register a customer and login
  const custEmail = `cust-${randomUUID().slice(0, 8)}@example.com`;
  const reg = await customer.call('/auth/register', 'POST', {
    name: 'Customer Test',
    email: custEmail,
    password: 'CustomerPass!2026'
  });
  assert.equal(reg.user.role, 'CUSTOMER');

  // Customer calling admin-only endpoints MUST return 403 Forbidden
  await customer.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 403);
  await customer.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 403);
  await customer.call('/payments/cash-desk', 'GET', undefined, 403);
  await customer.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 403);
  await customer.call('/payments/' + randomUUID() + '/refunds', 'POST', { requestId: randomUUID() }, 403);

  // 3. Login as STAFF
  const staffLog = await staff.call('/auth/login', 'POST', {
    email: 'staff@gmail.com',
    password: '12345'
  });
  assert.equal(staffLog.user.role, 'STAFF');

  // Staff calling admin-only endpoints MUST return 403 Forbidden
  await staff.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 403);
  await staff.call('/catalog/courts', 'POST', { name: 'Unauthorized' }, 403);
  await staff.call('/tournaments/' + randomUUID() + '/draw', 'POST', {}, 403);
  await staff.call('/payments/' + randomUUID() + '/refunds', 'POST', { requestId: randomUUID() }, 403);

  // BUT Staff calling cashier desk MUST return 200 OK
  const cashDesk = await staff.call('/payments/cash-desk', 'GET');
  assert(Array.isArray(cashDesk));

  // 4. Login as ADMIN
  const adminLog = await admin.call('/auth/login', 'POST', {
    email: 'admin@gmail.com',
    password: '12345'
  });
  assert.equal(adminLog.user.role, 'ADMIN');

  // Admin calling admin endpoints MUST succeed (200 OK)
  await admin.call('/settings', 'PUT', { holdMinutes: 15, depositPercent: 30, cancelRefundPercent: 100 }, 200);

  const adminCashDesk = await admin.call('/payments/cash-desk', 'GET');
  assert(Array.isArray(adminCashDesk));

  const overview = await admin.call('/overview?date=2026-10-30', 'GET');
  assert.equal(overview.viewer.role, 'ADMIN');
});
```

#### File: `tests/smoke-api.mjs`
```javascript
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runSmoke(base=process.env.COURTLY_API_URL||'http://localhost:8080/api'){
 let requests=0;const results=[];
 class Client {
  cookies=new Map();csrf=null;
  async call(path,method='GET',body,expected=200){
   if(!['GET','HEAD'].includes(method)&&!this.csrf){const r=await this.call('/csrf');this.csrf=r;}
   const r=await fetch(base+path,{method,headers:{'content-type':'application/json',origin:new URL(base).origin,cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(this.csrf?{[this.csrf.headerName]:this.csrf.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});requests++;
   for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1));}
   const text=await r.text();let data;try{data=text?JSON.parse(text):{};}catch{data={raw:text.slice(0,300)};}
   if(expected!==null)assert.equal(r.status,expected,`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
   return expected===null?{status:r.status,body:data}:data;
  }
 }
 const anon=new Client(),admin=new Client(),alice=new Client(),bob=new Client();
 const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),suffix=randomUUID().slice(0,8),password='CourtlyCustomer!2026';
 const emailA=`alice-${suffix}@example.com`,emailB=`bob-${suffix}@example.com`;
 assert.equal((await anon.call('/auth/session')).authenticated,false);
 const pub=await anon.call('/public/overview?date='+date);assert.equal(pub.accounts.length,0);assert.equal(pub.orders.length,0);assert(pub.courts.length>=2);results.push('Public overview does not expose private records');
 await anon.call('/overview?date='+date,'GET',undefined,401);
 await admin.call('/auth/login','POST',{email:process.env.ADMIN_EMAIL||'admin@courtly.local',password:process.env.ADMIN_PASSWORD||'CourtlyLocal!2026'});
 const sa=await alice.call('/auth/register','POST',{name:'Alice Test',email:emailA,password});const sb=await bob.call('/auth/register','POST',{name:'Bob Test',email:emailB,password});assert.equal(sa.user.role,'CUSTOMER');
 await alice.call('/catalog/courts','POST',{name:'Unauthorized'},403);results.push('Registration, cookie sessions, role enforcement');
 const raw=await admin.call('/overview?date='+date);assert(raw.viewer.role==='ADMIN');const c1=raw.courts.find(c=>c.status==='ACTIVE'),c2=raw.courts.find(c=>c.status==='ACTIVE'&&c.id!==c1.id),ref=raw.staff.find(s=>s.type==='REFEREE');
 if(!raw.staffSchedules?.some(s=>s.staff===ref.id)) await admin.call('/catalog/staff-schedules','POST',{staff:ref.id,date,start:6,end:23});
 const slot=(c,h)=>raw.schedules.find(s=>s.court===c.id&&s.hour===h).id;
 const selected=[slot(c1,18),slot(c1,18.5)],assignment={scheduleId:selected[1],staffId:ref.id};
 const opt=await alice.call('/booking/options','POST',{scheduleIds:selected});assert(opt.staffSlots[1].staff.find(s=>s.id===ref.id).available);
 const payload={requestId:randomUUID(),scheduleIds:selected,assignments:[assignment]};const order=await alice.call('/orders','POST',payload);assert.equal((await alice.call('/orders','POST',payload)).id,order.id);assert.equal((await alice.call('/orders','POST',{assignments:payload.assignments,scheduleIds:payload.scheduleIds,requestId:payload.requestId})).id,order.id);
 await alice.call('/orders','POST',{...payload,scheduleIds:[slot(c1,20)]},400);
 let snapshot=await alice.call('/overview?date='+date),o=snapshot.orders.find(o=>o.id===order.id);assert.equal(o.staff.length,1);assert.equal(o.staff[0].scheduleId,selected[1]);assert.equal(o.staff[0].hours,0.5);assert.equal(snapshot.accounts.length,1);assert.equal(snapshot.staff.length,0);assert.equal(o.total,o.slots.reduce((n,s)=>n+s.price,0)+ref.rate/2);
 await bob.call(`/orders/${order.id}/cancel`,'POST',{},403);await alice.call(`/orders/${order.id}/services`,'POST',{},403);
 const conflict=await bob.call('/orders','POST',{requestId:randomUUID(),scheduleIds:selected,assignments:[]},null);assert([400,409].includes(conflict.status));results.push('Continuous multi-slot booking, exact referee slot, idempotency, ownership, conflict');
 const receipt=await admin.call('/payments','POST',{orderId:order.id,amount:o.total,method:'CASH',transactionCode:'full-'+suffix});
 o=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===order.id);assert.equal(o.status,'CONFIRMED');assert.equal(o.finance.paymentStatus,'PAID');
 await admin.call(`/orders/${order.id}/invoice`,'POST',{});
 const move={requestId:randomUUID(),scheduleIds:[slot(c1,15)],assignments:[]};const preview=await alice.call(`/orders/${order.id}/preview`,'POST',move);assert(preview.reviewAmount>0);await alice.call(`/orders/${order.id}/schedule`,'PATCH',move);
 o=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===order.id);assert.equal(o.staff.length,0);assert(o.invoiceSnapshot);assert.equal(o.paid,o.invoiceSnapshot.total);assert(o.history.some(x=>x.type==='SCHEDULE'));
 const excess=o.paid-o.total;const refund={requestId:randomUUID(),amount:excess,reason:'Actual cash refund in test'};const refunded=await admin.call(`/payments/${receipt.id}/refunds`,'POST',refund);assert.equal((await admin.call(`/payments/${receipt.id}/refunds`,'POST',refund)).id,refunded.id);results.push('Verified receipts, cheaper atomic reschedule, preserved invoice, idempotent refund');
 await admin.call(`/orders/${order.id}/check-in`,'POST',{reason:'Test authorized early check-in'});await alice.call(`/orders/${order.id}/cancel`,'POST',{},400);await admin.call(`/orders/${order.id}/check-out`,'POST',{});
 const bo=await bob.call('/orders','POST',{requestId:randomUUID(),scheduleIds:[slot(c2,18),slot(c2,18.5),slot(c2,19),slot(c2,19.5)],assignments:[]});await admin.call(`/orders/${bo.id}/services`,'POST',{requestId:randomUUID(),rentals:[]},400);
 await admin.call(`/orders/${bo.id}/products`,'POST',{productId:randomUUID(),type:'DRINK',quantity:1},400);
 assert.equal((await bob.call('/overview?date='+date)).orders.find(o=>o.id===bo.id).products.length,0);results.push('Retired product and rental endpoints reject new services');
 const fb=await alice.call('/feedback','POST',{requestId:randomUUID(),rating:5,topic:'WEBSITE',message:'This is a private test feedback message.',publishConsent:false});await admin.call('/content/feedback/'+fb.id,'PATCH',{status:'PUBLISHED',reply:'Thanks'},400);
 const publicFb=await bob.call('/feedback','POST',{requestId:randomUUID(),rating:4,topic:'COURT',message:'This is a publishable test feedback message.',publishConsent:true});await admin.call('/content/feedback/'+publicFb.id,'PATCH',{status:'PUBLISHED',reply:'Thanks'});
 const publicContent=await anon.call('/public/content');assert(publicContent.feedback.some(f=>f.id===publicFb.id));assert(!publicContent.feedback.some(f=>f.id===fb.id));assert(!JSON.stringify(publicContent.feedback).includes(sa.user.accountId));
 const article=await admin.call('/content/articles','POST',{title:'Test news',excerpt:'Test excerpt',body:'Plain text article',category:'NEWS',status:'PUBLISHED',tournamentId:''});assert((await anon.call('/public/content')).articles.some(a=>a.id===article.id));results.push('Content publishing, own feedback, consent and private-data isolation');
 const draft=await admin.call('/content/articles','POST',{title:'Draft test',excerpt:'Draft excerpt',body:'Draft body',category:'NEWS',status:'DRAFT',tournamentId:''});await admin.call('/content/articles/'+draft.id,'PUT',{title:'Published draft',excerpt:'Published excerpt',body:'Published body',category:'NEWS',status:'PUBLISHED',tournamentId:''});assert((await anon.call('/public/content')).articles.find(a=>a.id===draft.id).publishedAt);
 const csrfDenied=await fetch(base+'/profile',{method:'PATCH',headers:{'content-type':'application/json',origin:new URL(base).origin,cookie:[...alice.cookies].map(([k,v])=>k+'='+v).join('; ')},body:JSON.stringify({name:'Forged',phone:''})});requests++;assert.equal(csrfDenied.status,403);
 const memberships=await alice.call('/overview?date='+date);assert(memberships.membershipPlans.length>=2);const plan=memberships.membershipPlans.find(p=>p.id==='club');
 const application=await alice.call('/membership/requests','POST',{requestId:randomUUID(),planId:plan.id});await alice.call(`/membership/requests/${application.id}/activate`,'POST',{requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'forged',collected:true},403);
 await admin.call(`/membership/requests/${application.id}/activate`,'POST',{requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'unverified-'+suffix,collected:false},400);
 const activation={requestId:randomUUID(),amount:plan.price,method:'CASH',transactionCode:'membership-'+suffix,collected:true};await admin.call(`/membership/requests/${application.id}/activate`,'POST',activation);await admin.call(`/membership/requests/${application.id}/activate`,'POST',activation);
 const memberView=await alice.call('/overview?date='+date);assert(memberView.memberships.some(m=>m.id===application.id&&m.status==='ACTIVE'));assert.equal(memberView.membershipPayments.length,1);assert.equal((await bob.call('/overview?date='+date)).memberships.length,0);
 const memberSlots=[slot(c1,20)];const memberQuote=await alice.call('/booking/options','POST',{scheduleIds:memberSlots});assert(memberQuote.courtQuote.discount>0);const mo=await alice.call('/orders','POST',{requestId:randomUUID(),scheduleIds:memberSlots,assignments:[]});const discounted=(await alice.call('/overview?date='+date)).orders.find(o=>o.id===mo.id);assert.equal(discounted.total,memberQuote.courtQuote.net);assert.equal(discounted.membershipBenefit.discount,memberQuote.courtQuote.discount);
 results.push('Membership registration, verified activation, exact-once receipt, private data and server discount');
 const tournament=await admin.call('/catalog/tournaments','POST',{name:'Test Singles '+suffix,format:'SINGLES',status:'OPEN',startDate:date,endDate:date,deadline:date,location:'Test Club',fee:0,max:2});
 await alice.call(`/tournaments/${tournament.id}/registrations`,'POST',{accountId:sb.user.accountId,name:'Forged',members:[]},403);
 const regA=await alice.call(`/guest/tournaments/${tournament.id}/register`,'POST',{name:'Alice',phone:'0900000001',adult:true,rules:true,requestId:randomUUID()});await bob.call(`/guest/tournaments/${tournament.id}/register`,'POST',{name:'Bob',phone:'0900000002',adult:true,rules:true,requestId:randomUUID()});await alice.call(`/tournaments/${tournament.id}/draw`,'POST',{},403);await admin.call(`/tournaments/${tournament.id}/draw`,'POST',{});
 const tourView=await admin.call('/overview?date='+date);const match=tourView.matches.find(m=>m.tournamentId===tournament.id);await admin.call(`/matches/${match.id}/schedule`,'PUT',{scheduleIds:[slot(c2,12)],staffId:ref.id});await admin.call(`/matches/${match.id}/result`,'POST',{winnerId:regA.id,score:'6-4, 6-3'});assert.equal((await admin.call('/overview?date='+date)).tournaments.find(t=>t.id===tournament.id).status,'FINISHED');results.push('Tournament registration ownership, bracket, court/referee allocation and result progression');
 const contenders=await Promise.all([alice,bob].map(client=>client.call('/orders','POST',{requestId:randomUUID(),scheduleIds:[slot(c2,21)],assignments:[]},null)));assert.deepEqual(contenders.map(r=>r.status).sort(),[200,400]);results.push('Concurrent bookings commit exactly one allocation');
 await alice.call('/profile','PATCH',{name:'Alice Updated',phone:'0900000000'});assert.equal((await alice.call('/auth/session')).user.name,'Alice Updated');await alice.call('/profile','PATCH',{name:'Alice',phone:'',role:'ADMIN'},400);
 const ticket=await admin.call('/auth/ticket','POST',{accountId:sa.user.accountId});const activated=new Client();await activated.call('/auth/activate','POST',{token:ticket.token,password:'NewCustomerPass!2026'});await new Client().call('/auth/activate','POST',{token:ticket.token,password:'AnotherPass!2026'},400);await alice.call('/overview?date='+date,'GET',undefined,401);results.push('Profile field allowlist, single-use reset ticket and old-session revocation');
 const state=await admin.call('/overview?date='+date);console.log('PASS',results.length,'groups,',requests,'HTTP requests');return {passed:true,requests,groups:results,state};
}
if(import.meta.url===new URL(process.argv[1]||'', 'file:').href)await runSmoke();
```

