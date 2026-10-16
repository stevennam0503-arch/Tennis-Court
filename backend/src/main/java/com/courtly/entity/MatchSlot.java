package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "match_slots")
@Getter
@Setter
@NoArgsConstructor
public class MatchSlot extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "match_id", nullable = false)
  private TournamentMatch match;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "schedule_id", nullable = false)
  private CourtSchedule schedule;

  @Column(name = "released_at", nullable = true)
  private Instant releasedAt;
}
