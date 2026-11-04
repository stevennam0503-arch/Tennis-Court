package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.*;
import com.courtly.repository.AccountRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MembershipService {
  private final AccountRepository accounts;

  public boolean hasActiveMembership(UUID account) {
    if (account == null) return false;
    return accounts.findById(account)
        .map(a -> a.getTier() != null && !"ROOKIE".equalsIgnoreCase(a.getTier()))
        .orElse(false);
  }

  public Map<String, Object> quote(UUID account, List<CourtSchedule> slots) {
    BigDecimal gross = slots.stream().map(CourtSchedule::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal discount = BigDecimal.ZERO;
    String tier = "ROOKIE";
    double pct = 0.0;
    if (account != null) {
      var acc = accounts.findById(account).orElse(null);
      if (acc != null && acc.getTier() != null) {
        tier = acc.getTier().toUpperCase(Locale.ROOT);
        pct = switch (tier) {
          case "GRAND_SLAM" -> 8.0;
          case "MASTERS" -> 5.0;
          case "CHALLENGER" -> 3.0;
          default -> 0.0;
        };
        if (pct > 0) {
          discount = gross.multiply(BigDecimal.valueOf(pct)).divide(new BigDecimal("100"), 0, java.math.RoundingMode.HALF_UP);
        }
      }
    }
    String tierName = switch (tier) {
      case "GRAND_SLAM" -> "Grand Slam";
      case "MASTERS" -> "Masters";
      case "CHALLENGER" -> "Challenger";
      default -> "Rookie";
    };
    return map(
        "gross", gross,
        "discount", discount,
        "net", gross.subtract(discount),
        "tier", tier,
        "membershipId", discount.signum() > 0 ? tier : null,
        "planName", pct > 0 ? "Ưu đãi hạng " + tierName + " (−" + (int) pct + "%)" : null,
        "discountPercent", pct);
  }

  public void checkWindow(UUID account, List<CourtSchedule> slots) {
    int days = 7;
    if (account != null) {
      var acc = accounts.findById(account).orElse(null);
      if (acc != null && acc.getTier() != null) {
        days = switch (acc.getTier().toUpperCase(Locale.ROOT)) {
          case "GRAND_SLAM" -> 21;
          case "MASTERS" -> 14;
          case "CHALLENGER" -> 10;
          default -> 7;
        };
      }
    }
    final int finalDays = days;
    require(slots.stream().allMatch(s -> !s.getScheduleDate().isAfter(java.time.LocalDate.now(ZONE).plusDays(finalDays))),
        "Khoảng đặt trước vượt quyền lợi hạng thành viên (" + days + " ngày)");
  }

  public void consumeChange(UUID account, List<CourtSchedule> before, List<CourtSchedule> after) {
    if (account == null) return;
    var acc = accounts.findById(account).orElse(null);
    if (acc == null) return;
    var start = before.stream().map(s -> at(s.getScheduleDate(), s.getStartTime())).min(Comparator.naturalOrder()).orElseThrow();
    require(start.isAfter(Instant.now().plusSeconds(86400)), "Quyền lợi đổi lịch cần báo trước ít nhất 24 giờ; liên hệ quầy");
  }
}
