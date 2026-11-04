package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.courtly.dto.VoucherOrderContext;
import java.time.LocalDate;
import java.time.LocalTime;
import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
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
  private TierPricingService memberships;
  private AccountRepository accounts;
  private AuditService auditService;
  private VoucherService service;

  @BeforeEach
  void setUp() {
    vouchers = mock(VoucherRepository.class);
    redemptions = mock(VoucherRedemptionRepository.class);
    orders = mock(CustomerOrderRepository.class);
    memberships = mock(TierPricingService.class);
    accounts = mock(AccountRepository.class);
    auditService = mock(AuditService.class);
    service = new VoucherService(vouchers, redemptions, orders, accounts, auditService);
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
  void vip10RequiresChallengerTier() {
    Voucher v = createVoucher("VIP10", "PERCENT", new BigDecimal("10"), new BigDecimal("200000"), new BigDecimal("100000"));
    v.setMinTier("CHALLENGER");
    when(vouchers.findByCodeIgnoreCase("VIP10")).thenReturn(Optional.of(v));

    UUID accountId = UUID.randomUUID();
    com.courtly.entity.Account rookie = new com.courtly.entity.Account();
    rookie.setId(accountId);
    rookie.setTier("ROOKIE");
    when(accounts.findById(accountId)).thenReturn(Optional.of(rookie));

    var ex = assertThrows(BusinessException.class, () -> service.calculate("VIP10", new BigDecimal("250000"), accountId));
    assertTrue(ex.getMessage().contains("Chỉ áp dụng từ hạng Challenger trở lên"));

    rookie.setTier("CHALLENGER");
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

  @Test
  void evaluateAllDistinguishesApplicableFromConditionalVouchers() {
    Voucher welcome = createVoucher("WELCOME", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), new BigDecimal("50000"));
    welcome.setNewUserOnly(true);

    Voucher vip10 = createVoucher("VIP10", "PERCENT", new BigDecimal("10"), new BigDecimal("200000"), new BigDecimal("100000"));
    vip10.setMinTier("CHALLENGER");

    Voucher he2026 = createVoucher("HE2026", "FIXED", new BigDecimal("50000"), new BigDecimal("150000"), new BigDecimal("50000"));

    when(vouchers.findByEnabledTrue()).thenReturn(List.of(welcome, vip10, he2026));

    UUID accountId = UUID.randomUUID();
    com.courtly.entity.Account challenger = new com.courtly.entity.Account();
    challenger.setId(accountId);
    challenger.setTier("CHALLENGER");
    when(accounts.findById(accountId)).thenReturn(Optional.of(challenger));
    when(orders.countByCustomerAccountIdAndStatusNotIn(eq(accountId), any())).thenReturn(1L);

    // Amount is 200,000 đ
    var list = service.evaluateAll(new BigDecimal("200000"), accountId);
    assertEquals(3, list.size());

    // WELCOME should be conditional / not applicable because of past orders
    var evalWelcome = list.stream().filter(m -> "WELCOME".equals(m.get("code"))).findFirst().orElseThrow();
    assertEquals(false, evalWelcome.get("applicable"));
    assertTrue(evalWelcome.get("reason").toString().contains("đơn đầu tiên"));

    // VIP10 should be applicable (member + amount >= 200k)
    var evalVip = list.stream().filter(m -> "VIP10".equals(m.get("code"))).findFirst().orElseThrow();
    assertEquals(true, evalVip.get("applicable"));
    assertNull(evalVip.get("reason"));
    assertEquals(new BigDecimal("20000.00"), evalVip.get("discount"));

    // HE2026 should be applicable (amount >= 150k)
    var evalHe = list.stream().filter(m -> "HE2026".equals(m.get("code"))).findFirst().orElseThrow();
    assertEquals(true, evalHe.get("applicable"));
    assertNull(evalHe.get("reason"));

    // If amount is only 100,000 đ, HE2026 and VIP10 become conditional due to minOrder
    var list100k = service.evaluateAll(new BigDecimal("100000"), accountId);
    var evalHe100 = list100k.stream().filter(m -> "HE2026".equals(m.get("code"))).findFirst().orElseThrow();
    assertEquals(false, evalHe100.get("applicable"));
    assertTrue(evalHe100.get("reason").toString().contains("Cần đơn từ"));
  }
  @Test
  void retainedRedemptionSurvivesRestorationWithoutAnotherUse() {
    var voucher = createVoucher("KEPT", "FIXED", new BigDecimal("50000"), BigDecimal.ZERO, null);
    voucher.setUsedCount(1); voucher.setUsageLimit(1); voucher.setEnabled(false);
    var order = new CustomerOrder(); order.setId(UUID.randomUUID());
    var redemption = new VoucherRedemption(); redemption.setVoucher(voucher);
    redemption.setDiscountAmount(new BigDecimal("50000"));
    when(redemptions.findByOrderId(order.getId())).thenReturn(Optional.of(redemption));
    assertEquals(new BigDecimal("50000"), service.previewRestore("KEPT", order, new BigDecimal("400000")).get("discount"));
    assertEquals(new BigDecimal("50000"), service.restore("KEPT", order, new BigDecimal("400000")).get("discount"));
    verify(redemptions, never()).save(any());
    verify(vouchers, never()).findByCodeForUpdate(any());
    assertEquals(1, voucher.getUsedCount());
  }

  @Test
  void returnedVoucherMustAcquireAUseAgainAndPreviewDoesNotConsumeIt() {
    var voucher = createVoucher("REUSE", "FIXED", new BigDecimal("50000"), new BigDecimal("100000"), null);
    var order = new CustomerOrder(); order.setId(UUID.randomUUID());
    when(redemptions.findByOrderId(order.getId())).thenReturn(Optional.empty());
    when(vouchers.findByCodeIgnoreCase("REUSE")).thenReturn(Optional.of(voucher));
    when(vouchers.findByCodeForUpdate("REUSE")).thenReturn(Optional.of(voucher));
    var preview = service.previewRestore("REUSE", order, new BigDecimal("200000"));
    assertEquals(0, voucher.getUsedCount());
    verify(redemptions, never()).save(any());
    assertEquals(preview, service.restore("REUSE", order, new BigDecimal("200000")));
    assertEquals(1, voucher.getUsedCount());
    verify(redemptions).save(any());
  }

  @Test
  void returnedVoucherCannotBypassCurrentLimitsOrMinimum() {
    var voucher = createVoucher("LIMIT", "FIXED", new BigDecimal("50000"), new BigDecimal("150000"), null);
    var order = new CustomerOrder(); order.setId(UUID.randomUUID());
    when(redemptions.findByOrderId(order.getId())).thenReturn(Optional.empty());
    when(vouchers.findByCodeIgnoreCase("LIMIT")).thenReturn(Optional.of(voucher));
    when(vouchers.findByCodeForUpdate("LIMIT")).thenReturn(Optional.of(voucher));
    assertThrows(BusinessException.class, () -> service.previewRestore("LIMIT", order, new BigDecimal("100000")));
    assertThrows(BusinessException.class, () -> service.restore("LIMIT", order, new BigDecimal("100000")));
    voucher.setUsedCount(100);
    assertThrows(BusinessException.class, () -> service.previewRestore("LIMIT", order, new BigDecimal("200000")));
    assertThrows(BusinessException.class, () -> service.restore("LIMIT", order, new BigDecimal("200000")));
    verify(redemptions, never()).save(any());
  }

  @Test
  void timeConditionPassesWhenSlotsWithinWindowAndFailsWhenSlotExceeds() {
    Voucher v = createVoucher("GOLDEN1H", "FIXED", new BigDecimal("50000"), BigDecimal.ZERO, null);
    v.setValidFromTime(LocalTime.of(10, 0));
    v.setValidToTime(LocalTime.of(15, 0));
    when(vouchers.findByCodeIgnoreCase("GOLDEN1H")).thenReturn(Optional.of(v));

    UUID accId = UUID.randomUUID();

    // Pass case: slot 10:00 to 12:00
    var passSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 10), LocalTime.of(10, 0), LocalTime.of(12, 0), "OUTDOOR");
    var passCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(passSlot));
    var res = service.calculate("GOLDEN1H", new BigDecimal("200000"), accId, passCtx);
    assertNotNull(res);
    assertEquals("GOLDEN1H", res.get("code"));

    // Fail case: slot 15:00 to 16:00 (lech 1 gio)
    var failSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 10), LocalTime.of(15, 0), LocalTime.of(16, 0), "OUTDOOR");
    var failCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(failSlot));
    var ex = assertThrows(BusinessException.class, () -> service.calculate("GOLDEN1H", new BigDecimal("200000"), accId, failCtx));
    assertTrue(ex.getMessage().contains("Chỉ áp dụng khung 10:00–15:00"));
  }

  @Test
  void zoneConditionPassesWhenMatchingAndFailsWhenDifferentZone() {
    Voucher v = createVoucher("OUTDOORONLY", "FIXED", new BigDecimal("50000"), BigDecimal.ZERO, null);
    v.setZone("OUTDOOR");
    when(vouchers.findByCodeIgnoreCase("OUTDOORONLY")).thenReturn(Optional.of(v));

    UUID accId = UUID.randomUUID();

    // Pass case: slot is OUTDOOR
    var passSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 10), LocalTime.of(8, 0), LocalTime.of(9, 0), "OUTDOOR");
    var passCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(passSlot));
    var res = service.calculate("OUTDOORONLY", new BigDecimal("200000"), accId, passCtx);
    assertNotNull(res);
    assertEquals("OUTDOORONLY", res.get("code"));

    // Fail case: slot is INDOOR
    var failSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 10), LocalTime.of(8, 0), LocalTime.of(9, 0), "INDOOR");
    var failCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(failSlot));
    var ex = assertThrows(BusinessException.class, () -> service.calculate("OUTDOORONLY", new BigDecimal("200000"), accId, failCtx));
    assertTrue(ex.getMessage().contains("Chỉ áp dụng sân ngoài trời"));
  }

  @Test
  void weekdayConditionPassesWhenWeekdayMatchesAndFailsOnWeekend() {
    Voucher v = createVoucher("WEEKDAYONLY", "FIXED", new BigDecimal("50000"), BigDecimal.ZERO, null);
    v.setValidWeekdays("1,2,3,4,5");
    when(vouchers.findByCodeIgnoreCase("WEEKDAYONLY")).thenReturn(Optional.of(v));

    UUID accId = UUID.randomUUID();

    // Pass case: Wednesday 2026-11-11 (dow = 3)
    var passSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 11), LocalTime.of(8, 0), LocalTime.of(9, 0), "OUTDOOR");
    var passCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(passSlot));
    var res = service.calculate("WEEKDAYONLY", new BigDecimal("200000"), accId, passCtx);
    assertNotNull(res);
    assertEquals("WEEKDAYONLY", res.get("code"));

    // Fail case: Saturday 2026-11-14 (dow = 6)
    var failSlot = new VoucherOrderContext.SlotItem(LocalDate.of(2026, 11, 14), LocalTime.of(8, 0), LocalTime.of(9, 0), "OUTDOOR");
    var failCtx = new VoucherOrderContext(new BigDecimal("200000"), accId, List.of(failSlot));
    var ex = assertThrows(BusinessException.class, () -> service.calculate("WEEKDAYONLY", new BigDecimal("200000"), accId, failCtx));
    assertTrue(ex.getMessage().contains("Chỉ áp dụng Thứ 2–Thứ 6"));
  }

  @Test
  void assignedAccountConditionRejectsDifferentAccount() {
    Voucher v = createVoucher("PERSONAL", "FIXED", new BigDecimal("50000"), BigDecimal.ZERO, null);
    UUID ownerId = UUID.randomUUID();
    v.setAssignedAccountId(ownerId);
    when(vouchers.findByCodeIgnoreCase("PERSONAL")).thenReturn(Optional.of(v));

    UUID otherId = UUID.randomUUID();
    var ctx = new VoucherOrderContext(new BigDecimal("200000"), otherId, List.of());
    var ex = assertThrows(BusinessException.class, () -> service.calculate("PERSONAL", new BigDecimal("200000"), otherId, ctx));
    assertTrue(ex.getMessage().contains("Voucher dành riêng cho tài khoản khác"));
  }
}
