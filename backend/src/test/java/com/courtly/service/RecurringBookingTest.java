package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.courtly.dto.request.BookingRequest;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RecurringBookingTest {
  private CourtScheduleRepository schedules;
  private ScheduleService scheduling;
  private CustomerOrderRepository orders;
  private AccountRepository accounts;
  private BookingRepository bookings;
  private BookingSlotRepository slots;
  private SettingsService settings;
  private OrderTotalsService totals;
  private DocumentService documents;
  private MembershipService membership;
  private VoucherService vouchers;
  private OrderService orderService;

  @BeforeEach
  void setUp() {
    schedules = mock(CourtScheduleRepository.class);
    scheduling = mock(ScheduleService.class);
    orders = mock(CustomerOrderRepository.class);
    accounts = mock(AccountRepository.class);
    bookings = mock(BookingRepository.class);
    slots = mock(BookingSlotRepository.class);
    settings = mock(SettingsService.class);
    totals = mock(OrderTotalsService.class);
    documents = mock(DocumentService.class);
    membership = mock(MembershipService.class);
    vouchers = mock(VoucherService.class);

    ClubSettings cs = new ClubSettings();
    cs.setHoldMinutes(5);
    cs.setDepositPercent(50);
    when(settings.get()).thenReturn(cs);
    when(documents.decode(any())).thenReturn(new HashMap<>());
    when(documents.encode(any())).thenReturn("{}");

    orderService =
        new OrderService(
            orders,
            accounts,
            bookings,
            slots,
            null,
            schedules,
            null,
            scheduling,
            settings,
            totals,
            mock(AuditService.class),
            documents,
            membership,
            vouchers);
  }

  @Test
  void testRecurringBookingConflictThrowsDetailedMessage() {
    Court court = new Court();
    court.setId(UUID.randomUUID());
    court.setName("Sân 1");
    court.setStatus("ACTIVE");

    UUID slot1Id = UUID.randomUUID();
    CourtSchedule slot1 = new CourtSchedule();
    slot1.setId(slot1Id);
    slot1.setCourt(court);
    slot1.setScheduleDate(LocalDate.now().plusDays(1));
    slot1.setStartTime(LocalTime.of(8, 0));
    slot1.setEndTime(LocalTime.of(8, 30));
    slot1.setStatus("AVAILABLE");
    slot1.setPrice(BigDecimal.valueOf(100000));

    when(scheduling.lockSlots(List.of(slot1Id))).thenReturn(List.of(slot1));

    // Week 2 slot is already BOOKED
    UUID slot2Id = UUID.randomUUID();
    CourtSchedule slot2 = new CourtSchedule();
    slot2.setId(slot2Id);
    slot2.setCourt(court);
    slot2.setScheduleDate(LocalDate.now().plusDays(8));
    slot2.setStartTime(LocalTime.of(8, 0));
    slot2.setEndTime(LocalTime.of(8, 30));
    slot2.setStatus("BOOKED"); // CONFLICT!
    slot2.setPrice(BigDecimal.valueOf(100000));

    when(schedules.findByCourtIdAndScheduleDate(eq(court.getId()), eq(LocalDate.now().plusDays(8))))
        .thenReturn(List.of(slot2));
    when(schedules.findForUpdate(slot2Id)).thenReturn(Optional.of(slot2));

    BookingRequest req =
        new BookingRequest(
            "Nguyen Van A",
            "0912345678",
            null,
            List.of(slot1Id),
            List.of(),
            "req-1",
            null,
            4);

    BusinessException ex = assertThrows(BusinessException.class, () -> orderService.create(req));
    assertTrue(ex.getMessage().contains("đã có người đặt hoặc đang bảo trì"));
    assertTrue(ex.getMessage().contains("tuần 2"));
  }

  @Test
  void testRecurringBookingInvalidWeeks() {
    UUID slot1Id = UUID.randomUUID();
    BookingRequest req =
        new BookingRequest(
            "Nguyen Van A",
            "0912345678",
            null,
            List.of(slot1Id),
            List.of(),
            "req-2",
            null,
            20); // Out of bounds (>12)

    BusinessException ex = assertThrows(BusinessException.class, () -> orderService.create(req));
    assertTrue(ex.getMessage().contains("Số tuần định kỳ không hợp lệ"));
  }
}
