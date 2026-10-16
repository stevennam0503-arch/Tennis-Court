package com.courtly.repository;

import com.courtly.entity.AuditLog;

public interface AuditLogRepository extends LockingRepository<AuditLog> {
  java.util.List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
