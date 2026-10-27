package com.courtly.service;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;

class DemoAccessPolicyTest {
  @Test void disabledByDefault() {
    var policy = new DemoAccessPolicy(new MockEnvironment());
    assertFalse(policy.enabled());
    assertEquals(403, assertThrows(ResponseStatusException.class, policy::requireEnabled).getStatusCode().value());
  }
  @Test void explicitlyEnabledOutsideProduction() {
    var policy = new DemoAccessPolicy(new MockEnvironment().withProperty("courtly.demo-mode", "true"));
    assertTrue(policy.enabled());
    assertDoesNotThrow(policy::requireEnabled);
  }
  @Test void productionProfilesAlwaysDisableDemo() {
    for (var profile : new String[]{"prod", "production"}) {
      var env = new MockEnvironment().withProperty("courtly.demo-mode", "true");
      env.setActiveProfiles(profile);
      assertFalse(new DemoAccessPolicy(env).enabled());
    }
  }
}
