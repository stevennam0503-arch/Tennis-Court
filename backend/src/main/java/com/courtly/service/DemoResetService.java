package com.courtly.service;

import static com.courtly.util.Rules.ZONE;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
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
  private final ScheduleService scheduling;
  private final com.courtly.repository.CourtScheduleRepository courtSchedules;
  private final DemoBaselineService demoBaseline;

  private static final String ADMIN_ID = "b27fe32c-e9b7-44bf-8149-81bc00b5bbba";
  private static final String STAFF_ID = "f21bd5fa-cf66-4ee4-a009-3a337eebc6fa";
  private static final String NAM_ID = "44444444-4444-4444-4444-444444444444";
  private static final String HA_ID = "55555555-5555-5555-5555-555555555555";
  private static final String THAO_ID = "66666666-4444-4444-4444-444444444444";
  private static final String DUC_ID = "77777777-4444-4444-4444-444444444444";
  private static final String PHUONG_ID = "88888888-4444-4444-4444-444444444444";
  private static final String LONG_ID = "99999999-4444-4444-4444-444444444444";
  public static final String DEMO_HOIVIEN_ID = "11111111-2222-3333-4444-555555555501";
  public static final String DEMO_KHACH_ID = "11111111-2222-3333-4444-555555555502";
  public static final String KIET_ID = "11111111-2222-3333-4444-555555555503";
  public static final String PHUONG_MAI_ID = "11111111-2222-3333-4444-555555555504";

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
    jdbc.execute("DELETE FROM staff_schedules");
    jdbc.execute("DELETE FROM order_products");
    jdbc.execute("DELETE FROM drinks");
    jdbc.execute("DELETE FROM rental_items");
    jdbc.execute("DELETE FROM bookings");
    jdbc.execute("DELETE FROM orders");
    jdbc.execute("UPDATE vouchers SET used_count = 0");
    jdbc.execute("DELETE FROM tournament_registrations");

    // 2. Khôi phục các bảng danh mục theo ảnh chụp chuẩn baseline
    demoBaseline.restoreBaseline();

    // Xóa các tài khoản tạm / phát sinh kiểm thử, giữ lại bộ tài khoản chuẩn
    jdbc.execute("DELETE FROM accounts WHERE email NOT IN ('admin@gmail.com', 'staff@gmail.com', 'hoangnam@gmail.com', 'khachmoi@gmail.com', 'thao.le@gmail.com', 'minhduc@gmail.com', 'phuong.vu@gmail.com', 'hoanglong@gmail.com', 'demo.hoivien@gmail.com', 'demo.khach@gmail.com', 'kietdlv@gmail.com', 'phuongmaiphanqn3@gmail.com')");

    // Đưa toàn bộ slot về AVAILABLE và dọn dẹp các slot bất thường nếu có
    jdbc.execute("DELETE FROM court_schedules WHERE extract(second from start_time) != 0 OR extract(minute from start_time) % 30 != 0 OR extract(second from end_time) != 0 OR extract(minute from end_time) % 30 != 0");
    jdbc.execute("UPDATE court_schedules SET status = 'AVAILABLE'");

    // Đảm bảo các tài khoản hệ thống chuẩn luôn tồn tại; mật khẩu đưa về 123456 để kịch bản demo luôn đăng nhập được
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
          ('%s', 'hoanglong@gmail.com', 'Đặng Hoàng Long', '0938444333', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'demo.hoivien@gmail.com', 'Nguyễn Minh Khoa (Demo hội viên)', '0911000001', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'demo.khach@gmail.com', 'Phạm Thu Trang (Demo khách)', '0911000002', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'kietdlv@gmail.com', 'Khách demo Kiệt', '+84769496289', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'phuongmaiphanqn3@gmail.com', 'Khách demo Phương Mai', '+84377035664', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0)
        ON CONFLICT (id) DO UPDATE SET 
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          password_hash = EXCLUDED.password_hash;
        """,
        ADMIN_ID, BCRYPT_123456,
        STAFF_ID, BCRYPT_123456,
        NAM_ID, BCRYPT_123456,
        HA_ID, BCRYPT_123456,
        THAO_ID, BCRYPT_123456,
        DUC_ID, BCRYPT_123456,
        PHUONG_ID, BCRYPT_123456,
        LONG_ID, BCRYPT_123456,
        DEMO_HOIVIEN_ID, BCRYPT_123456,
        DEMO_KHACH_ID, BCRYPT_123456,
        KIET_ID, BCRYPT_123456,
        PHUONG_MAI_ID, BCRYPT_123456
    );
    jdbc.execute(upsertAccountsSql);


    // 4. Sinh lại court_schedules 30 phút (06:00 - 23:00) theo bảng giá hiện hành (ngày thường / cuối tuần).
    // Đơn, trận và phân công đã bị xóa ở bước 1 nên các slot từ 2 ngày trước trở đi không còn bị tham chiếu;
    // những ngày khác được ScheduleService tự sinh khi có người xem lịch.
    jdbc.update("DELETE FROM court_schedules WHERE schedule_date >= ?::date", twoDaysAgoStr);
    for (LocalDate d : List.of(twoDaysAgo, yesterday, today, tomorrow, dayAfterTomorrow, today.plusDays(7), today.plusDays(14), today.plusDays(21))) {
      scheduling.generate(d);
    }
    // Slot vừa sinh qua JPA phải được ghi xuống trước khi các truy vấn JDBC bên dưới gắn chúng vào đơn
    courtSchedules.flush();
    seedRefereeSchedules(today);

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

    // Lấy trọng tài
    UUID refereeId = getRefereeStaffId();
    BigDecimal refereeRate = jdbc.queryForObject(
        "SELECT COALESCE(hourly_rate, 250000) FROM staff WHERE id = ?", BigDecimal.class, refereeId
    );
    if (refereeRate == null) refereeRate = BigDecimal.valueOf(250000.00);

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
    // Đang chơi, kết thúc sau thời điểm hiện tại. Đã cọc 50%, còn nợ 50%
    String ord1Id = "11111111-1111-1111-1111-111111111111";
    String bkg1Id = "11111111-1111-1111-1111-222222222222";
    String pay1Id = "11111111-1111-1111-1111-333333333333";
    // Số tiền của mọi đơn được tính lại từ giá slot ở reconcileSeededOrders(); ở đây chỉ ghi mức ưu đãi hội viên
    String meta1 = "{\"customerFlow\": true, \"membershipBenefit\": {\"planName\": \"Plus\", \"discountPercent\": 15}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CHECKED_IN', 340000.00, 170000.00, 170000.00, 'PARTIAL', NOW() - interval '2 hours', 0, ?)",
        ord1Id, NAM_ID, NAM_ID, meta1
    );
    jdbc.update(
        "INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '45 minutes', NOW() - interval '2 hours')",
        bkg1Id, ord1Id
    );
    jdbc.update(
        "INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 170000.00, 'PAY-NOW-001', 'PAID', NOW() - interval '2 hours')",
        pay1Id, ord1Id, STAFF_ID
    );
    bookCourtSlots(courtA01, todayStr, playStartStr, playEndStr, bkg1Id);

    // 2. ĐƠN 2: IN-USE EXPIRING_SOON (Sắp hết giờ chơi) - Sân A04 hôm nay
    String ord2ExpId = "12121212-1212-1212-1212-111111111111";
    String bkg2ExpId = "12121212-1212-1212-1212-222222222222";
    String pay2ExpId = "12121212-1212-1212-1212-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thị Thảo [Sắp hết giờ]', '0913555777', 'CHECKED_IN', 300000.00, 150000.00, 150000.00, 'PARTIAL', NOW() - interval '50 minutes', 0, '{\"customerFlow\": true, \"membershipBenefit\": {\"planName\": \"Club\", \"discountPercent\": 10}}')",
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
    // Đặt 1,5 giờ từ 1 giờ trước, đã gia hạn thêm 30 phút -> đang chơi đến 1 giờ sau thời điểm reset
    String extStartStr = String.format("%02d:%02d:00", (prevHalfHour - 60) / 60, (prevHalfHour - 60) % 60);
    String extEndStr = String.format("%02d:%02d:00", (prevHalfHour + 60) / 60, (prevHalfHour + 60) % 60);
    String extendedAt = java.time.Instant.now().minusSeconds(20 * 60).toString();
    String metaExt = "{\"customerFlow\": true, \"membershipBenefit\": {\"planName\": \"Plus\", \"discountPercent\": 10}, \"extensionHistory\": [{\"minutes\": 30, \"fee\": 0, \"extendedAt\": \"" + extendedAt + "\"}], \"totalExtensionMinutes\": 30, \"totalExtensionFee\": 0}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Đã gia hạn +30p]', '0912345678', 'CHECKED_IN', 750000.00, 300000.00, 300000.00, 'PARTIAL', NOW() - interval '3 hours', 0, ?)",
        ord4ExtId, NAM_ID, NAM_ID, metaExt
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, check_in_at, created_at) VALUES (?::uuid, ?::uuid, 'CHECKED_IN', NOW() - interval '60 minutes', NOW() - interval '3 hours')", bkg4ExtId, ord4ExtId);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-EXT-004', 'PAID', NOW() - interval '3 hours')", pay4ExtId, ord4ExtId, STAFF_ID);
    bookCourtSlots(courtV01, todayStr, extStartStr, extEndStr, bkg4ExtId);

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
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thị Thảo [Chưa thu tiền]', '0913555777', 'CHECKED_IN', 600000.00, 300000.00, 300000.00, 'PARTIAL', (? || ' 15:30:00+07')::timestamptz, 0, '{\"customerFlow\": true, \"membershipBenefit\": {\"planName\": \"Club\", \"discountPercent\": 10}}')",
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
    String meta11 = "{\"customerFlow\": true, \"refundPending\": 250000, \"financialReview\": \"REFUND_PENDING\", \"cancellationSettlement\": {\"refundEligible\": true, \"refundPercent\": 100, \"refundAmount\": 250000, \"retainedAmount\": 0, \"reason\": \"Khách hủy trước 24 giờ (được hoàn 100% tiền cọc)\", \"cancelledAt\": \"" + todayStr + "T01:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Vũ Mai Phương [Chờ hoàn 100% cọc]', '0903111222', 'CANCELLED', 500000.00, 250000.00, 250000.00, 'PAID', NOW() - interval '1 day', 0, ?)",
        ord11Id, PHUONG_ID, PHUONG_ID, meta11
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', NOW() - interval '1 day')", bkg11Id, ord11Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 250000.00, 'PAY-REF-011', 'PAID', NOW() - interval '1 day')", pay11Id, ord11Id, STAFF_ID);
    releaseCourtSlots(courtA02, today.plusDays(7).toString(), "17:00:00", "19:00:00", bkg11Id, todayStr + " 08:00:00+07");

    // 12. ĐƠN 12: CANCELLED HOÀN 50% & GIỮ 50% - Khách hủy 12h - 24h trước trận (Đặng Hoàng Long)
    // Sân B03 ngày mai 06:00 - 08:00, hủy hôm nay lúc 06:30 (23,5 tiếng trước giờ chơi) -> hoàn 50% cọc
    String ord12Id = "92929292-9292-9292-9292-111111111111";
    String bkg12Id = "92929292-9292-9292-9292-222222222222";
    String pay12Id = "92929292-9292-9292-9292-333333333333";
    String meta12 = "{\"customerFlow\": true, \"refundPending\": 200000, \"financialReview\": \"REFUND_PENDING\", \"cancellationSettlement\": {\"refundEligible\": true, \"refundPercent\": 50, \"refundAmount\": 200000, \"retainedAmount\": 200000, \"reason\": \"Khách hủy trong khoảng 12h - 24h trước trận (hoàn 50% cọc, giữ lại 50%)\", \"cancelledAt\": \"" + yesterdayStr + "T23:30:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Đặng Hoàng Long [Hoàn 50% cọc]', '0938444333', 'CANCELLED', 800000.00, 400000.00, 400000.00, 'PAID', NOW() - interval '18 hours', 0, ?)",
        ord12Id, LONG_ID, LONG_ID, meta12
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', NOW() - interval '18 hours')", bkg12Id, ord12Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 400000.00, 'PAY-REF-012', 'PAID', NOW() - interval '18 hours')", pay12Id, ord12Id, STAFF_ID);
    releaseCourtSlots(courtB03, tomorrowStr, "06:00:00", "08:00:00", bkg12Id, todayStr + " 06:30:00+07");

    // 13. ĐƠN 13: CANCELLED 0% HOÀN - HỦY DƯỚI 12H - GIỮ 100% CỌC (Lê Thu Hà)
    // Sân A03 hôm nay 11:00 - 13:00. Đặt lúc 07:30, hủy lúc 09:00 (2 tiếng trước giờ chơi) -> giữ 100% cọc
    String ord13Id = "93939393-9393-9393-9393-111111111111";
    String bkg13Id = "93939393-9393-9393-9393-222222222222";
    String pay13Id = "93939393-9393-9393-9393-333333333333";
    String meta13 = "{\"customerFlow\": true, \"refundPending\": 0, \"cancellationSettlement\": {\"refundEligible\": false, \"refundPercent\": 0, \"refundAmount\": 0, \"retainedAmount\": 300000, \"reason\": \"Khách hủy dưới 12h trước giờ chơi (không đủ điều kiện hoàn cọc theo Quy chế CLB)\", \"cancelledAt\": \"" + todayStr + "T02:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Lê Thu Hà [Giữ 100% cọc hủy muộn]', '0987654321', 'CANCELLED', 600000.00, 300000.00, 300000.00, 'PAID', (? || ' 07:30:00+07')::timestamptz, 0, ?)",
        ord13Id, HA_ID, HA_ID, todayStr, meta13
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', (? || ' 07:30:00+07')::timestamptz)", bkg13Id, ord13Id, todayStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 300000.00, 'PAY-CANC-013', 'PAID', (? || ' 07:35:00+07')::timestamptz)", pay13Id, ord13Id, STAFF_ID, todayStr);
    releaseCourtSlots(courtA03, todayStr, "11:00:00", "13:00:00", bkg13Id, todayStr + " 09:00:00+07");

    // 14. ĐƠN 14: CANCELLED ĐÃ HOÀN TẤT (DONE) - Sân A03 2 ngày trước 18:00 (Vũ Mai Phương)
    // Đặt từ hôm trước, hủy lúc 02:00 (16 tiếng trước giờ chơi) -> mốc 12h - 24h: hoàn 50% cọc, admin đã chi
    String ord14Id = "66666666-6666-6666-6666-111111111111";
    String bkg14Id = "66666666-6666-6666-6666-222222222222";
    String pay14Id = "66666666-6666-6666-6666-333333333333";
    String ref14Id = "66666666-6666-6666-6666-444444444444";
    String meta14 = "{\"customerFlow\": true, \"refundPending\": 0, \"cancellationSettlement\": {\"refundEligible\": true, \"refundPercent\": 50, \"refundAmount\": 100000, \"retainedAmount\": 100000, \"reason\": \"Khách hủy trong khoảng 12h - 24h trước trận (hoàn 50% cọc, giữ lại 50%)\", \"cancelledAt\": \"" + twoDaysAgo.minusDays(1) + "T19:00:00Z\"}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Vũ Mai Phương [Đã hoàn xong]', '0903111222', 'CANCELLED', 400000.00, 200000.00, 100000.00, 'PARTIAL', (? || ' 09:00:00+07')::timestamptz - interval '1 day', 0, ?)",
        ord14Id, PHUONG_ID, PHUONG_ID, twoDaysAgoStr, meta14
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', (? || ' 09:00:00+07')::timestamptz - interval '1 day')", bkg14Id, ord14Id, twoDaysAgoStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-CANC-014', 'PAID', (? || ' 09:10:00+07')::timestamptz - interval '1 day')", pay14Id, ord14Id, STAFF_ID, twoDaysAgoStr);
    jdbc.update("INSERT INTO refunds (id, payment_id, processed_by_account_id, amount, reason, status, refunded_at) VALUES (?::uuid, ?::uuid, ?::uuid, 100000.00, 'Khách hủy trong khoảng 12h - 24h trước giờ chơi (hoàn 50% cọc)', 'DONE', (? || ' 14:00:00+07')::timestamptz)", ref14Id, pay14Id, ADMIN_ID, twoDaysAgoStr);
    releaseCourtSlots(courtA03, twoDaysAgoStr, "18:00:00", "20:00:00", bkg14Id, twoDaysAgoStr + " 02:00:00+07");

    // -----------------------------------------------------------------------------------------
    // E. ĐƠN ĐỊNH KỲ (RECURRING), HOÀN TẤT CÓ HÓA ĐƠN & PHÂN CÔNG TRỌNG TÀI
    // -----------------------------------------------------------------------------------------

    // 15. ĐƠN 15: RECURRING (Định kỳ 4 tuần) - Sân B02 16:00 - 18:00 (Trần Hoàng Nam VIP Plus)
    String ord15Id = "44444444-4444-4444-4444-111111111111";
    String bkg15Id = "44444444-4444-4444-4444-222222222222";
    String pay15Id = "44444444-4444-4444-4444-333333333333";
    String meta15 = String.format(
        "{\"customerFlow\": true, \"recurringWeeks\": 4, \"recurringType\": \"WEEKLY\", \"recurringSummary\": \"Định kỳ 4 tuần (%s đến %s)\", \"membershipBenefit\": {\"planName\": \"Plus\", \"discountPercent\": 15}}",
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
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Phạm Minh Đức', '0988666555', 'COMPLETED', 400000.00, 200000.00, 400000.00, 'PAID', ?, (? || ' 19:05:00+07')::timestamptz, (? || ' 10:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord16Id, DUC_ID, DUC_ID, "INV-" + yesterdayStr.replace("-", "") + "-001", yesterdayStr, yesterdayStr
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
    completeCourtSlots(courtA02, yesterdayStr, "17:00:00", "19:00:00", bkg16Id, yesterdayStr + " 19:02:00+07");

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
    // F. HẠNG THÀNH VIÊN & ĐIỂM THƯỞNG (LOYALTY TIERS & REWARD POINTS)
    // -----------------------------------------------------------------------------------------
    // Xóa cache tài liệu hội viên cũ khỏi app_documents & làm sạch bảng loyalty
    jdbc.execute("DELETE FROM app_documents WHERE document_key LIKE 'membership:%' OR document_key LIKE 'membership-payment:%' OR document_key LIKE 'request:membership:%' OR document_key LIKE 'membership-plan:%'");
    jdbc.execute("DELETE FROM lounge_visits");
    jdbc.execute("DELETE FROM vip_cards");
    jdbc.execute("DELETE FROM loyalty_ledger");

    // 1. Cập nhật hạng, điểm, chi tiêu, ngày sinh, mã giới thiệu cho các tài khoản
    // Kiệt (Grand Slam, 21.500.000₫ spend, 2.400 điểm, sinh ngày 15 tháng sau)
    LocalDate kietBday = today.plusMonths(1).withDayOfMonth(15);
    jdbc.update(
        "UPDATE accounts SET tier = 'GRAND_SLAM', tier_since = NOW() - interval '45 days', tier_expires_at = NOW() + interval '320 days', " +
        "lifetime_spend = 21500000.00, points_balance = 2400, birth_date = ?::date, referral_code = 'KIET888' WHERE id = ?::uuid",
        kietBday.toString(), KIET_ID
    );

    // Nguyễn Minh Khoa - demo.hoivien (Masters, 19.800.000₫ spend, 1.500 điểm, sinh 20/03)
    jdbc.update(
        "UPDATE accounts SET tier = 'MASTERS', tier_since = NOW() - interval '60 days', tier_expires_at = NOW() + interval '305 days', " +
        "lifetime_spend = 19800000.00, points_balance = 1500, birth_date = '1993-03-20'::date, referral_code = 'KHOA999' WHERE id = ?::uuid",
        DEMO_HOIVIEN_ID
    );

    // Phạm Thu Trang - demo.khach (Challenger, 3.400.000₫ spend, 420 điểm, sinh tháng hiện tại ngày 10)
    LocalDate trangBday = today.withDayOfMonth(10);
    jdbc.update(
        "UPDATE accounts SET tier = 'CHALLENGER', tier_since = NOW() - interval '30 days', tier_expires_at = NOW() + interval '335 days', " +
        "lifetime_spend = 3400000.00, points_balance = 420, birth_date = ?::date, referral_code = 'TRANG777' WHERE id = ?::uuid",
        trangBday.toString(), DEMO_KHACH_ID
    );

    // Phương Mai - phuongmaiphanqn3 (Rookie, 0₫ spend, 0 điểm)
    jdbc.update(
        "UPDATE accounts SET tier = 'ROOKIE', tier_since = NOW(), tier_expires_at = NOW() + interval '365 days', " +
        "lifetime_spend = 0.00, points_balance = 0, referral_code = 'MAI666' WHERE id = ?::uuid",
        PHUONG_MAI_ID
    );

    // Các tài khoản mẫu khác
    jdbc.update("UPDATE accounts SET tier = 'MASTERS', lifetime_spend = 12000000.00, points_balance = 950, referral_code = 'NAM123' WHERE id = ?::uuid", NAM_ID);
    jdbc.update("UPDATE accounts SET tier = 'GRAND_SLAM', lifetime_spend = 22000000.00, points_balance = 2100, referral_code = 'DUC456' WHERE id = ?::uuid", DUC_ID);
    jdbc.update("UPDATE accounts SET tier = 'CHALLENGER', lifetime_spend = 4500000.00, points_balance = 320, referral_code = 'THAO789' WHERE id = ?::uuid", THAO_ID);
    jdbc.update("UPDATE accounts SET tier = 'CHALLENGER', lifetime_spend = 3200000.00, points_balance = 250, referral_code = 'PHUONG111' WHERE id = ?::uuid", PHUONG_ID);
    jdbc.update("UPDATE accounts SET tier = 'ROOKIE', lifetime_spend = 800000.00, points_balance = 80, referral_code = 'LONG222' WHERE id = ?::uuid", LONG_ID);
    jdbc.update("UPDATE accounts SET tier = 'ROOKIE', lifetime_spend = 0.00, points_balance = 0, referral_code = 'HA333' WHERE id = ?::uuid", HA_ID);

    // 2. Thẻ VIP Lounge & Lượt vào phòng chờ cho Kiệt
    String vipCardId = UUID.randomUUID().toString();
    jdbc.update(
        "INSERT INTO vip_cards (id, code, account_id, issued_at, expires_at, status) " +
        "VALUES (?::uuid, 'VIP-KS9876', ?::uuid, NOW() - interval '45 days', NOW() + interval '320 days', 'ACTIVE')",
        vipCardId, KIET_ID
    );
    jdbc.update(
        "INSERT INTO lounge_visits (id, card_id, checked_in_at, staff_id) " +
        "VALUES (gen_random_uuid(), ?::uuid, NOW() - interval '2 days', ?::uuid)",
        vipCardId, STAFF_ID
    );

    // 3. Đơn quá khứ (2-11 tháng trước) & Sổ điểm (loyalty_ledger)
    // Tài khoản Kiệt: 5 đơn = 21.500.000₫, 2.400 điểm (có 300 điểm hết hạn trong 20 ngày)
    BigDecimal[] kietSpends = { new BigDecimal("4500000"), new BigDecimal("4000000"), new BigDecimal("4500000"), new BigDecimal("4500000"), new BigDecimal("4000000") };
    int[] kietPoints = { 500, 450, 500, 500, 450 }; // Tổng 2400 điểm
    int[] kietMonths = { 10, 8, 6, 4, 2 };
    for (int i = 0; i < kietSpends.length; i++) {
      String pastOrdId = UUID.randomUUID().toString();
      jdbc.update(
          "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
          "VALUES (?::uuid, ?::uuid, ?::uuid, 'Khách demo Kiệt', '+84769496289', 'COMPLETED', ?, 0, ?, 'PAID', NOW() - (? || ' months')::interval, 0, '{\"seededPast\": true}')",
          pastOrdId, KIET_ID, KIET_ID, kietSpends[i], kietSpends[i], kietMonths[i]
      );
      String expClause = (i == 4) ? "NOW() + interval '20 days'" : "NOW() + interval '10 months'";
      jdbc.update(
          "INSERT INTO loyalty_ledger (id, account_id, type, points, spend_amount, order_id, expires_at, note, created_at) " +
          "VALUES (gen_random_uuid(), ?::uuid, 'EARN', ?, ?, ?::uuid, " + expClause + ", ?, NOW() - (? || ' months')::interval)",
          KIET_ID, kietPoints[i], kietSpends[i], pastOrdId, "Tích điểm đơn quá khứ " + pastOrdId.substring(0, 8), kietMonths[i]
      );
    }

    // Tài khoản Nguyễn Minh Khoa (demo.hoivien): 5 đơn = 19.800.000₫, 1.500 điểm
    BigDecimal[] khoaSpends = { new BigDecimal("4000000"), new BigDecimal("4000000"), new BigDecimal("4000000"), new BigDecimal("4000000"), new BigDecimal("3800000") };
    int[] khoaPoints = { 300, 300, 300, 300, 300 }; // Tổng 1500 điểm
    int[] khoaMonths = { 10, 8, 6, 4, 2 };
    for (int i = 0; i < khoaSpends.length; i++) {
      String pastOrdId = UUID.randomUUID().toString();
      jdbc.update(
          "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
          "VALUES (?::uuid, ?::uuid, ?::uuid, 'Nguyễn Minh Khoa (Demo hội viên)', '0911000001', 'COMPLETED', ?, 0, ?, 'PAID', NOW() - (? || ' months')::interval, 0, '{\"seededPast\": true}')",
          pastOrdId, DEMO_HOIVIEN_ID, DEMO_HOIVIEN_ID, khoaSpends[i], khoaSpends[i], khoaMonths[i]
      );
      jdbc.update(
          "INSERT INTO loyalty_ledger (id, account_id, type, points, spend_amount, order_id, expires_at, note, created_at) " +
          "VALUES (gen_random_uuid(), ?::uuid, 'EARN', ?, ?, ?::uuid, NOW() + interval '10 months', ?, NOW() - (? || ' months')::interval)",
          DEMO_HOIVIEN_ID, khoaPoints[i], khoaSpends[i], pastOrdId, "Tích điểm đơn quá khứ " + pastOrdId.substring(0, 8), khoaMonths[i]
      );
    }

    // Tài khoản Phạm Thu Trang (demo.khach): 2 đơn = 3.400.000₫, 420 điểm
    BigDecimal[] trangSpends = { new BigDecimal("1700000"), new BigDecimal("1700000") };
    int[] trangPoints = { 210, 210 }; // Tổng 420 điểm
    int[] trangMonths = { 4, 2 };
    for (int i = 0; i < trangSpends.length; i++) {
      String pastOrdId = UUID.randomUUID().toString();
      jdbc.update(
          "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
          "VALUES (?::uuid, ?::uuid, ?::uuid, 'Phạm Thu Trang (Demo khách)', '0911000002', 'COMPLETED', ?, 0, ?, 'PAID', NOW() - (? || ' months')::interval, 0, '{\"seededPast\": true}')",
          pastOrdId, DEMO_KHACH_ID, DEMO_KHACH_ID, trangSpends[i], trangSpends[i], trangMonths[i]
      );
      jdbc.update(
          "INSERT INTO loyalty_ledger (id, account_id, type, points, spend_amount, order_id, expires_at, note, created_at) " +
          "VALUES (gen_random_uuid(), ?::uuid, 'EARN', ?, ?, ?::uuid, NOW() + interval '10 months', ?, NOW() - (? || ' months')::interval)",
          DEMO_KHACH_ID, trangPoints[i], trangSpends[i], pastOrdId, "Tích điểm đơn quá khứ " + pastOrdId.substring(0, 8), trangMonths[i]
      );
    }

    // 4. Voucher đặc thù cho các tài khoản demo
    // Voucher 300.000₫ thăng hạng Grand Slam của Kiệt
    jdbc.update(
        "INSERT INTO vouchers (id, code, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, enabled, member_only, new_user_only, description, status, assigned_account_id, source) " +
        "VALUES (gen_random_uuid(), 'TIER-GS-300K', 'FIXED', 300000.00, 0, 300000.00, NOW() - interval '45 days', NOW() + interval '60 days', 1, 0, 1, true, false, false, 'Quà thăng hạng Grand Slam (giảm 300.000₫)', 'ACTIVE', ?::uuid, 'TIER_GIFT') " +
        "ON CONFLICT (code) DO UPDATE SET assigned_account_id = EXCLUDED.assigned_account_id, enabled = true, used_count = 0",
        KIET_ID
    );

    // Voucher sinh nhật 60.000₫ của Trang (tháng hiện tại)
    jdbc.update(
        "INSERT INTO vouchers (id, code, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, enabled, member_only, new_user_only, description, status, assigned_account_id, source) " +
        "VALUES (gen_random_uuid(), 'BDAY-CHALLENGER-60K', 'FIXED', 60000.00, 0, 60000.00, date_trunc('month', NOW()), (date_trunc('month', NOW()) + interval '1 month - 1 second'), 1, 0, 1, true, false, false, 'Voucher sinh nhật hạng Challenger (giảm 60.000₫)', 'ACTIVE', ?::uuid, 'BIRTHDAY') " +
        "ON CONFLICT (code) DO UPDATE SET assigned_account_id = EXCLUDED.assigned_account_id, enabled = true, used_count = 0",
        DEMO_KHACH_ID
    );

    // Voucher chào mừng 50.000₫ của Phương Mai
    jdbc.update(
        "INSERT INTO vouchers (id, code, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, enabled, member_only, new_user_only, description, status, assigned_account_id, source) " +
        "VALUES (gen_random_uuid(), 'WELCOME-50K', 'FIXED', 50000.00, 0, 50000.00, NOW() - interval '1 day', NOW() + interval '30 days', 1, 0, 1, true, false, false, 'Voucher chào mừng thành viên mới (giảm 50.000₫)', 'ACTIVE', ?::uuid, 'TIER_GIFT') " +
        "ON CONFLICT (code) DO UPDATE SET assigned_account_id = EXCLUDED.assigned_account_id, enabled = true, used_count = 0",
        PHUONG_MAI_ID
    );

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

    // 4: Feedback ĐÁNH GIÁ THẤP (LOW_RATING - 2 sao, trạng thái NEW, hạn 24h)
    // Demo quy trình Service Recovery và nút Tặng voucher bù ngay sau reset
    String fb4Id = UUID.randomUUID().toString();
    String fb4Json = String.format(
        "{\"id\": \"%s\", \"topic\": \"COURT\", \"rating\": 2, \"status\": \"PENDING\", \"published\": false, \"lowRating\": true, \"handlingStatus\": \"NEW\", \"dueAt\": \"%sT23:59:59Z\", \"message\": \"Đèn sân B04 chập chờn, trọng tài đến trễ 10 phút.\", \"accountId\": \"%s\", \"displayName\": \"Lê Thu Hà\", \"reply\": null, \"createdAt\": \"%sT09:00:00Z\", \"publishConsent\": true, \"courtNames\": \"Sân B04\", \"visitDate\": \"%s\"}",
        fb4Id, todayStr, HA_ID, todayStr, yesterdayStr
    );
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "feedback:" + fb4Id, fb4Json);

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

    reconcileSeededOrders();

    log.info("Đặt lại toàn bộ dữ liệu mẫu chuẩn Hội đồng (Comprehensive Golden Showcase) thành công 100%!");
  }

  private UUID getCourtIdByName(String name) {
    List<UUID> list = jdbc.query("SELECT id FROM courts WHERE name = ? ORDER BY (status = 'ACTIVE') DESC LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"), name);
    return list.isEmpty() ? null : list.get(0);
  }

  private UUID getRefereeStaffId() {
    List<UUID> list = jdbc.query("SELECT id FROM staff WHERE full_name LIKE '%Huy%' LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    if (list.isEmpty()) {
      list = jdbc.query("SELECT id FROM staff LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    }
    return list.isEmpty() ? null : list.get(0);
  }

  private UUID getOrOpenTournamentId() {
    List<UUID> list = jdbc.query("SELECT id FROM tournaments WHERE status = 'OPEN' ORDER BY start_date LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    if (!list.isEmpty()) return list.get(0);
    list = jdbc.query("SELECT id FROM tournaments ORDER BY created_at DESC LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    return list.isEmpty() ? null : list.get(0);
  }

  private void seedVouchers() {
    jdbc.execute("""
        INSERT INTO vouchers (id, code, type, value, min_order, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, member_only, new_user_only, enabled, description, min_tier)
        VALUES
          (gen_random_uuid(), 'CHAOBANMOI', 'PERCENT', 20.00, 150000.00, 100000.00, NOW() - interval '10 days', NOW() + interval '90 days', 500, 0, 1, false, false, true, 'Giảm 20% tối đa 100k cho khách hàng mới', null),
          (gen_random_uuid(), 'COURTLY50K', 'FIXED', 50000.00, 100000.00, 50000.00, NOW() - interval '10 days', NOW() + interval '90 days', 300, 0, 1, false, false, true, 'Giảm trực tiếp 50.000đ cho đơn từ 100k', null),
          (gen_random_uuid(), 'VIP10', 'PERCENT', 10.00, 200000.00, 100000.00, NOW() - interval '10 days', NOW() + interval '90 days', 1000, 0, 2, false, false, true, 'Ưu đãi 10% đặc quyền dành cho hạng Masters & Grand Slam', 'MASTERS'),
          (gen_random_uuid(), 'FLASH25', 'PERCENT', 25.00, 100000.00, 150000.00, NOW() - interval '10 days', NOW() + interval '90 days', 200, 0, 1, false, false, true, 'Khuyến mãi giờ vàng 25% tối đa 150k', null),
          (gen_random_uuid(), 'HETHAN2025', 'FIXED', 30000.00, 100000.00, 30000.00, NOW() - interval '60 days', NOW() - interval '1 day', 100, 0, 1, false, false, true, 'Mã giảm giá đã hết hạn', null)
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

  private void completeCourtSlots(UUID courtId, String dateStr, String startTime, String endTime, String bookingId, String completedAtStr) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    for (Map<String, Object> s : slots) {
      jdbc.update(
          "INSERT INTO booking_slots (id, booking_id, schedule_id, unit_price, released_at, completed_at) VALUES (gen_random_uuid(), ?::uuid, ?, ?, ?::timestamptz, ?::timestamptz)",
          bookingId, s.get("id"), s.get("price"), completedAtStr, completedAtStr
      );
    }
  }

  /**
   * Tính lại tiền của mọi đơn mẫu từ giá slot đã ghi, phí trọng tài và mức ưu đãi hội viên, để tổng tiền,
   * cọc 50%, chứng từ thu và khoản hoàn luôn khớp bảng giá hiện hành. Kịch bản thanh toán của đơn được giữ:
   * chưa thu, đã cọc, hoặc đã thu đủ.
   */
  @SuppressWarnings("unchecked")
  private void reconcileSeededOrders() {
    for (Map<String, Object> o : jdbc.queryForList("SELECT id, status, total_amount, paid_amount, metadata FROM orders")) {
      UUID id = (UUID) o.get("id");
      boolean cancelled = "CANCELLED".equals(o.get("status"));
      BigDecimal court = jdbc.queryForObject(
          "SELECT COALESCE(SUM(bs.unit_price), 0) FROM booking_slots bs JOIN bookings b ON b.id = bs.booking_id WHERE b.order_id = ?"
              + (cancelled ? "" : " AND (bs.released_at IS NULL OR bs.completed_at IS NOT NULL)"),
          BigDecimal.class, id);
      BigDecimal referee = jdbc.queryForObject(
          "SELECT COALESCE(SUM(st.unit_price * EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600), 0) "
              + "FROM booking_staff st JOIN bookings b ON b.id = st.booking_id JOIN staff_schedules ss ON ss.id = st.staff_schedule_id WHERE b.order_id = ?",
          BigDecimal.class, id).setScale(0, RoundingMode.HALF_UP);

      Map<String, Object> meta = documents.decode((String) o.get("metadata"));
      BigDecimal discount = BigDecimal.ZERO;
      boolean member = meta.get("membershipBenefit") instanceof Map;
      if (member) {
        Map<String, Object> benefit = new LinkedHashMap<>((Map<String, Object>) meta.get("membershipBenefit"));
        discount = court.multiply(PresentationService.decimal(benefit.get("discountPercent"))).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        benefit.put("gross", court);
        benefit.put("discount", discount);
        benefit.put("net", court.subtract(discount));
        meta.put("membershipBenefit", benefit);
      }
      BigDecimal total = court.add(referee).subtract(discount);
      // Cùng quy tắc với OrderApplicationService.customerDeposit: hội viên cọc 50% tiền sân sau ưu đãi
      BigDecimal deposit = (member ? court.subtract(discount) : total).multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.HALF_UP);

      if (meta.get("extensionHistory") instanceof List<?> history && !history.isEmpty()) {
        BigDecimal fee = jdbc.queryForObject(
            "SELECT bs.unit_price FROM booking_slots bs JOIN bookings b ON b.id = bs.booking_id JOIN court_schedules cs ON cs.id = bs.schedule_id "
                + "WHERE b.order_id = ? ORDER BY cs.schedule_date DESC, cs.start_time DESC LIMIT 1",
            BigDecimal.class, id);
        Map<String, Object> last = new LinkedHashMap<>((Map<String, Object>) history.get(history.size() - 1));
        last.put("fee", fee);
        meta.put("extensionHistory", List.of(last));
        meta.put("totalExtensionFee", fee);
      }

      List<Map<String, Object>> pays = jdbc.queryForList("SELECT id FROM payments WHERE order_id = ? ORDER BY paid_at", id);
      BigDecimal oldTotal = (BigDecimal) o.get("total_amount"), oldPaid = (BigDecimal) o.get("paid_amount");
      BigDecimal collected = pays.isEmpty() ? BigDecimal.ZERO
          : !cancelled && oldPaid.compareTo(oldTotal) >= 0 ? total : deposit;
      if (pays.size() == 1) {
        jdbc.update("UPDATE payments SET amount = ? WHERE id = ?", collected, pays.get(0).get("id"));
      } else if (pays.size() > 1) {
        jdbc.update("UPDATE payments SET amount = ? WHERE id = ?", deposit, pays.get(0).get("id"));
        jdbc.update("UPDATE payments SET amount = ? WHERE id = ?", collected.subtract(deposit), pays.get(pays.size() - 1).get("id"));
      }

      BigDecimal refunded = BigDecimal.ZERO;
      if (meta.get("cancellationSettlement") instanceof Map) {
        Map<String, Object> settlement = new LinkedHashMap<>((Map<String, Object>) meta.get("cancellationSettlement"));
        BigDecimal refund = collected.multiply(PresentationService.decimal(settlement.get("refundPercent"))).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        settlement.put("refundAmount", refund);
        settlement.put("retainedAmount", collected.subtract(refund));
        meta.put("cancellationSettlement", settlement);
        int done = jdbc.update("UPDATE refunds SET amount = ? WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ?)", refund, id);
        if (done > 0) refunded = refund;
        meta.put("refundPending", done > 0 ? 0 : refund);
        if (done == 0 && refund.signum() > 0) meta.put("financialReview", "REFUND_PENDING");
      }

      BigDecimal paid = collected.subtract(refunded);
      String status = paid.signum() == 0 ? "UNPAID" : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL";
      jdbc.update(
          "UPDATE orders SET subtotal = ?, total_amount = ?, deposit_required = ?, paid_amount = ?, payment_status = ?, metadata = ? WHERE id = ?",
          total, total, deposit, paid, status, documents.encode(meta), id);
    }
  }

  private void seedRefereeSchedules(LocalDate today) {
    List<Map<String, Object>> referees = jdbc.queryForList(
        "SELECT id, full_name, hourly_rate FROM staff WHERE type = 'REFEREE' AND status = 'ACTIVE' AND full_name NOT LIKE '%test%' ORDER BY full_name"
    );
    if (referees.size() < 4) return;

    UUID mRef1 = (UUID) referees.get(0).get("id");
    UUID mRef2 = (UUID) referees.get(1).get("id");
    UUID aRef1 = (UUID) referees.get(2).get("id");
    UUID aRef2 = (UUID) referees.get(3).get("id");

    for (int dayOffset = 0; dayOffset < 7; dayOffset++) {
      LocalDate d = today.plusDays(dayOffset);
      String dStr = d.toString();

      // Morning shift: 06:00 to 14:00 (for 2 referees)
      for (UUID refId : List.of(mRef1, mRef2)) {
        for (int min = 6 * 60; min < 14 * 60; min += 30) {
          LocalTime start = LocalTime.of(min / 60, min % 60);
          LocalTime end = LocalTime.of((min + 30) / 60, (min + 30) % 60);
          jdbc.update(
              "INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version) VALUES (gen_random_uuid(), ?, ?::date, ?::time, ?::time, 'AVAILABLE', 0)",
              refId, dStr, start, end
          );
        }
      }

      // Afternoon/evening shift: 14:00 to 23:00 (for 2 referees)
      for (UUID refId : List.of(aRef1, aRef2)) {
        for (int min = 14 * 60; min < 23 * 60; min += 30) {
          LocalTime start = LocalTime.of(min / 60, min % 60);
          LocalTime end = LocalTime.of((min + 30) / 60, (min + 30) % 60);
          jdbc.update(
              "INSERT INTO staff_schedules (id, staff_id, work_date, start_time, end_time, status, version) VALUES (gen_random_uuid(), ?, ?::date, ?::time, ?::time, 'AVAILABLE', 0)",
              refId, dStr, start, end
          );
        }
      }
    }
  }

  private void bookCourtWithReferee(UUID courtId, String dateStr, String startTime, String endTime, String bookingId, UUID refereeId, BigDecimal refereeRate) {
    if (courtId == null) return;
    List<Map<String, Object>> slots = jdbc.queryForList(
        "SELECT id, price FROM court_schedules WHERE court_id = ? AND schedule_date = ?::date AND start_time >= ?::time AND start_time < ?::time ORDER BY start_time",
        courtId, dateStr, startTime, endTime
    );
    if (slots.size() >= 2 && refereeId != null) {
      // Giữ toàn bộ khung giờ sân; ca trọng tài 1 gắn slot 17:00, ca 2 gắn slot 18:00
      bookCourtSlots(courtId, dateStr, startTime, endTime, bookingId);
      UUID s1 = (UUID) slots.get(0).get("id");
      UUID s2 = (UUID) slots.get(Math.min(2, slots.size() - 1)).get("id");

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
