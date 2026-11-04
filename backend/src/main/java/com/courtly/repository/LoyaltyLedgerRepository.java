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

  @Query("SELECT COALESCE(SUM(l.spendAmount), 0) FROM LoyaltyLedger l WHERE l.account.id = :accountId AND l.createdAt >= :since AND l.type IN ('EARN', 'REVERSAL')")
  java.math.BigDecimal sumSpendByAccountIdSince(@Param("accountId") UUID accountId, @Param("since") java.time.Instant since);
}
