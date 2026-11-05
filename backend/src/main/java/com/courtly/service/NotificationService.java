package com.courtly.service;

import com.courtly.entity.Account;
import com.courtly.entity.Notification;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.NotificationRepository;
import com.courtly.util.PhoneUtils;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

  private final NotificationRepository notifications;
  private final AccountRepository accounts;
  private final EmailService emailService;
  private final JdbcTemplate jdbc;

  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private Clock clock = Clock.system(ZONE);

  @Value("${courtly.notify.mode:LOG}")
  private String notifyMode;

  @Value("${courtly.notify.allowlist:kietdlv@gmail.com,phuongmaiphanqn3@gmail.com,+84769496289,+84377035664,0769496289,0377035664}")
  private String allowlistConfig;

  public void setClock(Clock clock) {
    this.clock = clock;
  }

  public Clock getClock() {
    return this.clock;
  }

  public Instant now() {
    return clock.instant();
  }

  public ZonedDateTime nowZoned() {
    return now().atZone(ZONE);
  }

  private boolean isAllowed(String recipient) {
    if (!"LIVE".equalsIgnoreCase(notifyMode)) {
      return true;
    }
    if (allowlistConfig == null || allowlistConfig.isBlank()) {
      return true;
    }
    if (recipient == null) return false;
    String cleaned = recipient.trim().toLowerCase(Locale.ROOT);
    List<String> list = Arrays.stream(allowlistConfig.split(","))
        .map(s -> s.trim().toLowerCase(Locale.ROOT))
        .filter(s -> !s.isBlank())
        .toList();
    return list.contains(cleaned);
  }

  /**
   * Đưa một thông báo vào outbox với dedupe_key chống trùng lặp
   */
  @Transactional
  public Notification enqueue(
      UUID accountId,
      UUID orderId,
      UUID campaignId,
      String type,
      String channel,
      String recipient,
      String subject,
      String body,
      Instant scheduledAt,
      String dedupeKey
  ) {
    if (dedupeKey != null && notifications.findByDedupeKey(dedupeKey).isPresent()) {
      log.debug("Notification skipped due to dedupe_key: {}", dedupeKey);
      return null;
    }

    String finalStatus = "QUEUED";
    String finalRecipient = recipient;

    // Kiểm tra cài đặt nhận thông báo của tài khoản
    if (accountId != null) {
      var accOpt = accounts.findById(accountId);
      if (accOpt.isPresent()) {
        Account acc = accOpt.get();
        if ("EMAIL".equalsIgnoreCase(channel)) {
          if (finalRecipient == null || finalRecipient.isBlank()) {
            finalRecipient = acc.getEmail();
          }
          if (Boolean.FALSE.equals(acc.getNotifyEmail()) || finalRecipient == null || finalRecipient.isBlank()) {
            finalStatus = "SKIPPED";
          }
        }
        if ("PROMOTION".equalsIgnoreCase(type) && !Boolean.TRUE.equals(acc.getMarketingConsent())) {
          finalStatus = "SKIPPED";
        }
      }
    }

    Instant finalScheduledAt = scheduledAt != null ? scheduledAt : now();

    Notification notif = new Notification();
    notif.setAccountId(accountId);
    notif.setOrderId(orderId);
    notif.setCampaignId(campaignId);
    notif.setType(type);
    notif.setChannel(channel.toUpperCase(Locale.ROOT));
    notif.setRecipient(finalRecipient);
    notif.setSubject(subject);
    notif.setBody(body);
    notif.setStatus(finalStatus);
    notif.setScheduledAt(finalScheduledAt);
    notif.setCreatedAt(now());
    notif.setDedupeKey(dedupeKey);

    return notifications.save(notif);
  }

  /**
   * Quét và tạo thông báo định kỳ: nhắc lịch 24h & 2h, giữ chỗ < 2p, nợ quá hạn
   */
  @Scheduled(fixedDelay = 60000)
  @Transactional
  public void scanAndGenerateReminders() {
    try {
      scanBookingReminders();
      scanHoldExpiring();
      scanOverdueDebt();
    } catch (Exception e) {
      log.warn("Error running notification scan job: {}", e.getMessage(), e);
    }
  }

  private void scanBookingReminders() {
    String sql = """
        SELECT o.id as order_id, o.customer_account_id, o.customer_name, o.customer_phone, a.email,
               (min(cs.schedule_date) || ' ' || to_char(min(cs.start_time), 'HH24:MI:SS')) as start_dt_str,
               string_agg(DISTINCT c.name, ', ') as court_names,
               to_char(min(cs.schedule_date), 'DD/MM/YYYY') as visit_date,
               to_char(min(cs.schedule_date), 'YYYY-MM-DD') as visit_date_iso,
               to_char(min(cs.start_time), 'HH24:MI') as start_str,
               to_char(max(cs.end_time), 'HH24:MI') as end_str
        FROM orders o
        JOIN bookings b ON b.order_id = o.id
        JOIN booking_slots bs ON bs.booking_id = b.id AND bs.released_at IS NULL
        JOIN court_schedules cs ON cs.id = bs.schedule_id
        JOIN courts c ON c.id = cs.court_id
        LEFT JOIN accounts a ON a.id = o.customer_account_id
        WHERE o.status = 'CONFIRMED'
        GROUP BY o.id, o.customer_account_id, o.customer_name, o.customer_phone, a.email
    """;

    List<Map<String, Object>> rows = jdbc.queryForList(sql);
    Instant current = now();

    for (var r : rows) {
      UUID orderId = (UUID) r.get("order_id");
      UUID accId = (UUID) r.get("customer_account_id");
      String startDtStr = (String) r.get("start_dt_str");
      String courtNames = (String) r.get("court_names");
      String visitDate = (String) r.get("visit_date");
      String visitDateIso = (String) r.get("visit_date_iso");
      String startStr = (String) r.get("start_str");
      String endStr = (String) r.get("end_str");
      String phone = (String) r.get("customer_phone");
      String email = (String) r.get("email");
      String orderCode = "CT-" + orderId.toString().substring(0, 8).toUpperCase();

      LocalDateTime startLdt = LocalDateTime.parse(startDtStr, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
      Instant startInstant = startLdt.atZone(ZONE).toInstant();
      long diffMinutes = Duration.between(current, startInstant).toMinutes();

      // Nhắc trước 24 giờ: trong khoảng 23h50 - 24h10 (1430 - 1450 phút)
      if (diffMinutes >= 1430 && diffMinutes <= 1450) {
        String dedupeBase = "BOOKING_REMINDER_24H:" + orderId + ":" + visitDateIso;
        createReminderNotifications(orderId, accId, phone, email, orderCode, courtNames, visitDate, startStr, endStr, "24H", dedupeBase);
      }

      // Nhắc trước 2 giờ: trong khoảng 1h50 - 2h10 (110 - 130 phút)
      if (diffMinutes >= 110 && diffMinutes <= 130) {
        String dedupeBase = "BOOKING_REMINDER_2H:" + orderId + ":" + visitDateIso;
        createReminderNotifications(orderId, accId, phone, email, orderCode, courtNames, visitDate, startStr, endStr, "2H", dedupeBase);
      }
    }
  }

  private void createReminderNotifications(
      UUID orderId, UUID accId, String phone, String email, String orderCode,
      String courtNames, String visitDate, String startStr, String endStr,
      String window, String dedupeBase
  ) {
    String type = "BOOKING_REMINDER_" + window;
    String timeStr = startStr + "–" + endStr + " ngày " + visitDate;
    String subject = "[Courtly] Nhắc lịch chơi tennis tại " + courtNames + " (" + timeStr + ")";
    String emailHtml = String.format("""
        <div style="font-family:'Segoe UI',sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #dce3df;">
          <h2 style="color:#173c32;margin-top:0;">Nhắc lịch thi đấu tennis</h2>
          <p>Xin chào quý khách, Courtly Tennis Club xin nhắc lịch chơi sắp diễn ra của bạn:</p>
          <div style="background:#f4f7f5;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Sân:</strong> %s</p>
            <p style="margin:4px 0;"><strong>Thời gian:</strong> %s</p>
            <p style="margin:4px 0;"><strong>Mã đặt chỗ:</strong> %s</p>
          </div>
          <p style="font-size:13px;color:#64748b;">Quý khách vui lòng đến trước 10 phút để thực hiện quét mã QR check-in tại quầy lễ tân.</p>
        </div>
        """, courtNames, timeStr, orderCode);

    // Kênh EMAIL
    if (email != null && !email.isBlank()) {
      enqueue(accId, orderId, null, type, "EMAIL", email, subject, emailHtml, now(), dedupeBase + ":EMAIL");
    }
    // Kênh IN_APP
    if (accId != null) {
      String inAppBody = "Lịch thi đấu tại " + courtNames + " (" + timeStr + "). Mã vé: " + orderCode;
      enqueue(accId, orderId, null, type, "IN_APP", null, "🎾 Nhắc lịch chơi", inAppBody, now(), dedupeBase + ":IN_APP");
    }
  }

  private void scanHoldExpiring() {
    String sql = """
        SELECT o.id, o.customer_account_id, o.customer_name, a.email,
               o.hold_expires_at, string_agg(DISTINCT c.name, ', ') as court_names
        FROM orders o
        JOIN bookings b ON b.order_id = o.id
        JOIN booking_slots bs ON bs.booking_id = b.id AND bs.released_at IS NULL
        JOIN court_schedules cs ON cs.id = bs.schedule_id
        JOIN courts c ON c.id = cs.court_id
        LEFT JOIN accounts a ON a.id = o.customer_account_id
        WHERE o.status = 'HOLDING' AND o.hold_expires_at IS NOT NULL
        GROUP BY o.id, o.customer_account_id, o.customer_name, a.email, o.hold_expires_at
    """;

    List<Map<String, Object>> rows = jdbc.queryForList(sql);
    Instant current = now();

    for (var r : rows) {
      UUID orderId = (UUID) r.get("id");
      UUID accId = (UUID) r.get("customer_account_id");
      String email = (String) r.get("email");
      String courtNames = (String) r.get("court_names");
      Instant holdExp = ((java.sql.Timestamp) r.get("hold_expires_at")).toInstant();
      long diffSec = Duration.between(current, holdExp).getSeconds();

      // Dưới 2 phút (120s) và chưa hết hạn (> 0s)
      if (diffSec > 0 && diffSec <= 120) {
        String dedupeKey = "HOLD_EXPIRING:" + orderId;
        String inAppMsg = "Đơn giữ chỗ " + courtNames + " sắp hết hạn trong " + (diffSec / 60 + 1) + " phút. Vui lòng thanh toán cọc để xác nhận.";
        if (accId != null) {
          enqueue(accId, orderId, null, "HOLD_EXPIRING", "IN_APP", null, "⏳ Giữ chỗ sắp hết hạn", inAppMsg, current, dedupeKey + ":IN_APP");
        }
        if (email != null && !email.isBlank()) {
          enqueue(accId, orderId, null, "HOLD_EXPIRING", "EMAIL", email, "[Courtly] Đơn giữ chỗ sắp hết hạn", inAppMsg, current, dedupeKey + ":EMAIL");
        }
      }
    }
  }

  private void scanOverdueDebt() {
    String sql = """
        SELECT o.id, o.customer_account_id, o.customer_phone, a.email,
               (o.total_amount - o.paid_amount) as debt,
               to_char(min(cs.schedule_date), 'DD/MM/YYYY') as visit_date,
               to_char(min(cs.schedule_date), 'YYYY-MM-DD') as visit_date_iso,
               max(cs.schedule_date + cs.end_time) as end_dt,
               o.status
        FROM orders o
        JOIN bookings b ON b.order_id = o.id
        JOIN booking_slots bs ON bs.booking_id = b.id AND bs.released_at IS NULL
        JOIN court_schedules cs ON cs.id = bs.schedule_id
        LEFT JOIN accounts a ON a.id = o.customer_account_id
        WHERE o.status IN ('CHECKED_IN', 'COMPLETED')
          AND (o.total_amount - o.paid_amount) > 0
        GROUP BY o.id, o.customer_account_id, o.customer_phone, a.email, o.total_amount, o.paid_amount, o.status
    """;

    List<Map<String, Object>> rows = jdbc.queryForList(sql);
    Instant current = now();

    for (var r : rows) {
      UUID orderId = (UUID) r.get("id");
      UUID accId = (UUID) r.get("customer_account_id");
      String phone = (String) r.get("customer_phone");
      String email = (String) r.get("email");
      Number debtNum = (Number) r.get("debt");
      long debt = debtNum.longValue();
      String visitDateIso = (String) r.get("visit_date_iso");
      String orderCode = "CT-" + orderId.toString().substring(0, 8).toUpperCase();
      String status = (String) r.get("status");

      boolean isOverdue = false;
      if ("COMPLETED".equalsIgnoreCase(status)) {
        isOverdue = true;
      } else {
        java.sql.Timestamp endDt = (java.sql.Timestamp) r.get("end_dt");
        if (endDt != null) {
          Instant endInstant = endDt.toInstant();
          // Quá 15 phút sau giờ chơi mà còn thiếu
          if (current.isAfter(endInstant.plus(Duration.ofMinutes(15)))) {
            isOverdue = true;
          }
        }
      }

      if (isOverdue) {
        String dedupeBase = "OVERDUE_DEBT:" + orderId + ":" + visitDateIso;
        String formattedDebt = String.format("%,d₫", debt);
        String subject = "[Courtly] Thông báo công nợ đơn đặt sân " + orderCode;
        String emailHtml = "<p>Xin chào quý khách, đơn " + orderCode + " còn số tiền chưa thanh toán là <strong>" + formattedDebt + "</strong>. Vui lòng hoàn tất thanh toán để tiếp tục sử dụng dịch vụ.</p>";

        if (email != null && !email.isBlank()) {
          enqueue(accId, orderId, null, "OVERDUE_DEBT", "EMAIL", email, subject, emailHtml, current, dedupeBase + ":EMAIL");
        }
        if (accId != null) {
          enqueue(accId, orderId, null, "OVERDUE_DEBT", "IN_APP", null, "⚠️ Đơn còn nợ chưa tất toán", "Đơn " + orderCode + " còn thiếu " + formattedDebt + ". Vui lòng thanh toán tại quầy.", current, dedupeBase + ":IN_APP");
        }
      }
    }
  }

  /**
   * Dispatch các thông báo đang QUEUED trong outbox
   */
  @Scheduled(fixedDelay = 15000)
  @Transactional
  public void dispatchOutbox() {
    Instant current = now();
    List<Notification> queued = notifications.findTop50ByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc("QUEUED", current);

    for (Notification n : queued) {
      try {
        if ("IN_APP".equalsIgnoreCase(n.getChannel())) {
          n.setStatus("SENT");
          n.setSentAt(current);
          continue;
        }

        if ("EMAIL".equalsIgnoreCase(n.getChannel())) {
          if (!isAllowed(n.getRecipient())) {
            log.warn("[EMAIL SKIPPED] Recipient {} not in allowlist. Mode: LIVE.", n.getRecipient());
            n.setStatus("SKIPPED");
            n.setLastError("SKIPPED (not allowlisted)");
            n.setSentAt(current);
            continue;
          }
          if ("LOG".equalsIgnoreCase(notifyMode)) {
            log.info("[NOTIFY LOG EMAIL] To: {} | Subject: {} | Body: {}", n.getRecipient(), n.getSubject(), n.getBody());
            n.setStatus("SENT (log)");
            n.setSentAt(current);
          } else {
            boolean sent = emailService.send(n.getRecipient(), n.getSubject(), n.getBody(), n.getBody());
            if (sent) {
              n.setStatus("SENT");
              n.setSentAt(current);
            } else {
              handleFailure(n, "SMTP send failed");
            }
          }
          continue;
        }

        n.setStatus("SENT");
        n.setSentAt(current);
      } catch (Exception e) {
        handleFailure(n, e.getMessage());
      }
    }
  }

  private void handleFailure(Notification n, String error) {
    n.setAttempts(n.getAttempts() + 1);
    n.setLastError(error);
    if (n.getAttempts() >= 3) {
      n.setStatus("FAILED");
    } else {
      // Giãn cách thử lại: lần 1 (+1 phút), lần 2 (+5 phút), lần 3 (+15 phút)
      int delayMin = switch (n.getAttempts()) {
        case 1 -> 1;
        case 2 -> 5;
        default -> 15;
      };
      n.setScheduledAt(now().plus(Duration.ofMinutes(delayMin)));
    }
  }

  /**
   * Nút "Gửi nhắc ngay" từ chi tiết đơn dành cho lễ tân / admin
   */
  @Transactional
  public Map<String, Object> sendImmediateReminder(UUID orderId, String requestedChannel) {
    String sql = """
        SELECT o.id, o.customer_account_id, o.customer_phone, a.email, o.customer_name,
               string_agg(DISTINCT c.name, ', ') as court_names,
               to_char(min(cs.schedule_date), 'DD/MM/YYYY') as visit_date,
               to_char(min(cs.start_time), 'HH24:MI') as start_str,
               to_char(max(cs.end_time), 'HH24:MI') as end_str
        FROM orders o
        JOIN bookings b ON b.order_id = o.id
        JOIN booking_slots bs ON bs.booking_id = b.id AND bs.released_at IS NULL
        JOIN court_schedules cs ON cs.id = bs.schedule_id
        JOIN courts c ON c.id = cs.court_id
        LEFT JOIN accounts a ON a.id = o.customer_account_id
        WHERE o.id = ?
        GROUP BY o.id, o.customer_account_id, o.customer_phone, a.email, o.customer_name
    """;

    var list = jdbc.queryForList(sql, orderId);
    if (list.isEmpty()) {
      throw new IllegalArgumentException("Không tìm thấy thông tin đơn đặt sân");
    }
    var r = list.get(0);
    UUID accId = (UUID) r.get("customer_account_id");
    String phone = (String) r.get("customer_phone");
    String email = (String) r.get("email");
    String courtNames = (String) r.get("court_names");
    String visitDate = (String) r.get("visit_date");
    String startStr = (String) r.get("start_str");
    String endStr = (String) r.get("end_str");
    String orderCode = "CT-" + orderId.toString().substring(0, 8).toUpperCase();
    String timeStr = startStr + "–" + endStr + " ngày " + visitDate;

    String dedupeBase = "MANUAL_REMINDER:" + orderId + ":" + System.currentTimeMillis();
    String subject = "[Courtly] Nhắc lịch thi đấu tennis tại " + courtNames + " (" + timeStr + ")";
    String emailHtml = "<p>Xin chào quý khách, Courtly xin nhắc lịch chơi tại <strong>" + courtNames + "</strong> (" + timeStr + "). Mã vé: <strong>" + orderCode + "</strong>.</p>";

    int count = 0;
    if ("ALL".equalsIgnoreCase(requestedChannel) || "EMAIL".equalsIgnoreCase(requestedChannel)) {
      if (email != null && !email.isBlank()) {
        enqueue(accId, orderId, null, "BOOKING_REMINDER_IMMEDIATE", "EMAIL", email, subject, emailHtml, now(), dedupeBase + ":EMAIL");
        count++;
      }
    }

    // Luôn gửi kèm thông báo in-app
    if (accId != null) {
      enqueue(accId, orderId, null, "BOOKING_REMINDER_IMMEDIATE", "IN_APP", null, "🎾 Nhắc lịch chơi", "Lịch thi đấu " + courtNames + " (" + timeStr + ")", now(), dedupeBase + ":IN_APP");
      count++;
    }

    return Map.of("success", true, "enqueued", count, "message", "Đã gửi thông báo nhắc lịch tới khách hàng");
  }

  /**
   * Thông báo tức thời khi xác nhận cọc thành công
   */
  @Transactional
  public void notifyBookingConfirmed(UUID orderId, UUID accountId, String phone, String email, String courtNames, String visitDate, String timeRange, long deposit) {
    String orderCode = "CT-" + orderId.toString().substring(0, 8).toUpperCase();
    String dedupe = "BOOKING_CONFIRMED:" + orderId;
    String subject = "[Courtly] Đặt sân thành công – Mã vé " + orderCode;
    String formattedDeposit = String.format("%,d₫", deposit);
    String html = "<p>Chúc mừng quý khách đã đặt sân thành công tại <strong>" + courtNames + "</strong> (" + timeRange + " ngày " + visitDate + "). Mã vé: <strong>" + orderCode + "</strong>. Đã cọc: <strong>" + formattedDeposit + "</strong>.</p>";

    if (email != null && !email.isBlank()) {
      enqueue(accountId, orderId, null, "BOOKING_CONFIRMED", "EMAIL", email, subject, html, now(), dedupe + ":EMAIL");
    }
    if (accountId != null) {
      enqueue(accountId, orderId, null, "BOOKING_CONFIRMED", "IN_APP", null, "✅ Đặt sân thành công", "Mã vé " + orderCode + " tại " + courtNames + " (" + timeRange + ")", now(), dedupe + ":IN_APP");
    }
  }

  /**
   * Thông báo hoàn tiền thành công
   */
  @Transactional
  public void notifyRefundDone(UUID orderId, UUID accountId, String phone, String email, long refundAmount) {
    String orderCode = "CT-" + orderId.toString().substring(0, 8).toUpperCase();
    String dedupe = "REFUND_DONE:" + orderId + ":" + System.currentTimeMillis();
    String formattedAmount = String.format("%,d₫", refundAmount);
    String subject = "[Courtly] Hoàn tiền đơn " + orderCode;
    String html = "<p>Khoản hoàn tiền <strong>" + formattedAmount + "</strong> cho đơn " + orderCode + " đã được xử lý thành công.</p>";

    if (email != null && !email.isBlank()) {
      enqueue(accountId, orderId, null, "REFUND_DONE", "EMAIL", email, subject, html, now(), dedupe + ":EMAIL");
    }
    if (accountId != null) {
      enqueue(accountId, orderId, null, "REFUND_DONE", "IN_APP", null, "💸 Hoàn tiền thành công", "Đã hoàn " + formattedAmount + " cho đơn " + orderCode, now(), dedupe + ":IN_APP");
    }
  }

  public List<Notification> listForAdmin(String channel, String type, String status) {
    return notifications.search(channel, type, status);
  }

  public List<Notification> listForAccount(UUID accountId) {
    return notifications.findByAccountIdOrderByCreatedAtDesc(accountId);
  }

  @Transactional
  public Notification retry(UUID id) {
    Notification n = notifications.findById(id).orElseThrow();
    n.setStatus("QUEUED");
    n.setAttempts(0);
    n.setScheduledAt(now());
    n.setLastError(null);
    return notifications.save(n);
  }
}
