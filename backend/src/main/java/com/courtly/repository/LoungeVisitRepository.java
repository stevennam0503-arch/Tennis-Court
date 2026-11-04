package com.courtly.repository;

import com.courtly.entity.LoungeVisit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LoungeVisitRepository extends JpaRepository<LoungeVisit, UUID> {
  List<LoungeVisit> findByCardIdOrderByCheckedInAtDesc(UUID cardId);

  @Query("SELECT v FROM LoungeVisit v JOIN FETCH v.card c JOIN FETCH c.account a ORDER BY v.checkedInAt DESC")
  List<LoungeVisit> findAllWithDetails();
}
