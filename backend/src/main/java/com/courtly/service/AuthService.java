package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.entity.Account;
import com.courtly.entity.Voucher;
import com.courtly.repository.VoucherRepository;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import com.courtly.exception.BusinessException;
import com.courtly.repository.AccountRepository;
import com.courtly.service.sms.SmsService;
import com.courtly.util.PhoneUtils;
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
  private final SmsService smsService;
  private final DemoAccessPolicy demo;
  private final VoucherRepository vouchers;
  private final NotificationService notificationService;

  @Value("${courtly.admin-email:admin@gmail.com}")
  private String adminEmail;

  @Value("${courtly.security.otp-secret:CourtlySecureHmacSecretKey2026!}")
  private String otpSecret;

  private final java.util.concurrent.ConcurrentHashMap<String, long[]> failures =
      new java.util.concurrent.ConcurrentHashMap<>();

  private final java.util.concurrent.ConcurrentHashMap<String, List<Long>> phoneOtpAttempts =
      new java.util.concurrent.ConcurrentHashMap<>();
  private final java.util.concurrent.ConcurrentHashMap<String, List<Long>> ipOtpAttempts =
      new java.util.concurrent.ConcurrentHashMap<>();

  private void requireEmailDelivery() {
    if (!demo.enabled() && !emails.isConfigured())
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Dịch vụ email chưa được cấu hình. Vui lòng liên hệ câu lạc bộ.");
  }

  private void pruneFailures() {
    long now = System.currentTimeMillis();
    failures.entrySet().removeIf(e -> now - e.getValue()[0] > 900000);
  }

  private void checkOtpRateLimits(String e164Phone, String clientIp) {
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    // 10 OTP / IP / giờ
    ipOtpAttempts.compute(clientIp, (k, list) -> {
      if (list == null) list = new ArrayList<>();
      list.removeIf(t -> t < oneHourAgo);
      if (list.size() >= 10) {
        throw new BusinessException("Quá nhiều yêu cầu OTP từ địa chỉ IP này. Vui lòng thử lại sau 1 giờ.");
      }
      list.add(now);
      return list;
    });

    // 5 OTP / số / giờ
    phoneOtpAttempts.compute(e164Phone, (k, list) -> {
      if (list == null) list = new ArrayList<>();
      list.removeIf(t -> t < oneHourAgo);
      if (list.size() >= 5) {
        throw new BusinessException("Số điện thoại này đã nhận quá 5 mã OTP trong vòng 1 giờ. Vui lòng thử lại sau.");
      }
      list.add(now);
      return list;
    });
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
    return a.getEmail() != null && a.getEmail().equalsIgnoreCase(adminEmail);
  }

  public Map<String, Object> user(Account a) {
    var m = new LinkedHashMap<String, Object>();
    m.put("id", a.getId());
    m.put("accountId", a.getId());
    m.put("name", a.getFullName());
    m.put("email", a.getEmail());
    m.put("phone", PhoneUtils.formatDisplay(a.getPhone()));
    m.put("rawPhone", a.getPhone());
    m.put("role", a.getRole());
    m.put("createdAt", a.getCreatedAt());
    m.put("isOwner", owner(a));
    m.put("phoneVerifiedAt", a.getPhoneVerifiedAt());
    m.put("emailVerifiedAt", a.getEmailVerifiedAt());
    m.put("notifyEmail", a.getNotifyEmail());
    m.put("notifySms", a.getNotifySms());
    m.put("marketingConsent", a.getMarketingConsent());
    m.put("tier", a.getTier() != null ? a.getTier() : "ROOKIE");
    m.put("pointsBalance", a.getPointsBalance() != null ? a.getPointsBalance() : 0);
    m.put("tierExpiresAt", a.getTierExpiresAt());
    return m;
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
    if (v == null) return null;
    String e = text((String) v, "Email").toLowerCase(Locale.ROOT);
    require(e.length() <= 254 && e.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "Email không hợp lệ");
    return e;
  }

  private String password(Object v) {
    require(v instanceof String, "Mật khẩu không hợp lệ");
    String p = (String) v;
    require(
        p.length() >= 6 && p.length() <= 128 && p.getBytes(StandardCharsets.UTF_8).length <= 72,
        "Mật khẩu từ 6 ký tự, tối đa 72 byte UTF-8");
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
    return hashHmac(code);
  }

  private String hashHmac(String data) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(otpSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to calculate HMAC-SHA-256", e);
    }
  }

  public String generatePhoneToken(String e164Phone) {
    long exp = Instant.now().plusSeconds(600).toEpochMilli();
    String payload = e164Phone + ":" + exp;
    String sig = hashHmac(payload);
    return payload + ":" + sig;
  }

  public String verifyPhoneToken(String token) {
    require(token != null && !token.isBlank(), "Mã xác thực số điện thoại không hợp lệ");
    String[] parts = token.split(":");
    require(parts.length == 3, "Mã xác thực số điện thoại không đúng định dạng");
    String e164Phone = parts[0];
    long exp;
    try {
      exp = Long.parseLong(parts[1]);
    } catch (NumberFormatException e) {
      throw new BusinessException("Mã xác thực số điện thoại không hợp lệ");
    }
    require(System.currentTimeMillis() <= exp, "Mã xác thực số điện thoại đã hết hạn (10 phút). Vui lòng xác thực lại.");
    String expectedPayload = e164Phone + ":" + exp;
    String expectedSig = hashHmac(expectedPayload);
    require(MessageDigest.isEqual(parts[2].getBytes(StandardCharsets.UTF_8), expectedSig.getBytes(StandardCharsets.UTF_8)),
        "Chữ ký xác thực số điện thoại không hợp lệ");
    return e164Phone;
  }

  @Transactional
  public Map<String, Object> sendPhoneOtp(Map<String, Object> b, HttpServletRequest req) {
    String rawPhone = (String) b.get("phone");
    require(rawPhone != null && !rawPhone.isBlank(), "Vui lòng nhập số điện thoại");
    String e164 = PhoneUtils.normalizeE164(rawPhone);
    String purpose = String.valueOf(b.getOrDefault("purpose", "REGISTER")).trim().toUpperCase(Locale.ROOT);

    if ("REGISTER".equals(purpose)) {
      if (accounts.findByPhone(e164).isPresent()) {
        throw new BusinessException("Số điện thoại đã có tài khoản. Hãy đăng nhập hoặc liên hệ quầy.");
      }
    } else if ("LOGIN".equals(purpose) || "RESET_PASSWORD".equals(purpose) || "POINTS".equals(purpose)) {
      if (accounts.findByPhone(e164).isEmpty()) {
        throw new BusinessException("Số điện thoại chưa được đăng ký tài khoản.");
      }
    }

    String otpKey = "otp:phone:" + purpose + ":" + e164;
    var existingDoc = documents.lock(otpKey);
    if (existingDoc != null) {
      var info = documents.read(existingDoc);
      String createdAtStr = (String) info.get("createdAt");
      if (createdAtStr != null) {
        Instant created = Instant.parse(createdAtStr);
        if (Instant.now().isBefore(created.plusSeconds(60))) {
          long remain = java.time.Duration.between(Instant.now(), created.plusSeconds(60)).getSeconds();
          throw new BusinessException("Vui lòng đợi " + Math.max(remain, 1) + " giây trước khi yêu cầu mã mới.");
        }
      }
    }

    checkOtpRateLimits(e164, req.getRemoteAddr());

    String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
    documents.put(
        otpKey,
        map(
            "documentKey", otpKey,
            "phone", e164,
            "purpose", purpose,
            "codeHash", hashOtp(code),
            "attempts", 0,
            "used", false,
            "createdAt", Instant.now().toString(),
            "expiresAt", Instant.now().plusSeconds(300).toString()));

    smsService.sendOtp(e164, code, purpose);

    var resp = new LinkedHashMap<String, Object>();
    resp.put("success", true);
    resp.put("phone", PhoneUtils.formatDisplay(e164));
    resp.put("cooldownSeconds", 60);
    resp.put("message", "Mã xác thực OTP đã được gửi tới số " + PhoneUtils.formatDisplay(e164));
    if (demo.enabled() && smsService.isLogProvider()) {
      resp.put("devCode", code);
    }
    return resp;
  }

  @Transactional
  public Map<String, Object> verifyPhoneOtp(Map<String, Object> b) {
    String rawPhone = (String) b.get("phone");
    String code = (String) b.get("code");
    require(rawPhone != null && !rawPhone.isBlank(), "Vui lòng nhập số điện thoại");
    require(code != null && !code.isBlank(), "Vui lòng nhập mã xác thực OTP");
    String e164 = PhoneUtils.normalizeE164(rawPhone);
    String purpose = String.valueOf(b.getOrDefault("purpose", "REGISTER")).trim().toUpperCase(Locale.ROOT);

    String otpKey = "otp:phone:" + purpose + ":" + e164;
    var row = documents.lock(otpKey);
    require(row != null, "Yêu cầu xác thực không tồn tại hoặc đã hết hạn.");
    var info = documents.read(row);

    int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
    Instant expiresAt = Instant.parse((String) info.get("expiresAt"));
    if (attempts >= 5 || Instant.now().isAfter(expiresAt) || Boolean.TRUE.equals(info.get("used"))) {
      throw new BusinessException("Mã OTP đã hết hạn hoặc thử sai quá 5 lần. Vui lòng gửi lại mã mới.");
    }

    String storedHash = (String) info.get("codeHash");
    boolean valid = storedHash != null && MessageDigest.isEqual(
        hashOtp(code.trim()).getBytes(StandardCharsets.UTF_8),
        storedHash.getBytes(StandardCharsets.UTF_8));

    if (!valid) {
      info.put("attempts", attempts + 1);
      documents.save(row, info);
      int remain = 4 - attempts;
      if (remain <= 0) {
        throw new BusinessException("Bạn đã nhập sai 5 lần. Mã OTP đã bị khóa. Vui lòng gửi lại mã mới.");
      }
      throw new BusinessException("Mã OTP không đúng (còn " + remain + " lần thử).");
    }

    info.put("used", true);
    documents.save(row, info);

    String phoneToken = generatePhoneToken(e164);
    var resp = new LinkedHashMap<String, Object>();
    resp.put("success", true);
    resp.put("phoneToken", phoneToken);
    resp.put("phone", PhoneUtils.formatDisplay(e164));
    return resp;
  }

  @Transactional

  public void issueWelcomeVoucherIfEligible(Account a, String phone) {
    if (a == null || phone == null || phone.isBlank()) return;
    String e164 = PhoneUtils.normalizeE164(phone);

    // Idempotent: 1 voucher per phone across all accounts (even deleted/re-registered)
    String docKey = "welcome:phone:" + e164;
    var existingDoc = documents.lock(docKey);
    if (existingDoc != null) {
      return;
    }

    // Also check by account ID
    boolean alreadyHasAccountVoucher = vouchers.findByAssignedAccountId(a.getId()).stream()
        .anyMatch(v -> "TIER_GIFT".equals(v.getSource()) && v.getCode().startsWith("WELCOME-"));
    if (alreadyHasAccountVoucher) return;

    String suffix = randomWelcomeSuffix(4);
    String code = "WELCOME-" + suffix;
    while (vouchers.findByCodeIgnoreCase(code).isPresent()) {
      suffix = randomWelcomeSuffix(4);
      code = "WELCOME-" + suffix;
    }

    Voucher v = new Voucher();
    v.setCode(code);
    v.setType("FIXED");
    v.setValue(new BigDecimal("50000"));
    v.setMinOrder(BigDecimal.ZERO);
    v.setStartsAt(Instant.now());
    v.setExpiresAt(Instant.now().plus(Duration.ofDays(30)));
    v.setUsageLimit(1);
    v.setPerUserLimit(1);
    v.setNewUserOnly(false);
    v.setEnabled(true);
    v.setStatus("ACTIVE");
    v.setSource("TIER_GIFT");
    v.setAssignedAccountId(a.getId());
    v.setDescription("Voucher chào mừng thành viên mới Courtly");
    vouchers.save(v);

    documents.put(docKey, map(
        "documentKey", docKey,
        "phone", e164,
        "accountId", a.getId().toString(),
        "voucherCode", code,
        "issuedAt", Instant.now().toString()
    ));

    notificationService.enqueue(
        a.getId(),
        null,
        null,
        "WELCOME_GIFT",
        "IN_APP",
        null,
        "🎁 Chào mừng thành viên mới!",
        "Chào mừng bạn đến Courtly – tặng voucher 50.000₫",
        Instant.now(),
        "WELCOME:" + a.getId() + ":IN_APP"
    );
  }

  private String randomWelcomeSuffix(int len) {
    String alphanum = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    SecureRandom r = new SecureRandom();
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < len; i++) {
      sb.append(alphanum.charAt(r.nextInt(alphanum.length())));
    }
    return sb.toString();
  }

  public void verifyOtpDirectly(String rawPhone, String code, String purpose) {
    require(rawPhone != null && !rawPhone.isBlank(), "Thiếu số điện thoại xác thực OTP");
    require(code != null && !code.isBlank(), "Vui lòng nhập mã xác thực OTP");
    String e164 = PhoneUtils.normalizeE164(rawPhone);
    String p = purpose == null ? "POINTS" : purpose.trim().toUpperCase(Locale.ROOT);
    String otpKey = "otp:phone:" + p + ":" + e164;
    var row = documents.lock(otpKey);
    require(row != null, "Mã OTP không tồn tại hoặc đã hết hạn.");
    var info = documents.read(row);
    int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
    Instant expiresAt = Instant.parse((String) info.get("expiresAt"));
    if (attempts >= 5 || Instant.now().isAfter(expiresAt) || Boolean.TRUE.equals(info.get("used"))) {
      throw new BusinessException("Mã OTP đã hết hạn hoặc thử sai quá 5 lần. Vui lòng gửi lại mã mới.");
    }
    String storedHash = (String) info.get("codeHash");
    boolean valid = storedHash != null && MessageDigest.isEqual(
        hashOtp(code.trim()).getBytes(StandardCharsets.UTF_8),
        storedHash.getBytes(StandardCharsets.UTF_8));
    if (!valid) {
      info.put("attempts", attempts + 1);
      documents.save(row, info);
      int remain = 4 - attempts;
      if (remain <= 0) {
        throw new BusinessException("Bạn đã nhập sai 5 lần. Mã OTP đã bị khóa. Vui lòng gửi lại mã mới.");
      }
      throw new BusinessException("Mã OTP không đúng (còn " + remain + " lần thử).");
    }
    info.put("used", true);
    documents.save(row, info);
  }

  @Transactional
  public Map<String, Object> loginWithPhoneOtp(
      Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    String rawPhone = (String) b.get("phone");
    String code = (String) b.get("code");
    require(rawPhone != null && !rawPhone.isBlank(), "Vui lòng nhập số điện thoại");
    require(code != null && !code.isBlank(), "Vui lòng nhập mã OTP");
    String e164 = PhoneUtils.normalizeE164(rawPhone);

    String otpKey = "otp:phone:LOGIN:" + e164;
    var row = documents.lock(otpKey);
    require(row != null, "Yêu cầu đăng nhập không tồn tại hoặc đã hết hạn.");
    var info = documents.read(row);

    int attempts = ((Number) info.getOrDefault("attempts", 0)).intValue();
    Instant expiresAt = Instant.parse((String) info.get("expiresAt"));
    if (attempts >= 5 || Instant.now().isAfter(expiresAt) || Boolean.TRUE.equals(info.get("used"))) {
      throw new BusinessException("Mã OTP đã hết hạn hoặc thử sai quá 5 lần. Vui lòng lấy mã mới.");
    }

    String storedHash = (String) info.get("codeHash");
    boolean valid = storedHash != null && MessageDigest.isEqual(
        hashOtp(code.trim()).getBytes(StandardCharsets.UTF_8),
        storedHash.getBytes(StandardCharsets.UTF_8));

    if (!valid) {
      info.put("attempts", attempts + 1);
      documents.save(row, info);
      int remain = 4 - attempts;
      if (remain <= 0) {
        throw new BusinessException("Bạn đã nhập sai 5 lần. Mã OTP đã bị khóa.");
      }
      throw new BusinessException("Mã OTP không đúng (còn " + remain + " lần thử).");
    }

    info.put("used", true);
    documents.save(row, info);

    Account a = accounts.findByPhone(e164)
        .orElseThrow(() -> new BusinessException("Không tìm thấy tài khoản với số điện thoại này."));
    require("ACTIVE".equals(a.getStatus()), "Tài khoản đã bị khóa hoặc chưa kích hoạt.");

    return signIn(a, req, res);
  }

  @Transactional
  public Map<String, Object> action(
      String action, Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    if (action.equals("logout")) {
      if (req.getSession(false) != null) req.getSession(false).invalidate();
      SecurityContextHolder.clearContext();
      return map("authenticated", false);
    }
    if (action.equals("phone-send-otp")) {
      return sendPhoneOtp(b, req);
    }
    if (action.equals("phone-verify")) {
      return verifyPhoneOtp(b);
    }
    if (action.equals("phone-login")) {
      return loginWithPhoneOtp(b, req, res);
    }
    if (action.equals("login")) {
      pruneFailures();
      org.slf4j.LoggerFactory.getLogger(AuthService.class).info("Auth login attempt from IP: {}", req.getRemoteAddr());
      String idf = String.valueOf(b.getOrDefault("email", b.getOrDefault("emailOrPhone", b.get("phone")))).trim();
      require(!idf.isBlank(), "Vui lòng nhập email hoặc số điện thoại");

      String key = req.getRemoteAddr() + ":" + idf.toLowerCase(Locale.ROOT);
      long t = System.currentTimeMillis();
      long[] tries =
          failures.compute(
              key, (k, old) -> old == null || t - old[0] > 900000 ? new long[] {t, 0} : old);
      require(tries[1] < 10, "Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.");

      Optional<Account> found;
      if (PhoneUtils.isValid(idf)) {
        String e164 = PhoneUtils.normalizeE164(idf);
        found = accounts.findByPhone(e164);
      } else {
        found = accounts.findByEmailIgnoreCase(idf);
      }

      String supplied = String.valueOf(b.getOrDefault("password", ""));
      if (found.isPresent() && "PENDING_ACTIVATION".equals(found.get().getStatus())) {
        if (found.get().getPasswordHash() != null && encoder.matches(supplied, found.get().getPasswordHash())) {
          requireEmailDelivery();
          String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
          String otpKey = "otp:activation:" + (found.get().getEmail() != null ? found.get().getEmail().toLowerCase(Locale.ROOT) : found.get().getPhone());
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
          if (found.get().getEmail() != null) {
            emails.sendActivationEmail(found.get().getEmail(), found.get().getFullName(), code);
          }
          var resp = new LinkedHashMap<String, Object>();
          resp.put("requiresActivation", true);
          resp.put("email", found.get().getEmail());
          if (demo.enabled()) resp.put("devCode", code);
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
        throw new BusinessException("Tài khoản hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.");
      }
      failures.remove(key);
      return signIn(found.get(), req, res);
    }
    if (action.equals("register")) {
      // 1. Luồng đăng ký bằng phoneToken (đã xác minh OTP SMS)
      if (b.containsKey("phoneToken") && b.get("phoneToken") != null && !String.valueOf(b.get("phoneToken")).isBlank()) {
        String phoneToken = String.valueOf(b.get("phoneToken"));
        String e164 = verifyPhoneToken(phoneToken);
        require(accounts.findByPhone(e164).isEmpty(), "Số điện thoại đã có tài khoản. Hãy đăng nhập.");

        String p = password(b.get("password"));
        String name = text((String) b.get("name"), "Họ tên");

        String e = null;
        if (b.get("email") != null && !String.valueOf(b.get("email")).isBlank()) {
          e = email(b.get("email"));
          require(accounts.findByEmailIgnoreCase(e).isEmpty(), "Email đã được sử dụng bởi tài khoản khác.");
        }

        Account a = new Account();
        a.setFullName(name);
        a.setPhone(e164);
        a.setPhoneVerifiedAt(Instant.now());
        a.setEmail(e);
        if (e != null) {
          a.setEmailVerifiedAt(null);
        }
        a.setRole("CUSTOMER");
        a.setStatus("ACTIVE");
        a.setPasswordHash(encoder.encode(p));
        accounts.saveAndFlush(a);
        issueWelcomeVoucherIfEligible(a, e164);
        return signIn(a, req, res);
      }

      // 2. Luồng đăng ký truyền thống (email + phone) cho staff hoặc khách quầy
      requireEmailDelivery();
      String e = email(b.get("email")), p = password(b.get("password"));
      require(
          accounts.findByEmailIgnoreCase(e).isEmpty(),
          "Email đã có tài khoản. Hãy đăng nhập hoặc liên hệ quầy.");
      String rawPhone = (String) b.getOrDefault("phone", "");
      String phone = "";
      if (rawPhone != null && !rawPhone.isBlank()) {
        phone = PhoneUtils.normalizeE164(rawPhone);
        require(accounts.findByPhone(phone).isEmpty(), "Số điện thoại đã có tài khoản.");
      } else if (Boolean.TRUE.equals(b.get("requireActivation"))) {
        throw new BusinessException("Vui lòng cung cấp số điện thoại liên hệ để đặt sân");
      }
      Account a = new Account();
      a.setFullName(text((String) b.get("name"), "Họ tên"));
      a.setEmail(e);
      a.setPhone(phone);
      if (!phone.isBlank()) {
        a.setPhoneVerifiedAt(Instant.now());
      }
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
        if (demo.enabled()) resp.put("devCode", code);
        resp.put("message", emails.isConfigured() 
            ? "Mã kích hoạt OTP 6 số đã được gửi tới email " + a.getEmail() + ". Vui lòng nhập để hoàn tất đăng ký."
            : "Tài khoản đã tạo. Vui lòng điền mã OTP kích hoạt bên dưới để hoàn tất đăng ký.");
        return resp;
      } else {
        a.setStatus("ACTIVE");
        accounts.saveAndFlush(a);
        if (a.getPhone() != null && !a.getPhone().isBlank()) {
          issueWelcomeVoucherIfEligible(a, a.getPhone());
        }
        return signIn(a, req, res);
      }
    }
    if (action.equals("resend-activation")) {
      requireEmailDelivery();
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
      if (demo.enabled()) resp.put("devCode", code);
      resp.put("message", emails.isConfigured()
          ? "Mã kích hoạt OTP 6 số mới đã được gửi tới email " + a.getEmail()
          : "Mã kích hoạt OTP 6 số mới đã được tạo cho " + a.getEmail());
      return resp;
    }
    if (action.equals("forgot-password")) {
      String idf = String.valueOf(b.getOrDefault("email", b.getOrDefault("emailOrPhone", b.get("phone")))).trim();
      require(!idf.isBlank(), "Vui lòng nhập email hoặc số điện thoại");

      if (PhoneUtils.isValid(idf)) {
        String e164 = PhoneUtils.normalizeE164(idf);
        var found = accounts.findByPhone(e164);
        String code = null;
        if (found.isPresent() && "ACTIVE".equals(found.get().getStatus())) {
          code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
          String key = "otp:phone:RESET_PASSWORD:" + e164;
          documents.put(
              key,
              map(
                  "documentKey", key,
                  "accountId", found.get().getId().toString(),
                  "phone", e164,
                  "codeHash", hashOtp(code),
                  "attempts", 0,
                  "used", false,
                  "expiresAt", Instant.now().plusSeconds(300).toString()));
          smsService.sendOtp(e164, code, "RESET_PASSWORD");
        }
        var resp = new LinkedHashMap<String, Object>();
        resp.put("success", true);
        resp.put("message", "Nếu số điện thoại của bạn đã đăng ký, mã xác thực OTP đã được gửi qua tin nhắn SMS.");
        resp.put("phone", PhoneUtils.formatDisplay(e164));
        if (demo.enabled() && smsService.isLogProvider() && code != null) {
          resp.put("code", code);
          resp.put("devCode", code);
        }
        return resp;
      }

      requireEmailDelivery();
      String e = email(idf).toLowerCase(Locale.ROOT);
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
      if (demo.enabled() && code != null) {
        resp.put("code", code);
        resp.put("devCode", code);
      }
      return resp;
    }
    if (action.equals("reset-password")) {
      String code = text((String) b.getOrDefault("code", b.get("token")), "Mã xác nhận").trim();
      String phoneInput = (String) b.get("phone");
      String emailInput = (String) b.get("email");
      Map<String, Object> info = null;
      com.courtly.entity.AppDocument row = null;

      if (phoneInput != null && !phoneInput.isBlank()) {
        String e164 = PhoneUtils.normalizeE164(phoneInput);
        String key = "otp:phone:RESET_PASSWORD:" + e164;
        row = documents.lock(key);
        if (row != null) {
          info = documents.read(row);
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
      } else if (emailInput != null && !emailInput.isBlank()) {
        String key = "otp:reset:" + emailInput.trim().toLowerCase(Locale.ROOT);
        row = documents.lock(key);
        if (row != null) {
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
      }

      require(
          info != null
              && info.containsKey("accountId")
              && !Boolean.TRUE.equals(info.get("used"))
              && Instant.parse((String) info.get("expiresAt")).isAfter(Instant.now()),
          "Mã xác nhận không đúng, đã dùng hoặc đã hết hạn.");
      Account a =
          accounts.findForUpdate(UUID.fromString((String) info.get("accountId"))).orElseThrow();
      require("ACTIVE".equals(a.getStatus()), "Tài khoản đã bị khóa");
      a.setPasswordHash(encoder.encode(password(b.get("password"))));
      a.setAuthVersion(a.getAuthVersion() + 1);
      info.put("used", true);
      documents.save(row, info);
      if (a.getPhone() != null && !a.getPhone().isBlank()) {
        issueWelcomeVoucherIfEligible(a, a.getPhone());
      }
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
        if (row != null) {
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
