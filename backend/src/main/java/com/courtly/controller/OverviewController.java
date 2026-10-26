package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OverviewController {
  private final PresentationService presentation;
  private final ScheduleService schedules;
  private final SettingsService settings;
  private final AuthService auth;
  private final RequestService requests;

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "UP", "runtime", "Spring Boot", "database", "PostgreSQL");
  }

  @GetMapping("/overview")
  public Map<String, Object> get(@RequestParam LocalDate date, HttpServletRequest r) {
    return presentation.get(date, auth.current(r));
  }

  @GetMapping("/public/overview")
  public Map<String, Object> publicOverview(@RequestParam LocalDate date) {
    return presentation.get(date, null);
  }

  @RequestMapping(
      value = "/schedules/generate",
      method = {RequestMethod.POST, RequestMethod.GET})
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> generate(
      @Valid @RequestBody(required = false) ScheduleRequest body,
      @RequestParam(required = false) LocalDate date,
      HttpServletRequest r) {
    var a = auth.current(r);
    LocalDate targetDate = body != null && body.date() != null ? body.date() : (date != null ? date : LocalDate.now());
    return requests.execute(
        a.getId(),
        null,
        "generate",
        Map.of("date", targetDate.toString()),
        () -> {
          schedules.generate(targetDate);
          return Map.of("ok", true);
        });
  }

  @PutMapping("/settings")
  @PreAuthorize("hasRole('ADMIN')")
  public void settings(@Valid @RequestBody SettingsRequest b) {
    settings.update(b);
  }
}
