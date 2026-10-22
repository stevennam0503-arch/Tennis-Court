package com.courtly.repository;

import com.courtly.entity.StaffSchedule;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffScheduleRepository extends LockingRepository<StaffSchedule> {
  java.util.List<StaffSchedule> findByStaffIdAndWorkDate(
      java.util.UUID id, java.time.LocalDate date);

  @Query("select s from StaffSchedule s join fetch s.staff st where s.workDate = :date order by s.startTime")
  java.util.List<StaffSchedule> findByWorkDateOrderByStartTime(@Param("date") java.time.LocalDate date);
}
