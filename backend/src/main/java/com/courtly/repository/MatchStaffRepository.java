package com.courtly.repository;

import com.courtly.entity.MatchStaff;
import org.springframework.data.jpa.repository.Query;

public interface MatchStaffRepository extends LockingRepository<MatchStaff> {
  java.util.List<MatchStaff> findByMatchId(java.util.UUID id);

  @Query("select ms from MatchStaff ms join fetch ms.staffSchedule ss join fetch ss.staff s")
  java.util.List<MatchStaff> findAllWithDetails();
}
