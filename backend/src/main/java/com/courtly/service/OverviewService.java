package com.courtly.service;

import com.courtly.entity.*;
import com.courtly.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import static com.courtly.util.Rules.*;

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
    private final DrinkRepository drinks;
    private final RentalItemRepository rentals;
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

    public Map<String,Object> get(LocalDate date) {
        List<Map<String,Object>> items = new ArrayList<>();
        drinks.findAll().forEach(p -> items.add(map("id", p.getId(), "name", p.getName(), "type", "DRINK", "price", p.getUnitPrice(), "stock", p.getStockQuantity(), "status", p.getStatus())));
        rentals.findAll().forEach(p -> items.add(map("id", p.getId(), "name", p.getName(), "type", "RENTAL", "price", p.getPricePerHour(), "stock", p.getStockQuantity(), "status", p.getStatus())));
        ClubSettings s = settings.findAll().stream().findFirst().orElseThrow();
        return map(
            "courts", courts.findAll().stream().sorted(Comparator.comparing(Court::getName)).map(c -> map("id",c.getId(),"name",c.getName(),"type",c.getType(),"status",c.getStatus(),"price",c.getBasePrice())).toList(),
            "prices", prices.findAll().stream().map(p -> map("id",p.getId(),"court",p.getCourt().getId(),"dayType",p.getDayType(),"start",p.getStartTime().getHour(),"end",p.getEndTime().getHour(),"price",p.getPricePerHour())).toList(),
            "schedules", schedules.findByScheduleDateOrderByStartTime(date).stream().map(p -> map("id",p.getId(),"court",p.getCourt().getId(),"date",p.getScheduleDate(),"hour",p.getStartTime().getHour(),"price",p.getPrice(),"status",p.getStatus(),"version",p.getVersion())).toList(),
            "accounts", accounts.findAll().stream().map(a -> map("id",a.getId(),"name",a.getFullName(),"email",a.getEmail(),"phone",a.getPhone(),"role",a.getRole(),"status",a.getStatus())).toList(),
            "staff", staff.findAll().stream().map(a -> map("id",a.getId(),"name",a.getFullName(),"phone",a.getPhone(),"type",a.getType(),"rate",a.getHourlyRate(),"status",a.getStatus())).toList(),
            "staffSchedules", staffSchedules.findAll().stream().map(x -> map("id",x.getId(),"staff",x.getStaff().getId(),"date",x.getWorkDate(),"start",x.getStartTime().getHour(),"end",x.getEndTime().getHour(),"status",x.getStatus())).toList(),
            "orders", orders.findAll().stream().sorted(Comparator.comparing(CustomerOrder::getCreatedAt).reversed()).map(this::order).toList(),
            "products", items,
            "payments", payments.findAll().stream().sorted(Comparator.comparing(Payment::getPaidAt).reversed()).map(p -> map("id",p.getId(),"orderId",p.getOrder()==null?null:p.getOrder().getId(),"registrationId",p.getRegistration()==null?null:p.getRegistration().getId(),"amount",p.getAmount(),"method",p.getMethod(),"type",p.getType(),"createdAt",p.getPaidAt(),"transactionCode",p.getTransactionCode(),"refundable",paymentService.net(p))).toList(),
            "refunds", refunds.findAll().stream().sorted(Comparator.comparing(Refund::getRefundedAt).reversed()).map(p -> map("id",p.getId(),"paymentId",p.getPayment().getId(),"amount",p.getAmount(),"reason",p.getReason(),"createdAt",p.getRefundedAt())).toList(),
            "tournaments", tournaments.findAll().stream().map(t -> map("id",t.getId(),"name",t.getName(),"format",t.getFormat(),"start",t.getStartDate(),"end",t.getEndDate(),"deadline",t.getRegistrationDeadline(),"fee",t.getRegistrationFee(),"max",t.getMaxParticipants(),"status",t.getStatus(),"location",t.getLocation())).toList(),
            "registrations", registrations.findAll().stream().map(r -> map("id",r.getId(),"tournamentId",r.getTournament().getId(),"accountId",r.getAccount().getId(),"name",r.getTeamName(),"status",r.getStatus(),"paid",paymentService.registrationPaid(r.getId()),"members",members.findByRegistrationId(r.getId()).stream().map(TeamMember::getMemberName).toList())).toList(),
            "matches", matches.findAll().stream().sorted(Comparator.comparing(TournamentMatch::getRoundNumber).thenComparing(TournamentMatch::getBracketIndex)).map(this::match).toList(),
            "audit", audit.findTop100ByOrderByCreatedAtDesc().stream().map(a -> map("id",a.getId(),"actor",a.getActor(),"action",a.getAction(),"detail",a.getDetail(),"at",a.getCreatedAt())).toList(),
            "settings", map("holdMinutes",s.getHoldMinutes(),"depositPercent",s.getDepositPercent(),"cancelRefundPercent",s.getCancelRefundPercent())
        );
    }

    private <T> List<T> currentLinks(List<T> list, Function<T,Instant> released) {
        var active = list.stream().filter(x -> released.apply(x)==null).toList();
        if (!active.isEmpty()) return active;
        Instant latest = list.stream().map(released).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
        return list.stream().filter(x -> Objects.equals(released.apply(x),latest)).toList();
    }

    private Map<String,Object> order(CustomerOrder o) {
        Booking b = bookings.findByOrderId(o.getId()).stream().findFirst().orElseThrow();
        var slots = currentLinks(bookingSlots.findByBookingId(b.getId()),BookingSlot::getReleasedAt);
        return map("id",o.getId(),"bookingId",b.getId(),"name",o.getCustomerName(),"phone",o.getCustomerPhone(),"accountId",o.getCustomerAccount()==null?null:o.getCustomerAccount().getId(),
            "date",slots.isEmpty()?null:slots.get(0).getSchedule().getScheduleDate(),"status",o.getStatus(),"total",o.getTotalAmount(),"paid",o.getPaidAmount(),"deposit",o.getDepositRequired(),
            "createdAt",o.getCreatedAt(),"holdUntil",o.getHoldExpiresAt(),"checkInAt",b.getCheckInAt(),"checkOutAt",b.getCheckOutAt(),"invoice",o.getInvoiceNumber(),"issuedAt",o.getIssuedAt(),
            "slots",slots.stream().map(x -> slot(x.getSchedule(),x.getUnitPrice())).toList(),
            "products",products.findByOrderId(o.getId()).stream().map(x -> map("id",x.getId(),"productId",x.getDrink()!=null?x.getDrink().getId():x.getRentalItem().getId(),"name",x.getDrink()!=null?x.getDrink().getName():x.getRentalItem().getName(),"type",x.getItemType(),"quantity",x.getQuantity(),"price",x.getUnitPrice(),"lineTotal",totals.productTotal(x),"hours",x.getRentStartAt()==null?1:Duration.between(x.getRentStartAt(),x.getRentEndAt()).toHours(),"returned",x.getReturnedAt()!=null)).toList(),
            "staff",bookingStaff.findByBookingId(b.getId()).stream().map(x -> map("id",x.getId(),"staffId",x.getStaffSchedule().getStaff().getId(),"name",x.getStaffSchedule().getStaff().getFullName(),"rate",x.getUnitPrice(),"hours",hours(x.getStaffSchedule().getStartTime(),x.getStaffSchedule().getEndTime()))).toList());
    }

    private Map<String,Object> slot(CourtSchedule s, Object price) {
        return map("id",s.getId(),"court",s.getCourt().getId(),"hour",s.getStartTime().getHour(),"price",price);
    }

    private Map<String,Object> match(TournamentMatch m) {
        var slots = currentLinks(matchSlots.findByMatchId(m.getId()),MatchSlot::getReleasedAt);
        var staff = currentLinks(matchStaff.findByMatchId(m.getId()),MatchStaff::getReleasedAt);
        return map("id",m.getId(),"tournamentId",m.getTournament().getId(),"round",m.getRoundNumber(),"index",m.getBracketIndex(),"roundName",m.getRoundName(),
            "reg1",m.getRegistration1()==null?null:m.getRegistration1().getId(),"reg2",m.getRegistration2()==null?null:m.getRegistration2().getId(),"winner",m.getWinnerRegistration()==null?null:m.getWinnerRegistration().getId(),
            "score",m.getScore(),"status",m.getStatus(),"slots",slots.stream().map(x -> slot(x.getSchedule(),0)).toList(),"date",slots.isEmpty()?null:slots.get(0).getSchedule().getScheduleDate(),"staffId",staff.isEmpty()?null:staff.get(0).getStaffSchedule().getStaff().getId());
    }
}
