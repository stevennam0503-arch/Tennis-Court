package com.courtly.service;

import static com.courtly.util.Rules.ZONE;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DemoResetService {
  private final JdbcTemplate jdbc;
  private final AuditService audit;
  private final DemoAccessPolicy demo;
  private final DocumentService documents;

  private static final String ADMIN_ID = "b27fe32c-e9b7-44bf-8149-81bc00b5bbba";
  private static final String STAFF_ID = "f21bd5fa-cf66-4ee4-a009-3a337eebc6fa";
  private static final String NAM_ID = "44444444-4444-4444-4444-444444444444";
  private static final String HA_ID = "55555555-5555-5555-5555-555555555555";
  private static final String THAO_ID = "66666666-4444-4444-4444-444444444444";
  private static final String DUC_ID = "77777777-4444-4444-4444-444444444444";
  private static final String PHUONG_ID = "88888888-4444-4444-4444-444444444444";
  private static final String LONG_ID = "99999999-4444-4444-4444-444444444444";

  private static final String BCRYPT_123456 = "$2a$12$UUtz0fA3mVVqyAxke7itjuFI22Q62Kl0DN2ythRJEJc6xub.js6le";

  @Transactional
  public void resetShowcaseData() {
    try {
      resetShowcaseDataInternal();
    } catch (Exception e) {
      log.error("LỖI ĐẶT LẠI DỮ LIỆU: ", e);
      throw e;
    }
  }

  private void resetShowcaseDataInternal() {
    demo.requireEnabled();
    documents.mutationLock();
    log.info("Bắt đầu đặt lại dữ liệu chuẩn Hội đồng (Comprehensive Golden Showcase)...");

    LocalDate today = LocalDate.now(ZONE);
    LocalDate yesterday = today.minusDays(1);
    LocalDate twoDaysAgo = today.minusDays(2);
    LocalDate tomorrow = today.plusDays(1);
    LocalDate dayAfterTomorrow = today.plusDays(2);

    String todayStr = today.toString();
    String yesterdayStr = yesterday.toString();
    String twoDaysAgoStr = twoDaysAgo.toString();
    String tomorrowStr = tomorrow.toString();
    String dayAfterTomorrowStr = dayAfterTomorrow.toString();

    // 1. Dọn dẹp dữ liệu phát sinh
    jdbc.execute("DELETE FROM match_staff");
    jdbc.execute("DELETE FROM match_slots");
    jdbc.execute("DELETE FROM matches");
    jdbc.execute("DELETE FROM team_members");
    jdbc.execute("DELETE FROM refunds");
    jdbc.execute("DELETE FROM payments");
    jdbc.execute("DELETE FROM voucher_redemptions");
    jdbc.execute("DELETE FROM booking_staff");
    jdbc.execute("DELETE FROM booking_slots");
    jdbc.execute("DELETE FROM order_products");
    jdbc.execute("DELETE FROM bookings");
    jdbc.execute("DELETE FROM orders");
    jdbc.execute("UPDATE vouchers SET used_count = 0");
    jdbc.execute("DELETE FROM tournament_registrations");

    // Xóa các tài khoản tạm / phát sinh kiểm thử, giữ lại bộ 8 tài khoản chuẩn
    jdbc.execute("DELETE FROM accounts WHERE email NOT IN ('admin@gmail.com', 'staff@gmail.com', 'hoangnam@gmail.com', 'khachmoi@gmail.com', 'thao.le@gmail.com', 'minhduc@gmail.com', 'phuong.vu@gmail.com', 'hoanglong@gmail.com')");

    // Đưa toàn bộ slot về AVAILABLE và dọn dẹp các slot bất thường nếu có
    jdbc.execute("DELETE FROM court_schedules WHERE extract(second from start_time) != 0 OR extract(minute from start_time) % 30 != 0 OR extract(second from end_time) != 0 OR extract(minute from end_time) % 30 != 0");
    jdbc.execute("UPDATE court_schedules SET status = 'AVAILABLE'");

    // Đảm bảo 8 tài khoản hệ thống chuẩn luôn tồn tại
    String upsertAccountsSql = String.format(
        """
        INSERT INTO accounts (id, email, full_name, phone, role, status, password_hash, created_at, auth_version)
        VALUES 
          ('%s', 'admin@gmail.com', 'Quản trị Courtly', '0909999999', 'ADMIN', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'staff@gmail.com', 'Lễ tân Courtly (Staff)', '0908888888', 'STAFF', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'hoangnam@gmail.com', 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'khachmoi@gmail.com', 'Lê Thu Hà (Khách mới)', '0987654321', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'thao.le@gmail.com', 'Lê Thị Thảo', '0913555777', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'minhduc@gmail.com', 'Phạm Minh Đức', '0988666555', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'phuong.vu@gmail.com', 'Vũ Mai Phương', '0903111222', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'hoanglong@gmail.com', 'Đặng Hoàng Long', '0938444333', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0)
        ON CONFLICT (id) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          password_hash = COALESCE(accounts.password_hash, EXCLUDED.password_hash);
        """,
        ADMIN_ID, BCRYPT_123456,
        STAFF_ID, BCRYPT_123456,
        NAM_ID, BCRYPT_123456,
        HA_ID, BCRYPT_123456,
        THAO_ID, BCRYPT_123456,
        DUC_ID, BCRYPT_123456,
        PHUONG_ID, BCRYPT_123456,
        LONG_ID, BCRYPT_123456
    );
    jdbc.execute(upsertAccountsSql);

    // 2. Khởi tạo danh mục Nước uống & Dụng cụ thuê nếu chưa có
    seedCatalogItemsIfEmpty();

    // 3. Khởi tạo mã giảm giá Vouchers
    seedVouchers();

    // 4. Sinh court_schedules chuẩn 30 phút (06:00 - 22:00) cho các ngày cần thiết
    String seedSlotsSql = String.format(
        """
        DO $$
        DECLARE
            c RECORD;
            d DATE;
            m INT;
            st TIME;
            et TIME;
            pr NUMERIC;
        BEGIN
            FOR d IN SELECT unnest(ARRAY['%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE]) LOOP
                FOR c IN SELECT id, base_price FROM courts WHERE status != 'DELETED' LOOP
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
        """,
        twoDaysAgoStr, yesterdayStr, todayStr, tomorrowStr, dayAfterTomorrowStr,
        today.plusDays(7).toString(), today.plusDays(14).toString(), today.plusDays(21).toString()
    );
    jdbc.execute(seedSlotsSql);

    // Lấy ID các sân
    UUID courtA01 = getCourtIdByName("Sân A01");
    UUID courtA02 = getCourtIdByName("Sân A02");
    UUID courtA03 = getCourtIdByName("Sân A03");
    UUID courtA04 = getCourtIdByName("Sân A04");
    UUID courtB01 = getCourtIdByName("Sân B01");
    UUID courtB02 = getCourtIdByName("Sân B02");
    UUID courtB03 = getCourtIdByName("Sân B03");
    UUID courtB04 = getCourtIdByName("Sân B04");
    UUID courtV01 = getCourtIdByName("Sân V01");
    UUID courtV02 = getCourtIdByName("Sân V02");

    // Lấy trọng tài & đồ uống
    UUID refereeId = getRefereeStaffId();
    BigDecimal refereeRate = BigDecimal.valueOf(250000.00);
    UUID drinkPocari = getDrinkIdByName("Pocari Sweat");

    // Lấy giải đấu
    UUID tournId = getOrOpenTournamentId();

    // -----------------------------------------------------------------------------------------
    // A. CÁC ĐƠN ĐANG DÙNG SÂN HÔM NAY (IN-USE TODAY)
    // -----------------------------------------------------------------------------------------
    LocalTime nowLocal = LocalTime.now(ZONE);
    int nowTotalMinutes = nowLocal.getHour() * 60 + nowLocal.getMinute();
    int prevHalfHour = (nowTotalMinutes / 30) * 30;
    int nextHalfHour = prevHalfHour + 30;
    int futureHalfHour = prevHalfHour + 90;

    // Đảm bảo nằm trong khung giờ mở cửa 06:00 - 22:00 (360 - 1320 phút)
    if (prevHalfHour < 420 || futureHalfHour > 1320) {
      prevHalfHour = 600; // 10:00
      nextHalfHour = 660; // 11:00
      futureHalfHour = 720; // 12:00
    }

    String graceStartStr = String.format("%02d:%02d:00", (prevHalfHour - 60) / 60, (prevHalfHour - 60) % 60);
    String graceEndStr = String.format("%02d:%02d:00", prevHalfHour / 60, prevHalfHour % 60);

    String expStartStr = String.format("%02d:%02d:00", (nextHalfHour - 60) / 60, (nextHalfHour - 60) % 60);
    String expEndStr = String.format("%02d:%02d:00", nextHalfHour / 60, nextHalfHour % 60);

    String playStartStr = String.format("%02d:%02d:00", (prevHalfHour) / 60, (prevHalfHour) % 60);
    String playEndStr = String.format("%02d:%02d:00", futureHalfHour / 60, futureHalfHour % 60);

    // 1. ĐƠN 1: IN-USE PLAYING - Sân A01 hôm nay (Trần Hoàng Nam VIP Plus)
    // Đang chơi, kết thúc sau thời điểm hiện tại. Kèm 2 chai Pocari Sweat. Đã cọc 50%, còn nợ 50%
    String ord1Id = "11111111-1111-1111-1111-111111111111";
    String bkg1Id = "11111111-1111-1111-1111-222222222222";
    String pay1Id = "11111111-1111-1111-1111-333333333333";
    String meta1 = "{\"customerFlow\": true, \"membershipBenefit\": {\"gross\": 400000, \"discount\": 60000, \"net\": 340000, \"planName\": \"Plus\", \"discountPercent\": 15}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CHECKED_IN', 380000.00, 190000.00, 190000.00, 'PARTIAL', NOW() - interval '2 hours', 0, ?)",
        ord1Id, NAM_ID, NAM_ID, meta1
    );
    jdbc.update(
        "INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '45 minutes', NOW() - interval '2 hours')",
        bkg1Id, ord1Id
    );
    jdbc.update(
        "INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 190000.00, 'PAY-NOW-001', 'PAID', NOW() - interval '2 hours')",
        pay1Id, ord1Id, STAFF_ID
    );
    bookCourtSlots(courtA01, todayStr, playStartStr, playEndStr, bkg1Id);
    if (drinkPocari != null) {
      jdbc.update(
          "INSERT INTO order_products (id, order_id, booking_id, item_type, drink_id, quantity, unit_price, issued_at) VALUES (gen_random_uuid(), ?::uuid, ?::uuid, 'DRINK', ?::uuid, 2, 20000.00, NOW() - interval '30 minutes')",
          ord1Id, bkg1Id, drinkPocari
      );
    }

    // 2. ĐƠN 2: IN-USE EXPIRING_SOON (Sắp hết giờ chơi) - Sân A04 hôm nay
    String ord2ExpId = "12121212-1212-1212-1212-111111111111";
    String bkg2ExpId = "12121212-1212-1212-1212-222222222222";
    String pay2ExpId = "12121212-1212-1212-1212-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thị Thảo [Sắp hết giờ]', '0913555777', 'CHECKED_IN', 300000.00, 150000.00, 150000.00, 'PARTIAL', NOW() - interval '50 minutes', 0, '{\"customerFlow\": true}')",
        ord2ExpId, THAO_ID, THAO_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '50 minutes', NOW() - interval '50 minutes')", bkg2ExpId, ord2ExpId);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 150000.00, 'PAY-EXP-002', 'PAID', NOW() - interval '50 minutes')", pay2ExpId, ord2ExpId, STAFF_ID);
    bookCourtSlots(courtA04, todayStr, expStartStr, expEndStr, bkg2ExpId);

    // 3. ĐƠN 3: IN-USE GRACE_PERIOD (Vừa hết giờ cách vài phút - ân hạn 15p) - Sân B04 hôm nay
    String ord3GraceId = "13131313-1313-1313-1313-111111111111";
    String bkg3GraceId = "13131313-1313-1313-1313-222222222222";
    String pay3GraceId = "13131313-1313-1313-1313-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Đặng Hoàng Long [Ân hạn 15p]', '0938444333', 'CHECKED_IN', 450000.00, 200000.00, 200000.00, 'PARTIAL', NOW() - interval '65 minutes', 0, '{\"customerFlow\": true}')",
        ord3GraceId, LONG_ID, LONG_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '65 minutes', NOW() - interval '65 minutes')", bkg3GraceId, ord3GraceId);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-GRACE-003', 'PAID', NOW() - interval '65 minutes')", pay3GraceId, ord3GraceId, STAFF_ID);
    bookCourtSlots(courtB04, todayStr, graceStartStr, graceEndStr, bkg3GraceId);

    // 4. ĐƠN 4: IN-USE EXTENDED (Đơn đang dùng đã gia hạn thêm 30 phút) - Sân V01 hôm nay
    String ord4ExtId = "14141414-1414-1414-1414-111111111111";
    String bkg4ExtId = "14141414-1414-1414-1414-222222222222";
    String pay4ExtId = "14141414-1414-1414-1414-333333333333";
    String metaExt = "{\"customerFlow\": true, \"extensionHistory\": [{\"minutes\": 30, \"fee\": 150000, \"extendedAt\": \"" + todayStr + "T14:30:00Z\"}], \"totalExtensionMinutes\": 30, \"totalExtensionFee\": 150000}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Đã gia hạn +30p]', '0912345678', 'CHECKED_IN', 750000.00, 300000.00, 300000.00, 'PARTIAL', NOW() - interval '3 hours', 0, ?)",
        ord4ExtId, NAM_ID, NAM_ID, metaExt
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '90 minutes', NOW() - interval '3 hours')", bkg4ExtId, ord4ExtId);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-EXT-004', 'PAID', NOW() - interval '3 hours')", pay4ExtId, ord4ExtId, STAFF_ID);
    bookCourtSlots(courtV01, todayStr, "15:00:00", "17:00:00", bkg4ExtId);

    // -----------------------------------------------------------------------------------------
    // B. KHÁCH SẮP ĐẾN (UPCOMING CONFIRMED) & ĐANG GIỮ CHỖ (HOLDING 5 MINS)
    // -----------------------------------------------------------------------------------------

    // 5. ĐƠN 5: CONFIRMED - Sân B01 hôm nay 19:00 - 21:00 (Lê Thu Hà) - Test QR Check-in
    String ord5Id = "22222222-2222-2222-2222-111111111111";
    String bkg5Id = "22222222-2222-2222-2222-222222222222";
    String pay5Id = "22222222-2222-2222-2222-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thu Hà (Khách mới)', '0987654321', 'CONFIRMED', 600000.00, 300000.00, 300000.00, 'PARTIAL', NOW() - interval '4 hours', 0, '{\"customerFlow\": true}')",
        ord5Id, HA_ID, HA_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '4 hours')", bkg5Id, ord5Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-CONF-005', 'PAID', NOW() - interval '4 hours')", pay5Id, ord5Id, STAFF_ID);
    bookCourtSlots(courtB01, todayStr, "19:00:00", "21:00:00", bkg5Id);

    // 6. ĐƠN 6: CONFIRMED - Sân A01 ngày mai 08:00 - 10:00 (Phạm Minh Đức)
    String ord6Id = "26262626-2626-2626-2626-111111111111";
    String bkg6Id = "26262626-2626-2626-2626-222222222222";
    String pay6Id = "26262626-2626-2626-2626-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Phạm Minh Đức', '0988666555', 'CONFIRMED', 400000.00, 400000.00, 400000.00, 'PAID', NOW() - interval '1 hour', 0, '{\"customerFlow\": true}')",
        ord6Id, DUC_ID, DUC_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '1 hour')", bkg6Id, ord6Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 400000.00, 'PAY-CONF-006', 'PAID', NOW() - interval '1 hour')", pay6Id, ord6Id, STAFF_ID);
    bookCourtSlots(courtA01, tomorrowStr, "08:00:00", "10:00:00", bkg6Id);

    // 7. ĐƠN 7: HOLDING (đếm ngược 5 phút) - Sân V01 ngày mai 10:00 - 12:00 (Nguyễn Văn Tuấn)
    String ord7Id = "33333333-3333-3333-3333-111111111111";
    String bkg7Id = "33333333-3333-3333-3333-222222222222";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, hold_expires_at, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, NULL, ?::uuid, 'Nguyễn Văn Tuấn (Khách lẻ tại quầy)', '0977222333', 'HOLDING', NOW() + interval '5 minutes', 1000000.00, 500000.00, 0.00, 'UNPAID', NOW(), 0, '{\"customerFlow\": false, \"source\": \"COUNTER\"}')",
        ord7Id, STAFF_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'HOLDING', NOW())", bkg7Id, ord7Id);
    lockCourtSlots(courtV01, tomorrowStr, "10:00:00", "12:00:00", bkg7Id);

    // -----------------------------------------------------------------------------------------
    // C. ĐƠN CHƯA THU TIỀN (UNCOLLECTED DEBT) & CẦN CHECK-OUT ĐÓNG CA
    // -----------------------------------------------------------------------------------------

    // 8. ĐƠN 8: UNCOLLECTED 1 - Nợ từ 2 ngày trước: Sân A03 16:00 - 18:00 (Lê Thị Thảo)
    // Tổng 600.000đ, cọc 300.000đ, CÒN NỢ 300.000đ. Hiển thị báo động đỏ trong tab Đơn chưa thu tiền
    String ord8Id = "81818181-8181-8181-8181-111111111111";
    String bkg8Id = "81818181-8181-8181-8181-222222222222";
    String pay8Id = "81818181-8181-8181-8181-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thị Thảo [Chưa thu tiền]', '0913555777', 'CHECKED_IN', 600000.00, 300000.00, 300000.00, 'PARTIAL', (? || ' 15:30:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord8Id, THAO_ID, THAO_ID, twoDaysAgoStr
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', (? || ' 15:55:00+07')::timestamptz, (? || ' 15:30:00+07')::timestamptz)", bkg8Id, ord8Id, twoDaysAgoStr, twoDaysAgoStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-DEBT-008', 'PAID', (? || ' 15:35:00+07')::timestamptz)", pay8Id, ord8Id, STAFF_ID, twoDaysAgoStr);
    bookCourtSlots(courtA03, twoDaysAgoStr, "16:00:00", "18:00:00", bkg8Id);

    // 9. ĐƠN 9: UNCOLLECTED 2 - Nợ từ hôm qua kèm trọng tài: Sân V02 17:00 - 19:00 (Đặng Hoàng Long)
    // Tổng 1.500.000đ, đã cọc 500.000đ, CÒN NỢ 1.000.000đ
    String ord9Id = "82828282-8282-8282-8282-111111111111";
    String bkg9Id = "82828282-8282-8282-8282-222222222222";
    String pay9Id = "82828282-8282-8282-8282-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Đặng Hoàng Long [Nợ phí trọng tài]', '0938444333', 'CHECKED_IN', 1500000.00, 500000.00, 500000.00, 'PARTIAL', (? || ' 16:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord9Id, LONG_ID, LONG_ID, yesterdayStr
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', (? || ' 16:50:00+07')::timestamptz, (? || ' 16:00:00+07')::timestamptz)", bkg9Id, ord9Id, yesterdayStr, yesterdayStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 500000.00, 'PAY-DEBT-009', 'PAID', (? || ' 16:05:00+07')::timestamptz)", pay9Id, ord9Id, STAFF_ID, yesterdayStr);
    bookCourtWithReferee(courtV02, yesterdayStr, "17:00:00", "19:00:00", bkg9Id, refereeId, refereeRate);

    // 10. ĐƠN 10: NEED CHECKOUT - Đã trả đủ 100% nhưng chưa bấm Check-out (Phạm Minh Đức)
    // Sân A01 2 ngày trước 18:00 - 20:00. Tổng 400k, đã thanh toán đủ 400k (due = 0).
    // Xuất hiện trong tab Cần Check-out đóng ca với nút Check-out màu xanh sáng
    String ord10Id = "83838383-8383-8383-8383-111111111111";
    String bkg10Id = "83838383-8383-8383-8383-222222222222";
    String pay10_1 = "83838383-8383-8383-8383-333333333331";
    String pay10_2 = "83838383-8383-8383-8383-333333333332";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Phạm Minh Đức [Chờ check-out]', '0988666555', 'CHECKED_IN', 400000.00, 200000.00, 400000.00, 'PAID', (? || ' 17:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord10Id, DUC_ID, DUC_ID, twoDaysAgoStr
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', (? || ' 17:55:00+07')::timestamptz, (? || ' 17:00:00+07')::timestamptz)", bkg10Id, ord10Id, twoDaysAgoStr, twoDaysAgoStr);
    jdbc.update(
        "INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES " +
        "(?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-FULL-010A', 'PAID', (? || ' 17:05:00+07')::timestamptz), " +
        "(?::uuid, ?::uuid, ?::uuid, 'BALANCE', 'CASH', 200000.00, 'PAY-FULL-010B', 'PAID', (? || ' 19:55:00+07')::timestamptz)",
        pay10_1, ord10Id, STAFF_ID, twoDaysAgoStr,
        pay10_2, ord10Id, STAFF_ID, twoDaysAgoStr
    );
    bookCourtSlots(courtA01, twoDaysAgoStr, "18:00:00", "20:00:00", bkg10Id);

    // -----------------------------------------------------------------------------------------
    // D. ĐƠN HỦY CẦN XỬ LÝ (CANCELLED) & ĐƠN CẦN HOÀN TIỀN (REFUNDS)
    // -----------------------------------------------------------------------------------------

    // 11. ĐƠN 11: CANCELLED CHỜ HOÀN 100% CỌC - Khách hủy trước > 24h (Vũ Mai Phương)
    // Đặt sân A02 tuần tới 17:00 - 19:00. Đã cọc 250.000đ. Hủy trước 3 ngày.
    // Xuất hiện trong Operations tab Hủy & Payments tab Cần hoàn tiền với nút Hoàn tiền ngay (1-click)
    String ord11Id = "91919191-9191-9191-9191-111111111111";
    String bkg11Id = "91919191-9191-9191-9191-222222222222";
    String pay11Id = "91919191-9191-9191-9191-333333333333";
    String meta11 = "{\"customerFlow\": true, \"refundPending\": 250000, \"financialReview\": \"REFUND_PENDING\", \"cancellationSettlement\": {\"refundEligible\": true, \"refundPercent\": 100, \"refundAmount\": 250000, \"retainedAmount\": 0, \"reason\": \"Khách hủy trước 24 giờ (được hoàn 100% tiền cọc)\", \"cancelledAt\": \"" + todayStr + "T08:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Vũ Mai Phương [Chờ hoàn 100% cọc]', '0903111222', 'CANCELLED', 500000.00, 250000.00, 250000.00, 'PAID', NOW() - interval '1 day', 0, ?)",
        ord11Id, PHUONG_ID, PHUONG_ID, meta11
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', NOW() - interval '1 day')", bkg11Id, ord11Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 250000.00, 'PAY-REF-011', 'PAID', NOW() - interval '1 day')", pay11Id, ord11Id, STAFF_ID);
    releaseCourtSlots(courtA02, today.plusDays(7).toString(), "17:00:00", "19:00:00", bkg11Id, todayStr + " 08:00:00+07");

    // 12. ĐƠN 12: CANCELLED HOÀN 50% & GIỮ 50% - Khách hủy 12h - 24h trước trận (Đặng Hoàng Long)
    // Sân B03 ngày mai 18:00 - 20:00. Đã cọc 400.000đ. Hoàn 200.000đ, giữ lại 200.000đ
    String ord12Id = "92929292-9292-9292-9292-111111111111";
    String bkg12Id = "92929292-9292-9292-9292-222222222222";
    String pay12Id = "92929292-9292-9292-9292-333333333333";
    String meta12 = "{\"customerFlow\": true, \"refundPending\": 200000, \"financialReview\": \"REFUND_PENDING\", \"cancellationSettlement\": {\"refundEligible\": true, \"refundPercent\": 50, \"refundAmount\": 200000, \"retainedAmount\": 200000, \"reason\": \"Khách hủy trong khoảng 12h - 24h trước trận (hoàn 50% cọc, giữ lại 50%)\", \"cancelledAt\": \"" + todayStr + "T09:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Đặng Hoàng Long [Hoàn 50% cọc]', '0938444333', 'CANCELLED', 800000.00, 400000.00, 400000.00, 'PAID', NOW() - interval '18 hours', 0, ?)",
        ord12Id, LONG_ID, LONG_ID, meta12
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', NOW() - interval '18 hours')", bkg12Id, ord12Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 400000.00, 'PAY-REF-012', 'PAID', NOW() - interval '18 hours')", pay12Id, ord12Id, STAFF_ID);
    releaseCourtSlots(courtB03, tomorrowStr, "18:00:00", "20:00:00", bkg12Id, todayStr + " 09:00:00+07");

    // 13. ĐƠN 13: CANCELLED 0% HOÀN - HỦY DƯỚI 12H - GIỮ 100% CỌC (Lê Thu Hà)
    // Sân A03 hôm nay. Cọc 300.000đ. Hủy sát giờ 3 tiếng -> Giữ 100% cọc theo quy chế
    String ord13Id = "93939393-9393-9393-9393-111111111111";
    String bkg13Id = "93939393-9393-9393-9393-222222222222";
    String pay13Id = "93939393-9393-9393-9393-333333333333";
    String meta13 = "{\"customerFlow\": true, \"refundPending\": 0, \"cancellationSettlement\": {\"refundEligible\": false, \"refundPercent\": 0, \"refundAmount\": 0, \"retainedAmount\": 300000, \"reason\": \"Khách hủy dưới 12h trước giờ chơi (không đủ điều kiện hoàn cọc theo Quy chế CLB)\", \"cancelledAt\": \"" + todayStr + "T07:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thu Hà [Giữ 100% cọc hủy muộn]', '0987654321', 'CANCELLED', 600000.00, 300000.00, 300000.00, 'PAID', NOW() - interval '6 hours', 0, ?)",
        ord13Id, HA_ID, HA_ID, meta13
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', NOW() - interval '6 hours')", bkg13Id, ord13Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-CANC-013', 'PAID', NOW() - interval '6 hours')", pay13Id, ord13Id, STAFF_ID);
    releaseCourtSlots(courtA03, todayStr, "11:00:00", "13:00:00", bkg13Id, todayStr + " 07:00:00+07");

    // 14. ĐƠN 14: CANCELLED ĐÃ HOÀN TẤT (DONE) - Sân A03 2 ngày trước (Vũ Mai Phương)
    String ord14Id = "66666666-6666-6666-6666-111111111111";
    String bkg14Id = "66666666-6666-6666-6666-222222222222";
    String pay14Id = "66666666-6666-6666-6666-333333333333";
    String ref14Id = "66666666-6666-6666-6666-444444444444";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Vũ Mai Phương [Đã hoàn xong]', '0903111222', 'CANCELLED', 400000.00, 200000.00, 60000.00, 'PARTIAL', (? || ' 09:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord14Id, PHUONG_ID, PHUONG_ID, twoDaysAgoStr
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', (? || ' 09:00:00+07')::timestamptz)", bkg14Id, ord14Id, twoDaysAgoStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-CANC-014', 'PAID', (? || ' 09:10:00+07')::timestamptz)", pay14Id, ord14Id, STAFF_ID, twoDaysAgoStr);
    jdbc.update("INSERT INTO refunds (id, payment_id, processed_by_account_id, amount, reason, status, refunded_at) VALUES (?::uuid, ?::uuid, ?::uuid, 140000.00, 'Khách hủy trước 24 giờ (đã hoàn 70%)', 'DONE', (? || ' 14:00:00+07')::timestamptz)", ref14Id, pay14Id, ADMIN_ID, twoDaysAgoStr);
    releaseCourtSlots(courtA03, twoDaysAgoStr, "18:00:00", "20:00:00", bkg14Id, twoDaysAgoStr + " 14:00:00+07");

    // -----------------------------------------------------------------------------------------
    // E. ĐƠN ĐỊNH KỲ (RECURRING), HOÀN TẤT CÓ HÓA ĐƠN & PHÂN CÔNG TRỌNG TÀI
    // -----------------------------------------------------------------------------------------

    // 15. ĐƠN 15: RECURRING (Định kỳ 4 tuần) - Sân B02 16:00 - 18:00 (Trần Hoàng Nam VIP Plus)
    String ord15Id = "44444444-4444-4444-4444-111111111111";
    String bkg15Id = "44444444-4444-4444-4444-222222222222";
    String pay15Id = "44444444-4444-4444-4444-333333333333";
    String meta15 = String.format(
        "{\"customerFlow\": true, \"recurringWeeks\": 4, \"recurringType\": \"WEEKLY\", \"recurringSummary\": \"Định kỳ 4 tuần (%s đến %s)\", \"membershipBenefit\": {\"gross\": 2400000, \"discount\": 360000, \"net\": 2040000, \"planName\": \"Plus\", \"discountPercent\": 15}}",
        todayStr, today.plusDays(21).toString()
    );
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CONFIRMED', 2040000.00, 1020000.00, 1020000.00, 'PARTIAL', NOW() - interval '1 day', 0, ?)",
        ord15Id, NAM_ID, NAM_ID, meta15
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '1 day')", bkg15Id, ord15Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 1020000.00, 'PAY-RECUR-015', 'PAID', NOW() - interval '1 day')", pay15Id, ord15Id, STAFF_ID);
    for (int w = 0; w < 4; w++) {
      String wDate = today.plusDays(7L * w).toString();
      bookCourtSlots(courtB02, wDate, "16:00:00", "18:00:00", bkg15Id);
    }

    // 16. ĐƠN 16: COMPLETED có hóa đơn - Sân A02 hôm qua 17:00 - 19:00 (Phạm Minh Đức)
    String ord16Id = "55555555-5555-5555-5555-111111111111";
    String bkg16Id = "55555555-5555-5555-5555-222222222222";
    String pay16_1 = "55555555-5555-5555-5555-333333333331";
    String pay16_2 = "55555555-5555-5555-5555-333333333332";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, invoice_number, issued_at, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Phạm Minh Đức', '0988666555', 'COMPLETED', 400000.00, 200000.00, 400000.00, 'PAID', 'INV-20261030-001', (? || ' 19:05:00+07')::timestamptz, (? || ' 10:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord16Id, DUC_ID, DUC_ID, yesterdayStr, yesterdayStr
    );
    jdbc.update(
        "INSERT INTO bookings (id, order_id, status, check_in_at, check_out_at, created_at) " +
        "VALUES (?::uuid, ?::uuid, 'COMPLETED', (? || ' 16:55:00+07')::timestamptz, (? || ' 19:02:00+07')::timestamptz, (? || ' 10:00:00+07')::timestamptz)",
        bkg16Id, ord16Id, yesterdayStr, yesterdayStr, yesterdayStr
    );
    jdbc.update(
        "INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES " +
        "(?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-DONE-016A', 'PAID', (? || ' 10:05:00+07')::timestamptz), " +
        "(?::uuid, ?::uuid, ?::uuid, 'BALANCE', 'CASH', 200000.00, 'PAY-DONE-016B', 'PAID', (? || ' 19:03:00+07')::timestamptz)",
        pay16_1, ord16Id, STAFF_ID, yesterdayStr,
        pay16_2, ord16Id, STAFF_ID, yesterdayStr
    );
    releaseCourtSlots(courtA02, yesterdayStr, "17:00:00", "19:00:00", bkg16Id, yesterdayStr + " 19:02:00+07");

    // 17. ĐƠN 17: REFEREE (Có thuê trọng tài) - Sân V02 hôm nay 17:00 - 19:00 (Đặng Hoàng Long)
    String ord17Id = "77777777-7777-7777-7777-111111111111";
    String bkg17Id = "77777777-7777-7777-7777-222222222222";
    String pay17Id = "77777777-7777-7777-7777-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Đặng Hoàng Long [Thuê trọng tài]', '0938444333', 'CONFIRMED', 1500000.00, 500000.00, 500000.00, 'PARTIAL', NOW() - interval '6 hours', 0, '{\"customerFlow\": true}')",
        ord17Id, LONG_ID, LONG_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '6 hours')", bkg17Id, ord17Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 500000.00, 'PAY-REF-017', 'PAID', NOW() - interval '6 hours')", pay17Id, ord17Id, STAFF_ID);
    bookCourtWithReferee(courtV02, todayStr, "17:00:00", "19:00:00", bkg17Id, refereeId, refereeRate);

    // -----------------------------------------------------------------------------------------
    // F. GÓI HỘI VIÊN (ACTIVE & PENDING APPROVAL)
    // -----------------------------------------------------------------------------------------
    // Xóa cache tài liệu hội viên & phản hồi cũ
    jdbc.execute("DELETE FROM app_documents WHERE document_key LIKE 'membership:%' OR document_key LIKE 'membership-payment:%' OR document_key LIKE 'request:membership:%' OR document_key LIKE 'feedback:%'");

    // 1. Membership VIP Plus ACTIVE cho Trần Hoàng Nam
    String memNamId = UUID.randomUUID().toString();
    String memNamPayId = UUID.randomUUID().toString();
    String memStart = today.getYear() + "-" + String.format("%02d", today.getMonthValue()) + "-01T00:00:00Z";
    LocalDate sixtyDaysLater = today.plusDays(60);
    String memEnd = sixtyDaysLater.getYear() + "-" + String.format("%02d", sixtyDaysLater.getMonthValue()) + "-28T23:59:59Z";

    String memNamDocJson = String.format(
        "{\"id\": \"%s\", \"accountId\": \"%s\", \"planId\": \"plus\", \"planName\": \"Plus\", \"startsAt\": \"%s\", \"endsAt\": \"%s\", \"status\": \"ACTIVE\", \"discountPercent\": 15, \"vipDiscountPercent\": 10, \"price\": 499000, \"rescheduleUsage\": 0}",
        memNamId, NAM_ID, memStart, memEnd
    );
    String memNamPayDocJson = String.format(
        "{\"id\": \"%s\", \"membershipId\": \"%s\", \"accountId\": \"%s\", \"planId\": \"plus\", \"planName\": \"Plus\", \"amount\": 499000, \"createdAt\": \"%sT08:00:00Z\", \"status\": \"PAID\", \"method\": \"BANK_TRANSFER\", \"transactionCode\": \"MEM-PLUS-001\"}",
        memNamPayId, memNamId, NAM_ID, todayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership:" + NAM_ID, memNamDocJson);
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership-payment:" + memNamPayId, memNamPayDocJson);

    // 2. Membership Club ACTIVE cho Lê Thị Thảo
    String memThaoId = UUID.randomUUID().toString();
    String memThaoPayId = UUID.randomUUID().toString();
    LocalDate fortyFiveDaysLater = today.plusDays(45);
    String memThaoEnd = fortyFiveDaysLater.getYear() + "-" + String.format("%02d", fortyFiveDaysLater.getMonthValue()) + "-28T23:59:59Z";

    String memThaoDocJson = String.format(
        "{\"id\": \"%s\", \"accountId\": \"%s\", \"planId\": \"club\", \"planName\": \"Club\", \"startsAt\": \"%s\", \"endsAt\": \"%s\", \"status\": \"ACTIVE\", \"discountPercent\": 5, \"vipDiscountPercent\": 0, \"price\": 199000, \"rescheduleUsage\": 0}",
        memThaoId, THAO_ID, memStart, memThaoEnd
    );
    String memThaoPayDocJson = String.format(
        "{\"id\": \"%s\", \"membershipId\": \"%s\", \"accountId\": \"%s\", \"planId\": \"club\", \"planName\": \"Club\", \"amount\": 199000, \"createdAt\": \"%sT09:00:00Z\", \"status\": \"PAID\", \"method\": \"BANK_TRANSFER\", \"transactionCode\": \"MEM-CLUB-002\"}",
        memThaoPayId, memThaoId, THAO_ID, yesterdayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership:" + THAO_ID, memThaoDocJson);
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership-payment:" + memThaoPayId, memThaoPayDocJson);

    // 3. Membership Request PENDING cho Lê Thu Hà (Khách mới chờ duyệt thanh toán)
    String reqHaDocJson = String.format(
        "{\"accountId\": \"%s\", \"accountName\": \"Lê Thu Hà (Khách mới)\", \"accountPhone\": \"0987654321\", \"planId\": \"plus\", \"planName\": \"Plus\", \"amount\": 499000, \"status\": \"PENDING\", \"createdAt\": \"%sT10:15:00Z\", \"note\": \"Đăng ký nâng cấp gói Plus tại quầy, chờ thanh toán chuyển khoản\"}",
        HA_ID, todayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "request:membership:" + HA_ID, reqHaDocJson);

    // -----------------------------------------------------------------------------------------
    // G. PHẢN HỒI & ĐÁNH GIÁ (FEEDBACK / REVIEWS)
    // -----------------------------------------------------------------------------------------
    // 1 & 2: Feedback đã duyệt (PUBLISHED)
    String fb1Id = UUID.randomUUID().toString();
    String fb1Json = String.format(
        "{\"id\": \"%s\", \"topic\": \"COURT\", \"rating\": 5, \"status\": \"PUBLISHED\", \"published\": true, \"message\": \"Sân A01 mặt sân rất êm, độ nảy bóng chuẩn. Đèn cao áp ban đêm đánh rất thích không bị chói mắt!\", \"accountId\": \"%s\", \"displayName\": \"Trần Hoàng Nam\", \"reply\": \"Courtly chân thành cảm ơn phản hồi quý giá của anh Nam! Hẹn gặp lại anh trong những buổi chơi tới.\", \"createdAt\": \"%sT08:30:00Z\", \"publishConsent\": true}",
        fb1Id, NAM_ID, yesterdayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "feedback:" + fb1Id, fb1Json);

    String fb2Id = UUID.randomUUID().toString();
    String fb2Json = String.format(
        "{\"id\": \"%s\", \"topic\": \"STAFF\", \"rating\": 5, \"status\": \"PUBLISHED\", \"published\": true, \"message\": \"Lễ tân và trọng tài hỗ trợ rất nhiệt tình, thủ tục check-in bằng mã QR cực kỳ nhanh gọn chỉ mất 2 giây.\", \"accountId\": \"%s\", \"displayName\": \"Phạm Minh Đức\", \"reply\": \"Courtly cảm ơn anh Đức rất nhiều. CLB luôn nỗ lực mang lại trải nghiệm tiện lợi nhất!\", \"createdAt\": \"%sT11:00:00Z\", \"publishConsent\": true}",
        fb2Id, DUC_ID, twoDaysAgoStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "feedback:" + fb2Id, fb2Json);

    // 3: Feedback CHƯA DUYỆT (PENDING - chưa có reply, chưa published)
    // KÍCH HOẠT CHẤM ĐỎ THÔNG BÁO TRÊN ICON 'NỘI DUNG / FEEDBACK' CỦA ADMIN
    String fb3Id = UUID.randomUUID().toString();
    String fb3Json = String.format(
        "{\"id\": \"%s\", \"topic\": \"SERVICE\", \"rating\": 4, \"status\": \"PENDING\", \"published\": false, \"message\": \"Cơ sở vật chất khang trang, nước uống pocari mát lạnh. Mong CLB sớm bổ sung thêm tủ đồ thông minh tích hợp QR code!\", \"accountId\": \"%s\", \"displayName\": \"Lê Thu Hà\", \"reply\": null, \"createdAt\": \"%sT10:00:00Z\", \"publishConsent\": true}",
        fb3Id, HA_ID, todayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "feedback:" + fb3Id, fb3Json);

    // -----------------------------------------------------------------------------------------
    // H. GIẢI ĐẤU (TOURNAMENT) & ĐĂNG KÝ VĐV
    // -----------------------------------------------------------------------------------------
    if (tournId != null) {
      jdbc.update("UPDATE tournaments SET status = 'OPEN' WHERE id = ?", tournId);
      String[][] teams = {
          {"Hoàng Nam & Minh Anh", NAM_ID, "350000"},
          {"Lê Thu Hà & Quốc Huy", HA_ID, "350000"},
          {"Phạm Minh Đức & Thanh Bình", DUC_ID, "350000"},
          {"Đặng Hoàng Long & Tấn Phát", LONG_ID, "350000"}
      };
      for (int i = 0; i < teams.length; i++) {
        String regId = UUID.randomUUID().toString();
        String payId = UUID.randomUUID().toString();
        String teamName = teams[i][0];
        String accId = teams[i][1];
        String fee = teams[i][2];

        jdbc.update(
            "INSERT INTO tournament_registrations (id, tournament_id, account_id, registered_by_account_id, team_name, skill_level, status, registered_at) " +
            "VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, 'ADVANCED', 'CONFIRMED', NOW() - (? || ' days')::interval)",
            regId, tournId.toString(), accId, STAFF_ID, teamName, i + 1
        );

        jdbc.update(
            "INSERT INTO payments (id, registration_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) " +
            "VALUES (?::uuid, ?::uuid, ?::uuid, 'TOURNAMENT_FEE', 'BANK_TRANSFER', ?::numeric, ?, 'PAID', NOW() - (? || ' days')::interval)",
            payId, regId, STAFF_ID, fee, "PAY-TOURN-00" + (i + 1), i + 1
        );
      }
    }

    log.info("Đặt lại toàn bộ dữ liệu mẫu chuẩn Hội đồng (Comprehensive Golden Showcase) thành công 100%!");
  }

  private UUID getCourtIdByName(String name) {
    List<UUID> list = jdbc.query("SELECT id FROM courts WHERE name = ? LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"), name);
    return list.isEmpty() ? null : list.get(0);
  }

  private UUID getRefereeStaffId() {
    List<UUID> list = jdbc.query("SELECT id FROM staff WHERE full_name LIKE '%Huy%' LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    if (list.isEmpty()) {
      list = jdbc.query("SELECT id FROM staff LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    }
    return list.isEmpty() ? null : list.get(0);
  }

  private UUID getDrinkIdByName(String name) {
    List<UUID> list = jdbc.query("SELECT id FROM drinks WHERE name LIKE ? LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"), "%" + name + "%");
    return list.isEmpty() ? null : list.get(0);
  }

  private UUID getOrOpenTournamentId() {
    List<UUID> list = jdbc.query("SELECT id FROM tournaments WHERE status = 'OPEN' ORDER BY start_date LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    if (!list.isEmpty()) return list.get(0);
    list = jdbc.query("SELECT id FROM tournaments ORDER BY created_at DESC LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    return list.isEmpty() ? null : list.get(0);
  }

  private void seedCatalogItemsIfEmpty() {
    Integer drinkCount = jdbc.queryForObject("SELECT COUNT(*) FROM drinks", Integer.class);
    if (drinkCount == null || drinkCount == 0) {
      jdbc.execute("""
          INSERT INTO drinks (id, name, unit, unit_price, stock_quantity, status) VALUES
            (gen_random_uuid(), 'Pocari Sweat 500ml', 'Chai', 20000.00, 100, 'AVAILABLE'),
            (gen_random_uuid(), 'Nước khoáng LaVie 500ml', 'Chai', 10000.00, 150, 'AVAILABLE'),
            (gen_random_uuid(), 'Nước tăng lực Red Bull 250ml', 'Lon', 25000.00, 80, 'AVAILABLE'),
            (gen_random_uuid(), 'Nước bù điện giải Aquarius 500ml', 'Chai', 18000.00, 90, 'AVAILABLE');
          """);
    }

    Integer rentalCount = jdbc.queryForObject("SELECT COUNT(*) FROM rental_items", Integer.class);
    if (rentalCount == null || rentalCount == 0) {
      jdbc.execute("""
          INSERT INTO rental_items (id, name, category, brand, price_per_hour, stock_quantity, status, version) VALUES
            (gen_random_uuid(), 'Vợt Tennis Wilson Pro Staff 97', 'RACKET', 'Wilson', 50000.00, 12, 'AVAILABLE', 0),
            (gen_random_uuid(), 'Vợt Tennis Babolat Pure Drive', 'RACKET', 'Babolat', 50000.00, 10, 'AVAILABLE', 0),
            (gen_random_uuid(), 'Giỏ bóng tập Head Tour 60 quả', 'BALLS', 'Head', 40000.00, 8, 'AVAILABLE', 0);
          """);
    }
  }

  private void seedVouchers() {
    jdbc.execute("""
        INSERT INTO vouchers (id, code, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, member_only, new_user_only, enabled, description)
        VALUES
          (gen_random_uuid(), 'CHAOBANMOI', 'PERCENT', 20.00, 150000.00, 100000.00, NOW() - interval '10 days', NOW() + interval '90 days', 500, 0, 1, false, false, true, 'Giảm 20% tối đa 100k cho khách hàng mới'),
          (gen_random_uuid(), 'COURTLY50K', 'FIXED', 50000.00, 100000.00, 50000.00, NOW() - interval '10 days', NOW() + interval '90 days', 300, 0, 1, false, false, true, 'Giảm trực tiếp 50.000đ cho đơn từ 100k'),
          (gen_random_uuid(), 'VIP10', 'PERCENT', 10.00, 200000.00, 100000.00, NOW() - interval '10 days', NOW() + interval '90 days', 1000, 0, 2, true, false, true, 'Ưu đãi 10% đặc quyền dành cho Hội viên'),
          (gen_random_uuid(), 'FLASH25', 'PERCENT', 25.00, 100000.00, 150000.00, NOW() - interval '10 days', NOW() + interval '90 days', 200, 0, 1, false, false, true, 'Khuyến mãi giờ vàng 25% tối đa 150k'),
          (gen_random_uuid(), 'HETHAN2025', 'FIXED', 30000.00, 100000.00, 30000.00, NOW() - interval '60 days', NOW() - interval '1 day', 100, 0, 1, false, false, true, 'Mã giảm giá đã hết hạn')
        ON CONFLICT (code) DO UPDATE SET
          used_count = 0,
          enabled = EXCLUDED.enabled,
          expires_at = EXCLUDED.expires_at,
          value = EXCLUDED.value;
        """);
  }

  private void bookCourtSlots(UUID courtId, String dateStr, String startTime, String endTime, String bookingId) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    for (Map<String, Object> s : slots) {
      UUID slotId = (UUID) s.get("id");
      BigDecimal price = (BigDecimal) s.get("price");
      jdbc.update("UPDATE court_schedules SET status = 'BOOKED' WHERE id = ?", slotId);
      jdbc.update("INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?)", bookingId, slotId, price);
    }
  }

  private void lockCourtSlots(UUID courtId, String dateStr, String startTime, String endTime, String bookingId) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    for (Map<String, Object> s : slots) {
      UUID slotId = (UUID) s.get("id");
      BigDecimal price = (BigDecimal) s.get("price");
      jdbc.update("UPDATE court_schedules SET status = 'LOCKED' WHERE id = ?", slotId);
      jdbc.update("INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?)", bookingId, slotId, price);
    }
  }

  private void releaseCourtSlots(UUID courtId, String dateStr, String startTime, String endTime, String bookingId, String releasedAtStr) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    for (Map<String, Object> s : slots) {
      UUID slotId = (UUID) s.get("id");
      BigDecimal price = (BigDecimal) s.get("price");
      jdbc.update(
          "INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price, released_at) VALUES (gen_random_uuid(), ?::uuid, ?, ?, ?::timestamptz)",
          bookingId, slotId, price, releasedAtStr
      );
    }
  }

  private void bookCourtWithReferee(UUID courtId, String dateStr, String startTime, String endTime, String bookingId, UUID refereeId, BigDecimal refereeRate) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    if (slots.size() >= 2 && refereeId != null) {
      UUID s1 = (UUID) slots.get(0).get("id");
      BigDecimal p1 = (BigDecimal) slots.get(0).get("price");
      UUID s2 = (UUID) slots.get(1).get("id");
      BigDecimal p2 = (BigDecimal) slots.get(1).get("price");

      jdbc.update("UPDATE court_schedules SET status = 'BOOKED' WHERE id IN (?, ?)", s1, s2);
      jdbc.update("INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?)", bookingId, s1, p1);
      jdbc.update("INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?)", bookingId, s2, p2);

      // Staff schedule shift 1 (17:00 - 18:00)
      List<UUID> sid1List = jdbc.query("SELECT id FROM staff_schedules WHERE staff_id = ? AND work_date = ?::date AND start_time = '17:00:00'::time", (rs, rowNum) -> (UUID) rs.getObject("id"), refereeId, dateStr);
      UUID sid1;
      if (sid1List.isEmpty()) {
        sid1 = UUID.randomUUID();
        jdbc.update("INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version) VALUES (?, ?, ?::date, '17:00:00'::time, '18:00:00'::time, 'BOOKED', 0)", sid1, refereeId, dateStr);
      } else {
        sid1 = sid1List.get(0);
        jdbc.update("UPDATE staff_schedules SET status = 'BOOKED' WHERE id = ?", sid1);
      }

      // Staff schedule shift 2 (18:00 - 19:00)
      List<UUID> sid2List = jdbc.query("SELECT id FROM staff_schedules WHERE staff_id = ? AND work_date = ?::date AND start_time = '18:00:00'::time", (rs, rowNum) -> (UUID) rs.getObject("id"), refereeId, dateStr);
      UUID sid2;
      if (sid2List.isEmpty()) {
        sid2 = UUID.randomUUID();
        jdbc.update("INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version) VALUES (?, ?, ?::date, '18:00:00'::time, '19:00:00'::time, 'BOOKED', 0)", sid2, refereeId, dateStr);
      } else {
        sid2 = sid2List.get(0);
        jdbc.update("UPDATE staff_schedules SET status = 'BOOKED' WHERE id = ?", sid2);
      }

      jdbc.update("INSERT INTO booking_staff (id, booking_id, staff_schedule_id, court_schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?, ?)", bookingId, sid1, s1, refereeRate);
      jdbc.update("INSERT INTO booking_staff (id, booking_id, staff_schedule_id, court_schedule_id, unit_price) VALUES (gen_random_uuid(), ?::uuid, ?, ?, ?)", bookingId, sid2, s2, refereeRate);
    }
  }
}
