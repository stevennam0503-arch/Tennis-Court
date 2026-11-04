package com.courtly.service.sms;

public interface SmsGateway {
  SendResult send(String e164Phone, String message, String purpose);

  record SendResult(boolean success, String messageId, String error) {
    public static SendResult ok(String messageId) {
      return new SendResult(true, messageId, null);
    }
    public static SendResult fail(String error) {
      return new SendResult(false, null, error);
    }
  }
}
