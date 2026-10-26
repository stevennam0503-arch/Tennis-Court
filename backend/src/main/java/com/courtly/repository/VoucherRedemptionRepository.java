package com.courtly.repository;

import com.courtly.entity.VoucherRedemption;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoucherRedemptionRepository extends JpaRepository<VoucherRedemption, UUID> {
  Optional<VoucherRedemption> findByOrderId(UUID orderId);

  long countByVoucherIdAndAccountId(UUID voucherId, UUID accountId);

  void deleteByOrderId(UUID orderId);
}
