package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_products")
@Getter
@Setter
@NoArgsConstructor
public class OrderProduct extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id", nullable = false)
  private CustomerOrder order;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "booking_id", nullable = false)
  private Booking booking;

  @Column(name = "item_type", nullable = false)
  private String itemType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "drink_id", nullable = true)
  private Drink drink;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "rental_item_id", nullable = true)
  private RentalItem rentalItem;

  @Column(name = "quantity", nullable = false)
  private Integer quantity = 0;

  @Column(name = "rent_start_at", nullable = true)
  private Instant rentStartAt;

  @Column(name = "rent_end_at", nullable = true)
  private Instant rentEndAt;

  @Column(name = "returned_at", nullable = true)
  private Instant returnedAt;

  @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(name = "item_condition")
  private String condition;

  private Instant issuedAt;
}
