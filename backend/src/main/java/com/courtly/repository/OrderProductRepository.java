package com.courtly.repository;

import com.courtly.entity.OrderProduct;

public interface OrderProductRepository extends LockingRepository<OrderProduct> {
  java.util.List<OrderProduct> findByOrderId(java.util.UUID id);

  @org.springframework.data.jpa.repository.Query(
      "select coalesce(sum(p.quantity),0) from OrderProduct p where p.rentalItem.id=:item and"
          + " p.returnedAt is null and p.order.status not in ('CANCELLED','EXPIRED','COMPLETED')"
          + " and p.rentStartAt < :end and p.rentEndAt > :start")
  long countRented(
      @org.springframework.data.repository.query.Param("item") java.util.UUID item,
      @org.springframework.data.repository.query.Param("start") java.time.Instant start,
      @org.springframework.data.repository.query.Param("end") java.time.Instant end);
}
