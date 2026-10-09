package com.courtly.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "match_staff")
@Getter
@Setter
@NoArgsConstructor
public class MatchStaff extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false)
    private TournamentMatch match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_schedule_id", nullable = false)
    private StaffSchedule staffSchedule;

    @Column(name = "role", nullable = false)
    private String role = "REFEREE";

    @Column(name = "released_at", nullable = true)
    private Instant releasedAt;

}
