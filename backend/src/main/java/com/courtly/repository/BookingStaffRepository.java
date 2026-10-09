package com.courtly.repository;

import com.courtly.entity.BookingStaff;

public interface BookingStaffRepository extends LockingRepository<BookingStaff> {
    java.util.List<BookingStaff> findByBookingId(java.util.UUID id);
}
