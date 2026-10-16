package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog extends BaseEntity {
  @Column(name = "actor", nullable = false)
  private String actor;

  @Column(name = "action", nullable = false)
  private String action;

  @Column(name = "detail", nullable = false, columnDefinition = "text")
  private String detail;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
}
