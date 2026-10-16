package com.courtly.repository;

import com.courtly.entity.AppDocument;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface AppDocumentRepository extends JpaRepository<AppDocument, String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from AppDocument d where d.key=:key")
  Optional<AppDocument> lock(@Param("key") String key);

  List<AppDocument> findByKeyStartingWith(String prefix);
}
