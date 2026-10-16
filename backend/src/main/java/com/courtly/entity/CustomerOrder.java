package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
public class CustomerOrder extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_account_id", nullable = true)
  private Account customerAccount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by_account_id", nullable = true)
  private Account createdByAccount;

  @Column(name = "customer_name", nullable = false)
  private String customerName;

  @Column(name = "customer_phone", nullable = false)
  private String customerPhone;

  @Column(name = "status", nullable = false)
  private String status = "HOLDING";

  @Column(name = "hold_expires_at", nullable = true)
  private Instant holdExpiresAt;

  @Column(name = "subtotal", nullable = false, precision = 14, scale = 2)
  private BigDecimal subtotal = BigDecimal.ZERO;

  @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal totalAmount = BigDecimal.ZERO;

  @Column(name = "deposit_required", nullable = false, precision = 14, scale = 2)
  private BigDecimal depositRequired = BigDecimal.ZERO;

  @Column(name = "paid_amount", nullable = false, precision = 14, scale = 2)
  private BigDecimal paidAmount = BigDecimal.ZERO;

  @Column(name = "payment_status", nullable = false)
  private String paymentStatus = "UNPAID";

  @Column(name = "invoice_number", nullable = true)
  private String invoiceNumber;

  @Column(name = "issued_at", nullable = true)
  private Instant issuedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;

  @Column(nullable = false, columnDefinition = "text")
  private String metadata = "{}";
}
