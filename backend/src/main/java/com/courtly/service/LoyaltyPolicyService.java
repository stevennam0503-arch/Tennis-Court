package com.courtly.service;

import com.courtly.entity.Account;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chính sách hạng thành viên do admin chỉnh được.
 *
 * <p>Quy tắc: giữ cố định 4 hạng (mã + tên), chỉ cho sửa con số; thay đổi luôn có ngày hiệu lực
 * từ ngày mai trở đi (không áp dụng ngược); khách đang giữ hạng giữ tới hạn xét hạng; mọi thay đổi
 * được ghi lịch sử và nhật ký kiểm toán.
 */
@Service
@RequiredArgsConstructor
public class LoyaltyPolicyService {

  public static final List<String> TIERS = List.of("ROOKIE", "CHALLENGER", "MASTERS", "GRAND_SLAM");
  public static final Map<String, String> NAMES = Map.of(
      "ROOKIE", "Rookie", "CHALLENGER", "Challenger", "MASTERS", "Masters", "GRAND_SLAM", "Grand Slam");
  /** Các trường admin được sửa, kèm nhãn hiển thị trong nhật ký. */
  public static final LinkedHashMap<String, String> FIELDS = new LinkedHashMap<>();
  static {
    FIELDS.put("spend", "Chi tiêu 12 tháng");
    FIELDS.put("discount", "Giảm giá tiền sân (%)");
    FIELDS.put("multiplier", "Hệ số tích điểm");
    FIELDS.put("advanceDays", "Đặt trước (ngày)");
    FIELDS.put("changes", "Đổi lịch miễn phí/tháng");
    FIELDS.put("birthday", "Voucher sinh nhật (₫)");
  }

  private static final String KEY = "loyalty:policy";
  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final double MAX_DISCOUNT = 15.0;

  private final DocumentService docs;
  private final AuditService audit;
  private final AccountRepository accounts;
  private final NotificationService notifications;

  private volatile Map<String, Object> cache;
  private volatile long cacheAt;

  public static Map<String, Map<String, Object>> defaults() {
    Map<String, Map<String, Object>> m = new LinkedHashMap<>();
    m.put("ROOKIE", tier(0, 0, 1.0, 7, 0, 30_000));
    m.put("CHALLENGER", tier(3_000_000, 3, 1.2, 10, 1, 60_000));
    m.put("MASTERS", tier(8_000_000, 5, 1.5, 14, 2, 120_000));
    m.put("GRAND_SLAM", tier(20_000_000, 8, 2.0, 21, 4, 250_000));
    return m;
  }

  private static Map<String, Object> tier(long spend, double discount, double mult, int days, int changes, long birthday) {
    Map<String, Object> t = new LinkedHashMap<>();
    t.put("spend", spend);
    t.put("discount", discount);
    t.put("multiplier", mult);
    t.put("advanceDays", days);
    t.put("changes", changes);
    t.put("birthday", birthday);
    return t;
  }

  // ---------------------------------------------------------------- đọc

  private Map<String, Object> doc() {
    long now = System.currentTimeMillis();
    Map<String, Object> c = cache;
    if (c != null && now - cacheAt < 30_000) return c;
    Map<String, Object> d = docs.get(KEY);
    cache = d;
    cacheAt = now;
    return d;
  }

  private void invalidate() {
    cache = null;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Map<String, Object>> tiersOf(Object raw) {
    Map<String, Map<String, Object>> out = defaults();
    if (raw instanceof Map<?, ?> m) {
      for (String code : TIERS) {
        if (m.get(code) instanceof Map<?, ?> t) out.get(code).putAll((Map<String, Object>) t);
      }
    }
    return out;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> pendingRaw(Map<String, Object> d) {
    return d.get("pending") instanceof Map<?, ?> p ? (Map<String, Object>) p : null;
  }

  private static Instant startOf(String isoDate) {
    return LocalDate.parse(isoDate).atStartOfDay(ZONE).toInstant();
  }

  /** Chính sách đang hiệu lực lúc này (bản chờ tự có hiệu lực khi tới ngày, không cần tác vụ nền). */
  @SuppressWarnings("unchecked")
  public Map<String, Map<String, Object>> effective() {
    Map<String, Object> d = doc();
    Map<String, Object> p = pendingRaw(d);
    if (p != null && !startOf((String) p.get("effectiveFrom")).isAfter(Instant.now())) {
      return tiersOf(p.get("tiers"));
    }
    return tiersOf(d.get("current") instanceof Map<?, ?> cur ? ((Map<String, Object>) cur).get("tiers") : null);
  }

  public Map<String, Object> tierRule(String rawTier) {
    String code = rawTier == null ? "ROOKIE" : rawTier.toUpperCase(Locale.ROOT);
    return effective().getOrDefault(code, effective().get("ROOKIE"));
  }

  public double num(String tier, String field) {
    return ((Number) tierRule(tier).get(field)).doubleValue();
  }

  public BigDecimal threshold(String tier) {
    return BigDecimal.valueOf(((Number) tierRule(tier).get("spend")).longValue());
  }

  private static List<Map<String, Object>> asList(Map<String, Map<String, Object>> tiers) {
    List<Map<String, Object>> list = new ArrayList<>();
    for (String code : TIERS) {
      Map<String, Object> t = new LinkedHashMap<>();
      t.put("tier", code);
      t.put("name", NAMES.get(code));
      t.putAll(tiers.get(code));
      list.add(t);
    }
    return list;
  }

  /** Dữ liệu cho trang khách: chính sách hiện hành + thay đổi sắp có hiệu lực (để báo trước cho khách). */
  public Map<String, Object> publicPolicy() {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("tiers", asList(effective()));
    Map<String, Object> p = pendingRaw(doc());
    if (p != null && startOf((String) p.get("effectiveFrom")).isAfter(Instant.now())) {
      out.put("pending", Map.of("effectiveFrom", p.get("effectiveFrom"), "tiers", asList(tiersOf(p.get("tiers")))));
    } else {
      out.put("pending", null);
    }
    return out;
  }

  public List<Map<String, Object>> publicTiers() {
    return asList(effective());
  }

  public Map<String, Object> adminView() {
    Map<String, Object> out = publicPolicy();
    Object history = doc().get("history");
    out.put("history", history instanceof List<?> ? history : List.of());
    out.put("fields", FIELDS);
    out.put("maxDiscount", MAX_DISCOUNT);
    out.put("earliestEffectiveFrom", LocalDate.now(ZONE).plusDays(1).toString());
    return out;
  }

  // ---------------------------------------------------------------- ghi

  private static double read(Map<?, ?> t, String field, String tierName) {
    Object v = t.get(field);
    try {
      return v instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(v).replace(",", "."));
    } catch (NumberFormatException e) {
      throw new BusinessException("Hạng " + tierName + ": \"" + FIELDS.get(field) + "\" không phải số hợp lệ");
    }
  }

  private static void require(boolean ok, String message) {
    if (!ok) throw new BusinessException(message);
  }

  private static String fmt(String field, Object v) {
    double d = ((Number) v).doubleValue();
    return switch (field) {
      case "spend", "birthday" -> String.format(Locale.GERMANY, "%,.0f₫", d);
      case "discount" -> (d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d)) + "%";
      case "multiplier" -> "×" + String.valueOf(d).replace('.', ',');
      default -> String.valueOf((long) d);
    };
  }

  /** Lên lịch chính sách mới. Thay thế bản đang chờ (nếu có). */
  @Transactional
  public Map<String, Object> schedule(Account admin, Map<String, Object> body) {
    require("ADMIN".equalsIgnoreCase(admin.getRole()), "Chỉ Manager được đổi chính sách hạng");
    String effectiveFrom = String.valueOf(body.getOrDefault("effectiveFrom", "")).trim();
    LocalDate from;
    try {
      from = LocalDate.parse(effectiveFrom);
    } catch (Exception e) {
      throw new BusinessException("Ngày hiệu lực không hợp lệ");
    }
    LocalDate tomorrow = LocalDate.now(ZONE).plusDays(1);
    require(!from.isBefore(tomorrow), "Ngày hiệu lực phải từ ngày mai (" + tomorrow.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
        + ") trở đi. Chính sách mới không áp dụng ngược.");
    require(!from.isAfter(tomorrow.plusYears(1)), "Ngày hiệu lực không quá 1 năm kể từ hôm nay");
    require(body.get("tiers") instanceof Map<?, ?>, "Thiếu bảng chính sách hạng");
    Map<?, ?> in = (Map<?, ?>) body.get("tiers");

    Map<String, Map<String, Object>> next = new LinkedHashMap<>();
    Map<String, Object> prev = null;
    for (String code : TIERS) {
      String name = NAMES.get(code);
      require(in.get(code) instanceof Map<?, ?>, "Thiếu số liệu hạng " + name);
      Map<?, ?> t = (Map<?, ?>) in.get(code);
      long spend = Math.round(read(t, "spend", name));
      double discount = Math.round(read(t, "discount", name) * 10) / 10.0;
      double mult = Math.round(read(t, "multiplier", name) * 10) / 10.0;
      int days = (int) Math.round(read(t, "advanceDays", name));
      int changes = (int) Math.round(read(t, "changes", name));
      long birthday = Math.round(read(t, "birthday", name));

      if ("ROOKIE".equals(code)) require(spend == 0, "Hạng Rookie là hạng khởi đầu, ngưỡng chi tiêu phải là 0₫");
      require(spend >= 0 && spend <= 1_000_000_000L, "Hạng " + name + ": ngưỡng chi tiêu không hợp lệ");
      require(discount >= 0 && discount <= MAX_DISCOUNT, "Hạng " + name + ": giảm giá phải từ 0% đến " + (int) MAX_DISCOUNT + "%");
      require(mult >= 1.0 && mult <= 5.0, "Hạng " + name + ": hệ số tích điểm phải từ ×1,0 đến ×5,0");
      require(days >= 1 && days <= 60, "Hạng " + name + ": số ngày đặt trước phải từ 1 đến 60");
      require(changes >= 0 && changes <= 10, "Hạng " + name + ": số lần đổi lịch miễn phí phải từ 0 đến 10");
      require(birthday >= 0 && birthday <= 1_000_000, "Hạng " + name + ": voucher sinh nhật tối đa 1.000.000₫");
      if (prev != null) {
        String lower = NAMES.get(TIERS.get(TIERS.indexOf(code) - 1));
        require(spend > ((Number) prev.get("spend")).longValue(), "Ngưỡng chi tiêu hạng " + name + " phải cao hơn hạng " + lower);
        require(discount >= ((Number) prev.get("discount")).doubleValue(), "Giảm giá hạng " + name + " không được thấp hơn hạng " + lower);
        require(mult >= ((Number) prev.get("multiplier")).doubleValue(), "Hệ số điểm hạng " + name + " không được thấp hơn hạng " + lower);
        require(days >= ((Number) prev.get("advanceDays")).intValue(), "Số ngày đặt trước hạng " + name + " không được ít hơn hạng " + lower);
        require(changes >= ((Number) prev.get("changes")).intValue(), "Số lần đổi lịch hạng " + name + " không được ít hơn hạng " + lower);
        require(birthday >= ((Number) prev.get("birthday")).longValue(), "Voucher sinh nhật hạng " + name + " không được thấp hơn hạng " + lower);
      }
      Map<String, Object> row = tier(spend, discount, mult, days, changes, birthday);
      next.put(code, row);
      prev = row;
    }

    // So với chính sách đang hiệu lực để ghi nhật ký
    Map<String, Map<String, Object>> base = effective();
    List<String> changesList = new ArrayList<>();
    for (String code : TIERS) {
      for (String f : FIELDS.keySet()) {
        double a = ((Number) base.get(code).get(f)).doubleValue();
        double b = ((Number) next.get(code).get(f)).doubleValue();
        if (Math.abs(a - b) > 1e-9) {
          changesList.add(NAMES.get(code) + " · " + FIELDS.get(f) + ": " + fmt(f, base.get(code).get(f)) + " → " + fmt(f, next.get(code).get(f)));
        }
      }
    }
    require(!changesList.isEmpty(), "Chưa có thay đổi nào so với chính sách hiện hành");

    var row = docs.lock(KEY);
    Map<String, Object> d = new LinkedHashMap<>(row.getData() == null ? Map.of() : docs.read(row));
    // Nếu bản chờ cũ đã tới hạn thì nó trở thành "hiện hành" trước khi ghi bản mới
    Map<String, Object> oldPending = pendingRaw(d);
    if (oldPending != null && !startOf((String) oldPending.get("effectiveFrom")).isAfter(Instant.now())) {
      d.put("current", oldPending);
    }
    Map<String, Object> pending = new LinkedHashMap<>();
    pending.put("effectiveFrom", from.toString());
    pending.put("tiers", next);
    pending.put("by", admin.getFullName());
    pending.put("at", Instant.now().toString());
    d.put("pending", pending);
    pushHistory(d, admin, "SCHEDULE", from.toString(), changesList);
    docs.save(row, d);
    invalidate();

    String when = from.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    audit.log("LOYALTY_POLICY_SCHEDULE", "Lên lịch chính sách hạng mới hiệu lực từ " + when + ": " + String.join("; ", changesList));
    notifyCustomers(when, from.toString());
    return adminView();
  }

  @Transactional
  public Map<String, Object> cancelPending(Account admin) {
    require("ADMIN".equalsIgnoreCase(admin.getRole()), "Chỉ Manager được đổi chính sách hạng");
    var row = docs.lock(KEY);
    Map<String, Object> d = new LinkedHashMap<>(row.getData() == null ? Map.of() : docs.read(row));
    Map<String, Object> p = pendingRaw(d);
    require(p != null && startOf((String) p.get("effectiveFrom")).isAfter(Instant.now()), "Không có thay đổi nào đang chờ hiệu lực");
    d.remove("pending");
    pushHistory(d, admin, "CANCEL", (String) p.get("effectiveFrom"), List.of("Hủy thay đổi dự kiến hiệu lực từ " + p.get("effectiveFrom")));
    docs.save(row, d);
    invalidate();
    audit.log("LOYALTY_POLICY_CANCEL", "Hủy chính sách hạng dự kiến hiệu lực từ " + p.get("effectiveFrom"));
    return adminView();
  }

  @SuppressWarnings("unchecked")
  private void pushHistory(Map<String, Object> d, Account admin, String action, String effectiveFrom, List<String> changes) {
    List<Object> history = new ArrayList<>(d.get("history") instanceof List<?> h ? (List<Object>) h : List.of());
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("at", Instant.now().toString());
    entry.put("by", admin.getFullName());
    entry.put("action", action);
    entry.put("effectiveFrom", effectiveFrom);
    entry.put("changes", changes);
    history.add(0, entry);
    d.put("history", history.subList(0, Math.min(30, history.size())));
  }

  /** Báo trước cho khách qua chuông thông báo (không gửi email hàng loạt). */
  private void notifyCustomers(String when, String effectiveFrom) {
    String body = "Courtly cập nhật quyền lợi hạng thành viên, áp dụng từ " + when
        + ". Hạng hiện tại của bạn được giữ tới kỳ xét hạng. Xem chi tiết ở trang Hạng thành viên.";
    for (Account a : accounts.findAll()) {
      if (!"CUSTOMER".equalsIgnoreCase(a.getRole()) || !"ACTIVE".equalsIgnoreCase(a.getStatus())) continue;
      notifications.enqueue(a.getId(), null, null, "LOYALTY_POLICY", "IN_APP", null,
          "📣 Cập nhật quyền lợi hạng thành viên", body, Instant.now(), "LOYALTY_POLICY:" + effectiveFrom + ":" + a.getId() + ":" + System.currentTimeMillis());
    }
  }

  /** Dữ liệu demo: trở về chính sách mặc định. */
  public void resetToDefaults() {
    docs.delete(KEY);
    invalidate();
  }
}
