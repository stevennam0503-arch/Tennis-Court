package com.courtly.controller;

import com.courtly.dto.request.*;
import com.courtly.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OverviewController {
    private final OverviewService overview;
    private final ScheduleService schedules;
    private final SettingsService settings;
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP"); }
    @GetMapping("/overview") public Map<String,Object> get(@RequestParam LocalDate date) { return overview.get(date); }
    @PostMapping("/schedules/generate") public void generate(@Valid @RequestBody ScheduleRequest request) { schedules.generate(request.date()); }
    @PutMapping("/settings") public void settings(@Valid @RequestBody SettingsRequest request) { settings.update(request); }
}
