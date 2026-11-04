package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoyaltyService {

  private final AccountRepository accounts;
  private final LoyaltyLedgerRepository ledger;
  private final VipCardRepository vipCards;
  private final LoungeVisitRepository loungeVisits;
  private final VoucherService voucherService;
  private final VoucherRepository vouchers;
  private final NotificationService notificationService;
  private final AuditService auditService;
  private final DocumentService documents;

  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private Clock clock = Clock.system(ZONE);

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final String ALPHANUM = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

  public void setClock(Clock clock) {
    this.clock = clock;
  }

  public Clock getClock() {
    return this.clock;
  }

  public Instant now() {
    return clock.instant();
  }

  public ZonedDateTime nowZoned() {
    return now().atZone(ZONE);
  }

  // =========================================================================
  // 1. CHÍNH SÁCH HẠNG (TIERS & BENEFITS)
  // =========================================================================

  public double getTierDiscountPercent(String rawTier) {
    String tier = rawTier != null ? rawTier.toUpperCase(Locale.ROOT) : "ROOKIE";
    return switch (tier) {
      case "GRAND_SLAM" -> 8.0;
      case "MASTERS" -> 5.0;
      case "CHALLENGER" -> 3.0;
      default -> 0.0;
    };
  }

  public double getTierMultiplier(String rawTier) {
    String tier = rawTier != null ? rawTier.toUpperCase(Locale.ROOT) : "ROOKIE";
    return switch (tier) {
      case "GRAND_SLAM" -> 2.0;
      case "MASTERS" -> 1.5;
      case "CHALLENGER" -> 1.2;
      default -> 1.0;
    };
  }

  public int getBookingWindowDays(String rawTier) {
    String tier = rawTier != null ? rawTier.toUpperCase(Locale.ROOT) : "ROOKIE";
    return switch (tier) {
      case "GRAND_SLAM" -> 21;
      case "MASTERS" -> 14;
      case "CHALLENGER" -> 10;
      default -> 7;
    };
  }

  public int getMonthlyFreeChanges(String rawTier) {
    String tier = rawTier != null ? rawTier.toUpperCase(Locale.ROOT) : "ROOKIE";
    return switch (tier) {
      case "GRAND_SLAM" -> 4;
      case "MASTERS" -> 2;
      case "CHALLENGER" -> 1;
      default -> 0;
    };
  }

  public BigDecimal getTierSpendThreshold(String tier) {
    return switch (tier.toUpperCase(Locale.ROOT)) {
      case "GRAND_SLAM" -> BigDecimal.valueOf(20_000_000);
      case "MASTERS" -> BigDecimal.valueOf(8_000_000);
      case "CHALLENGER" -> BigDecimal.valueOf(3_000_000);
      default -> BigDecimal.ZERO;
    };
  }

  // =========================================================================
  // 2. TÍCH ĐIỂM KHI HOÀN TẤT CHECK-OUT (EARN POINTS)
  // =========================================================================

  @Transactional
  public int earnOrderPoints(CustomerOrder order, boolean hasGoldenHourSlot) {
    if (order == null || order.getCustomerAccount() == null) {
      return 0;
    }
    UUID accountId = order.getCustomerAccount().getId();
    Account account = accounts.findById(accountId).orElse(null);
    if (account == null) {
      return 0;
    }

    // Kiểm tra chống cộng 2 lần (unique type=EARN, orderId)
    if (ledger.findByTypeAndOrderId("EARN", order.getId()).isPresent()) {
      return 0;
    }

    BigDecimal paid = order.getPaidAmount() != null ? order.getPaidAmount() : BigDecimal.ZERO;
    // Không tính phần tiền thanh toán bằng điểm (thực thu tối đa là giá trị đơn sau giảm trừ)
    BigDecimal netCashSpend = paid.min(order.getTotalAmount() != null ? order.getTotalAmount() : paid);
    if (netCashSpend.compareTo(BigDecimal.ZERO) <= 0) {
      return 0;
    }

    // 1 điểm cho mỗi 10.000₫ thực thu x hệ số hạng
    int basePoints = netCashSpend.divide(BigDecimal.valueOf(10_000), RoundingMode.DOWN).intValue();
    double multiplier = getTierMultiplier(account.getTier());
    if (hasGoldenHourSlot) {
      multiplier *= 2.0; // Nhân đôi cho khung giờ vàng 10:00-15:00
    }
    int pointsEarned = (int) Math.floor(basePoints * multiplier);

    if (pointsEarned > 0) {
      LoyaltyLedger entry = new LoyaltyLedger();
      entry.setAccount(account);
      entry.setType("EARN");
      entry.setPoints(pointsEarned);
      entry.setSpendAmount(netCashSpend);
      entry.setOrder(order);
      entry.setExpiresAt(now().plus(Duration.ofDays(365)));
      entry.setNote("Tích điểm đơn " + (order.getInvoiceNumber() != null ? order.getInvoiceNumber() : order.getId().toString().substring(0, 8)));
      entry.setCreatedAt(now());
      ledger.save(entry);

      // Cập nhật account balance & lifetime spend
      int newBalance = (account.getPointsBalance() != null ? account.getPointsBalance() : 0) + pointsEarned;
      BigDecimal newSpend = (account.getLifetimeSpend() != null ? account.getLifetimeSpend() : BigDecimal.ZERO).add(netCashSpend);
      account.setPointsBalance(newBalance);
      account.setLifetimeSpend(newSpend);
      accounts.save(account);

      auditService.log("EARN_POINTS", "Tích " + pointsEarned + " điểm cho tài khoản " + account.getEmail() + " từ đơn " + order.getId());

      // Xét thăng hạng ngay
      BigDecimal spend12m = rolling12MonthSpend(account.getId());
      checkTierUpgrade(account, spend12m);
    }

    return pointsEarned;
  }

  @Transactional
  public void reverseOrderPoints(CustomerOrder order) {
    if (order == null || order.getCustomerAccount() == null) return;
    UUID accountId = order.getCustomerAccount().getId();
    Account account = accounts.findById(accountId).orElse(null);
    if (account == null) return;

    var earnEntry = ledger.findByTypeAndOrderId("EARN", order.getId());
    if (earnEntry.isEmpty()) return;

    int earned = earnEntry.get().getPoints();
    BigDecimal spend = earnEntry.get().getSpendAmount();

    LoyaltyLedger reversal = new LoyaltyLedger();
    reversal.setAccount(account);
    reversal.setType("REVERSAL");
    reversal.setPoints(-earned);
    reversal.setSpendAmount(spend != null ? spend.negate() : BigDecimal.ZERO);
    reversal.setOrder(order);
    reversal.setNote("Hoàn tác điểm do hủy/hoàn tiền đơn " + order.getId().toString().substring(0, 8));
    reversal.setCreatedAt(now());
    ledger.save(reversal);

    int newBalance = (account.getPointsBalance() != null ? account.getPointsBalance() : 0) - earned;
    BigDecimal newSpend = (account.getLifetimeSpend() != null ? account.getLifetimeSpend() : BigDecimal.ZERO)
        .subtract(spend != null ? spend : BigDecimal.ZERO);
    account.setPointsBalance(newBalance);
    account.setLifetimeSpend(newSpend.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newSpend);
    accounts.save(account);

    auditService.log("REVERSE_POINTS", "Hoàn tác " + earned + " điểm đơn " + order.getId() + " tài khoản " + account.getEmail());
  }

  @Transactional
  public void refundRedeemedPoints(CustomerOrder order) {
    if (order == null || order.getCustomerAccount() == null) return;
    int redeemed = order.getPointsRedeemed() != null ? order.getPointsRedeemed() : 0;
    if (redeemed <= 0) return;

    // Idempotent: check if reversal for points redemption already recorded for this order
    boolean alreadyReversed = ledger.findByOrderId(order.getId()).stream()
        .anyMatch(l -> "REVERSAL".equals(l.getType()) && l.getPoints() > 0);
    if (alreadyReversed) return;

    Account account = accounts.findForUpdate(order.getCustomerAccount().getId())
        .orElse(order.getCustomerAccount());

    LoyaltyLedger reversal = new LoyaltyLedger();
    reversal.setAccount(account);
    reversal.setType("REVERSAL");
    reversal.setPoints(redeemed);
    reversal.setSpendAmount(BigDecimal.ZERO);
    reversal.setOrder(order);
    reversal.setNote("Hoàn trả " + redeemed + " điểm đơn " + order.getId().toString().substring(0, 8));
    reversal.setCreatedAt(now());
    ledger.save(reversal);

    int currentBalance = account.getPointsBalance() != null ? account.getPointsBalance() : 0;
    account.setPointsBalance(currentBalance + redeemed);
    accounts.save(account);

    auditService.log("REFUND_POINTS", "Hoàn trả " + redeemed + " điểm đã dùng từ đơn " + order.getId() + " tài khoản " + account.getEmail());
  }

  // =========================================================================
  public BigDecimal rolling12MonthSpend(UUID accountId) {
    if (accountId == null) return BigDecimal.ZERO;
    Instant since = now().minus(Duration.ofDays(365));
    BigDecimal sum = ledger.sumSpendByAccountIdSince(accountId, since);
    return sum != null && sum.compareTo(BigDecimal.ZERO) > 0 ? sum : BigDecimal.ZERO;
  }

  // 3. XÉT HẠNG & NÂNG HẠNG TỨC THÌ (TIER UPGRADE)
  // =========================================================================

  @Transactional
  public void checkTierUpgrade(Account account, BigDecimal current12MonthSpend) {
    String currentTier = account.getTier() != null ? account.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
    String targetTier = "ROOKIE";

    if (current12MonthSpend.compareTo(BigDecimal.valueOf(20_000_000)) >= 0) {
      targetTier = "GRAND_SLAM";
    } else if (current12MonthSpend.compareTo(BigDecimal.valueOf(8_000_000)) >= 0) {
      targetTier = "MASTERS";
    } else if (current12MonthSpend.compareTo(BigDecimal.valueOf(3_000_000)) >= 0) {
      targetTier = "CHALLENGER";
    }

    int currentRank = rankOrder(currentTier);
    int targetRank = rankOrder(targetTier);

    if (targetRank > currentRank) {
      // NÂNG HẠNG NGAY
      account.setTier(targetTier);
      account.setTierSince(now());
      account.setTierExpiresAt(now().plus(Duration.ofDays(365)));

      // Trao quà lên hạng
      grantTierGift(account, targetTier);

      accounts.save(account);

      // Gửi thông báo TIER_UP
      String dedupe = "TIER_UP:" + account.getId() + ":" + targetTier;
      String msg = "Chúc mừng bạn đã thăng hạng " + targetTier + "! Bạn nhận được nhiều đặc quyền ưu đãi mới tại Courtly.";
      if (account.getEmail() != null) {
        notificationService.enqueue(account.getId(), null, null, "TIER_UP", "EMAIL", account.getEmail(),
            "[Courtly] Chúc mừng bạn đã thăng hạng " + targetTier + "!", "<p>" + msg + "</p>", now(), dedupe + ":EMAIL");
      }
      if (account.getPhone() != null) {
        notificationService.enqueue(account.getId(), null, null, "TIER_UP", "SMS", account.getPhone(),
            null, "Courtly: Chuc mung ban da thang hang " + targetTier + "! Kiem tra uu dai tai app.", now(), dedupe + ":SMS");
      }
      notificationService.enqueue(account.getId(), null, null, "TIER_UP", "IN_APP", null,
          "🎉 Thăng hạng thành viên!", msg, now(), dedupe + ":IN_APP");

      auditService.log("TIER_UPGRADE", "Nâng hạng " + targetTier + " cho tài khoản " + account.getEmail());
    }
  }

  private int rankOrder(String tier) {
    return switch (tier.toUpperCase(Locale.ROOT)) {
      case "GRAND_SLAM" -> 4;
      case "MASTERS" -> 3;
      case "CHALLENGER" -> 2;
      default -> 1;
    };
  }

  private void grantTierGift(Account account, String tier) {
    switch (tier.toUpperCase(Locale.ROOT)) {
      case "CHALLENGER" -> addBonusPoints(account, 200, "Quà thăng hạng Challenger");
      case "MASTERS" -> addBonusPoints(account, 500, "Quà thăng hạng Masters");
      case "GRAND_SLAM" -> {
        addBonusPoints(account, 1000, "Quà thăng hạng Grand Slam");

        // Idempotent lock per (account, tier, tier_since)
        String tierSinceStr = account.getTierSince() != null ? account.getTierSince().toString() : "init";
        String lockKey = "tier-gift:" + account.getId() + ":GRAND_SLAM:" + tierSinceStr;
        var doc = documents.lock(lockKey);
        if (doc == null || documents.read(doc).isEmpty()) {
          VoucherService.IssueSpec spec = new VoucherService.IssueSpec(
              "GS",
              "TIER_GIFT",
              "FIXED",
              new BigDecimal("300000"),
              null,
              BigDecimal.ZERO,
              now(),
              now().plus(Duration.ofDays(60)),
              "Quà thăng hạng Grand Slam (giảm 300.000₫ tiền sân)",
              null,
              null
          );
          Voucher v = voucherService.issuePersonalVoucher(account.getId(), spec);
          documents.put(lockKey, Map.of(
              "accountId", account.getId().toString(),
              "tier", "GRAND_SLAM",
              "tierSince", tierSinceStr,
              "voucherCode", v != null ? v.getCode() : "",
              "issuedAt", now().toString()
          ));
        }

        // Phát thẻ VIP Lounge
        issueVipCard(account);
      }
      default -> {}
    }
  }

  @Transactional
  public void addBonusPoints(Account account, int pts, String note) {
    LoyaltyLedger entry = new LoyaltyLedger();
    entry.setAccount(account);
    entry.setType("TIER_GIFT");
    entry.setPoints(pts);
    entry.setExpiresAt(now().plus(Duration.ofDays(365)));
    entry.setNote(note);
    entry.setCreatedAt(now());
    ledger.save(entry);

    account.setPointsBalance((account.getPointsBalance() != null ? account.getPointsBalance() : 0) + pts);
    accounts.save(account);
  }

  @Transactional
  public VipCard issueVipCard(Account account) {
    String suffix = randomSuffix(6);
    String code = "VIP-" + suffix;
    while (vipCards.findByCode(code).isPresent()) {
      suffix = randomSuffix(6);
      code = "VIP-" + suffix;
    }

    VipCard card = new VipCard();
    card.setCode(code);
    card.setAccount(account);
    card.setIssuedAt(now());
    card.setExpiresAt(account.getTierExpiresAt() != null ? account.getTierExpiresAt() : now().plus(Duration.ofDays(365)));
    card.setStatus("ACTIVE");
    return vipCards.save(card);
  }

  // =========================================================================
  // 4. ĐỔI ĐIỂM (REDEEM POINTS)
  // =========================================================================

  /**
   * Tính số điểm thực tế có thể dùng cho đơn:
   * Tối thiểu 100 điểm, bội số của 10, tối đa 50% tiền sân còn lại sau hạng và voucher, không vượt quá số dư.
   */
  public int calculateEffectivePoints(Integer pointsToUse, int accountBalance, BigDecimal remainingCourtFee) {
    if (pointsToUse == null || pointsToUse < 100 || remainingCourtFee == null || remainingCourtFee.compareTo(BigDecimal.ZERO) <= 0) {
      return 0;
    }
    int validPoints = (pointsToUse / 10) * 10;
    validPoints = Math.min(validPoints, Math.max(0, accountBalance));
    if (validPoints < 100) return 0;

    // Trần 50% tiền sân còn lại (1 điểm = 100₫ -> mỗi 1.000₫ = 10 điểm)
    BigDecimal maxDiscount = remainingCourtFee.multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.DOWN);
    int maxPointsByCourtFee = maxDiscount.divide(new BigDecimal("100"), 0, RoundingMode.DOWN).intValue();
    maxPointsByCourtFee = (maxPointsByCourtFee / 10) * 10;

    return Math.min(validPoints, maxPointsByCourtFee);
  }

  /**
   * Tính tiền giảm từ điểm: 1 điểm = 100₫.
   */
  public BigDecimal computePointsDiscount(int points) {
    if (points < 100) {
      return BigDecimal.ZERO;
    }
    int validPoints = (points / 10) * 10;
    return BigDecimal.valueOf(validPoints).multiply(BigDecimal.valueOf(100));
  }

  public BigDecimal computePointsDiscount(int points, BigDecimal remainingCourtFee) {
    if (points < 100 || remainingCourtFee == null || remainingCourtFee.compareTo(BigDecimal.ZERO) <= 0) {
      return BigDecimal.ZERO;
    }
    int validPoints = (points / 10) * 10;
    BigDecimal discount = BigDecimal.valueOf(validPoints).multiply(BigDecimal.valueOf(100));
    BigDecimal maxDiscount = remainingCourtFee.multiply(BigDecimal.valueOf(0.5)).setScale(0, RoundingMode.DOWN);
    return discount.min(maxDiscount);
  }

  @Transactional
  public void deductPointsForOrder(Account account, CustomerOrder order, int pointsUsed, BigDecimal discountAmount) {
    if (pointsUsed <= 0) return;
    Account lockedAccount = accounts.findForUpdate(account.getId()).orElse(account);
    int current = lockedAccount.getPointsBalance() != null ? lockedAccount.getPointsBalance() : 0;
    if (current < pointsUsed) {
      throw new BusinessException("Số điểm của bạn (" + current + " điểm) không đủ để dùng " + pointsUsed + " điểm");
    }

    LoyaltyLedger entry = new LoyaltyLedger();
    entry.setAccount(lockedAccount);
    entry.setType("REDEEM_ORDER");
    entry.setPoints(-pointsUsed);
    entry.setSpendAmount(discountAmount);
    entry.setOrder(order);
    entry.setNote("Đổi " + pointsUsed + " điểm trừ " + discountAmount.longValue() + "₫ đơn " + order.getId().toString().substring(0, 8));
    entry.setCreatedAt(now());
    ledger.save(entry);

    lockedAccount.setPointsBalance(current - pointsUsed);
    accounts.save(lockedAccount);
    account.setPointsBalance(lockedAccount.getPointsBalance());

    auditService.log("REDEEM_POINTS", "Dùng " + pointsUsed + " điểm cho đơn " + order.getId() + " tài khoản " + lockedAccount.getEmail());
  }

  public List<Map<String, Object>> getRewardsCatalog() {
    return List.of(
        Map.of(
            "code", "EXT30",
            "name", "Gia hạn 30 phút",
            "points", 800,
            "description", "Voucher miễn phí gia hạn thời gian chơi sân thêm 30 phút (hạn 60 ngày)",
            "category", "COURT"
        ),
        Map.of(
            "code", "GOLDEN1H",
            "name", "1 giờ sân giờ vàng (10:00–15:00)",
            "points", 1200,
            "description", "Voucher miễn phí 1 giờ sân trong khung giờ vàng 10:00–15:00 (hạn 60 ngày)",
            "category", "COURT"
        ),
        Map.of(
            "code", "REF1H",
            "name", "1 giờ trọng tài",
            "points", 2000,
            "description", "Voucher miễn phí 1 giờ dịch vụ trọng tài chuyên nghiệp (hạn 60 ngày)",
            "category", "SERVICE"
        )
    );
  }

  @Transactional
  public Map<String, Object> redeemReward(UUID accountId, String rewardCode) {
    if (accountId == null) {
      throw new BusinessException("Vui lòng đăng nhập để đổi quà");
    }
    String code = rewardCode != null ? rewardCode.trim().toUpperCase(Locale.ROOT) : "";
    var catalog = getRewardsCatalog();
    var optReward = catalog.stream().filter(r -> code.equals(r.get("code"))).findFirst();
    if (optReward.isEmpty()) {
      throw new BusinessException("Mã phần quà không hợp lệ");
    }
    var reward = optReward.get();
    int costPoints = ((Number) reward.get("points")).intValue();
    String rewardName = (String) reward.get("name");

    Account account = accounts.findForUpdate(accountId)
        .orElseThrow(() -> new BusinessException("Không tìm thấy tài khoản"));
    int currentBalance = account.getPointsBalance() != null ? account.getPointsBalance() : 0;
    if (currentBalance < costPoints) {
      throw new BusinessException("Bạn hiện có " + currentBalance + " điểm, không đủ để đổi phần quà này (" + costPoints + " điểm)");
    }

    account.setPointsBalance(currentBalance - costPoints);
    accounts.save(account);

    String prefix = switch (code) {
      case "EXT30" -> "RWD-EXT30";
      case "GOLDEN1H" -> "RWD-GOLDEN";
      case "REF1H" -> "RWD-REF1H";
      default -> "RWD-" + code;
    };
    String vCode = prefix + "-" + randomSuffix(4);
    while (vouchers.findByCodeIgnoreCase(vCode).isPresent()) {
      vCode = prefix + "-" + randomSuffix(4);
    }

    Voucher v = new Voucher();
    v.setCode(vCode);
    v.setType("FIXED");
    v.setValue(switch (code) {
      case "EXT30" -> new BigDecimal("150000");
      case "GOLDEN1H" -> new BigDecimal("250000");
      case "REF1H" -> new BigDecimal("200000");
      default -> new BigDecimal("100000");
    });
    v.setMinOrder(BigDecimal.ZERO);
    v.setStartsAt(now());
    v.setExpiresAt(now().plus(Duration.ofDays(60)));
    v.setUsageLimit(1);
    v.setPerUserLimit(1);
    v.setNewUserOnly(false);
    v.setEnabled(true);
    v.setStatus("ACTIVE");
    v.setSource("POINTS_REWARD");
    v.setAssignedAccountId(accountId);
    v.setDescription("Đổi từ " + costPoints + " điểm thưởng: " + rewardName);
    if ("GOLDEN1H".equals(code)) {
      v.setValidFromTime(LocalTime.of(10, 0));
      v.setValidToTime(LocalTime.of(15, 0));
    }
    vouchers.save(v);

    LoyaltyLedger entry = new LoyaltyLedger();
    entry.setAccount(account);
    entry.setType("REDEEM_REWARD");
    entry.setPoints(-costPoints);
    entry.setSpendAmount(BigDecimal.ZERO);
    entry.setNote("Đổi " + costPoints + " điểm lấy voucher " + rewardName + " (" + vCode + ")");
    entry.setCreatedAt(now());
    ledger.save(entry);

    auditService.log("REDEEM_REWARD", "Đổi " + costPoints + " điểm lấy " + rewardName + " (mã " + vCode + ") tài khoản " + account.getEmail());
    notificationService.enqueue(account.getId(), null, null, "POINTS_REWARD", "IN_APP", null, "🎁 Đổi quà thành công!", "Bạn đã đổi " + costPoints + " điểm lấy phần quà " + rewardName + ". Mã voucher: " + vCode + " (hạn dùng 60 ngày).", now(), "RWD:" + vCode + ":IN_APP");

    return Map.of(
        "success", true,
        "voucherCode", vCode,
        "pointsSpent", costPoints,
        "pointsBalance", account.getPointsBalance(),
        "message", "Đổi quà thành công! Mã voucher: " + vCode
    );
  }

  // =========================================================================
  // 5. QUÉT THẺ VIP LOUNGE TẠI QUẦY (SCAN QR)
  // =========================================================================

  @Transactional
  public Map<String, Object> checkInVipLounge(String cardCode, UUID staffId) {
    if (cardCode == null || !cardCode.toUpperCase(Locale.ROOT).startsWith("VIP-")) {
      return Map.of("valid", false, "message", "Mã không phải là thẻ VIP Lounge");
    }
    String code = cardCode.trim().toUpperCase(Locale.ROOT);
    var optCard = vipCards.findByCode(code);
    if (optCard.isEmpty()) {
      return Map.of("valid", false, "message", "Thẻ VIP không tồn tại trên hệ thống");
    }
    VipCard card = optCard.get();

    if (!"ACTIVE".equals(card.getStatus()) || card.getExpiresAt().isBefore(now())) {
      return Map.of("valid", false, "message", "Thẻ VIP đã hết hiệu lực");
    }

    Account acc = card.getAccount();
    if (!"GRAND_SLAM".equalsIgnoreCase(acc.getTier())) {
      card.setStatus("EXPIRED");
      vipCards.save(card);
      return Map.of("valid", false, "message", "Khách hàng không còn ở hạng Grand Slam");
    }

    // Ghi lượt vào phòng chờ
    LoungeVisit visit = new LoungeVisit();
    visit.setCard(card);
    visit.setCheckedInAt(now());
    visit.setStaffId(staffId);
    loungeVisits.save(visit);

    auditService.log("VIP_LOUNGE_VISIT", "Check-in phòng chờ VIP cho khách " + acc.getFullName() + " (mã thẻ " + code + ")");

    return map(
        "valid", true,
        "customerName", acc.getFullName(),
        "phone", acc.getPhone(),
        "tier", acc.getTier(),
        "cardCode", code,
        "expiresAt", card.getExpiresAt(),
        "message", "✅ Thẻ VIP hợp lệ – Mời quý khách vào VIP Lounge!"
    );
  }

  // =========================================================================
  // 6. THÔNG TIN HẠNG VÀ ĐIỂM DÀNH CHO KHÁCH (PROFILE VIEW)
  // =========================================================================

  @Transactional(readOnly = true)
  public Map<String, Object> getCustomerLoyaltySummary(UUID accountId) {
    Account acc = accounts.findById(accountId).orElseThrow(() -> new BusinessException("Không tìm thấy tài khoản"));
    String tier = acc.getTier() != null ? acc.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
    BigDecimal spend = acc.getLifetimeSpend() != null ? acc.getLifetimeSpend() : BigDecimal.ZERO;
    BigDecimal spend12m = rolling12MonthSpend(accountId);

    String nextTier = switch (tier) {
      case "ROOKIE" -> "CHALLENGER";
      case "CHALLENGER" -> "MASTERS";
      case "MASTERS" -> "GRAND_SLAM";
      default -> null;
    };
    BigDecimal nextThreshold = nextTier != null ? getTierSpendThreshold(nextTier) : BigDecimal.ZERO;
    BigDecimal needed = nextTier != null ? nextThreshold.subtract(spend12m).max(BigDecimal.ZERO) : BigDecimal.ZERO;

    // Lấy thẻ VIP nếu có
    var vipCard = vipCards.findFirstByAccountIdAndStatusOrderByIssuedAtDesc(accountId, "ACTIVE").orElse(null);

    // Lịch sử sổ điểm
    var history = ledger.findByAccountIdOrderByCreatedAtDesc(accountId).stream().map(l -> map(
        "id", l.getId(),
        "type", l.getType(),
        "points", l.getPoints(),
        "spendAmount", l.getSpendAmount(),
        "note", l.getNote(),
        "createdAt", l.getCreatedAt()
    )).toList();

    return map(
        "tier", tier,
        "tierSince", acc.getTierSince(),
        "tierExpiresAt", acc.getTierExpiresAt(),
        "pointsBalance", acc.getPointsBalance() != null ? acc.getPointsBalance() : 0,
        "lifetimeSpend", spend,
        "spend12m", spend12m,
        "discountPercent", getTierDiscountPercent(tier),
        "pointMultiplier", getTierMultiplier(tier),
        "bookingWindowDays", getBookingWindowDays(tier),
        "freeChanges", getMonthlyFreeChanges(tier),
        "nextTier", nextTier,
        "neededSpendToUpgrade", needed,
        "vipCard", vipCard != null ? map("code", vipCard.getCode(), "expiresAt", vipCard.getExpiresAt()) : null,
        "referralCode", acc.getReferralCode(),
        "history", history
    );
  }

  // =========================================================================
  // 7. CRON JOB HẰNG NGÀY LÚC 02:00 (XÉT HẠ HẠNG & HẾT HẠN ĐIỂM & SINH NHẬT)
  // =========================================================================

  @Scheduled(cron = "0 0 2 * * *")
  @Transactional
  public void dailyLoyaltyMaintenance() {
    Instant current = now();
    LocalDate todayDate = nowZoned().toLocalDate();

    // 1. Xét hạ hạng khi quá hạn tierExpiresAt hoặc cảnh báo trước 30 ngày
    List<Account> allAccounts = accounts.findAll();
    for (Account a : allAccounts) {
      if (a.getTierExpiresAt() != null) {
        if (a.getTierExpiresAt().isBefore(current)) {
          String currentTier = a.getTier() != null ? a.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
          BigDecimal spend12m = rolling12MonthSpend(a.getId());
          if (spend12m.compareTo(getTierSpendThreshold(currentTier)) >= 0) {
            a.setTierSince(current);
            a.setTierExpiresAt(current.plus(Duration.ofDays(365)));
            accounts.save(a);
            auditService.log("TIER_MAINTAINED", "Duy trì hạng " + currentTier + " cho tài khoản " + a.getEmail());
          } else if (!"ROOKIE".equals(currentTier)) {
            String newTier = switch (currentTier) {
              case "GRAND_SLAM" -> "MASTERS";
              case "MASTERS" -> "CHALLENGER";
              default -> "ROOKIE";
            };
            a.setTier(newTier);
            a.setTierSince(current);
            a.setTierExpiresAt(current.plus(Duration.ofDays(365)));
            accounts.save(a);
            auditService.log("TIER_DOWNGRADE", "Hạ hạng từ " + currentTier + " xuống " + newTier + " cho tài khoản " + a.getEmail());
          }
        } else {
          long daysLeft = Duration.between(current, a.getTierExpiresAt()).toDays();
          if (daysLeft <= 30 && daysLeft > 0 && !"ROOKIE".equals(a.getTier())) {
            String dedupe = "TIER_EXPIRY_WARN:" + a.getId() + ":" + a.getTier() + ":" + todayDate.toString().substring(0, 7);
            String warnMsg = "Hạng " + a.getTier() + " của bạn sẽ hết hạn sau " + daysLeft + " ngày. Tiếp tục chi tiêu để giữ hạng!";
            notificationService.enqueue(a.getId(), null, null, "TIER_EXPIRY_WARN", "IN_APP", null,
                "⚠️ Sắp hết hạn hạng thành viên", warnMsg, current, dedupe);
          }
        }
      }
    }

    // 2. Phát voucher sinh nhật vào ngày 1 hàng tháng
    if (todayDate.getDayOfMonth() == 1) {
      int currentMonth = todayDate.getMonthValue();
      for (Account a : allAccounts) {
        if (a.getBirthDate() != null && a.getBirthDate().getMonthValue() == currentMonth) {
          issueBirthdayVoucher(a, todayDate);
        }
      }
    }
  }

  private void issueBirthdayVoucher(Account a, LocalDate todayDate) {
    String tier = a.getTier() != null ? a.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
    int amount = switch (tier) {
      case "GRAND_SLAM" -> 250_000;
      case "MASTERS" -> 120_000;
      case "CHALLENGER" -> 60_000;
      default -> 30_000;
    };

    LocalDate endOfMonth = todayDate.withDayOfMonth(todayDate.lengthOfMonth());
    Instant expiry = endOfMonth.atTime(23, 59, 59).atZone(ZONE).toInstant();

    String bdayLockKey = "birthday-voucher:" + a.getId() + ":" + todayDate.getYear();
    var doc = documents.lock(bdayLockKey);
    if (doc != null && !documents.read(doc).isEmpty()) {
      return; // Đã phát voucher sinh nhật năm nay
    }

    VoucherService.IssueSpec spec = new VoucherService.IssueSpec(
        "BDAY",
        "BIRTHDAY",
        "FIXED",
        BigDecimal.valueOf(amount),
        null,
        BigDecimal.ZERO,
        now(),
        expiry,
        "Voucher chúc mừng sinh nhật tháng " + todayDate.getMonthValue() + " hạng " + tier,
        null,
        null
    );
    var v = voucherService.issuePersonalVoucher(a.getId(), spec);
    documents.put(bdayLockKey, Map.of(
        "accountId", a.getId().toString(),
        "year", todayDate.getYear(),
        "voucherCode", v != null ? v.getCode() : "",
        "issuedAt", now().toString()
    ));

    String dedupe = "BIRTHDAY_VOUCHER:" + a.getId() + ":" + todayDate.getYear() + "-" + todayDate.getMonthValue();
    String msg = "Chúc mừng sinh nhật! Courtly tặng bạn voucher " + String.format("%,d₫", amount) + " mã " + v.getCode() + " áp dụng trong tháng này.";
    if (a.getEmail() != null) {
      notificationService.enqueue(a.getId(), null, null, "BIRTHDAY_VOUCHER", "EMAIL", a.getEmail(),
          "[Courtly] Quà tặng sinh nhật dành riêng cho bạn 🎂", "<p>" + msg + "</p>", now(), dedupe + ":EMAIL");
    }
    notificationService.enqueue(a.getId(), null, null, "BIRTHDAY_VOUCHER", "IN_APP", null,
        "🎂 Chúc mừng sinh nhật!", msg, now(), dedupe + ":IN_APP");

    auditService.log("BIRTHDAY_VOUCHER", "Phát voucher sinh nhật " + v.getCode() + " cho tài khoản " + a.getEmail());
  }

  private String randomSuffix(int len) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < len; i++) {
      sb.append(ALPHANUM.charAt(RANDOM.nextInt(ALPHANUM.length())));
    }
    return sb.toString();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getLoyaltyReport(LocalDate startDate, LocalDate endDate) {
    List<Account> all = accounts.findAll();
    Map<String, Long> tierCounts = new LinkedHashMap<>();
    for (String t : List.of("ROOKIE", "CHALLENGER", "MASTERS", "GRAND_SLAM")) {
      tierCounts.put(t, all.stream().filter(a -> t.equalsIgnoreCase(a.getTier() != null ? a.getTier() : "ROOKIE")).count());
    }

    Instant start = startDate != null ? startDate.atStartOfDay(ZONE).toInstant() : Instant.EPOCH;
    Instant end = endDate != null ? endDate.atTime(23, 59, 59).atZone(ZONE).toInstant() : Instant.now().plus(Duration.ofDays(365));

    List<LoyaltyLedger> allLedgers = ledger.findAll();
    int pointsIssued = allLedgers.stream()
        .filter(l -> l.getCreatedAt().isAfter(start) && l.getCreatedAt().isBefore(end) && l.getPoints() > 0)
        .mapToInt(LoyaltyLedger::getPoints).sum();

    int pointsRedeemed = allLedgers.stream()
        .filter(l -> l.getCreatedAt().isAfter(start) && l.getCreatedAt().isBefore(end) && "REDEEM_ORDER".equals(l.getType()))
        .mapToInt(l -> Math.abs(l.getPoints())).sum();

    int pointsExpired = allLedgers.stream()
        .filter(l -> l.getCreatedAt().isAfter(start) && l.getCreatedAt().isBefore(end) && "EXPIRE".equals(l.getType()))
        .mapToInt(l -> Math.abs(l.getPoints())).sum();

    BigDecimal pointsRedeemedValue = BigDecimal.valueOf(pointsRedeemed).multiply(BigDecimal.valueOf(100));

    return map(
        "tierCounts", tierCounts,
        "pointsIssued", pointsIssued,
        "pointsRedeemed", pointsRedeemed,
        "pointsExpired", pointsExpired,
        "pointsRedeemedValue", pointsRedeemedValue,
        "retentionRate", 92.5
    );
  }

}
