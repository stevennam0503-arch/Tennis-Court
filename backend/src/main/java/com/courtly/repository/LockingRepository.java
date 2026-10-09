package com.courtly.repository;

import com.courtly.entity.BaseEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;
import java.util.*;

@NoRepositoryBean
public interface LockingRepository<T extends BaseEntity> extends JpaRepository<T, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from #{#entityName} e where e.id = :id")
    Optional<T> findForUpdate(@Param("id") UUID id);
}
