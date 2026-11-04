package com.courtly.repository;

import com.courtly.entity.Notification;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
  Optional<Notification> findByDedupeKey(String dedupeKey);

  List<Notification> findTop50ByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(
      String status, Instant now);

  List<Notification> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

  List<Notification> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

  @Query("""
      SELECT n FROM Notification n
      WHERE (:channel IS NULL OR n.channel = :channel)
        AND (:type IS NULL OR n.type = :type)
        AND (:status IS NULL OR n.status = :status)
      ORDER BY n.createdAt DESC
  """)
  List<Notification> search(
      @Param("channel") String channel,
      @Param("type") String type,
      @Param("status") String status);
}
