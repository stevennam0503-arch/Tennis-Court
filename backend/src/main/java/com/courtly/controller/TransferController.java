package com.courtly.controller;

import com.courtly.service.*;
import com.courtly.util.Rules;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class TransferController {
  private final TransferService transfers;
  private final AuthService auth;

  @GetMapping("/api/public/payment-config")
  public Map<String, Object> config() {
    return transfers.config();
  }

  @GetMapping("/api/transfers")
  public List<Map<String, Object>> mine(HttpServletRequest r) {
    return transfers.mine(auth.current(r));
  }

  @GetMapping("/api/admin/transfers")
  public List<Map<String, Object>> all(HttpServletRequest r) {
    var a = auth.current(r);
    Rules.require("ADMIN".equals(a.getRole()), "Chỉ quản trị viên mới có quyền");
    return transfers.all();
  }

  @PostMapping("/api/transfers")
  public Map<String, Object> create(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return transfers.create(auth.current(r), b);
  }

  @PostMapping("/api/transfers/{id}/declared")
  public Map<String, Object> declared(@PathVariable String id, HttpServletRequest r) {
    return transfers.declared(auth.current(r), id);
  }

  @PostMapping("/api/transfers/{id}/confirm")
  public Map<String, Object> confirm(@PathVariable String id, HttpServletRequest r) {
    return transfers.confirm(auth.current(r), id);
  }

  @PostMapping("/api/admin/transfers/{id}/confirm")
  public Map<String, Object> adminConfirm(@PathVariable String id, HttpServletRequest r) {
    var a = auth.current(r);
    Rules.require("ADMIN".equals(a.getRole()), "Chỉ quản trị viên mới có quyền");
    return transfers.adminConfirm(id);
  }

  @PostMapping("/api/transfers/{id}/sandbox")
  public Map<String, Object> sandbox(
      @PathVariable String id, @RequestBody Map<String, Object> b, HttpServletRequest r) {
    return transfers.sandbox(auth.current(r), id, b);
  }

  @PostMapping("/api/webhooks/sepay")
  public Map<String, Object> webhook(
      @RequestHeader(value = "Authorization", required = false) String key,
      @RequestBody Map<String, Object> b) {
    return transfers.webhook(key, b);
  }
}
