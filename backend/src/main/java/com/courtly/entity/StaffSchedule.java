package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "staff_schedules")
@Getter
@Setter
@NoArgsConstructor
public class StaffSchedule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "staff_id", nullable = false)
  private Staff staff;

  @Column(name = "work_date", nullable = false)
  private LocalDate workDate;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "status", nullable = false)
  private String status = "AVAILABLE";

  @Version
  // Leave null until persisted so Spring Data detects a new entity correctly.
  private Long version;
}
