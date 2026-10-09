package com.courtly.service;

import com.courtly.dto.request.*;
import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
    @Mock PaymentRepository payments;
    @Mock RefundRepository refunds;
    @Mock CustomerOrderRepository orders;
    @Mock TournamentRegistrationRepository registrations;
    @Mock TournamentMatchRepository matches;
    @Mock BookingRepository bookings;
    @Mock BookingSlotRepository slots;
    @Mock OrderTotalsService totals;
    @Mock AuditService audit;
    @InjectMocks PaymentService service;

    private CustomerOrder order() {
        CustomerOrder o = new CustomerOrder();
        o.setId(UUID.randomUUID());
        o.setTotalAmount(new BigDecimal("400000"));
        o.setDepositRequired(new BigDecimal("200000"));
        o.setPaidAmount(BigDecimal.ZERO);
        o.setHoldExpiresAt(Instant.now().plusSeconds(600));
        return o;
    }
    @Test void rejectsOverpaymentBeforePersisting() {
        CustomerOrder o = order();
        when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
        var request = new PaymentRequest(o.getId(),null,new BigDecimal("400001"),"CASH","test-overpay");
        assertThrows(BusinessException.class,()->service.collect(request));
        verify(payments,never()).save(any());
        assertEquals(BigDecimal.ZERO,o.getPaidAmount());
    }
    @Test void enoughDepositConfirmsBookingAndMarksSlotsBooked() {
        CustomerOrder o = order();
        Booking b = new Booking(); b.setId(UUID.randomUUID()); b.setOrder(o);
        CourtSchedule schedule = new CourtSchedule(); schedule.setStatus("LOCKED");
        BookingSlot slot = new BookingSlot(); slot.setSchedule(schedule);
        when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
        when(bookings.findByOrderId(o.getId())).thenReturn(List.of(b));
        when(slots.findByBookingId(b.getId())).thenReturn(List.of(slot));
        when(payments.save(any())).thenAnswer(call->{Payment p=call.getArgument(0);p.setId(UUID.randomUUID());return p;});
        service.collect(new PaymentRequest(o.getId(),null,new BigDecimal("200000"),"CASH","test-deposit"));
        assertEquals("CONFIRMED",o.getStatus()); assertEquals("CONFIRMED",b.getStatus()); assertEquals("BOOKED",schedule.getStatus());
        assertEquals(0,o.getPaidAmount().compareTo(new BigDecimal("200000")));
    }
    @Test void expiredHoldCannotBePaid() {
        CustomerOrder o=order();o.setHoldExpiresAt(Instant.now().minusSeconds(1));
        when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
        assertThrows(BusinessException.class,()->service.collect(new PaymentRequest(o.getId(),null,new BigDecimal("100"),"CASH","expired")));
        verify(payments,never()).save(any());
    }
    @Test void sameTransactionCodeCannotPayAnotherOrder() {
        Payment p=new Payment();p.setId(UUID.randomUUID());p.setOrder(order());p.setAmount(new BigDecimal("100"));p.setMethod("CASH");
        when(payments.findByTransactionCode("duplicate")).thenReturn(Optional.of(p));
        assertThrows(BusinessException.class,()->service.collect(new PaymentRequest(UUID.randomUUID(),null,new BigDecimal("100"),"CASH","duplicate")));
        verify(orders,never()).findForUpdate(any());
    }
    @Test void refundCannotExceedRemainingReceipt() {
        CustomerOrder o=order();o.setStatus("CONFIRMED");o.setPaidAmount(new BigDecimal("100"));
        Payment p=new Payment();p.setId(UUID.randomUUID());p.setOrder(o);p.setAmount(new BigDecimal("200"));
        Refund prior=new Refund();prior.setAmount(new BigDecimal("100"));
        when(payments.findById(p.getId())).thenReturn(Optional.of(p));
        when(payments.findForUpdate(p.getId())).thenReturn(Optional.of(p));
        when(orders.findForUpdate(o.getId())).thenReturn(Optional.of(o));
        when(refunds.findByPaymentId(p.getId())).thenReturn(List.of(prior));
        assertThrows(BusinessException.class,()->service.refund(p.getId(),new RefundRequest(new BigDecimal("101"),"test")));
        verify(refunds,never()).save(any());
        assertEquals(new BigDecimal("100"),o.getPaidAmount());
    }
}
