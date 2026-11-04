package com.courtly.controller;

import com.courtly.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ContentController {
  private final ContentService content;
  private final AuthService auth;

  @GetMapping("/public/content")
  public Map<String, Object> publicContent() {
    return content.get(null);
  }

  @GetMapping("/content")
  public Map<String, Object> content(HttpServletRequest r) {
    return content.get(auth.current(r));
  }

  @GetMapping("/feedback/mine")
  public List<Map<String, Object>> mine(HttpServletRequest r) {
    return content.mine(auth.current(r));
  }

  @GetMapping("/feedback/eligible-orders")
  public List<Map<String, Object>> eligibleOrders(HttpServletRequest r) {
    return content.listEligibleOrders(auth.current(r));
  }

  @GetMapping("/content/feedback/compensation-templates")
  public List<Map<String, Object>> compensationTemplates(HttpServletRequest r) {
    return content.getCompensationTemplates(auth.current(r));
  }

  @PostMapping("/content/feedback/{id}/assign")
  public Map<String, Object> assignFeedback(@PathVariable String id, HttpServletRequest r) {
    return content.assignFeedback(id, auth.current(r));
  }

  @PostMapping("/content/feedback/{id}/resolve")
  public Map<String, Object> resolveFeedback(
      @PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest r) {
    return content.resolveFeedback(id, body, auth.current(r));
  }

  @PostMapping("/content/feedback/{id}/compensate")
  public Map<String, Object> compensateFeedback(
      @PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest r) {
    return content.compensateFeedback(id, body, auth.current(r));
  }

  @PostMapping("/content/feedback/{id}/revoke-compensation")
  public Map<String, Object> revokeCompensation(
      @PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest r) {
    return content.revokeCompensation(id, body, auth.current(r));
  }

  @RequestMapping(
      value = {
        "/feedback",
        "/content/club",
        "/content/articles",
        "/content/articles/{id}",
        "/content/feedback/{id}"
      },
      method = {RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH})
  public Map<String, Object> save(@RequestBody Map<String, Object> b, HttpServletRequest r) {
    return content.save(auth.current(r), r.getMethod(), r.getRequestURI(), b);
  }
}
