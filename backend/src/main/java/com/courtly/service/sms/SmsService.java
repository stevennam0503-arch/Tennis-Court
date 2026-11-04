package com.courtly.service.sms;

import com.courtly.service.sms.SmsGateway.SendResult;
import com.courtly.util.PhoneUtils;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class SmsService {

  private final LogSmsGateway logGateway;
  private final TwilioSmsGateway twilioGateway;
  private final EsmsGateway esmsGateway;

  @Value("${courtly.sms.provider:LOG}")
  private String provider;

  @Value("${courtly.notify.mode:LOG}")
  private String notifyMode;

  @Value("${courtly.notify.allowlist:kietdlv@gmail.com,phuongmaiphanqn3@gmail.com,+84769496289,+84377035664,0769496289,0377035664}")
  private String allowlistConfig;

  public SmsService(LogSmsGateway logGateway, TwilioSmsGateway twilioGateway, EsmsGateway esmsGateway) {
    this.logGateway = logGateway;
    this.twilioGateway = twilioGateway;
    this.esmsGateway = esmsGateway;
  }

  public String getProvider() {
    return provider != null ? provider.toUpperCase(Locale.ROOT) : "LOG";
  }

  public boolean isLogProvider() {
    return "LOG".equalsIgnoreCase(provider);
  }

  /**
   * Kiểm tra allowlist chống gửi nhầm người lạ khi chạy ở môi trường demo/thử nghiệm
   */
  public boolean isAllowed(String recipient) {
    if (!"LIVE".equalsIgnoreCase(notifyMode)) {
      return true;
    }
    if (allowlistConfig == null || allowlistConfig.isBlank()) {
      return true; // Vận hành thật: để trống allowlist nghĩa là cho phép gửi tất cả
    }
    String cleaned = recipient.trim().toLowerCase(Locale.ROOT);
    List<String> list = Arrays.stream(allowlistConfig.split(","))
        .map(s -> s.trim().toLowerCase(Locale.ROOT))
        .filter(s -> !s.isBlank())
        .toList();
    return list.contains(cleaned);
  }

  public SendResult send(String rawPhone, String message, String purpose) {
    String e164 = PhoneUtils.normalizeE164(rawPhone);

    // Chống gửi nhầm khi ở chế độ LIVE
    if (!isAllowed(e164)) {
      log.warn("[SMS SKIPPED] Recipient {} not in allowlist. Mode: LIVE.", e164);
      return new SendResult(true, "SKIPPED-NOT-IN-ALLOWLIST", null);
    }

    SmsGateway gateway = switch (getProvider()) {
      case "TWILIO" -> twilioGateway;
      case "ESMS" -> esmsGateway;
      default -> logGateway;
    };

    return gateway.send(e164, message, purpose);
  }

  public SendResult sendOtp(String rawPhone, String code, String purpose) {
    String message = "Courtly: Ma xac thuc cua ban la " + code + ". Ma co hieu luc trong 5 phut.";
    return send(rawPhone, message, "OTP:" + purpose);
  }

  public List<LogSmsGateway.SmsLogEntry> getLogHistory() {
    return logGateway.getHistory();
  }
}
