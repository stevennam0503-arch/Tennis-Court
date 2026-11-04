package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.Account;
import com.courtly.entity.CustomerOrder;
import com.courtly.dto.VoucherOrderContext;
import com.courtly.entity.Voucher;
import com.courtly.entity.VoucherRedemption;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.CustomerOrderRepository;
import com.courtly.repository.VoucherRedemptionRepository;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class VoucherService {

  private final VoucherRepository vouchers;
  private final VoucherRedemptionRepository redemptions;
  private final CustomerOrderRepository orders;
  private final AccountRepository accounts;
  private final AuditService auditService;

  private static final SecureRandom RANDOM = new SecureRandom();
  
  private String tierDisplayName(String t) {
    if (t == null) return "Rookie";
    return switch (t.toUpperCase(Locale.ROOT)) {
      case "GRAND_SLAM" -> "Grand Slam";
      case "MASTERS" -> "Masters";
      case "CHALLENGER" -> "Challenger";
      default -> "Rookie";
    };
  }

  private int tierValue(String t) {
    if (t == null) return 1;
    return switch (t.toUpperCase(Locale.ROOT)) {
      case "GRAND_SLAM" -> 4;
      case "MASTERS" -> 3;
      case "CHALLENGER" -> 2;
      default -> 1;
    };
  }

  private static final String ALPHANUM = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // loại bỏ ký tự dễ nhầm 0,1,O,I

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listAvailable() {
    return evaluateAll(null, null);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> evaluateAll(BigDecimal totalAmount, UUID accountId) {
    return evaluateAll(totalAmount, accountId, null);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> evaluateAll(BigDecimal totalAmount, UUID accountId, VoucherOrderContext ctx) {
    VoucherOrderContext effectiveCtx = ctx != null ? ctx : new VoucherOrderContext(totalAmount, accountId, List.of());
    Instant now = Instant.now();
    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;

    long pastOrders = 0;
    if (accountId != null) {
      pastOrders = orders.countByCustomerAccountIdAndStatusNotIn(accountId, Set.of("CANCELLED", "EXPIRED"));
    }

    List<Map<String, Object>> result = new ArrayList<>();
    for (Voucher v : vouchers.findByEnabledTrue()) {
      if (!"ACTIVE".equals(v.getStatus()) && !Boolean.TRUE.equals(v.getEnabled())) {
        continue;
      }
      if (v.getStartsAt() != null && v.getStartsAt().isAfter(now)) {
        continue;
      }
      if (v.getExpiresAt() != null && v.getExpiresAt().isBefore(now)) {
        continue;
      }

      // Mã cá nhân: chỉ hiển thị cho đúng tài khoản được gán
      if (v.getAssignedAccountId() != null) {
        if (accountId == null || !accountId.equals(v.getAssignedAccountId())) {
          continue;
        }
      }

      boolean applicable = true;
      String reason = null;

      String condErr = checkConditionError(v, effectiveCtx);
      if (condErr != null) {
        applicable = false;
        reason = condErr;
      }

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

      if (applicable && v.getMinTier() != null && !v.getMinTier().isBlank()) {
        if (accountId == null) {
          applicable = false;
          reason = "Đăng nhập để dùng voucher theo hạng";
        } else {
          var acc = accounts.findById(accountId).orElse(null);
          String userTier = acc != null && acc.getTier() != null ? acc.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
          if (tierValue(userTier) < tierValue(v.getMinTier().toUpperCase(Locale.ROOT))) {
            applicable = false;
            reason = "Chỉ áp dụng từ hạng " + tierDisplayName(v.getMinTier()) + " trở lên";
          }
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
      item.put("id", v.getId());
      item.put("code", v.getCode());
      item.put("type", v.getType());
      item.put("value", v.getValue());
      item.put("minOrder", v.getMinOrder());
      item.put("maxDiscount", v.getMaxDiscount());
      item.put("minTier", v.getMinTier());
      item.put("newUserOnly", v.getNewUserOnly());
      item.put("description", v.getDescription());
      item.put("applicable", applicable);
      item.put("discount", discount);
      item.put("reason", reason);
      item.put("assignedAccountId", v.getAssignedAccountId());
      item.put("source", v.getSource());

      // Ưu tiên mã cá nhân lên đầu danh sách
      if (v.getAssignedAccountId() != null) {
        result.add(0, item);
      } else {
        result.add(item);
      }
    }
    return result;
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount) {
    return calculate(rawCode, totalAmount, null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount, UUID accountId) {
    return calculate(rawCode, totalAmount, accountId, null);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount, UUID accountId, VoucherOrderContext ctx) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v = vouchers.findByCodeIgnoreCase(code).orElseThrow(
        () -> new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    VoucherOrderContext effectiveCtx = ctx != null ? ctx : new VoucherOrderContext(totalAmount, accountId, List.of());
    validateVoucherRules(v, totalAmount, accountId, null, effectiveCtx);
    BigDecimal discount = computeDiscount(v, totalAmount);

    return map(
        "id", v.getId(),
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
    return redeem(rawCode, order, totalAmount, accountId, (VoucherOrderContext) null);
  }

  @Transactional
  public Map<String, Object> redeem(String rawCode, CustomerOrder order, BigDecimal totalAmount, UUID accountId, VoucherOrderContext ctx) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v = vouchers.findByCodeForUpdate(code).orElseThrow(
        () -> new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    UUID currentOrderId = order != null ? order.getId() : null;
    VoucherOrderContext effectiveCtx = ctx != null ? ctx : new VoucherOrderContext(totalAmount, accountId, List.of());
    validateVoucherRules(v, totalAmount, accountId, currentOrderId, effectiveCtx);
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
        "id", v.getId(),
        "code", v.getCode(),
        "discount", discount,
        "description", v.getDescription(),
        "applied", true);
  }

  private Map<String, Object> benefit(Voucher voucher, BigDecimal discount) {
    return map("id", voucher.getId(), "code", voucher.getCode(), "discount", discount,
        "description", voucher.getDescription(), "applied", true);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> previewRestore(String code, CustomerOrder order, BigDecimal gross) {
    var retained = redemptions.findByOrderId(order.getId());
    if (retained.isPresent())
      return benefit(retained.get().getVoucher(), retained.get().getDiscountAmount());
    var voucher = vouchers.findByCodeIgnoreCase(code).orElseThrow(
        () -> new BusinessException("Voucher cũ không còn tồn tại; không thể khôi phục ưu đãi"));
    validateVoucherRules(voucher, gross,
        order.getCustomerAccount() == null ? null : order.getCustomerAccount().getId(), order.getId(), null);
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


  public String checkConditionError(Voucher v, VoucherOrderContext ctx) {
    if (ctx == null) return null;

    // 1. Đối tượng: nếu voucher cá nhân (assigned_account_id khác null) -> chỉ chính tài khoản đó được dùng
    if (v.getAssignedAccountId() != null) {
      if (ctx.accountId() == null || !ctx.accountId().equals(v.getAssignedAccountId())) {
        return "Voucher dành riêng cho tài khoản khác";
      }
    }

    // 2. Khung giờ: mọi slot trong đơn phải nằm trọn trong [valid_from_time, valid_to_time]
    if (v.getValidFromTime() != null || v.getValidToTime() != null) {
      if (ctx.slots() != null && !ctx.slots().isEmpty()) {
        for (VoucherOrderContext.SlotItem slot : ctx.slots()) {
          boolean violated = false;
          if (v.getValidFromTime() != null && slot.startTime() != null && slot.startTime().isBefore(v.getValidFromTime())) {
            violated = true;
          }
          if (v.getValidToTime() != null && slot.endTime() != null && slot.endTime().isAfter(v.getValidToTime())) {
            violated = true;
          }
          if (violated) {
            String fromStr = v.getValidFromTime() != null ? String.format("%02d:%02d", v.getValidFromTime().getHour(), v.getValidFromTime().getMinute()) : "00:00";
            String toStr = v.getValidToTime() != null ? String.format("%02d:%02d", v.getValidToTime().getHour(), v.getValidToTime().getMinute()) : "24:00";
            return "Chỉ áp dụng khung " + fromStr + "–" + toStr;
          }
        }
      }
    }

    // 3. Khu sân: sân đặt phải thuộc v.zone (INDOOR / OUTDOOR / VIP / ALL). Nếu đơn có nhiều sân khác khu -> từ chối
    if (v.getZone() != null && !v.getZone().isBlank() && !"ALL".equalsIgnoreCase(v.getZone().trim())) {
      String targetZone = v.getZone().trim().toUpperCase(Locale.ROOT);
      String zoneLabel = switch (targetZone) {
        case "OUTDOOR" -> "sân ngoài trời";
        case "INDOOR" -> "sân trong nhà";
        case "VIP" -> "sân VIP";
        default -> "khu " + targetZone;
      };
      if (ctx.slots() != null && !ctx.slots().isEmpty()) {
        Set<String> zonesInOrder = new HashSet<>();
        for (VoucherOrderContext.SlotItem slot : ctx.slots()) {
          if (slot.zone() != null && !slot.zone().isBlank()) {
            zonesInOrder.add(slot.zone().trim().toUpperCase(Locale.ROOT));
          }
        }
        if (zonesInOrder.size() > 1) {
          return "Chỉ áp dụng " + zoneLabel;
        }
        for (VoucherOrderContext.SlotItem slot : ctx.slots()) {
          if (slot.zone() != null && !slot.zone().isBlank()) {
            if (!targetZone.equalsIgnoreCase(slot.zone().trim())) {
              return "Chỉ áp dụng " + zoneLabel;
            }
          }
        }
      }
    }

    // 4. Ngày trong tuần: thứ của order.date phải nằm trong valid_weekdays (1..7, 1=Thứ 2 theo ISO)
    if (v.getValidWeekdays() != null && !v.getValidWeekdays().isBlank()) {
      Set<Integer> allowedDays = new HashSet<>();
      for (String part : v.getValidWeekdays().split("[,;\\s]+")) {
        try {
          if (!part.isBlank()) allowedDays.add(Integer.parseInt(part.trim()));
        } catch (NumberFormatException ignored) {}
      }
      if (!allowedDays.isEmpty() && ctx.slots() != null && !ctx.slots().isEmpty()) {
        for (VoucherOrderContext.SlotItem slot : ctx.slots()) {
          if (slot.date() != null) {
            int dow = slot.date().getDayOfWeek().getValue();
            if (!allowedDays.contains(dow)) {
              if (allowedDays.containsAll(Set.of(1, 2, 3, 4, 5)) && allowedDays.size() == 5) {
                return "Chỉ áp dụng Thứ 2–Thứ 6";
              } else if (allowedDays.containsAll(Set.of(6, 7)) && allowedDays.size() == 2) {
                return "Chỉ áp dụng Thứ 7–Chủ nhật";
              } else {
                return "Chỉ áp dụng Thứ 2–Thứ 6";
              }
            }
          }
        }
      }
    }

    return null;
  }

  public void validateConditions(Voucher v, VoucherOrderContext ctx) {
    String err = checkConditionError(v, ctx);
    if (err != null) {
      throw new BusinessException(err);
    }
  }

  public void validateConditionsForCode(String code, VoucherOrderContext ctx) {
    if (code == null || code.isBlank()) return;
    Voucher v = vouchers.findByCodeIgnoreCase(code.trim()).orElse(null);
    if (v != null) {
      validateConditions(v, ctx);
    }
  }

  private void validateVoucherRules(Voucher v, BigDecimal totalAmount, UUID accountId, UUID excludeOrderId, VoucherOrderContext ctx) {
    validateConditions(v, ctx != null ? ctx : new VoucherOrderContext(totalAmount, accountId, List.of()));
    if (!"ACTIVE".equals(v.getStatus()) && !Boolean.TRUE.equals(v.getEnabled())) {
      throw new BusinessException("Mã voucher '" + v.getCode() + "' hiện đang tạm khóa hoặc đã kết thúc");
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

    // Kiểm tra mã cá nhân
    if (v.getAssignedAccountId() != null) {
      if (accountId == null || !accountId.equals(v.getAssignedAccountId())) {
        throw new BusinessException("Mã voucher " + v.getCode() + " là ưu đãi cá nhân chỉ áp dụng cho tài khoản được chỉ định");
      }
    }

    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    if (v.getMinOrder() != null && total.compareTo(v.getMinOrder()) < 0) {
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

      if (v.getMinTier() != null && !v.getMinTier().isBlank()) {
        if (accountId == null) {
          throw new BusinessException("Đăng nhập để dùng voucher theo hạng");
        }
        var acc = accounts.findById(accountId).orElse(null);
        String userTier = acc != null && acc.getTier() != null ? acc.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
        if (tierValue(userTier) < tierValue(v.getMinTier().toUpperCase(Locale.ROOT))) {
          throw new BusinessException("Chỉ áp dụng từ hạng " + tierDisplayName(v.getMinTier()) + " trở lên");
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
      if (v.getMinTier() != null && !v.getMinTier().isBlank()) {
        throw new BusinessException("Đăng nhập để dùng voucher theo hạng");
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

  // =========================================================================
  // CÁC HÀM QUẢN TRỊ VOUCHER (ADMIN & STAFF)
  // =========================================================================

  @Transactional(readOnly = true)
  public List<Voucher> listAllForAdmin(String status) {
    if (status != null && !status.isBlank()) {
      return vouchers.findByStatus(status.toUpperCase(Locale.ROOT));
    }
    return vouchers.findAll();
  }

  @Transactional(readOnly = true)
  public List<Voucher> getMyVouchers(UUID accountId) {
    if (accountId == null) return List.of();
    return vouchers.findByAssignedAccountId(accountId);
  }

  @Transactional
  public Voucher createVoucher(Map<String, Object> body, Account actor) {
    String code = String.valueOf(body.get("code")).trim().toUpperCase(Locale.ROOT);
    if (!code.matches("^[A-Z0-9\\-]{4,30}$")) {
      throw new BusinessException("Mã voucher cần từ 4–30 ký tự [A-Z0-9-]");
    }
    if (vouchers.findByCodeIgnoreCase(code).isPresent()) {
      throw new BusinessException("Mã voucher '" + code + "' đã tồn tại trên hệ thống");
    }

    String type = String.valueOf(body.getOrDefault("type", "PERCENT")).trim().toUpperCase(Locale.ROOT);
    BigDecimal value = new BigDecimal(String.valueOf(body.get("value")));
    if ("PERCENT".equals(type)) {
      if (value.compareTo(BigDecimal.ONE) < 0 || value.compareTo(BigDecimal.valueOf(100)) > 0) {
        throw new BusinessException("Giá trị giảm theo phần trăm phải từ 1% đến 100%");
      }
    } else {
      if (value.compareTo(BigDecimal.ZERO) <= 0) {
        throw new BusinessException("Giá trị giảm tiền cố định phải lớn hơn 0");
      }
    }

    Voucher v = new Voucher();
    v.setCode(code);
    v.setType(type);
    v.setValue(value);
    v.setMinOrder(body.get("minOrder") != null ? new BigDecimal(String.valueOf(body.get("minOrder"))) : BigDecimal.ZERO);
    v.setMaxDiscount(body.get("maxDiscount") != null ? new BigDecimal(String.valueOf(body.get("maxDiscount"))) : null);
    v.setStartsAt(body.get("startsAt") != null ? Instant.parse(String.valueOf(body.get("startsAt"))) : Instant.now());
    v.setExpiresAt(body.get("expiresAt") != null ? Instant.parse(String.valueOf(body.get("expiresAt"))) : Instant.now().plus(Duration.ofDays(30)));
    v.setUsageLimit(body.get("usageLimit") != null ? ((Number) body.get("usageLimit")).intValue() : null);
    v.setPerUserLimit(body.get("perUserLimit") != null ? ((Number) body.get("perUserLimit")).intValue() : 1);
    v.setNewUserOnly(Boolean.TRUE.equals(body.get("newUserOnly")));
    v.setDescription((String) body.get("description"));
    v.setZone((String) body.get("zone"));
    v.setValidWeekdays((String) body.get("validWeekdays"));
    v.setCreatedBy(actor.getId());

    if (body.get("validFromTime") != null && !String.valueOf(body.get("validFromTime")).isBlank()) {
      v.setValidFromTime(LocalTime.parse(String.valueOf(body.get("validFromTime"))));
    }
    if (body.get("validToTime") != null && !String.valueOf(body.get("validToTime")).isBlank()) {
      v.setValidToTime(LocalTime.parse(String.valueOf(body.get("validToTime"))));
    }
    if (body.get("assignedAccountId") != null) {
      v.setAssignedAccountId(UUID.fromString(String.valueOf(body.get("assignedAccountId"))));
    }
    if (body.get("minTier") != null) {
      v.setMinTier((String) body.get("minTier"));
    }
    if (body.get("source") != null) {
      v.setSource(String.valueOf(body.get("source")));
    }
    if (body.get("feedbackId") != null) {
      v.setFeedbackId(String.valueOf(body.get("feedbackId")));
    }
    if (body.get("orderId") != null) {
      v.setOrderId(body.get("orderId") instanceof UUID u ? u : UUID.fromString(String.valueOf(body.get("orderId"))));
    }

    // Phân quyền tạo:
    boolean isAdmin = "ADMIN".equals(actor.getRole());
    if (isAdmin) {
      v.setStatus("ACTIVE");
      v.setEnabled(true);
      v.setApprovedBy(actor.getId());
      v.setApprovedAt(Instant.now());
    } else {
      // Hạn mức STAFF: giảm <= 20% hoặc <= 100.000₫, usageLimit <= 50, hiệu lực <= 30 ngày, có maxDiscount nếu %
      boolean withinLimit = true;
      if ("PERCENT".equals(type)) {
        if (value.compareTo(BigDecimal.valueOf(20)) > 0 || v.getMaxDiscount() == null) {
          withinLimit = false;
        }
      } else {
        if (value.compareTo(BigDecimal.valueOf(100_000)) > 0) {
          withinLimit = false;
        }
      }
      if (v.getUsageLimit() == null || v.getUsageLimit() > 50) {
        withinLimit = false;
      }
      long days = Duration.between(v.getStartsAt(), v.getExpiresAt()).toDays();
      if (days > 30) {
        withinLimit = false;
      }

      if (withinLimit) {
        v.setStatus("ACTIVE");
        v.setEnabled(true);
        v.setApprovedBy(actor.getId());
        v.setApprovedAt(Instant.now());
      } else {
        v.setStatus("PENDING_APPROVAL");
        v.setEnabled(false);
      }
    }

    Voucher saved = vouchers.save(v);
    auditService.log("CREATE_VOUCHER", "Tạo voucher " + saved.getCode() + " trạng thái " + saved.getStatus());
    return saved;
  }

  @Transactional
  public Voucher updateVoucher(UUID id, Map<String, Object> body, Account actor) {
    Voucher v = vouchers.findById(id).orElseThrow(() -> new BusinessException("Không tìm thấy voucher"));

    // Nếu voucher đã có người dùng thì KHÔNG sửa giá trị, điều kiện cốt lõi
    if (v.getUsedCount() > 0) {
      if (body.containsKey("value") || body.containsKey("type") || body.containsKey("minOrder") || body.containsKey("maxDiscount")) {
        throw new BusinessException("Voucher đã có lượt sử dụng thực tế. Không được sửa đổi giá trị để đảm bảo tính toàn vẹn sổ sách.");
      }
    } else {
      if (body.containsKey("value")) v.setValue(new BigDecimal(String.valueOf(body.get("value"))));
      if (body.containsKey("type")) v.setType(String.valueOf(body.get("type")).toUpperCase(Locale.ROOT));
      if (body.containsKey("minOrder")) v.setMinOrder(new BigDecimal(String.valueOf(body.get("minOrder"))));
      if (body.containsKey("maxDiscount")) v.setMaxDiscount(body.get("maxDiscount") != null ? new BigDecimal(String.valueOf(body.get("maxDiscount"))) : null);
    }

    if (body.containsKey("description")) v.setDescription((String) body.get("description"));
    if (body.containsKey("usageLimit")) v.setUsageLimit(body.get("usageLimit") != null ? ((Number) body.get("usageLimit")).intValue() : null);
    if (body.containsKey("perUserLimit")) v.setPerUserLimit(body.get("perUserLimit") != null ? ((Number) body.get("perUserLimit")).intValue() : 1);
    if (body.containsKey("expiresAt")) v.setExpiresAt(Instant.parse(String.valueOf(body.get("expiresAt"))));

    Voucher saved = vouchers.save(v);
    auditService.log("UPDATE_VOUCHER", "Cập nhật voucher " + saved.getCode());
    return saved;
  }

  @Transactional
  public Voucher pauseVoucher(UUID id, Account actor) {
    Voucher v = vouchers.findById(id).orElseThrow();
    v.setStatus("PAUSED");
    v.setEnabled(false);
    auditService.log("PAUSE_VOUCHER", "Tạm dừng voucher " + v.getCode());
    return vouchers.save(v);
  }

  @Transactional
  public Voucher resumeVoucher(UUID id, Account actor) {
    Voucher v = vouchers.findById(id).orElseThrow();
    v.setStatus("ACTIVE");
    v.setEnabled(true);
    auditService.log("RESUME_VOUCHER", "Kích hoạt lại voucher " + v.getCode());
    return vouchers.save(v);
  }

  @Transactional
  public Voucher endVoucher(UUID id, Account actor) {
    Voucher v = vouchers.findById(id).orElseThrow();
    v.setStatus("ENDED");
    v.setEnabled(false);
    auditService.log("END_VOUCHER", "Kết thúc voucher " + v.getCode());
    return vouchers.save(v);
  }

  @Transactional
  public Voucher approveVoucher(UUID id, Account actor) {
    if (!"ADMIN".equals(actor.getRole())) {
      throw new BusinessException("Chỉ Quản trị viên (ADMIN) mới có quyền phê duyệt voucher");
    }
    Voucher v = vouchers.findById(id).orElseThrow();
    v.setStatus("ACTIVE");
    v.setEnabled(true);
    v.setApprovedBy(actor.getId());
    v.setApprovedAt(Instant.now());
    auditService.log("APPROVE_VOUCHER", "Duyệt voucher " + v.getCode());
    return vouchers.save(v);
  }

  public record IssueSpec(
      String prefix,
      String source,
      String type,
      BigDecimal value,
      BigDecimal maxDiscount,
      BigDecimal minOrder,
      Instant startsAt,
      Instant expiresAt,
      String description,
      UUID orderId,
      String feedbackId
  ) {}

  @Transactional
  public Voucher issuePersonalVoucher(UUID accountId, IssueSpec spec) {
    String prefix = (spec.prefix() != null && !spec.prefix().isBlank())
        ? spec.prefix().trim().toUpperCase(Locale.ROOT)
        : "VCH";
    String suffix = randomSuffix(4);
    String code = prefix + "-" + suffix;
    while (vouchers.findByCodeIgnoreCase(code).isPresent()) {
      suffix = randomSuffix(4);
      code = prefix + "-" + suffix;
    }

    Voucher v = new Voucher();
    v.setCode(code);
    v.setType(spec.type() != null ? spec.type().toUpperCase(Locale.ROOT) : "FIXED");
    v.setValue(spec.value() != null ? spec.value() : BigDecimal.ZERO);
    v.setMinOrder(spec.minOrder() != null ? spec.minOrder() : BigDecimal.ZERO);
    v.setMaxDiscount(spec.maxDiscount());
    v.setStartsAt(spec.startsAt() != null ? spec.startsAt() : Instant.now());
    v.setExpiresAt(spec.expiresAt() != null ? spec.expiresAt() : Instant.now().plus(Duration.ofDays(30)));
    v.setUsageLimit(1);
    v.setUsedCount(0);
    v.setPerUserLimit(1);
    v.setNewUserOnly(false);
    v.setEnabled(true);
    v.setStatus("ACTIVE");
    v.setSource(spec.source() != null ? spec.source() : "TIER_GIFT");
    v.setAssignedAccountId(accountId);
    v.setDescription(spec.description());
    v.setCreatedBy(null);
    Voucher saved = vouchers.save(v);

    auditService.log("ISSUE_PERSONAL_VOUCHER", "Phát voucher cá nhân " + code + " cho tài khoản " + accountId + " nguồn " + v.getSource(), "SYSTEM");
    return saved;
  }

  @Transactional
  public Voucher createCompensationVoucher(UUID targetAccountId, UUID orderId, String feedbackId, Map<String, Object> template, Account actor) {
    String suffix = randomSuffix(4);
    String code = "SORRY-" + suffix;
    while (vouchers.findByCodeIgnoreCase(code).isPresent()) {
      suffix = randomSuffix(4);
      code = "SORRY-" + suffix;
    }

    Map<String, Object> vBody = new HashMap<>(template);
    vBody.put("code", code);
    vBody.put("assignedAccountId", targetAccountId);
    vBody.put("orderId", orderId);
    vBody.put("feedbackId", feedbackId);
    vBody.put("source", "FEEDBACK_RECOVERY");
    vBody.put("usageLimit", 1);
    vBody.put("perUserLimit", 1);
    return createVoucher(vBody, actor);
  }

  @Transactional
  public List<String> batchGenerate(String rawPrefix, int quantity, Map<String, Object> template, Account actor) {
    String prefix = (rawPrefix != null && !rawPrefix.isBlank()) ? rawPrefix.trim().toUpperCase(Locale.ROOT) : "TRIAN";
    int count = Math.min(Math.max(quantity, 1), 100);

    List<String> generatedCodes = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      String suffix = randomSuffix(4);
      String code = prefix + "-" + suffix;
      while (vouchers.findByCodeIgnoreCase(code).isPresent()) {
        suffix = randomSuffix(4);
        code = prefix + "-" + suffix;
      }

      Map<String, Object> vBody = new HashMap<>(template);
      vBody.put("code", code);
      vBody.put("usageLimit", 1);
      vBody.put("perUserLimit", 1);
      Voucher v = createVoucher(vBody, actor);
      generatedCodes.add(v.getCode());
    }

    auditService.log("BATCH_GENERATE_VOUCHER", "Sinh hàng loạt " + count + " mã tiền tố " + prefix);
    return generatedCodes;
  }

  private String randomSuffix(int len) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < len; i++) {
      sb.append(ALPHANUM.charAt(RANDOM.nextInt(ALPHANUM.length())));
    }
    return sb.toString();
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> getRedemptions(UUID voucherId) {
    List<VoucherRedemption> list = redemptions.findByVoucherId(voucherId);
    return list.stream().map(r -> {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", r.getId());
      m.put("orderId", r.getOrder() != null ? r.getOrder().getId() : null);
      m.put("accountId", r.getAccount() != null ? r.getAccount().getId() : null);
      m.put("customerName", r.getOrder() != null ? r.getOrder().getCustomerName() : (r.getAccount() != null ? r.getAccount().getFullName() : "—"));
      m.put("discountAmount", r.getDiscountAmount());
      m.put("redeemedAt", r.getRedeemedAt());
      return m;
    }).toList();
  }
}
