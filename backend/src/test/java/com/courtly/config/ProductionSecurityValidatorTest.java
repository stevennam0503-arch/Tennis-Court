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

  private void mockSecureDefaults() {
    when(environment.getProperty("spring.datasource.password", "")).thenReturn("SecureProdDbPass123!");
    when(environment.getProperty("server.servlet.session.cookie.secure", "false")).thenReturn("true");
    when(environment.getProperty("courtly.demo-mode", "false")).thenReturn("false");
    when(environment.getProperty("courtly.seed-demo", "false")).thenReturn("false");
    when(environment.getProperty("courtly.security.otp-secret", "")).thenReturn("SuperSecretCryptoRandomKey987654321");
    when(environment.getProperty("courtly.admin-password", "")).thenReturn("AdminStrongPassword2026!");
    when(environment.getProperty("courtly.payment.mode", "")).thenReturn("SEPAY");
    when(environment.getProperty("courtly.payment.webhook-key", "")).thenReturn("LiveSepayWebhookSecret12345");
    when(environment.getProperty("courtly.allowed-origin", "")).thenReturn("https://tennis.courtly.vn");
    when(environment.getProperty("courtly.payment.account-number", "")).thenReturn("987654321098");
    when(environment.getProperty("courtly.mail.host", "")).thenReturn("smtp.gmail.com");
    when(environment.getProperty("courtly.mail.password", "")).thenReturn("test-mail-password");
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
  void prodProfileRejectsPaymentModeDemo() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.mode", "")).thenReturn("DEMO");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("PAYMENT_MODE must not be 'DEMO'"));
  }

  @Test
  void prodProfileRejectsBlankSepayWebhookKey() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.webhook-key", "")).thenReturn("");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("SEPAY_WEBHOOK_KEY is required"));
  }

  @Test
  void prodProfileRejectsLocalhostFrontendOrigin() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.allowed-origin", "")).thenReturn("http://localhost:3000");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("FRONTEND_ORIGIN cannot be empty or point to localhost"));
  }

  @Test
  void prodProfileRejectsSampleBankAccountNumber() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.payment.account-number", "")).thenReturn("0345678999");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("Default sample bank account number"));
  }

  @Test
  void prodProfileRejectsBlankSmtpHost() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.mail.host", "")).thenReturn("");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    assertTrue(ex.getMessage().contains("SMTP_HOST"));
  }

  @Test
  void prodProfileAcceptsFullySecuredConfiguration() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();

    assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
  }
  @Test
  void prodRejectsSandboxAndUnknownPaymentModes() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    for (var mode : new String[]{"SANDBOX", "sandbox", "INVALID", ""}) {
      when(environment.getProperty("courtly.payment.mode", "")).thenReturn(mode);
      assertTrue(assertThrows(IllegalStateException.class,
          () -> validator.run(new DefaultApplicationArguments())).getMessage().contains("PAYMENT_MODE"));
    }
  }
  @Test
  void prodRejectsMissingMailCredentials() {
    when(environment.acceptsProfiles(Profiles.of("prod", "production"))).thenReturn(true);
    mockSecureDefaults();
    when(environment.getProperty("courtly.mail.password", "")).thenReturn("");
    assertTrue(assertThrows(IllegalStateException.class,
        () -> validator.run(new DefaultApplicationArguments())).getMessage().contains("SMTP_PASSWORD"));
  }
}
