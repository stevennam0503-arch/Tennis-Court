package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refunds")
@Getter
@Setter
@NoArgsConstructor
public class Refund extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "payment_id", nullable = false)
  private Payment payment;

  @Column(name = "amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(name = "reason", nullable = false)
  private String reason;

  @Column(name = "status", nullable = false)
  private String status = "DONE";

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "processed_by_account_id", nullable = true)
  private Account processedByAccount;

  @Column(name = "refunded_at", nullable = false)
  private Instant refundedAt;
}
