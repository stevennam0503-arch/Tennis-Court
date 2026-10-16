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
    return List.of(
        map(
            "id",
            "club",
            "name",
            "Club",
            "price",
            299000,
            "days",
            30,
            "discountPercent",
            10,
            "enabled",
            true,
            "description",
            "Cho nhịp chơi đều đặn."),
        map(
            "id",
            "plus",
            "name",
            "Plus",
            "price",
            599000,
            "days",
            30,
            "discountPercent",
            15,
            "enabled",
            true,
            "description",
            "Dành cho người mê tennis."));
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
                      .multiply(PresentationService.decimal(m.get("discountPercent")))
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
