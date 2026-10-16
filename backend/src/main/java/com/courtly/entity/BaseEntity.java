package com.courtly.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;
}
