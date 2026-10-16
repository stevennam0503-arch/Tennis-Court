package com.courtly.util;

import com.courtly.exception.BusinessException;
import java.math.*;
import java.time.*;
import java.util.*;

public final class Rules {
  public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

  private Rules() {}

  public static void require(boolean condition, String message) {
    if (!condition) throw new BusinessException(message);
  }

  public static String text(String value, String label) {
    require(value != null && !value.isBlank() && value.length() <= 255, label + " không hợp lệ");
    return value.trim();
  }

  public static String oneOf(String value, String... choices) {
    require(
        value != null && Arrays.asList(choices).contains(value), "Giá trị không hợp lệ: " + value);
    return value;
  }

  public static BigDecimal positive(BigDecimal value) {
    require(
        value != null && value.signum() > 0 && value.compareTo(new BigDecimal("999999999999")) < 0,
        "Số tiền phải lớn hơn 0");
    return value.setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal hours(LocalTime start, LocalTime end) {
    return BigDecimal.valueOf(Duration.between(start, end).toMinutes())
        .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
  }

  public static boolean active(String status) {
    return !Set.of("COMPLETED", "CANCELLED", "EXPIRED").contains(status);
  }

  public static Instant at(LocalDate date, LocalTime time) {
    return date.atTime(time).atZone(ZONE).toInstant();
  }

  public static Map<String, Object> map(Object... pairs) {
    Map<String, Object> out = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
    return out;
  }
}
