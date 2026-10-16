package com.courtly.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "app_documents")
@Getter
@Setter
@NoArgsConstructor
public class AppDocument {
  @Id
  @Column(name = "document_key", length = 255)
  private String key;

  @Column(nullable = false, columnDefinition = "text")
  private String data = "{}";

  @Version private Long version;

  public AppDocument(String key) {
    this.key = key;
  }
}
