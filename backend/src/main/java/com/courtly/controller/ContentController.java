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
