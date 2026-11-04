package com.courtly.controller;

import com.courtly.entity.Account;
import com.courtly.entity.Voucher;
import com.courtly.service.AuthService;
import com.courtly.service.VoucherService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class VoucherAdminController {

  private final VoucherService voucherService;
  private final AuthService authService;

  @GetMapping("/admin/vouchers")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Voucher> listVouchers(@RequestParam(required = false) String status) {
    return voucherService.listAllForAdmin(status);
  }

  @PostMapping("/admin/vouchers")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Voucher createVoucher(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.createVoucher(body, actor);
  }

  @PutMapping("/admin/vouchers/{id}")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Voucher updateVoucher(@PathVariable UUID id, @RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.updateVoucher(id, body, actor);
  }

  @PostMapping("/admin/vouchers/{id}/pause")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Voucher pauseVoucher(@PathVariable UUID id, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.pauseVoucher(id, actor);
  }

  @PostMapping("/admin/vouchers/{id}/resume")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Voucher resumeVoucher(@PathVariable UUID id, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.resumeVoucher(id, actor);
  }

  @PostMapping("/admin/vouchers/{id}/end")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Voucher endVoucher(@PathVariable UUID id, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.endVoucher(id, actor);
  }

  @PostMapping("/admin/vouchers/{id}/approve")
  @PreAuthorize("hasRole('ADMIN')")
  public Voucher approveVoucher(@PathVariable UUID id, HttpServletRequest r) {
    Account actor = authService.current(r);
    return voucherService.approveVoucher(id, actor);
  }

  @PostMapping("/admin/vouchers/batch-generate")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  @SuppressWarnings("unchecked")
  public List<String> batchGenerate(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account actor = authService.current(r);
    String prefix = (String) body.get("prefix");
    int quantity = body.get("quantity") != null ? ((Number) body.get("quantity")).intValue() : 10;
    Map<String, Object> template = (Map<String, Object>) body.getOrDefault("template", Collections.emptyMap());
    return voucherService.batchGenerate(prefix, quantity, template, actor);
  }

  @GetMapping("/admin/vouchers/{id}/redemptions")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Map<String, Object>> getRedemptions(@PathVariable UUID id) {
    return voucherService.getRedemptions(id);
  }

  @GetMapping("/vouchers/my")
  public List<Voucher> getMyVouchers(HttpServletRequest r) {
    Account actor = authService.optCurrent(r).orElse(null);
    if (actor == null) {
      return List.of();
    }
    return voucherService.getMyVouchers(actor.getId());
  }
}
