package com.courtly.service;

import static com.courtly.util.Rules.active;

import com.courtly.repository.OrderProductRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RentalAvailabilityService {
  private final OrderProductRepository products;

  public long peak(UUID item, Instant start, Instant end, UUID exclude) {
    var lines =
        products.findAll().stream()
            .filter(
                p ->
                    p.getRentalItem() != null
                        && p.getRentalItem().getId().equals(item)
                        && !p.getId().equals(exclude)
                        && !"READY".equals(p.getCondition()))
            .toList();
    var checkpoints = new TreeSet<Instant>();
    checkpoints.add(start);
    for (var p : lines)
      if (p.getRentStartAt() != null
          && p.getRentStartAt().isAfter(start)
          && p.getRentStartAt().isBefore(end)) checkpoints.add(p.getRentStartAt());
    long peak = 0;
    for (var time : checkpoints) {
      long count = 0;
      for (var p : lines) {
        boolean damaged =
            Set.of("DAMAGED", "MISSING").contains(p.getCondition() == null ? "" : p.getCondition());
        if (p.getReturnedAt() != null && !damaged) continue;
        if (!active(p.getOrder().getStatus()) && p.getIssuedAt() == null && !damaged) continue;
        Instant from = p.getRentStartAt();
        if (p.getIssuedAt() != null && p.getIssuedAt().isBefore(from)) from = p.getIssuedAt();
        boolean ongoing = p.getIssuedAt() != null || damaged;
        Instant until = ongoing ? Instant.MAX : p.getRentEndAt();
        if (!time.isBefore(from) && time.isBefore(until)) count += p.getQuantity();
      }
      peak = Math.max(peak, count);
    }
    return peak;
  }
}
