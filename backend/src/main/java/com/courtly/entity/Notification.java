package com.courtly.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {
  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private UUID id;

  @Column(name = "account_id")
  private UUID accountId;

  @Column(name = "order_id")
  private UUID orderId;

  @Column(name = "campaign_id")
  private UUID campaignId;

  @Column(name = "type", nullable = false, length = 50)
  private String type;

  @Column(name = "channel", nullable = false, length = 20)
  private String channel; // EMAIL, SMS, IN_APP

  @Column(name = "recipient")
  private String recipient;

  @Column(name = "subject")
  private String subject;

  @Column(name = "body", nullable = false, columnDefinition = "TEXT")
  private String body;

  @Column(name = "status", nullable = false, length = 20)
  private String status = "QUEUED"; // QUEUED, SENT, FAILED, SKIPPED

  @Column(name = "attempts", nullable = false)
  private int attempts = 0;

  @Column(name = "last_error", columnDefinition = "TEXT")
  private String lastError;

  @Column(name = "scheduled_at", nullable = false)
  private Instant scheduledAt = Instant.now();

  @Column(name = "sent_at")
  private Instant sentAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "dedupe_key", unique = true)
  private String dedupeKey;
}
