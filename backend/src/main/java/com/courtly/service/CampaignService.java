package com.courtly.service;

import static com.courtly.util.Rules.map;

import com.courtly.entity.Account;
import com.courtly.entity.Campaign;
import com.courtly.exception.BusinessException;
import com.courtly.repository.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CampaignService {

  private final CampaignRepository campaigns;
  private final AccountRepository accounts;
  private final CustomerOrderRepository orders;
  private final VoucherRepository vouchers;
  private final VoucherRedemptionRepository redemptions;
  private final NotificationService notificationService;
  private final NotificationRepository notificationRepository;
  private final AuditService auditService;

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listCampaigns() {
    return campaigns.findAllByOrderByCreatedAtDesc().stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getCampaign(UUID id) {
    Campaign c = campaigns.findById(id).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    return toDto(c);
  }

  @Transactional
  public Map<String, Object> createCampaign(Account actor, Map<String, Object> body) {
    String name = (String) body.get("name");
    if (name == null || name.isBlank()) {
      throw new BusinessException("Tên chiến dịch không được để trống");
    }

    boolean isAdmin = "ADMIN".equalsIgnoreCase(actor.getRole());
    Campaign c = new Campaign();
    c.setName(name.trim());
    c.setDescription((String) body.get("description"));
    c.setAudience((String) body.getOrDefault("audience", "ALL"));
    c.setChannels((String) body.getOrDefault("channels", "EMAIL,SMS,BANNER"));
    c.setMessageTitle((String) body.get("messageTitle"));
    c.setMessageBody((String) body.get("messageBody"));
    c.setBannerText((String) body.get("bannerText"));
    c.setCreatedBy(actor);

    if (body.get("budgetLimit") != null) {
      c.setBudgetLimit(new BigDecimal(body.get("budgetLimit").toString()));
    }

    if (body.get("startsAt") != null) {
      c.setStartsAt(Instant.parse(body.get("startsAt").toString()));
    }
    if (body.get("endsAt") != null) {
      c.setEndsAt(Instant.parse(body.get("endsAt").toString()));
    }

    String initialStatus = (String) body.getOrDefault("status", "DRAFT");
    if (!isAdmin && !"DRAFT".equalsIgnoreCase(initialStatus) && !"PENDING_APPROVAL".equalsIgnoreCase(initialStatus)) {
      initialStatus = "DRAFT";
    }

    c.setStatus(initialStatus.toUpperCase(Locale.ROOT));
    if (isAdmin && "RUNNING".equalsIgnoreCase(c.getStatus())) {
      c.setApprovedBy(actor);
    }

    campaigns.save(c);

    auditService.log("CREATE_CAMPAIGN", "Tạo chiến dịch '" + c.getName() + "' (status: " + c.getStatus() + ")");

    if ("RUNNING".equalsIgnoreCase(c.getStatus())) {
      dispatchPromotions(c);
    }

    return toDto(c);
  }

  @Transactional
  public Map<String, Object> submitForApproval(Account actor, UUID campaignId) {
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    if (!"DRAFT".equalsIgnoreCase(c.getStatus())) {
      throw new BusinessException("Chỉ có thể gửi duyệt chiến dịch ở trạng thái Nháp (DRAFT)");
    }
    c.setStatus("PENDING_APPROVAL");
    c.setUpdatedAt(Instant.now());
    campaigns.save(c);

    auditService.log("SUBMIT_CAMPAIGN", "Gửi duyệt chiến dịch '" + c.getName() + "' bởi " + actor.getEmail());
    return toDto(c);
  }

  @Transactional
  public Map<String, Object> approveAndRun(Account admin, UUID campaignId) {
    if (!"ADMIN".equalsIgnoreCase(admin.getRole())) {
      throw new BusinessException("Chỉ Quản trị viên (ADMIN) mới có quyền phê duyệt chiến dịch");
    }
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    c.setApprovedBy(admin);
    c.setStatus("RUNNING");
    if (c.getStartsAt() == null || c.getStartsAt().isAfter(Instant.now())) {
      c.setStartsAt(Instant.now());
    }
    c.setUpdatedAt(Instant.now());
    campaigns.save(c);

    auditService.log("APPROVE_CAMPAIGN", "Phê duyệt & chạy chiến dịch '" + c.getName() + "'");

    dispatchPromotions(c);

    return toDto(c);
  }

  @Transactional
  public Map<String, Object> pauseCampaign(Account admin, UUID campaignId) {
    if (!"ADMIN".equalsIgnoreCase(admin.getRole())) {
      throw new BusinessException("Chỉ Quản trị viên (ADMIN) mới có quyền tạm dừng chiến dịch");
    }
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    c.setStatus("PAUSED");
    c.setUpdatedAt(Instant.now());
    campaigns.save(c);

    auditService.log("PAUSE_CAMPAIGN", "Tạm dừng chiến dịch '" + c.getName() + "'");
    return toDto(c);
  }

  @Transactional
  public Map<String, Object> endCampaign(Account admin, UUID campaignId) {
    if (!"ADMIN".equalsIgnoreCase(admin.getRole())) {
      throw new BusinessException("Chỉ Quản trị viên (ADMIN) mới có quyền kết thúc chiến dịch");
    }
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    c.setStatus("ENDED");
    c.setEndsAt(Instant.now());
    c.setUpdatedAt(Instant.now());
    campaigns.save(c);

    // Dừng các voucher gắn với campaign này
    vouchers.findAll().stream()
        .filter(v -> campaignId.equals(v.getCampaignId()))
        .forEach(v -> {
          v.setStatus("ENDED");
          v.setEnabled(false);
          vouchers.save(v);
        });

    auditService.log("END_CAMPAIGN", "Kết thúc chiến dịch '" + c.getName() + "'");
    return toDto(c);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> getActiveBanners() {
    return campaigns.findActiveRunning(Instant.now()).stream()
        .filter(c -> c.getChannels() != null && c.getChannels().contains("BANNER") && c.getBannerText() != null && !c.getBannerText().isBlank())
        .map(c -> Map.<String, Object>of(
            "id", c.getId(),
            "name", c.getName(),
            "bannerText", c.getBannerText(),
            "messageTitle", c.getMessageTitle() != null ? c.getMessageTitle() : c.getName()
        ))
        .toList();
  }

  /**
   * Phát thông tin quảng bá qua Outbox P1-b theo Nghị định 13/2023 & Nghị định 91/2020.
   * Chỉ gửi cho khách ĐÃ ĐỒNG Ý (marketingConsent = true) và luôn kèm link hủy nhận tin.
   */
  public void dispatchPromotions(Campaign campaign) {
    List<Account> audience = resolveAudience(campaign);
    String channels = campaign.getChannels() != null ? campaign.getChannels().toUpperCase(Locale.ROOT) : "EMAIL,SMS";

    for (Account acc : audience) {
      // TUÂN THỦ NGHỊ ĐỊNH: Chỉ gửi nếu khách hàng đã bật marketing_consent
      if (!Boolean.TRUE.equals(acc.getMarketingConsent())) {
        continue;
      }

      String optOutToken = "optout_" + acc.getId().toString();
      String optOutUrl = "http://localhost:3000/huy-nhan-tin?token=" + optOutToken;
      String dedupeBase = "CAMP:" + campaign.getId() + ":" + acc.getId();

      if (channels.contains("EMAIL") && acc.getEmail() != null) {
        String title = campaign.getMessageTitle() != null ? campaign.getMessageTitle() : "[" + campaign.getName() + "] Ưu đãi từ Courtly";
        String body = (campaign.getMessageBody() != null ? campaign.getMessageBody() : "")
            + "<br/><br/><p style=\"font-size:11px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;\">"
            + "Bạn nhận được email này vì đã đồng ý nhận thông tin ưu đãi từ CLB Tennis Courtly. "
            + "<a href=\"" + optOutUrl + "\" style=\"color:#64748b;text-decoration:underline;\">Hủy nhận tin tại đây</a>.</p>";

        notificationService.enqueue(
            acc.getId(), null, null,
            "PROMOTION", "EMAIL", acc.getEmail(),
            title, body, Instant.now(), dedupeBase + ":EMAIL"
        );
      }

      if (channels.contains("SMS") && acc.getPhone() != null) {
        String smsBody = "Courtly: " + (campaign.getMessageTitle() != null ? campaign.getMessageTitle() : campaign.getName())
            + ". Tu choi nhan tin: " + optOutUrl;
        notificationService.enqueue(
            acc.getId(), null, null,
            "PROMOTION", "SMS", acc.getPhone(),
            null, smsBody, Instant.now(), dedupeBase + ":SMS"
        );
      }
    }
  }

  @Transactional
  public Map<String, Object> unsubscribe(String token) {
    if (token == null || !token.startsWith("optout_")) {
      throw new BusinessException("Mã hủy nhận tin không hợp lệ");
    }
    String accountIdStr = token.substring("optout_".length());
    try {
      UUID accountId = UUID.fromString(accountIdStr);
      Account acc = accounts.findById(accountId).orElseThrow(() -> new BusinessException("Tài khoản không tồn tại"));
      acc.setMarketingConsent(false);
      acc.setMarketingConsentAt(null);
      accounts.save(acc);

      auditService.log("UNSUBSCRIBE_PROMO", "Hủy nhận tin quảng cáo cho tài khoản " + acc.getEmail());
      return Map.of("success", true, "message", "Quý khách đã hủy nhận tin quảng cáo thành công. Cảm ơn quý khách!");
    } catch (IllegalArgumentException e) {
      throw new BusinessException("Mã token không hợp lệ");
    }
  }

  private List<Account> resolveAudience(Campaign campaign) {
    String type = campaign.getAudience() != null ? campaign.getAudience().toUpperCase(Locale.ROOT) : "ALL";
    List<Account> all = accounts.findAll().stream()
        .filter(a -> "CUSTOMER".equalsIgnoreCase(a.getRole()) && "ACTIVE".equalsIgnoreCase(a.getStatus()))
        .toList();

    return switch (type) {
      case "TIER" -> {
        // filter by audience_filter tier
        String filter = campaign.getAudienceFilter();
        yield all.stream()
            .filter(a -> filter != null && filter.toUpperCase().contains(a.getTier() != null ? a.getTier().toUpperCase() : "ROOKIE"))
            .toList();
      }
      case "NEW_CUSTOMERS" -> {
        yield all.stream()
            .filter(a -> (a.getLifetimeSpend() == null || a.getLifetimeSpend().compareTo(BigDecimal.ZERO) == 0))
            .toList();
      }
      case "INACTIVE_30D" -> {
        Instant thirtyDaysAgo = Instant.now().minus(Duration.ofDays(30));
        yield all.stream()
            .filter(a -> a.getCreatedAt() != null && a.getCreatedAt().isBefore(thirtyDaysAgo))
            .toList();
      }
      default -> all;
    };
  }

  @Transactional(readOnly = true)
  public Map<String, Object> getCampaignStats(UUID campaignId) {
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));

    // Lượt gửi thông báo của chiến dịch
    String pattern = "CAMP:" + campaignId + ":%";
    long totalSent = notificationRepository.countByDedupeKeyStartingWith("CAMP:" + campaignId + ":");
    long successSent = notificationRepository.countByDedupeKeyStartingWithAndStatus("CAMP:" + campaignId + ":", "SENT");

    // Lượt dùng voucher của chiến dịch
    List<UUID> voucherIds = vouchers.findAll().stream()
        .filter(v -> campaignId.equals(v.getCampaignId()))
        .map(com.courtly.entity.Voucher::getId)
        .toList();

    long redemptionsCount = 0;
    BigDecimal totalDiscount = BigDecimal.ZERO;
    BigDecimal totalRevenue = BigDecimal.ZERO;

    if (!voucherIds.isEmpty()) {
      var allRedeems = redemptions.findAll().stream()
          .filter(r -> r.getVoucher() != null && voucherIds.contains(r.getVoucher().getId()))
          .toList();

      redemptionsCount = allRedeems.size();
      for (var r : allRedeems) {
        totalDiscount = totalDiscount.add(r.getDiscountAmount() != null ? r.getDiscountAmount() : BigDecimal.ZERO);
        if (r.getOrder() != null && r.getOrder().getPaidAmount() != null) {
          totalRevenue = totalRevenue.add(r.getOrder().getPaidAmount());
        }
      }
    }

    return map(
        "campaignId", campaignId,
        "name", c.getName(),
        "status", c.getStatus(),
        "totalSent", totalSent,
        "successSent", successSent,
        "redemptionsCount", redemptionsCount,
        "totalDiscount", totalDiscount,
        "totalRevenue", totalRevenue,
        "budgetLimit", c.getBudgetLimit() != null ? c.getBudgetLimit() : 0,
        "budgetRemaining", c.getBudgetLimit() != null ? c.getBudgetLimit().subtract(totalDiscount).max(BigDecimal.ZERO) : null
    );
  }

  private Map<String, Object> toDto(Campaign c) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", c.getId());
    m.put("name", c.getName());
    m.put("description", c.getDescription());
    m.put("status", c.getStatus());
    m.put("startsAt", c.getStartsAt());
    m.put("endsAt", c.getEndsAt());
    m.put("audience", c.getAudience());
    m.put("channels", c.getChannels());
    m.put("messageTitle", c.getMessageTitle());
    m.put("messageBody", c.getMessageBody());
    m.put("bannerText", c.getBannerText());
    m.put("budgetLimit", c.getBudgetLimit());
    m.put("createdBy", c.getCreatedBy() != null ? c.getCreatedBy().getFullName() : null);
    m.put("approvedBy", c.getApprovedBy() != null ? c.getApprovedBy().getFullName() : null);
    m.put("createdAt", c.getCreatedAt());
    return m;
  }
}
