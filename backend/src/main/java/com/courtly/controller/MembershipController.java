package com.courtly.controller;

import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/membership")
@RequiredArgsConstructor
public class MembershipController {
  private final MembershipService service;
  private final AuthService auth;

  @PostMapping("/plans")
  public Map<String, Object> createPlan(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.createPlan(auth.current(r), b);
  }

  @PutMapping("/plans")
  public Map<String, Object> updatePlan(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.updatePlan(auth.current(r), b);
  }

  @PutMapping("/plans/{id}")
  public Map<String, Object> updatePlanWithId(@PathVariable String id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    b.put("id", id);
    return service.updatePlan(auth.current(r), b);
  }

  @DeleteMapping("/plans/{id}")
  public Map<String, Object> deletePlan(@PathVariable String id, HttpServletRequest r) {
    return service.deletePlan(auth.current(r), id);
  }

  @RequestMapping(
      value = {"/requests", "/requests/{id}/{action}"},
      method = {RequestMethod.POST, RequestMethod.PUT})
  public Map<String, Object> action(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.action(auth.current(r), r.getMethod(), r.getRequestURI(), b);
  }
}