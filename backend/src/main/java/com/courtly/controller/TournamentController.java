package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.TournamentService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TournamentController {
  private final TournamentService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.service.RequestService requests;

  @PostMapping("/tournaments/{id}/registrations")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, UUID> register(
      @PathVariable UUID id,
      @Valid @RequestBody RegistrationRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    var a = auth.current(req);
    com.courtly.util.Rules.require("ADMIN".equals(a.getRole()), "Khách đăng ký qua /api/guest/tournaments để xác nhận điều lệ và thông tin người chơi");
    return Map.of("id", service.register(id, request));
  }

  @PostMapping("/tournaments/{id}/draw")
  @PreAuthorize("hasRole('ADMIN')")
  public void draw(@PathVariable UUID id) {
    service.draw(id);
  }

  @PutMapping("/matches/{id}/schedule")
  @PreAuthorize("hasRole('ADMIN')")
  public void schedule(@PathVariable UUID id, @Valid @RequestBody MatchScheduleRequest request) {
    service.schedule(id, request);
  }

  @PostMapping("/matches/{id}/result")
  @PreAuthorize("hasRole('ADMIN')")
  public void result(@PathVariable UUID id, @Valid @RequestBody MatchResultRequest request) {
    service.result(id, request);
  }
}
