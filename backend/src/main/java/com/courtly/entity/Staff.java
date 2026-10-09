package com.courtly.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "staff")
@Getter
@Setter
@NoArgsConstructor
public class Staff extends BaseEntity {
    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "phone", nullable = false)
    private String phone;

    @Column(name = "type", nullable = false)
    private String type = "REFEREE";

    @Column(name = "level", nullable = true)
    private String level;

    @Column(name = "hourly_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal hourlyRate = BigDecimal.ZERO;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

}
