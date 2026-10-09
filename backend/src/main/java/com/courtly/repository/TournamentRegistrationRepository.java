package com.courtly.repository;

import com.courtly.entity.TournamentRegistration;

public interface TournamentRegistrationRepository extends LockingRepository<TournamentRegistration> {
    java.util.List<TournamentRegistration> findByTournamentId(java.util.UUID id);
}
