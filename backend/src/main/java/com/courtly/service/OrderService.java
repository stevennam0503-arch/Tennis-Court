package com.courtly.service;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;
import static com.courtly.util.Rules.*;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final CustomerOrderRepository orders;
    private final AccountRepository accounts;
    private final BookingRepository bookings;
    private final BookingSlotRepository slots;
    private final BookingStaffRepository bookingStaff;
    private final OrderProductRepository products;
    private final DrinkRepository drinks;
    private final RentalItemRepository rentals;
    private final CourtScheduleRepository schedules;
    private final StaffScheduleRepository staffSchedules;
    private final ScheduleService scheduling;
    private final SettingsService settings;
    private final OrderTotalsService totals;
    private final AuditService audit;

    @Transactional
    public UUID create(BookingRequest request) {
        List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
        scheduling.requireAvailable(selected);
        CustomerOrder order = new CustomerOrder();
        if (request.accountId() != null) {
            Account account = accounts.findById(request.accountId()).orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
            require("ACTIVE".equals(account.getStatus()), "Tài khoản đã khóa");
            order.setCustomerAccount(account);
            order.setCustomerName(request.name() == null || request.name().isBlank() ? account.getFullName() : text(request.name(), "Tên khách"));
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
        totals.recalculate(order);
        order.setDepositRequired(order.getTotalAmount().multiply(BigDecimal.valueOf(settings.get().getDepositPercent())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        audit.log("TẠO ĐƠN", order.getId().toString());
        return order.getId();
    }

    private CustomerOrder lock(UUID id) {
        return orders.findForUpdate(id).orElseThrow(() -> new BusinessException("Không tìm thấy đơn"));
    }

    private Booking booking(CustomerOrder order) {
        return bookings.findByOrderId(order.getId()).stream().findFirst().orElseThrow();
    }

    private List<CourtSchedule> allocated(Booking b) {
        return slots.findByBookingId(b.getId()).stream().filter(x -> x.getReleasedAt() == null).map(BookingSlot::getSchedule).toList();
    }

    private void live(CustomerOrder order) {
        require(active(order.getStatus()), "Đơn đã kết thúc");
        require(!"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now()), "Đơn đã hết thời gian giữ chỗ");
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
        for (BookingSlot link : slots.findByBookingId(booking.getId()).stream().sorted(Comparator.comparing(x -> x.getSchedule().getId())).toList()) {
            if (link.getReleasedAt() != null) continue;
            CourtSchedule slot = schedules.findForUpdate(link.getSchedule().getId()).orElseThrow();
            slot.setStatus("AVAILABLE");
            link.setReleasedAt(releasedAt);
        }
        for (BookingStaff link : bookingStaff.findByBookingId(booking.getId()).stream().sorted(Comparator.comparing(x -> x.getStaffSchedule().getId())).toList()) {
            if (link.getReleasedAt() != null) continue;
            staffSchedules.findForUpdate(link.getStaffSchedule().getId()).orElseThrow().setStatus("AVAILABLE");
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
        require(order.getPaidAmount().compareTo(order.getTotalAmount()) >= 0, "Vui lòng thu đủ tiền");
        order.setStatus("COMPLETED");
        Booking b = booking(order);
        b.setStatus("COMPLETED");
        b.setCheckOutAt(Instant.now());
        release(b);
        products.findByOrderId(id).stream().filter(x -> "RENTAL".equals(x.getItemType())).forEach(x -> x.setReturnedAt(Instant.now()));
        audit.log("CHECK-OUT", id.toString());
    }

    @Transactional
    public void move(UUID id, MoveBookingRequest request) {
        CustomerOrder order = lock(id);
        live(order);
        Booking b = booking(order);
        require(bookingStaff.findByBookingId(b.getId()).isEmpty(), "Chỉ đổi lịch đơn chưa gắn nhân sự");
        require(products.findByOrderId(id).stream().noneMatch(x -> "RENTAL".equals(x.getItemType()) && x.getReturnedAt() == null), "Trả thiết bị trước khi đổi lịch");
        // Lock old and new slots in the same order to avoid deadlocks between moves.
        List<UUID> all = new ArrayList<>(request.scheduleIds());
        allocated(b).forEach(x -> all.add(x.getId()));
        all.stream().distinct().sorted().forEach(x -> schedules.findForUpdate(x).orElseThrow());
        release(b);
        slots.flush();
        List<CourtSchedule> selected = scheduling.lockSlots(request.scheduleIds());
        scheduling.requireAvailable(selected);
        allocate(b, selected, "HOLDING".equals(order.getStatus()) ? "LOCKED" : "BOOKED");
        totals.recalculate(order);
        order.setDepositRequired(order.getTotalAmount().multiply(BigDecimal.valueOf(settings.get().getDepositPercent())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        audit.log("ĐỔI LỊCH", id.toString());
    }

    @Transactional
    public void addProduct(UUID id, AddProductRequest request) {
        CustomerOrder order = lock(id);
        live(order);
        Booking b = booking(order);
        OrderProduct row = new OrderProduct();
        row.setOrder(order);
        row.setBooking(b);
        row.setItemType(oneOf(request.type(), "DRINK", "RENTAL"));
        row.setQuantity(request.quantity());
        if ("DRINK".equals(request.type())) {
            Drink drink = drinks.findForUpdate(request.productId()).orElseThrow(() -> new BusinessException("Sản phẩm không tồn tại"));
            require("ACTIVE".equals(drink.getStatus()) && drink.getStockQuantity() >= request.quantity(), "Không đủ tồn kho");
            drink.setStockQuantity(drink.getStockQuantity() - request.quantity());
            row.setDrink(drink);
            row.setUnitPrice(drink.getUnitPrice());
        } else {
            RentalItem item = rentals.findForUpdate(request.productId()).orElseThrow(() -> new BusinessException("Đồ thuê không tồn tại"));
            List<CourtSchedule> selected = allocated(b);
            Instant start = selected.stream().map(x -> at(x.getScheduleDate(), x.getStartTime())).min(Comparator.naturalOrder()).orElseThrow();
            Instant end = start.plusSeconds(request.hours() * 3600L);
            for (int i = 0; i < request.hours(); i++) {
                Instant required = start.plusSeconds(i * 3600L);
                require(selected.stream().anyMatch(x -> at(x.getScheduleDate(), x.getStartTime()).equals(required)), "Giờ thuê phải nằm trong các giờ sân đã đặt liên tiếp");
            }
            require("ACTIVE".equals(item.getStatus()) && products.countRented(item.getId(), start, end) + request.quantity() <= item.getStockQuantity(), "Thiết bị không đủ trong khoảng giờ này");
            row.setRentalItem(item);
            row.setUnitPrice(item.getPricePerHour());
            row.setRentStartAt(start);
            row.setRentEndAt(end);
        }
        products.save(row);
        totals.recalculate(order);
        audit.log("THÊM SẢN PHẨM", id.toString());
    }

    @Transactional
    public void returnProduct(UUID id, UUID lineId) {
        CustomerOrder order = lock(id);
        OrderProduct row = products.findById(lineId).orElseThrow(() -> new BusinessException("Không tìm thấy dòng hàng"));
        require(row.getOrder().getId().equals(order.getId()) && "RENTAL".equals(row.getItemType()), "Dòng hàng không thuộc đơn này");
        if (row.getReturnedAt() == null) row.setReturnedAt(Instant.now());
        audit.log("TRẢ THIẾT BỊ", lineId.toString());
    }

    @Transactional
    public void assignStaff(UUID id, AssignStaffRequest request) {
        CustomerOrder order = lock(id);
        live(order);
        Booking b = booking(order);
        var selected = scheduling.lockStaffSlots(request.staffId(), allocated(b));
        for (StaffSchedule slot : selected) {
            slot.setStatus("BOOKED");
            BookingStaff link = new BookingStaff();
            link.setBooking(b);
            link.setStaffSchedule(slot);
            link.setUnitPrice(slot.getStaff().getHourlyRate());
            bookingStaff.save(link);
        }
        totals.recalculate(order);
        audit.log("PHÂN CÔNG", id.toString());
    }

    @Transactional
    public void invoice(UUID id) {
        CustomerOrder order = lock(id);
        require(!Set.of("HOLDING", "CANCELLED", "EXPIRED").contains(order.getStatus()), "Đơn chưa đủ điều kiện xuất phiếu thu");
        if (order.getInvoiceNumber() == null) {
            order.setInvoiceNumber("INV-" + order.getId());
            order.setIssuedAt(Instant.now());
        }
    }

    @Scheduled(fixedDelayString = "${courtly.expiry-interval-ms:30000}")
    @Transactional
    public void expireHolds() {
        for (var candidate : orders.findByStatusAndHoldExpiresAtBefore("HOLDING", Instant.now()).stream().sorted(Comparator.comparing(CustomerOrder::getId)).toList()) {
            CustomerOrder order = lock(candidate.getId());
            if (!"HOLDING".equals(order.getStatus()) || order.getHoldExpiresAt().isAfter(Instant.now())) continue;
            order.setStatus("EXPIRED");
            Booking b = booking(order);
            b.setStatus("CANCELLED");
            release(b);
            audit.log("HẾT HẠN", order.getId().toString());
        }
    }
}
