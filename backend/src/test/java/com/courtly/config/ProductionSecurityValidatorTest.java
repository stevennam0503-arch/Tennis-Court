package com.courtly.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

class ProductionSecurityValidatorTest {
  private Environment environment;
  private ProductionSecurityValidator validator;

  @BeforeEach
  void setUp() {
    environment = mock(Environment.class);
    validator = new ProductionSecurityValidator(environment);
  }

  @Test
  void nonProdProfileDoesNotEnforceProductionInvariants() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(false);

    // Should not throw even with default/insecure environment values
    assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
  }

  @Test
  void prodProfileRejectsDefaultDatabasePassword() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("courtly_local");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("Insecure default database password"));
  }

  @Test
  void prodProfileRejectsInsecureCookieSetting() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("false");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("cookie.secure must be true"));
  }

  @Test
  void prodProfileRejectsDemoMode() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("true");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("courtly.demo-mode must be false"));
  }

  @Test
  void prodProfileRejectsDefaultOtpSecret() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("false");
    when(environment.getProperty("courtly.seed-demo", "false")).thenReturn("false");
    when(environment.getProperty("courtly.security.otp-secret", "")).thenReturn("CourtlySecureHmacSecretKey2026!");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("courtly.security.otp-secret"));
  }

  @Test
  void prodProfileAcceptsFullySecuredConfiguration() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("false");
    when(environment.getProperty("courtly.seed-demo", "false")).thenReturn("false");
    when(environment.getProperty("courtly.security.otp-secret", "")).thenReturn("SuperSecretCryptoRandomKey987654321");
    when(environment.getProperty("courtly.admin-password", "")).thenReturn("AdminStrongPassword2026!");

    assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
  }
}
