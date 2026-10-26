import os
import glob

output_file = 'READMEALL.md'

header_text = """# COURTLY — TOÀN BỘ KIẾN TRÚC, MÃ NGUỒN VÀ DỮ LIỆU DỰ ÁN
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
  $$\\text{Occupancy (\\%)} = \\frac{\\sum \\text{Giờ chơi thực tế (Đơn đặt + Trận giải)}}{17 \\times \\text{Số ngày}} \\times 100$$
  * Slot 30 phút tính $0.5$ giờ, slot 60 phút tính $1.0$ giờ.

### 2.2 Quy tắc Đặt sân & Đặt nhiều sân trong 1 đơn (Multi-Court Booking)
1. **Liên tục trên từng sân (Per-court Continuity):** Trên mỗi sân, các slot khách chọn bắt buộc phải liên tục (không để lại lỗ thủng 30 phút giữa chừng).
2. **Đặt nhiều sân (Multi-court):** Tối đa 3 sân trong 1 đơn. Giữa các sân:
   * Có thể diễn ra **cùng giờ (song song)**: Phục vụ công ty, hội nhóm giao lưu đánh nhiều sân cùng lúc.
   * Có thể diễn ra **nối tiếp nhau (chuyển sân)**: Sân 1 kết thúc lúc 18:00, Sân 2 bắt đầu lúc 18:00 (khoảng cách $\\le 30$ phút).
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
        frontend_dirs = [
            ("7.1 Core App & Services", [
                "frontend/src/App.jsx",
                "frontend/src/context.jsx",
                "frontend/src/services/api.js",
                "frontend/src/utils/format.js"
            ]),
            ("7.2 Guest Portal (Giao diện khách)", [
                "frontend/src/guest/Portal.jsx",
                "frontend/src/guest/context.jsx",
                "frontend/src/guest/Booking.jsx",
                "frontend/src/guest/CourtMap.jsx",
                "frontend/src/guest/bookingTime.mjs",
                "frontend/src/guest/Auth.jsx",
                "frontend/src/guest/Overview.jsx",
                "frontend/src/guest/Pricing.jsx",
                "frontend/src/guest/Orders.jsx",
                "frontend/src/guest/Payments.jsx",
                "frontend/src/guest/Profile.jsx",
                "frontend/src/guest/Membership.jsx",
                "frontend/src/guest/Tournaments.jsx",
                "frontend/src/guest/CashDesk.jsx"
            ]),
            ("7.3 Components & Dialogs", glob.glob("frontend/src/components/*.jsx")),
            ("7.4 Admin & Operations Pages", glob.glob("frontend/src/pages/*.jsx"))
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
        out.write("## 8. BỘ TEST TỰ ĐỘNG & KIỂM THỬ TÍCH HỢP\n\n")

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
            out.write("### 8.2 Node.js Integration & Regression Tests\n\n")
            for tf in sorted(set(node_tests)):
                rel_path = tf.replace('\\', '/')
                out.write(f"#### File: `{rel_path}`\n```javascript\n")
                out.write(read_file_safely(tf).strip())
                out.write("\n```\n\n")

    print(f"Generated {output_file} successfully. File size: {os.path.getsize(output_file):,} bytes")

if __name__ == '__main__':
    generate()
