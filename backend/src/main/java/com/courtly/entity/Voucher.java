package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;
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

  @Column(name = "status", nullable = false, length = 20)
  private String status = "ACTIVE"; // DRAFT, PENDING_APPROVAL, ACTIVE, PAUSED, ENDED

  @Column(name = "created_by")
  private UUID createdBy;

  @Column(name = "approved_by")
  private UUID approvedBy;

  @Column(name = "approved_at")
  private Instant approvedAt;

  @Column(name = "campaign_id")
  private UUID campaignId;

  @Column(name = "zone", length = 20)
  private String zone; // OUTDOOR, INDOOR, VIP

  @Column(name = "valid_from_time")
  private LocalTime validFromTime;

  @Column(name = "valid_to_time")
  private LocalTime validToTime;

  @Column(name = "valid_weekdays", length = 50)
  private String validWeekdays; // e.g. "1,2,3,4,5" (1=Monday, 7=Sunday)

  @Column(name = "assigned_account_id")
  private UUID assignedAccountId;

  @Column(name = "source", length = 50)
  private String source = "GENERAL"; // GENERAL, FEEDBACK_RECOVERY, TIER_GIFT, BIRTHDAY, POINTS_REDEMPTION

  @Column(name = "feedback_id", length = 100)
  private String feedbackId;

  @Column(name = "order_id")
  private UUID orderId;

  @Column(name = "min_tier", length = 50)
  private String minTier; // ROOKIE, CHALLENGER, MASTERS, GRAND_SLAM
}
