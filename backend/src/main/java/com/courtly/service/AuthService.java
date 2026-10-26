package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.Account;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {
  private final AccountRepository accounts;
  private final PasswordEncoder encoder;
  private final HttpSessionSecurityContextRepository contexts;
  private final DocumentService documents;
  private final EmailService emails;

  @Value("${courtly.admin-email:admin@gmail.com}")
  private String adminEmail;

  @Value("${courtly.demo-mode:false}")
  private boolean demoMode;

  @Value("${courtly.security.otp-secret:CourtlySecureHmacSecretKey2026!}")
  private String otpSecret;

  private final java.util.concurrent.ConcurrentHashMap<String, long[]> failures =
      new java.util.concurrent.ConcurrentHashMap<>();

  private void pruneFailures() {
    long now = System.currentTimeMillis();
    failures.entrySet().removeIf(e -> now - e.getValue()[0] > 900000);
  }

  public Optional<Account> optCurrent(HttpServletRequest req) {
    var session = req.getSession(false);
    if (session == null || session.getAttribute("accountId") == null) {
      return Optional.empty();
    }
    UUID id = (UUID) session.getAttribute("accountId");
    return accounts.findById(id);
  }

  public Account current(HttpServletRequest req) {
    var session = req.getSession(false);
    if (session == null || session.getAttribute("accountId") == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
    var a =
        accounts
            .findById((UUID) session.getAttribute("accountId"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    if (!"ACTIVE".equals(a.getStatus())
        || !Objects.equals(session.getAttribute("authVersion"), a.getAuthVersion())) {
      session.invalidate();
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "Phiên đã bị thu hồi hoặc tài khoản bị khóa");
    }
    return a;
  }

  public void admin(Account a) {
    if (!"ADMIN".equals(a.getRole()))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Chỉ quản trị viên được thực hiện thao tác này");
  }

  public void cashier(Account a) {
    if (!Set.of("ADMIN", "STAFF").contains(a.getRole()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ nhân viên thu ngân hoặc quản trị được thu tiền mặt");
  }

  public boolean owner(Account a) {
    return a.getEmail().equalsIgnoreCase(adminEmail);
  }

  public Map<String, Object> user(Account a) {
    return map(
        "id",
        a.getId(),
        "accountId",
        a.getId(),
        "name",
        a.getFullName(),
        "email",
        a.getEmail(),
        "phone",
        a.getPhone(),
        "role",
        a.getRole(),
        "isOwner",
        owner(a));
  }

  public Map<String, Object> session(HttpServletRequest req) {
    if (req.getSession(false) == null || req.getSession(false).getAttribute("accountId") == null)
      return map("authenticated", false, "ownerSetupAvailable", false);
    return map("authenticated", true, "user", user(current(req)), "ownerSetupAvailable", false);
  }

  private Map<String, Object> signIn(Account a, HttpServletRequest req, HttpServletResponse res) {
    req.getSession(true);
    req.changeSessionId();
    req.getSession().setAttribute("accountId", a.getId());
    req.getSession().setAttribute("authVersion", a.getAuthVersion());
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            a.getId().toString(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + a.getRole()))));
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    return map("authenticated", true, "user", user(a));
  }

  private String email(Object v) {
    String e = text((String) v, "Email").toLowerCase(Locale.ROOT);
    require(e.length() <= 254 && e.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Email không hợp lệ");
    return e;
  }

  private String password(Object v) {
    require(v instanceof String, "Mật khẩu không hợp lệ");
    String p = (String) v;
    require(
        p.length() >= 8 && p.length() <= 128 && p.getBytes(StandardCharsets.UTF_8).length <= 72,
        "Mật khẩu từ 8 ký tự, tối đa 72 byte UTF-8");
    return p;
  }

  public static String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public String hashOtp(String code) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(otpSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(code.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to calculate HMAC-SHA-256 OTP hash", e);
    }
  }

  @Transactional
  public Map<String, Object> action(
      String action, Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    if (action.equals("logout")) {
      if (req.getSession(false) != null) req.getSession(false).invalidate();
      SecurityContextHolder.clearContext();
      return map("authenticated", false);
    }
    if (action.equals("login")) {
      pruneFailures();
      org.slf4j.LoggerFactory.getLogger(AuthService.class).info("Auth login attempt from IP: {}", req.getRemoteAddr());
      String e = email(b.get("email")), key = req.getRemoteAddr() + ":" + e;
      long t = System.currentTimeMillis();
      long[] tries =
          failures.compute(
              key, (k, old) -> old == null || t - old[0] > 900000 ? new long[] {t, 0} : old);
      require(tries[1] < 10, "Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.");
      var found = accounts.findByEmailIgnoreCase(e);
      String supplied = String.valueOf(b.getOrDefault("password", ""));
      if (found.isPresent() && "PENDING_ACTIVATION".equals(found.get().getStatus())) {
        if (found.get().getPasswordHash() != null && encoder.matches(supplied, found.get().getPasswordHash())) {
          String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
          String otpKey = "otp:activation:" + found.get().getEmail().toLowerCase(Locale.ROOT);
          documents.put(
              otpKey,
              map(
                  "documentKey", otpKey,
                  "accountId", found.get().getId().toString(),
                  "email", found.get().getEmail(),
                  "codeHash", hashOtp(code),
                  "attempts", 0,
                  "used", false,
                  "expiresAt", Instant.now().plusSeconds(900).toString()));
          emails.sendActivationEmail(found.get().getEmail(), found.get().getFullName(), code);
          var resp = new LinkedHashMap<String, Object>();
          resp.put("requiresActivation", true);
          resp.put("email", found.get().getEmail());
          if (demoMode || !emails.isConfigured()) resp.put("devCode", code);
          if (!emails.isConfigured() && !demoMode) {
            resp.put("emailWarning", "Hệ thống đang chạy chế độ phát triển (chưa có SMTP Password). Mã kích hoạt OTP hiển thị trực tiếp để bạn kích hoạt ngay.");
          }
          resp.put("message", "Tài khoản của bạn chưa được kích hoạt. Mã OTP 6 số mới đã được tạo.");
          return resp;
        }
      }
      if (found.isEmpty()
          || found.get().getPasswordHash() == null
          || !encoder.matches(supplied, found.get().getPasswordHash())
          || !"ACTIVE".equals(found.get().getStatus())) {
        synchronized (tries) {
          tries[1]++;
        }
        throw new BusinessException("Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.");
      }
      failures.remove(key);
      return signIn(found.get(), req, res);
    }
    if (action.equals("register")) {
      String e = email(b.get("email")), p = password(b.get("password"));
      require(
          accounts.findByEmailIgnoreCase(e).isEmpty(),
          "Email đã có tài khoản. Hãy đăng nhập hoặc liên hệ quầy.");
      String phone = (String) b.getOrDefault("phone", "");
      if (phone != null && !phone.isBlank()) {
        phone = phone.trim().replaceAll("\\s+", "");
        require(phone.matches("^0[0-9]{9}$"), "Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0)");
      } else if (Boolean.TRUE.equals(b.get("requireActivation"))) {
        throw new BusinessException("Vui lòng cung cấp số điện thoại liên hệ để đặt sân");
      }
      Account a = new Account();
      a.setFullName(text((String) b.get("name"), "Họ tên"));
      a.setEmail(e);
      a.setPhone(phone != null ? phone : "");
      a.setRole("CUSTOMER");
      a.setPasswordHash(encoder.encode(p));

      boolean requireAct = Boolean.TRUE.equals(b.get("requireActivation"));
      if (requireAct) {
        a.setStatus("PENDING_ACTIVATION");
        accounts.saveAndFlush(a);

        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String otpKey = "otp:activation:" + a.getEmail().toLowerCase(Locale.ROOT);
        documents.put(
            otpKey,
            map(
                "documentKey", otpKey,
                "accountId", a.getId().toString(),
                "email", a.getEmail(),
                "codeHash", hashOtp(code),
                "attempts", 0,
                "used", false,
                "expiresAt", Instant.now().plusSeconds(900).toString()));

        emails.sendActivationEmail(a.getEmail(), a.getFullName(), code)
            .whenComplete((sent, err) -> {
              if (err != null || Boolean.FALSE.equals(sent)) {
                log.error("Không thể gửi email kích hoạt tới {}. Lỗi: {}", a.getEmail(), err != null ? err.getMessage() : "SMTP dispatch failed");
              }
            });

        var resp = new LinkedHashMap<String, Object>();
        resp.put("requiresActivation", true);
        resp.put("email", a.getEmail());
        if (demoMode || !emails.isConfigured()) resp.put("devCode", code);
        if (!emails.isConfigured() && !demoMode) {
          resp.put("emailWarning", "Hệ thống đang chạy chế độ phát triển (chưa có SMTP Password). Mã kích hoạt OTP hiển thị trực tiếp để bạn kích hoạt ngay.");
        }
        resp.put("message", emails.isConfigured() 
            ? "Mã kích hoạt OTP 6 số đã được gửi tới email " + a.getEmail() + ". Vui lòng nhập để hoàn tất đăng ký."
            : "Tài khoản đã tạo. Vui lòng điền mã OTP kích hoạt bên dưới để hoàn tất đăng ký.");
        return resp;
      } else {
        a.setStatus("ACTIVE");
        accounts.saveAndFlush(a);
        return signIn(a, req, res);
      }
    }
    if (action.equals("resend-activation")) {
      String e = email(b.get("email"));
      var found = accounts.findByEmailIgnoreCase(e);
      if (found.isEmpty()) {
        throw new BusinessException("Không tìm thấy tài khoản với email " + e);
      }
      Account a = found.get();
      require("PENDING_ACTIVATION".equals(a.getStatus()), "Tài khoản đã được kích hoạt hoặc không ở trạng thái chờ kích hoạt.");

      String otpKey = "otp:activation:" + a.getEmail().toLowerCase(Locale.ROOT);
      String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
      documents.put(
          otpKey,
          map(
              "documentKey", otpKey,
              "accountId", a.getId().toString(),
              "email", a.getEmail(),
              "codeHash", hashOtp(code),
              "attempts", 0,
              "used", false,
              "expiresAt", Instant.now().plusSeconds(900).toString()));

      emails.sendActivationEmail(a.getEmail(), a.getFullName(), code)
          .whenComplete((sent, err) -> {
            if (err != null || Boolean.FALSE.equals(sent)) {
              log.error("Không thể gửi lại email kích hoạt tới {}. Lỗi: {}", a.getEmail(), err != null ? err.getMessage() : "SMTP dispatch failed");
            }
          });

      var resp = new LinkedHashMap<String, Object>();
      resp.put("success", true);
      resp.put("email", a.getEmail());
      if (demoMode || !emails.isConfigured()) resp.put("devCode", code);
      if (!emails.isConfigured() && !demoMode) {
        resp.put("emailWarning", "Hệ thống đang chạy chế độ phát triển (chưa có SMTP Password). Mã kích hoạt OTP hiển thị trực tiếp để bạn kích hoạt ngay.");
      }
      resp.put("message", emails.isConfigured()
          ? "Mã kích hoạt OTP 6 số mới đã được gửi tới email " + a.getEmail()
          : "Mã kích hoạt OTP 6 số mới đã được tạo cho " + a.getEmail());
      return resp;
    }
    if (action.equals("forgot-password")) {
      String e = email(b.get("email")).toLowerCase(Locale.ROOT);
      var found = accounts.findByEmailIgnoreCase(e);
      String code = null;
      if (found.isPresent() && "ACTIVE".equals(found.get().getStatus())) {
        Account a = found.get();
        code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String key = "otp:reset:" + a.getEmail().toLowerCase(Locale.ROOT);
        documents.put(
            key,
            map(
                "documentKey", key,
                "accountId", a.getId().toString(),
                "email", a.getEmail(),
                "codeHash", hashOtp(code),
                "attempts", 0,
                "used", false,
                "expiresAt", Instant.now().plusSeconds(900).toString()));
        emails.sendPasswordResetEmail(a.getEmail(), a.getFullName(), code)
            .whenComplete((sent, err) -> {
              if (err != null || Boolean.FALSE.equals(sent)) {
                log.error("Không thể gửi email đặt lại mật khẩu tới {}. Lỗi: {}", a.getEmail(), err != null ? err.getMessage() : "SMTP dispatch failed");
              }
            });
      }
      var resp = new LinkedHashMap<String, Object>();
      resp.put("success", true);
      resp.put("message", "Nếu email của bạn đã đăng ký trên hệ thống, mã xác nhận OTP đã được gửi về hòm thư. Mã có hiệu lực trong 15 phút.");
      resp.put("email", e);
      if ((demoMode || !emails.isConfigured()) && code != null) {
        resp.put("code", code);
        resp.put("devCode", code);
      }
      return resp;
    }
    if (action.equals("reset-password")) {
      String code = text((String) b.getOrDefault("code", b.get("token")), "Mã xác nhận").trim();
      String email = b.get("email") != null ? String.valueOf(b.get("email")).trim().toLowerCase(Locale.ROOT) : "";
      Map<String, Object> info = null;
      com.courtly.entity.AppDocument row = null;

      if (!email.isBlank()) {
        String key = "otp:reset:" + email;
        row = documents.lock(key);
        info = documents.read(row);
        if (info.containsKey("accountId")) {
          int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
          if (attempts >= 5 || !Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now())) {
            throw new BusinessException("Mã xác nhận đã hết hạn hoặc thử sai quá 5 lần. Vui lòng yêu cầu mã mới.");
          }
          String storedHash = (String) info.get("codeHash");
          boolean valid = storedHash != null && MessageDigest.isEqual(
              hashOtp(code).getBytes(StandardCharsets.UTF_8),
              storedHash.getBytes(StandardCharsets.UTF_8));
          if (!valid) {
            info.put("attempts", attempts + 1);
            documents.save(row, info);
            throw new BusinessException("Mã xác nhận không đúng (còn " + (4 - attempts) + " lần thử).");
          }
        }
      }

      require(
          info != null
              && info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã xác nhận không đúng, đã dùng hoặc đã hết hạn (15 phút)");
      Account a =
          accounts.findForUpdate(UUID.fromString((String) info.get("accountId"))).orElseThrow();
      require("ACTIVE".equals(a.getStatus()), "Tài khoản đã bị khóa");
      a.setPasswordHash(encoder.encode(password(b.get("password"))));
      a.setAuthVersion(a.getAuthVersion() + 1);
      info.put("used", true);
      documents.save(row, info);
      return signIn(a, req, res);
    }
    if (action.equals("activate")) {
      String token = text((String) b.getOrDefault("code", b.get("token")), "Mã kích hoạt").trim();
      String email = b.get("email") != null ? String.valueOf(b.get("email")).trim().toLowerCase(Locale.ROOT) : "";
      Map<String, Object> info = null;
      com.courtly.entity.AppDocument row = null;

      if (!email.isBlank()) {
        String key = "otp:activation:" + email;
        row = documents.lock(key);
        info = documents.read(row);
        if (info.containsKey("accountId")) {
          int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
          if (attempts >= 5 || !Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now())) {
            throw new BusinessException("Mã kích hoạt đã hết hạn hoặc thử sai quá 5 lần. Vui lòng yêu cầu mã mới.");
          }
          String storedHash = (String) info.get("codeHash");
          boolean valid = storedHash != null && MessageDigest.isEqual(
              hashOtp(token).getBytes(StandardCharsets.UTF_8),
              storedHash.getBytes(StandardCharsets.UTF_8));
          if (!valid) {
            info.put("attempts", attempts + 1);
            documents.save(row, info);
            throw new BusinessException("Mã kích hoạt không đúng (còn " + (4 - attempts) + " lần thử).");
          }
        }
      }

      require(
          info != null
              && info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã kích hoạt không đúng, đã dùng hoặc đã hết hạn (15 phút)");
      Account a =
          accounts.findForUpdate(UUID.fromString((String) info.get("accountId"))).orElseThrow();
      require("ACTIVE".equals(a.getStatus()) || "PENDING_ACTIVATION".equals(a.getStatus()), "Tài khoản đã bị khóa");
      if ("PENDING_ACTIVATION".equals(a.getStatus())) {
        a.setStatus("ACTIVE");
      }
      if (b.containsKey("password") && b.get("password") != null && !String.valueOf(b.get("password")).isBlank()) {
        a.setPasswordHash(encoder.encode(password(b.get("password"))));
      }
      a.setAuthVersion(a.getAuthVersion() + 1);
      info.put("used", true);
      documents.save(row, info);
      return signIn(a, req, res);
    }
    if (action.equals("ticket"))
      return activation(current(req), UUID.fromString((String) b.get("accountId")));
    if (action.equals("password")) {
      Account a = current(req);
      require(
          a.getPasswordHash() != null
              && encoder.matches(String.valueOf(b.get("currentPassword")), a.getPasswordHash()),
          "Mật khẩu hiện tại không đúng");
      a.setPasswordHash(encoder.encode(password(b.getOrDefault("newPassword", b.get("password")))));
      a.setAuthVersion(a.getAuthVersion() + 1);
      return signIn(a, req, res);
    }
    throw new BusinessException("Thao tác tài khoản không hỗ trợ");
  }

  @Transactional
  public Map<String, Object> activation(Account actor, UUID id) {
    admin(actor);
    documents.mutationLock();
    for (var old : documents.list("activation:"))
      if (id.toString().equals(old.get("accountId")) && !Boolean.TRUE.equals(old.get("used"))) {
        old.put("used", true);
        if (old.get("documentKey") instanceof String key) documents.put(key, old);
      }
    Account a = accounts.findForUpdate(id).orElseThrow();
    require(
        !owner(a) || a.getId().equals(actor.getId()),
        "Không cấp mã của chủ hệ thống cho người khác");
    String token = UUID.randomUUID() + "." + UUID.randomUUID();
    documents.put(
        "activation:" + hash(token),
        map(
            "documentKey",
            "activation:" + hash(token),
            "accountId",
            id.toString(),
            "used",
            false,
            "expiresAt",
            Instant.now().plusSeconds(86400).toString()));
    return map("token", token, "expiresAt", Instant.now().plusSeconds(86400).toString());
  }
}
