package com.courtly.repository;

import com.courtly.entity.BookingSlot;
import org.springframework.data.jpa.repository.Query;

public interface BookingSlotRepository extends LockingRepository<BookingSlot> {
  java.util.List<BookingSlot> findByBookingId(java.util.UUID id);

  java.util.List<BookingSlot> findByReleasedAtIsNull();

  @Query("select bs from BookingSlot bs join fetch bs.schedule s join fetch s.court c")
  java.util.List<BookingSlot> findAllWithDetails();
}
