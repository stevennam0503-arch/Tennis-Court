package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class VoucherService {

  public record VoucherDef(
      String code,
      String type, // FIXED or PERCENT
      BigDecimal value,
      BigDecimal minOrder,
      BigDecimal maxDiscount,
      String description) {}

  private static final Map<String, VoucherDef> ACTIVE_VOUCHERS = new LinkedHashMap<>();

  static {
    ACTIVE_VOUCHERS.put(
        "WELCOME",
        new VoucherDef(
            "WELCOME",
            "FIXED",
            BigDecimal.valueOf(50000),
            BigDecimal.valueOf(100000),
            BigDecimal.valueOf(50000),
            "Giảm 50.000 đ chào mừng thành viên mới"));
    ACTIVE_VOUCHERS.put(
        "HE2026",
        new VoucherDef(
            "HE2026",
            "FIXED",
            BigDecimal.valueOf(50000),
            BigDecimal.valueOf(150000),
            BigDecimal.valueOf(50000),
            "Giảm 50.000 đ mùa hè sôi động 2026"));
    ACTIVE_VOUCHERS.put(
        "COURTLY50K",
        new VoucherDef(
            "COURTLY50K",
            "FIXED",
            BigDecimal.valueOf(50000),
            BigDecimal.valueOf(100000),
            BigDecimal.valueOf(50000),
            "Voucher tri ân 50.000 đ"));
    ACTIVE_VOUCHERS.put(
        "VIP10",
        new VoucherDef(
            "VIP10",
            "PERCENT",
            BigDecimal.valueOf(10),
            BigDecimal.valueOf(200000),
            BigDecimal.valueOf(100000),
            "Giảm 10% (tối đa 100k) cho hội viên"));
    ACTIVE_VOUCHERS.put(
        "FLASH25",
        new VoucherDef(
            "FLASH25",
            "PERCENT",
            BigDecimal.valueOf(25),
            BigDecimal.valueOf(100000),
            BigDecimal.valueOf(150000),
            "Ưu đãi Giờ Vàng giảm 25%"));
  }

  public List<Map<String, Object>> listAvailable() {
    return ACTIVE_VOUCHERS.values().stream()
        .map(
            v ->
                map(
                    "code", v.code(),
                    "type", v.type(),
                    "value", v.value(),
                    "minOrder", v.minOrder(),
                    "description", v.description()))
        .toList();
  }

  public Map<String, Object> calculate(String rawCode, BigDecimal totalAmount) {
    if (rawCode == null || rawCode.isBlank()) {
      return null;
    }
    String code = rawCode.trim().toUpperCase(Locale.ROOT);
    VoucherDef def = ACTIVE_VOUCHERS.get(code);
    if (def == null) {
      throw new BusinessException("Mã voucher '" + rawCode + "' không tồn tại hoặc đã hết hạn");
    }

    BigDecimal total = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    if (total.compareTo(def.minOrder()) < 0) {
      throw new BusinessException(
          "Đơn đặt sân tối thiểu "
              + def.minOrder().setScale(0, RoundingMode.HALF_UP)
              + " đ để áp dụng voucher "
              + code);
    }

    BigDecimal discount;
    if ("PERCENT".equals(def.type())) {
      discount =
          total
              .multiply(def.value())
              .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
      if (def.maxDiscount() != null && discount.compareTo(def.maxDiscount()) > 0) {
        discount = def.maxDiscount();
      }
    } else {
      discount = def.value();
    }

    if (discount.compareTo(total) > 0) {
      discount = total;
    }

    return map(
        "code", def.code(),
        "discount", discount,
        "description", def.description(),
        "applied", true);
  }
}
