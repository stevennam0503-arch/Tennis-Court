package com.courtly.repository;

import com.courtly.entity.Payment;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends LockingRepository<Payment> {
  java.util.List<Payment> findByOrderId(java.util.UUID id);

  java.util.List<Payment> findByRegistrationId(java.util.UUID id);

  java.util.Optional<Payment> findByTransactionCode(String code);

  @Query(
      "select p from Payment p left join fetch p.order left join fetch p.registration left join fetch p.receivedByAccount order by p.paidAt desc")
  java.util.List<Payment> findAllWithOrderAndRegistration();
}
