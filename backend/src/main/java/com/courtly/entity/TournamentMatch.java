package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
public class TournamentMatch extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration1_id", nullable = true)
  private TournamentRegistration registration1;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration2_id", nullable = true)
  private TournamentRegistration registration2;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "winner_registration_id", nullable = true)
  private TournamentRegistration winnerRegistration;

  @Column(name = "round_number", nullable = false)
  private Integer roundNumber = 0;

  @Column(name = "bracket_index", nullable = false)
  private Integer bracketIndex = 0;

  @Column(name = "round_name", nullable = false)
  private String roundName;

  @Column(name = "score", nullable = true)
  private String score;

  @Column(name = "status", nullable = false)
  private String status = "SCHEDULED";

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by_account_id", nullable = true)
  private Account updatedByAccount;
}
