package com.courtly.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = true)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_id", nullable = true)
    private TournamentRegistration registration;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by_account_id", nullable = true)
    private Account receivedByAccount;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "method", nullable = false)
    private String method;

    @Column(name = "amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "transaction_code", nullable = false)
    private String transactionCode;

    @Column(name = "qr_content", nullable = true, columnDefinition = "text")
    private String qrContent;

    @Column(name = "qr_expires_at", nullable = true)
    private Instant qrExpiresAt;

    @Column(name = "status", nullable = false)
    private String status = "PAID";

    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

}
