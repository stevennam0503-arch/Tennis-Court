package com.courtly.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
public class Booking extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    @Column(name = "status", nullable = false)
    private String status = "PENDING";

    @Column(name = "check_in_at", nullable = true)
    private Instant checkInAt;

    @Column(name = "check_out_at", nullable = true)
    private Instant checkOutAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

}
