package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tournament_registrations")
@Getter
@Setter
@NoArgsConstructor
public class TournamentRegistration extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id", nullable = true)
  private Account account;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registered_by_account_id", nullable = true)
  private Account registeredByAccount;

  @Column(name = "team_name", nullable = false)
  private String teamName;

  @Column(name = "skill_level", nullable = true)
  private String skillLevel;

  @Column(name = "status", nullable = false)
  private String status = "PENDING";

  @Column(name = "registered_at", nullable = false)
  private Instant registeredAt = Instant.now();
}
