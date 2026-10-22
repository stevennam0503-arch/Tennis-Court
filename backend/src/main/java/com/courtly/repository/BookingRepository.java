package com.courtly.repository;

import com.courtly.entity.Booking;
import org.springframework.data.jpa.repository.Query;

public interface BookingRepository extends LockingRepository<Booking> {
  java.util.List<Booking> findByOrderId(java.util.UUID id);

  @Query("select b from Booking b join fetch b.order o")
  java.util.List<Booking> findAllWithOrder();
}
