package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "court_prices")
@Getter
@Setter
@NoArgsConstructor
public class CourtPrice extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "court_id", nullable = false)
  private Court court;

  @Column(name = "day_type", nullable = false)
  private String dayType;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "price_per_hour", nullable = false, precision = 14, scale = 2)
  private BigDecimal pricePerHour = BigDecimal.ZERO;
}
