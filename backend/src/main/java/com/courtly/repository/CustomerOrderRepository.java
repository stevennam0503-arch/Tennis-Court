package com.courtly.repository;

import com.courtly.entity.CustomerOrder;
import org.springframework.data.jpa.repository.Query;

public interface CustomerOrderRepository extends LockingRepository<CustomerOrder> {
  java.util.List<CustomerOrder> findByStatusAndHoldExpiresAtBefore(
      String status, java.time.Instant before);

  @Query("select o from CustomerOrder o left join fetch o.customerAccount a order by o.createdAt desc")
  java.util.List<CustomerOrder> findAllWithCustomerAccount();

  long countByCustomerAccountIdAndStatusNotIn(java.util.UUID customerAccountId, java.util.Collection<String> statuses);
}
