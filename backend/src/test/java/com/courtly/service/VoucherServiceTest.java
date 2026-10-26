package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VoucherServiceTest {

  private VoucherRepository vouchers;
  private VoucherRedemptionRepository redemptions;
  private CustomerOrderRepository orders;
  private MembershipService memberships;
  private VoucherService service;

  @BeforeEach
  void setUp() {
    vouchers = mock(VoucherRepository.class);
    redemptions = mock(VoucherRedemptionRepository.class);
    orders = mock(CustomerOrderRepository.class);
    memberships = mock(MembershipService.class);
    service = new VoucherService(vouchers, redemptions, orders, memberships);
  }

  private Voucher createVoucher(String code, String type, BigDecimal val, BigDecimal min, BigDecimal max) {
    Voucher v = new Voucher();
    v.setId(UUID.randomUUID());
    v.setCode(code);
    v.setType(type);
    v.setValue(val);
    v.setMinOrder(min);
    v.setMaxDiscount(max);
    v.setEnabled(true);
    v.setUsedCount(0);
    v.setUsageLimit(100);
    v.setPerUserLimit(1);
    v.setMemberOnly(false);
    v.setNewUserOnly(false);
    v.setDescription("Test voucher " + code);
    return v;
  }

  @Test
  void welcomeVoucherApplies50kDiscountForNewUser() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    v.setNewUserOnly(true);
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(orders.countByCustomerAccountIdAndStatusNotIn(eq(accountId), any())).thenReturn(0L);

    var result = service.calculate("WELCOME", new BigDecimal("150000"), accountId);
    assertNotNull(result);
    assertEquals("WELCOME", result.get("code"));
    assertEquals(new BigDecimal("50000"), result.get("discount"));
    assertEquals(true, result.get("applied"));
  }

  @Test
  void welcomeVoucherRejectsExistingUserWithPastOrders() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    v.setNewUserOnly(true);
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(orders.countByCustomerAccountIdAndStatusNotIn(eq(accountId), any())).thenReturn(2L);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("WELCOME", new BigDecimal("150000"), accountId));
    assertTrue(ex.getMessage().contains("chỉ áp dụng cho khách hàng mới"));
  }

  @Test
  void vip10RequiresActiveMembership() {
    Voucher v = createVoucher("VIP10", "PERCENT", new BigDecimal("10"), new BigDecimal("200000"), new BigDecimal("100000"));
    v.setMemberOnly(true);
    when(vouchers.findByCodeIgnoreCase("VIP10")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(memberships.hasActiveMembership(accountId)).thenReturn(false);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("VIP10", new BigDecimal("250000"), accountId));
    assertTrue(ex.getMessage().contains("chỉ áp dụng cho hội viên"));

    when(memberships.hasActiveMembership(accountId)).thenReturn(true);
    var result = service.calculate("VIP10", new BigDecimal("250000"), accountId);
    assertEquals(new BigDecimal("25000.00"), result.get("discount"));
  }

  @Test
  void voucherThrowsWhenOrderBelowMinimum() {
    Voucher v = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    when(vouchers.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(v));

    var ex = assertThrows(BusinessException.class, () -> service.calculate("WELCOME", new BigDecimal("80000")));
    assertTrue(ex.getMessage().contains("tối thiểu 100000"));
  }

  @Test
  void voucherRejectsWhenTotalUsageLimitExceeded() {
    Voucher v = createVoucher("HE2026", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), null);
    v.setUsageLimit(10);
    v.setUsedCount(10);
    when(vouchers.findByCodeIgnoreCase("HE2026")).thenReturn(Optional.of(v));

    var ex = assertThrows(BusinessException.class, () -> service.calculate("HE2026", new BigDecimal("150000")));
    assertTrue(ex.getMessage().contains("hết lượt sử dụng"));
  }

  @Test
  void voucherRejectsWhenPerUserLimitExceeded() {
    Voucher v = createVoucher("COURTLY50K", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), null);
    v.setPerUserLimit(1);
    when(vouchers.findByCodeIgnoreCase("COURTLY50K")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    when(redemptions.countByVoucherIdAndAccountId(v.getId(), accountId)).thenReturn(1L);

    var ex = assertThrows(BusinessException.class, () -> service.calculate("COURTLY50K", new BigDecimal("150000"), accountId));
    assertTrue(ex.getMessage().contains("đã dùng hết số lần cho phép"));
  }

  @Test
  void redeemLocksVoucherIncrementsCountAndSavesRedemption() {
    Voucher v = createVoucher("FLASH25", "PERCENT", new BigDecimal("25"), new BigDecimal("100000"), new BigDecimal("150000"));
    v.setUsedCount(5);
    when(vouchers.findByCodeForUpdate("FLASH25")).thenReturn(Optional.of(v));

    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());

    var result = service.redeem("FLASH25", order, new BigDecimal("200000"), null);
    assertNotNull(result);
    assertEquals(new BigDecimal("50000.00"), result.get("discount"));
    assertEquals(6, v.getUsedCount());

    verify(vouchers).save(v);
    verify(redemptions).save(any(VoucherRedemption.class));
  }

  @Test
  void releaseDecrementsUsageAndDeletesRedemption() {
    UUID orderId = UUID.randomUUID();
    Voucher v = createVoucher("FLASH25", "PERCENT", new BigDecimal("25"), new BigDecimal("100000"), new BigDecimal("150000"));
    v.setUsedCount(6);

    VoucherRedemption redemption = new VoucherRedemption();
    redemption.setVoucher(v);
    when(redemptions.findByOrderId(orderId)).thenReturn(Optional.of(redemption));
    when(vouchers.findByCodeForUpdate(v.getCode())).thenReturn(Optional.of(v));

    service.release(orderId);

    assertEquals(5, v.getUsedCount());
    verify(vouchers).save(v);
    verify(redemptions).delete(redemption);
  }
}
