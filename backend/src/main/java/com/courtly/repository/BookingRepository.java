package com.courtly.repository;

import com.courtly.entity.Booking;

public interface BookingRepository extends LockingRepository<Booking> {
    java.util.List<Booking> findByOrderId(java.util.UUID id);
}
