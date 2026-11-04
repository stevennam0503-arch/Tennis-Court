package com.courtly.repository;

import com.courtly.entity.VipCard;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VipCardRepository extends JpaRepository<VipCard, UUID> {
  Optional<VipCard> findByCode(String code);

  List<VipCard> findByAccountId(UUID accountId);

  Optional<VipCard> findFirstByAccountIdAndStatusOrderByIssuedAtDesc(UUID accountId, String status);
}
