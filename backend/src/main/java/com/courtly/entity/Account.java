package com.courtly.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account extends BaseEntity {
  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column(name = "email", nullable = true)
  private String email;

  @Column(name = "phone", nullable = false)
  private String phone;

  @Column(name = "password_hash", nullable = true)
  private String passwordHash;

  @Column(name = "role", nullable = false)
  private String role = "CUSTOMER";

  @Column(name = "status", nullable = false)
  private String status = "ACTIVE";

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(nullable = false)
  private Integer authVersion = 0;

  @Column(name = "phone_verified_at")
  private Instant phoneVerifiedAt;

  @Column(name = "email_verified_at")
  private Instant emailVerifiedAt;

  @Column(name = "notify_email")
  private Boolean notifyEmail = true;

  @Column(name = "notify_sms")
  private Boolean notifySms = true;

  @Column(name = "marketing_consent")
  private Boolean marketingConsent = false;

  @Column(name = "marketing_consent_at")
  private Instant marketingConsentAt;
}
