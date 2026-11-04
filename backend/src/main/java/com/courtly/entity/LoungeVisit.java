package com.courtly.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "lounge_visits")
@Getter
@Setter
@NoArgsConstructor
public class LoungeVisit {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "card_id", nullable = false)
  private VipCard card;

  @Column(name = "checked_in_at", nullable = false)
  private Instant checkedInAt = Instant.now();

  @Column(name = "staff_id")
  private UUID staffId;
}
