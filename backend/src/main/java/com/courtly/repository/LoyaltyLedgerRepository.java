package com.courtly.repository;

import com.courtly.entity.LoyaltyLedger;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoyaltyLedgerRepository extends JpaRepository<LoyaltyLedger, UUID> {
  List<LoyaltyLedger> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

  List<LoyaltyLedger> findByOrderId(UUID orderId);

  Optional<LoyaltyLedger> findByTypeAndOrderId(String type, UUID orderId);

  @Query("SELECT COALESCE(SUM(l.points), 0) FROM LoyaltyLedger l WHERE l.account.id = :accountId")
  int sumPointsByAccountId(@Param("accountId") UUID accountId);
}
