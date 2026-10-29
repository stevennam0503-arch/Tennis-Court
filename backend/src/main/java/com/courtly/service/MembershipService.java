package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.AccountRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MembershipService {
  private final DocumentService docs;
  private final AuthService auth;
  private final RequestService requests;
  private final AccountRepository accounts;
  private final com.courtly.repository.PaymentRepository payments;

  public List<Map<String, Object>> plans() {
    var saved = docs.list("membership-plan:");
    if (!saved.isEmpty()) return saved;
    return defaultPlans();
  }

  public List<Map<String, Object>> defaultPlans() {
    return List.of(
        map(
            "id", "club",
            "name", "Club",
            "price", 249000L,
            "days", 30,
            "discountPercent", 10,
            "vipDiscountPercent", 5,
            "advanceDays", 14,
            "freeChanges", 1,
            "enabled", true,
            "description", "Cho nhịp chơi đều đặn · Miễn phí gửi xe."),
        map(
            "id", "plus",
            "name", "Plus",
            "price", 499000L,
            "days", 30,
            "discountPercent", 15,
            "vipDiscountPercent", 10,
            "advanceDays", 21,
            "freeChanges", 2,
            "enabled", true,
            "description", "Dành cho người mê tennis · Miễn phí gửi xe & VIP Lounge."));
  }

  public void ensureDefaultPlansPersisted() {
    var saved = docs.list("membership-plan:");
    if (saved.isEmpty()) {
      for (var def : defaultPlans()) {
        docs.put("membership-plan:" + def.get("id"), new LinkedHashMap<>(def));
      }
    }
  }

  public Map<String, Object> createPlan(Account a, Map<String, Object> b) {
    auth.admin(a);
    ensureDefaultPlansPersisted();
    String name = text((String) b.get("name"), "Tên gói");
    String rawId = (String) b.get("id");
    String calculatedId = (rawId != null && !rawId.isBlank())
        ? rawId.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "")
        : name.toLowerCase(Locale.ROOT).replaceAll("\s+", "-").replaceAll("[^a-z0-9_-]", "");
    if (calculatedId.isBlank() || calculatedId.length() < 2) {
      calculatedId = "plan_" + UUID.randomUUID().toString().substring(0, 8);
    }
    final String id = calculatedId;
    require(plans().stream().noneMatch(p -> p.get("id").equals(id)), "Mã gói hoặc tên gói tương tự đã tồn tại");

    var price = PresentationService.decimal(b.get("price"));
    var days = PresentationService.decimal(b.get("days"));
    var discountPercent = PresentationService.decimal(b.get("discountPercent"));
    require(price.signum() > 0, "Giá gói cần lớn hơn 0");
    require(days.signum() > 0 && days.intValue() <= 366, "Số ngày hiệu lực từ 1 đến 366");
    require(discountPercent.signum() >= 0 && discountPercent.intValue() <= 50, "Giảm giá từ 0% đến 50%");

    int vipDisc = b.get("vipDiscountPercent") != null ? PresentationService.decimal(b.get("vipDiscountPercent")).intValue() : (discountPercent.intValue() / 2);
    int advDays = b.get("advanceDays") != null ? PresentationService.decimal(b.get("advanceDays")).intValue() : 14;
    int freeChg = b.get("freeChanges") != null ? PresentationService.decimal(b.get("freeChanges")).intValue() : 1;

    boolean enabled = b.get("enabled") == null || Boolean.TRUE.equals(b.get("enabled")) || "true".equals(String.valueOf(b.get("enabled")));
    String desc = b.get("description") != null ? text((String) b.get("description"), "Mô tả") : "Quyền lợi hội viên CLB Courtly.";

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("id", id);
    plan.put("name", name);
    plan.put("price", price.longValue());
    plan.put("days", days.intValue());
    plan.put("discountPercent", discountPercent.intValue());
    plan.put("vipDiscountPercent", Math.max(0, Math.min(50, vipDisc)));
    plan.put("advanceDays", Math.max(1, Math.min(90, advDays)));
    plan.put("freeChanges", Math.max(0, Math.min(20, freeChg)));
    plan.put("description", desc);
    plan.put("enabled", enabled);

    docs.put("membership-plan:" + id, plan);
    return map("id", id, "name", name, "success", true);
  }

  public Map<String, Object> updatePlan(Account a, Map<String, Object> b) {
    auth.admin(a);
    ensureDefaultPlansPersisted();
    String id = (String) b.get("id");
    require(id != null && !id.isBlank(), "Mã gói không hợp lệ");
    var existing = plans().stream().filter(p -> p.get("id").equals(id)).findFirst()
        .orElseThrow(() -> new com.courtly.exception.BusinessException("Gói hội viên không tồn tại"));

    var price = PresentationService.decimal(b.get("price"));
    var days = PresentationService.decimal(b.get("days"));
    var discountPercent = PresentationService.decimal(b.get("discountPercent"));
    require(price.signum() > 0, "Giá gói cần lớn hơn 0");
    require(days.signum() > 0 && days.intValue() <= 366, "Số ngày hiệu lực từ 1 đến 366");
    require(discountPercent.signum() >= 0 && discountPercent.intValue() <= 50, "Giảm giá từ 0% đến 50%");

    int vipDisc = b.get("vipDiscountPercent") != null ? PresentationService.decimal(b.get("vipDiscountPercent")).intValue() : ((Number) existing.getOrDefault("vipDiscountPercent", 5)).intValue();
    int advDays = b.get("advanceDays") != null ? PresentationService.decimal(b.get("advanceDays")).intValue() : ((Number) existing.getOrDefault("advanceDays", 14)).intValue();
    int freeChg = b.get("freeChanges") != null ? PresentationService.decimal(b.get("freeChanges")).intValue() : ((Number) existing.getOrDefault("freeChanges", 1)).intValue();

    boolean enabled = b.get("enabled") == null ? true : (Boolean.TRUE.equals(b.get("enabled")) || "true".equals(String.valueOf(b.get("enabled"))));
    String desc = b.get("description") != null ? text((String) b.get("description"), "Mô tả") : (String) existing.getOrDefault("description", "");

    Map<String, Object> plan = new LinkedHashMap<>(existing);
    plan.put("id", id);
    plan.put("name", text((String) b.get("name"), "Tên gói"));
    plan.put("price", price.longValue());
    plan.put("days", days.intValue());
    plan.put("discountPercent", discountPercent.intValue());
    plan.put("vipDiscountPercent", Math.max(0, Math.min(50, vipDisc)));
    plan.put("advanceDays", Math.max(1, Math.min(90, advDays)));
    plan.put("freeChanges", Math.max(0, Math.min(20, freeChg)));
    plan.put("description", desc);
    plan.put("enabled", enabled);

    docs.put("membership-plan:" + id, plan);
    return map("id", id, "name", plan.get("name"), "success", true);
  }

  public Map<String, Object> deletePlan(Account a, String id) {
    auth.admin(a);
    ensureDefaultPlansPersisted();
    require(id != null && !id.isBlank(), "Mã gói không hợp lệ");
    var plan = plans().stream().filter(p -> p.get("id").equals(id)).findFirst()
        .orElseThrow(() -> new com.courtly.exception.BusinessException("Gói hội viên không tồn tại"));

    boolean inUse = docs.list("membership:").stream()
        .anyMatch(m -> id.equals(m.get("planId")) && "ACTIVE".equals(status(m)));
    require(!inUse, "Không thể xóa gói hội viên đang có hội viên sử dụng. Vui lòng tạm dừng đăng ký (chuyển sang Inactive).");

    docs.delete("membership-plan:" + id);
    return map("id", id, "deleted", true);
  }

  public String status(Map<String, Object> m) {
    return "ACTIVE".equals(m.get("status"))
            && !Instant.parse((String) m.get("endsAt")).isAfter(Instant.now())
        ? "EXPIRED"
        : (String) m.get("status");
  }

  public Map<String, Object> view(Account a) {
    var members =
        docs.list("membership:").stream()
            .filter(
                m -> "ADMIN".equals(a.getRole()) || a.getId().toString().equals(m.get("accountId")))
            .map(
                m -> {
                  var copy = new LinkedHashMap<>(m);
                  copy.put("status", status(m));
                  return copy;
                })
            .toList();
    var receipts =
        docs.list("membership-payment:").stream()
            .filter(
                m -> "ADMIN".equals(a.getRole()) || a.getId().toString().equals(m.get("accountId")))
            .toList();
    return map(
        "membershipPlans",
        plans().stream()
            .filter(p -> "ADMIN".equals(a.getRole()) || Boolean.TRUE.equals(p.get("enabled")))
            .toList(),
        "memberships",
        members,
        "membershipPayments",
        receipts);
  }

  public boolean hasActiveMembership(UUID account) {
    if (account == null) return false;
    return docs.list("membership:").stream()
        .anyMatch(
            m ->
                account.toString().equals(m.get("accountId"))
                    && "ACTIVE".equals(status(m))
                    && !Instant.parse((String) m.get("startsAt")).isAfter(Instant.now())
                    && !Instant.parse((String) m.get("endsAt")).isBefore(Instant.now()));
  }

  public Map<String, Object> quote(UUID account, List<CourtSchedule> slots) {
    var member =
        docs.list("membership:").stream()
            .filter(
                m ->
                    account != null
                        && account.toString().equals(m.get("accountId"))
                        && "ACTIVE".equals(status(m))
                        && Instant.parse((String) m.get("startsAt")).isBefore(Instant.now()))
            .findFirst();
    BigDecimal
        gross =
            slots.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add),
        discount = BigDecimal.ZERO;
    if (member.isPresent()) {
      var m = member.get();
      for (var s : slots)
        if (!at(s.getScheduleDate(), s.getStartTime())
                .isBefore(Instant.parse((String) m.get("startsAt")))
            && !at(s.getScheduleDate(), s.getEndTime())
                .isAfter(Instant.parse((String) m.get("endsAt"))))
          discount =
              discount.add(
                  s.getPrice()
                      .multiply(PresentationService.decimal(s.getCourt().getName().toUpperCase(Locale.ROOT).startsWith("V") ? m.getOrDefault("vipDiscountPercent", "plus".equals(m.get("planId")) ? 10 : 5) : m.get("discountPercent")))
                      .divide(new BigDecimal("100"), 0, java.math.RoundingMode.HALF_UP));
    }
    return map(
        "gross",
        gross,
        "discount",
        discount,
        "net",
        gross.subtract(discount),
        "membershipId",
        discount.signum() > 0 ? member.get().get("id") : null,
        "planName",
        discount.signum() > 0 ? member.get().get("planName") : null,
        "discountPercent",
        discount.signum() > 0 ? member.get().get("discountPercent") : 0);
  }

  public void checkWindow(UUID account, List<CourtSchedule> slots) {
    var latest = slots.stream().map(s -> at(s.getScheduleDate(),s.getEndTime())).max(Comparator.naturalOrder()).orElseThrow();
    var member = docs.list("membership:").stream().filter(m -> account.toString().equals(m.get("accountId")) && "ACTIVE".equals(status(m)) && !Instant.parse((String)m.get("endsAt")).isBefore(latest)).findFirst();
    int days = member.map(m -> ((Number)m.getOrDefault("advanceDays", "plus".equals(m.get("planId")) ? 21 : 14)).intValue()).orElse(7);
    require(slots.stream().allMatch(s -> !s.getScheduleDate().isAfter(java.time.LocalDate.now(ZONE).plusDays(days))), "Khoảng đặt trước vượt quyền lợi hội viên ("+days+" ngày)");
  }

  public void consumeChange(UUID account, List<CourtSchedule> before, List<CourtSchedule> after) {
    docs.mutationLock();
    var member = docs.list("membership:").stream().filter(m -> account.toString().equals(m.get("accountId")) && "ACTIVE".equals(status(m))).findFirst();
    if (member.isEmpty()) return; // Guests continue to use the existing club change policy.
    var m = member.get();
    var start = before.stream().map(s -> at(s.getScheduleDate(),s.getStartTime())).min(Comparator.naturalOrder()).orElseThrow();
    require(start.isAfter(Instant.now().plusSeconds(86400)), "Quyền lợi đổi lịch cần báo trước ít nhất 24 giờ; liên hệ quầy");
    var oldMinutes = before.stream().mapToLong(s -> java.time.Duration.between(s.getStartTime(),s.getEndTime()).toMinutes()).sum();
    var newMinutes = after.stream().mapToLong(s -> java.time.Duration.between(s.getStartTime(),s.getEndTime()).toMinutes()).sum();
    require(oldMinutes == newMinutes && zone(before.get(0)).equals(zone(after.get(0))), "Đổi lịch hội viên cần cùng khu sân và thời lượng; liên hệ quầy");
    int used = ((Number)m.getOrDefault("rescheduleUsage",0)).intValue();
    int limit = ((Number)m.getOrDefault("freeChanges","plus".equals(m.get("planId")) ? 2 : 1)).intValue();
    require(used < limit, "Đã dùng hết lượt đổi lịch của gói; liên hệ quầy");
    require(after.stream().allMatch(s -> !at(s.getScheduleDate(),s.getEndTime()).isAfter(Instant.parse((String)m.get("endsAt")))), "Lịch mới vượt thời hạn gói; liên hệ quầy");
    m.put("rescheduleUsage",used+1);docs.put("membership:"+m.get("id"),m);
  }
  private String zone(CourtSchedule s) {var name=s.getCourt().getName().toUpperCase(Locale.ROOT);return name.startsWith("V")?"V":name.startsWith("B")?"B":"A";}

  public Map<String, Object> action(Account a, String method, String path, Map<String, Object> b) {
    require(
        path.equals("/api/membership/plans") ? method.equals("PUT") : method.equals("POST"),
        "Phương thức không hỗ trợ");
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        method + path,
        b,
        () -> {
          if (path.equals("/api/membership/plans")) {
            auth.admin(a);
            var all = new ArrayList<>(plans());
            String id = (String) b.get("id");
            require(all.stream().anyMatch(p -> p.get("id").equals(id)), "Gói không tồn tại");
            for (String key : List.of("price", "days", "discountPercent")) {
              var n = PresentationService.decimal(b.get(key));
              require(n.signum() > 0 && n.scale() <= 0, "Giá trị gói cần là số nguyên dương");
            }
            require(
                PresentationService.decimal(b.get("days")).intValue() <= 366
                    && PresentationService.decimal(b.get("discountPercent")).intValue() <= 50,
                "Giới hạn gói không hợp lệ");
            require(b.get("enabled") instanceof Boolean, "Trạng thái gói không hợp lệ");
            var p =
                map(
                    "id",
                    id,
                    "name",
                    text((String) b.get("name"), "Tên gói"),
                    "description",
                    text((String) b.get("description"), "Mô tả"),
                    "price",
                    b.get("price"),
                    "days",
                    b.get("days"),
                    "discountPercent",
                    b.get("discountPercent"),
                    "enabled",
                    b.get("enabled"));
            for (var old : all) docs.put("membership-plan:" + old.get("id"), old);
            docs.put("membership-plan:" + id, p);
            return map("id", id);
          }
          if (path.equals("/api/membership/requests")) {
            require(
                docs.list("membership:").stream()
                    .noneMatch(
                        m ->
                            a.getId().toString().equals(m.get("accountId"))
                                && Set.of("PENDING", "ACTIVE").contains(status(m))),
                "Bạn đã có gói đang hoạt động hoặc chờ xác nhận");
            var p =
                plans().stream()
                    .filter(
                        x ->
                            x.get("id").equals(b.get("planId"))
                                && Boolean.TRUE.equals(x.get("enabled")))
                    .findFirst()
                    .orElseThrow();
            String id = UUID.randomUUID().toString();
            docs.put(
                "membership:" + id,
                map(
                    "id",
                    id,
                    "accountId",
                    a.getId().toString(),
                    "name",
                    a.getFullName(),
                    "planId",
                    p.get("id"),
                    "planName",
                    p.get("name"),
                    "price",
                    p.get("price"),
                    "days",
                    p.get("days"),
                    "discountPercent",
                    p.get("discountPercent"),
                    "vipDiscountPercent", p.getOrDefault("vipDiscountPercent", "plus".equals(p.get("id")) ? 10 : 5),
                    "advanceDays", p.getOrDefault("advanceDays", "plus".equals(p.get("id")) ? 21 : 14),
                    "freeChanges", p.getOrDefault("freeChanges", "plus".equals(p.get("id")) ? 2 : 1),
                    "status",
                    "PENDING",
                    "createdAt",
                    Instant.now().toString()));
            return map("id", id);
          }
          String[] parts = path.split("/");
          String id = parts[4], operation = parts[5];
          oneOf(operation, "cancel", "activate");
          var m = docs.get("membership:" + id);
          require(!m.isEmpty(), "Đăng ký không tồn tại");
          if (!"ADMIN".equals(a.getRole()))
            require(
                a.getId().toString().equals(m.get("accountId")),
                "Đăng ký không thuộc tài khoản của bạn");
          require("PENDING".equals(m.get("status")), "Đăng ký đã xử lý");
          if (operation.equals("cancel")) {
            m.put("status", "CANCELLED");
            m.put("cancelledAt", Instant.now().toString());
            for (var transfer : docs.list("transfer:")) {
              if ("MEMBERSHIP".equals(transfer.get("type")) && id.equals(transfer.get("targetId"))) {
                transfer.put("status", PresentationService.decimal(transfer.get("received")).signum()>0 ? "REVIEW" : "CANCELLED");
                transfer.put("reviewAmount", PresentationService.decimal(transfer.get("reviewAmount")).add(PresentationService.decimal(transfer.get("received"))));
                docs.put("transfer:"+transfer.get("id"),transfer);
              }
            }
          } else {
            auth.admin(a);
            require(
                Boolean.TRUE.equals(b.get("collected"))
                    && PresentationService.decimal(b.get("amount"))
                            .compareTo(PresentationService.decimal(m.get("price")))
                        == 0,
                "Cần xác minh nhận đủ phí trước khi kích hoạt");
            oneOf((String) b.get("method"), "CASH", "BANK_TRANSFER");
            String code = text((String) b.get("transactionCode"), "Mã phiếu thu");
            require(
                payments.findByTransactionCode(code).isEmpty()
                    && docs.list("membership-payment:").stream()
                        .noneMatch(p -> code.equals(p.get("transactionCode"))),
                "Mã phiếu thu đã tồn tại");
            require(
                "ACTIVE"
                    .equals(
                        accounts
                            .findById(UUID.fromString((String) m.get("accountId")))
                            .orElseThrow()
                            .getStatus()),
                "Tài khoản đã bị khóa");
            m.put("status", "ACTIVE");
            m.put("startsAt", Instant.now().toString());
            m.put(
                "endsAt",
                Instant.now().plusSeconds(((Number) m.get("days")).longValue() * 86400).toString());
            String receipt = UUID.randomUUID().toString();
            docs.put(
                "membership-payment:" + receipt,
                map(
                    "id",
                    receipt,
                    "membershipId",
                    id,
                    "accountId",
                    m.get("accountId"),
                    "planName",
                    m.get("planName"),
                    "amount",
                    m.get("price"),
                    "method",
                    b.get("method"),
                    "transactionCode",
                    code,
                    "createdAt",
                    Instant.now().toString()));
            m.put("paymentId", receipt);
          }
          docs.put("membership:" + id, m);
          return map("id", id);
        });
  }
}
