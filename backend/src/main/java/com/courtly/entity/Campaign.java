package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "campaigns")
@Getter
@Setter
public class Campaign {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "TEXT")
  private String description;

  @Column(nullable = false, length = 30)
  private String status = "DRAFT"; // DRAFT, PENDING_APPROVAL, SCHEDULED, RUNNING, ENDED, CANCELLED

  @Column(name = "starts_at")
  private Instant startsAt;

  @Column(name = "ends_at")
  private Instant endsAt;

  @Column(length = 50)
  private String audience = "ALL"; // ALL, TIER, NEW_CUSTOMERS, INACTIVE_30D, NEAR_NEXT_TIER, CUSTOM_LIST

  @Column(name = "audience_filter", columnDefinition = "JSONB")
  private String audienceFilter;

  @Column(length = 100)
  private String channels = "EMAIL,SMS,BANNER";

  @Column(name = "message_title")
  private String messageTitle;

  @Column(name = "message_body", columnDefinition = "TEXT")
  private String messageBody;

  @Column(name = "banner_text", columnDefinition = "TEXT")
  private String bannerText;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private Account createdBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "approved_by")
  private Account approvedBy;

  @Column(name = "budget_limit", precision = 14, scale = 2)
  private BigDecimal budgetLimit;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();
}
