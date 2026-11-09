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
import org.mockito.ArgumentCaptor;

class LoyaltyServiceTest {

  private AccountRepository accounts;
  private LoyaltyLedgerRepository ledger;
  private VipCardRepository vipCards;
  private LoungeVisitRepository loungeVisits;
  private VoucherService voucherService;
  private VoucherRepository vouchers;
  private NotificationService notificationService;
  private AuditService auditService;
  private DocumentService documents;
  private LoyaltyService loyaltyService;

  private final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

  @BeforeEach
  void setUp() {
    accounts = mock(AccountRepository.class);
    ledger = mock(LoyaltyLedgerRepository.class);
    vipCards = mock(VipCardRepository.class);
    loungeVisits = mock(LoungeVisitRepository.class);
    voucherService = mock(VoucherService.class);
    vouchers = mock(VoucherRepository.class);
    notificationService = mock(NotificationService.class);
    auditService = mock(AuditService.class);
    documents = mock(DocumentService.class);

    Voucher defaultVoucher = new Voucher();
    defaultVoucher.setCode("GS-TEST");
    defaultVoucher.setSource("TIER_GIFT");
    when(voucherService.issuePersonalVoucher(any(), any())).thenReturn(defaultVoucher);

    loyaltyService = new LoyaltyService(
        accounts,
        ledger,
        vipCards,
        loungeVisits,
        voucherService,
        vouchers,
        notificationService,
        auditService,
        documents,
        new LoyaltyPolicyService(documents, auditService, accounts, notificationService)
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
  void testReverseOrderPoints_CalledTwice_OnlyReversesOnce() {
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

    // Lan goi dau tien: chua co reversal
    when(ledger.findByOrderId(order.getId())).thenReturn(Collections.emptyList());
    loyaltyService.reverseOrderPoints(order);
    assertEquals(455, acc.getPointsBalance());

    // Lan goi thu hai: da ton tai reversal am
    LoyaltyLedger existingReversal = new LoyaltyLedger();
    existingReversal.setType("REVERSAL");
    existingReversal.setPoints(-45);
    when(ledger.findByOrderId(order.getId())).thenReturn(List.of(existingReversal));
    loyaltyService.reverseOrderPoints(order);

    // Diem khong bi tru lan hai
    assertEquals(455, acc.getPointsBalance());
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
    verify(voucherService, times(1)).issuePersonalVoucher(eq(acc.getId()), any(VoucherService.IssueSpec.class));
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
    verify(voucherService).issuePersonalVoucher(eq(acc.getId()), any(VoucherService.IssueSpec.class));
  }

  @Test
  void testCalculateEffectivePoints() {
    // 1. Min 100 points
    assertEquals(0, loyaltyService.calculateEffectivePoints(90, 1000, new BigDecimal("300000")));

    // 2. Multiple of 10
    assertEquals(250, loyaltyService.calculateEffectivePoints(255, 1000, new BigDecimal("300000")));

    // 3. Max 50% of remaining court fee (court 285.000₫ -> 50% is 142.500₫ -> max 1420 points)
    assertEquals(500, loyaltyService.calculateEffectivePoints(500, 1500, new BigDecimal("285000")));
    assertEquals(1420, loyaltyService.calculateEffectivePoints(2000, 1500, new BigDecimal("285000")));

    // 4. Cannot exceed account balance
    assertEquals(300, loyaltyService.calculateEffectivePoints(500, 300, new BigDecimal("285000")));
  }

  @Test
  void testRefundRedeemedPointsIdempotent() {
    UUID orderId = UUID.randomUUID();
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setEmail("hoivien@test.com");
    acc.setPointsBalance(1000);

    CustomerOrder order = new CustomerOrder();
    order.setId(orderId);
    order.setCustomerAccount(acc);
    order.setPointsRedeemed(500);

    when(accounts.findForUpdate(accountId)).thenReturn(Optional.of(acc));
    when(ledger.findByOrderId(orderId)).thenReturn(List.of());

    // First refund
    loyaltyService.refundRedeemedPoints(order);
    assertEquals(1500, acc.getPointsBalance());
    verify(ledger, times(1)).save(any(LoyaltyLedger.class));

    // Second refund with existing REVERSAL -> idempotent, points not refunded twice
    LoyaltyLedger rev = new LoyaltyLedger();
    rev.setType("REVERSAL");
    rev.setPoints(500);
    when(ledger.findByOrderId(orderId)).thenReturn(List.of(rev));

    loyaltyService.refundRedeemedPoints(order);
    assertEquals(1500, acc.getPointsBalance()); // still 1500
    verify(ledger, times(1)).save(any(LoyaltyLedger.class)); // not called again
  }

  @Test
  void testRewardsCatalogAndRedemption() {
    var catalog = loyaltyService.getRewardsCatalog();
    assertEquals(3, catalog.size());
    assertTrue(catalog.stream().anyMatch(r -> "EXT30".equals(r.get("code")) && ((int) r.get("points")) == 1500));
    assertTrue(catalog.stream().anyMatch(r -> "GOLDEN1H".equals(r.get("code")) && ((int) r.get("points")) == 2500));
    assertTrue(catalog.stream().anyMatch(r -> "REF1H".equals(r.get("code")) && ((int) r.get("points")) == 2000));

    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setEmail("hoivien@test.com");
    acc.setPointsBalance(2300);

    when(accounts.findForUpdate(accountId)).thenReturn(Optional.of(acc));
    when(vouchers.save(any(Voucher.class))).thenAnswer(i -> i.getArgument(0));

    // Redeem EXT30 (1500 pts)
    var res = loyaltyService.redeemReward(accountId, "EXT30");
    assertTrue((boolean) res.get("success"));
    assertEquals(800, acc.getPointsBalance());
    assertEquals(800, res.get("pointsBalance"));
    assertTrue(String.valueOf(res.get("voucherCode")).startsWith("RWD-EXT30-"));
  }
  @Test
  void testGrandSlamUpgradeIssuesGsVoucherWithTierGiftSource() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setEmail("grand.slam@test.com");
    acc.setTier("MASTERS");
    acc.setLifetimeSpend(new BigDecimal("19900000"));

    when(accounts.findById(accountId)).thenReturn(Optional.of(acc));
    when(vipCards.findByCode(anyString())).thenReturn(Optional.empty());
    when(ledger.sumSpendByAccountIdSince(eq(accountId), any(Instant.class))).thenReturn(new BigDecimal("20100000"));

    when(documents.lock(contains("tier-gift:"))).thenReturn(new AppDocument("tier-gift"));
    when(documents.read(any(AppDocument.class))).thenReturn(Collections.emptyMap());

    Voucher gsVoucher = new Voucher();
    gsVoucher.setCode("GS-TEST");
    gsVoucher.setSource("TIER_GIFT");
    when(voucherService.issuePersonalVoucher(eq(accountId), any(VoucherService.IssueSpec.class))).thenReturn(gsVoucher);
    when(vipCards.save(any(VipCard.class))).thenAnswer(i -> i.getArgument(0));

    // Order checkout exceeds 20.000.000₫ -> upgrades to GRAND_SLAM
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    order.setTotalAmount(new BigDecimal("200000"));
    order.setPaidAmount(new BigDecimal("200000"));
    order.setPaymentStatus("PAID");

    loyaltyService.earnOrderPoints(order, false);

    assertEquals("GRAND_SLAM", acc.getTier());
    ArgumentCaptor<VoucherService.IssueSpec> specCaptor = ArgumentCaptor.forClass(VoucherService.IssueSpec.class);
    verify(voucherService, times(1)).issuePersonalVoucher(eq(accountId), specCaptor.capture());
    VoucherService.IssueSpec spec = specCaptor.getValue();
    assertEquals("GS", spec.prefix());
    assertEquals("TIER_GIFT", spec.source());
    assertEquals(new BigDecimal("300000"), spec.value());
  }

  @Test
  void testBirthdayVoucherIssuesBdayVoucherWithBirthdaySource() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setEmail("birthday@test.com");
    acc.setTier("GRAND_SLAM");
    acc.setBirthDate(LocalDate.of(1995, 5, 15));

    // Mock clock on May 1st
    Clock clockMay1 = Clock.fixed(
        LocalDate.of(2026, 5, 1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),
        ZoneId.of("Asia/Ho_Chi_Minh")
    );
    loyaltyService.setClock(clockMay1);

    when(accounts.findAll()).thenReturn(List.of(acc));
    when(documents.lock(contains("birthday-voucher:"))).thenReturn(new AppDocument("bday-lock"));
    when(documents.read(any(AppDocument.class))).thenReturn(Collections.emptyMap());

    Voucher bdayVoucher = new Voucher();
    bdayVoucher.setCode("BDAY-TEST");
    bdayVoucher.setSource("BIRTHDAY");
    when(voucherService.issuePersonalVoucher(eq(accountId), any(VoucherService.IssueSpec.class))).thenReturn(bdayVoucher);

    // Run daily scheduled job
    loyaltyService.dailyLoyaltyMaintenance();

    ArgumentCaptor<VoucherService.IssueSpec> specCaptor = ArgumentCaptor.forClass(VoucherService.IssueSpec.class);
    verify(voucherService, times(1)).issuePersonalVoucher(eq(accountId), specCaptor.capture());
    VoucherService.IssueSpec spec = specCaptor.getValue();
    assertEquals("BDAY", spec.prefix());
    assertEquals("BIRTHDAY", spec.source());
    assertEquals(new BigDecimal("250000"), spec.value());

    // Run 2nd time: document already committed -> no new voucher
    when(documents.read(any(AppDocument.class))).thenReturn(Map.of("voucherCode", "BDAY-TEST"));
    loyaltyService.dailyLoyaltyMaintenance();
    verify(voucherService, times(1)).issuePersonalVoucher(eq(accountId), any()); // still 1
  }

  // ------------------------------------------------------------------ rà soát điểm 2026-11

  private static LoyaltyLedger entry(String type, int points, BigDecimal spend, Instant expiresAt) {
    LoyaltyLedger l = new LoyaltyLedger();
    l.setType(type);
    l.setPoints(points);
    l.setSpendAmount(spend);
    l.setExpiresAt(expiresAt);
    return l;
  }

  @Test
  void testRefundAfterRestoreAndCancelAgain_RefundsOnlyOutstanding() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setPointsBalance(1000);
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    order.setPointsRedeemed(300);
    order.setPointsDiscount(new BigDecimal("30000"));
    when(accounts.findForUpdate(accountId)).thenReturn(Optional.of(acc));

    // Đã trừ 300 rồi hoàn 300 (hủy lần 1) -> khôi phục phải trừ lại 300
    List<LoyaltyLedger> rows = new ArrayList<>(List.of(entry("REDEEM_ORDER", -300, null, null), entry("REVERSAL", 300, BigDecimal.ZERO, null)));
    when(ledger.findByOrderId(order.getId())).thenAnswer(i -> rows);
    when(ledger.save(any(LoyaltyLedger.class))).thenAnswer(i -> { rows.add(i.getArgument(0)); return i.getArgument(0); });

    assertTrue(loyaltyService.reapplyRedeemedPoints(order));
    assertEquals(700, acc.getPointsBalance());

    // Hủy lần 2 -> hoàn lại đúng 300, gọi lại lần nữa không hoàn thêm
    loyaltyService.refundRedeemedPoints(order);
    loyaltyService.refundRedeemedPoints(order);
    assertEquals(1000, acc.getPointsBalance());
  }

  @Test
  void testReapplyRedeemedPoints_NotEnoughBalance_ReturnsFalse() {
    UUID accountId = UUID.randomUUID();
    Account acc = new Account();
    acc.setId(accountId);
    acc.setPointsBalance(100);
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    order.setPointsRedeemed(300);
    when(accounts.findForUpdate(accountId)).thenReturn(Optional.of(acc));
    when(ledger.findByOrderId(order.getId())).thenReturn(List.of(entry("REDEEM_ORDER", -300, null, null), entry("REVERSAL", 300, BigDecimal.ZERO, null)));

    assertFalse(loyaltyService.reapplyRedeemedPoints(order));
    assertEquals(100, acc.getPointsBalance());
  }

  @Test
  void testPartialRefundOfCompletedOrder_ReversesProportionalPoints() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setPointsBalance(500);
    acc.setLifetimeSpend(new BigDecimal("1000000"));
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    when(accounts.findById(acc.getId())).thenReturn(Optional.of(acc));
    when(ledger.findByTypeAndOrderId("EARN", order.getId())).thenReturn(Optional.of(entry("EARN", 100, new BigDecimal("1000000"), null)));
    List<LoyaltyLedger> rows = new ArrayList<>();
    when(ledger.findByOrderId(order.getId())).thenAnswer(i -> rows);
    when(ledger.save(any(LoyaltyLedger.class))).thenAnswer(i -> { rows.add(i.getArgument(0)); return i.getArgument(0); });

    loyaltyService.reverseEarnedPoints(order, new BigDecimal("300000")); // hoàn 30%
    assertEquals(470, acc.getPointsBalance());
    assertEquals(new BigDecimal("700000"), acc.getLifetimeSpend());

    loyaltyService.reverseEarnedPoints(order, null); // hoàn nốt
    assertEquals(400, acc.getPointsBalance());
    assertEquals(0, acc.getLifetimeSpend().signum());

    loyaltyService.reverseEarnedPoints(order, null); // không thu hồi thêm
    assertEquals(400, acc.getPointsBalance());
  }

  @Test
  void testReverseEarnedPoints_NeverNegativeBalance() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setPointsBalance(20);
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    when(accounts.findById(acc.getId())).thenReturn(Optional.of(acc));
    when(ledger.findByTypeAndOrderId("EARN", order.getId())).thenReturn(Optional.of(entry("EARN", 100, new BigDecimal("1000000"), null)));

    loyaltyService.reverseOrderPoints(order);
    assertEquals(0, acc.getPointsBalance());
  }

  @Test
  void testTierUpgradeSkipsTier_GrantsEveryGift() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setTier("ROOKIE");
    acc.setPointsBalance(0);

    loyaltyService.checkTierUpgrade(acc, new BigDecimal("9000000"));

    assertEquals("MASTERS", acc.getTier());
    assertEquals(700, acc.getPointsBalance()); // 200 (Challenger) + 500 (Masters)
  }

  @Test
  void testExpirePoints_FifoAfterConsumption() {
    Instant now = Instant.parse("2026-11-09T02:00:00Z");
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setPointsBalance(700);
    when(ledger.findByAccountIdOrderByCreatedAtDesc(acc.getId())).thenReturn(List.of(
        entry("EARN", 300, BigDecimal.ZERO, now.minus(Duration.ofDays(1))),   // đã quá hạn
        entry("EARN", 500, BigDecimal.ZERO, now.plus(Duration.ofDays(100))),  // còn hạn
        entry("REDEEM_ORDER", -100, BigDecimal.ZERO, null)));                  // đã tiêu 100 (trừ vào điểm cũ)

    assertEquals(200, loyaltyService.expirePoints(acc, now));
    assertEquals(500, acc.getPointsBalance());
  }

  @Test
  void testEarnOrderPoints_GoldenShareDoublesOnlyGoldenPart() {
    Account acc = new Account();
    acc.setId(UUID.randomUUID());
    acc.setTier("ROOKIE");
    acc.setPointsBalance(0);
    CustomerOrder order = new CustomerOrder();
    order.setId(UUID.randomUUID());
    order.setCustomerAccount(acc);
    order.setTotalAmount(new BigDecimal("400000"));
    order.setPaidAmount(new BigDecimal("400000"));
    when(accounts.findById(acc.getId())).thenReturn(Optional.of(acc));
    when(ledger.findByTypeAndOrderId("EARN", order.getId())).thenReturn(Optional.empty());
    when(ledger.sumSpendByAccountIdSince(any(), any())).thenReturn(BigDecimal.ZERO);

    // 40 điểm gốc, một nửa tiền sân thuộc giờ vàng -> 40 × 1,5 = 60
    assertEquals(60, loyaltyService.earnOrderPoints(order, 0.5));
  }
}
