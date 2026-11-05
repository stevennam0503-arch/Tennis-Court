package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.Account;
import com.courtly.entity.AppDocument;
import com.courtly.entity.Voucher;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.VoucherRepository;
import com.courtly.util.PhoneUtils;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

public class PhoneAuthServiceTest {

  @Test
  @DisplayName("Chuẩn hóa các định dạng số điện thoại Việt Nam về chuẩn E.164")
  void testNormalizeE164() {
    assertEquals("+84912345678", PhoneUtils.normalizeE164("0912345678"));
    assertEquals("+84912345678", PhoneUtils.normalizeE164("0912 345 678"));
    assertEquals("+84912345678", PhoneUtils.normalizeE164("+84912345678"));
    assertEquals("+84912345678", PhoneUtils.normalizeE164("84912345678"));
    assertEquals("+84911000002", PhoneUtils.normalizeE164("0911000002"));
    assertEquals("+84911000002", PhoneUtils.normalizeE164("+84911000002"));
    assertEquals("+84911000002", PhoneUtils.normalizeE164("0911.000.002"));
    assertEquals("+84769496289", PhoneUtils.normalizeE164("0769496289"));
    assertEquals("+84377035664", PhoneUtils.normalizeE164("0377035664"));

    assertThrows(BusinessException.class, () -> PhoneUtils.normalizeE164("12345"));
    assertThrows(BusinessException.class, () -> PhoneUtils.normalizeE164("091234567899")); // 11 số
    assertThrows(BusinessException.class, () -> PhoneUtils.normalizeE164("abcd"));
  }

  @Test
  @DisplayName("Định dạng số điện thoại hiển thị thân thiện")
  void testFormatDisplay() {
    assertEquals("0912 345 678", PhoneUtils.formatDisplay("+84912345678"));
    assertEquals("0769 496 289", PhoneUtils.formatDisplay("+84769496289"));
    assertEquals("0377 035 664", PhoneUtils.formatDisplay("+84377035664"));
  }

  @Test
  @DisplayName("Phát voucher chào mừng 50k: phát 1 lần cho số mới, không phát lại khi xóa tài khoản đăng ký lại")
  void testIssueWelcomeVoucherIfEligible() {
    var accounts = mock(AccountRepository.class);
    var encoder = mock(PasswordEncoder.class);
    var contexts = mock(HttpSessionSecurityContextRepository.class);
    var documents = mock(DocumentService.class);
    var emails = mock(EmailService.class);
    var demo = mock(DemoAccessPolicy.class);
    var vouchers = mock(VoucherRepository.class);
    var notificationService = mock(NotificationService.class);

    var authService = new AuthService(
        accounts, encoder, contexts, documents, emails, demo, vouchers, notificationService
    );

    var acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setPhone("+84988111222");

    String docKey = "welcome:phone:+84988111222";
    when(documents.read(any(AppDocument.class))).thenAnswer(inv -> {
      AppDocument doc = inv.getArgument(0);
      if (doc == null || doc.getData() == null || doc.getData().isBlank() || "{}".equals(doc.getData())) {
        return java.util.Collections.emptyMap();
      }
      return java.util.Collections.singletonMap("voucherCode", "WELCOME-OLD");
    });

    // DocumentService.lock() returns a new AppDocument(key) with empty JSON data "{}" when key does not exist yet
    AppDocument uncommittedDoc = new AppDocument(docKey);
    when(documents.lock(docKey)).thenReturn(uncommittedDoc);
    when(vouchers.findByAssignedAccountId(acc.getId())).thenReturn(List.of());
    when(vouchers.save(any(Voucher.class))).thenAnswer(i -> i.getArgument(0));

    // 1. Lần đăng ký đầu tiên: phát đúng 1 voucher WELCOME-XXXX 50.000₫ hạn 30 ngày
    authService.issueWelcomeVoucherIfEligible(acc, "0988111222");

    ArgumentCaptor<Voucher> voucherCaptor = ArgumentCaptor.forClass(Voucher.class);
    verify(vouchers, times(1)).save(voucherCaptor.capture());
    Voucher issuedVoucher = voucherCaptor.getValue();
    assertTrue(issuedVoucher.getCode().startsWith("WELCOME-"), "Mã voucher phải bắt đầu bằng WELCOME-");
    assertEquals(new BigDecimal("50000"), issuedVoucher.getValue());
    assertEquals("ACTIVE", issuedVoucher.getStatus());
    assertEquals("TIER_GIFT", issuedVoucher.getSource());
    assertTrue(issuedVoucher.getExpiresAt().isAfter(Instant.now().plus(Duration.ofDays(29))));

    verify(documents, times(1)).put(eq(docKey), any());
    verify(notificationService, times(1)).enqueue(
        eq(acc.getId()), isNull(), isNull(), eq("WELCOME_GIFT"), eq("IN_APP"), isNull(),
        contains("Chào mừng"), contains("50.000"), any(), any()
    );

    // 2. Kịch bản: Xoá tài khoản cũ, đăng ký tài khoản mới với cùng số điện thoại
    Account reRegisteredAcc = new Account();
    reRegisteredAcc.setId(UUID.randomUUID());
    reRegisteredAcc.setPhone("+84988111222");

    // Khi đã phát, DocumentService.lock() trả về AppDocument có data != null
    AppDocument existingCommittedDoc = new AppDocument(docKey);
    existingCommittedDoc.setData("{\"voucherCode\":\"" + issuedVoucher.getCode() + "\"}");
    when(documents.lock(docKey)).thenReturn(existingCommittedDoc);
    when(vouchers.findByAssignedAccountId(reRegisteredAcc.getId())).thenReturn(List.of());

    authService.issueWelcomeVoucherIfEligible(reRegisteredAcc, "0988111222");

    // Vẫn chỉ có đúng 1 voucher được save (không phát thêm voucher cho tài khoản đăng ký lại)
    verify(vouchers, times(1)).save(any(Voucher.class));
  }
}
