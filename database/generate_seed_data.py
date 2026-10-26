#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Courtly - Comprehensive Real-World Business Seed Data Generator (2 Months)
Produces database/test_data.sql with:
  - 10 Courts, 20,400 court slots (60 days: -45 to +14)
  - 65 Accounts (Admin, 3 Front-desk staff, VIP Demo user, 60 Real Customers)
  - 10 Referees
  - ~1050 Orders, Bookings, Staff assignments, Payments, Refunds
  - 6 Tournaments (4 Completed with brackets, 2 Open)
  - 20 Memberships & Receipts
  - 15 Real Customer Reviews & Feedback
"""

import uuid
import datetime
import random
import json

def seed_uuid(key: str) -> str:
    """Deterministic UUID generation from key."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"courtly:v2:{key}"))

def escape_sql(text: str) -> str:
    if text is None:
        return "NULL"
    return "'" + str(text).replace("'", "''") + "'"

def main():
    print("Generating comprehensive 2-month demo seed data for Courtly...")

    lines = []
    lines.append("""-- ====================================================================
-- COURTLY TENNIS CLUB - COMPREHENSIVE REAL-WORLD BUSINESS DEMO (2 MONTHS)
-- ====================================================================

BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';

DO $$ BEGIN
 IF current_setting('courtly.allow_test_data', true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'Test fixtures require SET courtly.allow_test_data=on; use a disposable database';
 END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Clean existing operational data cleanly in reverse foreign key order
DELETE FROM app_documents;
DELETE FROM audit_logs;
DELETE FROM refunds;
DELETE FROM payments;
DELETE FROM match_staff;
DELETE FROM match_slots;
DELETE FROM matches;
DELETE FROM team_members;
DELETE FROM tournament_registrations;
DELETE FROM tournaments;
DELETE FROM order_products;
DELETE FROM booking_staff;
DELETE FROM booking_slots;
DELETE FROM bookings;
DELETE FROM orders;
DELETE FROM staff_schedules;
DELETE FROM staff;
DELETE FROM rental_items;
DELETE FROM drinks;
DELETE FROM court_schedules;
DELETE FROM court_prices;
DELETE FROM courts;
DELETE FROM club_settings;
DELETE FROM accounts WHERE lower(email) <> 'admin@gmail.com';

CREATE OR REPLACE FUNCTION pg_temp.seed_uuid(key text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT md5('courtly-business-v2:' || key)::uuid
$$;

DO $$
DECLARE
  v_admin_id uuid;
  v_demo_id uuid;
  v_passwd text;
  v_now timestamptz := now();
  v_today date := CURRENT_DATE;
BEGIN
  v_passwd := crypt('CourtlyDemo2026', gen_salt('bf', 12));

  -- 1. SUPERADMIN ACCOUNT
  SELECT id INTO v_admin_id FROM accounts WHERE lower(email) = 'admin@gmail.com';
  IF v_admin_id IS NULL THEN
    v_admin_id := pg_temp.seed_uuid('account:admin');
    INSERT INTO accounts(id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
    VALUES (v_admin_id, 'Quản Trị Viên (Tổng Quản Lý)', 'admin@gmail.com', '0901888999',
            crypt('12345', gen_salt('bf', 12)), 'ADMIN', 'ACTIVE', v_now - interval '65 days', 0);
  END IF;

  -- 2. CLUB SETTINGS
  INSERT INTO club_settings(id, hold_minutes, deposit_percent, cancel_refund_percent, policies)
  VALUES (pg_temp.seed_uuid('settings:default'), 15, 50, 50,
          '{"cancelCutoffMinutes":60,"changeCutoffMinutes":60,"checkInEarlyMinutes":30}');

  -- 3. FRONT-DESK STAFF ACCOUNTS (Role STAFF for front-desk operation)
  INSERT INTO accounts(id, full_name, email, phone, password_hash, role, status, created_at, auth_version) VALUES
  (pg_temp.seed_uuid('staff_acc:1'), 'Trần Thu Hương (Lễ tân sáng)', 'letan.huong@courtly.vn', '0938112233', v_passwd, 'STAFF', 'ACTIVE', v_now - interval '60 days', 0),
  (pg_temp.seed_uuid('staff_acc:2'), 'Nguyễn Minh Đức (Lễ tân chiều)', 'letan.duc@courtly.vn', '0938445566', v_passwd, 'STAFF', 'ACTIVE', v_now - interval '60 days', 0),
  (pg_temp.seed_uuid('staff_acc:3'), 'Lê Anh Tuấn (Quản lý sân)', 'quanly.tuan@courtly.vn', '0909998877', v_passwd, 'STAFF', 'ACTIVE', v_now - interval '60 days', 0);

  -- 4. MAIN DEMO CUSTOMER (VIP Player)
  v_demo_id := pg_temp.seed_uuid('customer:demo');
  INSERT INTO accounts(id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
  VALUES (v_demo_id, 'Nguyễn Minh Anh', 'minh.anh@example.com', '0903123456', v_passwd, 'CUSTOMER', 'ACTIVE', v_now - interval '60 days', 0);
""")

    # Customer accounts (60)
    customers = [
        ("Trần Quốc Bảo", "quocbao.kts@gmail.com", "0918234567"),
        ("Lê Hoàng Nam", "hoangnam.tennis@gmail.com", "0908765432"),
        ("Phạm Quỳnh Nga", "quynhnga.law@outlook.com", "0978112233"),
        ("Vũ Duy Mạnh", "manh.vu@techcorp.vn", "0989334455"),
        ("Đặng Thùy Trang", "thuytrang.design@gmail.com", "0968556677"),
        ("Hoàng Hải Đăng", "haidang.finance@gmail.com", "0934778899"),
        ("Bùi Gia Huy", "giahuy.dev@gmail.com", "0912334466"),
        ("Đỗ Phương Anh", "phuonganh.dr@gmail.com", "0945667788"),
        ("Ngô Bảo Ngọc", "baongoc.media@gmail.com", "0909113355"),
        ("Trịnh Đình Quang", "dinhquang.logistic@gmail.com", "0938224466"),
        ("Phan Thanh Tùng", "thanhtung.auto@gmail.com", "0977335577"),
        ("Dương Tuấn Kiệt", "tuankiet.mkt@gmail.com", "0988446688"),
        ("Lâm Khánh Linh", "khanhlinh.hr@gmail.com", "0966557799"),
        ("Tạ Quang Thắng", "quangthang.arch@gmail.com", "0915668800"),
        ("Đoàn Nhật Minh", "nhatminh.bank@gmail.com", "0933779911"),
        ("Mai Phương Thảo", "phuongthao.edu@gmail.com", "0975880022"),
        ("Hà Quốc Anh", "quocanh.realestate@gmail.com", "0986991133"),
        ("Đinh Thu Ngân", "thungan.event@gmail.com", "0902114455"),
        ("Lý Gia Phúc", "giaphuc.sport@gmail.com", "0944225566"),
        ("Cao Thái Sơn", "thaison.tennis@gmail.com", "0916336677"),
        ("Trương Vĩnh Kỳ", "vinhky.audio@gmail.com", "0939447788"),
        ("Võ Thị Bích Trâm", "bichtram.pharma@gmail.com", "0972558899"),
        ("Hồ Văn Cường", "vancuong.solar@gmail.com", "0984669900"),
        ("Nguyễn Trọng Nghĩa", "trongnghia.tax@gmail.com", "0907770011"),
        ("Bạch Nhật Khang", "nhatkhang.tech@gmail.com", "0949881122"),
        ("Chu Đình Trọng", "dinhtrong.sport@gmail.com", "0917992233"),
        ("Khổng Minh Trí", "minhtri.law@gmail.com", "0932003344"),
        ("Tô Hoài Nam", "hoainam.art@gmail.com", "0973114455"),
        ("Quách Thành Danh", "thanhdanh.dentist@gmail.com", "0985225566"),
        ("Lưu Bảo Châu", "baochau.yoga@gmail.com", "0906336677"),
        ("Huỳnh Đức Thiện", "ducthien.import@gmail.com", "0948447788"),
        ("Tăng Thanh Hà", "thanhha.fnb@gmail.com", "0919558899"),
        ("Tiêu Hải Nam", "hainam.music@gmail.com", "0931669900"),
        ("Châu Bùi Thảo", "buithao.fashion@gmail.com", "0974770011"),
        ("Lương Thế Thành", "thethanh.film@gmail.com", "0987881122"),
        ("Nghiêm Xuân Tú", "xuantu.coffee@gmail.com", "0901992233"),
        ("Giang Hồng Ngọc", "hongngoc.spa@gmail.com", "0943003344"),
        ("Kiều Minh Tuấn", "minhtuan.travel@gmail.com", "0914114455"),
        ("Sơn Tùng", "tung.creations@gmail.com", "0935225566"),
        ("Phí Phương Anh", "phuonganh.pr@gmail.com", "0976336677"),
        ("Ung Hoàng Phúc", "hoangphuc.pro@gmail.com", "0981447788"),
        ("Doãn Hải My", "haimy.lawyer@gmail.com", "0903558899"),
        ("Ân Thiên Hưng", "thienhung.export@gmail.com", "0942669900"),
        ("Âu Dương Quân", "duongquan.energy@gmail.com", "0913770011"),
        ("Diệp Lâm Anh", "lamanh.dance@gmail.com", "0936881122"),
        ("Vương Khang", "vuongkhang.director@gmail.com", "0979992233"),
        ("Thái Trinh", "thaitrinh.acoustic@gmail.com", "0983003344"),
        ("Nhâm Mạnh Dũng", "manhdung.striker@gmail.com", "0905114455"),
        ("Lục Tiểu Mi", "tieumi.baker@gmail.com", "0947225566"),
        ("Thạch Kim Tuấn", "kimtuan.lifting@gmail.com", "0918336677"),
        ("Bì Văn Chung", "vanchung.construct@gmail.com", "0937447788"),
        ("Hứa Vĩ Văn", "vivan.actor@gmail.com", "0971558899"),
        ("Trần Đình Trọng", "dinhtrong.defense@gmail.com", "0982669900"),
        ("Bùi Tiến Dũng", "tiendung.keeper@gmail.com", "0904770011"),
        ("Đỗ Hùng Dũng", "hungdung.captain@gmail.com", "0946881122"),
        ("Nguyễn Quang Hải", "quanghai.midfield@gmail.com", "0915992233"),
        ("Vũ Văn Thanh", "vanthanh.wing@gmail.com", "0934003344"),
        ("Nguyễn Văn Toàn", "vantoan.speed@gmail.com", "0975114455"),
        ("Nguyễn Công Phượng", "congphuong.striker@gmail.com", "0988225566"),
        ("Vũ Văn Khang (Khóa)", "quangthang.locked@example.com", "0999000111")
    ]

    lines.append("  -- 5. REAL VIETNAMESE CUSTOMER ACCOUNTS")
    for i, (name, email, phone) in enumerate(customers, 1):
        status = 'LOCKED' if i == len(customers) else 'ACTIVE'
        lines.append(f"""  INSERT INTO accounts(id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
  VALUES (pg_temp.seed_uuid('customer:{i}'), {escape_sql(name)}, {escape_sql(email.lower())}, {escape_sql(phone)}, v_passwd, 'CUSTOMER', '{status}', v_now - interval '60 days', 0);""")

    # 10 Courts
    courts_data = [
        ('court:1', 'Sân A01', 'HARD', 'Sân cứng ngoài trời US Open tiêu chuẩn, đèn LED cao áp 1000 lux', '/guest/zone-a-outdoor.webp', 200000),
        ('court:2', 'Sân A02', 'HARD', 'Sân ngoài trời thoáng mát, khán đài mini 30 chỗ, mặt sân nảy êm', '/guest/zone-a-outdoor.webp', 200000),
        ('court:3', 'Sân A03', 'HARD', 'Sân cứng ngoài trời, thích hợp đánh đơn và đôi phong trào', '/guest/zone-a-outdoor.webp', 200000),
        ('court:4', 'Sân A04', 'HARD', 'Sân ngoài trời gần quầy dịch vụ, view bao quát toàn khu', '/guest/zone-a-outdoor.webp', 200000),
        ('court:5', 'Sân B01', 'HARD', 'Sân có mái che vòm cao 12m, không ngại mưa nắng, thông gió đối lưu', '/guest/zone-b-indoor.webp', 300000),
        ('court:6', 'Sân B02', 'HARD', 'Sân trong nhà chất lượng cao, sơn phủ Decoturf cao cấp', '/guest/zone-b-indoor.webp', 300000),
        ('court:7', 'Sân B03', 'HARD', 'Sân mái che trung tâm, thường tổ chức các trận bán kết và chung kết', '/guest/zone-b-indoor.webp', 300000),
        ('court:8', 'Sân B04', 'HARD', 'Sân trong nhà yên tĩnh, hệ thống đèn chiếu chuẩn giải đấu', '/guest/zone-b-indoor.webp', 300000),
        ('court:9', 'Sân V01', 'HARD', 'Sân VIP Lounge riêng biệt, ghế sofa bọc da, máy lạnh phòng chờ', '/guest/zone-v-lounge.webp', 500000),
        ('court:10', 'Sân V02', 'HARD', 'Sân VIP đặc quyền doanh nhân, có phòng thay đồ và tắm riêng', '/guest/zone-v-lounge.webp', 500000),
    ]

    lines.append("\n  -- 6. COURTS & PRICING")
    for cid, name, ctype, desc, img, price in courts_data:
        lines.append(f"""  INSERT INTO courts(id, name, type, description, image_url, status, base_price, address, amenities, image_is_illustration)
  VALUES (pg_temp.seed_uuid('{cid}'), {escape_sql(name)}, '{ctype}', {escape_sql(desc)}, '{img}', 'ACTIVE', {price},
          'Courtly Sport Complex · 128 Đường Tennis, TP.HCM', 'Đèn LED cao áp, Bãi đỗ xe ô tô, Phòng tắm nóng lạnh, Wi-Fi 6 tốc độ cao', true);
  INSERT INTO court_prices(id, court_id, day_type, start_time, end_time, price_per_hour) VALUES
  (pg_temp.seed_uuid('price:{cid}:weekday'), pg_temp.seed_uuid('{cid}'), 'WEEKDAY', '06:00', '23:00', {price}),
  (pg_temp.seed_uuid('price:{cid}:weekend'), pg_temp.seed_uuid('{cid}'), 'WEEKEND', '06:00', '23:00', {price});""")

    # 10 Staff
    staff_data = [
        ('staff:1', 'TT Phạm Quốc Huy', '0912111222', 'REFEREE', 'ITF Level 2 · 8 năm TT tuyển trẻ & phong trào', 250000),
        ('staff:2', 'TT Nguyễn Hoàng Long', '0912222333', 'REFEREE', 'Cựu VĐV Quốc gia · 6 năm kinh nghiệm chiến thuật & thể lực', 220000),
        ('staff:3', 'TT Trần Đức Thịnh', '0912333444', 'REFEREE', 'TT chuyên sâu kỹ thuật giao bóng & Volley · 5 năm', 200000),
        ('staff:4', 'TT Lê Quỳnh Mai', '0912444555', 'REFEREE', 'Tốt nghiệp ĐH TDTT · Đào tạo học viên nữ & thiếu nhi · 4 năm', 200000),
        ('staff:5', 'TT Vũ Thanh Bình', '0912555666', 'REFEREE', 'Trọng tài VTF Level 1 · 7 năm điều hành giải vô địch TP', 180000),
        ('staff:6', 'TT Đỗ Hoài An', '0912666777', 'REFEREE', 'Trọng tài giải mở rộng & cup liên đoàn · 5 năm', 160000),
        ('staff:7', 'TT Bùi Quang Minh', '0912777888', 'REFEREE', 'Trọng tài các giải CLB & doanh nghiệp · 3 năm', 150000),
        ('staff:8', 'TT Trương Tấn Phát', '0912888999', 'REFEREE', 'Trọng tài bắt vạch chuẩn xác, năng động · 2 năm', 140000),
        ('staff:9', 'Nguyễn Văn Nam (Trọng tài)', '0912999000', 'REFEREE', 'Trọng tài tập sự · 2 năm kinh nghiệm', 80000),
        ('staff:10', 'Trần Hải Đăng (Trọng tài)', '0913000111', 'REFEREE', 'Trọng tài tập sự · 1 năm kinh nghiệm', 80000),
    ]

    lines.append("\n  -- 7. STAFF")
    for sid, name, phone, stype, level, rate in staff_data:
        lines.append(f"""  INSERT INTO staff(id, full_name, phone, type, level, hourly_rate, status)
  VALUES (pg_temp.seed_uuid('{sid}'), {escape_sql(name)}, {escape_sql(phone)}, '{stype}', {escape_sql(level)}, {rate}, 'ACTIVE');""")

    # Schedules generation for 60 days (-45 to +14)
    lines.append("""
  -- 9. GENERATE 60 DAYS OF COURT SLOTS (20,400 SLOTS) & STAFF SCHEDULES
  FOR n IN 1..10 LOOP
    FOR d IN -45..14 LOOP
      FOR h IN 12..45 LOOP
        INSERT INTO court_schedules(id, court_id, schedule_date, start_time, end_time, price, status, version)
        VALUES (
          pg_temp.seed_uuid('slot:' || n || ':' || d || ':' || h),
          pg_temp.seed_uuid('court:' || n),
          v_today + d,
          (time '00:00' + h * interval '30 minutes')::time,
          (time '00:00' + (h + 1) * interval '30 minutes')::time,
          CASE WHEN n <= 4 THEN 100000 WHEN n <= 8 THEN 150000 ELSE 250000 END,
          'AVAILABLE',
          0
        );

        -- Staff schedules (Referees)
        INSERT INTO staff_schedules(id, staff_id, work_date, start_time, end_time, status, version)
        VALUES (
          pg_temp.seed_uuid('staff_shift:' || n || ':' || d || ':' || h),
          pg_temp.seed_uuid('staff:' || n),
          v_today + d,
          (time '00:00' + h * interval '30 minutes')::time,
          (time '00:00' + (h + 1) * interval '30 minutes')::time,
          'AVAILABLE',
          0
        );
      END LOOP;
    END LOOP;
  END LOOP;
""")

    # Order generation
    lines.append("""
  -- 10. GENERATE 1,050+ ORDERS ACROSS 60 DAYS
  DECLARE
    v_order_id uuid;
    v_booking_id uuid;
    v_slot1_id uuid;
    v_slot2_id uuid;
    v_staff_shift_id uuid;
    v_payment1_id uuid;
    v_payment2_id uuid;
    v_refund_id uuid;
    v_cust_id uuid;
    v_court_num int;
    v_cust_num int;
    v_start_h int;
    v_court_price numeric;
    v_total numeric;
    v_subtotal numeric;
    v_paid numeric;
    v_deposit numeric;
    v_status text;
    v_pay_status text;
    v_cust_name text;
    v_cust_phone text;
    v_order_date date;
    v_created timestamptz;
    v_checkin timestamptz;
    v_checkout timestamptz;
    v_invoice text;
    v_has_referee boolean;
    v_staff_num int;
    v_staff_rate numeric;
    v_extra numeric;
    v_day_offset int;
    v_daily_order int;
    v_orders_today int;
    v_tx_code text;
    v_total_orders_gen int := 0;
  BEGIN
    FOR v_day_offset IN -45..14 LOOP
      v_order_date := v_today + v_day_offset;
      
      -- Weekend traffic is higher
      IF EXTRACT(DOW FROM v_order_date) IN (0, 6) THEN
        v_orders_today := 24;
      ELSE
        v_orders_today := 15;
      END IF;

      -- Today has exactly 28 orders for rich dashboard
      IF v_day_offset = 0 THEN
        v_orders_today := 28;
      END IF;

      FOR v_daily_order IN 1..v_orders_today LOOP
        v_total_orders_gen := v_total_orders_gen + 1;
        v_order_id := pg_temp.seed_uuid('order:' || v_total_orders_gen);
        v_booking_id := pg_temp.seed_uuid('booking:' || v_total_orders_gen);

        -- Distribute across courts:
        -- 1..4: Outdoor A, 5..8: Indoor B, 9..10: VIP V
        v_court_num := ((v_daily_order - 1) % 10) + 1;

        -- Customer: Demo VIP player gets ~20% of orders for rich history
        IF v_total_orders_gen % 5 = 0 THEN
          v_cust_id := v_demo_id;
          v_cust_name := 'Nguyễn Minh Anh';
          v_cust_phone := '0903123456';
        ELSE
          v_cust_num := ((v_total_orders_gen * 7) % 60) + 1;
          v_cust_id := pg_temp.seed_uuid('customer:' || v_cust_num);
          SELECT full_name, phone INTO v_cust_name, v_cust_phone FROM accounts WHERE id = v_cust_id;
        END IF;

        -- Non-conflicting time slots for each court:
        -- Order 1..10 (Court 1..10): Morning slot (h = 14: 07:00 - 08:00)
        -- Order 11..20 (Court 1..10): Late afternoon slot (h = 32: 16:00 - 17:00)
        -- Order 21..28 (Court 1..8): Evening peak slot (h = 38: 19:00 - 20:00)
        IF v_daily_order <= 10 THEN
          v_start_h := 14;
        ELSIF v_daily_order <= 20 THEN
          v_start_h := 32;
        ELSE
          v_start_h := 38;
        END IF;

        -- Price calculation (1 hour = 2 slots)
        IF v_court_num <= 4 THEN
          v_court_price := 200000;
        ELSIF v_court_num <= 8 THEN
          v_court_price := 300000;
        ELSE
          v_court_price := 500000;
        END IF;

        v_subtotal := v_court_price;
        v_extra := 0;

        -- Referee assignment (historical completed orders, plus a few upcoming)
        v_has_referee := (v_total_orders_gen % 6 = 0);
        v_staff_num := v_court_num; -- 1 staff per court to avoid concurrent collision
        IF v_has_referee THEN
          SELECT hourly_rate INTO v_staff_rate FROM staff WHERE id = pg_temp.seed_uuid('staff:' || v_staff_num);
          v_extra := v_extra + v_staff_rate;
        END IF;

        v_subtotal := v_subtotal + v_extra;
        v_total := v_subtotal;
        v_deposit := ROUND(v_total * 0.5, 0);

        -- STATUS BASED ON TIMING
        IF v_day_offset < 0 THEN
          -- PAST DAYS: Realistic mix of COMPLETED, CANCELLED (with refund), and EXPIRED
          IF v_total_orders_gen % 28 = 0 THEN
            v_status := 'CANCELLED';
            v_paid := v_deposit;
            v_pay_status := 'PARTIAL';
          ELSIF v_total_orders_gen % 38 = 0 THEN
            v_status := 'EXPIRED';
            v_paid := 0;
            v_pay_status := 'UNPAID';
          ELSE
            v_status := 'COMPLETED';
            v_paid := v_total;
            v_pay_status := 'PAID';
          END IF;
        ELSIF v_day_offset = 0 THEN
          -- TODAY (CURRENT_DATE)
          IF v_daily_order <= 5 THEN
            -- Morning completed
            v_status := 'COMPLETED';
            v_paid := v_total;
            v_pay_status := 'PAID';
          ELSIF v_daily_order <= 10 THEN
            -- ACTIVE CHECKED-IN NOW (Sân A01..A04, B01)
            v_status := 'CHECKED_IN';
            v_paid := v_deposit;
            v_pay_status := 'PARTIAL';
          ELSIF v_daily_order <= 24 THEN
            -- CONFIRMED FOR AFTERNOON & EVENING TODAY
            v_status := 'CONFIRMED';
            v_paid := CASE WHEN v_daily_order % 2 = 0 THEN v_total ELSE v_deposit END;
            v_pay_status := CASE WHEN v_paid = v_total THEN 'PAID' ELSE 'PARTIAL' END;
          ELSE
            -- RECENT HOLDING
            v_status := 'HOLDING';
            v_paid := 0;
            v_pay_status := 'UNPAID';
          END IF;
        ELSE
          -- FUTURE (+1 to +14)
          IF v_daily_order % 6 = 0 THEN
            v_status := 'HOLDING';
            v_paid := 0;
            v_pay_status := 'UNPAID';
          ELSE
            v_status := 'CONFIRMED';
            v_paid := CASE WHEN v_daily_order % 3 = 0 THEN v_total ELSE v_deposit END;
            v_pay_status := CASE WHEN v_paid = v_total THEN 'PAID' ELSE 'PARTIAL' END;
          END IF;
        END IF;

        -- Timestamps
        v_created := (v_order_date - interval '2 days' + time '10:00')::timestamptz;
        IF v_status = 'COMPLETED' THEN
          v_checkin := (v_order_date + (time '00:00' + v_start_h * interval '30 minutes'))::timestamptz;
          v_checkout := (v_order_date + (time '00:00' + (v_start_h + 2) * interval '30 minutes'))::timestamptz;
        ELSIF v_status = 'CHECKED_IN' THEN
          v_checkin := v_now - interval '35 minutes';
          v_checkout := NULL;
        ELSE
          v_checkin := NULL;
          v_checkout := NULL;
        END IF;

        v_invoice := CASE WHEN v_status = 'COMPLETED' OR v_paid = v_total THEN 'INV-2026' || lpad(v_total_orders_gen::text, 6, '0') ELSE NULL END;

        -- INSERT ORDER
        INSERT INTO orders(
          id, customer_account_id, created_by_account_id, customer_name, customer_phone,
          status, hold_expires_at, subtotal, total_amount, deposit_required, paid_amount,
          payment_status, invoice_number, issued_at, created_at, version, metadata
        ) VALUES (
          v_order_id, v_cust_id, v_admin_id, v_cust_name, v_cust_phone,
          v_status,
          CASE WHEN v_status = 'HOLDING' THEN v_now + interval '15 minutes' ELSE (v_order_date + time '22:00')::timestamptz END,
          v_subtotal, v_total, v_deposit, v_paid,
          v_pay_status, v_invoice,
          CASE WHEN v_invoice IS NOT NULL THEN (v_order_date + time '22:00')::timestamptz ELSE NULL END,
          v_created, 0,
          jsonb_build_object('fixture', true, 'customerFlow', true, 'source', 'ONLINE', 'notes', 'Đơn đặt demo chuẩn')::text
        );

        -- INSERT BOOKING
        INSERT INTO bookings(id, order_id, status, check_in_at, check_out_at, created_at)
        VALUES (
          v_booking_id, v_order_id,
          CASE WHEN v_status = 'EXPIRED' THEN 'CANCELLED' ELSE v_status END,
          v_checkin, v_checkout, v_created
        );

        -- LINK COURT SLOTS
        v_slot1_id := pg_temp.seed_uuid('slot:' || v_court_num || ':' || v_day_offset || ':' || v_start_h);
        v_slot2_id := pg_temp.seed_uuid('slot:' || v_court_num || ':' || v_day_offset || ':' || (v_start_h + 1));

        INSERT INTO booking_slots(id, booking_id, schedule_id, unit_price, released_at) VALUES
        (gen_random_uuid(), v_booking_id, v_slot1_id,
         CASE WHEN v_court_num <= 4 THEN 100000 WHEN v_court_num <= 8 THEN 150000 ELSE 250000 END,
         CASE WHEN v_status IN ('COMPLETED', 'CANCELLED', 'EXPIRED') THEN v_order_date + interval '23 hours' ELSE NULL END),
        (gen_random_uuid(), v_booking_id, v_slot2_id,
         CASE WHEN v_court_num <= 4 THEN 100000 WHEN v_court_num <= 8 THEN 150000 ELSE 250000 END,
         CASE WHEN v_status IN ('COMPLETED', 'CANCELLED', 'EXPIRED') THEN v_order_date + interval '23 hours' ELSE NULL END);

        IF v_status = 'CHECKED_IN' OR v_status = 'CONFIRMED' THEN
          UPDATE court_schedules SET status = 'BOOKED' WHERE id IN (v_slot1_id, v_slot2_id);
        ELSIF v_status = 'HOLDING' THEN
          UPDATE court_schedules SET status = 'LOCKED' WHERE id IN (v_slot1_id, v_slot2_id);
        END IF;

        -- LINK REFEREE
        IF v_has_referee THEN
          FOR h IN 0..1 LOOP
            v_staff_shift_id := pg_temp.seed_uuid('staff_shift:' || v_staff_num || ':' || v_day_offset || ':' || (v_start_h + h));
            INSERT INTO booking_staff(id, booking_id, staff_schedule_id, court_schedule_id, unit_price, released_at)
            VALUES (
              pg_temp.seed_uuid('staff_book:' || v_total_orders_gen || ':' || h),
              v_booking_id, v_staff_shift_id, CASE WHEN h = 0 THEN v_slot1_id ELSE v_slot2_id END, v_staff_rate,
              CASE WHEN v_status IN ('COMPLETED', 'CANCELLED', 'EXPIRED') THEN v_order_date + interval '23 hours' ELSE NULL END
            );
            IF v_status IN ('CONFIRMED', 'CHECKED_IN', 'HOLDING') THEN
              UPDATE staff_schedules SET status = 'BOOKED' WHERE id = v_staff_shift_id;
            END IF;
          END LOOP;
        END IF;

        -- PAYMENTS & REFUNDS
        IF v_paid > 0 THEN
          v_payment1_id := pg_temp.seed_uuid('payment1:' || v_total_orders_gen);
          v_tx_code := CASE WHEN v_total_orders_gen % 2 = 0 THEN 'VNPAY-' || (100000 + v_total_orders_gen) ELSE 'MBB-QR-' || (200000 + v_total_orders_gen) END;

          INSERT INTO payments(id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
          VALUES (
            v_payment1_id, v_order_id, v_admin_id,
            CASE WHEN v_paid < v_total THEN 'DEPOSIT' ELSE 'BALANCE' END,
            CASE WHEN v_total_orders_gen % 3 = 0 THEN 'CASH' ELSE 'BANK_TRANSFER' END,
            CASE WHEN v_paid < v_total THEN v_deposit ELSE v_total END,
            v_tx_code, 'PAID', v_created + interval '10 minutes'
          );

          IF v_status = 'COMPLETED' AND v_paid = v_total AND v_deposit < v_total THEN
            v_payment2_id := pg_temp.seed_uuid('payment2:' || v_total_orders_gen);
            INSERT INTO payments(id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
            VALUES (
              v_payment2_id, v_order_id, v_admin_id, 'BALANCE',
              CASE WHEN v_total_orders_gen % 2 = 0 THEN 'CASH' ELSE 'BANK_TRANSFER' END,
              v_total - v_deposit,
              'DESK-REC-' || (300000 + v_total_orders_gen),
              'PAID', v_checkin
            );
          END IF;

          -- Refund for cancelled orders that qualify
          IF v_status = 'CANCELLED' AND v_total_orders_gen % 56 = 0 THEN
            v_refund_id := pg_temp.seed_uuid('refund:' || v_total_orders_gen);
            INSERT INTO refunds(id, payment_id, amount, reason, status, processed_by_account_id, refunded_at)
            VALUES (
              v_refund_id, v_payment1_id, v_deposit,
              'Khách báo bận công tác trước 24h theo chính sách hoàn tiền CLB',
              'COMPLETED', v_admin_id, v_created + interval '1 day'
            );
            UPDATE orders SET paid_amount = 0, payment_status = 'UNPAID' WHERE id = v_order_id;
          END IF;
        END IF;

      END LOOP;
    END LOOP;
    RAISE NOTICE 'Total orders generated: %', v_total_orders_gen;
  END;

  -- 11. TOURNAMENTS & MATCHES
  DECLARE
    v_tr1 uuid := pg_temp.seed_uuid('tournament:1');
    v_tr2 uuid := pg_temp.seed_uuid('tournament:2');
    v_tr3 uuid := pg_temp.seed_uuid('tournament:3');
    v_tr4 uuid := pg_temp.seed_uuid('tournament:4');
    v_tr5 uuid := pg_temp.seed_uuid('tournament:5');
    v_tr6 uuid := pg_temp.seed_uuid('tournament:6');
    v_reg1 uuid;
  BEGIN
    INSERT INTO tournaments(id, organizer_account_id, name, format, start_date, end_date, location, registration_fee, registration_deadline, max_participants, status)
    VALUES
    (v_tr1, v_admin_id, 'Courtly Singles Open 2026', 'SINGLES', v_today - 30, v_today - 29, 'Courtly · Sân B01-B04', 250000, v_today - 33, 16, 'FINISHED'),
    (v_tr2, v_admin_id, 'Cup Đôi Nam Mùa Thu Courtly 2026', 'DOUBLES', v_today - 15, v_today - 14, 'Courtly · Sân A01-A04', 350000, v_today - 18, 8, 'FINISHED'),
    (v_tr3, v_admin_id, 'Giải Quần Vợt Doanh Nhân Trẻ TP.HCM', 'SINGLES', v_today - 5, v_today - 4, 'Courtly · Cụm Sân VIP & B', 400000, v_today - 8, 8, 'FINISHED'),
    (v_tr4, v_admin_id, 'Giải Vô Địch Hội Viên Mở Rộng', 'SINGLES', v_today - 2, v_today - 1, 'Courtly · Sân A & B', 200000, v_today - 5, 8, 'FINISHED'),
    (v_tr5, v_admin_id, 'Courtly Winter Doubles Championship 2026', 'DOUBLES', v_today + 7, v_today + 8, 'Courtly · Toàn cụm 10 sân', 350000, v_today + 5, 8, 'OPEN'),
    (v_tr6, v_admin_id, 'Giải Đơn Phong Trào NextGen Cup', 'SINGLES', v_today + 14, v_today + 15, 'Courtly · Sân B01-B04', 200000, v_today + 11, 16, 'OPEN');

    FOR k IN 1..4 LOOP
      v_reg1 := pg_temp.seed_uuid('reg:tr1:' || k);
      INSERT INTO tournament_registrations(id, tournament_id, account_id, registered_by_account_id, team_name, status, registered_at)
      VALUES (v_reg1, v_tr1, pg_temp.seed_uuid('customer:' || k), v_admin_id, 'VĐV ' || k, 'CONFIRMED', v_today - 35);

      INSERT INTO team_members(id, registration_id, tournament_id, account_id, member_name, email)
      SELECT pg_temp.seed_uuid('member:tr1:' || k), v_reg1, v_tr1, id, full_name, email FROM accounts WHERE id = pg_temp.seed_uuid('customer:' || k);

      INSERT INTO payments(id, registration_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
      VALUES (pg_temp.seed_uuid('fee:tr1:' || k), v_reg1, v_admin_id, 'TOURNAMENT_FEE', 'BANK_TRANSFER', 250000, 'FEE-TR1-' || k, 'PAID', v_today - 35);
    END LOOP;

    INSERT INTO matches(id, tournament_id, registration1_id, registration2_id, winner_registration_id, round_number, bracket_index, round_name, score, status)
    VALUES
    (pg_temp.seed_uuid('match:tr1:semi1'), v_tr1, pg_temp.seed_uuid('reg:tr1:1'), pg_temp.seed_uuid('reg:tr1:2'), pg_temp.seed_uuid('reg:tr1:1'), 1, 0, 'Bán kết 1', '6-3, 6-4', 'FINISHED'),
    (pg_temp.seed_uuid('match:tr1:semi2'), v_tr1, pg_temp.seed_uuid('reg:tr1:3'), pg_temp.seed_uuid('reg:tr1:4'), pg_temp.seed_uuid('reg:tr1:3'), 1, 1, 'Bán kết 2', '7-5, 6-2', 'FINISHED'),
    (pg_temp.seed_uuid('match:tr1:final'), v_tr1, pg_temp.seed_uuid('reg:tr1:1'), pg_temp.seed_uuid('reg:tr1:3'), pg_temp.seed_uuid('reg:tr1:1'), 2, 0, 'Chung kết', '6-4, 4-6, 7-6', 'FINISHED');

    -- Open tournament registrations (Winter Doubles)
    FOR k IN 1..6 LOOP
      v_reg1 := pg_temp.seed_uuid('reg:tr5:' || k);
      INSERT INTO tournament_registrations(id, tournament_id, account_id, registered_by_account_id, team_name, status, registered_at)
      VALUES (v_reg1, v_tr5, pg_temp.seed_uuid('customer:' || (k + 10)), v_admin_id, 'Đôi Nam ' || k, 'CONFIRMED', v_today - 3);

      INSERT INTO team_members(id, registration_id, tournament_id, account_id, member_name, email)
      SELECT pg_temp.seed_uuid('member:tr5:a:' || k), v_reg1, v_tr5, id, full_name, email FROM accounts WHERE id = pg_temp.seed_uuid('customer:' || (k + 10));

      INSERT INTO team_members(id, registration_id, tournament_id, member_name, email)
      VALUES (pg_temp.seed_uuid('member:tr5:b:' || k), v_reg1, v_tr5, 'Đồng đội ' || k, 'partner' || k || '@courtly.vn');

      INSERT INTO payments(id, registration_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at)
      VALUES (pg_temp.seed_uuid('fee:tr5:' || k), v_reg1, v_admin_id, 'TOURNAMENT_FEE', 'BANK_TRANSFER', 350000, 'FEE-WINTER-' || k, 'PAID', v_today - 3);
    END LOOP;
  END;

  -- 12. MEMBERSHIPS & RECEIPTS (20 Customers)
  DECLARE
    v_code text;
    v_pay_id text;
    v_acc uuid;
    v_cust_name text;
    v_plan text;
    v_fee numeric;
    v_disc int;
  BEGIN
    FOR n IN 1..20 LOOP
      v_acc := CASE WHEN n = 1 THEN v_demo_id ELSE pg_temp.seed_uuid('customer:' || n) END;
      SELECT full_name INTO v_cust_name FROM accounts WHERE id = v_acc;
      v_code := pg_temp.seed_uuid('membership:' || n)::text;
      v_pay_id := pg_temp.seed_uuid('membership-pay:' || n)::text;
      
      IF n % 2 = 0 THEN
        v_plan := 'Plus'; v_fee := 499000; v_disc := 15;
      ELSE
        v_plan := 'Club'; v_fee := 249000; v_disc := 10;
      END IF;

      INSERT INTO app_documents(document_key, data, version) VALUES
      ('membership:' || v_code, jsonb_build_object(
        'id', v_code, 'accountId', v_acc, 'name', v_cust_name,
        'planId', lower(v_plan), 'planName', v_plan, 'price', v_fee,
        'days', 30, 'discountPercent', v_disc, 'vipDiscountPercent', v_disc - 5,
        'advanceDays', 14, 'freeChanges', 2, 'status', 'ACTIVE',
        'startsAt', v_now - interval '15 days', 'endsAt', v_now + interval '15 days',
        'createdAt', v_now - interval '15 days', 'paymentId', v_pay_id
      )::text, 0);

      INSERT INTO app_documents(document_key, data, version) VALUES
      ('membership-payment:' || v_pay_id, jsonb_build_object(
        'id', v_pay_id, 'membershipId', v_code, 'accountId', v_acc,
        'planName', v_plan, 'amount', v_fee, 'method', 'BANK_TRANSFER',
        'transactionCode', 'MEMBER-PAY-' || (1000 + n),
        'createdAt', v_now - interval '15 days'
      )::text, 0);
    END LOOP;
  END;

  -- 13. REAL CUSTOMER FEEDBACKS (15)
  DECLARE
    v_fb_code text;
    v_msgs text[] := ARRAY[
      'Sân A01 mặt sân rất êm, độ nảy bóng chuẩn. Đèn cao áp ban đêm đánh rất thích không bị chói mắt!',
      'Dịch vụ quầy lễ tân nhanh nhẹn, nước điện giải ướp lạnh sẵn sàng. Huấn luyện viên Huy chỉ dạy nhiệt tình!',
      'Khu vực sân B mái che chơi ngày mưa tuyệt vời, không gian thoáng đãng không bị bí bách.',
      'Sân VIP V01 cực kỳ đẳng cấp, phòng thay đồ và tắm riêng sạch sẽ như resort. Sẽ tiếp tục đặt dài hạn!',
      'Hệ thống đặt sân online xem slot trực tiếp rất tiện lợi, thao tác mượt mà không lo bị trùng lịch.',
      'Trọng tài bắt vạch chuẩn xác, giải đấu tổ chức rất chuyên nghiệp. Rất mong chờ giải mùa đông!',
      'Vợt cho thuê chất lượng tốt, dòng Babolat và Wilson mới căng cước đánh rất nảy tay.',
      'Bãi đỗ xe ô tô rộng rãi, nhân viên hướng dẫn nhiệt tình. 5 sao cho Courtly!',
      'Giá cả hợp lý so với chất lượng sân tại trung tâm. Gói hội viên Plus được giảm 15% rất hời.',
      'Các bạn nhặt bóng nhanh nhẹn, phục vụ chu đáo, trận đấu diễn ra liền mạch không bị ngắt quãng.',
      'Phòng tắm nóng lạnh áp lực nước mạnh, máy sấy tóc đầy đủ, rất tiện cho người đánh xong đi làm.',
      'Sân đất cứng ngoài trời bảo dưỡng rất tốt, mặt sân không trơn trượt khi di chuyển đổi hướng.',
      'Mọi thứ đều hoàn hảo từ đặt sân đến check-in bằng mã QR chỉ mất 10 giây.',
      'Giải doanh nhân vừa rồi thi đấu rất vui, cúp và huy chương đẹp, tiệc giao lưu ấm cúng.',
      'Sân tập yêu thích nhất của nhóm mình vào mỗi sáng thứ 7. Cảm ơn đội ngũ Courtly!'
    ];
  BEGIN
    FOR n IN 1..15 LOOP
      v_fb_code := pg_temp.seed_uuid('feedback:' || n)::text;
      INSERT INTO app_documents(document_key, data, version) VALUES
      ('feedback:' || v_fb_code, jsonb_build_object(
        'id', v_fb_code,
        'accountId', pg_temp.seed_uuid('customer:' || n),
        'displayName', (SELECT full_name FROM accounts WHERE id = pg_temp.seed_uuid('customer:' || n)),
        'rating', 5,
        'topic', 'COURT',
        'message', v_msgs[n],
        'publishConsent', true,
        'status', 'PUBLISHED',
        'createdAt', v_now - (n * interval '2 days'),
        'reply', 'Courtly chân thành cảm ơn phản hồi quý giá của bạn! Hẹn gặp lại bạn trong những buổi chơi tới.'
      )::text, 0);
    END LOOP;
  END;

  -- 14. FIXTURE HANDOFF MARKER
  INSERT INTO app_documents(document_key, data, version) VALUES
  ('fixture:handoff-v1', jsonb_build_object(
    'createdAt', v_now,
    'date', v_today,
    'note', 'Comprehensive 2-month real business seed data',
    'demoEmail', 'minh.anh@example.com'
  )::text, 0);

  -- 15. AUDIT LOGS
  INSERT INTO audit_logs(id, actor, action, detail, created_at) VALUES
  (gen_random_uuid(), 'Quản Trị Viên (Tổng Quản Lý)', 'SYSTEM_INIT', 'Nạp cơ sở dữ liệu doanh nghiệp thật Courtly (2 tháng vận hành)', v_now),
  (gen_random_uuid(), 'Trần Thu Hương (Lễ tân sáng)', 'CHECK_IN', 'Check-in thành công đơn sân A01 cho khách Nguyễn Minh Anh', v_now - interval '35 minutes'),
  (gen_random_uuid(), 'Nguyễn Minh Đức (Lễ tân chiều)', 'ORDER_CONFIRM', 'Xác nhận đơn đặt sân B02 khung giờ 18:00 hôm nay', v_now - interval '20 minutes');

END $$;

-- 16. CLUB INFO & ARTICLES
INSERT INTO app_documents(document_key, data, version) VALUES
('club', '{"name": "Courtly · Tennis Club", "tagline": "Khẳng định phong độ, kết nối đam mê", "intro": "Tổ hợp 10 sân tennis tiêu chuẩn quốc tế ngoài trời, trong nhà mái che và khu VIP Lounge riêng biệt.", "story": "Được xây dựng với mục tiêu mang đến trải nghiệm tennis chuyên nghiệp nhất cho mọi tay vợt, từ phong trào đến bán chuyên. Hệ thống đặt sân trực tuyến minh bạch, bảng giá chuẩn và dịch vụ hỗ trợ toàn diện.", "mission": "Đặt trải nghiệm của người chơi làm trung tâm: mặt sân chuẩn thi đấu, hỗ trợ trọng tài giàu kinh nghiệm.", "address": "128 Đường Tennis, Khu Thể Thao Courtly, TP. Hồ Chí Minh", "phone": "0901 888 999 · 028 3888 9999", "email": "contact@courtly.vn", "openingHours": "06:00 – 23:00 · Tất cả các ngày trong tuần", "mapUrl": "", "socialUrl": "", "paymentInstructions": "Thanh toán tiền mặt tại quầy hoặc chuyển khoản theo mã QR khi câu lạc bộ đã cấu hình ngân hàng."}', 0)
ON CONFLICT(document_key) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO app_documents(document_key, data, version) VALUES
('article:choose-your-court', '{"id": "choose-your-court", "title": "Khu A, B hay VIP: Đâu là mặt sân phù hợp với bạn?", "excerpt": "Khám phá sự khác biệt giữa sân cứng ngoài trời, sân mái che mát mẻ và không gian riêng tư tại khu VIP Lounge.", "body": "1. Khu A (A01 - A04): Sân cứng ngoài trời thoáng đãng, phủ lớp sơn Decoturf giảm chấn, hệ thống đèn LED cao áp chuẩn thi đấu ban đêm.\\n\\n2. Khu B (B01 - B04): Mái che vòm cao 12m, không lo thời tiết nắng mưa thất thường, độ nảy bóng cực kỳ ổn định.\\n\\n3. Khu V (V01 - V02): Trải nghiệm đẳng cấp với phòng chờ sofa sang trọng, máy lạnh, phòng thay đồ và nhà tắm riêng tư.", "category": "NEWS", "status": "PUBLISHED", "source": "EDITORIAL", "imageUrl": "/guest/zone-b-indoor.webp", "publishedAt": "2026-10-15T08:00:00Z"}', 0)
ON CONFLICT(document_key) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO app_documents(document_key, data, version) VALUES
('article:plan-your-session', '{"id": "plan-your-session", "title": "Bí quyết chọn khung giờ và đặt sân nhanh chóng", "excerpt": "Hướng dẫn đặt sân theo bước 30 phút, linh hoạt kết hợp dịch vụ trọng tài.", "body": "Hệ thống Courtly cho phép bạn lựa chọn giờ chơi theo bước 30 phút rất linh hoạt. Bạn có thể đặt 1 tiếng, 1 tiếng 30 phút hoặc 2 tiếng liên tiếp.\\n\\nĐặc biệt, hội viên Club và Plus được ưu tiên đặt trước đến 21 ngày và giảm trực tiếp từ 10% đến 15% tiền sân.", "category": "NEWS", "status": "PUBLISHED", "source": "EDITORIAL", "imageUrl": "/guest/zone-a-outdoor.webp", "publishedAt": "2026-10-18T09:30:00Z"}', 0)
ON CONFLICT(document_key) DO UPDATE SET data = EXCLUDED.data;

COMMIT;
""")

    output_path = "database/test_data.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Successfully generated seed script at {output_path} ({len(lines)} lines).")

if __name__ == "__main__":
    main()
