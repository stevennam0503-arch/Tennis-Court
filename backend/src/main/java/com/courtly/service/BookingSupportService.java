package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class BookingSupportService {
  private final CourtScheduleRepository schedules;
  private final StaffRepository staff;
  private final StaffScheduleRepository shifts;
  private final CustomerOrderRepository orders;
  private final BookingStaffRepository bookingStaff;
  private final OrderService service;
  private final ScheduleService scheduling;
  private final OverviewService views;
  private final SettingsService settings;
  private final MembershipService membership;
  private final VoucherService vouchers;
  private final DocumentService documents;

  public void owns(Account a, UUID id) {
    var o = orders.findById(id).orElseThrow();
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())
        && (o.getCustomerAccount() == null || !o.getCustomerAccount().getId().equals(a.getId())))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Đơn không thuộc tài khoản của bạn");
  }

  public List<CourtSchedule> selected(List<UUID> ids) {
    require(
        ids != null
            && !ids.isEmpty()
            && ids.size() <= 48
            && new HashSet<>(ids).size() == ids.size(),
        "Chọn các slot khác nhau");
    return ids.stream().map(id -> schedules.findById(id).orElseThrow()).toList();
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a) {
    return options(ids, exclude, a, a.getId(), null);
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a, UUID account) {
    return options(ids, exclude, a, account, null);
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a, UUID account, String voucherCode) {
    return options(ids, exclude, a, account, voucherCode, 1);
  }

  public Map<String, Object> options(List<UUID> ids, UUID exclude, Account a, UUID account, String voucherCode, Integer recurringWeeks) {
    if (exclude != null) owns(a, exclude);
    var rows = selected(ids);
    service.future(rows);
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) membership.checkWindow(a.getId(),rows);
    require(
        rows.stream().map(CourtSchedule::getScheduleDate).distinct().count() == 1,
        "Các slot phải cùng ngày");
    var own =
        exclude == null
            ? Set.<UUID>of()
            : service.allocated(service.booking(orders.findById(exclude).orElseThrow())).stream()
                .map(CourtSchedule::getId)
                .collect(java.util.stream.Collectors.toSet());
    var conflict = new ArrayList<Map<String, Object>>();
    for (var s : rows)
      if (!"ACTIVE".equals(s.getCourt().getStatus())
          || !"AVAILABLE".equals(s.getStatus()) && !own.contains(s.getId()))
        conflict.add(
            map("scheduleId", s.getId(), "message", "Slot vừa được đặt hoặc đang bị khóa"));

    if (recurringWeeks != null && recurringWeeks > 1) {
      java.time.LocalDate baseDate = rows.get(0).getScheduleDate();
      for (int w = 1; w < recurringWeeks; w++) {
        java.time.LocalDate targetDate = baseDate.plusWeeks(w);
        scheduling.generate(targetDate);
        for (var s : rows) {
          var matched = schedules.findByCourtIdAndScheduleDate(s.getCourt().getId(), targetDate).stream()
              .filter(x -> x.getStartTime().equals(s.getStartTime()) && x.getEndTime().equals(s.getEndTime()))
              .findFirst();
          if (matched.isEmpty() || !"ACTIVE".equals(matched.get().getCourt().getStatus()) || !"AVAILABLE".equals(matched.get().getStatus())) {
            conflict.add(map(
                "scheduleId", s.getId(),
                "message", "Tuần " + (w + 1) + " (" + targetDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM")) + ") khung giờ " + s.getStartTime() + " đã có người đặt hoặc đang bảo trì"
            ));
          }
        }
      }
    }
    var slotViews =
        rows.stream()
            .map(
                s ->
                    map(
                        "id",
                        s.getId(),
                        "court",
                        s.getCourt().getId(),
                        "start", s.getStartTime(), "end", s.getEndTime(),
                        "hour",
                        s.getStartTime().getHour() + s.getStartTime().getMinute() / 60.0,
                        "price",
                        s.getPrice()))
            .toList();
    var staffRows = new ArrayList<Map<String, Object>>();
    var old =
        exclude == null
            ? List.<BookingStaff>of()
            : bookingStaff.findByBookingId(
                service.booking(orders.findById(exclude).orElseThrow()).getId());
    for (var s : rows) {
      var people = new ArrayList<Map<String, Object>>();
      for (var p : staff.findAll())
        if ("REFEREE".equals(p.getType()) && "ACTIVE".equals(p.getStatus())) {
          boolean free =
              shifts.findByStaffIdAndWorkDate(p.getId(), s.getScheduleDate()).stream()
                  .anyMatch(
                      x ->
                          x.getStartTime().equals(s.getStartTime()) && x.getEndTime().equals(s.getEndTime())
                              && ("AVAILABLE".equals(x.getStatus())
                                  || old.stream()
                                      .anyMatch(
                                          link ->
                                              link.getReleasedAt() == null
                                                  && link.getStaffSchedule()
                                                      .getId()
                                                      .equals(x.getId()))));
          people.add(
              map(
                  "id",
                  p.getId(),
                  "name",
                  p.getFullName(),
                  "level", p.getLevel(),
                  "rate",
                  p.getHourlyRate(),
                  "available",
                  free));
        }
      staffRows.add(map("scheduleId", s.getId(), "staff", people));
    }
    BigDecimal courtTotal = rows.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (recurringWeeks != null && recurringWeeks > 1) {
      courtTotal = courtTotal.multiply(BigDecimal.valueOf(recurringWeeks));
    }
    Map<String, Object> voucherBenefit = null;
    if (voucherCode != null && !voucherCode.isBlank()) {
      voucherBenefit = vouchers.calculate(voucherCode, courtTotal, account);
    }
    return map(
        "courtQuote",
        membership.quote(account, rows),
        "recurringWeeks",
        recurringWeeks == null ? 1 : recurringWeeks,
        "date",
        rows.get(0).getScheduleDate(),
        "slots",
        slotViews,
        "conflicts",
        conflict,
        "staffSlots",
        staffRows,
        "voucherBenefit",
        voucherBenefit,
        "availableVouchers",
        vouchers.evaluateAll(courtTotal, account));
  }

  public Map<String, Object> preview(UUID id, MoveBookingRequest r, Account a) {
    owns(a, id);
    var o = orders.findById(id).orElseThrow();
    require(
        Set.of("HOLDING", "CONFIRMED", "EXPIRED", "CANCELLED").contains(o.getStatus()),
        "Đơn không thể đổi lịch");
    var opt = options(r.scheduleIds(), id, a);
    require(((List<?>) opt.get("conflicts")).isEmpty(), "Lịch mới có slot không khả dụng");
    var rows = selected(r.scheduleIds());
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole())) service.continuous(rows);
    BigDecimal
        court = rows.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add),
        staffCost = BigDecimal.ZERO;
    var staffView = new ArrayList<Map<String, Object>>();
    Set<UUID> seen = new HashSet<>();
    Set<String> booked = new HashSet<>();
    require(r.assignments() != null, "Chọn lại trọng tài theo slot");
    for (var assign : r.assignments()) {
      var slot =
          rows.stream()
              .filter(s -> s.getId().equals(assign.scheduleId()))
              .findFirst()
              .orElseThrow();
      require(seen.add(slot.getId()), "Mỗi slot chỉ chọn một trọng tài");
      require(
          booked.add(assign.staffId() + ":" + slot.getStartTime()),
          "Trọng tài trùng giờ giữa các sân");
      var options = (List<Map<String, Object>>) opt.get("staffSlots");
      var sr =
          options.stream()
              .filter(x -> x.get("scheduleId").equals(slot.getId()))
              .findFirst()
              .orElseThrow();
      var st =
          ((List<Map<String, Object>>) sr.get("staff"))
              .stream()
                  .filter(
                      x ->
                          x.get("id").equals(assign.staffId())
                              && Boolean.TRUE.equals(x.get("available")))
                  .findFirst()
                  .orElseThrow();
      staffCost = staffCost.add(PresentationService.decimal(st.get("rate")).multiply(hours(slot.getStartTime(), slot.getEndTime())));
      staffView.add(
          map(
              "scheduleId",
              slot.getId(),
              "name",
              st.get("name"),
              "rate",
              st.get("rate"),
              "hours",
              hours(slot.getStartTime(), slot.getEndTime())));
    }
    var old = views.order(o);
    boolean restoring = Set.of("EXPIRED", "CANCELLED").contains(o.getStatus());
    var sourceDate = restoring ? null : service.visitDate(o, null);
    // Completed allocations remain billable even when the replacement visit has the same date.
    var retained = ((List<Map<String,Object>>) old.get("slots")).stream()
        .filter(slot -> Boolean.TRUE.equals(slot.get("completed"))
            || !restoring && !sourceDate.toString().equals(slot.get("date").toString())).toList();
    require(rows.stream().noneMatch(row -> retained.stream().anyMatch(slot -> row.getId().toString().equals(slot.get("id").toString()))), "Lịch mới trùng một buổi khác của đơn");
    var allRows = new ArrayList<>(rows);
    retained.forEach(slot -> allRows.add(schedules.findById(UUID.fromString(slot.get("id").toString())).orElseThrow()));
    var retainedStaff = ((List<Map<String,Object>>) old.get("staff")).stream()
        .filter(line -> Boolean.TRUE.equals(line.get("completed"))
            || !restoring && !sourceDate.toString().equals(line.get("date").toString())).toList();
    for (var line : retainedStaff) staffCost = staffCost.add(PresentationService.decimal(line.get("rate")).multiply(PresentationService.decimal(line.get("hours"))));
    staffView.addAll(retainedStaff);
    var products = (List<Map<String, Object>>) old.get("products");
    BigDecimal extras =
        products.stream()
            .map(p -> PresentationService.decimal(p.get("lineTotal")))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    var benefit =
        membership.quote(
            o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(), allRows);
    BigDecimal gross = court.add(retained.stream().map(slot -> PresentationService.decimal(slot.get("price")))
        .reduce(BigDecimal.ZERO, BigDecimal::add));
    Object voucher = documents.decode(o.getMetadata()).get("voucherBenefit");
    if (restoring && voucher instanceof Map<?, ?> v && v.get("code") != null)
      voucher = vouchers.previewRestore(v.get("code").toString(), o, gross);
    BigDecimal total = OrderTotalsService.discountedTotal(gross.add(staffCost).add(extras), benefit, voucher);
    var next = new LinkedHashMap<>(old);
    var nextSlots = new ArrayList<Map<String,Object>>((List<Map<String,Object>>) opt.get("slots"));
    nextSlots.forEach(slot -> slot.put("date", rows.get(0).getScheduleDate()));
    nextSlots.addAll(retained);
    next.put("slots", nextSlots);
    next.put("date", opt.get("date"));
    next.put("staff", staffView);
    next.put("total", total);
    next.put("membershipBenefit", benefit);
    next.put("voucherBenefit", voucher);
    next.put(
        "deposit",
        Set.of("ADMIN", "STAFF").contains(a.getRole())
            ? total.multiply(BigDecimal.valueOf(settings.get().getDepositPercent())).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)
            : OrderTotalsService.discountedTotal(gross, benefit, voucher).multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.HALF_UP));
    return map(
        "next",
        next,
        "previous",
        old,
        "difference",
        total.subtract(o.getTotalAmount()),
        "additionalDue",
        total.subtract(o.getPaidAmount()).max(BigDecimal.ZERO),
        "reviewAmount",
        o.getPaidAmount().subtract(total).max(BigDecimal.ZERO));
  }
}
