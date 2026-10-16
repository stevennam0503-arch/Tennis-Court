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

  @RequestMapping(
      value = {"/plans", "/requests", "/requests/{id}/{action}"},
      method = {RequestMethod.POST, RequestMethod.PUT})
  public Map<String, Object> action(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return service.action(auth.current(r), r.getMethod(), r.getRequestURI(), b);
  }
}
