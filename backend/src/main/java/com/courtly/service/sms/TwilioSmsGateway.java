package com.courtly.service.sms;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component("twilioSmsGateway")
public class TwilioSmsGateway implements SmsGateway {

  @Value("${courtly.sms.twilio.account-sid:}")
  private String accountSid;

  @Value("${courtly.sms.twilio.auth-token:}")
  private String authToken;

  @Value("${courtly.sms.sender:Courtly}")
  private String sender;

  private final HttpClient client = HttpClient.newBuilder().build();

  @Override
  public SendResult send(String e164Phone, String message, String purpose) {
    if (accountSid == null || accountSid.isBlank() || authToken == null || authToken.isBlank()) {
      log.warn("Twilio credentials not configured. Falling back to log-only.");
      return SendResult.fail("Twilio credentials not configured");
    }

    try {
      String endpoint = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";
      String body = "To=" + URLEncoder.encode(e164Phone, StandardCharsets.UTF_8)
          + "&From=" + URLEncoder.encode(sender, StandardCharsets.UTF_8)
          + "&Body=" + URLEncoder.encode(message, StandardCharsets.UTF_8);

      String auth = Base64.getEncoder().encodeToString((accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8));

      HttpRequest req = HttpRequest.newBuilder()
          .uri(URI.create(endpoint))
          .header("Authorization", "Basic " + auth)
          .header("Content-Type", "application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();

      HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
      if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
        log.info("[TWILIO SMS SUCCESS] To: {} | Resp: {}", e164Phone, resp.body());
        return SendResult.ok("twilio-ok");
      } else {
        log.error("[TWILIO SMS ERROR] Status: {} | Body: {}", resp.statusCode(), resp.body());
        return SendResult.fail("Twilio error " + resp.statusCode() + ": " + resp.body());
      }
    } catch (Exception e) {
      log.error("[TWILIO SMS EXCEPTION] To: {} | Error: {}", e164Phone, e.getMessage(), e);
      return SendResult.fail(e.getMessage());
    }
  }
}
