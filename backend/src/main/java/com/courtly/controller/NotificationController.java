package com.courtly.controller;

import com.courtly.entity.Account;
import com.courtly.entity.Notification;
import com.courtly.repository.AccountRepository;
import com.courtly.service.AuthService;
import com.courtly.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NotificationController {

  private final NotificationService notificationService;
  private final AuthService authService;
  private final AccountRepository accounts;

  @GetMapping("/admin/notifications")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public List<Map<String, Object>> listNotifications(
      @RequestParam(required = false) String channel,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String status) {
    List<Notification> list = notificationService.listForAdmin(
        channel != null && !channel.isBlank() ? channel : null,
        type != null && !type.isBlank() ? type : null,
        status != null && !status.isBlank() ? status : null
    );

    return list.stream().map(n -> {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", n.getId());
      m.put("accountId", n.getAccountId());
      m.put("orderId", n.getOrderId());
      m.put("campaignId", n.getCampaignId());
      m.put("type", n.getType());
      m.put("channel", n.getChannel());
      m.put("recipient", n.getRecipient());
      m.put("subject", n.getSubject());
      m.put("body", n.getBody());
      m.put("status", n.getStatus());
      m.put("attempts", n.getAttempts());
      m.put("lastError", n.getLastError());
      m.put("scheduledAt", n.getScheduledAt());
      m.put("sentAt", n.getSentAt());
      m.put("createdAt", n.getCreatedAt());
      m.put("dedupeKey", n.getDedupeKey());
      return m;
    }).toList();
  }

  @PostMapping("/admin/notifications/{id}/retry")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> retryNotification(@PathVariable UUID id) {
    Notification n = notificationService.retry(id);
    return Map.of("success", true, "id", n.getId(), "status", n.getStatus());
  }

  @PostMapping("/admin/orders/{id}/send-reminder")
  @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
  public Map<String, Object> sendImmediateReminder(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "ALL") String channel) {
    return notificationService.sendImmediateReminder(id, channel);
  }

  @GetMapping("/notifications/my")
  public List<Map<String, Object>> getMyNotifications(HttpServletRequest req) {
    Account me = authService.current(req);
    List<Notification> list = notificationService.listForAccount(me.getId());
    return list.stream().map(n -> {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", n.getId());
      m.put("orderId", n.getOrderId());
      m.put("type", n.getType());
      m.put("channel", n.getChannel());
      m.put("subject", n.getSubject());
      m.put("body", n.getBody());
      m.put("status", n.getStatus());
      m.put("createdAt", n.getCreatedAt());
      return m;
    }).toList();
  }

  @PutMapping("/notifications/settings")
  public Map<String, Object> updateNotificationSettings(
      @RequestBody Map<String, Object> body,
      HttpServletRequest req) {
    Account me = authService.current(req);
    if (body.containsKey("notifyEmail")) {
      me.setNotifyEmail(Boolean.TRUE.equals(body.get("notifyEmail")));
    }
    if (body.containsKey("marketingConsent")) {
      boolean consent = Boolean.TRUE.equals(body.get("marketingConsent"));
      me.setMarketingConsent(consent);
      if (consent) {
        me.setMarketingConsentAt(Instant.now());
      }
    }
    accounts.saveAndFlush(me);
    return Map.of(
        "success", true,
        "notifyEmail", me.getNotifyEmail(),
        "marketingConsent", me.getMarketingConsent()
    );
  }
}
