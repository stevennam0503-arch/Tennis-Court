package com.courtly.service.sms;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component("logSmsGateway")
public class LogSmsGateway implements SmsGateway {

  public record SmsLogEntry(
      String id,
      String phone,
      String message,
      String purpose,
      Instant sentAt
  ) {}

  private static final int MAX_HISTORY = 100;
  private final Deque<SmsLogEntry> history = new ConcurrentLinkedDeque<>();

  @Override
  public SendResult send(String e164Phone, String message, String purpose) {
    String messageId = "sms-log-" + UUID.randomUUID().toString().substring(0, 8);
    log.info("[SMS-LOG] To: {} | Purpose: {} | Id: {} | Content: {}", e164Phone, purpose, messageId, message);
    
    history.addFirst(new SmsLogEntry(messageId, e164Phone, message, purpose, Instant.now()));
    while (history.size() > MAX_HISTORY) {
      history.removeLast();
    }
    return SendResult.ok(messageId);
  }

  public List<SmsLogEntry> getHistory() {
    return new ArrayList<>(history);
  }

  public void clearHistory() {
    history.clear();
  }
}
