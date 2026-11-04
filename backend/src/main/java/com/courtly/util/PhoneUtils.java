package com.courtly.util;

import com.courtly.exception.BusinessException;

public final class PhoneUtils {
  private PhoneUtils() {}

  /**
   * Chuẩn hóa số điện thoại Việt Nam sang định dạng E.164: +84xxxxxxxxx
   * Hỗ trợ các định dạng đầu vào: 0912345678, +84912345678, 84912345678, 0912 345 678
   */
  public static String normalizeE164(String phone) {
    if (phone == null || phone.isBlank()) {
      return "";
    }
    String clean = phone.trim().replaceAll("[\\s\\-\\.\\(\\)]+", "");
    if (clean.startsWith("+84")) {
      if (clean.matches("^\\+84[0-9]{9}$")) {
        return clean;
      }
    } else if (clean.startsWith("84")) {
      if (clean.matches("^84[0-9]{9}$")) {
        return "+" + clean;
      }
    } else if (clean.startsWith("0")) {
      if (clean.matches("^0[0-9]{9}$")) {
        return "+84" + clean.substring(1);
      }
    }
    throw new BusinessException("Số điện thoại không hợp lệ (cần 10 chữ số, ví dụ 0912 345 678)");
  }

  /**
   * Kiểm tra chuỗi có phải là số điện thoại Việt Nam hợp lệ hay không
   */
  public static boolean isValid(String phone) {
    if (phone == null || phone.isBlank()) return false;
    String clean = phone.trim().replaceAll("[\\s\\-\\.\\(\\)]+", "");
    return clean.matches("^(\\+84|84|0)[0-9]{9}$");
  }

  /**
   * Định dạng hiển thị thân thiện: 09xx xxx xxx
   */
  public static String formatDisplay(String phone) {
    if (phone == null || phone.isBlank()) return "";
    String clean = phone.trim().replaceAll("[\\s\\-\\.\\(\\)]+", "");
    String local = clean;
    if (clean.startsWith("+84")) {
      local = "0" + clean.substring(3);
    } else if (clean.startsWith("84")) {
      local = "0" + clean.substring(2);
    }
    if (local.matches("^0[0-9]{9}$")) {
      return local.substring(0, 4) + " " + local.substring(4, 7) + " " + local.substring(7);
    }
    return phone;
  }
}
