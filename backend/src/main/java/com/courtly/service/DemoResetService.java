package com.courtly.service;

import static com.courtly.util.Rules.ZONE;

import java.math.BigDecimal;
import java.time.LocalDate;
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

  private static final String ADMIN_ID = "b27fe32c-e9b7-44bf-8149-81bc00b5bbba";
  private static final String STAFF_ID = "f21bd5fa-cf66-4ee4-a009-3a337eebc6fa";
  private static final String NAM_ID = "44444444-4444-4444-4444-444444444444";
  private static final String HA_ID = "55555555-5555-5555-5555-555555555555";

  private static final String BCRYPT_12345 = "$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW";
  private static final String BCRYPT_1234567890123 = "$2a$12$qVv9jATLLv2wNu5AWmn7xu2ehI5x5LUTIFhay53uOHfaSUILX5gWq";

  @Transactional
  public void resetShowcaseData() {
    log.info("Bắt đầu đặt lại dữ liệu chuẩn Hội đồng (Golden Showcase)...");

    LocalDate today = LocalDate.now(ZONE);
    LocalDate yesterday = today.minusDays(1);
    LocalDate twoDaysAgo = today.minusDays(2);
    LocalDate tomorrow = today.plusDays(1);

    String todayStr = today.toString();
    String yesterdayStr = yesterday.toString();
    String twoDaysAgoStr = twoDaysAgo.toString();
    String tomorrowStr = tomorrow.toString();

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
    jdbc.execute("DELETE FROM tournament_registrations");

    // Xóa toàn bộ các tài khoản tự tạo / kiểm thử (chỉ giữ lại đúng 4 tài khoản hệ thống chuẩn)
    jdbc.execute("DELETE FROM accounts WHERE email NOT IN ('admin@gmail.com', 'staff@gmail.com', 'hoangnam@gmail.com', 'khachmoi@gmail.com')");

    // Đưa toàn bộ slot về AVAILABLE
    jdbc.execute("UPDATE court_schedules SET status = 'AVAILABLE'");

    // Đảm bảo 4 tài khoản hệ thống chuẩn luôn tồn tại
    String upsertAccountsSql = String.format(
        """
        INSERT INTO accounts (id, email, full_name, phone, role, status, password_hash, created_at, auth_version)
        VALUES 
          ('%s', 'admin@gmail.com', 'Quản trị Courtly', '0909999999', 'ADMIN', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'staff@gmail.com', 'Lễ tân Courtly (Staff)', '0908888888', 'STAFF', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'hoangnam@gmail.com', 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0),
          ('%s', 'khachmoi@gmail.com', 'Lê Thu Hà', '0987654321', 'CUSTOMER', 'ACTIVE', '%s', NOW(), 0)
        ON CONFLICT (id) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          password_hash = COALESCE(accounts.password_hash, EXCLUDED.password_hash);
        """,
        ADMIN_ID, BCRYPT_12345,
        STAFF_ID, BCRYPT_12345,
        NAM_ID, BCRYPT_1234567890123,
        HA_ID, BCRYPT_1234567890123
    );
    jdbc.execute(upsertAccountsSql);

    // Sinh court_schedules nếu thiếu
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
            FOR d IN SELECT unnest(ARRAY['%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE, '%s'::DATE]) LOOP
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
        """,
        twoDaysAgoStr, yesterdayStr, todayStr, tomorrowStr,
        today.plusDays(7).toString(), today.plusDays(14).toString(), today.plusDays(21).toString()
    );
    jdbc.execute(seedSlotsSql);

    // Lấy ID các sân
    UUID courtA01 = getCourtIdByName("Sân A01");
    UUID courtA02 = getCourtIdByName("Sân A02");
    UUID courtA03 = getCourtIdByName("Sân A03");
    UUID courtB01 = getCourtIdByName("Sân B01");
    UUID courtB02 = getCourtIdByName("Sân B02");
    UUID courtV01 = getCourtIdByName("Sân V01");
    UUID courtV02 = getCourtIdByName("Sân V02");

    // Lấy trọng tài
    UUID refereeId = getRefereeStaffId();
    BigDecimal refereeRate = BigDecimal.valueOf(250000.00);

    // Lấy giải đấu
    UUID tournId = getOpenTournamentId();

    // 1. ĐƠN 1: CHECKED_IN - Sân A01 hôm nay 14:00 - 16:00 (Trần Hoàng Nam VIP Plus)
    String ord1Id = "11111111-1111-1111-1111-111111111111";
    String bkg1Id = "11111111-1111-1111-1111-222222222222";
    String pay1Id = "11111111-1111-1111-1111-333333333333";
    String meta1 = "{\"customerFlow\": true, \"membershipBenefit\": {\"gross\": 400000, \"discount\": 60000, \"net\": 340000, \"planName\": \"Plus\", \"discountPercent\": 15}}";
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
    bookCourtSlots(courtA01, todayStr, "14:00:00", "16:00:00", bkg1Id);

    // 2. ĐƠN 2: CONFIRMED - Sân B01 hôm nay 19:00 - 21:00 (Trần Hoàng Nam VIP Plus)
    String ord2Id = "22222222-2222-2222-2222-111111111111";
    String bkg2Id = "22222222-2222-2222-2222-222222222222";
    String pay2Id = "22222222-2222-2222-2222-333333333333";
    String meta2 = "{\"customerFlow\": true, \"membershipBenefit\": {\"gross\": 600000, \"discount\": 90000, \"net\": 510000, \"planName\": \"Plus\", \"discountPercent\": 15}}";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CONFIRMED', 510000.00, 255000.00, 255000.00, 'PARTIAL', NOW() - interval '4 hours', 0, ?)",
        ord2Id, NAM_ID, NAM_ID, meta2
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '4 hours')", bkg2Id, ord2Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 255000.00, 'PAY-CONF-002', 'PAID', NOW() - interval '4 hours')", pay2Id, ord2Id, STAFF_ID);
    bookCourtSlots(courtB01, todayStr, "19:00:00", "21:00:00", bkg2Id);

    // 3. ĐƠN 3: HOLDING (đếm ngược 5 phút) - Sân V01 ngày mai 08:00 - 10:00 (Trần Hoàng Nam)
    String ord3Id = "33333333-3333-3333-3333-111111111111";
    String bkg3Id = "33333333-3333-3333-3333-222222222222";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, hold_expires_at, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'HOLDING', NOW() + interval '5 minutes', 1000000.00, 500000.00, 0.00, 'UNPAID', NOW(), 0, '{\"customerFlow\": true}')",
        ord3Id, NAM_ID, NAM_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'HOLDING', NOW())", bkg3Id, ord3Id);
    lockCourtSlots(courtV01, tomorrowStr, "08:00:00", "10:00:00", bkg3Id);

    // 4. ĐƠN 4: RECURRING (Định kỳ 4 tuần) - Sân B02 16:00 - 18:00 (Trần Hoàng Nam VIP Plus)
    String ord4Id = "44444444-4444-4444-4444-111111111111";
    String bkg4Id = "44444444-4444-4444-4444-222222222222";
    String pay4Id = "44444444-4444-4444-4444-333333333333";
    String meta4 = String.format(
        "{\"customerFlow\": true, \"recurringWeeks\": 4, \"recurringType\": \"WEEKLY\", \"recurringSummary\": \"Định kỳ 4 tuần (%s đến %s)\", \"membershipBenefit\": {\"gross\": 2400000, \"discount\": 360000, \"net\": 2040000, \"planName\": \"Plus\", \"discountPercent\": 15}}",
        todayStr, today.plusDays(21).toString()
    );
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam [Hội viên Plus]', '0912345678', 'CONFIRMED', 2040000.00, 1020000.00, 1020000.00, 'PARTIAL', NOW() - interval '1 day', 0, ?)",
        ord4Id, NAM_ID, NAM_ID, meta4
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '1 day')", bkg4Id, ord4Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 1020000.00, 'PAY-RECUR-004', 'PAID', NOW() - interval '1 day')", pay4Id, ord4Id, STAFF_ID);
    for (int w = 0; w < 4; w++) {
      String wDate = today.plusDays(7L * w).toString();
      bookCourtSlots(courtB02, wDate, "16:00:00", "18:00:00", bkg4Id);
    }

    // 5. ĐƠN 5: COMPLETED có hóa đơn - Sân A02 hôm qua 17:00 - 19:00 (Trần Hoàng Nam)
    String ord5Id = "55555555-5555-5555-5555-111111111111";
    String bkg5Id = "55555555-5555-5555-5555-222222222222";
    String pay5_1 = "55555555-5555-5555-5555-333333333331";
    String pay5_2 = "55555555-5555-5555-5555-333333333332";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, invoice_number, issued_at, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam', '0912345678', 'COMPLETED', 400000.00, 200000.00, 400000.00, 'PAID', 'INV-20261026-001', (? || ' 19:05:00+07')::timestamptz, (? || ' 10:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord5Id, NAM_ID, NAM_ID, yesterdayStr, yesterdayStr
    );
    jdbc.update(
        "INSERT INTO bookings (id, order_id, status, check_in_at, check_out_at, created_at) " +
        "VALUES (?::uuid, ?::uuid, 'COMPLETED', (? || ' 16:55:00+07')::timestamptz, (? || ' 19:02:00+07')::timestamptz, (? || ' 10:00:00+07')::timestamptz)",
        bkg5Id, ord5Id, yesterdayStr, yesterdayStr, yesterdayStr
    );
    jdbc.update(
        "INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES " +
        "(?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-DONE-005A', 'PAID', (? || ' 10:05:00+07')::timestamptz), " +
        "(?::uuid, ?::uuid, ?::uuid, 'BALANCE', 'CASH', 200000.00, 'PAY-DONE-005B', 'PAID', (? || ' 19:03:00+07')::timestamptz)",
        pay5_1, ord5Id, STAFF_ID, yesterdayStr,
        pay5_2, ord5Id, STAFF_ID, yesterdayStr
    );
    releaseCourtSlots(courtA02, yesterdayStr, "17:00:00", "19:00:00", bkg5Id, yesterdayStr + " 19:02:00+07");

    // 6. ĐƠN 6: CANCELLED & REFUNDED 70% - Sân A03 2 ngày trước (Trần Hoàng Nam)
    String ord6Id = "66666666-6666-6666-6666-111111111111";
    String bkg6Id = "66666666-6666-6666-6666-222222222222";
    String pay6Id = "66666666-6666-6666-6666-333333333333";
    String ref6Id = "66666666-6666-6666-6666-444444444444";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam', '0912345678', 'CANCELLED', 400000.00, 200000.00, 60000.00, 'PARTIAL', (? || ' 09:00:00+07')::timestamptz, 0, '{\"customerFlow\": true}')",
        ord6Id, NAM_ID, NAM_ID, twoDaysAgoStr
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CANCELLED', (? || ' 09:00:00+07')::timestamptz)", bkg6Id, ord6Id, twoDaysAgoStr);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 200000.00, 'PAY-CANC-006', 'PAID', (? || ' 09:10:00+07')::timestamptz)", pay6Id, ord6Id, STAFF_ID, twoDaysAgoStr);
    jdbc.update("INSERT INTO refunds (id, payment_id, processed_by_account_id, amount, reason, status, refunded_at) VALUES (?::uuid, ?::uuid, ?::uuid, 140000.00, 'Khách hủy trước 24 giờ (chính sách hoàn 70%)', 'DONE', (? || ' 14:00:00+07')::timestamptz)", ref6Id, pay6Id, ADMIN_ID, twoDaysAgoStr);
    releaseCourtSlots(courtA03, twoDaysAgoStr, "18:00:00", "20:00:00", bkg6Id, twoDaysAgoStr + " 14:00:00+07");

    // 7. ĐƠN 7: REFEREE (Có thuê trọng tài) - Sân V02 hôm nay 17:00 - 19:00 (Trần Hoàng Nam)
    String ord7Id = "77777777-7777-7777-7777-111111111111";
    String bkg7Id = "77777777-7777-7777-7777-222222222222";
    String pay7Id = "77777777-7777-7777-7777-333333333333";
    jdbc.update(
        "INSERT INTO orders (id, customer_account_id, created_by_account_id, customer_name, customer_phone, status, total_amount, deposit_required, paid_amount, payment_status, created_at, version, metadata) " +
        "VALUES (?::uuid, ?::uuid, ?::uuid, 'Trần Hoàng Nam', '0912345678', 'CONFIRMED', 1500000.00, 500000.00, 500000.00, 'PARTIAL', NOW() - interval '6 hours', 0, '{\"customerFlow\": true}')",
        ord7Id, NAM_ID, NAM_ID
    );
    jdbc.update("INSERT INTO bookings (id, order_id, status, created_at) VALUES (?::uuid, ?::uuid, 'CONFIRMED', NOW() - interval '6 hours')", bkg7Id, ord7Id);
    jdbc.update("INSERT INTO payments (id, order_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) VALUES (?::uuid, ?::uuid, ?::uuid, 'DEPOSIT', 'BANK_TRANSFER', 500000.00, 'PAY-REF-007', 'PAID', NOW() - interval '6 hours')", pay7Id, ord7Id, STAFF_ID);
    bookCourtWithReferee(courtV02, todayStr, "17:00:00", "19:00:00", bkg7Id, refereeId, refereeRate);

    // 8. Membership VIP Plus cho Trần Hoàng Nam
    String memId = UUID.randomUUID().toString();
    String memPayId = UUID.randomUUID().toString();
    String memStart = today.getYear() + "-" + String.format("%02d", today.getMonthValue()) + "-01T00:00:00Z";
    LocalDate sixtyDaysLater = today.plusDays(60);
    String memEnd = sixtyDaysLater.getYear() + "-" + String.format("%02d", sixtyDaysLater.getMonthValue()) + "-28T23:59:59Z";

    String memDocJson = String.format(
        "{\"id\": \"%s\", \"accountId\": \"%s\", \"planId\": \"plus\", \"planName\": \"Plus\", \"startsAt\": \"%s\", \"endsAt\": \"%s\", \"status\": \"ACTIVE\", \"discountPercent\": 15, \"vipDiscountPercent\": 10, \"price\": 499000, \"rescheduleUsage\": 0}",
        memId, NAM_ID, memStart, memEnd
    );
    String memPayDocJson = String.format(
        "{\"id\": \"%s\", \"membershipId\": \"%s\", \"accountId\": \"%s\", \"planId\": \"plus\", \"planName\": \"Plus\", \"amount\": 499000, \"createdAt\": \"%sT08:00:00Z\", \"status\": \"PAID\", \"method\": \"BANK_TRANSFER\", \"transactionCode\": \"MEM-PLUS-001\"}",
        memPayId, memId, NAM_ID, todayStr
    );

    jdbc.execute("DELETE FROM app_documents WHERE document_key LIKE 'membership:%' OR document_key LIKE 'membership-payment:%' OR document_key LIKE 'request:%' OR document_key LIKE 'otp:%'");
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership:" + NAM_ID, memDocJson);
    jdbc.update("INSERT INTO app_documents (document_key, data, version) VALUES (?, ?, 1)", "membership-payment:" + memPayId, memPayDocJson);

    // 9. Giải đấu Courtly Winter Doubles với 4 cặp đấu
    if (tournId != null) {
      String[][] teams = {
          {"Hoàng Nam & Minh Anh", NAM_ID, "350000"},
          {"Lê Thu Hà & Quốc Huy", HA_ID, "350000"},
          {"Đức Long & Thanh Bình", null, "350000"},
          {"Hải Đăng & Tấn Phát", null, "350000"}
      };
      for (int i = 0; i < teams.length; i++) {
        String regId = UUID.randomUUID().toString();
        String payId = UUID.randomUUID().toString();
        String teamName = teams[i][0];
        String accId = teams[i][1];
        String fee = teams[i][2];

        if (accId != null) {
          jdbc.update(
              "INSERT INTO tournament_registrations (id, tournament_id, account_id, registered_by_account_id, team_name, skill_level, status, registered_at) " +
              "VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, 'ADVANCED', 'CONFIRMED', NOW() - (? || ' days')::interval)",
              regId, tournId.toString(), accId, STAFF_ID, teamName, i + 1
          );
        } else {
          jdbc.update(
              "INSERT INTO tournament_registrations (id, tournament_id, account_id, registered_by_account_id, team_name, skill_level, status, registered_at) " +
              "VALUES (?::uuid, ?::uuid, NULL, ?::uuid, ?, 'ADVANCED', 'CONFIRMED', NOW() - (? || ' days')::interval)",
              regId, tournId.toString(), STAFF_ID, teamName, i + 1
          );
        }

        jdbc.update(
            "INSERT INTO payments (id, registration_id, received_by_account_id, type, method, amount, transaction_code, status, paid_at) " +
            "VALUES (?::uuid, ?::uuid, ?::uuid, 'TOURNAMENT_FEE', 'BANK_TRANSFER', ?::numeric, ?, 'PAID', NOW() - (? || ' days')::interval)",
            payId, regId, STAFF_ID, fee, "PAY-TOURN-00" + (i + 1), i + 1
        );
      }
    }

    log.info("Đặt lại dữ liệu chuẩn Hội đồng (Golden Showcase) thành công 100%!");
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

  private UUID getOpenTournamentId() {
    List<UUID> list = jdbc.query("SELECT id FROM tournaments WHERE status = 'OPEN' ORDER BY start_date LIMIT 1", (rs, rowNum) -> (UUID) rs.getObject("id"));
    return list.isEmpty() ? null : list.get(0);
  }

  private void bookCourtSlots(UUID courtId, String dateStr, String startTime, String endTime, String bookingId) {
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
