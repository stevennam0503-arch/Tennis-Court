package com.courtly.service;

import com.courtly.entity.AuditLog;
import com.courtly.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {
  private final AuditLogRepository repository;

  public void log(String action, String detail) {
    AuditLog log = new AuditLog();
    var actor =
        org.springframework.security.core.context.SecurityContextHolder.getContext()
            .getAuthentication();
    log.setActor(actor == null ? "Hệ thống" : actor.getName());
    log.setAction(action);
    log.setDetail(detail);
    repository.save(log);
  }
}
