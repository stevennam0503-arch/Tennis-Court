package com.courtly.controller;

import com.courtly.entity.Account;
import com.courtly.entity.LoungeVisit;
import com.courtly.repository.AccountRepository;
import com.courtly.repository.LoungeVisitRepository;
import com.courtly.service.AuthService;
import com.courtly.service.LoyaltyService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LoyaltyController {

  private final LoyaltyService loyaltyService;
  private final AuthService authService;
  private final AccountRepository accounts;
  private final LoungeVisitRepository loungeVisits;

  @GetMapping("/loyalty/my")
  public Map<String, Object> myLoyalty(HttpServletRequest r) {
    Account user = authService.current(r);
    return loyaltyService.getCustomerLoyaltySummary(user.getId());
  }

  @GetMapping("/loyalty/rewards")
  public List<Map<String, Object>> getRewards() {
    return loyaltyService.getRewardsCatalog();
  }

  @PostMapping("/loyalty/rewards/{code}/redeem")
  public Map<String, Object> redeemReward(@PathVariable String code, HttpServletRequest r) {
    Account user = authService.current(r);
    return loyaltyService.redeemReward(user.getId(), code);
  }

  @GetMapping("/public/loyalty/tiers")
  public List<Map<String, Object>> publicTiers() {
    return List.of(
        Map.of("tier", "ROOKIE", "name", "Rookie", "spend", 0, "discount", 0, "multiplier", 1.0, "advanceDays", 7, "changes", 0, "gift", "Voucher chào mừng 50k", "birthday", 30000),
        Map.of("tier", "CHALLENGER", "name", "Challenger", "spend", 3000000, "discount", 3, "multiplier", 1.2, "advanceDays", 10, "changes", 1, "gift", "200 điểm thưởng", "birthday", 60000),
        Map.of("tier", "MASTERS", "name", "Masters", "spend", 8000000, "discount", 5, "multiplier", 1.5, "advanceDays", 14, "changes", 2, "gift", "500 điểm thưởng", "birthday", 120000, "earlyTournaments", true),
        Map.of("tier", "GRAND_SLAM", "name", "Grand Slam", "spend", 20000000, "discount", 8, "multiplier", 2.0, "advanceDays", 21, "changes", 4, "gift", "1.000 điểm + Voucher 300k + Thẻ VIP Lounge", "birthday", 250000, "vipLounge", true)
    );
  }

  @PostMapping("/loyalty/vip-lounge/scan")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> scanVipLounge(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account staff = authService.current(r);
    String code = (String) body.get("code");
    return loyaltyService.checkInVipLounge(code, staff.getId());
  }

  @GetMapping("/admin/loyalty/members")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Map<String, Object>> listMembers(
      @RequestParam(required = false) String tier,
      @RequestParam(required = false) String query) {
    List<Account> list = accounts.findAll();
    return list.stream()
        .filter(a -> tier == null || tier.isBlank() || tier.equalsIgnoreCase(a.getTier()))
        .filter(a -> {
          if (query == null || query.isBlank()) return true;
          String q = query.toLowerCase();
          return (a.getFullName() != null && a.getFullName().toLowerCase().contains(q)) ||
                 (a.getEmail() != null && a.getEmail().toLowerCase().contains(q)) ||
                 (a.getPhone() != null && a.getPhone().contains(q));
        })
        .map(a -> {
          Map<String, Object> m = new LinkedHashMap<>();
          m.put("id", a.getId());
          m.put("name", a.getFullName());
          m.put("email", a.getEmail());
          m.put("phone", a.getPhone());
          m.put("tier", a.getTier() != null ? a.getTier() : "ROOKIE");
          m.put("tierSince", a.getTierSince());
          m.put("tierExpiresAt", a.getTierExpiresAt());
          m.put("pointsBalance", a.getPointsBalance() != null ? a.getPointsBalance() : 0);
          m.put("lifetimeSpend", a.getLifetimeSpend() != null ? a.getLifetimeSpend() : BigDecimal.ZERO);
          m.put("birthDate", a.getBirthDate());
          m.put("referralCode", a.getReferralCode());
          return m;
        })
        .toList();
  }

  @GetMapping("/admin/loyalty/lounge-visits")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Map<String, Object>> listLoungeVisits() {
    List<LoungeVisit> visits = loungeVisits.findAllWithDetails();
    return visits.stream().map(v -> {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", v.getId());
      m.put("cardCode", v.getCard().getCode());
      m.put("customerName", v.getCard().getAccount().getFullName());
      m.put("customerPhone", v.getCard().getAccount().getPhone());
      m.put("tier", v.getCard().getAccount().getTier());
      m.put("checkedInAt", v.getCheckedInAt());
      m.put("staffId", v.getStaffId());
      return m;
    }).toList();
  }

  @PostMapping("/admin/loyalty/adjust-points")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> adjustPoints(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account admin = authService.current(r);
    UUID accountId = UUID.fromString(String.valueOf(body.get("accountId")));
    int points = ((Number) body.get("points")).intValue();
    String note = (String) body.get("note");
    Account target = accounts.findById(accountId).orElseThrow();
    loyaltyService.addBonusPoints(target, points, "[ADMIN điều chỉnh] " + note);
    return Map.of("success", true, "newBalance", target.getPointsBalance());
  }

  @GetMapping("/admin/loyalty/report")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> loyaltyReport(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
    return loyaltyService.getLoyaltyReport(startDate, endDate);
  }

}
