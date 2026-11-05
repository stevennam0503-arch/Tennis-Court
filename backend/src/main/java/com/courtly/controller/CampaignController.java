package com.courtly.controller;

import com.courtly.entity.Account;
import com.courtly.service.AuthService;
import com.courtly.service.CampaignService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CampaignController {

  private final CampaignService campaignService;
  private final AuthService authService;

  @GetMapping("/admin/campaigns")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Map<String, Object>> listCampaigns() {
    return campaignService.listCampaigns();
  }

  @GetMapping("/admin/campaigns/templates")
  public List<Map<String, Object>> templates(HttpServletRequest r) {
    Account actor = authService.current(r);
    if (!"ADMIN".equalsIgnoreCase(actor.getRole()) && !"STAFF".equalsIgnoreCase(actor.getRole())) {
      throw new com.courtly.exception.BusinessException("Không có quyền");
    }
    return campaignService.templates();
  }

  @GetMapping("/admin/campaigns/{id}")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> getCampaign(@PathVariable UUID id) {
    return campaignService.getCampaign(id);
  }

  @PostMapping("/admin/campaigns")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> createCampaign(@RequestBody Map<String, Object> body, HttpServletRequest r) {
    Account actor = authService.current(r);
    return campaignService.createCampaign(actor, body);
  }

  @PostMapping("/admin/campaigns/{id}/submit")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> submitForApproval(@PathVariable UUID id, HttpServletRequest r) {
    Account actor = authService.current(r);
    return campaignService.submitForApproval(actor, id);
  }

  @PostMapping("/admin/campaigns/{id}/approve")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> approveAndRun(@PathVariable UUID id, HttpServletRequest r) {
    Account admin = authService.current(r);
    return campaignService.approveAndRun(admin, id);
  }

  @PostMapping("/admin/campaigns/{id}/pause")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> pauseCampaign(@PathVariable UUID id, HttpServletRequest r) {
    Account admin = authService.current(r);
    return campaignService.pauseCampaign(admin, id);
  }

  @PostMapping("/admin/campaigns/{id}/end")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> endCampaign(@PathVariable UUID id, HttpServletRequest r) {
    Account admin = authService.current(r);
    return campaignService.endCampaign(admin, id);
  }

  @GetMapping("/admin/campaigns/{id}/stats")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> getStats(@PathVariable UUID id) {
    return campaignService.getCampaignStats(id);
  }

  @GetMapping("/public/campaigns/active-banners")
  public List<Map<String, Object>> getActiveBanners(HttpServletRequest r) {
    return campaignService.getActiveBanners(authService.optCurrent(r).map(com.courtly.entity.Account::getId).orElse(null));
  }

  @PostMapping("/public/campaigns/unsubscribe")
  public Map<String, Object> unsubscribe(@RequestBody Map<String, String> body) {
    String token = body.get("token");
    return campaignService.unsubscribe(token);
  }

  @GetMapping("/public/campaigns/unsubscribe")
  public Map<String, Object> unsubscribeGet(@RequestParam String token) {
    return campaignService.unsubscribe(token);
  }
}
