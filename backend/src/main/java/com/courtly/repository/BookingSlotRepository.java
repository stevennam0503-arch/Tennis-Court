package com.courtly.repository;

import com.courtly.entity.BookingSlot;

public interface BookingSlotRepository extends LockingRepository<BookingSlot> {
    java.util.List<BookingSlot> findByBookingId(java.util.UUID id);
    java.util.List<BookingSlot> findByReleasedAtIsNull();
}
