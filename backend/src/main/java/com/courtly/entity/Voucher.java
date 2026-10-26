package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
public class Voucher extends BaseEntity {
  @Column(name = "code", nullable = false, unique = true, length = 50)
  private String code;

  @Column(name = "type", nullable = false, length = 20)
  private String type; // FIXED or PERCENT

  @Column(name = "value", nullable = false, precision = 12, scale = 2)
  private BigDecimal value;

  @Column(name = "min_order", nullable = false, precision = 12, scale = 2)
  private BigDecimal minOrder = BigDecimal.ZERO;

  @Column(name = "max_discount", precision = 12, scale = 2)
  private BigDecimal maxDiscount;

  @Column(name = "starts_at")
  private Instant startsAt;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "usage_limit")
  private Integer usageLimit;

  @Column(name = "used_count", nullable = false)
  private Integer usedCount = 0;

  @Column(name = "per_user_limit")
  private Integer perUserLimit = 1;

  @Column(name = "member_only", nullable = false)
  private Boolean memberOnly = false;

  @Column(name = "new_user_only", nullable = false)
  private Boolean newUserOnly = false;

  @Column(name = "enabled", nullable = false)
  private Boolean enabled = true;

  @Column(name = "description")
  private String description;
}
