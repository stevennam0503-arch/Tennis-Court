package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.Account;
import com.courtly.entity.CustomerOrder;
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
  private final MembershipService memberships;
  private final AccountRepository accounts;
  private final AuditService auditService;

  private static final SecureRandom RANDOM = new SecureRandom();
  
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

      if (applicable && (Boolean.TRUE.equals(v.getMemberOnly()) || (v.getMinTier() != null && !v.getMinTier().isBlank()))) {
        if (accountId == null) {
          applicable = false;
          reason = "Dành riêng cho Hội viên CLB (cần đăng nhập)";
        } else if (!isMember && Boolean.TRUE.equals(v.getMemberOnly())) {
          applicable = false;
          reason = "Chỉ áp dụng cho Hội viên CLB có gói active";
        } else if (v.getMinTier() != null && !v.getMinTier().isBlank()) {
          var acc = accounts.findById(accountId).orElse(null);
          String userTier = acc != null && acc.getTier() != null ? acc.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
          if (tierValue(userTier) < tierValue(v.getMinTier().toUpperCase(Locale.ROOT))) {
            applicable = false;
            reason = "Chỉ áp dụng cho thành viên từ hạng " + v.getMinTier() + " trở lên";
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
      item.put("memberOnly", v.getMemberOnly());
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
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v = vouchers.findByCodeIgnoreCase(code).orElseThrow(
        () -> new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

    validateVoucherRules(v, totalAmount, accountId, null);
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
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    Voucher v = vouchers.findByCodeForUpdate(code).orElseThrow(
        () -> new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn"));

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

  private void validateVoucherRules(Voucher v, BigDecimal totalAmount, UUID accountId, UUID excludeOrderId) {
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

      if (Boolean.TRUE.equals(v.getMemberOnly())) {
        boolean activeMember = memberships.hasActiveMembership(accountId);
        if (!activeMember) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho hội viên có gói active");
        }
      }

      if (v.getMinTier() != null && !v.getMinTier().isBlank()) {
        var acc = accounts.findById(accountId).orElse(null);
        String userTier = acc != null && acc.getTier() != null ? acc.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
        if (tierValue(userTier) < tierValue(v.getMinTier().toUpperCase(Locale.ROOT))) {
          throw new BusinessException("Voucher " + v.getCode() + " chỉ áp dụng cho thành viên từ hạng " + v.getMinTier() + " trở lên");
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
      if (Boolean.TRUE.equals(v.getMemberOnly()) || (v.getMinTier() != null && !v.getMinTier().isBlank())) {
        throw new BusinessException("Voucher " + v.getCode() + " yêu cầu đăng nhập tài khoản");
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
