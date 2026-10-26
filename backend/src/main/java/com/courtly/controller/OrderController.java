package com.courtly.controller;

import com.courtly.dto.request.BookingRequest;
import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OrderController {
  private final OrderApplicationService service;
  private final AuthService auth;
  private final VoucherService vouchers;

  @PostMapping("/orders")
  public Map<String, Object> create(@Valid @RequestBody BookingRequest b, HttpServletRequest r) {
    return service.create(b, auth.current(r));
  }

  @PostMapping("/booking/options")
  public Map<String, Object> options(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.options(b, auth.current(r));
  }

  @GetMapping("/orders/{id}/cancellation-preview")
  public Map<String, Object> cancellationPreview(@PathVariable UUID id, HttpServletRequest r) {
    return service.cancellationPreview(id, auth.current(r));
  }

  @GetMapping("/public/vouchers")
  public List<Map<String, Object>> vouchers() {
    return vouchers.listAvailable();
  }

  @PostMapping("/public/vouchers/validate")
  public Map<String, Object> validateVoucher(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    String code = (String) body.get("code");
    java.math.BigDecimal amount = PresentationService.decimal(body.get("amount"));
    UUID accountId = auth.optCurrent(r).map(com.courtly.entity.Account::getId).orElse(null);
    return vouchers.calculate(code, amount, accountId);
  }

  @GetMapping("/orders/{id}/extension-options")
  public Map<String, Object> extensionOptions(@PathVariable UUID id, HttpServletRequest r) {
    return service.extensionOptions(id, auth.current(r));
  }

  @PostMapping("/orders/{id}/preview")
  public Map<String, Object> preview(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.preview(id, b, auth.current(r));
  }

  @PatchMapping("/orders/{id}/schedule")
  public Map<String, Object> move(
      @PathVariable UUID id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.move(id, b, auth.current(r));
  }

  @PostMapping("/orders/{id}/{action}")
  public Map<String, Object> action(
      @PathVariable UUID id,
      @PathVariable String action,
      @RequestBody(required = false) Map<String, Object> b,
      HttpServletRequest r) {
    return service.action(id, action, b, auth.current(r));
  }

}
