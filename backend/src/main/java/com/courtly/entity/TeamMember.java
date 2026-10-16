package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "team_members")
@Getter
@Setter
@NoArgsConstructor
public class TeamMember extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "registration_id", nullable = false)
  private TournamentRegistration registration;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "tournament_id", nullable = false)
  private Tournament tournament;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id", nullable = true)
  private Account account;

  @Column(name = "member_name", nullable = true)
  private String memberName;

  @Column(name = "phone", nullable = true)
  private String phone;
}
