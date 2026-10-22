package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
@Transactional
public class OrderApplicationService {
  private final OrderService service;
  private final AuthService auth;
  private final RequestService requests;
  private final PresentationService presentation;
  private final BookingSupportService support;
  private final DocumentService docs;
  private final OverviewService views;
  private final OrderProductRepository products;
  private final ObjectMapper mapper;
  private final jakarta.validation.Validator validator;
  private final SettingsService settings;
  private final MembershipService memberships;

  public Map<String, Object> create(BookingRequest r, Account actor) {
    var a = actor;
    require(r.requestId() != null && !r.requestId().isBlank(), "Thiếu mã yêu cầu");
    return requests.execute(
        a.getId(),
        r.requestId(),
        "create-order",
        r,
        () -> {
          service.expireHolds();
          BookingRequest effective = r;
          if (!"ADMIN".equals(a.getRole())) {
            require(
                r.accountId() == null || r.accountId().equals(a.getId()),
                "Chỉ được đặt cho tài khoản của mình");
            service.continuous(support.selected(r.scheduleIds()));
            memberships.checkWindow(a.getId(), support.selected(r.scheduleIds()));
            effective =
                new BookingRequest(
                    a.getFullName(),
                    a.getPhone(),
                    a.getId(),
                    r.scheduleIds(),
                    r.assignments(),
                    r.requestId());
          }
          UUID id = service.create(effective);
          var o = service.lock(id);
          o.setCreatedByAccount(a);
          if (!"ADMIN".equals(a.getRole())) {
            var meta = docs.decode(o.getMetadata());
            meta.put("customerFlow", true);
            o.setMetadata(docs.encode(meta));
            customerDeposit(o);
          }
          presentation.history(o, "CREATED", null);
          return map("id", id);
        });
  }

  public Map<String, Object> options(Map<String, Object> b, Account actor) {
    return support.options(
        ids(b.get("scheduleIds")),
        b.get("excludeId") == null ? null : UUID.fromString(b.get("excludeId").toString()),
        actor,
        "ADMIN".equals(actor.getRole())
            ? (b.get("accountId") == null ? null : UUID.fromString(b.get("accountId").toString()))
            : actor.getId());
  }

  private List<UUID> ids(Object value) {
    require(value instanceof List<?>, "Chọn các khung giờ");
    return ((List<?>) value).stream().map(x -> UUID.fromString(x.toString())).toList();
  }

  private List<StaffAssignment> assignments(Map<String, Object> b) {
    return b.get("assignments") == null
        ? List.of()
        : ((List<?>) b.get("assignments"))
            .stream().map(x -> dto(x, StaffAssignment.class)).toList();
  }

  private void customerPolicy(Account a, CustomerOrder o, String action) {
    if ("ADMIN".equals(a.getRole())) return;
    require(
        Set.of("HOLDING", "CONFIRMED").contains(o.getStatus()), "Chỉ thay đổi trước khi check-in");
    service.future(service.allocated(service.booking(o)));
    if ("HOLDING".equals(o.getStatus())) return;
    var p = docs.decode(settings.get().getPolicies());
    var configured = p.get(action + "CutoffMinutes");
    long cutoff = configured instanceof Number n ? n.longValue() : 1440;
    var start = service.allocated(service.booking(o)).stream()
        .map(s -> at(s.getScheduleDate(), s.getStartTime()))
        .min(Comparator.naturalOrder()).orElseThrow();
    require(!start.isBefore(Instant.now().plusSeconds(cutoff * 60)),
        "Đã qua hạn đổi/hủy; liên hệ quầy");
  }

  public Map<String, Object> cancellationPreview(UUID id, Account actor) {
    support.owns(actor, id);
    var o = service.lock(id);
    customerPolicy(actor, o, "cancel");
    var percent = settings.get().getCancelRefundPercent();
    var refund = o.getPaidAmount().multiply(java.math.BigDecimal.valueOf(percent))
        .divide(java.math.BigDecimal.valueOf(100), 0, java.math.RoundingMode.HALF_UP);
    return map("paid", o.getPaidAmount(), "refundPercent", percent, "refundAmount", refund,
        "retainedAmount", o.getPaidAmount().subtract(refund),
        "status", refund.signum() > 0 ? "REFUND_PENDING" : "NO_REFUND",
        "requestedAt", Instant.now().toString());
  }

  public Map<String, Object> preview(UUID id, Map<String, Object> b, Account actor) {
    var a = actor;
    customerPolicy(a, service.lock(id), "change");
    return support.preview(
        id,
        new MoveBookingRequest(
            ids(b.get("scheduleIds")),
            assignments(b),
            (String) b.get("reason"),
            (String) b.get("requestId")),
        a);
  }

  public Map<String, Object> move(UUID id, Map<String, Object> b, Account actor) {
    var a = actor;
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        "move:" + id,
        b,
        () -> {
          support.owns(a, id);
          var o = service.lock(id);
          customerPolicy(a, o, "change");
          if (!"ADMIN".equals(a.getRole())) memberships.checkWindow(a.getId(), support.selected(ids(b.get("scheduleIds"))));
          if ("ADMIN".equals(a.getRole())) text((String) b.get("reason"), "Lý do đổi lịch");
          var old = views.order(o);
          var r =
              new MoveBookingRequest(
                  ids(b.get("scheduleIds")),
                  assignments(b),
                  (String) b.get("reason"),
                  (String) b.get("requestId"));
          var preview = support.preview(id, r, a);
          if (b.get("expectedTotal") != null)
            require(PresentationService.decimal(((Map<?, ?>) preview.get("next")).get("total"))
                .compareTo(PresentationService.decimal(b.get("expectedTotal"))) == 0,
                "Giá đã thay đổi; vui lòng xem trước lịch mới lại");
          if (!"ADMIN".equals(a.getRole()) && "CONFIRMED".equals(o.getStatus())) memberships.consumeChange(a.getId(), service.allocated(service.booking(o)), support.selected(r.scheduleIds()));
          service.move(id, r);
          if (!"ADMIN".equals(a.getRole())) customerDeposit(o);
          var extra = docs.decode(o.getMetadata());
          var excess = o.getPaidAmount().subtract(o.getTotalAmount()).max(java.math.BigDecimal.ZERO);
          extra.put("refundPending", excess);
          extra.put("financialReview", excess.signum() > 0 ? "REFUND_PENDING" : null);
          o.setMetadata(docs.encode(extra));
          presentation.history(o, "SCHEDULE", old);
          return map("id", id);
        });
  }

  public Map<String, Object> action(
      UUID id, String action, Map<String, Object> body, Account actor) {
    var b = body == null ? Map.<String, Object>of() : body;
    var a = actor;
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        action + ":" + id,
        b,
        () -> {
          support.owns(a, id);
          var o = service.lock(id);
          var before = views.order(o);
          switch (action) {
            case "cancel" -> {
              customerPolicy(a, o, "cancel");
              if ("ADMIN".equals(a.getRole())) text((String) b.get("reason"), "Lý do hủy");
              var settlement = cancellationPreview(id, a);
              service.cancel(id);
              var extra = docs.decode(o.getMetadata());
              extra.put("cancellationSettlement", settlement);
              extra.put("refundPending", settlement.get("refundAmount"));
              extra.put("financialReview", PresentationService.decimal(settlement.get("refundAmount")).signum() > 0 ? "REFUND_PENDING" : null);
              o.setMetadata(docs.encode(extra));
            }
            case "check-in" -> {
              var early = docs.decode(settings.get().getPolicies()).get("checkInEarlyMinutes");
              var slots = service.allocated(service.booking(o));
              var start =
                  slots.stream()
                      .map(s -> at(s.getScheduleDate(), s.getStartTime()))
                      .min(Comparator.naturalOrder())
                      .orElseThrow();
              var end =
                  slots.stream()
                      .map(s -> at(s.getScheduleDate(), s.getEndTime()))
                      .max(Comparator.naturalOrder())
                      .orElseThrow();
              if (!(early instanceof Number n)
                  || Instant.now().isBefore(start.minusSeconds(((Number) early).longValue() * 60))
                  || !Instant.now().isBefore(end)
                  || o.getPaidAmount().compareTo(o.getDepositRequired()) < 0)
                text((String) b.get("reason"), "Lý do check-in ngoại lệ");
              service.checkIn(id);
            }
            case "check-out" -> service.checkOut(id);
            case "legacy-staff" ->
                service.verifyLegacy(
                    id,
                    UUID.fromString(b.get("lineId").toString()),
                    ids(b.get("scheduleIds")),
                    (String) b.get("reason"));
            case "invoice" -> {
              service.invoice(id);
              var extra = docs.decode(o.getMetadata());
              var snapshot = views.order(o);
              snapshot.putAll(extra);
              snapshot.remove("invoiceSnapshot");
              extra.putIfAbsent("invoiceSnapshot", snapshot);
              o.setMetadata(docs.encode(extra));
            }
            case "products" -> service.addProduct(id, dto(b, AddProductRequest.class));
            case "staff" -> service.exactStaff(id, assignments(b));
            case "services" -> {
              require(b.get("rentals") instanceof List<?>, "Chọn thiết bị tại quầy");
              for (var value : (List<?>) b.get("rentals")) {
                var item = new LinkedHashMap<>((Map<String, Object>) value);
                item.put("type", "RENTAL");
                service.addProduct(id, dto(item, AddProductRequest.class));
              }
            }
            case "review", "refund-request" -> {
              text((String) b.get("reason"), "Lý do đối chiếu");
              var extra = docs.decode(o.getMetadata());
              if (action.equals("refund-request")) {
                var n = positive(PresentationService.decimal(b.get("amount")));
                require(n.compareTo(o.getPaidAmount()) <= 0, "Số hoàn dự kiến vượt tiền còn giữ");
                extra.put("refundPending", n);
                extra.put("financialReview", "REFUND_PENDING");
              } else
                extra.put(
                    "financialReview",
                    Boolean.TRUE.equals(b.get("resolved")) ? null : "MANUAL_REVIEW");
              o.setMetadata(docs.encode(extra));
            }
            case "restore" -> {
              text((String) b.get("reason"), "Lý do khôi phục");
              service.restore(
                  id,
                  new MoveBookingRequest(
                      ids(b.get("scheduleIds")),
                      assignments(b),
                      (String) b.get("reason"),
                      (String) b.get("requestId")));
            }
            default ->
                throw new com.courtly.exception.BusinessException(
                    "Thao tác chưa được hỗ trợ: " + action);
          }
          presentation.history(
              o, action.toUpperCase(Locale.ROOT), Set.of("restore", "cancel").contains(action) ? before : null);
          return map("id", id);
        });
  }

  public Map<String, Object> returned(UUID id, UUID lineId, Map<String, Object> b, Account actor) {
    var a = actor;
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        "return:" + lineId,
        b,
        () -> {
          service.returned(
              id, lineId, (String) b.getOrDefault("condition", "GOOD"), (String) b.get("reason"));
          presentation.history(service.lock(id), "RETURN", null);
          return map("id", id);
        });
  }

  public Map<String, Object> services(UUID id, Account actor) {
    auth.admin(actor);
    return service.services(id);
  }

  private void customerDeposit(CustomerOrder o) {
    var benefit = (Map<String,Object>) docs.decode(o.getMetadata()).get("membershipBenefit");
    var net = benefit == null ? o.getTotalAmount() : PresentationService.decimal(benefit.get("net"));
    o.setDepositRequired(net.multiply(new java.math.BigDecimal("0.5")).setScale(0, java.math.RoundingMode.HALF_UP));
  }

  private <T> T dto(Object value, Class<T> type) {
    var result = mapper.convertValue(value, type);
    var errors = validator.validate(result);
    require(
        errors.isEmpty(),
        errors.stream()
            .map(e -> e.getPropertyPath() + ": " + e.getMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ"));
    return result;
  }
}
