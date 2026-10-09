package com.courtly.repository;

import com.courtly.entity.CustomerOrder;

public interface CustomerOrderRepository extends LockingRepository<CustomerOrder> {
    java.util.List<CustomerOrder> findByStatusAndHoldExpiresAtBefore(String status, java.time.Instant before);
}
