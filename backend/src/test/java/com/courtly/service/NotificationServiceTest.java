package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.Notification;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.NotificationRepository;
import com.courtly.service.sms.SmsService;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

public class NotificationServiceTest {

  private NotificationRepository notificationRepository;
  private AccountRepository accountRepository;
  private EmailService emailService;
  private SmsService smsService;
  private JdbcTemplate jdbc;
  private NotificationService service;

  private final ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

  @BeforeEach
  void setUp() {
    notificationRepository = mock(NotificationRepository.class);
    accountRepository = mock(AccountRepository.class);
    emailService = mock(EmailService.class);
    smsService = mock(SmsService.class);
    jdbc = mock(JdbcTemplate.class);

    service = new NotificationService(notificationRepository, accountRepository, emailService, smsService, jdbc);
    when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
  }

  @Test
  @DisplayName("Chống gửi trùng thông báo khi dedupe_key đã tồn tại")
  void testDedupeKeyPreventsDuplicate() {
    String key = "BOOKING_REMINDER_24H:order123:2026-11-05:EMAIL";
    when(notificationRepository.findByDedupeKey(key)).thenReturn(Optional.of(new Notification()));

    Notification result = service.enqueue(
        UUID.randomUUID(), UUID.randomUUID(), null,
        "BOOKING_REMINDER_24H", "EMAIL", "test@gmail.com",
        "Subject", "Body", Instant.now(), key);

    assertNull(result, "Thông báo trùng dedupe_key phải bị bỏ qua (null)");
    verify(notificationRepository, never()).save(any());
  }

  @Test
  @DisplayName("Tự động chuyển status SKIPPED khi khách tắt nhận kênh SMS hoặc Email")
  void testUserChannelPreferenceSkipped() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setNotifySms(false);
    acc.setPhone("+84912345678");
    when(accountRepository.findById(accountId)).thenReturn(Optional.of(acc));

    Notification n = service.enqueue(
        accountId, null, null,
        "BOOKING_REMINDER_24H", "SMS", null,
        null, "Body text", Instant.now(), "key1");

    assertNotNull(n);
    assertEquals("SKIPPED", n.getStatus());
  }

  @Test
  @DisplayName("Tin nhắn SMS tạo lúc 22:00 phải được dời lịch sang 07:00 sáng hôm sau")
  void testSmsQuietHoursDelayed() {
    // Giả lập 22:00 đêm tại Việt Nam
    ZonedDateTime nightTime = ZonedDateTime.of(2026, 11, 5, 22, 0, 0, 0, zone);
    service.setClock(Clock.fixed(nightTime.toInstant(), zone));

    Notification n = service.enqueue(
        null, null, null,
        "BOOKING_REMINDER_24H", "SMS", "+84912345678",
        null, "Nhắc lịch", nightTime.toInstant(), "key2");

    assertNotNull(n);
    ZonedDateTime scheduledZdt = n.getScheduledAt().atZone(zone);
    assertEquals(2026, scheduledZdt.getYear());
    assertEquals(11, scheduledZdt.getMonthValue());
    assertEquals(6, scheduledZdt.getDayOfMonth(), "Phải chuyển sang ngày hôm sau");
    assertEquals(7, scheduledZdt.getHour(), "Phải chuyển về 07:00 sáng");
    assertEquals(0, scheduledZdt.getMinute());
  }
}
