package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.CustomerOrder;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VoucherService {

  private final VoucherRepository vouchers;
  private final VoucherRedemptionRepository redemptions;
  private final CustomerOrderRepository orders;
  private final MembershipService memberships;

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAvailable() {
    Instant now = Instant.now();
    return vouchers.findByEnabledTrue().stream()
        .filter(v -> v.getStartsAt() == null || !v.getStartsAt().isAfter(now))
        .filter(v -> v.getExpiresAt() == null || !v.getExpiresAt().isBefore(now))
        .filter(v -> v.getUsageLimit() == null || v.getUsedCount() < v.getUsageLimit())
        .map(
            v ->
                map(
                    "code", v.getCode(),
                    "type", v.getType(),
                    "value", v.getValue(),
                    "minOrder", v.getMinOrder(),
                    "maxDiscount", v.getMaxDiscount(),
                    "memberOnly", v.getMemberOnly(),
                    "newUserOnly", v.getNewUserOnly(),
                    "description", v.getDescription()))
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount) {
    return calculate(rawCode, totalAmount, null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount, UUID accountId) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v =
        vouchers
            .findByCodeIgnoreCase(code)
            .orElseThrow(
                () ->
                    new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    validateVoucherRules(v, totalAmount, accountId);
    BigDecimal discount = computeDiscount(v, totalAmount);

    return map(
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "applied", true);
  }

  @Transactional
  public Map<String, Object> redeem(String rawCode, CustomerOrder order, BigDecimal totalAmount, UUID accountId) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    // Pessimistic write lock to prevent race conditions on usage limits
    Voucher v =
        vouchers
            .findByCodeForUpdate(code)
            .orElseThrow(
                () ->
                    new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    validateVoucherRules(v, totalAmount, accountId);
    BigDecimal discount = computeDiscount(v, totalAmount);

    v.setUsedCount(v.getUsedCount() + 1);
    vouchers.save(v);

    VoucherRedemption redemption = new VoucherRedemption();
    redemption.setVoucher(v);
    redemption.setOrder(order);
    if (order.getCustomerAccount() != null) {
      redemption.setAccount(order.getCustomerAccount());
    }
    redemption.setDiscountAmount(discount);
    redemption.setRedeemedAt(Instant.now());
    redemptions.save(redemption);

    return map(
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "applied", true);
  }

  @Transactional
  public void release(UUID orderId) {
    if (orderId == null) return;
    redemptions.findByOrderId(orderId).ifPresent(redemption -> {
      vouchers.findByCodeForUpdate(redemption.getVoucher().getCode()).ifPresent(v -> {
        if (v.getUsedCount() > 0) {
          v.setUsedCount(v.getUsedCount() - 1);
          vouchers.save(v);
        }
      });
      redemptions.delete(redemption);
    });
  }

  private void validateVoucherRules(Voucher v, BigDecimal totalAmount, UUID accountId) {
    if (!Boolean.TRUE.equals(v.getEnabled())) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' hiện đang tạm khóa");
    }

    Instant now = Instant.now();
    if (v.getStartsAt() != null && v.getStartsAt().isAfter(now)) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' chưa đến thời gian áp dụng");
    }
    if (v.getExpiresAt() != null && v.getExpiresAt().isBefore(now)) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' đã hết hạn");
    }

    if (v.getUsageLimit() != null && v.getUsedCount() >= v.getUsageLimit()) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' đã hết lượt sử dụng");
    }

    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    if (v.getMinOrder() != null && total.compareTo(v.getMinOrder()) < 0) {
      throw new BusinessException(
          "Đơn đặt sân tối thiểu "
              + v.getMinOrder().setScale(0, RoundingMode.HALF_UP)
              + " đ để áp dụng voucher "
              + v.getCode());
    }

    if (accountId != null) {
      if (Boolean.TRUE.equals(v.getNewUserOnly())) {
        long pastOrders = orders.countByCustomerAccountIdAndStatusNotIn(accountId, Set.of("CANCELLED", "EXPIRED"));
        if (pastOrders > 0) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho khách hàng mới đặt sân lần đầu");
        }
      }

      if (Boolean.TRUE.equals(v.getMemberOnly())) {
        boolean activeMember = memberships.hasActiveMembership(accountId);
        if (!activeMember) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho hội viên có gói active");
        }
      }

      if (v.getPerUserLimit() != null) {
        long userUsed = redemptions.countByVoucherIdAndAccountId(v.getId(), accountId);
        if (userUsed >= v.getPerUserLimit()) {
          throw new BusinessException(
              "Bạn đã dùng hết số lần cho phép của voucher "
                  + v.getCode()
                  + " (tối đa "
                  + v.getPerUserLimit()
                  + " lần/tài khoản)");
        }
      }
    }
  }

  private BigDecimal computeDiscount(Voucher v, BigDecimal totalAmount) {
    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    BigDecimal discount;
    if ("PERCENT".equals(v.getType())) {
      discount =
          total
              .multiply(v.getValue())
              .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
      if (v.getMaxDiscount() != null && discount.compareTo(v.getMaxDiscount()) > 0) {
        discount = v.getMaxDiscount();
      }
    } else {
      discount = v.getValue();
    }

    if (discount.compareTo(total) > 0) {
      discount = total;
    }
    return discount;
  }
}
