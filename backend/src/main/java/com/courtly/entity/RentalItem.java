package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "rental_items")
@Getter
@Setter
@NoArgsConstructor
public class RentalItem extends BaseEntity {
  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "category", nullable = false)
  private String category = "RACKET";

  @Column(name = "brand", nullable = true)
  private String brand;

  @Column(name = "price_per_hour", nullable = false, precision = 14, scale = 2)
  private BigDecimal pricePerHour = BigDecimal.ZERO;

  @Column(name = "stock_quantity", nullable = false)
  private Integer stockQuantity = 0;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;
}
