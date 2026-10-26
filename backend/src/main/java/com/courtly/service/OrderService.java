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

  @Transactional
  public UUID create(BookingRequest request) {
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    future(selected);
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
    allocate(booking, selected, "LOCKED");
    assignExact(booking, selected, request.assignments());
    quote(order, selected);
    totals.recalculate(order);
    order.setDepositRequired(
        depositBase(order)
            .multiply(BigDecimal.valueOf(depositPercent(order)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    audit.log("TẠO ĐƠN", order.getId().toString());
    return order.getId();
  }

  private int depositPercent(CustomerOrder o) {
    return Boolean.TRUE.equals(documents.decode(o.getMetadata()).get("customerFlow")) ? 50 : settings.get().getDepositPercent();
  }

  private BigDecimal depositBase(CustomerOrder o) {
    var metadata = documents.decode(o.getMetadata());
    if (Boolean.TRUE.equals(metadata.get("customerFlow")) && metadata.get("membershipBenefit") instanceof Map<?,?> benefit)
      return PresentationService.decimal(benefit.get("net"));
    return o.getTotalAmount();
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
    Instant releasedAt = Instant.now();
    for (BookingSlot link :
        slots.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
      CourtSchedule slot = schedules.findForUpdate(link.getSchedule().getId()).orElseThrow();
      slot.setStatus("AVAILABLE");
      link.setReleasedAt(releasedAt);
    }
    for (BookingStaff link :
        bookingStaff.findByBookingId(booking.getId()).stream()
            .sorted(Comparator.comparing(x -> x.getStaffSchedule().getId()))
            .toList()) {
      if (link.getReleasedAt() != null) continue;
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
    audit.log("HỦY ĐƠN", id.toString());
  }

  @Transactional
  public void checkIn(UUID id) {
    CustomerOrder order = lock(id);
    require("CONFIRMED".equals(order.getStatus()), "Đơn chưa được xác nhận");
    order.setStatus("CHECKED_IN");
    Booking b = booking(order);
    b.setStatus("CHECKED_IN");
    b.setCheckInAt(Instant.now());
    audit.log("CHECK-IN", id.toString());
  }

  @Transactional
  public void checkOut(UUID id) {
    CustomerOrder order = lock(id);
    require("CHECKED_IN".equals(order.getStatus()), "Khách chưa check-in");
    // Preserve the current explicit cash-desk workflow; balances remain in finance.
    order.setStatus("COMPLETED");
    Booking b = booking(order);
    b.setStatus("COMPLETED");
    b.setCheckOutAt(Instant.now());
    release(b);
    audit.log("CHECK-OUT", id.toString());
  }

  @Transactional
  public void extend(UUID id, List<UUID> scheduleIds) {
    CustomerOrder order = lock(id);
    require(Set.of("CHECKED_IN", "CONFIRMED").contains(order.getStatus()), "Chỉ gia hạn cho đơn đang chơi hoặc đã xác nhận");
    Booking b = booking(order);
    List<CourtSchedule> currentSlots = allocated(b);
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

    List<CourtSchedule> allSlots = new ArrayList<>(currentSlots);
    allSlots.addAll(newSlots);
    quote(order, allSlots);
    totals.recalculate(order);

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
    release(b);
    slots.flush();
    List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
    scheduling.requireAvailable(selected);
    allocate(b, selected, "HOLDING".equals(order.getStatus()) ? "LOCKED" : "BOOKED");
    future(selected);
    assignExact(b, selected, request.assignments());
    quote(order, selected);
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
    require(
        rows.stream().map(s -> s.getCourt().getId()).distinct().count() == 1,
        "Chọn một khoảng liên tục trên cùng sân");
    var sorted = rows.stream().sorted(Comparator.comparing(CourtSchedule::getStartTime)).toList();
    for (int i = 1; i < sorted.size(); i++)
      require(
          sorted.get(i - 1).getEndTime().equals(sorted.get(i).getStartTime()),
          "Các giờ chơi phải liên tiếp");
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
    o.setStatus("HOLDING");
    o.setHoldExpiresAt(Instant.now().plusSeconds(settings.get().getHoldMinutes() * 60L));
    move(id, r);
    if (o.getPaidAmount().compareTo(o.getDepositRequired()) >= 0) {
      o.setStatus("CONFIRMED");
      allocated(booking(o)).forEach(s -> s.setStatus("BOOKED"));
    }
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
