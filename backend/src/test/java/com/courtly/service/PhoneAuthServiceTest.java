package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.exception.BusinessException;
import com.courtly.util.PhoneUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
  @DisplayName("Phát voucher chào mừng 50k idempotent theo số điện thoại")
  void testIssueWelcomeVoucherIfEligible() {
    var accounts = org.mockito.Mockito.mock(com.courtly.repository.AccountRepository.class);
    var encoder = org.mockito.Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class);
    var contexts = org.mockito.Mockito.mock(org.springframework.security.web.context.HttpSessionSecurityContextRepository.class);
    var documents = org.mockito.Mockito.mock(com.courtly.service.DocumentService.class);
    var emails = org.mockito.Mockito.mock(com.courtly.service.EmailService.class);
    var smsService = org.mockito.Mockito.mock(com.courtly.service.sms.SmsService.class);
    var demo = org.mockito.Mockito.mock(com.courtly.service.DemoAccessPolicy.class);
    var vouchers = org.mockito.Mockito.mock(com.courtly.repository.VoucherRepository.class);
    var notificationService = org.mockito.Mockito.mock(com.courtly.service.NotificationService.class);

    var authService = new com.courtly.service.AuthService(
        accounts, encoder, contexts, documents, emails, smsService, demo, vouchers, notificationService
    );

    var acc = new com.courtly.entity.Account();
    acc.setId(java.util.UUID.randomUUID());
    acc.setPhone("+84988111222");

    org.mockito.Mockito.when(documents.lock("welcome:phone:+84988111222")).thenReturn(null);
    org.mockito.Mockito.when(vouchers.findByAssignedAccountId(acc.getId())).thenReturn(java.util.List.of());
    org.mockito.Mockito.when(vouchers.save(org.mockito.ArgumentMatchers.any(com.courtly.entity.Voucher.class))).thenAnswer(i -> i.getArgument(0));

    // First issue -> creates voucher & records document
    authService.issueWelcomeVoucherIfEligible(acc, "0988111222");
    org.mockito.Mockito.verify(vouchers, org.mockito.Mockito.times(1)).save(org.mockito.ArgumentMatchers.any(com.courtly.entity.Voucher.class));
    org.mockito.Mockito.verify(documents, org.mockito.Mockito.times(1)).put(
        org.mockito.ArgumentMatchers.eq("welcome:phone:+84988111222"),
        org.mockito.ArgumentMatchers.any()
    );

    // Second issue with existing document -> idempotent, does not issue again
    org.mockito.Mockito.when(documents.lock("welcome:phone:+84988111222")).thenReturn(new com.courtly.entity.AppDocument());
    authService.issueWelcomeVoucherIfEligible(acc, "0988111222");
    org.mockito.Mockito.verify(vouchers, org.mockito.Mockito.times(1)).save(org.mockito.ArgumentMatchers.any(com.courtly.entity.Voucher.class)); // still 1
  }
}