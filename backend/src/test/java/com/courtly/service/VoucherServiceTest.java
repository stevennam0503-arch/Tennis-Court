package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.exception.BusinessException;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VoucherServiceTest {

  private VoucherService service;

  @BeforeEach
  void setUp() {
    service = new VoucherService();
  }

  @Test
  void welcomeVoucherApplies50kDiscountWhenEligible() {
    var result = service.calculate("WELCOME", new BigDecimal("150000"));
    assertNotNull(result);
    assertEquals("WELCOME", result.get("code"));
    assertEquals(new BigDecimal("50000"), result.get("discount"));
    assertEquals(true, result.get("applied"));
  }

  @Test
  void voucherThrowsWhenOrderBelowMinimum() {
    var ex =
        assertThrows(
            BusinessException.class,
            () -> service.calculate("WELCOME", new BigDecimal("80000")));
    assertTrue(ex.getMessage().contains("tối thiểu 100000"));
  }

  @Test
  void flash25AppliesPercentAndRespectsCap() {
    // 25% of 200,000 = 50,000
    var result = service.calculate("FLASH25", new BigDecimal("200000"));
    assertNotNull(result);
    assertEquals("FLASH25", result.get("code"));
    assertEquals(new BigDecimal("50000.00"), result.get("discount"));

    // 25% of 1,000,000 = 250,000, capped at maxDiscount 150,000
    var capped = service.calculate("FLASH25", new BigDecimal("1000000"));
    assertEquals(new BigDecimal("150000"), capped.get("discount"));
  }

  @Test
  void unknownVoucherCodeThrowsException() {
    var ex =
        assertThrows(
            BusinessException.class,
            () -> service.calculate("INVALID_CODE", new BigDecimal("200000")));
    assertTrue(ex.getMessage().contains("không tồn tại hoặc đã hết hạn"));
  }

  @Test
  void listAvailableReturnsAllActiveVouchers() {
    var list = service.listAvailable();
    assertFalse(list.isEmpty());
    assertTrue(list.stream().anyMatch(v -> "WELCOME".equals(v.get("code"))));
    assertTrue(list.stream().anyMatch(v -> "HE2026".equals(v.get("code"))));
    assertTrue(list.stream().anyMatch(v -> "COURTLY50K".equals(v.get("code"))));
    assertTrue(list.stream().anyMatch(v -> "VIP10".equals(v.get("code"))));
    assertTrue(list.stream().anyMatch(v -> "FLASH25".equals(v.get("code"))));
  }
}
