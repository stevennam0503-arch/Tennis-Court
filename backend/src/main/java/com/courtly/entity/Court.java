package com.courtly.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "courts")
@Getter
@Setter
@NoArgsConstructor
public class Court extends BaseEntity {
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "type", nullable = false)
    private String type = "HARD";

    @Column(name = "description", nullable = true, columnDefinition = "text")
    private String description;

    @Column(name = "image_url", nullable = true)
    private String imageUrl;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "base_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal basePrice = BigDecimal.ZERO;

}
