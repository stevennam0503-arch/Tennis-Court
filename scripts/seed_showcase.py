#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Courtly Tennis Club - Comprehensive Golden Showcase Data Seeder
Khởi tạo bộ dữ liệu trình diễn chuẩn (Golden Showcase Dataset) phủ kín 100% nghiệp vụ và mọi tab tính năng:
- Đang dùng sân hôm nay (Playing, Expiring Soon, Grace Period, Đã gia hạn)
- Khách sắp đến hôm nay (QR Check-in tự động) & ngày mai
- Giữ chỗ đếm ngược 5 phút (Holding)
- Đơn chưa thu tiền (Quá hạn 1-2 ngày, nợ phí sân & nợ phí trọng tài)
- Cần Check-out đóng ca (Đã thanh toán 100% nhưng chưa checkout)
- Đơn hủy & Hoàn tiền (Hoàn 100% trước 24h, Hoàn 50% từ 12-24h, Giữ 100% dưới 12h, Đã hoàn xong)
- Đơn định kỳ 4 tuần (Recurring)
- Giải đấu 4 cặp VĐV đã đóng phí (Winter Doubles Open)
- Hạng thành viên: Kiệt Grand Slam, Khoa Masters (sắp lên hạng), Trang Challenger (sinh nhật tháng này), Phương Mai Rookie
- Mã giảm giá Vouchers & Đánh giá Feedbacks (kích hoạt chấm đỏ thông báo)
"""

import sys
import time
import urllib.request
import urllib.error
import json
import http.cookiejar

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def wait_for_backend(url="http://localhost:8081/api/csrf", timeout_seconds=60):
    start = time.time()
    while time.time() - start < timeout_seconds:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    return True
        except urllib.error.HTTPError:
            return True
        except (urllib.error.URLError, ConnectionResetError, TimeoutError, OSError):
            time.sleep(2)
    return False

def main():
    print("=" * 70)
    print("🌱 ĐANG KHỞI TẠO BỘ DỮ LIỆU CHUẨN TRÌNH DIỄN (COMPREHENSIVE GOLDEN SHOWCASE)")
    print("=" * 70)

    # 1. Chờ backend sẵn sàng tối đa 60s
    if not wait_for_backend():
        print("Backend chưa sẵn sàng tại http://localhost:8081, kiểm tra `docker compose ps` / log backend")
        sys.exit(1)

    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    try:
        req = urllib.request.Request("http://localhost:8081/api/csrf")
        with opener.open(req) as resp:
            csrf = json.loads(resp.read().decode())

        # Sau lần reset đầu tiên mật khẩu admin là 123456; database mới khởi tạo dùng 12345
        login_success = False
        last_login_err = None
        for password in ("123456", "12345"):
            login_body = json.dumps({"email": "admin@gmail.com", "password": password}).encode()
            req = urllib.request.Request("http://localhost:8081/api/auth/login", data=login_body, headers={
                "Content-Type": "application/json",
                csrf["headerName"]: csrf["token"]
            })
            try:
                opener.open(req)
                login_success = True
                break
            except urllib.error.HTTPError as e:
                last_login_err = e

        if not login_success:
            err_body = ""
            if last_login_err:
                try:
                    err_body = last_login_err.read().decode('utf-8', errors='replace')
                except Exception:
                    pass
                print(f"❌ Đăng nhập admin thất bại: HTTP {last_login_err.code} - {err_body}")
            else:
                print("❌ Đăng nhập admin thất bại.")
            sys.exit(1)

        req = urllib.request.Request("http://localhost:8081/api/csrf")
        with opener.open(req) as resp:
            csrf = json.loads(resp.read().decode())

        req = urllib.request.Request("http://localhost:8081/api/catalog/demo-reset", data=b"{}", headers={
            "Content-Type": "application/json",
            csrf["headerName"]: csrf["token"]
        })
        with opener.open(req) as resp:
            res = json.loads(resp.read().decode())
            print(f"✅ {res.get('message', 'Đã đặt lại dữ liệu thành công!')}")
            print("\n📊 Danh sách dữ liệu mẫu đã sẵn sàng:")
            print("  1. Đang dùng sân hôm nay (4 đơn: Đang chơi, Sắp hết giờ, Ân hạn 15p, Đã gia hạn +30p)")
            print("  2. Khách sắp đến (2 đơn: Hôm nay 19:00 sẵn sàng QR Check-in, Ngày mai 08:00)")
            print("  3. Đang giữ chỗ (1 đơn Sân V01 đếm ngược 5:00 phút)")
            print("  4. Đơn chưa thu tiền (2 đơn: Nợ từ 2 ngày trước, Nợ hôm qua kèm trọng tài)")
            print("  5. Cần Check-out đóng ca (1 đơn đã trả đủ 100%, sẵn sàng bấm check-out)")
            print("  6. Đơn hủy & Hoàn tiền (4 đơn: Chờ hoàn 100% cọc, Hoàn 50%, Giữ 100%, Đã hoàn xong)")
            print("  7. Đơn định kỳ 4 tuần (Trần Hoàng Nam Plus)")
            print("  8. Hạng thành viên: Kiệt Grand Slam, Khoa Masters (sắp lên hạng), Trang Challenger (sinh nhật tháng này), Phương Mai Rookie")
            print("  9. Mã giảm giá (6 voucher: HE2026, WELCOME, CHAOBANMOI, COURTLY50K, VIP10, FLASH25)")
            print("  10. Đánh giá Feedback (2 đã duyệt, 1 chưa duyệt kích hoạt chấm đỏ trên icon)")
            print("  11. Giải đấu Courtly Winter Doubles Open với 4 cặp đấu đã nộp lệ phí đầy đủ")
            return

    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode('utf-8', errors='replace')
        except Exception:
            pass
        print(f"❌ Lỗi HTTP {e.code} ({e.reason}): {err_body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"❌ Lỗi kết nối tới backend: {e.reason}")
        print("Backend chưa sẵn sàng tại http://localhost:8081, kiểm tra `docker compose ps` / log backend")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Lỗi không xác định khi gọi API reset: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
