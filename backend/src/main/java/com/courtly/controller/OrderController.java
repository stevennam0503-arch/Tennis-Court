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

  @PostMapping("/orders")
  public Map<String, Object> create(@Valid @RequestBody BookingRequest b, HttpServletRequest r) {
    return service.create(b, auth.current(r));
  }

  @PostMapping("/booking/options")
  public Map<String, Object> options(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.options(b, auth.current(r));
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

  @PostMapping("/orders/{id}/products/{lineId}/return")
  public Map<String, Object> returned(
      @PathVariable UUID id,
      @PathVariable UUID lineId,
      @RequestBody Map<String, Object> b,
      HttpServletRequest r) {
    return service.returned(id, lineId, b, auth.current(r));
  }

  @GetMapping("/orders/{id}/services")
  public Map<String, Object> services(@PathVariable UUID id, HttpServletRequest r) {
    return service.services(id, auth.current(r));
  }
}
