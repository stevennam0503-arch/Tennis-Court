package com.courtly.repository;

import com.courtly.entity.TeamMember;

public interface TeamMemberRepository extends LockingRepository<TeamMember> {
  java.util.List<TeamMember> findByRegistrationId(java.util.UUID id);
}
