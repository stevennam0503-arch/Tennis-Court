package com.courtly.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tournaments")
@Getter
@Setter
@NoArgsConstructor
public class Tournament extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "organizer_account_id", nullable = true)
  private Account organizerAccount;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "format", nullable = false)
  private String format = "DOUBLES";

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(name = "location", nullable = false)
  private String location;

  @Column(name = "registration_fee", nullable = false, precision = 14, scale = 2)
  private BigDecimal registrationFee = BigDecimal.ZERO;

  @Column(name = "registration_deadline", nullable = false)
  private LocalDate registrationDeadline;

  @Column(name = "max_participants", nullable = false)
  private Integer maxParticipants = 0;

  @Column(name = "status", nullable = false)
  private String status = "OPEN";
}
