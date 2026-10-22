package com.courtly.repository;

import com.courtly.entity.BookingStaff;
import org.springframework.data.jpa.repository.Query;

public interface BookingStaffRepository extends LockingRepository<BookingStaff> {
  java.util.List<BookingStaff> findByBookingId(java.util.UUID id);

  @Query("select bs from BookingStaff bs join fetch bs.staffSchedule ss join fetch ss.staff s left join fetch bs.courtSchedule cs left join fetch cs.court c")
  java.util.List<BookingStaff> findAllWithDetails();
}
