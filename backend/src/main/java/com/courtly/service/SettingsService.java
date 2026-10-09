package com.courtly.service;

import com.courtly.dto.request.SettingsRequest;
import com.courtly.entity.ClubSettings;
import com.courtly.repository.ClubSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SettingsService {
    private final ClubSettingsRepository repository;
    @Transactional
    public ClubSettings get() {
        return repository.findAll().stream().findFirst().orElseGet(() -> {
            ClubSettings settings = new ClubSettings();
            settings.setHoldMinutes(10);
            settings.setDepositPercent(50);
            settings.setCancelRefundPercent(100);
            return repository.save(settings);
        });
    }
    @Transactional
    public void update(SettingsRequest request) {
        ClubSettings settings = get();
        settings.setHoldMinutes(request.holdMinutes());
        settings.setDepositPercent(request.depositPercent());
        settings.setCancelRefundPercent(request.cancelRefundPercent());
        repository.save(settings);
    }
}
