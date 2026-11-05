package com.courtly.controller;

import com.courtly.service.AuthService;
import jakarta.servlet.http.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
  private final AuthService auth;

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/auth/session")
  public Map<String, Object> session(HttpServletRequest r) {
    return auth.session(r);
  }

  /** Nhân viên quầy gửi mã xác nhận dùng điểm tới email + ứng dụng của khách. */
  @PostMapping("/auth/points-otp")
  public Map<String, Object> sendPointsOtp(@RequestBody Map<String, Object> body, HttpServletRequest req) {
    return auth.sendPointsOtp(body, req);
  }

  @PostMapping("/auth/{action}")
  public Map<String, Object> action(
      @PathVariable String action,
      @RequestBody Map<String, Object> body,
      HttpServletRequest req,
      HttpServletResponse res) {
    return auth.action(action, body, req, res);
  }
}
