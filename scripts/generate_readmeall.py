import os
import glob

output_file = 'READMEALL.md'

header_text = """# COURTLY — TOÀN BỘ KIẾN TRÚC, MÃ NGUỒN VÀ DỮ LIỆU DỰ ÁN
> **Dành cho các AI / LLM & Lập trình viên:** Tài liệu này chứa toàn bộ bối cảnh hệ thống, kiến trúc tầng, mô hình nghiệp vụ, database schema (migrations V1-V8), API specification, cùng toàn bộ mã nguồn Backend (Java Spring Boot) và Frontend (React) của hệ thống Courtly Tennis Club.

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ](#1-tổng-quan-hệ-thống--công-nghệ)
2. [MÔ HÌNH NGHIỆP VỤ & QUY TẮC VẬN HÀNH](#2-mô-hình-nghiệp-vụ--quy-tắc-vận-hành)
   - 2.1 Quản lý Sân & Khung giờ chơi
   - 2.2 Quy tắc Đặt sân & Đặt nhiều sân trong 1 đơn (Multi-Court Booking)
   - 2.3 Hội viên (Membership)
   - 2.4 Dịch vụ Trọng tài (Referee)
   - 2.5 Thanh toán & Đối soát
   - 2.6 Bảng giá đồng nhất theo danh mục & Cơ chế quy đổi tự động
   - 2.7 Cấu trúc 4 Luồng nghiệp vụ chuẩn của hệ thống
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
8. [BỘ TEST TỰ ĐỘNG & KIỂM THỬ TÍCH HỢP 4 LUỒNG](#8-bộ-test-tự-động--kiểm-thử-tích-hợp-4-luồng)

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ

### 1.1 Mục đích dự án
Courtly là hệ thống quản lý và vận hành Câu lạc bộ Quần vợt (Tennis Club Management Platform) khép kín, bao gồm:
* **Giao diện Khách hàng (Guest Portal):** Tra cứu sân/giờ trống theo thời gian thực (real-time 30-phút), đặt sân đơn hoặc đặt nhiều sân trong 1 đơn (Multi-court booking), chọn trọng tài đi kèm, đăng ký hội viên (Membership Club/Plus), đăng ký giải đấu, thanh toán cọc tự động qua VietQR Napas 24/7, gửi phản hồi/đánh giá (Feedback) sau trận đấu.
* **Giao diện Quản trị & Vận hành (Staff / Cashier / Admin App):** Sơ đồ lịch sân (Calendar Matrix), quầy thu ngân tiền mặt (Cash Desk), đối soát chốt ca cuối ngày, báo cáo doanh thu & công suất sân thực tế, điều hành giải đấu (bốc thăm sơ đồ nhánh $2^n$), quản lý nhân sự trọng tài, kiểm duyệt & phản hồi feedback, và cấu hình chính sách CLB.

### 1.2 Tech Stack
* **Backend:** Java 17, Spring Boot 3.5.16, Spring MVC (RESTful JSON API), Spring Data JPA, Hibernate 6, Spring Security, BCrypt Password Encoder, Flyway Database Migration.
* **Database:** PostgreSQL 16 (24 Bảng quan hệ chuẩn hóa + Bảng tài liệu `app_documents` cho JSON snapshot và khóa phân tán).
* **Frontend:** React 19.3, Vite 8.3.3, Lucide Icons, Pure CSS Responsive Layout (Không phụ thuộc UI framework nặng).
* **Reverse Proxy & Edge:** Nginx Alpine (Reverse proxy `/api` tới backend, phục vụ React SPA, bảo vệ security headers, chặn giả mạo IP client).
* **Containerization:** Docker Compose đa container (`postgres`, `backend`, `frontend`).

---

## 2. MÔ HÌNH NGHIỆP VỤ & QUY TẮC VẬN HÀNH

### 2.1 Quản lý Sân & Khung giờ chơi
* CLB có các khu sân: **Khu A (Ngoài trời - A01-A04)**, **Khu B (Trong nhà - B01-B04)**, **Khu V (VIP Clubhouse - V01-V02)**.
* Khung giờ mở cửa: **06:00 – 23:00 mỗi ngày** (Tổng cộng 17 tiếng = 34 slot 30 phút mỗi sân).
* Slot lịch (`CourtSchedule`) được tự động sinh theo ngày với bước 30 phút. Mỗi slot có giá động phụ thuộc vào loại ngày (`WEEKDAY`/`WEEKEND`) và khung giờ.

### 2.2 Quy tắc Đặt sân & Đặt nhiều sân trong 1 đơn (Multi-Court Booking)
1. **Liên tục trên từng sân (Per-court Continuity):** Trên mỗi sân, các slot khách chọn bắt buộc phải liên tục (không để lại lỗ thủng 30 phút giữa chừng).
2. **Đặt nhiều sân (Multi-court):** Tối đa 3 sân trong 1 đơn. Giữa các sân có thể song song hoặc nối tiếp (khoảng cách $\\le 30$ phút). Chặn các khung giờ rời rạc cách nhau $> 30$ phút.
3. **Cọc & Giữ chỗ:**
   * Giữ chỗ tự động trong $15$ phút (`holdMinutes`). Hết 15 phút không thanh toán cọc, Scheduler (`expireHolds`) tự động nhả slot về `AVAILABLE`.
   * Cọc tiêu chuẩn 30% tiền sân (có thể cấu hình).
4. **Bảo vệ Xung đột Đặt chỗ (Concurrency Locking):** Backend dùng Pessimistic Write Lock (`findForUpdate`) trên từng slot. Hai khách bấm đặt cùng lúc, khách 1 thành công thì khách 2 bị từ chối ngay lập tức với HTTP 400.

### 2.3 Hội viên (Membership)
* Gói hội viên: **Club Member** (249.000đ/30 ngày) và **Plus Member** (499.000đ/30 ngày).
* Quyền lợi: Giảm giá sân thường (10% - 15%) và sân VIP (5% - 10%), ưu tiên đặt trước 14 đến 21 ngày, đổi lịch linh hoạt.

### 2.4 Dịch vụ Trọng tài (Referee)
* Khách có thể chọn thuê trọng tài theo từng slot sân cụ thể. Hệ thống đảm bảo 1 trọng tài không thể bị trùng ca trên 2 sân cùng giờ.

### 2.5 Thanh toán & Đối soát
* **Tại quầy thu ngân (`/quay-thu` & modal thu tiền):** Chỉ ghi nhận tiền mặt (`CASH`), thủ quỹ kiểm đếm tiền trước khi bấm xác nhận.
* **Chuyển khoản VietQR:** Sinh mã tham chiếu duy nhất (`CT` + 16 ký tự hex), mã QR chuẩn EMV Co, webhook tự động xác nhận đơn khi đủ tiền cọc.
* **Đối soát:** Tổng giá trị đơn = Tiền cọc online + Tiền mặt thu tại quầy. Đối soát công nợ bằng 0 khi check-out hoàn tất.

### 2.6 Bảng giá đồng nhất theo danh mục & Cơ chế quy đổi tự động
Nhằm đảm bảo tính thực tế và minh bạch trong kinh doanh:
* **Mỗi danh mục sân có một mức giá cơ sở (`base_price`) duy nhất:**
  - Sân Ngoài Trời (A01–A04): **160.000đ/giờ**
  - Sân Mái Che Trong Nhà (B01–B04): **240.000đ/giờ**
  - Sân VIP Clubhouse (V01–V02): **400.000đ/giờ**
* **Thuật toán sinh ma trận giá theo giờ & ngày:**
  - **Giờ vàng ban ngày (09:00 – 16:00, Thứ 2 - Thứ 6):** Giảm tự động **-25%** (Flash Sale giờ thấp điểm, kích cầu sử dụng sân). Ví dụ sân B giảm từ 240.000đ còn 180.000đ/h.
  - **Chiều mát (16:00 – 18:00):** Tăng **+25%** theo nhu cầu tan tầm.
  - **Cao điểm đèn LED (18:00 – 21:00):** Phụ thu dàn đèn 500 Lux (+40%).
  - **Cuối tuần (Thứ 7 & Chủ Nhật):** Phụ thu ngày nghỉ (+25% ban ngày, +50% ban đêm).
  - **Đầu sáng (06:00 – 09:00) & Đêm muộn (21:00 – 23:00):** Đúng 100% giá cơ sở (Standard).

### 2.7 Cấu trúc 4 Luồng nghiệp vụ chuẩn của hệ thống
Hệ thống vận hành theo chu trình khép kín 4 luồng:
1. **LUỒNG 1 — Quản lý và mở bán dịch vụ (Admin):** Khởi tạo sân, thiết lập bảng giá, cấu hình gói hội viên, quản lý bảo trì slot sân. Thao tác demo: Admin khóa bảo trì sân $\rightarrow$ khách vãng lai thấy ngay trạng thái khóa trên lịch.
2. **LUỒNG 2 — Tư vấn, đặt sân và thanh toán (Customer):** Khách tra cứu lịch trống, nhận báo giá kèm chiết khấu hội viên, chọn slot và giữ chỗ (bảo vệ chống trùng lịch với Pessimistic Locking), thanh toán cọc 30% bằng VietQR tự động.
3. **LUỒNG 3 — Vận hành dịch vụ và chăm sóc sau bán (Staff & Customer):** Lễ tân check-in khách vào sân, thu 70% tiền còn lại tại quầy, check-out đóng đơn khi hoàn tất, khách gửi Feedback 5 sao, Quản trị viên duyệt và phản hồi cảm ơn.
4. **LUỒNG 4 — Đối soát và phân tích kinh doanh (Admin):** Đối soát doanh thu (Cọc online + Thu quầy = Tổng đơn), báo cáo công suất khai thác sân, quản lý quầy thu ngân (Cash Desk) và lưu vết kiểm toán (Audit Trail).

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
"""

def read_file_safely(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading {filepath}: {e}"

def generate():
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(header_text)

        # 4. DATABASE SCHEMA & FLYWAY MIGRATIONS
        out.write("\n## 4. DATABASE SCHEMA & FLYWAY MIGRATIONS\n\n")
        out.write("### 4.1 Danh sách bảng quan hệ\n")
        out.write("""
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
\n""")

        out.write("### 4.2 Chi tiết các migration Flyway (V1 - V8)\n\n")
        migration_files = sorted(glob.glob('backend/src/main/resources/db/migration/*.sql'))
        for mf in migration_files:
            fname = os.path.basename(mf)
            out.write(f"#### `{fname}`\n```sql\n")
            out.write(read_file_safely(mf).strip())
            out.write("\n```\n\n")

        # 5. CONFIGURATION FILES
        out.write("## 5. CẤU HÌNH HỆ THỐNG & DEPLOYMENT\n\n")
        configs = [
            ('backend/src/main/resources/application.yml', 'yaml'),
            ('frontend/nginx.conf', 'nginx'),
            ('compose.yaml', 'yaml')
        ]
        for cfg, lang in configs:
            if os.path.exists(cfg):
                out.write(f"### `{cfg}`\n```{lang}\n")
                out.write(read_file_safely(cfg).strip())
                out.write("\n```\n\n")

        # 6. BACKEND SOURCE CODE
        out.write("## 6. TOÀN BỘ MÃ NGUỒN BACKEND (JAVA SPRING BOOT)\n\n")
        backend_dirs = [
            ("6.1 Controllers", "backend/src/main/java/com/courtly/controller/*.java"),
            ("6.2 Services", "backend/src/main/java/com/courtly/service/*.java"),
            ("6.3 Entities & JPA Models", "backend/src/main/java/com/courtly/entity/*.java"),
            ("6.4 Repositories", "backend/src/main/java/com/courtly/repository/*.java"),
            ("6.5 DTOs & Payloads", "backend/src/main/java/com/courtly/dto/**/*.java"),
            ("6.6 Security & Configs", "backend/src/main/java/com/courtly/config/*.java"),
            ("6.7 Utils & Exceptions", "backend/src/main/java/com/courtly/exception/*.java"),
            ("6.8 Utils", "backend/src/main/java/com/courtly/util/*.java")
        ]
        for section_title, pattern in backend_dirs:
            out.write(f"### {section_title}\n\n")
            files = sorted(glob.glob(pattern, recursive=True))
            for fpath in files:
                rel_path = fpath.replace('\\', '/')
                out.write(f"#### File: `{rel_path}`\n```java\n")
                out.write(read_file_safely(fpath).strip())
                out.write("\n```\n\n")

        # 7. FRONTEND SOURCE CODE
        out.write("## 7. TOÀN BỘ MÃ NGUỒN FRONTEND (REACT 19 + VITE)\n\n")
        guest_files = sorted(set(glob.glob("frontend/src/guest/*.jsx") + glob.glob("frontend/src/guest/*.mjs") + glob.glob("frontend/src/guest/*.js")))
        frontend_dirs = [
            ("7.1 Core App & Services", [
                "frontend/src/App.jsx",
                "frontend/src/context.jsx",
                "frontend/src/services/api.js",
                "frontend/src/utils/format.js"
            ]),
            ("7.2 Guest Portal (Giao diện khách đặt sân online & Bảng giá, Feedback)", guest_files),
            ("7.3 Components & Dialogs", sorted(glob.glob("frontend/src/components/*.jsx"))),
            ("7.4 Admin & Operations Pages", sorted(glob.glob("frontend/src/pages/*.jsx")))
        ]
        for section_title, files in frontend_dirs:
            out.write(f"### {section_title}\n\n")
            for fpath in sorted(files):
                if os.path.exists(fpath):
                    rel_path = fpath.replace('\\', '/')
                    ext = 'javascript' if rel_path.endswith(('.js', '.mjs')) else 'jsx'
                    out.write(f"#### File: `{rel_path}`\n```{ext}\n")
                    out.write(read_file_safely(fpath).strip())
                    out.write("\n```\n\n")

        # 8. TEST SUITE
        out.write("## 8. BỘ TEST TỰ ĐỘNG & KIỂM THỬ TÍCH HỢP 4 LUỒNG\n\n")

        # 8.1 Backend Unit & Integration Tests (JUnit)
        backend_tests = glob.glob("backend/src/test/java/**/*.java", recursive=True)
        if backend_tests:
            out.write("### 8.1 Backend JUnit Tests\n\n")
            for tf in sorted(backend_tests):
                rel_path = tf.replace('\\', '/')
                out.write(f"#### File: `{rel_path}`\n```java\n")
                out.write(read_file_safely(tf).strip())
                out.write("\n```\n\n")

        # 8.2 Node.js Integration & Regression Tests
        node_tests = glob.glob("tests/*.mjs") + glob.glob("tests/*.js")
        if node_tests:
            out.write("### 8.2 Node.js Integration & Regression Tests (Bao gồm Kiểm thử 4 Luồng nghiệp vụ)\n\n")
            for tf in sorted(set(node_tests)):
                rel_path = tf.replace('\\', '/')
                out.write(f"#### File: `{rel_path}`\n```javascript\n")
                out.write(read_file_safely(tf).strip())
                out.write("\n```\n\n")

    print(f"Generated {output_file} successfully. File size: {os.path.getsize(output_file):,} bytes")

if __name__ == '__main__':
    generate()
