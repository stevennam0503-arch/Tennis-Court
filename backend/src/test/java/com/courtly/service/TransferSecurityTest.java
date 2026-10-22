package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import com.courtly.entity.Account;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class TransferSecurityTest {
  private TransferService service() {
    return new TransferService(null, null, null, null, null, null, null);
  }

  @Test
  void missingWebhookKeyCannotAcceptBankEvents() {
    var service = service();
    ReflectionTestUtils.setField(service, "mode", "LIVE");
    ReflectionTestUtils.setField(service, "webhookKey", "");
    assertEquals(503, assertThrows(ResponseStatusException.class,
        () -> service.webhook(null, Map.of())).getStatusCode().value());
  }

  @Test
  void unconfiguredBankDoesNotExposeInventedAccount() {
    var config = service().config();
    assertEquals(false, config.get("bankConfigured"));
    assertEquals("", config.get("accountNumber"));
  }

  @Test
  void directConfirmationCannotCreditCustomerOrAdministrator() {
    var service = service();
    for (var role : new String[]{"CUSTOMER", "STAFF", "ADMIN"}) {
      var actor = new Account(); actor.setRole(role);
      assertEquals(403, assertThrows(ResponseStatusException.class,
          () -> service.confirm(actor, "any-intent")).getStatusCode().value());
    }
    assertEquals(403, assertThrows(ResponseStatusException.class,
        () -> service.adminConfirm("any-intent")).getStatusCode().value());
  }
}
