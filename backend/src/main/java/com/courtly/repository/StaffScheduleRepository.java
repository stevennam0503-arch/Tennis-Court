package com.courtly.repository;

import com.courtly.entity.StaffSchedule;

public interface StaffScheduleRepository extends LockingRepository<StaffSchedule> {
    java.util.List<StaffSchedule> findByStaffIdAndWorkDate(java.util.UUID id, java.time.LocalDate date);
}
