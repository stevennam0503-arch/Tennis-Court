package com.courtly.repository;

import com.courtly.entity.MatchSlot;

public interface MatchSlotRepository extends LockingRepository<MatchSlot> {
  java.util.List<MatchSlot> findByMatchId(java.util.UUID id);
}
