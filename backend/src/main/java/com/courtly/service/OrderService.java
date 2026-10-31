package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrderService {
  private final CustomerOrderRepository orders;
  private final AccountRepository accounts;
  private final BookingRepository bookings;
  private final BookingSlotRepository slots;
  private final BookingStaffRepository bookingStaff;
  private final CourtScheduleRepository schedules;
  private final StaffScheduleRepository staffSchedules;
  private final ScheduleService scheduling;
  private final SettingsService settings;
  private final OrderTotalsService totals;
  private final AuditService audit;
  private final DocumentService documents;
  private final MembershipService membership;
  private final VoucherService vouchers;

  @Transactional
  public UUID create(BookingRequest request) {
    Integer weeks = request.recurringWeeks() == null ? 1 : request.recurringWeeks();
    require(weeks >= 1 && weeks <= 12, "Số tuần định kỳ không hợp lệ (từ 1 đến 12 tuần)");

    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    future(selected);

    List<CourtSchedule> allSlots = new ArrayList<>(selected);
    LocalDate baseDate = selected.get(0).getScheduleDate();

    if (weeks > 1) {
      for (int w = 1; w < weeks; w++) {
        LocalDate targetDate = baseDate.plusWeeks(w);
        scheduling.generate(targetDate);
        for (CourtSchedule baseSlot : selected) {
          CourtSchedule futureSlot = schedules
              .findByCourtIdAndScheduleDate(baseSlot.getCourt().getId(), targetDate)
              .stream()
              .filter(s -> s.getStartTime().equals(baseSlot.getStartTime()) && s.getEndTime().equals(baseSlot.getEndTime()))
              .findFirst()
              .orElseThrow(() -> new BusinessException("Không tìm thấy khung giờ " + baseSlot.getStartTime() + " ngày " + targetDate));

          futureSlot = schedules.findForUpdate(futureSlot.getId())
              .orElseThrow(() -> new BusinessException("Không tìm thấy khung giờ ngày " + targetDate));

          if (!"ACTIVE".equals(futureSlot.getCourt().getStatus())) {
            throw new BusinessException("Sân " + futureSlot.getCourt().getName() + " tạm dừng hoạt động vào tuần " + (w + 1) + " (ngày " + targetDate + ")");
          }
          if (!"AVAILABLE".equals(futureSlot.getStatus())) {
            throw new BusinessException("Khung giờ " + futureSlot.getStartTime() + " - " + futureSlot.getEndTime() + " sân " + futureSlot.getCourt().getName() + " vào tuần " + (w + 1) + " (ngày " + targetDate + ") đã có người đặt hoặc đang bảo trì");
          }
          allSlots.add(futureSlot);
        }
      }
    }

    CustomerOrder order = new CustomerOrder();
    if (request.accountId() != null) {
      Account account =
          accounts
              .findById(request.accountId())
              .orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
      require("ACTIVE".equals(account.getStatus()), "Tài khoản đã khóa");
      order.setCustomerAccount(account);
      order.setCustomerName(
          request.name() == null || request.name().isBlank()
              ? account.getFullName()
              : text(request.name(), "Tên khách"));
      order.setCustomerPhone(request.phone() == null ? account.getPhone() : request.phone());
    } else {
      order.setCustomerName(text(request.name(), "Tên khách"));
      order.setCustomerPhone(request.phone() == null ? "" : request.phone());
    }
    order.setHoldExpiresAt(Instant.now().plusSeconds(settings.get().getHoldMinutes() * 60L));
    orders.save(order);
    Booking booking = new Booking();
    booking.setOrder(order);
    bookings.save(booking);
    allocate(booking, allSlots, "LOCKED");
    assignExact(booking, selected, request.assignments());
    quote(order, allSlots);
    applyVoucher(order, request.voucherCode(), allSlots);
    totals.recalculate(order);
    order.setDepositRequired(
        depositBase(order)
            .multiply(BigDecimal.valueOf(depositPercent(order)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    if (weeks > 1) {
      var meta = documents.decode(order.getMetadata());
      meta.put("recurringWeeks", weeks);
      meta.put("recurringType", "WEEKLY");
      meta.put("recurringSummary", "Định kỳ " + weeks + " tuần (" + baseDate + " đến " + baseDate.plusWeeks(weeks - 1) + ")");
      order.setMetadata(documents.encode(meta));
    }
    audit.log("TẠO ĐƠN", order.getId().toString() + (weeks > 1 ? " [ĐỊNH KỲ " + weeks + " TUẦN]" : ""));
    return order.getId();
  }

  private int depositPercent(CustomerOrder o) {
    return Boolean.TRUE.equals(documents.decode(o.getMetadata()).get("customerFlow")) ? 50 : settings.get().getDepositPercent();
  }

  private BigDecimal depositBase(CustomerOrder o) {
    var metadata = documents.decode(o.getMetadata());
    if (Boolean.TRUE.equals(metadata.get("customerFlow")) && metadata.get("membershipBenefit") instanceof Map<?,?> benefit) {
      var net = PresentationService.decimal(benefit.get("net"));
      if (metadata.get("voucherBenefit") instanceof Map<?,?> voucher) {
        net = net.subtract(PresentationService.decimal(voucher.get("discount"))).max(BigDecimal.ZERO);
      }
      return net;
    }
    return o.getTotalAmount();
  }

  private void applyVoucher(CustomerOrder o, String voucherCode, List<CourtSchedule> selected) {
    if (voucherCode == null || voucherCode.isBlank()) return;
    BigDecimal courtTotal = selected.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    var extra = documents.decode(o.getMetadata());
    UUID accountId = o.getCustomerAccount() != null ? o.getCustomerAccount().getId() : null;
    var voucherBenefit = vouchers.redeem(voucherCode, o, courtTotal, accountId);
    if (voucherBenefit != null) {
      extra.put("voucherBenefit", voucherBenefit);
      o.setMetadata(documents.encode(extra));
    }
  }

  public CustomerOrder lock(UUID id) {
    return orders.findForUpdate(id).orElseThrow(() -> new BusinessException("Không tìm thấy đơn"));
  }

  public Booking booking(CustomerOrder order) {
    return bookings.findByOrderId(order.getId()).stream().findFirst().orElseThrow();
  }

  public List<CourtSchedule> allocated(Booking b) {
    return slots.findByBookingId(b.getId()).stream()
        .filter(x -> x.getReleasedAt() == null)
        .map(BookingSlot::getSchedule)
        .toList();
  }

  private List<CourtSchedule> pricedSlots(Booking b) {
    return slots.findByBookingId(b.getId()).stream()
        .filter(x -> x.getReleasedAt() == null || x.getCompletedAt() != null)
        .map(BookingSlot::getSchedule).toList();
  }

  public BigDecimal unusedPaid(CustomerOrder order) {
    var b = booking(order);
    BigDecimal gross = BigDecimal.ZERO, completed = BigDecimal.ZERO;
    for (var link : slots.findByBookingId(b.getId())) {
      if (link.getReleasedAt() == null || link.getCompletedAt() != null) gross = gross.add(link.getUnitPrice());
      if (link.getCompletedAt() != null) completed = completed.add(link.getUnitPrice());
    }
    var meta = documents.decode(order.getMetadata());
    BigDecimal discounts = BigDecimal.ZERO;
    for (var key : List.of("membershipBenefit", "voucherBenefit"))
      if (meta.get(key) instanceof Map<?, ?> benefit) discounts = discounts.add(PresentationService.decimal(benefit.get("discount")));
    if (gross.signum() > 0) completed = completed.subtract(discounts.multiply(completed).divide(gross, 2, RoundingMode.HALF_UP)).max(BigDecimal.ZERO);
    for (var link : bookingStaff.findByBookingId(b.getId()))
      if (link.getCompletedAt() != null) completed = completed.add(link.getUnitPrice().multiply(hours(link.getStaffSchedule().getStartTime(), link.getStaffSchedule().getEndTime())));
    return order.getPaidAmount().subtract(completed).max(BigDecimal.ZERO);
  }

  private void live(CustomerOrder order) {
    require(active(order.getStatus()), "Đơn đã kết thúc");
    require(
        !"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()),
        "Đơn đã hết thời gian giữ chỗ");
  }

  private void allocate(Booking booking, List<CourtSchedule> selected, String status) {
    for (CourtSchedule slot : selected) {
      slot.setStatus(status);
      BookingSlot row = new BookingSlot();
      row.setBooking(booking);
      row.setSchedule(slot);
      row.setUnitPrice(slot.getPrice());
      slots.save(row);
    }
  }

  private void release(Booking booking) {
    releaseVisit(booking, null, false);
  }

  private void releaseVisit(Booking booking, LocalDate date, boolean completed) {
    Instant releasedAt = Instant.now();
    for (BookingSlot link :
        slots.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null || date != null && !date.equals(link.getSchedule().getScheduleDate())) continue;
      if (completed) link.setCompletedAt(releasedAt);
      CourtSchedule slot = schedules.findForUpdate(link.getSchedule().getId()).orElseThrow();
      slot.setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
    for (BookingStaff link :
        bookingStaff.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getStaffSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null || date != null && !date.equals(link.getStaffSchedule().getWorkDate())) continue;
      if (completed) link.setCompletedAt(releasedAt);
      staffSchedules
          .findForUpdate(link.getStaffSchedule().getId())
          .orElseThrow()
          .setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
  }

  @Transactional
  public void cancel(UUID id) {
    CustomerOrder order = lock(id);
    require(active(order.getStatus()), "Đơn đã kết thúc");
    order.setStatus("CANCELLED");
    Booking b = booking(order);
    b.setStatus("CANCELLED");
    release(b);
    // Played visits have consumed the benefit; cancelling later visits must not return its use.
    if (slots.findByBookingId(b.getId()).stream().noneMatch(x -> x.getCompletedAt() != null))
      vouchers.release(id);
    audit.log("HỦY ĐƠN", id.toString());
  }

  public LocalDate visitDate(CustomerOrder order, LocalDate requested) {
    var dates = allocated(booking(order)).stream().map(CourtSchedule::getScheduleDate)
        .distinct().sorted().toList();
    require(!dates.isEmpty(), "Đơn không còn buổi chơi chưa hoàn tất");
    var activeDate = documents.decode(order.getMetadata()).get("activeVisitDate");
    if ("CHECKED_IN".equals(order.getStatus()) && activeDate != null)
      return LocalDate.parse(activeDate.toString());
    var date = requested != null ? requested : dates.get(0);
    require(dates.contains(date), "Ngày không thuộc buổi chơi còn lại của đơn");
    return date;
  }

  @Transactional
  public void checkIn(UUID id) { checkIn(id, null); }

  @Transactional
  public void checkIn(UUID id, LocalDate requestedDate) {
    CustomerOrder order = lock(id);
    require("CONFIRMED".equals(order.getStatus()), "Đơn chưa được xác nhận");
    var date = visitDate(order, requestedDate);
    order.setStatus("CHECKED_IN");
    Booking b = booking(order);
    b.setStatus("CHECKED_IN");
    b.setCheckInAt(Instant.now());
    b.setCheckOutAt(null);
    var meta = documents.decode(order.getMetadata());
    meta.put("activeVisitDate", date.toString());
    var history = (Map<String, Object>) meta.computeIfAbsent("visitHistory", k -> new LinkedHashMap<>());
    history.put(date.toString(), map("checkInAt", b.getCheckInAt().toString()));
    order.setMetadata(documents.encode(meta));
    audit.log("CHECK-IN", id + ": " + date);
  }

  @Transactional
  public void checkOut(UUID id) {
    CustomerOrder order = lock(id);
    require("CHECKED_IN".equals(order.getStatus()), "Khách chưa check-in");
    var totalAmount = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
    var paidAmount = order.getPaidAmount() != null ? order.getPaidAmount() : BigDecimal.ZERO;
    require(paidAmount.compareTo(totalAmount) >= 0,
        "Đơn hàng chưa thanh toán đủ tiền (còn thiếu " + totalAmount.subtract(paidAmount) + "đ). Vui lòng thu đủ 100% trước khi check-out!");
    var date = visitDate(order, null);
    Booking b = booking(order);
    releaseVisit(b, date, true);
    b.setCheckOutAt(Instant.now());
    boolean remaining = !allocated(b).isEmpty();
    order.setStatus(remaining ? "CONFIRMED" : "COMPLETED");
    b.setStatus(order.getStatus());
    var meta = documents.decode(order.getMetadata());
    meta.remove("activeVisitDate");
    var history = (Map<String, Object>) meta.computeIfAbsent("visitHistory", k -> new LinkedHashMap<>());
    history.put(date.toString(), map("checkInAt", b.getCheckInAt(), "checkOutAt", b.getCheckOutAt()));
    order.setMetadata(documents.encode(meta));
    audit.log("CHECK-OUT", id + ": " + date);
  }

  @Transactional
  public void extend(UUID id, List<UUID> scheduleIds) {
    CustomerOrder order = lock(id);
    require(Set.of("CHECKED_IN", "CONFIRMED").contains(order.getStatus()), "Chỉ gia hạn cho đơn đang chơi hoặc đã xác nhận");
    Booking b = booking(order);
    LocalDate currentDate = visitDate(order, null);
    List<CourtSchedule> currentSlots = allocated(b).stream().filter(x -> x.getScheduleDate().equals(currentDate)).toList();
    require(!currentSlots.isEmpty(), "Đơn chưa có lịch sân");
    var latestCurrentSlot = currentSlots.stream()
        .max(Comparator.comparing(CourtSchedule::getScheduleDate).thenComparing(CourtSchedule::getEndTime))
        .orElseThrow();

    List<CourtSchedule> newSlots = scheduling.lockSlots(scheduleIds);
    scheduling.requireAvailable(newSlots);

    require(newSlots.stream().allMatch(s -> s.getCourt().getId().equals(latestCurrentSlot.getCourt().getId())),
        "Giờ gia hạn phải trên cùng sân đang chơi");

    var sortedNew = newSlots.stream()
        .sorted(Comparator.comparing(CourtSchedule::getScheduleDate).thenComparing(CourtSchedule::getStartTime))
        .toList();
    require(sortedNew.get(0).getScheduleDate().equals(latestCurrentSlot.getScheduleDate())
        && sortedNew.get(0).getStartTime().equals(latestCurrentSlot.getEndTime()),
        "Giờ gia hạn phải liền kề với giờ kết thúc hiện tại (" + latestCurrentSlot.getEndTime() + ")");

    for (int i = 1; i < sortedNew.size(); i++) {
      require(sortedNew.get(i - 1).getEndTime().equals(sortedNew.get(i).getStartTime()),
          "Các slot gia hạn phải liên tiếp nhau");
    }

    allocate(b, newSlots, "BOOKED");

    List<CourtSchedule> allSlots = pricedSlots(b);
    quote(order, allSlots);
    totals.recalculate(order);

    var meta = documents.decode(order.getMetadata());
    var history = (List<Map<String, Object>>) meta.computeIfAbsent("extensionHistory", k -> new ArrayList<>());
    var extFee = newSlots.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    history.add(map(
        "duration", newSlots.size() * 30,
        "fee", extFee,
        "startTime", sortedNew.get(0).getStartTime().toString(),
        "endTime", sortedNew.get(sortedNew.size() - 1).getEndTime().toString(),
        "extendedAt", Instant.now().toString()
    ));
    meta.put("totalExtensionMinutes", history.stream().mapToInt(h -> ((Number) h.get("duration")).intValue()).sum());
    meta.put("totalExtensionFee", history.stream().map(h -> PresentationService.decimal(h.get("fee"))).reduce(BigDecimal.ZERO, BigDecimal::add));
    order.setMetadata(documents.encode(meta));

    audit.log("GIA HẠN SÂN", id.toString() + " (+" + (newSlots.size() * 30) + " phút)");
  }

  @Transactional
  public void move(UUID id, MoveBookingRequest request) {
    CustomerOrder order = lock(id);
    live(order);
    Booking b = booking(order);
    require(request.assignments() != null, "Chọn lại trọng tài theo slot");
    // Lock old and new slots in the same order to avoid deadlocks between moves.
    List<UUID> all = new ArrayList<>(request.scheduleIds());
    allocated(b).forEach(x -> all.add(x.getId()));
    all.stream().distinct().sorted().forEach(x -> schedules.findForUpdate(x).orElseThrow());
    if (!allocated(b).isEmpty()) releaseVisit(b, visitDate(order, null), false);
    slots.flush();
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    allocate(b, selected, "HOLDING".equals(order.getStatus()) ? "LOCKED" : "BOOKED");
    future(selected);
    assignExact(b, selected, request.assignments());
    quote(order, pricedSlots(b));
    totals.recalculate(order);
    order.setDepositRequired(
        depositBase(order)
            .multiply(BigDecimal.valueOf(depositPercent(order)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    audit.log("ĐỔI LỊCH", id.toString());
  }

  @Transactional
  public void invoice(UUID id) {
    CustomerOrder order = lock(id);
    require(
        !Set.of("HOLDING", "CANCELLED", "EXPIRED").contains(order.getStatus()),
        "Đơn chưa đủ điều kiện xuất phiếu thu");
    if (order.getInvoiceNumber() == null) {
      order.setInvoiceNumber("INV-" + order.getId());
      order.setIssuedAt(Instant.now());
    }
  }

  @Scheduled(fixedDelayString = "${courtly.expiry-interval-ms:30000}")
  @Transactional
  public void expireHolds() {
    documents.mutationLock();
    for (var candidate :
        orders.findByStatusAndHoldExpiresAtBefore("HOLDING", Instant.now()).stream()
            .sorted(Comparator.comparing(CustomerOrder::getId))
            .toList()) {
      CustomerOrder order = lock(candidate.getId());
      if (!"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()))
        continue;
      order.setStatus("EXPIRED");
      Booking b = booking(order);
      b.setStatus("CANCELLED");
      release(b);
      vouchers.release(order.getId());
      audit.log("HẾT HẠN", order.getId().toString());
    }
  }

  public void future(List<CourtSchedule> rows) {
    for (var s : rows)
      require(
          at(s.getScheduleDate(), s.getStartTime()).isAfter(Instant.now()),
          "Chọn khung giờ chưa bắt đầu");
  }

  public void continuous(List<CourtSchedule> rows) {
    require(rows != null && !rows.isEmpty(), "Chọn ít nhất một khung giờ");
    Map<UUID, List<CourtSchedule>> byCourt =
        rows.stream().collect(java.util.stream.Collectors.groupingBy(s -> s.getCourt().getId()));
    require(byCourt.size() <= 3, "Tối đa 3 sân trong cùng một đơn đặt");

    for (var entry : byCourt.entrySet()) {
      var sorted = entry.getValue().stream().sorted(Comparator.comparing(CourtSchedule::getStartTime)).toList();
      for (int i = 1; i < sorted.size(); i++) {
        require(
            sorted.get(i - 1).getEndTime().equals(sorted.get(i).getStartTime()),
            "Các giờ chơi trên cùng sân phải liên tiếp nhau");
      }
    }

    if (byCourt.size() > 1) {
      record CourtSpan(LocalTime start, LocalTime end) {}
      List<CourtSpan> spans = new ArrayList<>();
      for (var list : byCourt.values()) {
        LocalTime min = list.stream().map(CourtSchedule::getStartTime).min(Comparator.naturalOrder()).orElseThrow();
        LocalTime max = list.stream().map(CourtSchedule::getEndTime).max(Comparator.naturalOrder()).orElseThrow();
        spans.add(new CourtSpan(min, max));
      }
      spans.sort(Comparator.comparing(CourtSpan::start));

      LocalTime maxEndSoFar = spans.get(0).end;
      for (int i = 1; i < spans.size(); i++) {
        CourtSpan next = spans.get(i);
        if (next.start.isAfter(maxEndSoFar)) {
          long gapMinutes = Duration.between(maxEndSoFar, next.start).toMinutes();
          require(
              gapMinutes <= 30,
              "Các sân trong cùng đơn phải diễn ra cùng khung giờ hoặc nối tiếp nhau (không cách quá 30 phút)");
        }
        if (next.end.isAfter(maxEndSoFar)) {
          maxEndSoFar = next.end;
        }
      }
    }
  }

  public void assignExact(Booking b, List<CourtSchedule> courtSlots, List<StaffAssignment> input) {
    if (input == null) return;
    require(input.size() <= 48, "Quá nhiều phân công");
    Set<UUID> seen = new HashSet<>();
    for (var a : input) {
      var court =
          courtSlots.stream()
              .filter(x -> x.getId().equals(a.scheduleId()))
              .findFirst()
              .orElseThrow(() -> new BusinessException("Slot trọng tài phải nằm trong đơn"));
      if (!seen.add(a.scheduleId())) {
        require(
            bookingStaff.findByBookingId(b.getId()).stream()
                .anyMatch(
                    x ->
                        x.getReleasedAt() == null
                            && x.getCourtSchedule() != null
                            && x.getCourtSchedule().getId().equals(a.scheduleId())
                            && x.getStaffSchedule().getStaff().getId().equals(a.staffId())),
            "Mỗi slot chỉ có một trọng tài");
        continue;
      }
      var existing =
          bookingStaff.findByBookingId(b.getId()).stream()
              .filter(
                  x ->
                      x.getReleasedAt() == null
                          && x.getCourtSchedule() != null
                          && x.getCourtSchedule().getId().equals(court.getId()))
              .toList();
      if (!existing.isEmpty()) {
        require(
            existing.size() == 1
                && existing.get(0).getStaffSchedule().getStaff().getId().equals(a.staffId()),
            "Slot sân đã có trọng tài");
        continue;
      }
      var work = scheduling.lockStaffSlots(a.staffId(), List.of(court));
      for (var shift : work) {
        require("REFEREE".equals(shift.getStaff().getType()), "Chọn nhân sự trọng tài");
        shift.setStatus("BOOKED");
        BookingStaff link = new BookingStaff();
        link.setBooking(b);
        link.setCourtSchedule(court);
        link.setStaffSchedule(shift);
        link.setUnitPrice(shift.getStaff().getHourlyRate());
        bookingStaff.save(link);
      }
    }
  }

  @Transactional
  public void exactStaff(UUID id, List<StaffAssignment> rows) {
    var o = lock(id);
    live(o);
    var b = booking(o);
    require(rows != null, "Chọn phân công trọng tài");
    // The editor submits the complete selection. Retain unchanged historical rates,
    // release removed assignments, and roll back everything if the new set conflicts.
    var releasedAt = Instant.now();
    for (var link : bookingStaff.findByBookingId(b.getId())) {
      if (link.getReleasedAt() != null || link.getCourtSchedule() == null) continue;
      boolean retained = rows.stream().anyMatch(r ->
          link.getCourtSchedule().getId().equals(r.scheduleId())
              && link.getStaffSchedule().getStaff().getId().equals(r.staffId()));
      if (!retained) {
        var shift = staffSchedules.findForUpdate(link.getStaffSchedule().getId()).orElseThrow();
        link.setReleasedAt(releasedAt);
        shift.setStatus("AVAILABLE");
      }
    }
    bookingStaff.flush();
    assignExact(b, allocated(b), rows);
    totals.recalculate(o);
    o.setDepositRequired(
        depositBase(o)
            .multiply(BigDecimal.valueOf(depositPercent(o)))
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
  }

  @Transactional
  public void restore(UUID id, MoveBookingRequest r) {
    var o = lock(id);
    require(
        Set.of("EXPIRED", "CANCELLED").contains(o.getStatus()), "Chỉ khôi phục đơn đã hủy/hết hạn");
    var metadata = documents.decode(o.getMetadata());
    if (metadata.get("voucherBenefit") instanceof Map<?, ?> benefit && benefit.get("code") != null) {
      BigDecimal gross = scheduling.lockSlots(r.scheduleIds()).stream()
          .map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
      gross = gross.add(slots.findByBookingId(booking(o).getId()).stream()
          .filter(x -> x.getCompletedAt() != null).map(BookingSlot::getUnitPrice)
          .reduce(BigDecimal.ZERO, BigDecimal::add));
      metadata.put("voucherBenefit", vouchers.restore(benefit.get("code").toString(), o, gross));
      o.setMetadata(documents.encode(metadata));
    }
    o.setStatus("HOLDING");
    o.setHoldExpiresAt(Instant.now().plusSeconds(settings.get().getHoldMinutes() * 60L));
    move(id, r);
    if (o.getPaidAmount().compareTo(o.getDepositRequired()) >= 0) {
      o.setStatus("CONFIRMED");
      allocated(booking(o)).forEach(s -> s.setStatus("BOOKED"));
    }
    booking(o).setStatus(o.getStatus());
    var meta = documents.decode(o.getMetadata());
    meta.remove("cancellationSettlement");
    var excess = o.getPaidAmount().subtract(o.getTotalAmount()).max(BigDecimal.ZERO);
    meta.put("refundPending", excess);
    meta.put("financialReview", excess.signum() > 0 ? "REFUND_PENDING" : null);
    o.setMetadata(documents.encode(meta));
  }

  private void quote(CustomerOrder o, List<CourtSchedule> selected) {
    var extra = documents.decode(o.getMetadata());
    extra.put(
        "membershipBenefit",
        membership.quote(
            o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(), selected));
    o.setMetadata(documents.encode(extra));
  }

  @Transactional
  public void verifyLegacy(UUID id, UUID lineId, List<UUID> selected, String reason) {
    var o = lock(id);
    text(reason, "Lý do xác minh");
    var line = bookingStaff.findById(lineId).orElseThrow();
    require(
        line.getBooking().getOrder().getId().equals(id) && line.getCourtSchedule() == null,
        "Phân công không cần xác minh hoặc không thuộc đơn");
    require(selected.size() == 1, "Phân công một giờ cần một slot sân");
    var target =
        allocated(booking(o)).stream()
            .filter(s -> s.getId().equals(selected.get(0)))
            .findFirst()
            .orElseThrow();
    require(
        target.getScheduleDate().equals(line.getStaffSchedule().getWorkDate())
            && target.getStartTime().equals(line.getStaffSchedule().getStartTime()),
        "Slot không khớp lịch làm việc cũ");
    line.setCourtSchedule(target);
    audit.log("XÁC MINH PHÂN CÔNG CŨ", lineId + ": " + reason);
  }
}
