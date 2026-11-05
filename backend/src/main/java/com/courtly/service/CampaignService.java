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
  private final DocumentService docs;
  private final LoyaltyPolicyService loyaltyPolicy;

  private static final java.time.ZoneId VN = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

  /** Nhận ISO có múi giờ (2026-11-05T10:00:00Z) hoặc giờ địa phương từ ô datetime-local (2026-11-05T10:00). */
  private static Instant parseInstant(String raw) {
    try {
      return Instant.parse(raw);
    } catch (java.time.format.DateTimeParseException e) {
      try {
        return java.time.LocalDateTime.parse(raw).atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
      } catch (java.time.format.DateTimeParseException e2) {
        throw new BusinessException("Thời gian chiến dịch không hợp lệ: " + raw);
      }
    }
  }

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
    c.setChannels(((String) body.getOrDefault("channels", "EMAIL,BANNER")).replace("SMS", "").replaceAll(",+", ",").replaceAll("^,|,$", ""));
    c.setMessageTitle((String) body.get("messageTitle"));
    c.setMessageBody((String) body.get("messageBody"));
    c.setBannerText((String) body.get("bannerText"));
    c.setCreatedBy(actor);
    c.setAudienceFilter(body.get("audienceFilter") != null ? body.get("audienceFilter").toString() : null);

    if (body.get("budgetLimit") != null) {
      c.setBudgetLimit(new BigDecimal(body.get("budgetLimit").toString()));
    }

    if (body.get("startsAt") != null && !body.get("startsAt").toString().isBlank()) {
      c.setStartsAt(parseInstant(body.get("startsAt").toString()));
    }
    if (body.get("endsAt") != null && !body.get("endsAt").toString().isBlank()) {
      c.setEndsAt(parseInstant(body.get("endsAt").toString()));
    }

    if (c.getStartsAt() != null && c.getEndsAt() != null && !c.getEndsAt().isAfter(c.getStartsAt())) {
      throw new BusinessException("Thời gian kết thúc phải sau thời gian bắt đầu");
    }
    Map<String, Object> news = readNews(body);
    if ("ALL".equalsIgnoreCase(c.getAudience()) && news == null) {
      throw new BusinessException("Chiến dịch gửi tới tất cả khách cần có tin tức đăng kèm (tiêu đề, tóm tắt và nội dung)");
    }

    String initialStatus = (String) body.getOrDefault("status", "DRAFT");
    if (!isAdmin && !"DRAFT".equalsIgnoreCase(initialStatus) && !"PENDING_APPROVAL".equalsIgnoreCase(initialStatus)) {
      initialStatus = "DRAFT";
    }

    c.setStatus(initialStatus.toUpperCase(Locale.ROOT));
    boolean runNow = isAdmin && "RUNNING".equalsIgnoreCase(c.getStatus());
    if (runNow) {
      c.setApprovedBy(actor);
      c.setStatus("DRAFT"); // start() bên dưới quyết định RUNNING hay SCHEDULED
    }

    campaigns.save(c);
    if (news != null) {
      saveNews(c, news);
    }

    if (body.get("voucherId") != null && !body.get("voucherId").toString().isBlank()) {
      try {
        UUID vId = UUID.fromString(body.get("voucherId").toString());
        vouchers.findById(vId).ifPresent(v -> {
          v.setCampaignId(c.getId());
          vouchers.save(v);
        });
      } catch (Exception ignored) {}
    }

    auditService.log("CREATE_CAMPAIGN", "Tạo chiến dịch '" + c.getName() + "' (status: " + c.getStatus() + ")");

    if (runNow) {
      start(c);
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
    if (c.getEndsAt() != null && c.getEndsAt().isBefore(Instant.now())) {
      throw new BusinessException("Chiến dịch đã quá thời gian kết thúc. Hãy đổi ngày trước khi duyệt.");
    }
    c.setApprovedBy(admin);
    start(c);
    auditService.log("APPROVE_CAMPAIGN", ("SCHEDULED".equals(c.getStatus()) ? "Phê duyệt & lên lịch" : "Phê duyệt & chạy")
        + " chiến dịch '" + c.getName() + "'");
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
    setNewsPublished(c, false);

    auditService.log("PAUSE_CAMPAIGN", "Tạm dừng chiến dịch '" + c.getName() + "'");
    return toDto(c);
  }

  @Transactional
  public Map<String, Object> endCampaign(Account admin, UUID campaignId) {
    if (!"ADMIN".equalsIgnoreCase(admin.getRole())) {
      throw new BusinessException("Chỉ Quản trị viên (ADMIN) mới có quyền kết thúc chiến dịch");
    }
    Campaign c = campaigns.findById(campaignId).orElseThrow(() -> new BusinessException("Chiến dịch không tồn tại"));
    finish(c);
    auditService.log("END_CAMPAIGN", "Kết thúc chiến dịch '" + c.getName() + "'");
    return toDto(c);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> getActiveBanners(UUID viewerId) {
    return campaigns.findActiveRunning(Instant.now()).stream()
        .filter(c -> c.getChannels() != null && c.getChannels().contains("BANNER") && c.getBannerText() != null && !c.getBannerText().isBlank())
        // Banner chỉ hiện cho đúng nhóm khách của chiến dịch; chiến dịch "Tất cả" thì ai cũng thấy
        .filter(c -> c.getAudience() == null || "ALL".equalsIgnoreCase(c.getAudience())
            || (viewerId != null && resolveAudience(c).stream().anyMatch(a -> viewerId.equals(a.getId()))))
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
    String channels = campaign.getChannels() != null ? campaign.getChannels().toUpperCase(Locale.ROOT) : "EMAIL";

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
        String filter = campaign.getAudienceFilter();
        if (filter == null || filter.isBlank()) yield List.of();
        Set<String> targetTiers = Arrays.stream(filter.replace("[", "").replace("]", "").replace("\"", "").split("[,\\s]+"))
            .map(s -> s.trim().toUpperCase(Locale.ROOT))
            .filter(s -> !s.isBlank())
            .collect(Collectors.toSet());
        yield all.stream()
            .filter(a -> targetTiers.contains(a.getTier() != null ? a.getTier().toUpperCase(Locale.ROOT) : "ROOKIE"))
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
      case "NEAR_NEXT_TIER" -> {
        yield all.stream().filter(a -> {
          BigDecimal spend = a.getLifetimeSpend() != null ? a.getLifetimeSpend() : BigDecimal.ZERO;
          String tier = a.getTier() != null ? a.getTier().toUpperCase(Locale.ROOT) : "ROOKIE";
          int idx = LoyaltyPolicyService.TIERS.indexOf(tier);
          if (idx < 0 || idx >= LoyaltyPolicyService.TIERS.size() - 1) return false;
          // Khách đã đạt từ 80% ngưỡng của hạng kế tiếp (ngưỡng lấy từ chính sách hạng hiện hành)
          BigDecimal next = loyaltyPolicy.threshold(LoyaltyPolicyService.TIERS.get(idx + 1));
          return spend.compareTo(next.multiply(new BigDecimal("0.8"))) >= 0 && spend.compareTo(next) < 0;
        }).toList();
      }
      case "CUSTOM_LIST" -> {
        String filter = campaign.getAudienceFilter() != null ? campaign.getAudienceFilter().toLowerCase(Locale.ROOT) : "";
        yield all.stream().filter(a -> {
          String email = a.getEmail() != null ? a.getEmail().toLowerCase(Locale.ROOT) : "";
          String phone = a.getPhone() != null ? a.getPhone().replaceAll("\\s+", "") : "";
          return (!email.isBlank() && filter.contains(email)) ||
                 (!phone.isBlank() && filter.contains(phone)) ||
                 (!phone.isBlank() && filter.contains(phone.replace("+84", "0")));
        }).toList();
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

  /**
   * Chạy chiến dịch: nếu chưa tới giờ bắt đầu thì chờ (SCHEDULED), tới giờ thì RUNNING, gửi tin và đăng tin tức kèm.
   */
  private void start(Campaign c) {
    Instant now = Instant.now();
    c.setUpdatedAt(now);
    if (c.getStartsAt() != null && c.getStartsAt().isAfter(now)) {
      c.setStatus("SCHEDULED");
      campaigns.save(c);
      return;
    }
    if (c.getStartsAt() == null) {
      c.setStartsAt(now);
    }
    c.setStatus("RUNNING");
    campaigns.save(c);
    setNewsPublished(c, true);
    dispatchPromotions(c);
  }

  private void finish(Campaign c) {
    Instant now = Instant.now();
    c.setStatus("ENDED");
    if (c.getEndsAt() == null || c.getEndsAt().isAfter(now)) {
      c.setEndsAt(now);
    }
    c.setUpdatedAt(now);
    campaigns.save(c);
    setNewsPublished(c, false);
    UUID id = c.getId();
    vouchers.findAll().stream()
        .filter(v -> id.equals(v.getCampaignId()))
        .forEach(v -> {
          v.setStatus("ENDED");
          v.setEnabled(false);
          vouchers.save(v);
        });
  }

  /** Mỗi phút: bật chiến dịch đã lên lịch khi tới giờ, kết thúc chiến dịch đã hết hạn. */
  @Scheduled(fixedDelay = 60000, initialDelay = 15000)
  @Transactional
  public void runSchedule() {
    Instant now = Instant.now();
    for (Campaign c : campaigns.findByStatus("SCHEDULED")) {
      if (c.getStartsAt() == null || !c.getStartsAt().isAfter(now)) {
        log.info("Tự động chạy chiến dịch đã lên lịch '{}'", c.getName());
        start(c);
        auditService.log("AUTO_START_CAMPAIGN", "Tự động chạy chiến dịch '" + c.getName() + "' theo lịch");
      }
    }
    for (Campaign c : campaigns.findByStatus("RUNNING")) {
      if (c.getEndsAt() != null && c.getEndsAt().isBefore(now)) {
        log.info("Tự động kết thúc chiến dịch '{}'", c.getName());
        finish(c);
        auditService.log("AUTO_END_CAMPAIGN", "Tự động kết thúc chiến dịch '" + c.getName() + "' khi hết hạn");
      }
    }
  }

  // ---------- Tin tức đăng kèm chiến dịch (lưu như một bài viết, category PROMO) ----------

  private static String newsKey(Campaign c) {
    return "article:campaign-" + c.getId();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> readNews(Map<String, Object> body) {
    if (!(body.get("news") instanceof Map<?, ?> raw)) return null;
    Map<String, Object> n = (Map<String, Object>) raw;
    if (Boolean.FALSE.equals(n.get("enabled"))) return null;
    String title = n.get("title") == null ? "" : n.get("title").toString().trim();
    String excerpt = n.get("excerpt") == null ? "" : n.get("excerpt").toString().trim();
    String content = n.get("body") == null ? "" : n.get("body").toString().trim();
    if (title.isEmpty() && excerpt.isEmpty() && content.isEmpty()) return null;
    if (title.isEmpty() || excerpt.isEmpty() || content.isEmpty()) {
      throw new BusinessException("Tin tức đăng kèm cần đủ tiêu đề, tóm tắt và nội dung");
    }
    if (title.length() > 160 || excerpt.length() > 400 || content.length() > 12000) {
      throw new BusinessException("Tin tức quá dài (tiêu đề ≤ 160, tóm tắt ≤ 400, nội dung ≤ 12.000 ký tự)");
    }
    return new LinkedHashMap<>(Map.of("title", title, "excerpt", excerpt, "body", content));
  }

  private void saveNews(Campaign c, Map<String, Object> news) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", "campaign-" + c.getId());
    row.put("title", news.get("title"));
    row.put("excerpt", news.get("excerpt"));
    row.put("body", news.get("body"));
    row.put("category", "PROMO");
    row.put("status", "DRAFT");
    row.put("source", "CAMPAIGN");
    row.put("campaignId", c.getId().toString());
    row.put("createdAt", Instant.now().toString());
    row.put("updatedAt", Instant.now().toString());
    row.put("publishedAt", null);
    row.put("expiresAt", c.getEndsAt() != null ? c.getEndsAt().toString() : null);
    docs.put(newsKey(c), row);
  }

  private void setNewsPublished(Campaign c, boolean published) {
    var row = docs.lock(newsKey(c));
    if (row == null || row.getData() == null) return; // chiến dịch không có tin tức kèm
    Map<String, Object> news = new LinkedHashMap<>(docs.read(row));
    if (news.isEmpty()) return;
    news.put("status", published ? "PUBLISHED" : "DRAFT");
    if (published) {
      news.put("publishedAt", Instant.now().toString());
      news.put("expiresAt", c.getEndsAt() != null ? c.getEndsAt().toString() : null);
    }
    news.put("updatedAt", Instant.now().toString());
    docs.save(row, news);
  }

  // ---------- Mẫu chiến dịch theo mùa ----------

  /** Ngày mùng 1 Tết Nguyên Đán (âm lịch) các năm tới. */
  private static final Map<Integer, LocalDate> TET = Map.of(
      2026, LocalDate.of(2026, 2, 17),
      2027, LocalDate.of(2027, 2, 6),
      2028, LocalDate.of(2028, 1, 26),
      2029, LocalDate.of(2029, 2, 13),
      2030, LocalDate.of(2030, 2, 3));

  private static String local(LocalDate d, int hour) {
    return d.atTime(hour, 0).toString();
  }

  /** Lấy lần diễn ra tiếp theo (hoặc đang diễn ra) của một khung ngày lặp lại hằng năm. */
  private static LocalDate[] nextWindow(LocalDate today, java.util.function.IntFunction<LocalDate[]> byYear) {
    for (int y = today.getYear(); y <= today.getYear() + 2; y++) {
      LocalDate[] w = byYear.apply(y);
      if (w != null && !w[1].isBefore(today)) return w;
    }
    return byYear.apply(today.getYear() + 1);
  }

  private static Map<String, Object> template(String key, String icon, String season, LocalDate[] w, String name,
      String audience, String audienceFilter, String channels, String suggestedVoucher,
      String title, String messageBody, String banner, boolean withNews, String newsExcerpt, String newsBody) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("key", key);
    m.put("icon", icon);
    m.put("season", season);
    m.put("name", name);
    m.put("description", "Tạo từ mẫu \"" + season + "\". Kiểm tra lại ngày, nội dung và voucher trước khi gửi duyệt.");
    m.put("startsAt", local(w[0], 0));
    m.put("endsAt", local(w[1], 23).replace("T23:00", "T23:59"));
    m.put("audience", audience);
    m.put("audienceFilter", audienceFilter);
    m.put("channels", channels);
    m.put("suggestedVoucher", suggestedVoucher);
    m.put("messageTitle", title);
    m.put("messageBody", messageBody);
    m.put("bannerText", banner);
    Map<String, Object> news = new LinkedHashMap<>();
    news.put("enabled", withNews);
    news.put("title", withNews ? title : "");
    news.put("excerpt", withNews ? newsExcerpt : "");
    news.put("body", withNews ? newsBody : "");
    m.put("news", news);
    return m;
  }

  public List<Map<String, Object>> templates() {
    LocalDate today = LocalDate.now(VN);
    java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("dd/MM");
    List<Map<String, Object>> out = new ArrayList<>();

    LocalDate[] tet = nextWindow(today, y -> TET.containsKey(y) ? new LocalDate[] {TET.get(y).minusDays(14), TET.get(y).plusDays(6)} : null);
    int tetYear = tet[1].getYear();
    out.add(template("TET", "🧧", "Tết Nguyên Đán", tet, "Khai xuân " + tetYear + " – Lì xì sân đầu năm",
        "ALL", null, "EMAIL,BANNER", "COURTLY50K",
        "Lì xì đầu năm: giảm 50.000₫ khi đặt sân dịp Tết",
        "Courtly chúc bạn năm mới khỏe mạnh! Từ " + tet[0].format(f) + " đến " + tet[1].format(f) + ", nhập mã COURTLY50K để được giảm 50.000₫ cho mỗi đơn đặt sân. Sân mở cửa xuyên Tết (trừ đêm Giao thừa).",
        "🧧 Lì xì đầu năm: giảm 50.000₫ mỗi đơn đặt sân – nhập mã COURTLY50K",
        true, "Giảm 50.000₫ mỗi đơn đặt sân từ " + tet[0].format(f) + " đến " + tet[1].format(f) + ". Sân mở cửa xuyên Tết.",
        "Chào xuân " + tetYear + ", Courtly gửi tặng bạn lì xì sân đầu năm.\n\n• Ưu đãi: giảm 50.000₫ cho mỗi đơn đặt sân khi nhập mã COURTLY50K.\n• Thời gian: " + tet[0].format(f) + " – " + tet[1].format(f) + ".\n• Lịch mở cửa: sân hoạt động xuyên Tết, nghỉ đêm Giao thừa; mùng 1 mở từ 8:00.\n\nĐặt sân sớm để giữ khung giờ đẹp ngày Tết!"));

    LocalDate[] summer = nextWindow(today, y -> new LocalDate[] {LocalDate.of(y, 6, 1), LocalDate.of(y, 7, 31)});
    out.add(template("SUMMER", "☀️", "Hè", summer, "Hè " + summer[0].getYear() + " – Đánh sớm mát, giá mềm",
        "ALL", null, "EMAIL,BANNER", "HE2026",
        "Hè sôi động: ưu đãi đặt sân khung giờ sáng",
        "Hè này ra sân sớm cho mát! Từ " + summer[0].format(f) + " đến " + summer[1].format(f) + ", nhập mã ưu đãi hè khi đặt sân để được giảm giá. Áp dụng theo điều kiện của voucher.",
        "☀️ Hè sôi động: ưu đãi đặt sân, đánh sớm cho mát",
        true, "Ưu đãi đặt sân mùa hè từ " + summer[0].format(f) + " đến " + summer[1].format(f) + ".",
        "Mùa hè là mùa tennis! Courtly dành ưu đãi cho các buổi chơi sáng sớm, khi trời còn mát.\n\n• Thời gian: " + summer[0].format(f) + " – " + summer[1].format(f) + ".\n• Cách dùng: nhập mã ưu đãi hè ở bước thanh toán khi đặt sân online.\n• Gợi ý: khung 6:00–9:00 sân ngoài trời mát và ít nắng nhất.\n\nHẹn gặp bạn trên sân!"));

    LocalDate[] national = nextWindow(today, y -> new LocalDate[] {LocalDate.of(y, 8, 29), LocalDate.of(y, 9, 3)});
    out.add(template("NATIONAL_DAY", "🇻🇳", "Quốc khánh 2/9", national, "Mừng Quốc khánh 2/9/" + national[0].getYear(),
        "ALL", null, "EMAIL,BANNER", "FLASH25",
        "Mừng Quốc khánh: giảm giá đặt sân dịp nghỉ lễ",
        "Kỳ nghỉ lễ 2/9 này, rủ cả nhóm ra sân! Từ " + national[0].format(f) + " đến " + national[1].format(f) + " Courtly giảm giá đặt sân theo mã ưu đãi dịp lễ.",
        "🇻🇳 Nghỉ lễ 2/9: giảm giá đặt sân – rủ cả nhóm ra sân",
        true, "Ưu đãi đặt sân dịp nghỉ lễ Quốc khánh từ " + national[0].format(f) + " đến " + national[1].format(f) + ".",
        "Chào mừng Quốc khánh, Courtly giảm giá đặt sân suốt kỳ nghỉ lễ.\n\n• Thời gian: " + national[0].format(f) + " – " + national[1].format(f) + ".\n• Cách dùng: nhập mã ưu đãi dịp lễ khi đặt sân.\n• Lưu ý: dịp lễ đông khách, nên đặt trước ít nhất 2 ngày."));

    LocalDate[] bf = nextWindow(today, y -> {
      LocalDate thu = LocalDate.of(y, 11, 1).with(java.time.temporal.TemporalAdjusters.dayOfWeekInMonth(4, java.time.DayOfWeek.THURSDAY));
      return new LocalDate[] {thu.plusDays(1), thu.plusDays(4)};
    });
    out.add(template("BLACK_FRIDAY", "🖤", "Black Friday", bf, "Black Friday " + bf[0].getYear() + " – Giảm 25%",
        "ALL", null, "EMAIL,BANNER", "FLASH25",
        "Black Friday: giảm 25% đặt sân trong 4 ngày",
        "Chỉ " + bf[0].format(f) + " – " + bf[1].format(f) + ": nhập mã FLASH25 để giảm 25% đơn đặt sân. Số lượt có hạn!",
        "🖤 Black Friday: giảm 25% đặt sân – mã FLASH25, chỉ 4 ngày",
        true, "Giảm 25% đặt sân từ " + bf[0].format(f) + " đến " + bf[1].format(f) + " với mã FLASH25. Số lượt có hạn.",
        "Black Friday đã đến với Courtly!\n\n• Ưu đãi: giảm 25% đơn đặt sân với mã FLASH25.\n• Thời gian: " + bf[0].format(f) + " – " + bf[1].format(f) + ".\n• Số lượt có hạn, áp dụng theo điều kiện của voucher.\n\nĐặt ngay kẻo lỡ!"));

    LocalDate[] yearEnd = nextWindow(today, y -> new LocalDate[] {LocalDate.of(y, 12, 20), LocalDate.of(y + 1, 1, 1)});
    out.add(template("YEAR_END", "🎄", "Giáng sinh & Năm mới", yearEnd, "Giáng sinh & đón năm " + (yearEnd[0].getYear() + 1),
        "ALL", null, "EMAIL,BANNER", "COURTLY50K",
        "Giáng sinh & Năm mới: quà tặng cuối năm từ Courtly",
        "Khép lại một năm cùng Courtly! Từ " + yearEnd[0].format(f) + " đến " + yearEnd[1].format(f) + ", nhập mã COURTLY50K để được giảm 50.000₫ mỗi đơn đặt sân.",
        "🎄 Quà cuối năm: giảm 50.000₫ mỗi đơn đặt sân – mã COURTLY50K",
        true, "Giảm 50.000₫ mỗi đơn đặt sân từ " + yearEnd[0].format(f) + " đến " + yearEnd[1].format(f) + ".",
        "Cảm ơn bạn đã đồng hành cùng Courtly trong năm qua.\n\n• Ưu đãi: giảm 50.000₫ mỗi đơn với mã COURTLY50K.\n• Thời gian: " + yearEnd[0].format(f) + " – " + yearEnd[1].format(f) + ".\n• Giờ hoạt động đêm 31/12: đến 22:00.\n\nChúc bạn Giáng sinh an lành và năm mới nhiều trận thắng!"));

    LocalDate[] loyal = new LocalDate[] {today.plusDays(1), today.plusDays(30)};
    out.add(template("LOYALTY", "👑", "Tri ân hội viên", loyal, "Tri ân hội viên Masters & Grand Slam",
        "TIER", "MASTERS,GRAND_SLAM", "EMAIL,BANNER", "VIP10",
        "Cảm ơn bạn – ưu đãi riêng cho hội viên hạng cao",
        "Cảm ơn bạn đã gắn bó với Courtly. Trong 30 ngày tới, hội viên Masters và Grand Slam được giảm thêm 10% với mã VIP10.",
        "👑 Ưu đãi riêng hội viên: giảm thêm 10% – mã VIP10",
        false, "", ""));
    return out;
  }

  /** Dữ liệu demo: tạo sẵn các chiến dịch theo mùa từ mẫu (không gửi tin nào lúc tạo). */
  @Transactional
  public void seedDemoCampaigns(UUID adminId) {
    Account admin = accounts.findById(adminId).orElse(null);
    for (Map<String, Object> tpl : templates()) {
      String status = switch (String.valueOf(tpl.get("key"))) {
        case "BLACK_FRIDAY", "YEAR_END" -> "SCHEDULED";
        case "TET" -> "PENDING_APPROVAL";
        default -> null;
      };
      if (status == null) continue;
      Campaign c = new Campaign();
      c.setName((String) tpl.get("name"));
      c.setDescription("Chiến dịch dựng sẵn theo mùa. " + ("SCHEDULED".equals(status)
          ? "Đã duyệt, tự chạy khi tới ngày bắt đầu." : "Chờ quản trị viên kiểm tra và duyệt."));
      c.setAudience((String) tpl.get("audience"));
      c.setAudienceFilter((String) tpl.get("audienceFilter"));
      c.setChannels((String) tpl.get("channels"));
      c.setMessageTitle((String) tpl.get("messageTitle"));
      c.setMessageBody((String) tpl.get("messageBody"));
      c.setBannerText((String) tpl.get("bannerText"));
      c.setStartsAt(parseInstant((String) tpl.get("startsAt")));
      c.setEndsAt(parseInstant((String) tpl.get("endsAt")));
      c.setBudgetLimit(new BigDecimal("5000000"));
      c.setCreatedBy(admin);
      if ("SCHEDULED".equals(status)) c.setApprovedBy(admin);
      c.setStatus(status);
      campaigns.save(c);
      @SuppressWarnings("unchecked")
      Map<String, Object> news = (Map<String, Object>) tpl.get("news");
      if (news != null && Boolean.TRUE.equals(news.get("enabled"))) saveNews(c, news);
    }
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
    m.put("audienceFilter", c.getAudienceFilter());
    m.put("channels", c.getChannels());
    m.put("messageTitle", c.getMessageTitle());
    m.put("messageBody", c.getMessageBody());
    m.put("bannerText", c.getBannerText());
    m.put("budgetLimit", c.getBudgetLimit());
    m.put("createdBy", c.getCreatedBy() != null ? c.getCreatedBy().getFullName() : null);
    m.put("approvedBy", c.getApprovedBy() != null ? c.getApprovedBy().getFullName() : null);
    m.put("createdAt", c.getCreatedAt());
    if (c.getId() != null) {
      var news = docs.get(newsKey(c));
      m.put("news", news.isEmpty() ? null : Map.of(
          "title", String.valueOf(news.getOrDefault("title", "")),
          "excerpt", String.valueOf(news.getOrDefault("excerpt", "")),
          "status", String.valueOf(news.getOrDefault("status", "DRAFT")),
          "id", String.valueOf(news.getOrDefault("id", ""))));
    }
    return m;
  }
}
