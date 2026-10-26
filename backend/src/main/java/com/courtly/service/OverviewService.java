package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OverviewService {
  private final AccountRepository accounts;
  private final CourtRepository courts;
  private final CourtPriceRepository prices;
  private final CourtScheduleRepository schedules;
  private final CustomerOrderRepository orders;
  private final BookingRepository bookings;
  private final BookingSlotRepository bookingSlots;
  private final BookingStaffRepository bookingStaff;
  private final OrderProductRepository products;
  private final StaffRepository staff;
  private final StaffScheduleRepository staffSchedules;
  private final PaymentRepository payments;
  private final RefundRepository refunds;
  private final TournamentRepository tournaments;
  private final TournamentRegistrationRepository registrations;
  private final TeamMemberRepository members;
  private final TournamentMatchRepository matches;
  private final MatchSlotRepository matchSlots;
  private final MatchStaffRepository matchStaff;
  private final AuditLogRepository audit;
  private final ClubSettingsRepository settings;
  private final PaymentService paymentService;
  private final OrderTotalsService totals;

  public Map<String, Object> publicGet(LocalDate date) {
    ClubSettings s = settings.findAll().stream().findFirst().orElseThrow();
    return map(
        "courts",
            courts.findAll().stream()
                .sorted(Comparator.comparing(Court::getName))
                .map(
                    c ->
                        map(
                            "id",
                            c.getId(),
                            "name",
                            c.getName(),
                            "type",
                            c.getType(),
                            "status",
                            c.getStatus(),
                            "price",
                            c.getBasePrice(),
                            "description",
                            c.getDescription(),
                            "address",
                            c.getAddress(),
                            "amenities",
                            c.getAmenities(),
                            "imageUrl",
                            c.getImageUrl(),
                            "imageIsIllustration",
                            c.isImageIsIllustration()))
                .toList(),
        "prices",
            prices.findAllWithCourt().stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "dayType",
                            p.getDayType(),
                            "start",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "end",
                            p.getEndTime().getHour() + p.getEndTime().getMinute() / 60.0,
                            "price",
                            p.getPricePerHour()))
                .toList(),
        "schedules",
            schedules.findByScheduleDateOrderByStartTime(date).stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "date",
                            p.getScheduleDate(),
                            "start", p.getStartTime(), "end", p.getEndTime(),
                            "hour",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "price",
                            p.getPrice(),
                            "status",
                            !"ACTIVE".equals(p.getCourt().getStatus()) ? "BLOCKED" : p.getStatus(),
                            "version",
                            p.getVersion()))
                .toList(),
        "tournaments",
            tournaments.findAll().stream()
                .map(
                    t ->
                        map(
                            "id",
                            t.getId(),
                            "name",
                            t.getName(),
                            "format",
                            t.getFormat(),
                            "start",
                            t.getStartDate(),
                            "end",
                            t.getEndDate(),
                            "deadline",
                            t.getRegistrationDeadline(),
                            "fee",
                            t.getRegistrationFee(),
                            "max",
                            t.getMaxParticipants(),
                            "status",
                            t.getStatus(),
                            "location",
                            t.getLocation()))
                .toList(),
        "settings",
            map(
                "holdMinutes",
                s.getHoldMinutes(),
                "depositPercent",
                s.getDepositPercent(),
                "cancelRefundPercent",
                s.getCancelRefundPercent()));
  }

  public Map<String, Object> get(LocalDate date) {
    ClubSettings s = settings.findAll().stream().findFirst().orElseThrow();

    var allBookings = bookings.findAllWithOrder();
    var allSlots = bookingSlots.findAllWithDetails();
    var allProducts = products.findAllWithDetails();
    var allStaff = bookingStaff.findAllWithDetails();

    Map<UUID, List<Booking>> bookingsByOrder =
        allBookings.stream()
            .filter(b -> b.getOrder() != null)
            .collect(Collectors.groupingBy(b -> b.getOrder().getId()));

    Map<UUID, List<BookingSlot>> slotsByBooking =
        allSlots.stream()
            .filter(bs -> bs.getBooking() != null)
            .collect(Collectors.groupingBy(bs -> bs.getBooking().getId()));

    Map<UUID, List<OrderProduct>> productsByOrder =
        allProducts.stream()
            .filter(op -> op.getOrder() != null)
            .collect(Collectors.groupingBy(op -> op.getOrder().getId()));

    Map<UUID, List<BookingStaff>> staffByBooking =
        allStaff.stream()
            .filter(bs -> bs.getBooking() != null)
            .collect(Collectors.groupingBy(bs -> bs.getBooking().getId()));

    var allRefunds = refunds.findAllWithPayment();
    Map<UUID, BigDecimal> refundsByPayment =
        allRefunds.stream()
            .filter(r -> r.getPayment() != null)
            .collect(
                Collectors.groupingBy(
                    r -> r.getPayment().getId(),
                    Collectors.reducing(BigDecimal.ZERO, Refund::getAmount, BigDecimal::add)));

    var allPayments = payments.findAllWithOrderAndRegistration();
    Map<UUID, List<Payment>> paymentsByRegistration =
        allPayments.stream()
            .filter(p -> p.getRegistration() != null)
            .collect(Collectors.groupingBy(p -> p.getRegistration().getId()));

    var allMembers = members.findAllWithRegistration();
    Map<UUID, List<TeamMember>> membersByRegistration =
        allMembers.stream()
            .filter(m -> m.getRegistration() != null)
            .collect(Collectors.groupingBy(m -> m.getRegistration().getId()));

    var allMatchSlots = matchSlots.findAllWithDetails();
    Map<UUID, List<MatchSlot>> matchSlotsByMatch =
        allMatchSlots.stream()
            .filter(ms -> ms.getMatch() != null)
            .collect(Collectors.groupingBy(ms -> ms.getMatch().getId()));

    var allMatchStaff = matchStaff.findAllWithDetails();
    Map<UUID, List<MatchStaff>> matchStaffByMatch =
        allMatchStaff.stream()
            .filter(ms -> ms.getMatch() != null)
            .collect(Collectors.groupingBy(ms -> ms.getMatch().getId()));

    return map(
        "courts",
            courts.findAll().stream()
                .sorted(Comparator.comparing(Court::getName))
                .map(
                    c ->
                        map(
                            "id",
                            c.getId(),
                            "name",
                            c.getName(),
                            "type",
                            c.getType(),
                            "status",
                            c.getStatus(),
                            "price",
                            c.getBasePrice(),
                            "description",
                            c.getDescription(),
                            "address",
                            c.getAddress(),
                            "amenities",
                            c.getAmenities(),
                            "imageUrl",
                            c.getImageUrl(),
                            "imageIsIllustration",
                            c.isImageIsIllustration()))
                .toList(),
        "prices",
            prices.findAllWithCourt().stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "dayType",
                            p.getDayType(),
                            "start",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "end",
                            p.getEndTime().getHour() + p.getEndTime().getMinute() / 60.0,
                            "price",
                            p.getPricePerHour()))
                .toList(),
        "schedules",
            schedules.findByScheduleDateOrderByStartTime(date).stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "court",
                            p.getCourt().getId(),
                            "date",
                            p.getScheduleDate(),
                            "start", p.getStartTime(), "end", p.getEndTime(),
                            "hour",
                            p.getStartTime().getHour() + p.getStartTime().getMinute() / 60.0,
                            "price",
                            p.getPrice(),
                            "status",
                            !"ACTIVE".equals(p.getCourt().getStatus()) ? "BLOCKED" : p.getStatus(),
                            "version",
                            p.getVersion()))
                .toList(),
        "accounts",
            accounts.findAll().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "name",
                            a.getFullName(),
                            "email",
                            a.getEmail(),
                            "phone",
                            a.getPhone(),
                            "role",
                            a.getRole(),
                            "status",
                            a.getStatus()))
                .toList(),
        "staff",
            staff.findAll().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "name",
                            a.getFullName(),
                            "phone",
                            a.getPhone(),
                            "type",
                            a.getType(),
                            "rate",
                            a.getHourlyRate(),
                            "status",
                            a.getStatus()))
                .toList(),
        "staffSchedules",
            staffSchedules.findByWorkDateOrderByStartTime(date).stream()
                .map(
                    x ->
                        map(
                            "id",
                            x.getId(),
                            "staff",
                            x.getStaff().getId(),
                            "date",
                            x.getWorkDate(),
                            "start",
                            x.getStartTime().getHour() + x.getStartTime().getMinute() / 60.0,
                            "end",
                            x.getEndTime().getHour() + x.getEndTime().getMinute() / 60.0,
                            "status",
                            x.getStatus()))
                .toList(),
        "orders",
            orders.findAllWithCustomerAccount().stream()
                .map(
                    o ->
                        order(
                            o,
                            bookingsByOrder,
                            slotsByBooking,
                            productsByOrder,
                            staffByBooking))
                .toList(),
        "products", List.of(),
        "payments",
            allPayments.stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "orderId",
                            p.getOrder() == null ? null : p.getOrder().getId(),
                            "registrationId",
                            p.getRegistration() == null ? null : p.getRegistration().getId(),
                            "amount",
                            p.getAmount(),
                            "method",
                            p.getMethod(),
                            "type",
                            p.getType(),
                            "createdAt",
                            p.getPaidAt(),
                            "transactionCode",
                            p.getTransactionCode(),
                            "receivedBy",
                            p.getReceivedByAccount() == null
                                ? null
                                : map(
                                    "id",
                                    p.getReceivedByAccount().getId(),
                                    "name",
                                    p.getReceivedByAccount().getFullName(),
                                    "phone",
                                    p.getReceivedByAccount().getPhone()),
                            "refundable",
                            p.getAmount()
                                .subtract(
                                    refundsByPayment.getOrDefault(
                                        p.getId(), BigDecimal.ZERO))))
                .toList(),
        "refunds",
            allRefunds.stream()
                .map(
                    p ->
                        map(
                            "id",
                            p.getId(),
                            "paymentId",
                            p.getPayment().getId(),
                            "amount",
                            p.getAmount(),
                            "reason",
                            p.getReason(),
                            "createdAt",
                            p.getRefundedAt()))
                .toList(),
        "tournaments",
            tournaments.findAll().stream()
                .map(
                    t ->
                        map(
                            "id",
                            t.getId(),
                            "name",
                            t.getName(),
                            "format",
                            t.getFormat(),
                            "start",
                            t.getStartDate(),
                            "end",
                            t.getEndDate(),
                            "deadline",
                            t.getRegistrationDeadline(),
                            "fee",
                            t.getRegistrationFee(),
                            "max",
                            t.getMaxParticipants(),
                            "status",
                            t.getStatus(),
                            "location",
                            t.getLocation()))
                .toList(),
        "registrations",
            registrations.findAllWithTournamentAndAccount().stream()
                .map(
                    r -> {
                      var rPayments =
                          paymentsByRegistration.getOrDefault(r.getId(), List.of());
                      var paid =
                          rPayments.stream()
                              .map(
                                  p ->
                                      p.getAmount()
                                          .subtract(
                                              refundsByPayment.getOrDefault(
                                                  p.getId(), BigDecimal.ZERO)))
                              .reduce(BigDecimal.ZERO, BigDecimal::add);
                      var rMembers =
                          membersByRegistration.getOrDefault(r.getId(), List.of()).stream()
                              .map(TeamMember::getMemberName)
                              .toList();
                      return map(
                          "id",
                          r.getId(),
                          "tournamentId",
                          r.getTournament().getId(),
                          "accountId",
                          r.getAccount() == null ? null : r.getAccount().getId(),
                          "name",
                          r.getTeamName(),
                          "status",
                          r.getStatus(),
                          "paid",
                          paid,
                          "members",
                          rMembers);
                    })
                .toList(),
        "matches",
            matches.findAll().stream()
                .sorted(
                    Comparator.comparing(TournamentMatch::getRoundNumber)
                        .thenComparing(TournamentMatch::getBracketIndex))
                .map(m -> match(m, matchSlotsByMatch, matchStaffByMatch))
                .toList(),
        "audit",
            audit.findTop100ByOrderByCreatedAtDesc().stream()
                .map(
                    a ->
                        map(
                            "id",
                            a.getId(),
                            "actor",
                            a.getActor(),
                            "action",
                            a.getAction(),
                            "detail",
                            a.getDetail(),
                            "at",
                            a.getCreatedAt()))
                .toList(),
        "settings",
            map(
                "holdMinutes",
                s.getHoldMinutes(),
                "depositPercent",
                s.getDepositPercent(),
                "cancelRefundPercent",
                s.getCancelRefundPercent()));
  }

  private <T> List<T> currentLinks(List<T> list, Function<T, Instant> released) {
    var active = list.stream().filter(x -> released.apply(x) == null).toList();
    if (!active.isEmpty()) return active;
    Instant latest =
        list.stream()
            .map(released)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null);
    return list.stream().filter(x -> Objects.equals(released.apply(x), latest)).toList();
  }

  public Map<String, Object> order(CustomerOrder o) {
    Booking b = bookings.findByOrderId(o.getId()).stream().findFirst().orElseThrow();
    var slots = currentLinks(bookingSlots.findByBookingId(b.getId()), BookingSlot::getReleasedAt);
    return buildOrderMap(
        o,
        b,
        slots,
        products.findByOrderId(o.getId()),
        bookingStaff.findByBookingId(b.getId()));
  }

  public Map<String, Object> order(
      CustomerOrder o,
      Map<UUID, List<Booking>> bookingsByOrder,
      Map<UUID, List<BookingSlot>> slotsByBooking,
      Map<UUID, List<OrderProduct>> productsByOrder,
      Map<UUID, List<BookingStaff>> staffByBooking) {
    List<Booking> bList = bookingsByOrder.getOrDefault(o.getId(), List.of());
    if (bList.isEmpty()) {
      return order(o);
    }
    Booking b = bList.get(0);
    var slots = currentLinks(slotsByBooking.getOrDefault(b.getId(), List.of()), BookingSlot::getReleasedAt);
    return buildOrderMap(
        o,
        b,
        slots,
        productsByOrder.getOrDefault(o.getId(), List.of()),
        staffByBooking.getOrDefault(b.getId(), List.of()));
  }

  private Map<String, Object> buildOrderMap(
      CustomerOrder o,
      Booking b,
      List<BookingSlot> slots,
      List<OrderProduct> orderProducts,
      List<BookingStaff> staffList) {
    return map(
        "id",
        o.getId(),
        "bookingId",
        b.getId(),
        "name",
        o.getCustomerName(),
        "phone",
        o.getCustomerPhone(),
        "accountId",
        o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId(),
        "date",
        slots.isEmpty() ? null : slots.get(0).getSchedule().getScheduleDate(),
        "status",
        o.getStatus(),
        "total",
        o.getTotalAmount(),
        "paid",
        o.getPaidAmount(),
        "deposit",
        o.getDepositRequired(),
        "createdAt",
        o.getCreatedAt(),
        "holdUntil",
        o.getHoldExpiresAt(),
        "checkInAt",
        b.getCheckInAt(),
        "checkOutAt",
        b.getCheckOutAt(),
        "invoice",
        o.getInvoiceNumber(),
        "issuedAt",
        o.getIssuedAt(),
        "metadataRaw",
        o.getMetadata(),
        "slots",
        slots.stream().map(x -> slot(x.getSchedule(), x.getUnitPrice())).toList(),
        "products",
        orderProducts.stream()
            .map(
                x ->
                    map(
                        "id",
                        x.getId(),
                        "productId",
                        x.getDrink() != null ? x.getDrink().getId() : x.getRentalItem().getId(),
                        "name",
                        x.getDrink() != null ? x.getDrink().getName() : x.getRentalItem().getName(),
                        "type",
                        x.getItemType(),
                        "quantity",
                        x.getQuantity(),
                        "price",
                        x.getUnitPrice(),
                        "lineTotal",
                        totals.productTotal(x),
                        "hours",
                        x.getRentStartAt() == null
                            ? 1
                            : Duration.between(x.getRentStartAt(), x.getRentEndAt()).toHours(),
                        "returned",
                        x.getReturnedAt() != null,
                        "condition",
                        x.getCondition(),
                        "issuedAt",
                        x.getIssuedAt()))
            .toList(),
        "staff",
        staffList.stream()
            .filter(
                x ->
                    x.getReleasedAt() == null
                        || !active(o.getStatus())
                            && slots.stream()
                                .anyMatch(
                                    link ->
                                        link.getReleasedAt() != null
                                            && link.getReleasedAt().equals(x.getReleasedAt())))
            .map(
                x ->
                    map(
                        "id",
                        x.getId(),
                        "staffId",
                        x.getStaffSchedule().getStaff().getId(),
                        "name",
                        x.getStaffSchedule().getStaff().getFullName(),
                        "rate",
                        x.getUnitPrice(),
                        "hours",
                        hours(
                            x.getStaffSchedule().getStartTime(), x.getStaffSchedule().getEndTime()),
                        "legacyNeedsReview",
                        x.getCourtSchedule() == null,
                        "scheduleId",
                        x.getCourtSchedule() == null ? null : x.getCourtSchedule().getId(),
                        "court",
                        x.getCourtSchedule() == null
                            ? null
                            : x.getCourtSchedule().getCourt().getId(),
                        "start", x.getStaffSchedule().getStartTime(), "end", x.getStaffSchedule().getEndTime(),
                        "hour",
                        x.getStaffSchedule().getStartTime().getHour() + x.getStaffSchedule().getStartTime().getMinute() / 60.0,
                        "date",
                        x.getStaffSchedule().getWorkDate()))
            .toList());
  }

  private Map<String, Object> slot(CourtSchedule s, Object price) {
    return map(
        "id",
        s.getId(),
        "court",
        s.getCourt().getId(),
        "start", s.getStartTime(), "end", s.getEndTime(),
        "hour",
        s.getStartTime().getHour() + s.getStartTime().getMinute() / 60.0,
        "price",
        price);
  }

  private Map<String, Object> match(
      TournamentMatch m,
      Map<UUID, List<MatchSlot>> matchSlotsByMatch,
      Map<UUID, List<MatchStaff>> matchStaffByMatch) {
    var slots =
        currentLinks(
            matchSlotsByMatch.getOrDefault(m.getId(), List.of()),
            MatchSlot::getReleasedAt);
    var staff =
        currentLinks(
            matchStaffByMatch.getOrDefault(m.getId(), List.of()),
            MatchStaff::getReleasedAt);
    return map(
        "id",
        m.getId(),
        "tournamentId",
        m.getTournament().getId(),
        "round",
        m.getRoundNumber(),
        "index",
        m.getBracketIndex(),
        "roundName",
        m.getRoundName(),
        "reg1",
        m.getRegistration1() == null ? null : m.getRegistration1().getId(),
        "reg2",
        m.getRegistration2() == null ? null : m.getRegistration2().getId(),
        "winner",
        m.getWinnerRegistration() == null ? null : m.getWinnerRegistration().getId(),
        "score",
        m.getScore(),
        "status",
        m.getStatus(),
        "slots",
        slots.stream().map(x -> slot(x.getSchedule(), 0)).toList(),
        "date",
        slots.isEmpty() ? null : slots.get(0).getSchedule().getScheduleDate(),
        "staffId",
        staff.isEmpty() ? null : staff.get(0).getStaffSchedule().getStaff().getId());
  }
}
