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
        log.setActor("Quản lý local");
        log.setAction(action);
        log.setDetail(detail);
        repository.save(log);
    }
}
