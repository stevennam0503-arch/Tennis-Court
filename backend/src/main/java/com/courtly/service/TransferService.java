package com.courtly.service;

import static com.courtly.util.Rules.*;

import com.courtly.dto.request.PaymentRequest;
import com.courtly.entity.*;
import com.courtly.repository.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Bank notifications are separate from a customer's declaration of transfer. */
@Service
@RequiredArgsConstructor
@Transactional
public class TransferService {
  private final DocumentService docs;
  private final CustomerOrderRepository orders;
  private final TournamentRegistrationRepository registrations;
  private final AccountRepository accounts;
  private final PaymentService payments;
  private final OrderService booking;
  private final MembershipService memberships;

  @Value("${courtly.payment.mode:DEMO}")
  private String mode;

  @Value("${courtly.payment.bank-bin:970422}")
  private String bankBin;

  @Value("${courtly.payment.account-number:0345678999}")
  private String accountNumber;

  @Value("${courtly.payment.account-name:CLB TENNIS COURTLY}")
  private String accountName;

  @Value("${courtly.payment.webhook-key:}")
  private String webhookKey;

  @Value("${courtly.admin-email:admin@gmail.com}")
  private String adminEmail;

  public String getMode() {
    return mode != null && !mode.isBlank() ? mode : "DEMO";
  }

  public String getBankBin() {
    return bankBin != null && bankBin.matches("\\d{6}") ? bankBin : "";
  }

  public String getAccountNumber() {
    return accountNumber != null && !accountNumber.isBlank() ? accountNumber : "";
  }

  public String getAccountName() {
    return accountName != null && !accountName.isBlank() ? accountName : "";
  }

  public Map<String, Object> config() {
    boolean bankConfigured = getBankBin().matches("\\d{6}") && getAccountNumber().matches("\\d{6,30}") && !getAccountName().isBlank();
    boolean onlineEnabled = ("LIVE".equals(getMode()) && webhookKey != null && !webhookKey.isBlank())
        || ("DEMO".equals(getMode()) && bankConfigured);
    return map(
        "mode", getMode(),
        "onlineEnabled", onlineEnabled,
        "bankConfigured", bankConfigured,
        "bankBin", getBankBin(),
        "bankName", "970422".equals(getBankBin()) ? "MB Bank" : getBankBin(),
        "accountNumber", getAccountNumber(),
        "accountName", getAccountName());
  }

  private BigDecimal amount(Object n) {
    var v = PresentationService.decimal(n);
    require(v.signum() > 0 && v.stripTrailingZeros().scale() <= 0, "Số tiền phải là số nguyên VND dương");
    return v;
  }

  private void own(Account a, Object owner) {
    if (owner == null || !a.getId().toString().equals(owner.toString()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Giao dịch không thuộc tài khoản của bạn");
  }

  public List<Map<String, Object>> mine(Account a) {
    return docs.list("transfer:").stream()
        .filter(x -> a.getId().toString().equals(x.get("accountId")))
        .map(this::view)
        .toList();
  }

  public List<Map<String, Object>> all() {
    return docs.list("transfer:").stream().map(this::view).toList();
  }

  private Map<String, Object> view(Map<String, Object> x) {
    var v = new LinkedHashMap<>(x);
    if (Set.of("PENDING", "CHECKING").contains(x.get("status"))
        && Instant.parse((String) x.get("expiresAt")).isBefore(Instant.now()))
      v.put("status", "EXPIRED");
    return v;
  }

  public Map<String, Object> create(Account a, Map<String, Object> b) {
    docs.mutationLock();
    booking.expireHolds();
    require("DEMO".equals(getMode()) || "LIVE".equals(getMode()) || "SANDBOX".equals(getMode()) && "ADMIN".equals(a.getRole()), "Chuyển khoản hiện chưa khả dụng; vui lòng thanh toán tại quầy");
    require(Boolean.TRUE.equals(config().get("bankConfigured")), "Chưa cấu hình tài khoản nhận chuyển khoản; vui lòng thanh toán tại quầy");
    require(!"LIVE".equals(getMode()) || !webhookKey.isBlank(), "Chưa cấu hình xác minh ngân hàng; vui lòng thanh toán tại quầy");
    String type = oneOf((String) b.get("type"), "ORDER", "TOURNAMENT", "MEMBERSHIP"),
        target = text((String) b.get("targetId"), "Mã đơn");
    String purpose = "BALANCE".equals(b.get("purpose")) ? "BALANCE" : "DEPOSIT";
    BigDecimal due;
    Instant expires = Instant.now().plusSeconds(900);
    if (type.equals("ORDER")) {
      var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
      own(a, o.getCustomerAccount() == null ? null : o.getCustomerAccount().getId());
      require(
          Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus()),
          "Đơn không nhận thanh toán mới");
      due =
          (purpose.equals("DEPOSIT") ? o.getDepositRequired() : o.getTotalAmount())
              .subtract(o.getPaidAmount());
      if (due.signum() <= 0) due = o.getTotalAmount().subtract(o.getPaidAmount());
      if (o.getStatus().equals("HOLDING")) expires = o.getHoldExpiresAt();
    } else if (type.equals("TOURNAMENT")) {
      var r = registrations.findForUpdate(UUID.fromString(target)).orElseThrow();
      own(a, r.getAccount() == null ? null : r.getAccount().getId());
      require(
          !"CANCELLED".equals(r.getStatus()) && !"CANCELLED".equals(r.getTournament().getStatus()),
          "Đăng ký đã hủy");
      due = r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId()));
    } else {
      var m = docs.get("membership:" + target);
      own(a, m.get("accountId"));
      require("PENDING".equals(m.get("status")), "Gói đã được xử lý");
      due = amount(m.get("price")).subtract(membershipReceived(target));
    }
    require(due.signum() > 0, "Không còn khoản cần thanh toán");
    for (var old : mine(a))
      if (type.equals(old.get("type"))
          && target.equals(old.get("targetId"))
          && Set.of("PENDING", "CHECKING").contains(old.get("status"))
          && due.compareTo(PresentationService.decimal(old.get("remaining"))) == 0)
        return old;

    String id = UUID.randomUUID().toString(),
        reference = "CT" + id.replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
    var intent =
        map(
            "id", id,
            "accountId", a.getId().toString(),
            "type", type,
            "targetId", target,
            "amount", due,
            "remaining", due,
            "received", 0,
            "reviewAmount", 0,
            "reference", reference,
            "status", "PENDING",
            "mode", getMode(),
            "createdAt", Instant.now().toString(),
            "expiresAt", expires.toString());
    intent.putAll(config());

    String qr = vietQr(reference, due);
    String qrImg =
        "https://img.vietqr.io/image/"
            + getBankBin()
            + "-"
            + getAccountNumber()
            + "-compact2.png?amount="
            + due.setScale(0, RoundingMode.HALF_UP).toPlainString()
            + "&addInfo="
            + reference
            + "&accountName="
            + java.net.URLEncoder.encode(getAccountName(), StandardCharsets.UTF_8);

    intent.put("qrPayload", qr);
    intent.put("qrImageUrl", qrImg);
    docs.put("transfer:" + id, intent);
    return intent;
  }

  public Map<String, Object> declared(Account a, String id) {
    docs.mutationLock();
    var x = docs.get("transfer:" + id);
    require(!x.isEmpty(), "Giao dịch không tồn tại");
    own(a, x.get("accountId"));
    if ("PENDING".equals(view(x).get("status"))) {
      x.put("status", "CHECKING");
      docs.put("transfer:" + id, x);
    }
    return view(x);
  }

  public Map<String, Object> confirm(Account a, String id) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
        "Khách hàng không được xác nhận tiền đã thu; chờ xác minh từ ngân hàng");
  }

  public Map<String, Object> adminConfirm(String id) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
        "Chuyển khoản được xác minh qua webhook; thu tiền mặt qua phiếu thu tại quầy");
  }

  public Map<String, Object> sandbox(Account a, String id, Map<String, Object> b) {
    if (!"DEMO".equals(getMode()) && (!"ADMIN".equals(a.getRole()) || !"SANDBOX".equals(getMode())))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Mô phỏng chỉ dành cho môi trường thử nghiệm");
    docs.mutationLock();
    var x = docs.get("transfer:" + id);
    require(!x.isEmpty(), "Giao dịch không tồn tại");
    if (!"ADMIN".equals(a.getRole()) && !"STAFF".equals(a.getRole())) {
      own(a, x.get("accountId"));
    }
    String scenario = oneOf((String) b.get("scenario"), "SUCCESS", "PARTIAL", "DUPLICATE", "LATE");
    String event = "sandbox:" + id + ":" + scenario;
    if (!docs.get("bank-event:" + event).isEmpty()) return docs.get("transfer:" + id);
    if (scenario.equals("LATE")) {
      require("ORDER".equals(x.get("type")), "Kịch bản hết hạn áp dụng đơn sân");
      var o = orders.findForUpdate(UUID.fromString((String) x.get("targetId"))).orElseThrow();
      require("HOLDING".equals(o.getStatus()), "Chỉ mô phỏng hết hạn đơn đang giữ");
      o.setHoldExpiresAt(Instant.now().minusSeconds(1));
      orders.flush();
      booking.expireHolds();
      x.put("expiresAt", Instant.now().minusSeconds(1).toString());
      docs.put("transfer:" + id, x);
    }
    var due = PresentationService.decimal(x.get("remaining"));
    require(due.signum() > 0, "Giao dịch đã thu đủ");
    if (scenario.equals("PARTIAL"))
      due = due.divide(BigDecimal.valueOf(2), 0, RoundingMode.DOWN).max(BigDecimal.ONE);
    receive(event, (String) x.get("reference"), due, "SANDBOX");
    if (scenario.equals("DUPLICATE"))
      receive(event, (String) x.get("reference"), due, "SANDBOX");
    return view(docs.get("transfer:" + id));
  }

  public Map<String, Object> webhook(String authorization, Map<String, Object> b) {
    if (!"LIVE".equals(getMode()) || webhookKey.isBlank())
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook thanh toán chưa được cấu hình");
    if (authorization == null || !MessageDigest.isEqual(
        ("Apikey " + webhookKey).getBytes(StandardCharsets.UTF_8),
        authorization.getBytes(StandardCharsets.UTF_8)))
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook key");
    require(Boolean.TRUE.equals(config().get("bankConfigured")), "Chưa cấu hình tài khoản nhận tiền");
    require(getAccountNumber().equals(String.valueOf(b.get("accountNumber"))), "Sai tài khoản nhận tiền");
    if (!"in".equals(b.get("transferType"))) return map("success", true, "ignored", true);
    String providerId = String.valueOf(b.getOrDefault("id", ""));
    require(providerId.matches("[0-9]{1,30}"), "Mã giao dịch ngân hàng không hợp lệ");
    String event = "sepay:" + providerId;
    var matcher =
        java.util.regex.Pattern.compile("(?<![A-Z0-9])CT[A-F0-9]{16}(?![A-Z0-9])")
            .matcher(String.valueOf(b.get("content")).toUpperCase(Locale.ROOT));
    String ref = matcher.find() ? matcher.group() : "UNMATCHED";
    receive(event, ref, amount(b.get("transferAmount")), "LIVE");
    return map("success", true);
  }

  private void receive(String event, String reference, BigDecimal received, String source) {
    docs.mutationLock();
    var prior = docs.get("bank-event:" + event);
    if (!prior.isEmpty()) {
      require(
          reference.equals(prior.get("reference"))
              && received.compareTo(PresentationService.decimal(prior.get("amount"))) == 0,
          "Mã giao dịch lặp với nội dung khác");
      return;
    }
    var x =
        docs.list("transfer:").stream()
            .filter(i -> reference.equals(i.get("reference")))
            .findFirst()
            .orElse(null);
    var record =
        map(
            "id", event,
            "reference", reference,
            "amount", received,
            "receivedAt", Instant.now().toString(),
            "status", "REVIEW",
            "source", source);
    if (x == null) {
      docs.put("bank-event:" + event, record);
      return;
    }
    booking.expireHolds();
    boolean valid =
        Instant.parse((String) x.get("expiresAt")).isAfter(Instant.now())
            && Set.of("PENDING", "CHECKING").contains(x.get("status"));
    BigDecimal due = PresentationService.decimal(x.get("remaining"));
    String type = (String) x.get("type"), target = (String) x.get("targetId");
    if (type.equals("ORDER")) {
      var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
      valid &= Set.of("HOLDING", "CONFIRMED", "CHECKED_IN", "COMPLETED").contains(o.getStatus());
      due = due.min(o.getTotalAmount().subtract(o.getPaidAmount()));
    }
    if (type.equals("TOURNAMENT")) {
      var r = registrations.findForUpdate(UUID.fromString(target)).orElseThrow();
      valid &=
          !"CANCELLED".equals(r.getStatus())
              && !"CANCELLED".equals(r.getTournament().getStatus());
      due =
          due.min(
              r.getTournament().getRegistrationFee().subtract(payments.registrationPaid(r.getId())));
    }
    if (type.equals("MEMBERSHIP")) {
      var m = docs.get("membership:" + target);
      valid &= "PENDING".equals(m.get("status"));
      due =
          due.min(
              PresentationService.decimal(m.get("price")).subtract(membershipReceived(target)));
    }
    valid &= received.compareTo(due) <= 0 && due.signum() > 0;
    if (valid) {
      if (type.equals("MEMBERSHIP")) {
        var total = membershipReceived(target).add(received);
        if (total.compareTo(
                PresentationService.decimal(docs.get("membership:" + target).get("price")))
            == 0) {
          var admin = accounts.findByEmailIgnoreCase(adminEmail).orElseThrow();
          memberships.action(
              admin,
              "POST",
              "/api/membership/requests/" + target + "/activate",
              map(
                  "collected", true,
                  "amount", total,
                  "method", "BANK_TRANSFER",
                  "transactionCode", event,
                  "requestId", event));
        }
      } else {
        payments.collect(
            new PaymentRequest(
                type.equals("ORDER") ? UUID.fromString(target) : null,
                type.equals("TOURNAMENT") ? UUID.fromString(target) : null,
                received,
                "BANK_TRANSFER",
                event));
      }
      x.put("received", PresentationService.decimal(x.get("received")).add(received));
      x.put("remaining", PresentationService.decimal(x.get("remaining")).subtract(received));
      x.put(
          "status",
          PresentationService.decimal(x.get("remaining")).signum() == 0
              ? "CONFIRMED"
              : "CHECKING");
      record.put("status", "APPLIED");
    } else {
      x.put("reviewAmount", PresentationService.decimal(x.get("reviewAmount")).add(received));
      x.put("status", "REVIEW");
      if (type.equals("ORDER")) {
        var o = orders.findForUpdate(UUID.fromString(target)).orElseThrow();
        var meta = docs.decode(o.getMetadata());
        meta.put("financialReview", "MANUAL_REVIEW");
        meta.put(
            "transferReviewAmount",
            PresentationService.decimal(meta.get("transferReviewAmount")).add(received));
        o.setMetadata(docs.encode(meta));
      }
    }
    record.put("intentId", x.get("id"));
    docs.put("bank-event:" + event, record);
    docs.put("transfer:" + x.get("id"), x);
  }

  private BigDecimal membershipReceived(String target) {
    return docs.list("transfer:").stream()
        .filter(x -> "MEMBERSHIP".equals(x.get("type")) && target.equals(x.get("targetId")))
        .map(x -> PresentationService.decimal(x.get("received")))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private static String tlv(String id, String s) {
    return id + String.format(Locale.ROOT, "%02d", s.length()) + s;
  }

  private String vietQr(String reference, BigDecimal amount) {
    String merchant =
        tlv("00", "A000000727")
            + tlv("01", tlv("00", getBankBin()) + tlv("01", getAccountNumber()))
            + tlv("02", "QRIBFTTA");
    String payload =
        tlv("00", "01")
            + tlv("01", "12")
            + tlv("38", merchant)
            + tlv("53", "704")
            + tlv("54", amount.setScale(0, RoundingMode.HALF_UP).toPlainString())
            + tlv("58", "VN")
            + tlv("62", tlv("08", reference))
            + "6304";
    int crc = 0xffff;
    for (byte v : payload.getBytes(StandardCharsets.UTF_8)) {
      crc ^= (v & 255) << 8;
      for (int i = 0; i < 8; i++) {
        crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      }
      crc &= 0xffff;
    }
    return payload + String.format(Locale.ROOT, "%04X", crc);
  }
}
