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
import lombok.RequiredArgsConstructor;
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

  private final java.util.concurrent.ConcurrentHashMap<String, long[]> failures =
      new java.util.concurrent.ConcurrentHashMap<>();

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

  @Transactional
  public Map<String, Object> action(
      String action, Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    if (action.equals("logout")) {
      if (req.getSession(false) != null) req.getSession(false).invalidate();
      SecurityContextHolder.clearContext();
      return map("authenticated", false);
    }
    if (action.equals("login")) {
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
          String activationKey = "activation:" + hash(code);
          documents.put(
              activationKey,
              map(
                  "documentKey", activationKey,
                  "accountId", found.get().getId().toString(),
                  "email", found.get().getEmail(),
                  "code", code,
                  "used", false,
                  "expiresAt", Instant.now().plusSeconds(900).toString()));
          emails.sendActivationEmail(found.get().getEmail(), found.get().getFullName(), code);
          return map(
              "requiresActivation", true,
              "email", found.get().getEmail(),
              "devCode", code,
              "message", "Tài khoản của bạn chưa được kích hoạt. Mã OTP 6 số mới đã được gửi tới email.");
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
        String activationKey = "activation:" + hash(code);
        documents.put(
            activationKey,
            map(
                "documentKey", activationKey,
                "accountId", a.getId().toString(),
                "email", a.getEmail(),
                "code", code,
                "used", false,
                "expiresAt", Instant.now().plusSeconds(900).toString()));

        emails.sendActivationEmail(a.getEmail(), a.getFullName(), code);

        return map(
            "requiresActivation", true,
            "email", a.getEmail(),
            "devCode", code,
            "message", "Mã kích hoạt OTP 6 số đã được gửi tới email " + a.getEmail() + ". Vui lòng nhập để hoàn tất đăng ký.");
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

      for (var old : documents.list("activation:")) {
        if (a.getId().toString().equals(old.get("accountId")) && !Boolean.TRUE.equals(old.get("used"))) {
          old.put("used", true);
          if (old.get("documentKey") instanceof String k) documents.put(k, old);
        }
      }

      String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
      String activationKey = "activation:" + hash(code);
      documents.put(
          activationKey,
          map(
              "documentKey", activationKey,
              "accountId", a.getId().toString(),
              "email", a.getEmail(),
              "code", code,
              "used", false,
              "expiresAt", Instant.now().plusSeconds(900).toString()));

      emails.sendActivationEmail(a.getEmail(), a.getFullName(), code);

      return map(
          "success", true,
          "email", a.getEmail(),
          "devCode", code,
          "message", "Mã kích hoạt OTP 6 số mới đã được gửi tới email " + a.getEmail());
    }
    if (action.equals("forgot-password")) {
      String e = email(b.get("email"));
      var found = accounts.findByEmailIgnoreCase(e);
      if (found.isEmpty()) {
        throw new BusinessException("Không tìm thấy tài khoản với email " + e + ". Vui lòng kiểm tra lại hoặc liên hệ quầy.");
      }
      Account a = found.get();
      if (!"ACTIVE".equals(a.getStatus())) {
        throw new BusinessException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản lý để được hỗ trợ.");
      }
      for (var old : documents.list("reset:")) {
        if (a.getId().toString().equals(old.get("accountId")) && !Boolean.TRUE.equals(old.get("used"))) {
          old.put("used", true);
          if (old.get("documentKey") instanceof String k) documents.put(k, old);
        }
      }
      String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
      String key = "reset:" + hash(code);
      documents.put(
          key,
          map(
              "documentKey", key,
              "accountId", a.getId().toString(),
              "email", a.getEmail(),
              "code", code,
              "used", false,
              "expiresAt", Instant.now().plusSeconds(900).toString()));
      String activationKey = "activation:" + hash(code);
      documents.put(
          activationKey,
          map(
              "documentKey", activationKey,
              "accountId", a.getId().toString(),
              "used", false,
              "expiresAt", Instant.now().plusSeconds(900).toString()));

      emails.sendPasswordResetEmail(a.getEmail(), a.getFullName(), code);

      return map(
          "success", true,
          "message", "Mã xác nhận 6 số đã được gửi đến email " + a.getEmail() + ". Mã có hiệu lực trong 15 phút.",
          "email", a.getEmail(),
          "code", code);
    }
    if (action.equals("reset-password")) {
      String code = text((String) b.getOrDefault("code", b.get("token")), "Mã xác nhận");
      String key = "reset:" + hash(code.trim());
      var row = documents.lock(key);
      var info = documents.read(row);
      if (!info.containsKey("accountId")) {
        key = "activation:" + hash(code.trim());
        row = documents.lock(key);
        info = documents.read(row);
      }
      require(
          info.containsKey("accountId")
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
      String key = "activation:" + hash(token);
      var row = documents.lock(key);
      var info = documents.read(row);
      require(
          info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã kích hoạt không đúng, đã dùng hoặc hết hạn (15 phút)");
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
