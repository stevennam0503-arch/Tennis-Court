package com.courtly.repository;

import com.courtly.entity.Refund;

public interface RefundRepository extends LockingRepository<Refund> {
    java.util.List<Refund> findByPaymentId(java.util.UUID id);
}
