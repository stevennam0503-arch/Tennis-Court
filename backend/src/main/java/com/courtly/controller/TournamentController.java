package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.TournamentService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TournamentController {
  private final TournamentService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.service.RequestService requests;

  @PostMapping("/tournaments/{id}/registrations")
  public Map<String, UUID> register(
      @PathVariable UUID id,
      @Valid @RequestBody RegistrationRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    var a = auth.current(req);
    if (!"ADMIN".equals(a.getRole()))
      com.courtly.util.Rules.require(
          a.getId().equals(request.accountId()), "Chỉ đăng ký cho tài khoản của mình");
    return Map.of("id", service.register(id, request));
  }

  @PostMapping("/tournaments/{id}/draw")
  public void draw(@PathVariable UUID id) {
    service.draw(id);
  }

  @PutMapping("/matches/{id}/schedule")
  public void schedule(@PathVariable UUID id, @Valid @RequestBody MatchScheduleRequest request) {
    service.schedule(id, request);
  }

  @PostMapping("/matches/{id}/result")
  public void result(@PathVariable UUID id, @Valid @RequestBody MatchResultRequest request) {
    service.result(id, request);
  }
}
