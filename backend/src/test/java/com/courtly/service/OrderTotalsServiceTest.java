package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;

import com.courtly.entity.OrderProduct;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
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

  @Test
  void sharedTotalIncludesBothBenefitsAndClampsAtZero() {
    assertEquals(new BigDecimal("350000"), OrderTotalsService.discountedTotal(
        new BigDecimal("400000"), null, java.util.Map.of("discount", 50000)));
    assertEquals(new BigDecimal("300000"), OrderTotalsService.discountedTotal(
        new BigDecimal("400000"), java.util.Map.of("discount", 50000), java.util.Map.of("discount", 50000)));
    assertEquals(0, OrderTotalsService.discountedTotal(new BigDecimal("20000"), null,
        java.util.Map.of("discount", 50000)).signum());
  }

  @Test
  void voucherBaseAppliesAfterMemberDiscount() {
    // Member with 15% discount on 240.000:
    BigDecimal gross = new BigDecimal("240000");
    BigDecimal base = OrderTotalsService.voucherBase(gross, Map.of("discount", new BigDecimal("36000")));
    assertEquals(0, new BigDecimal("204000").compareTo(base));

    // Regular customer (no member discount):
    assertEquals(0, new BigDecimal("240000").compareTo(OrderTotalsService.voucherBase(gross, null)));

    // Discount exceeds gross:
    assertEquals(0, BigDecimal.ZERO.compareTo(OrderTotalsService.voucherBase(new BigDecimal("50000"), Map.of("discount", new BigDecimal("60000")))));
  }

  @Test
  void memberWithPercentageVoucherCalculatesCorrectNetTotal() {
    // 240.000 - 36.000 (15% member) = 204.000 -> 10% voucher on 204.000 = 20.400 -> total = 183.600
    BigDecimal gross = new BigDecimal("240000");
    Map<String, Object> memberBenefit = Map.of("discount", new BigDecimal("36000"));
    BigDecimal voucherBase = OrderTotalsService.voucherBase(gross, memberBenefit);
    assertEquals(0, new BigDecimal("204000").compareTo(voucherBase));

    BigDecimal voucherDiscount = voucherBase.multiply(new BigDecimal("10")).divide(new BigDecimal("100"));
    assertEquals(0, new BigDecimal("20400").compareTo(voucherDiscount));

    BigDecimal total = OrderTotalsService.discountedTotal(gross, memberBenefit, Map.of("discount", voucherDiscount));
    assertEquals(0, new BigDecimal("183600").compareTo(total));
  }

  @Test
  void memberWithFixedVoucherCalculatesCorrectNetTotal() {
    // 240.000 - 36.000 = 204.000 -> fixed voucher 50.000 -> total = 154.000
    BigDecimal gross = new BigDecimal("240000");
    Map<String, Object> memberBenefit = Map.of("discount", new BigDecimal("36000"));
    Map<String, Object> voucherBenefit = Map.of("discount", new BigDecimal("50000"));

    BigDecimal total = OrderTotalsService.discountedTotal(gross, memberBenefit, voucherBenefit);
    assertEquals(0, new BigDecimal("154000").compareTo(total));
  }

  @Test
  void regularCustomerWithVoucherCalculatesOnGross() {
    // Regular customer (0 member discount) -> 10% on 240.000 = 24.000 -> total = 216.000
    BigDecimal gross = new BigDecimal("240000");
    BigDecimal voucherBase = OrderTotalsService.voucherBase(gross, null);
    assertEquals(0, new BigDecimal("240000").compareTo(voucherBase));

    BigDecimal voucherDiscount = voucherBase.multiply(new BigDecimal("10")).divide(new BigDecimal("100"));
    BigDecimal total = OrderTotalsService.discountedTotal(gross, null, Map.of("discount", voucherDiscount));
    assertEquals(0, new BigDecimal("216000").compareTo(total));
  }

  @Test
  void voucherLargerThanOrderClampsTotalToZero() {
    BigDecimal gross = new BigDecimal("100000");
    Map<String, Object> voucherBenefit = Map.of("discount", new BigDecimal("150000"));
    BigDecimal total = OrderTotalsService.discountedTotal(gross, null, voucherBenefit);
    assertEquals(0, BigDecimal.ZERO.compareTo(total));
  }
}
