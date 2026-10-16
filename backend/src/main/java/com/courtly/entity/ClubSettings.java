package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "club_settings")
@Getter
@Setter
@NoArgsConstructor
public class ClubSettings extends BaseEntity {
  @Column(name = "hold_minutes", nullable = false)
  private Integer holdMinutes = 0;

  @Column(name = "deposit_percent", nullable = false)
  private Integer depositPercent = 0;

  @Column(name = "cancel_refund_percent", nullable = false)
  private Integer cancelRefundPercent = 0;

  @Column(nullable = false, columnDefinition = "text")
  private String policies = "{}";
}
