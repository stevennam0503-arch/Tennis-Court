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
  private final DocumentService documents;

  @Transactional
  public ClubSettings get() {
    return repository.findAll().stream()
        .findFirst()
        .orElseGet(
            () -> {
              ClubSettings settings = new ClubSettings();
              settings.setHoldMinutes(5);
              settings.setDepositPercent(50);
              settings.setCancelRefundPercent(100);
              settings.setPolicies("{\"cancelCutoffMinutes\":1440,\"changeCutoffMinutes\":1440}");
              return repository.save(settings);
            });
  }

  @Transactional
  public void update(SettingsRequest request) {
    ClubSettings settings = get();
    settings.setHoldMinutes(request.holdMinutes());
    settings.setDepositPercent(request.depositPercent());
    settings.setCancelRefundPercent(request.cancelRefundPercent());
    if (request.policies() != null) {
      for (var key :
          java.util.List.of(
              "cancelCutoffMinutes",
              "changeCutoffMinutes",
              "checkInEarlyMinutes",
              "additionalPaymentMinutes")) {
        var n = request.policies().get(key);
        com.courtly.util.Rules.require(
            n == null
                || n instanceof Number
                    && ((Number) n).intValue() >= 0
                    && ((Number) n).intValue() <= 10080,
            "Chính sách thời gian không hợp lệ");
      }
      settings.setPolicies(documents.encode(request.policies()));
    }
    repository.save(settings);
  }
}
