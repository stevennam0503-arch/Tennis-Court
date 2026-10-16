package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.Account;
import com.courtly.repository.TournamentRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ContentService {
  private final DocumentService docs;
  private final AuthService auth;
  private final TournamentRepository tournaments;
  private final RequestService requests;

  private String string(Map<String, Object> b, String k, int max, boolean required) {
    Object v = b.getOrDefault(k, "");
    require(v instanceof String, k + " không hợp lệ");
    String s = ((String) v).trim();
    require(s.length() <= max && (!required || !s.isEmpty()), k + " không hợp lệ");
    return s;
  }

  public Map<String, Object> club() {
    var saved = docs.get("club");
    if (!saved.isEmpty()) return saved;
    try {
      return docs.decode(
          new String(
              new ClassPathResource("default-club.json").getInputStream().readAllBytes(),
              java.nio.charset.StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Map<String, Object> get(Account viewer) {
    boolean admin = viewer != null && "ADMIN".equals(viewer.getRole());
    var articles = new ArrayList<Map<String, Object>>();
    for (var a : docs.list("article:"))
      if (admin || "PUBLISHED".equals(a.get("status"))) {
        var item = new LinkedHashMap<>(a);
        if (!admin && item.get("tournamentId") != null) {
          String tid = item.get("tournamentId").toString();
          if (!tid.isBlank()
              && !tid.equals("null")
              && tournaments
                  .findById(UUID.fromString(tid))
                  .map(t -> "DRAFT".equals(t.getStatus()))
                  .orElse(true)) item.put("tournamentId", null);
        }
        articles.add(item);
      }
    if (!admin)
      for (var t : tournaments.findAll())
        if (!"DRAFT".equals(t.getStatus()))
          articles.add(
              map(
                  "id",
                  "giai-" + t.getId(),
                  "title",
                  t.getName(),
                  "excerpt",
                  "Thông tin giải đấu tại " + t.getLocation(),
                  "body",
                  "Thông tin được cập nhật từ lịch giải đấu của câu lạc bộ.",
                  "category",
                  "TOURNAMENT",
                  "publishedAt",
                  t.getStartDate().toString(),
                  "source",
                  "TOURNAMENT",
                  "tournamentId",
                  t.getId(),
                  "tournament",
                  map(
                      "id",
                      t.getId(),
                      "name",
                      t.getName(),
                      "format",
                      t.getFormat(),
                      "start",
                      t.getStartDate(),
                      "end",
                      t.getEndDate(),
                      "deadline",
                      t.getRegistrationDeadline(),
                      "fee",
                      t.getRegistrationFee(),
                      "status",
                      t.getStatus(),
                      "max",
                      t.getMaxParticipants(),
                      "location",
                      t.getLocation())));
    articles.sort(
        Comparator.comparing(
            a -> String.valueOf(a.getOrDefault("publishedAt", "")), Comparator.reverseOrder()));
    var feedback = new ArrayList<Map<String, Object>>();
    for (var f : docs.list("feedback:"))
      if (admin) feedback.add(f);
      else if ("PUBLISHED".equals(f.get("status"))
          && Boolean.TRUE.equals(f.get("publishConsent"))) {
        var item = new LinkedHashMap<>(f);
        item.remove("accountId");
        item.remove("requestId");
        item.remove("publishConsent");
        feedback.add(item);
      }
    Object avg =
        feedback.isEmpty()
            ? null
            : Math.round(
                    feedback.stream()
                            .mapToInt(f -> ((Number) f.get("rating")).intValue())
                            .average()
                            .orElse(0)
                        * 10)
                / 10.0;
    return map(
        "club",
        club(),
        "articles",
        articles,
        "feedback",
        feedback,
        "sample",
        false,
        "feedbackStats",
        map("count", feedback.size(), "average", avg),
        "tournaments",
        admin
            ? tournaments.findAll().stream()
                .map(t -> map("id", t.getId(), "name", t.getName(), "status", t.getStatus()))
                .toList()
            : List.of());
  }

  public List<Map<String, Object>> mine(Account a) {
    return docs.list("feedback:").stream()
        .filter(f -> a.getId().toString().equals(f.get("accountId")))
        .toList();
  }

  public Map<String, Object> save(Account a, String method, String path, Map<String, Object> b) {
    return requests.execute(
        a.getId(),
        (String) b.get("requestId"),
        method + path,
        b,
        () -> {
          if (path.equals("/api/feedback")) {
            String msg = string(b, "message", 2000, true);
            require(msg.length() >= 10, "Nội dung cần ít nhất 10 ký tự");
            int rating = b.get("rating") instanceof Number n ? n.intValue() : 0;
            require(rating >= 1 && rating <= 5, "Đánh giá từ 1 đến 5 sao");
            oneOf((String) b.get("topic"), "COURT", "SERVICE", "WEBSITE", "TOURNAMENT", "OTHER");
            require(b.get("publishConsent") instanceof Boolean, "Cần chọn quyền công khai");
            var recent =
                mine(a).stream()
                    .filter(
                        f ->
                            Instant.parse((String) f.get("createdAt"))
                                .isAfter(Instant.now().minusSeconds(86400)))
                    .toList();
            require(
                recent.size() < 5
                    && recent.stream()
                        .noneMatch(
                            f ->
                                Instant.parse((String) f.get("createdAt"))
                                    .isAfter(Instant.now().minusSeconds(60))),
                "Đợi một phút; tối đa 5 phản hồi mỗi ngày");
            String id = UUID.randomUUID().toString();
            docs.put(
                "feedback:" + id,
                map(
                    "id",
                    id,
                    "accountId",
                    a.getId().toString(),
                    "displayName",
                    a.getFullName(),
                    "rating",
                    rating,
                    "topic",
                    b.get("topic"),
                    "message",
                    msg,
                    "publishConsent",
                    b.get("publishConsent"),
                    "status",
                    "PENDING",
                    "createdAt",
                    Instant.now().toString(),
                    "reply",
                    ""));
            return map("id", id);
          }
          auth.admin(a);
          if (path.equals("/api/content/club")) {
            var c = club();
            for (String key : new ArrayList<>(c.keySet())) {
              String v =
                  string(
                      b,
                      key,
                      key.equals("story") ? 5000 : 2000,
                      Set.of("name", "tagline", "intro", "story", "mission").contains(key));
              if (Set.of("mapUrl", "socialUrl").contains(key) && !v.isEmpty()) {
                var u = java.net.URI.create(v);
                require(
                    "https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null,
                    "URL cần HTTPS hợp lệ");
              }
              c.put(key, v);
            }
            docs.put("club", c);
            return map("ok", true);
          }
          String[] parts = path.split("/");
          if (parts[3].equals("articles")) {
            String id = parts.length > 4 ? parts[4] : UUID.randomUUID().toString();
            var old = docs.get("article:" + id);
            require(parts.length <= 4 || !old.isEmpty(), "Bài viết không tồn tại");
            oneOf((String) b.get("status"), "DRAFT", "PUBLISHED");
            oneOf((String) b.get("category"), "NEWS", "NOTICE", "TOURNAMENT");
            String tournament = String.valueOf(b.getOrDefault("tournamentId", ""));
            if (!tournament.isBlank() && !tournament.equals("null")) {
              var t = tournaments.findById(UUID.fromString(tournament)).orElseThrow();
              require(
                  !"PUBLISHED".equals(b.get("status")) || !"DRAFT".equals(t.getStatus()),
                  "Công bố giải trước khi xuất bản tin");
            }
            var row =
                map(
                    "id",
                    id,
                    "title",
                    string(b, "title", 160, true),
                    "excerpt",
                    string(b, "excerpt", 400, true),
                    "body",
                    string(b, "body", 12000, true),
                    "category",
                    b.get("category"),
                    "status",
                    b.get("status"),
                    "tournamentId",
                    tournament.isBlank() ? null : tournament,
                    "source",
                    "EDITORIAL",
                    "createdAt",
                    old.getOrDefault("createdAt", Instant.now().toString()),
                    "updatedAt",
                    Instant.now().toString(),
                    "publishedAt",
                    "PUBLISHED".equals(b.get("status"))
                        ? (old.get("publishedAt") == null
                            ? Instant.now().toString()
                            : old.get("publishedAt"))
                        : null);
            docs.put("article:" + id, row);
            return map("id", id);
          }
          var f = docs.get("feedback:" + parts[4]);
          require(!f.isEmpty(), "Phản hồi không tồn tại");
          oneOf((String) b.get("status"), "PENDING", "PUBLISHED", "PRIVATE");
          require(
              !"PUBLISHED".equals(b.get("status")) || Boolean.TRUE.equals(f.get("publishConsent")),
              "Khách chưa đồng ý công khai");
          f.put("status", b.get("status"));
          f.put("reply", string(b, "reply", 2000, false));
          f.put("repliedAt", Instant.now().toString());
          docs.put("feedback:" + parts[4], f);
          return map("id", parts[4]);
        });
  }
}
