package com.courtly.controller;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.service.CatalogService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {
  private final CatalogService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.repository.AccountRepository accounts;
  private final com.courtly.service.RequestService requests;

  @PostMapping("/{collection}")
  public Map<String, Object> create(
      @PathVariable String collection,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection,
        request,
        () -> com.courtly.util.Rules.map("id", service.save(collection, null, request)));
  }

  @PutMapping("/{collection}/{id}")
  public Map<String, Object> update(
      @PathVariable String collection,
      @PathVariable UUID id,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    if (collection.equals("accounts")) {
      var actor = auth.current(req);
      var old = accounts.findById(id).orElseThrow();
      if (auth.owner(old) || id.equals(actor.getId()))
        com.courtly.util.Rules.require(
            "ADMIN".equals(request.role()) && "ACTIVE".equals(request.status()),
            "Không được tự khóa/hạ quyền hoặc thay quyền chủ hệ thống");
      if (old.getPasswordHash() != null)
        com.courtly.util.Rules.require(
            old.getEmail().equalsIgnoreCase(request.email()),
            "Không đổi email đã liên kết đăng nhập");
    }
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection + ":" + id,
        request,
        () -> com.courtly.util.Rules.map("id", service.save(collection, id, request)));
  }
}
