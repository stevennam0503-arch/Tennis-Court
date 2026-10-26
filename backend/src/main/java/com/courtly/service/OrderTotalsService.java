package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderTotalsService {
  @org.springframework.beans.factory.annotation.Autowired private DocumentService documents;
  private final BookingRepository bookings;
  private final BookingSlotRepository slots;
  private final BookingStaffRepository staff;
  private final OrderProductRepository products;

  public BigDecimal productTotal(OrderProduct p) {
    BigDecimal duration =
        "RENTAL".equals(p.getItemType())
            ? BigDecimal.valueOf(Duration.between(p.getRentStartAt(), p.getRentEndAt()).toMinutes())
                .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP)
            : BigDecimal.ONE;
    return p.getUnitPrice()
        .multiply(BigDecimal.valueOf(p.getQuantity()))
        .multiply(duration)
        .setScale(2, RoundingMode.HALF_UP);
  }

  public void recalculate(CustomerOrder order) {
    BigDecimal sum = BigDecimal.ZERO;
    for (Booking booking : bookings.findByOrderId(order.getId())) {
      for (var s : slots.findByBookingId(booking.getId())) {
        if (s.getReleasedAt() == null) sum = sum.add(s.getUnitPrice());
      }
      for (var s : staff.findByBookingId(booking.getId())) {
        if (s.getReleasedAt() == null)
          sum =
              sum.add(
                  s.getUnitPrice()
                      .multiply(
                          hours(
                              s.getStaffSchedule().getStartTime(),
                              s.getStaffSchedule().getEndTime())));
      }
    }
    for (var p : products.findByOrderId(order.getId())) sum = sum.add(productTotal(p));
    // Preserve excess receipts after cheaper moves for explicit reconciliation.
    if (documents != null) {
      var extra = documents.decode(order.getMetadata());
      Object benefit = extra.get("membershipBenefit");
      if (benefit instanceof java.util.Map<?, ?> m)
        sum = sum.subtract(PresentationService.decimal(m.get("discount")));
      Object voucher = extra.get("voucherBenefit");
      if (voucher instanceof java.util.Map<?, ?> vm)
        sum = sum.subtract(PresentationService.decimal(vm.get("discount")));
      if (sum.compareTo(BigDecimal.ZERO) < 0) sum = BigDecimal.ZERO;
    }
    order.setSubtotal(sum);
    order.setTotalAmount(sum);
    updatePaymentStatus(order);
  }

  public void updatePaymentStatus(CustomerOrder order) {
    order.setPaymentStatus(
        order.getPaidAmount().signum() == 0
            ? "UNPAID"
            : order.getPaidAmount().compareTo(order.getTotalAmount()) >= 0 ? "PAID" : "PARTIAL");
  }
}
