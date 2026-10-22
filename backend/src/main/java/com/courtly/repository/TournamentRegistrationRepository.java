package com.courtly.repository;

import com.courtly.entity.TournamentRegistration;
import org.springframework.data.jpa.repository.Query;

public interface TournamentRegistrationRepository
    extends LockingRepository<TournamentRegistration> {
  java.util.List<TournamentRegistration> findByTournamentId(java.util.UUID id);

  @Query("select tr from TournamentRegistration tr join fetch tr.tournament t join fetch tr.account a")
  java.util.List<TournamentRegistration> findAllWithTournamentAndAccount();
}
