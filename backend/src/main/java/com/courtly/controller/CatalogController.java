package com.courtly.controller;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.CatalogRequest;
import com.courtly.service.CatalogService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {
  private final CatalogService service;
  private final com.courtly.service.AuthService auth;
  private final com.courtly.repository.AccountRepository accounts;
  private final com.courtly.service.RequestService requests;
  private final com.courtly.service.ScheduleService schedules;
  private final com.courtly.service.AuditService audit;
  private final com.courtly.service.DemoResetService demoReset;

  @PostMapping("/{collection}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> create(
      @PathVariable String collection,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection,
        request,
        () -> map("id", service.save(collection, null, request)));
  }

  @PutMapping("/{collection}/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> update(
      @PathVariable String collection,
      @PathVariable UUID id,
      @Valid @RequestBody CatalogRequest request,
      jakarta.servlet.http.HttpServletRequest req) {
    if (collection.equals("accounts")) {
      var actor = auth.current(req);
      var old = accounts.findById(id).orElseThrow();
      if (auth.owner(old) || id.equals(actor.getId()))
        require(
            "ADMIN".equals(request.role()) && "ACTIVE".equals(request.status()),
            "Không được tự khóa/hạ quyền hoặc thay quyền chủ hệ thống");
      if (old.getPasswordHash() != null)
        require(
            old.getRole().equals(request.role()) && old.getStatus().equals(request.status()),
            "Không được phân quyền tài khoản đã đăng nhập");
    }
    return requests.execute(
        auth.current(req).getId(),
        null,
        "catalog:" + collection + ":" + id,
        request,
        () -> map("id", service.save(collection, id, request)));
  }

  @DeleteMapping("/{collection}/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> delete(
      @PathVariable String collection,
      @PathVariable UUID id,
      jakarta.servlet.http.HttpServletRequest req) {
    var actor = auth.current(req);
    service.delete(collection, id, actor);
    return map("success", true, "id", id);
  }

  @PostMapping("/demo-reset")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> demoReset(jakarta.servlet.http.HttpServletRequest req) {
    auth.admin(auth.current(req));
    demoReset.resetShowcaseData();
    audit.log("ĐẶT LẠI DỮ LIỆU MẪU", "Khôi phục thành công 7 đơn hàng chuẩn & giải đấu trình diễn Hội đồng");
    return map("success", true, "message", "Đã đặt lại dữ liệu chuẩn Hội đồng thành công!");
  }

  @PostMapping("/schedules/maintenance")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> setSlotMaintenance(
      @RequestBody Map<String, Object> body,
      jakarta.servlet.http.HttpServletRequest req) {
    auth.cashier(auth.current(req));
    Object rawIds = body.get("scheduleIds") != null ? body.get("scheduleIds") : body.get("slotIds");
    require(rawIds instanceof List<?>, "Danh sách khung giờ không hợp lệ");
    List<UUID> ids = ((List<?>) rawIds).stream()
        .map(x -> UUID.fromString(x.toString()))
        .toList();
    boolean maintenance = Boolean.TRUE.equals(body.get("maintenance"));
    String reason = (String) body.get("reason");
    schedules.toggleSlotMaintenance(ids, maintenance, reason);
    audit.log("BẢO TRÌ KHUNG GIỜ", (maintenance ? "BẬT BẢO TRÌ" : "MỞ LẠI SÂN") + " (" + ids.size() + " slot)" + (reason != null && !reason.isBlank() ? ": " + reason : ""));
    return map("success", true, "count", ids.size());
  }
}
