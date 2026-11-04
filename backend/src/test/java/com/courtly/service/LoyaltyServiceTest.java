package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LoyaltyServiceTest {

  private AccountRepository accounts;
  private LoyaltyLedgerRepository ledger;
  private VipCardRepository vipCards;
  private LoungeVisitRepository loungeVisits;
  private VoucherService voucherService;
  private NotificationService notificationService;
  private AuditService auditService;
  private LoyaltyService loyaltyService;

  private final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

  @BeforeEach
  void setUp() {
    accounts = mock(AccountRepository.class);
    ledger = mock(LoyaltyLedgerRepository.class);
    vipCards = mock(VipCardRepository.class);
    loungeVisits = mock(LoungeVisitRepository.class);
    voucherService = mock(VoucherService.class);
    notificationService = mock(NotificationService.class);
    auditService = mock(AuditService.class);

    loyaltyService = new LoyaltyService(
        accounts,
        ledger,
        vipCards,
        loungeVisits,
        voucherService,
        notificationService,
        auditService
    );
  }

  @Test
  void testComputePointsDiscount() {
    // Under 100 points -> 0
    assertEquals(BigDecimal.ZERO, loyaltyService.computePointsDiscount(90, new BigDecimal("300000")));

    // 100 points = 10.000₫ on 300.000₫ remaining (max 50% = 150.000₫) -> 10.000₫
    assertEquals(new BigDecimal("10000"), loyaltyService.computePointsDiscount(100, new BigDecimal("300000")));

    // 255 points rounded down to 250 points = 25.000₫
    assertEquals(new BigDecimal("25000"), loyaltyService.computePointsDiscount(255, new BigDecimal("300000")));

    // Max 50% cap: 2000 points = 200.000₫, but court is 300.000₫ (50% is 150.000₫) -> capped at 150.000₫
    assertEquals(new BigDecimal("150000"), loyaltyService.computePointsDiscount(2000, new BigDecimal("300000")));
  }

  @Test
  void testEarnOrderPointsMultiplier() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setEmail("test@courtly.com");
    acc.setTier("MASTERS"); // 1.5x
    acc.setPointsBalance(100);
    acc.setLifetimeSpend(new BigDecimal("8000000"));

    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    order.setTotalAmount(new BigDecimal("300000"));
    order.setPaidAmount(new BigDecimal("300000"));
    order.setStatus("COMPLETED");

    when(accounts.findById(acc.getId())).thenReturn(Optional.of(acc));
    when(ledger.findByTypeAndOrderId("EARN", order.getId())).thenReturn(Optional.empty());

    // 300.000₫ / 10.000₫ = 30 base points * 1.5 = 45 points
    int earned = loyaltyService.earnOrderPoints(order, false);
    assertEquals(45, earned);
    assertEquals(145, acc.getPointsBalance());

    // Golden hour: 2x -> 30 * 1.5 * 2 = 90 points
    acc.setPointsBalance(100);
    int earnedGolden = loyaltyService.earnOrderPoints(order, true);
    assertEquals(90, earnedGolden);
  }

  @Test
  void testReverseOrderPoints() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setEmail("test@courtly.com");
    acc.setPointsBalance(500);
    acc.setLifetimeSpend(new BigDecimal("5000000"));

    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);

    LoyaltyLedger earn = new LoyaltyLedger();
    earn.setType("EARN");
    earn.setPoints(45);
    earn.setSpendAmount(new BigDecimal("300000"));

    when(accounts.findById(acc.getId())).thenReturn(Optional.of(acc));
    when(ledger.findByTypeAndOrderId("EARN", order.getId())).thenReturn(Optional.of(earn));

    loyaltyService.reverseOrderPoints(order);

    assertEquals(455, acc.getPointsBalance());
    assertEquals(new BigDecimal("4700000"), acc.getLifetimeSpend());
    verify(ledger, times(1)).save(argThat(l -> "REVERSAL".equals(l.getType()) && l.getPoints() == -45));
  }

  @Test
  void testCheckTierUpgradeInstant() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setEmail("upgrade@courtly.com");
    acc.setTier("MASTERS");
    acc.setPointsBalance(1500);

    when(vipCards.findByCode(anyString())).thenReturn(Optional.empty());
    when(vipCards.save(any(VipCard.class))).thenAnswer(i -> i.getArgument(0));

    // Spend reaches 20M -> upgrade to GRAND_SLAM
    loyaltyService.checkTierUpgrade(acc, new BigDecimal("20100000"));

    assertEquals("GRAND_SLAM", acc.getTier());
    assertNotNull(acc.getTierSince());
    assertNotNull(acc.getTierExpiresAt());
    // Received 1000 bonus points
    assertEquals(2500, acc.getPointsBalance());
    verify(vipCards, times(1)).save(any(VipCard.class));
    verify(voucherService, times(1)).createCompensationVoucher(eq(acc.getId()), isNull(), isNull(), anyMap(), eq(acc));
  }

  @Test
  void testDailyMaintenanceTierDowngrade() {
    Instant testNow = Instant.parse("2026-11-04T02:00:00Z");
    loyaltyService.setClock(Clock.fixed(testNow, ZONE));

    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setEmail("downgrade@courtly.com");
    acc.setTier("GRAND_SLAM");
    // Expired yesterday
    acc.setTierExpiresAt(testNow.minus(Duration.ofDays(1)));
    acc.setPointsBalance(100);

    when(accounts.findAll()).thenReturn(List.of(acc));


    loyaltyService.dailyLoyaltyMaintenance();

    // Downgraded by 1 tier to MASTERS
    assertEquals("MASTERS", acc.getTier());
    assertTrue(acc.getTierExpiresAt().isAfter(testNow));
  }

  @Test
  void testRolling12MonthSpendExcludes13MonthsAgo() {
    Instant fixedNow = Instant.parse("2026-11-04T12:00:00Z");
    loyaltyService.setClock(Clock.fixed(fixedNow, ZONE));

    UUID accId = UUID.randomUUID();
    Instant cutoff = fixedNow.minus(Duration.ofDays(365));

    when(ledger.sumSpendByAccountIdSince(eq(accId), eq(cutoff))).thenReturn(new BigDecimal("19800000"));

    BigDecimal spend12m = loyaltyService.rolling12MonthSpend(accId);
    assertEquals(new BigDecimal("19800000"), spend12m);
    verify(ledger).sumSpendByAccountIdSince(eq(accId), eq(cutoff));
  }

  @Test
  void testCustomerWith19M8And235kUpgradesToGrandSlam() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setEmail("hoivien@courtly.com");
    acc.setTier("MASTERS");
    acc.setPointsBalance(1000);

    when(vipCards.findByCode(anyString())).thenReturn(Optional.empty());
    when(vipCards.save(any(VipCard.class))).thenAnswer(i -> i.getArgument(0));

    // 19.8M + 235k = 20.035.000đ >= 20.000.000đ -> Grand Slam!
    BigDecimal total12m = new BigDecimal("19800000").add(new BigDecimal("235000"));
    loyaltyService.checkTierUpgrade(acc, total12m);

    assertEquals("GRAND_SLAM", acc.getTier());
    assertEquals(2000, acc.getPointsBalance()); // +1000 tier gift points
    verify(vipCards).save(any(VipCard.class));
    verify(voucherService).createCompensationVoucher(eq(acc.getId()), isNull(), isNull(), anyMap(), eq(acc));
  }

}
