package com.courtly.repository;

import com.courtly.entity.MatchStaff;

public interface MatchStaffRepository extends LockingRepository<MatchStaff> {
  java.util.List<MatchStaff> findByMatchId(java.util.UUID id);
}
