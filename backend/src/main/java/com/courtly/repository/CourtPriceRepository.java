package com.courtly.repository;

import com.courtly.entity.CourtPrice;
import org.springframework.data.jpa.repository.Query;

public interface CourtPriceRepository extends LockingRepository<CourtPrice> {
  java.util.List<CourtPrice> findByCourtId(java.util.UUID court);

  @Query("select p from CourtPrice p join fetch p.court c")
  java.util.List<CourtPrice> findAllWithCourt();
}
