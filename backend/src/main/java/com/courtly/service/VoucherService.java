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
    return evaluateAll(null, null);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> evaluateAll(BigDecimal totalAmount, UUID accountId) {
    Instant now = Instant.now();
    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;

    long pastOrders = 0;
    boolean isMember = false;
    if (accountId != null) {
      pastOrders = orders.countByCustomerAccountIdAndStatusNotIn(accountId, Set.of("CANCELLED", "EXPIRED"));
      isMember = memberships.hasActiveMembership(accountId);
    }

    List<Map<String, Object>> result = new ArrayList<>();
    for (Voucher v : vouchers.findByEnabledTrue()) {
      if (v.getStartsAt() != null && v.getStartsAt().isAfter(now)) {
        continue;
      }
      if (v.getExpiresAt() != null && v.getExpiresAt().isBefore(now)) {
        continue;
      }

      boolean applicable = true;
      String reason = null;

      if (v.getUsageLimit() != null && v.getUsedCount() >= v.getUsageLimit()) {
        applicable = false;
        reason = "Đã hết lượt sử dụng trên toàn hệ thống";
      }

      if (applicable && v.getMinOrder() != null && total.compareTo(v.getMinOrder()) < 0) {
        applicable = false;
        long minVal = v.getMinOrder().longValue();
        long diff = v.getMinOrder().subtract(total).longValue();
        if (total.compareTo(BigDecimal.ZERO) == 0) {
          reason = String.format("Cần đơn từ %,d₫", minVal).replace(',', '.');
        } else {
          reason = String.format("Cần đơn từ %,d₫ (thiếu %,d₫)", minVal, diff).replace(',', '.');
        }
      }

      if (applicable && Boolean.TRUE.equals(v.getNewUserOnly())) {
        if (accountId != null && pastOrders > 0) {
          applicable = false;
          reason = "Chỉ áp dụng cho khách hàng mới (đơn đầu tiên)";
        }
      }

      if (applicable && Boolean.TRUE.equals(v.getMemberOnly())) {
        if (accountId == null) {
          applicable = false;
          reason = "Dành riêng cho Hội viên CLB (cần đăng nhập)";
        } else if (!isMember) {
          applicable = false;
          reason = "Chỉ áp dụng cho Hội viên CLB có gói active";
        }
      }

      if (applicable && accountId != null && v.getPerUserLimit() != null) {
        long userUsed = redemptions.countByVoucherIdAndAccountId(v.getId(), accountId);
        if (userUsed >= v.getPerUserLimit()) {
          applicable = false;
          reason = "Bạn đã dùng hết số lượt của voucher này";
        }
      }

      BigDecimal discount = applicable
          ? computeDiscount(v, total)
          : computeDiscount(v, v.getMinOrder() != null && v.getMinOrder().compareTo(BigDecimal.ZERO) > 0 ? v.getMinOrder() : total);

      Map<String, Object> item = new LinkedHashMap<>();
      item.put("code", v.getCode());
      item.put("type", v.getType());
      item.put("value", v.getValue());
      item.put("minOrder", v.getMinOrder());
      item.put("maxDiscount", v.getMaxDiscount());
      item.put("memberOnly", v.getMemberOnly());
      item.put("newUserOnly", v.getNewUserOnly());
      item.put("description", v.getDescription());
      item.put("applicable", applicable);
      item.put("discount", discount);
      item.put("reason", reason);
      result.add(item);
    }
    return result;
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

    validateVoucherRules(v, totalAmount, accountId, null);
    BigDecimal discount = computeDiscount(v, totalAmount);

    return map(
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "minOrder", v.getMinOrder(),
        "type", v.getType(),
        "value", v.getValue(),
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

    UUID currentOrderId = order != null ? order.getId() : null;
    validateVoucherRules(v, totalAmount, accountId, currentOrderId);
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

  private Map<String, Object> benefit(Voucher voucher, BigDecimal discount) {
    return map("code", voucher.getCode(), "discount", discount,
        "description", voucher.getDescription(), "applied", true);
  }

  /** A retained redemption represents an already agreed benefit, including played visits. */
  @Transactional(readOnly = true)
  public Map<String, Object> previewRestore(String code, CustomerOrder order, BigDecimal gross) {
    var retained = redemptions.findByOrderId(order.getId());
    if (retained.isPresent())
      return benefit(retained.get().getVoucher(), retained.get().getDiscountAmount());
    var voucher = vouchers.findByCodeIgnoreCase(code).orElseThrow(
        () -> new BusinessException("Voucher cũ không còn tồn tại; không thể khôi phục ưu đãi"));
    validateVoucherRules(voucher, gross,
        order.getCustomerAccount() == null ? null : order.getCustomerAccount().getId(), order.getId());
    return benefit(voucher, computeDiscount(voucher, gross));
  }

  @Transactional
  public Map<String, Object> restore(String code, CustomerOrder order, BigDecimal gross) {
    var retained = redemptions.findByOrderId(order.getId());
    if (retained.isPresent())
      return benefit(retained.get().getVoucher(), retained.get().getDiscountAmount());
    return redeem(code, order, gross,
        order.getCustomerAccount() == null ? null : order.getCustomerAccount().getId());
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
    validateVoucherRules(v, totalAmount, accountId, null);
  }

  private void validateVoucherRules(Voucher v, BigDecimal totalAmount, UUID accountId, UUID excludeOrderId) {
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
      long minVal = v.getMinOrder().longValue();
      long diff = v.getMinOrder().subtract(total).longValue();
      throw new BusinessException(
          "Đơn đặt sân tối thiểu "
              + v.getMinOrder().setScale(0, RoundingMode.HALF_UP)
              + " đ (còn thiếu "
              + diff
              + " đ) để áp dụng voucher "
              + v.getCode());
    }

    if (accountId != null) {
      if (Boolean.TRUE.equals(v.getNewUserOnly())) {
        long pastOrders = excludeOrderId != null
            ? orders.countByCustomerAccountIdAndIdNotAndStatusNotIn(accountId, excludeOrderId, Set.of("CANCELLED", "EXPIRED"))
            : orders.countByCustomerAccountIdAndStatusNotIn(accountId, Set.of("CANCELLED", "EXPIRED"));
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
    } else {
      if (Boolean.TRUE.equals(v.getMemberOnly())) {
        throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho Hội viên CLB (vui lòng đăng nhập tài khoản)");
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
