package com.courtly.repository;

import com.courtly.entity.CourtSchedule;

public interface CourtScheduleRepository extends LockingRepository<CourtSchedule> {
    java.util.List<CourtSchedule> findByScheduleDateOrderByStartTime(java.time.LocalDate date);
    java.util.List<CourtSchedule> findByCourtIdAndScheduleDate(java.util.UUID court, java.time.LocalDate date);
}
