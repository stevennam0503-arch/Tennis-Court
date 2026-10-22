package com.courtly.repository;

import com.courtly.entity.Refund;
import org.springframework.data.jpa.repository.Query;

public interface RefundRepository extends LockingRepository<Refund> {
  java.util.List<Refund> findByPaymentId(java.util.UUID id);

  @Query("select r from Refund r join fetch r.payment p order by r.refundedAt desc")
  java.util.List<Refund> findAllWithPayment();
}
