package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.entity.OrderProduct;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrderTotalsServiceTest {
  private final OrderTotalsService service = new OrderTotalsService(null, null, null, null);

  @Test
  void rentalUsesPriceSnapshotQuantityAndDuration() {
    OrderProduct p = new OrderProduct();
    p.setItemType("RENTAL");
    p.setQuantity(2);
    p.setUnitPrice(new BigDecimal("50000"));
    p.setRentStartAt(Instant.parse("2026-10-08T01:00:00Z"));
    p.setRentEndAt(Instant.parse("2026-10-08T03:00:00Z"));
    assertEquals(new BigDecimal("200000.00"), service.productTotal(p));
  }

  @Test
  void drinksAreNotChargedByRentalDuration() {
    OrderProduct p = new OrderProduct();
    p.setItemType("DRINK");
    p.setQuantity(3);
    p.setUnitPrice(new BigDecimal("15000"));
    assertEquals(new BigDecimal("45000.00"), service.productTotal(p));
  }
}
