package com.courtly.repository;

import com.courtly.entity.Voucher;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoucherRepository extends LockingRepository<Voucher> {
  Optional<Voucher> findByCodeIgnoreCase(String code);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select v from Voucher v where upper(v.code) = upper(:code)")
  Optional<Voucher> findByCodeForUpdate(@Param("code") String code);

  List<Voucher> findByEnabledTrue();
}
