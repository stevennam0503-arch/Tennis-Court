package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.TournamentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TournamentController {
    private final TournamentService service;
    @PostMapping("/tournaments/{id}/registrations") public Map<String,UUID> register(@PathVariable UUID id, @Valid @RequestBody RegistrationRequest request) { return Map.of("id",service.register(id,request)); }
    @PostMapping("/tournaments/{id}/draw") public void draw(@PathVariable UUID id) { service.draw(id); }
    @PutMapping("/matches/{id}/schedule") public void schedule(@PathVariable UUID id, @Valid @RequestBody MatchScheduleRequest request) { service.schedule(id,request); }
    @PostMapping("/matches/{id}/result") public void result(@PathVariable UUID id, @Valid @RequestBody MatchResultRequest request) { service.result(id,request); }
}
