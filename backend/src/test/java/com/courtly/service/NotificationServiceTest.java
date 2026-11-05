package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.Notification;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.NotificationRepository;
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
  private JdbcTemplate jdbc;
  private NotificationService service;

  private final ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

  @BeforeEach
  void setUp() {
    notificationRepository = mock(NotificationRepository.class);
    accountRepository = mock(AccountRepository.class);
    emailService = mock(EmailService.class);
    jdbc = mock(JdbcTemplate.class);

    service = new NotificationService(notificationRepository, accountRepository, emailService, jdbc);
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
  @DisplayName("Tự động chuyển status SKIPPED khi khách tắt nhận Email")
  void testUserChannelPreferenceSkipped() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setEmail("khach@demo.vn");
    acc.setNotifyEmail(false);
    when(accountRepository.findById(accountId)).thenReturn(Optional.of(acc));

    Notification n = service.enqueue(
        accountId, null, null,
        "BOOKING_REMINDER_24H", "EMAIL", null,
        "Nhắc lịch", "Body text", Instant.now(), "key1");

    assertNotNull(n);
    assertEquals("SKIPPED", n.getStatus());
  }
}
