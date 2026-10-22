package com.courtly.repository;

import com.courtly.entity.MatchSlot;
import org.springframework.data.jpa.repository.Query;

public interface MatchSlotRepository extends LockingRepository<MatchSlot> {
  java.util.List<MatchSlot> findByMatchId(java.util.UUID id);

  @Query("select ms from MatchSlot ms join fetch ms.schedule s join fetch s.court c")
  java.util.List<MatchSlot> findAllWithDetails();
}
