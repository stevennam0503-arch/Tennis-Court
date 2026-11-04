package com.courtly.service.sms;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * eSMS.vn Gateway adapter (sẵn sàng kết nối khi cấu hình SMS_PROVIDER=ESMS và có Brandname).
 */
@Slf4j
@Component("esmsGateway")
public class EsmsGateway implements SmsGateway {

  @Value("${courtly.sms.api-key:}")
  private String apiKey;

  @Value("${courtly.sms.api-secret:}")
  private String secretKey;

  @Value("${courtly.sms.sender:Courtly}")
  private String brandname;

  @Override
  public SendResult send(String e164Phone, String message, String purpose) {
    if (apiKey == null || apiKey.isBlank() || secretKey == null || secretKey.isBlank()) {
      log.warn("eSMS API keys not configured. Please set SMS_API_KEY and SMS_API_SECRET.");
      return SendResult.fail("eSMS API keys not configured");
    }

    // TODO: Triển khai gọi HTTP REST API của eSMS (http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/)
    log.info("[ESMS STUB] Send to: {}, Purpose: {}, Brandname: {}, Message: {}", e164Phone, purpose, brandname, message);
    return SendResult.ok("esms-stub-ok");
  }
}
