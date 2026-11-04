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
}
