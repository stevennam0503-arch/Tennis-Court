package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PresentationService {
  private final OverviewService overview;
  private final ScheduleService schedules;
  private final OrderService orders;
  private final DocumentService docs;
  private final ContentService content;
  private final AuthService auth;
  private final CustomerOrderRepository orderRepo;
  private final AccountRepository accounts;
  private final SettingsService settings;
  private final MembershipService membership;

  @Value("${courtly.seed-demo:false}")
  private boolean sample;

  public static BigDecimal decimal(Object v) {
    return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
  }

  private static List<Map<String, Object>> rows(Map<String, Object> m, String k) {
    return (List<Map<String, Object>>) m.getOrDefault(k, List.of());
  }

  private boolean same(Object a, Object b) {
    return a != null && b != null && a.toString().equals(b.toString());
  }

  public Map<String, Object> get(LocalDate date, Account viewer) {
    require(
        date != null
            && !date.isBefore(LocalDate.now(ZONE).minusYears(10))
            && !date.isAfter(LocalDate.now(ZONE).plusDays(90)),
        "Ngày ngoài khoảng hỗ trợ");
    docs.mutationLock();
    orders.expireHolds();
    schedules.generate(date);
    var v = overview.get(date);
    var regs = rows(v, "registrations");
    var tournaments = rows(v, "tournaments");
    for (var t : tournaments)
      t.put(
          "registeredCount",
          regs.stream()
              .filter(
                  r ->
                      same(r.get("tournamentId"), t.get("id"))
                          && !"CANCELLED".equals(r.get("status")))
              .count());
    for (var a : rows(v, "accounts")) {
      var account = accounts.findById(UUID.fromString(a.get("id").toString())).orElseThrow();
      a.put("loginLinked", account.getPasswordHash() != null);
      a.put("isOwner", auth.owner(account));
    }
    for (var o : rows(v, "orders")) {
      var entity = orderRepo.findById(UUID.fromString(o.get("id").toString())).orElseThrow();
      o.putAll(docs.decode(entity.getMetadata()));
      var receipts =
          rows(v, "payments").stream().filter(p -> same(p.get("orderId"), o.get("id"))).toList();
      var ids = receipts.stream().map(p -> p.get("id").toString()).toList();
      var gross =
          receipts.stream()
              .map(p -> decimal(p.get("amount")))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      var refunded =
          rows(v, "refunds").stream()
              .filter(r -> ids.contains(r.get("paymentId").toString()))
              .map(r -> decimal(r.get("amount")))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      var total = decimal(o.get("total"));
      var paid = decimal(o.get("paid"));
      boolean ended = Set.of("CANCELLED", "EXPIRED").contains(o.get("status"));
      var excess = paid.subtract(total).max(BigDecimal.ZERO);
      var review = o.get("financialReview");
      if (review == null && (excess.signum() > 0 || ended && paid.signum() > 0))
        review = "POLICY_REVIEW";
      o.put(
          "finance",
          map(
              "grossReceived",
              gross,
              "refunded",
              refunded,
              "netPaid",
              paid,
              "due",
              ended ? BigDecimal.ZERO : total.subtract(paid).max(BigDecimal.ZERO),
              "excess",
              excess,
              "refundPending",
              o.getOrDefault("refundPending", 0),
              "balanceNeedsReconciliation",
              gross.subtract(refunded).compareTo(paid) != 0,
              "review",
              review,
              "paymentStatus",
              refunded.signum() > 0
                  ? (paid.signum() == 0 ? "REFUNDED" : "PARTIAL_REFUND")
                  : paid.signum() == 0
                      ? "UNPAID"
                      : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL"));
    }
    ((Map<String, Object>) v.get("settings"))
        .put("policies", docs.decode(settings.get().getPolicies()));
    v.put("club", content.club());
    v.put("sample", sample);
    if (viewer == null) {
      require(!date.isBefore(LocalDate.now(ZONE)), "Chọn ngày hôm nay hoặc ngày sắp tới");
      return map(
          "membershipPlans",
          membership.plans().stream().filter(p -> Boolean.TRUE.equals(p.get("enabled"))).toList(),
          "club",
          content.club(),
          "sample",
          sample,
          "courts",
          v.get("courts"),
          "prices",
          v.get("prices"),
          "schedules",
          v.get("schedules"),
          "tournaments",
          tournaments.stream().filter(t -> !"DRAFT".equals(t.get("status"))).toList(),
          "settings",
          map(
              "holdMinutes",
              settings.get().getHoldMinutes(),
              "depositPercent",
              settings.get().getDepositPercent()),
          "orders",
          List.of(),
          "accounts",
          List.of(),
          "registrations",
          List.of(),
          "payments",
          List.of(),
          "refunds",
          List.of());
    }
    v.putAll(membership.view(viewer));
    v.put("viewer", auth.user(viewer));
    if ("ADMIN".equals(viewer.getRole())) return v;
    var mine =
        rows(v, "orders").stream().filter(o -> same(o.get("accountId"), viewer.getId())).toList();
    var mineRegs = regs.stream().filter(r -> same(r.get("accountId"), viewer.getId())).toList();
    var orderIds = mine.stream().map(o -> o.get("id").toString()).toList();
    var regIds = mineRegs.stream().map(r -> r.get("id").toString()).toList();
    var receipts =
        rows(v, "payments").stream()
            .filter(
                p ->
                    p.get("orderId") != null && orderIds.contains(p.get("orderId").toString())
                        || p.get("registrationId") != null
                            && regIds.contains(p.get("registrationId").toString()))
            .toList();
    var receiptIds = receipts.stream().map(p -> p.get("id").toString()).toList();
    v.put("orders", mine);
    v.put("registrations", mineRegs);
    v.put("payments", receipts);
    v.put(
        "refunds",
        rows(v, "refunds").stream()
            .filter(r -> receiptIds.contains(r.get("paymentId").toString()))
            .toList());
    v.put(
        "accounts",
        List.of(
            map(
                "id",
                viewer.getId(),
                "name",
                viewer.getFullName(),
                "email",
                viewer.getEmail(),
                "phone",
                viewer.getPhone(),
                "role",
                viewer.getRole(),
                "status",
                viewer.getStatus())));
    v.put(
        "tournaments", tournaments.stream().filter(t -> !"DRAFT".equals(t.get("status"))).toList());
    for (String key : List.of("staff", "staffSchedules", "products", "matches", "audit"))
      v.put(key, List.of());
    return v;
  }

  public void history(CustomerOrder o, String type, Map<String, Object> before) {
    var extra = docs.decode(o.getMetadata());
    var history =
        (List<Map<String, Object>>) extra.computeIfAbsent("history", k -> new ArrayList<>());
    var current = overview.order(o);
    var event =
        map(
            "id",
            UUID.randomUUID(),
            "type",
            type,
            "at",
            java.time.Instant.now(),
            "date",
            current.get("date"),
            "slots",
            current.get("slots"),
            "staff",
            current.get("staff"),
            "total",
            o.getTotalAmount(),
            "status",
            o.getStatus());
    if (before != null) event.put("previous", before);
    history.add(event);
    o.setMetadata(docs.encode(extra));
  }
}
