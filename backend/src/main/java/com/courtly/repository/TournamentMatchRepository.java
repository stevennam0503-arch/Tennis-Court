package com.courtly.repository;

import com.courtly.entity.TournamentMatch;

public interface TournamentMatchRepository extends LockingRepository<TournamentMatch> {
  java.util.List<TournamentMatch> findByTournamentId(java.util.UUID id);
}
