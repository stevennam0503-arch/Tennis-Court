package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "loyalty_ledger")
@Getter
@Setter
@NoArgsConstructor
public class LoyaltyLedger {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id", nullable = false)
  private Account account;

  @Column(name = "type", nullable = false, length = 30)
  private String type; // EARN, EARN_BONUS, REDEEM_ORDER, REDEEM_REWARD, REVERSAL, EXPIRE, ADJUST, TIER_GIFT, REFERRAL

  @Column(name = "points", nullable = false)
  private Integer points;

  @Column(name = "spend_amount", precision = 14, scale = 2)
  private BigDecimal spendAmount;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "order_id")
  private CustomerOrder order;

  @Column(name = "registration_id")
  private UUID registrationId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "voucher_id")
  private Voucher voucher;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "note")
  private String note;

  @Column(name = "created_by")
  private UUID createdBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
}
