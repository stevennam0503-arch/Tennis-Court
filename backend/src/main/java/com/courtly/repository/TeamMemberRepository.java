package com.courtly.repository;

import com.courtly.entity.TeamMember;
import org.springframework.data.jpa.repository.Query;

public interface TeamMemberRepository extends LockingRepository<TeamMember> {
  java.util.List<TeamMember> findByRegistrationId(java.util.UUID id);

  @Query("select m from TeamMember m join fetch m.registration r")
  java.util.List<TeamMember> findAllWithRegistration();
}
