package com.courtly.repository;

import com.courtly.entity.Campaign;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {
  List<Campaign> findByStatus(String status);

  List<Campaign> findAllByOrderByCreatedAtDesc();

  @Query("SELECT c FROM Campaign c WHERE c.status = 'RUNNING' AND (c.startsAt IS NULL OR c.startsAt <= :now) AND (c.endsAt IS NULL OR c.endsAt >= :now)")
  List<Campaign> findActiveRunning(@Param("now") Instant now);
}
