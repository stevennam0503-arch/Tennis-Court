package com.courtly.repository;

import com.courtly.entity.Payment;

public interface PaymentRepository extends LockingRepository<Payment> {
  java.util.List<Payment> findByOrderId(java.util.UUID id);

  java.util.List<Payment> findByRegistrationId(java.util.UUID id);

  java.util.Optional<Payment> findByTransactionCode(String code);
}
