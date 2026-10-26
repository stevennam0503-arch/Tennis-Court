package com.courtly.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Fail-fast security invariant validator for production environments.
 * Runs with highest precedence before any other runner can execute or seed data.
 * Prevents the application from starting if insecure default credentials,
 * unencrypted cookies, demo modes, placeholder secrets, or sample bank accounts are configured.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class ProductionSecurityValidator implements ApplicationRunner {

  private final Environment environment;

  @Override
  public void run(ApplicationArguments args) {
    if (!environment.acceptsProfiles(Profiles.of("prod", "production"))) {
      log.debug("Non-production profile active. Skipping strict production security validation.");
      return;
    }

    log.info("Validating production security invariants...");

    String dbPassword = environment.getProperty("spring.datasource.password", "");
    if (dbPassword.isBlank() || "courtly_local".equalsIgnoreCase(dbPassword)) {
      throw new IllegalStateException(
          "FATAL: Insecure default database password ('courtly_local') detected in production profile! "
              + "Please configure a secure DB_PASSWORD via environment variables.");
    }

    boolean cookieSecure = Boolean.parseBoolean(
        environment.getProperty("server.servlet.session.cookie.secure", "false"));
    if (!cookieSecure) {
      throw new IllegalStateException(
          "FATAL: server.servlet.session.cookie.secure must be true in production profile! "
              + "Please set COOKIE_SECURE=true.");
    }

    boolean demoMode = Boolean.parseBoolean(
        environment.getProperty("courtly.demo-mode", "false"));
    if (demoMode) {
      throw new IllegalStateException(
          "FATAL: courtly.demo-mode must be false in production profile! "
              + "Please set DEMO_MODE=false.");
    }

    boolean seedDemo = Boolean.parseBoolean(
        environment.getProperty("courtly.seed-demo", "false"));
    if (seedDemo) {
      throw new IllegalStateException(
          "FATAL: courtly.seed-demo must be false in production profile! "
              + "Please set SEED_DEMO=false.");
    }

    String otpSecret = environment.getProperty("courtly.security.otp-secret", "");
    if (otpSecret.isBlank() || "CourtlySecureHmacSecretKey2026!".equals(otpSecret)) {
      throw new IllegalStateException(
          "FATAL: Insecure default or blank courtly.security.otp-secret detected in production profile! "
              + "Please configure a cryptographically random OTP_SECRET.");
    }

    String adminPassword = environment.getProperty("courtly.admin-password", "");
    if (adminPassword.isBlank() || "12345".equals(adminPassword)) {
      throw new IllegalStateException(
          "FATAL: ADMIN_PASSWORD is missing or set to default '12345' in production profile! "
              + "Please configure a strong ADMIN_PASSWORD.");
    }

    String paymentMode = environment.getProperty("courtly.payment.mode", "");
    if ("DEMO".equalsIgnoreCase(paymentMode)) {
      throw new IllegalStateException(
          "FATAL: PAYMENT_MODE must not be 'DEMO' in production profile! "
              + "Please set PAYMENT_MODE=SEPAY or configure a live payment provider.");
    }

    String webhookKey = environment.getProperty("courtly.payment.webhook-key", "");
    if (webhookKey.isBlank()) {
      throw new IllegalStateException(
          "FATAL: SEPAY_WEBHOOK_KEY is required and cannot be blank in production profile! "
              + "Please configure a valid SEPAY_WEBHOOK_KEY.");
    }

    String frontendOrigin = environment.getProperty("courtly.allowed-origin", "");
    if (frontendOrigin.isBlank()
        || frontendOrigin.contains("localhost")
        || frontendOrigin.contains("127.0.0.1")) {
      throw new IllegalStateException(
          "FATAL: FRONTEND_ORIGIN cannot be empty or point to localhost in production profile! "
              + "Configured value: '" + frontendOrigin + "'. Please configure a production domain.");
    }

    String accountNumber = environment.getProperty("courtly.payment.account-number", "");
    if ("0345678999".equals(accountNumber)) {
      throw new IllegalStateException(
          "FATAL: Default sample bank account number ('0345678999') detected in production profile! "
              + "Please configure a real PAYMENT_ACCOUNT_NUMBER via environment variables.");
    }

    String smtpHost = environment.getProperty("courtly.mail.host", "");
    if (smtpHost.isBlank()) {
      throw new IllegalStateException(
          "FATAL: courtly.mail.host (SMTP_HOST) cannot be blank in production profile! "
              + "Real users will not be able to receive OTP or activation emails. Please configure SMTP_HOST.");
    }

    log.info("All production security invariants validated successfully.");
  }
}
