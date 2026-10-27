package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "courts")
@Getter
@Setter
@NoArgsConstructor
public class Court extends BaseEntity {
  @Column(name = "zone_needs_review", nullable = false)
  private boolean zoneNeedsReview;
  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "type", nullable = false)
  private String type = "OUTDOOR";

  @Column(name = "description", nullable = true, columnDefinition = "text")
  private String description;

  @Column(name = "image_url", nullable = true)
  private String imageUrl;

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Column(name = "base_price", nullable = false, precision = 14, scale = 2)
  private BigDecimal basePrice = BigDecimal.ZERO;

  @Column(columnDefinition = "text")
  private String address = "";

  @Column(columnDefinition = "text")
  private String amenities = "";

  @Column(nullable = false)
  private boolean imageIsIllustration = true;
}
