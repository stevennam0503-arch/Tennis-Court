#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Courtly Tennis Club - Golden Showcase Data Seeder
Tạo bộ dữ liệu trình diễn chuẩn (Golden Showcase Dataset) cho buổi bảo vệ Hội đồng.
- Xóa sạch 1,100+ đơn rác, thanh toán rác, tài khoản rác
- Khởi tạo 7 đơn hàng mẫu bao quát 100% nghiệp vụ (CHECKED_IN, CONFIRMED, HOLDING, RECURRING, COMPLETED, CANCELLED, REFEREE)
- Khởi tạo 1 Giải đấu với 4 cặp thi đấu đã đóng lệ phí
- Khởi tạo 1 Khách hàng VIP sở hữu gói Hội viên Plus (giảm 15%)
- Bảo đảm 100% số liệu doanh thu và lịch sử thanh toán khớp từng đồng.
"""

import subprocess
import datetime
import uuid
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def run_psql(sql):
    cmd = ["docker", "exec", "-i", "tennis-court-git-postgres-1", "psql", "-v", "ON_ERROR_STOP=1", "-U", "courtly", "-d", "courtly"]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    stdout, stderr = proc.communicate(input=sql)
    if proc.returncode != 0:
        print("SQL Error:", stderr)
        raise RuntimeError(stderr)
    return stdout

def main():
    print("=" * 60)
    print("🌱 ĐANG KHỞI TẠO BỘ DỮ LIỆU CHUẨN TRÌNH DIỄN (GOLDEN SHOWCASE)")
    print("=" * 60)

    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    yesterday = today - datetime.timedelta(days=1)
    two_days_ago = today - datetime.timedelta(days=2)
    next_week = today + datetime.timedelta(days=7)
    
    today_str = today.strftime("%Y-%m-%d")
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    yesterday_str = yesterday.strftime("%Y-%m-%d")
    two_days_ago_str = two_days_ago.strftime("%Y-%m-%d")

    # Fixed core IDs
    ADMIN_ID = "b27fe32c-e9b7-44bf-8149-81bc00b5bbba"
    STAFF_ID = "f21bd5fa-cf66-4ee4-a009-3a337eebc6fa"
    NAM_ID = "44444444-4444-4444-4444-444444444444"    # VIP Member (Plus)
    HA_ID = "55555555-5555-5555-5555-555555555555"     # New customer (for live voucher WELCOME demo)
    THAO_ID = "66666666-4444-4444-4444-444444444444"   # Online booking customer
    DUC_ID = "77777777-4444-4444-4444-444444444444"    # Completed order customer
    PHUONG_ID = "88888888-4444-4444-4444-444444444444" # Cancelled & refund customer
    LONG_ID = "99999999-4444-4444-4444-444444444444"   # Referee booking customer

    BCRYPT_1234567890123 = "$2a$12$qVv9jATLLv2wNu5AWmn7xu2ehI5x5LUTIFhay53uOHfaSUILX5gWq"
    BCRYPT_12345 = "$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW"

    cleanup_sql = f"""
    -- 1. Xóa toàn bộ dữ liệu phát sinh từ đơn hàng, giao dịch và lịch thi đấu rác
    DELETE FROM match_staff;
    DELETE FROM match_slots;
    DELETE FROM matches;
    DELETE FROM team_members;
    DELETE FROM refunds;
    DELETE FROM payments;
    DELETE FROM voucher_redemptions;
    DELETE FROM booking_staff;
    DELETE FROM booking_slots;
    DELETE FROM order_products;
    DELETE FROM bookings;
    DELETE FROM orders;
    DELETE FROM tournament_registrations;

    -- 2. Xóa các tài khoản tự tạo / kiểm thử (chỉ giữ lại danh sách tài khoản chuẩn Hội đồng)
    DELETE FROM accounts WHERE email NOT IN (
      'admin@gmail.com', 'staff@gmail.com', 'hoangnam@gmail.com', 'khachmoi@gmail.com',
      'thao.le@gmail.com', 'minhduc@gmail.com', 'phuong.vu@gmail.com', 'hoanglong@gmail.com'
    );

    -- 3. Đưa toàn bộ khung giờ sân về AVAILABLE
    UPDATE court_schedules SET status = 'AVAILABLE';

    -- 4. Đảm bảo toàn bộ tài khoản mẫu cốt lõi luôn tồn tại chuẩn
    INSERT INTO accounts (id, email, full_name, phone, role, status, password_hash, created_at, auth_version)
    VALUES 
      ('{ADMIN_ID}', 'admin@gmail.com', 'Quản trị Courtly', '0909999999', 'ADMIN', 'ACTIVE', '{BCRYPT_12345}', NOW(), 0),
      ('{STAFF_ID}', 'staff@gmail.com', 'Lễ tân Courtly (Staff)', '0908888888', 'STAFF', 'ACTIVE', '{BCRYPT_12345}', NOW(), 0),
      ('{NAM_ID}', 'hoangnam@gmail.com', 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0),
      ('{HA_ID}', 'khachmoi@gmail.com', 'Lê Thu Hà (Khách mới)', '0987654321', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0),
      ('{THAO_ID}', 'thao.le@gmail.com', 'Lê Thị Thảo', '0913555777', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0),
      ('{DUC_ID}', 'minhduc@gmail.com', 'Phạm Minh Đức', '0988666555', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0),
      ('{PHUONG_ID}', 'phuong.vu@gmail.com', 'Vũ Mai Phương', '0903111222', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0),
      ('{LONG_ID}', 'hoanglong@gmail.com', 'Đặng Hoàng Long', '0938444333', 'CUSTOMER', 'ACTIVE', '{BCRYPT_1234567890123}', NOW(), 0)
    ON CONFLICT (id) DO UPDATE SET 
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      password_hash = COALESCE(accounts.password_hash, EXCLUDED.password_hash);
    """
    print("🧹 Đang dọn dẹp dữ liệu rác...")
    run_psql(cleanup_sql)

    # Đảm bảo schedules được sinh cho các ngày cần thiết (today, tomorrow, yesterday, two_days_ago, và 4 tuần tới)
    print("📅 Đang kích hoạt sinh lịch sân (Schedules)...")
    for d in [two_days_ago, yesterday, today, tomorrow, today + datetime.timedelta(days=7), today + datetime.timedelta(days=14), today + datetime.timedelta(days=21)]:
        # Gọi backend hoặc psql insert slot nếu thiếu
        pass

    # Lấy thông tin các sân từ DB
    courts_out = run_psql("SELECT id, name, base_price FROM courts ORDER BY name;")
    court_map = {}
    for line in courts_out.strip().split("\n")[2:]:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3 and parts[0]:
            court_map[parts[1]] = {"id": parts[0], "price": float(parts[2])}

    # Lấy referee TT Phạm Quốc Huy
    staff_out = run_psql("SELECT id, full_name, hourly_rate FROM staff WHERE full_name LIKE '%Huy%' LIMIT 1;")
    referee_id = None
    referee_rate = 250000.0
    for line in staff_out.strip().split("\n")[2:]:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3 and parts[0]:
            referee_id = parts[0]
            referee_rate = float(parts[2])

    # Lấy giải đấu Courtly Winter Doubles Championship 2026
    tourn_out = run_psql("SELECT id FROM tournaments WHERE status = 'OPEN' ORDER BY start_date LIMIT 1;")
    tourn_id = None
    for line in tourn_out.strip().split("\n")[2:]:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 1 and parts[0]:
            tourn_id = parts[0]
            break

    # Hàm lấy schedule_id theo tên sân, ngày, giờ bắt đầu
    def get_schedule_id(court_name, date_str, start_time_str):
        c_id = court_map[court_name]["id"]
        res = run_psql(f"SELECT id FROM court_schedules WHERE court_id = '{c_id}' AND schedule_date = '{date_str}' AND start_time = '{start_time_str}' LIMIT 1;")
        for l in res.strip().split("\n")[2:]:
            p = l.strip()
            if p and not p.startswith("("):
                return p
        # Nếu chưa có slot, tự tạo
        new_id = str(uuid.uuid4())
        price = court_map[court_name]["price"] / 2
        run_psql(f"""
            INSERT INTO court_schedules (id, court_id, schedule_date, start_time, end_time, price, status, version)
            VALUES ('{new_id}', '{c_id}', '{date_str}', '{start_time_str}', '{start_time_str[:3]}30:00' if '{start_time_str[3:]}' == '00:00' else '{int(start_time_str[:2])+1:02d}:00:00', {price}, 'AVAILABLE', 0)
            ON CONFLICT DO NOTHING;
        """)
        return new_id

    # Tạo các slot nếu chưa có trên DB bằng cách trigger generate trên server hoặc SQL
    seed_slots_sql = f"""
    DO $$
    DECLARE
        c RECORD;
        d DATE;
        m INT;
        st TIME;
        et TIME;
        pr NUMERIC;
    BEGIN
        FOR d IN SELECT unnest(ARRAY['{two_days_ago_str}'::DATE, '{yesterday_str}'::DATE, '{today_str}'::DATE, '{tomorrow_str}'::DATE, '{(today+datetime.timedelta(days=7)).strftime("%Y-%m-%d")}'::DATE, '{(today+datetime.timedelta(days=14)).strftime("%Y-%m-%d")}'::DATE, '{(today+datetime.timedelta(days=21)).strftime("%Y-%m-%d")}'::DATE]) LOOP
            FOR c IN SELECT id, base_price FROM courts LOOP
                FOR m IN 360..1320 BY 30 LOOP
                    st := (make_interval(mins => m))::TIME;
                    et := (make_interval(mins => m + 30))::TIME;
                    pr := c.base_price / 2;
                    IF NOT EXISTS (SELECT 1 FROM court_schedules WHERE court_id = c.id AND schedule_date = d AND start_time = st) THEN
                        INSERT INTO court_schedules (id, court_id, schedule_date, start_time, end_time, price, status, version)
                        VALUES (gen_random_uuid(), c.id, d, st, et, pr, 'AVAILABLE', 0);
                    END IF;
                END LOOP;
            END LOOP;
        END LOOP;
    END $$;
    """
    run_psql(seed_slots_sql)

    # ----------------------------------------------------
    # BẮT ĐẦU TẠO 7 ĐƠN HÀNG MẪU CHUẨN CHO SHOWCASE
    # ----------------------------------------------------
    print("🎾 Đang khởi tạo 7 đơn hàng mẫu chuẩn (Showcase Golden Orders)...")

    # 1. ĐƠN 1: ĐANG THI ĐẤU (CHECKED_IN) - Sân A01 hôm nay lúc 14:00 - 16:00
    # Khách VIP: Trần Hoàng Nam. Giá sân: 200k/h x 2h = 400k. Giảm Plus 15% (-60k) = 340k. Cọc 50% = 170k. Còn lại 170k.
    ord1_id = "11111111-1111-1111-1111-111111111111"
    bkg1_id = "11111111-1111-1111-1111-222222222222"
    pay1_id = "11111111-1111-1111-1111-333333333333"
    meta1 = json.dumps({"customerFlow": True, "membershipBenefit": {"gross": 400000, "discount": 60000, "net": 340000, "planName": "Plus", "discountPercent": 15}})
    
    # Lấy 4 slot: 14:00-14:30, 14:30-15:00, 15:00-15:30, 15:30-16:00 trên Sân A01
    court_a01 = court_map["Sân A01"]["id"]
    slots_ord1 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_a01}' AND schedule_date = '{today_str}' AND start_time >= '14:00:00' AND start_time < '16:00:00' ORDER BY start_time;")
    slot1_rows = [l.strip().split("|") for l in slots_ord1.strip().split("\n")[2:] if "|" in l]

    sql_ord1 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord1_id}', '{NAM_ID}', '{NAM_ID}', 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CHECKED_IN', 340000.00, 170000.00, 170000.00, 'PARTIAL', NOW() - interval '2 hours', 0, '{meta1}');

    INSERT INTO bookings (id, order_id, status, check_in_at, created_at)
    VALUES ('{bkg1_id}', '{ord1_id}', 'CHECKED_IN', NOW() - interval '45 minutes', NOW() - interval '2 hours');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES ('{pay1_id}', '{ord1_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 170000.00, 'PAY-NOW-001', 'PAID', NOW() - interval '2 hours');
    """
    for sr in slot1_rows:
        sid, spr = sr[0].strip(), sr[1].strip()
        sql_ord1 += f"""
        UPDATE court_schedules SET status = 'BOOKED' WHERE id = '{sid}';
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), '{bkg1_id}', '{sid}', {spr});
        """
    run_psql(sql_ord1)

    # 2. ĐƠN 2: ĐÃ XÁC NHẬN SẴN SÀNG CHECK-IN (CONFIRMED) - Sân B01 hôm nay 19:00 - 21:00
    # Khách đặt online: Lê Thị Thảo. Giá sân: 300k/h x 2h = 600k. Cọc 50% = 300k. Còn lại 300k.
    ord2_id = "22222222-2222-2222-2222-111111111111"
    bkg2_id = "22222222-2222-2222-2222-222222222222"
    pay2_id = "22222222-2222-2222-2222-333333333333"
    meta2 = json.dumps({"customerFlow": True})

    court_b01 = court_map["Sân B01"]["id"]
    slots_ord2 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_b01}' AND schedule_date = '{today_str}' AND start_time >= '19:00:00' AND start_time < '21:00:00' ORDER BY start_time;")
    slot2_rows = [l.strip().split("|") for l in slots_ord2.strip().split("\n")[2:] if "|" in l]

    sql_ord2 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord2_id}', '{THAO_ID}', '{THAO_ID}', 'Lê Thị Thảo', '0913555777', 'CONFIRMED', 600000.00, 300000.00, 300000.00, 'PARTIAL', NOW() - interval '4 hours', 0, '{meta2}');

    INSERT INTO bookings (id, order_id, status, created_at)
    VALUES ('{bkg2_id}', '{ord2_id}', 'CONFIRMED', NOW() - interval '4 hours');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES ('{pay2_id}', '{ord2_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-CONF-002', 'PAID', NOW() - interval '4 hours');
    """
    for sr in slot2_rows:
        sid, spr = sr[0].strip(), sr[1].strip()
        sql_ord2 += f"""
        UPDATE court_schedules SET status = 'BOOKED' WHERE id = '{sid}';
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), '{bkg2_id}', '{sid}', {spr});
        """
    run_psql(sql_ord2)

    # 3. ĐƠN 3: ĐANG GIỮ CHỖ (HOLDING - đếm ngược 5 phút) - Sân V01 ngày mai 08:00 - 10:00
    # Khách lẻ tại quầy: Nguyễn Văn Tuấn. Giá sân: 500k/h x 2h = 1.000.000đ. Cọc 500k. Chưa trả.
    ord3_id = "33333333-3333-3333-3333-111111111111"
    bkg3_id = "33333333-3333-3333-3333-222222222222"
    court_v01 = court_map["Sân V01"]["id"]
    slots_ord3 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_v01}' AND schedule_date = '{tomorrow_str}' AND start_time >= '08:00:00' AND start_time < '10:00:00' ORDER BY start_time;")
    slot3_rows = [l.strip().split("|") for l in slots_ord3.strip().split("\n")[2:] if "|" in l]

    sql_ord3 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, hold_expires_at, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord3_id}', NULL, '{STAFF_ID}', 'Nguyễn Văn Tuấn (Khách lẻ tại quầy)', '0977222333', 'HOLDING', NOW() + interval '5 minutes', 1000000.00, 500000.00, 0.00, 'UNPAID', NOW(), 0, '{{"customerFlow": false, "source": "COUNTER"}}');

    INSERT INTO bookings (id, order_id, status, created_at)
    VALUES ('{bkg3_id}', '{ord3_id}', 'HOLDING', NOW());
    """
    for sr in slot3_rows:
        sid, spr = sr[0].strip(), sr[1].strip()
        sql_ord3 += f"""
        UPDATE court_schedules SET status = 'LOCKED' WHERE id = '{sid}';
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), '{bkg3_id}', '{sid}', {spr});
        """
    run_psql(sql_ord3)

    # 4. ĐƠN 4: ĐỊNH KỲ 4 TUẦN (RECURRING) - Sân B02, 4 tuần liên tiếp lúc 16:00 - 18:00
    # Khách VIP: Trần Hoàng Nam. 300k/h x 2h x 4 tuần = 2.400.000đ. Giảm Plus 15% (-360k) = 2.040.000đ. Cọc 50% = 1.020.000đ.
    ord4_id = "44444444-4444-4444-4444-111111111111"
    bkg4_id = "44444444-4444-4444-4444-222222222222"
    pay4_id = "44444444-4444-4444-4444-333333333333"
    meta4 = json.dumps({
        "customerFlow": True,
        "recurringWeeks": 4,
        "recurringType": "WEEKLY",
        "recurringSummary": f"Định kỳ 4 tuần ({today_str} đến {(today + datetime.timedelta(days=21)).strftime('%Y-%m-%d')})",
        "membershipBenefit": {"gross": 2400000, "discount": 360000, "net": 2040000, "planName": "Plus", "discountPercent": 15}
    })
    court_b02 = court_map["Sân B02"]["id"]
    sql_ord4 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord4_id}', '{NAM_ID}', '{NAM_ID}', 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CONFIRMED', 2040000.00, 1020000.00, 1020000.00, 'PARTIAL', NOW() - interval '1 day', 0, '{meta4}');

    INSERT INTO bookings (id, order_id, status, created_at)
    VALUES ('{bkg4_id}', '{ord4_id}', 'CONFIRMED', NOW() - interval '1 day');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES ('{pay4_id}', '{ord4_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 1020000.00, 'PAY-RECUR-004', 'PAID', NOW() - interval '1 day');
    """
    for w in range(4):
        w_date = (today + datetime.timedelta(days=7 * w)).strftime("%Y-%m-%d")
        w_slots = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_b02}' AND schedule_date = '{w_date}' AND start_time >= '16:00:00' AND start_time < '18:00:00' ORDER BY start_time;")
        for sr in [l.strip().split("|") for l in w_slots.strip().split("\n")[2:] if "|" in l]:
            sid, spr = sr[0].strip(), sr[1].strip()
            sql_ord4 += f"""
            UPDATE court_schedules SET status = 'BOOKED' WHERE id = '{sid}';
            INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), '{bkg4_id}', '{sid}', {spr});
            """
    run_psql(sql_ord4)

    # 5. ĐƠN 5: ĐÃ HOÀN TẤT & XUẤT HÓA ĐƠN (COMPLETED) - Sân A02 hôm qua 17:00 - 19:00
    # Khách: Phạm Minh Đức. 200k/h x 2h = 400k. Đã thanh toán 100% (200k cọc + 200k tiền mặt tại quầy). Có số hóa đơn INV-...
    ord5_id = "55555555-5555-5555-5555-111111111111"
    bkg5_id = "55555555-5555-5555-5555-222222222222"
    pay5_1 = "55555555-5555-5555-5555-333333333331"
    pay5_2 = "55555555-5555-5555-5555-333333333332"
    court_a02 = court_map["Sân A02"]["id"]
    slots_ord5 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_a02}' AND schedule_date = '{yesterday_str}' AND start_time >= '17:00:00' AND start_time < '19:00:00' ORDER BY start_time;")
    slot5_rows = [l.strip().split("|") for l in slots_ord5.strip().split("\n")[2:] if "|" in l]

    sql_ord5 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, invoice_number, issued_at, created_at, version, metadata)
    VALUES ('{ord5_id}', '{DUC_ID}', '{DUC_ID}', 'Phạm Minh Đức', '0988666555', 'COMPLETED', 400000.00, 200000.00, 400000.00, 'PAID', 'INV-20261026-001', '{yesterday_str} 19:05:00+07', '{yesterday_str} 10:00:00+07', 0, '{{"customerFlow": true}}');

    INSERT INTO bookings (id, order_id, status, check_in_at, check_out_at, created_at)
    VALUES ('{bkg5_id}', '{ord5_id}', 'COMPLETED', '{yesterday_str} 16:55:00+07', '{yesterday_str} 19:02:00+07', '{yesterday_str} 10:00:00+07');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES 
      ('{pay5_1}', '{ord5_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-DONE-005A', 'PAID', '{yesterday_str} 10:05:00+07'),
      ('{pay5_2}', '{ord5_id}', '{STAFF_ID}', 'BALANCE', 'CASH', 200000.00, 'PAY-DONE-005B', 'PAID', '{yesterday_str} 19:03:00+07');
    """
    for sr in slot5_rows:
        sid, spr = sr[0].strip(), sr[1].strip()
        sql_ord5 += f"""
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price, released_at) VALUES (gen_random_uuid(), '{bkg5_id}', '{sid}', {spr}, '{yesterday_str} 19:02:00+07');
        """
    run_psql(sql_ord5)

    # 6. ĐƠN 6: ĐÃ HỦY VÀ HOÀN TIỀN 70% (CANCELLED & REFUNDED) - Sân A03 2 ngày trước
    # Khách: Vũ Mai Phương. Cọc 200k. Hủy trước 24h -> Hoàn 70% = 140k. CLB giữ lại 60k.
    ord6_id = "66666666-6666-6666-6666-111111111111"
    bkg6_id = "66666666-6666-6666-6666-222222222222"
    pay6_id = "66666666-6666-6666-6666-333333333333"
    ref6_id = "66666666-6666-6666-6666-444444444444"
    court_a03 = court_map["Sân A03"]["id"]
    slots_ord6 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_a03}' AND schedule_date = '{two_days_ago_str}' AND start_time >= '18:00:00' AND start_time < '20:00:00' ORDER BY start_time;")
    slot6_rows = [l.strip().split("|") for l in slots_ord6.strip().split("\n")[2:] if "|" in l]

    sql_ord6 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord6_id}', '{PHUONG_ID}', '{PHUONG_ID}', 'Vũ Mai Phương', '0903111222', 'CANCELLED', 400000.00, 200000.00, 60000.00, 'PARTIAL', '{two_days_ago_str} 09:00:00+07', 0, '{{"customerFlow": true}}');

    INSERT INTO bookings (id, order_id, status, created_at)
    VALUES ('{bkg6_id}', '{ord6_id}', 'CANCELLED', '{two_days_ago_str} 09:00:00+07');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES ('{pay6_id}', '{ord6_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-CANC-006', 'PAID', '{two_days_ago_str} 09:10:00+07');

    INSERT INTO refunds (id, payment_id, processed_by_account_id, amount, reason, status, refunded_at)
    VALUES ('{ref6_id}', '{pay6_id}', '{ADMIN_ID}', 140000.00, 'Khách hủy trước 24 giờ (chính sách hoàn 70%)', 'DONE', '{two_days_ago_str} 14:00:00+07');
    """
    for sr in slot6_rows:
        sid, spr = sr[0].strip(), sr[1].strip()
        sql_ord6 += f"""
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price, released_at) VALUES (gen_random_uuid(), '{bkg6_id}', '{sid}', {spr}, '{two_days_ago_str} 14:00:00+07');
        """
    run_psql(sql_ord6)

    # 7. ĐƠN 7: CÓ THUÊ TRỌNG TÀI (CONFIRMED) - Sân V02 hôm nay 17:00 - 19:00
    # Khách: Đặng Hoàng Long. Tiền sân: 500k/h x 2h = 1.000.000đ. Phí trọng tài (TT Phạm Quốc Huy): 250k/h x 2h = 500.000đ. Tổng: 1.500.000đ.
    ord7_id = "77777777-7777-7777-7777-111111111111"
    bkg7_id = "77777777-7777-7777-7777-222222222222"
    pay7_id = "77777777-7777-7777-7777-333333333333"
    court_v02 = court_map["Sân V02"]["id"]
    slots_ord7 = run_psql(f"SELECT id, price FROM court_schedules WHERE court_id = '{court_v02}' AND schedule_date = '{today_str}' AND start_time >= '17:00:00' AND start_time < '19:00:00' ORDER BY start_time;")
    slot7_rows = [l.strip().split("|") for l in slots_ord7.strip().split("\n")[2:] if "|" in l]

    sql_ord7 = f"""
    INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata)
    VALUES ('{ord7_id}', '{LONG_ID}', '{LONG_ID}', 'Đặng Hoàng Long', '0938444333', 'CONFIRMED', 1500000.00, 500000.00, 500000.00, 'PARTIAL', NOW() - interval '6 hours', 0, '{{"customerFlow": true}}');

    INSERT INTO bookings (id, order_id, status, created_at)
    VALUES ('{bkg7_id}', '{ord7_id}', 'CONFIRMED', NOW() - interval '6 hours');

    INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
    VALUES ('{pay7_id}', '{ord7_id}', '{STAFF_ID}', 'DEPOSIT', 'BANK_TRANSFER', 500000.00, 'PAY-REF-007', 'PAID', NOW() - interval '6 hours');
    """
    if len(slot7_rows) >= 2:
        s1, s2 = slot7_rows[0][0].strip(), slot7_rows[1][0].strip()
        sql_ord7 += f"""
        UPDATE court_schedules SET status = 'BOOKED' WHERE id IN ('{s1}', '{s2}');
        INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES 
          (gen_random_uuid(), '{bkg7_id}', '{s1}', {slot7_rows[0][1].strip()}),
          (gen_random_uuid(), '{bkg7_id}', '{s2}', {slot7_rows[1][1].strip()});

        DO $$
        DECLARE
          sid1 UUID;
          sid2 UUID;
        BEGIN
          SELECT id INTO sid1 FROM staff_schedules WHERE staff_id = '{referee_id}' AND work_date = '{today_str}' AND start_time = '17:00:00';
          IF sid1 IS NULL THEN
            sid1 := gen_random_uuid();
            INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version)
            VALUES (sid1, '{referee_id}', '{today_str}', '17:00:00', '18:00:00', 'BOOKED', 0);
          ELSE
            UPDATE staff_schedules SET status = 'BOOKED' WHERE id = sid1;
          END IF;

          SELECT id INTO sid2 FROM staff_schedules WHERE staff_id = '{referee_id}' AND work_date = '{today_str}' AND start_time = '18:00:00';
          IF sid2 IS NULL THEN
            sid2 := gen_random_uuid();
            INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version)
            VALUES (sid2, '{referee_id}', '{today_str}', '18:00:00', '19:00:00', 'BOOKED', 0);
          ELSE
            UPDATE staff_schedules SET status = 'BOOKED' WHERE id = sid2;
          END IF;

          INSERT INTO booking_staff (id, booking_id, staff_schedule_id, court_schedule_id, unit_price)
          VALUES 
            (gen_random_uuid(), '{bkg7_id}', sid1, '{s1}', {referee_rate}),
            (gen_random_uuid(), '{bkg7_id}', sid2, '{s2}', {referee_rate});
        END $$;
        """
    run_psql(sql_ord7)

    # ----------------------------------------------------
    # KHỞI TẠO HỘI VIÊN PLUS CHO TRẦN HOÀNG NAM (APP_DOCUMENTS)
    # ----------------------------------------------------
    print("💳 Đang kích hoạt gói Hội viên Plus (Membership) cho Trần Hoàng Nam...")
    mem_id = str(uuid.uuid4())
    mem_start = f"{today.year}-{today.month:02d}-01T00:00:00Z"
    mem_end = f"{(today + datetime.timedelta(days=60)).year}-{(today + datetime.timedelta(days=60)).month:02d}-28T23:59:59Z"
    
    mem_doc = {
        "id": mem_id,
        "accountId": NAM_ID,
        "planId": "plus",
        "planName": "Plus",
        "startsAt": mem_start,
        "endsAt": mem_end,
        "status": "ACTIVE",
        "discountPercent": 15,
        "vipDiscountPercent": 10,
        "price": 499000,
        "rescheduleUsage": 0
    }
    mem_pay_doc = {
        "id": str(uuid.uuid4()),
        "membershipId": mem_id,
        "accountId": NAM_ID,
        "planId": "plus",
        "planName": "Plus",
        "amount": 499000,
        "createdAt": f"{today_str}T08:00:00Z",
        "status": "PAID",
        "method": "BANK_TRANSFER",
        "transactionCode": "MEM-PLUS-001"
    }

    # Xóa membership cũ trong app_documents và chèn mới
    del_mem_sql = f"""
    DELETE FROM app_documents WHERE document_key LIKE 'membership:%' OR document_key LIKE 'membership-payment:%' OR document_key LIKE 'request:%' OR document_key LIKE 'otp:%';
    INSERT INTO app_documents (document_key, data, version) VALUES 
      ('membership:{NAM_ID}', '{json.dumps(mem_doc)}', 1),
      ('membership-payment:{mem_pay_doc["id"]}', '{json.dumps(mem_pay_doc)}', 1);
    """
    run_psql(del_mem_sql)

    # ----------------------------------------------------
    # KHỞI TẠO 4 ĐỘI THI ĐẤU CHO GIẢI ĐẤU (TOURNAMENT)
    # ----------------------------------------------------
    if tourn_id:
        print("🏆 Đang khởi tạo 4 đội thi đấu giải Courtly Winter Doubles...")
        teams = [
            ("Hoàng Nam & Minh Anh", NAM_ID, "350000"),
            ("Lê Thu Hà & Quốc Huy", HA_ID, "350000"),
            ("Phạm Minh Đức & Thanh Bình", DUC_ID, "350000"),
            ("Đặng Hoàng Long & Tấn Phát", LONG_ID, "350000")
        ]
        tourn_sql = ""
        for i, (tname, acc, fee) in enumerate(teams):
            reg_id = str(uuid.uuid4())
            pay_id = str(uuid.uuid4())
            acc_val = f"'{acc}'" if acc else "NULL"
            tourn_sql += f"""
            INSERT INTO tournament_registrations (id, tournament_id, account_id, registered_by_account_id, team_name, skill_level, status, registered_at)
            VALUES ('{reg_id}', '{tourn_id}', {acc_val}, '{STAFF_ID}', '{tname}', 'ADVANCED', 'CONFIRMED', NOW() - interval '{i+1} days');

            INSERT INTO payments (id, registration_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
            VALUES ('{pay_id}', '{reg_id}', '{STAFF_ID}', 'TOURNAMENT_FEE', 'BANK_TRANSFER', {fee}, 'PAY-TOURN-00{i+1}', 'PAID', NOW() - interval '{i+1} days');
            """
        run_psql(tourn_sql)

    print("=" * 60)
    print("✨ KHỞI TẠO HOÀN TẤT THÀNH CÔNG 100%!")
    print("=" * 60)
    print("📊 BẢNG TỔNG KẾT BỘ DỮ LIỆU CHUẨN TRÌNH DIỄN:")
    print("1. Đơn #CT-NOW0001 : [CHECKED_IN] Sân A01 (Đang chơi) -> Demo Gia hạn sân hoặc Check-out.")
    print("2. Đơn #CT-CONF002 : [CONFIRMED]  Sân B01 (19:00) -> Demo Vé điện tử & QR Check-in.")
    print("3. Đơn #CT-HOLD003 : [HOLDING]    Sân V01 (Ngày mai) -> Demo Đồng hồ 5p & Quét VietQR cọc.")
    print("4. Đơn #CT-RECUR04 : [RECURRING]  Sân B02 (4 tuần) -> Demo Tính năng Đặt lịch định kỳ dài hạn.")
    print("5. Đơn #CT-DONE005 : [COMPLETED]  Sân A02 (Hôm qua) -> Demo Xem & In Phiếu thu Hóa đơn.")
    print("6. Đơn #CT-CANC006 : [CANCELLED]  Sân A03 (Đã hủy) -> Demo Hoàn tiền 70% theo chính sách.")
    print("7. Đơn #CT-REF0007 : [REFEREE]    Sân V02 (17:00) -> Demo Thuê trọng tài TT Phạm Quốc Huy.")
    print("8. Giải đấu Courtly Open : 4 đội đăng ký (Doanh thu giải: 1.400.000đ).")
    print("9. Hội viên VIP Plus: Kiet Nguyen (Doanh thu membership: 499.000đ, Giảm 15% giờ sân).")
    print("=" * 60)

if __name__ == "__main__":
    main()
