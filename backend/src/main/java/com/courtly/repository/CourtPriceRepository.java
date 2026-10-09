package com.courtly.repository;

import com.courtly.entity.CourtPrice;

public interface CourtPriceRepository extends LockingRepository<CourtPrice> {
    java.util.List<CourtPrice> findByCourtId(java.util.UUID court);
}
